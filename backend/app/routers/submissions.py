import json
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.database import get_db, SessionLocal
from app.models import Room, Submission, SubmissionPhoto, AiEvaluation, User
from app.services.auth_service import get_current_user, get_student_room, require_room_access
from app.services import process_and_compress_image, save_image, evaluate_room_image

router = APIRouter()
logger = logging.getLogger(__name__)
MAX_PHOTOS = 4
MAX_PHOTO_BYTES = 10 * 1024 * 1024


def already_submitted(room_code: str, week: str) -> JSONResponse:
    return JSONResponse(
        status_code=409,
        content={
            "success": False,
            "data": None,
            "message": f"Phòng {room_code} đã nộp ảnh tuần {week}. Bạn có thể xem kết quả trong lịch sử.",
            "error_code": "ALREADY_SUBMITTED",
        },
    )


def normalize_status(raw: str) -> str:
    """Chuẩn hóa trạng thái 5S, bảo vệ hiển thị tiếng Việt có dấu chuẩn xác 100%."""
    if not raw:
        return "Bừa bộn"
    s = raw.strip().lower()
    if "sạch" in s or "sach" in s or "s?ch" in s or "clean" in s:
        return "Sạch"
    if "hơi" in s or "hoi" in s or "h?i" in s or "slightly" in s:
        return "Hơi bừa bộn"
    return "Bừa bộn"


@router.post("/submissions", summary="Sinh viên nộp ảnh phòng")
async def create_submission(
    room_code: str = Form(..., description="Mã phòng, VD: A3-205"),
    captured_at: str = Form(..., description="Thời gian chụp ISO 8601, VD: 2026-11-17T08:00:00+07:00"),
    image: list[UploadFile] = File(..., description="Từ 1 đến 4 ảnh. Gửi lặp lại trường image."),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Chấm các góc chụp cùng phòng và lưu một lượt nộp theo tuần."""
    room = get_student_room(current_user, db)
    clean_room_code = room.room_code
    if room_code.strip().casefold() != clean_room_code.casefold():
        raise HTTPException(403, "Bạn chỉ được nộp ảnh cho phòng được phân cho mình.")

    # Giữ cùng cách tính tuần với trang quản lý và báo cáo.
    now = datetime.now()
    week_str = f"{now.year}-W{now.isocalendar()[1]:02d}"
    room_id = room.id
    if db.query(Submission.id).filter(
        Submission.room_id == room_id, Submission.week == week_str
    ).first() is not None:
        return already_submitted(clean_room_code, week_str)

    if not 1 <= len(image) <= MAX_PHOTOS:
        raise HTTPException(400, f"Mỗi lượt nộp nhận từ 1 đến {MAX_PHOTOS} ảnh.")

    compressed_images = []
    size_kb = 0
    for position, photo in enumerate(image, start=1):
        raw_bytes = await photo.read(MAX_PHOTO_BYTES + 1)
        if not raw_bytes:
            raise HTTPException(400, f"Ảnh số {position} không có dữ liệu.")
        if len(raw_bytes) > MAX_PHOTO_BYTES:
            raise HTTPException(413, f"Ảnh số {position} vượt quá 10 MB.")
        try:
            compressed, photo_size_kb = process_and_compress_image(
                raw_bytes, max_dimension=1024, quality=80
            )
        except Exception:
            raise HTTPException(400, f"Ảnh số {position} không đúng định dạng.") from None
        compressed_images.append(compressed)
        size_kb += photo_size_kb

    try:
        ai_result = evaluate_room_image(compressed_images)
    except Exception:
        logger.exception("Không thể phân tích bộ ảnh của phòng %s", clean_room_code)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "data": None,
                "message": "Không thể phân tích bộ ảnh. Vui lòng thử lại.",
                "error_code": "AI_ERROR",
            },
        )

    # 5. Kiểm tra tính hợp lệ của ảnh phòng
    if not ai_result.get("is_valid_room_photo", True):
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "data": None,
                "message": ai_result.get(
                    "recommendations",
                    "Ảnh quá tối hoặc mờ. Vui lòng chụp lại ở nơi đủ sáng và thấy rõ phòng.",
                ),
                "error_code": "INVALID_IMAGE",
            },
        )

    # Parse captured_at thành naive datetime (loại bỏ tzinfo để SQL Server không bị lỗi overflow)
    try:
        raw_dt = datetime.fromisoformat(captured_at.replace("Z", "+00:00"))
        if raw_dt.tzinfo is not None:
            captured_dt = raw_dt.astimezone(timezone.utc).replace(tzinfo=None)
        else:
            captured_dt = raw_dt
    except Exception:
        captured_dt = datetime.utcnow()

    # Ghi lượt nộp và kết quả AI trong cùng một giao dịch.
    try:
        submission = Submission(
            room_id=room_id,
            week=week_str,
            image_url="",
            image_size_kb=size_kb,
            captured_at=captured_dt,
        )
        db.add(submission)
        # Để ràng buộc SQL Server xử lý trường hợp hai yêu cầu nộp cùng lúc.
        db.flush()

        checklist = ai_result.get("checklist", {})
        issues_list = ai_result.get("issues_detected", [])
        positive_list = ai_result.get("positive_notes", [])
        recommendations_text = ai_result.get("recommendations", "")
        deductions = ai_result.get("deductions", [])
        clean_status = normalize_status(ai_result.get("status", "Bừa bộn"))

        ai_eval = AiEvaluation(
            submission_id=submission.id,
            status=clean_status,
            score=float(ai_result.get("score", 0.0)),
            is_valid_room_photo=True,
            bed_tidy=checklist.get("bed_tidy", False),
            floor_clean=checklist.get("floor_clean", False),
            desk_organized=checklist.get("desk_organized", False),
            shoes_arranged=checklist.get("shoes_arranged", False),
            issues_detected=json.dumps(issues_list, ensure_ascii=False),
            positive_notes=json.dumps(positive_list, ensure_ascii=False),
            recommendations=recommendations_text,
            deductions=json.dumps(deductions, ensure_ascii=False),
            final_status=clean_status,
            final_score=float(ai_result.get("score", 0.0)),
            ai_response_time_ms=ai_result.get("ai_response_time_ms", 0),
        )
        db.add(ai_eval)
        db.flush()

        image_urls = []
        for position, compressed in enumerate(compressed_images, start=1):
            image_url = await save_image(compressed, room_code=clean_room_code, filename_prefix="5s")
            if not image_url:
                raise RuntimeError(f"Không nhận được đường dẫn ảnh số {position}.")
            image_urls.append(image_url)
            db.add(SubmissionPhoto(submission_id=submission.id, position=position, image_url=image_url))
        submission.image_url = image_urls[0]
        db.commit()
    except Exception as exc:
        db.rollback()
        if isinstance(exc, IntegrityError) and "UQ_room_week" in str(exc.orig):
            return already_submitted(clean_room_code, week_str)
        logger.exception("Không thể lưu kết quả cho phòng %s, tuần %s", clean_room_code, week_str)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "data": None,
                "message": "Không thể lưu kết quả. Vui lòng thử lại hoặc liên hệ cán bộ quản lý.",
                "error_code": "DB_ERROR",
            },
        )

    # 10. Trả về đúng quy chuẩn API_SPEC_KTX5S.md
    return {
        "success": True,
        "data": {
            "submission_id": submission.id,
            "room_code": room.room_code,
            "submitted_at": submission.submitted_at.isoformat(),
            "image_url": image_urls[0],
            "image_urls": image_urls,
            "ai_result": {
                "status": clean_status,
                "score": round(ai_eval.score, 1),
                "is_valid_room_photo": True,
                "checklist": {
                    "bed_tidy": ai_eval.bed_tidy,
                    "floor_clean": ai_eval.floor_clean,
                    "desk_organized": ai_eval.desk_organized,
                    "shoes_arranged": ai_eval.shoes_arranged,
                },
                "issues_detected": issues_list,
                "positive_notes": positive_list,
                "recommendations": recommendations_text,
            },
        },
        "message": "Nộp ảnh thành công! AI đã chấm điểm xong.",
    }


@router.get("/submissions/{submission_id}", summary="Xem chi tiết lượt nộp (Sinh viên)")
async def get_submission_detail_student(
    submission_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Sinh viên chỉ xem chi tiết của lượt nộp thuộc phòng mình."""
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Chỉ sinh viên mới xem chi tiết.")
    room = get_student_room(current_user, db)
    sub = (
        db.query(Submission)
        .filter(Submission.id == submission_id, Submission.room_id == room.id)
        .first()
    )
    if not sub:
        return JSONResponse(
            status_code=404,
            content={
                "success": False,
                "data": None,
                "message": f"Không tìm thấy lượt nộp ID {submission_id} cho phòng của bạn.",
                "error_code": "NOT_FOUND",
            },
        )
    ai_eval = sub.ai_evaluation
    issues = json.loads(ai_eval.issues_detected) if (ai_eval and ai_eval.issues_detected) else []
    positives = json.loads(ai_eval.positive_notes) if (ai_eval and ai_eval.positive_notes) else []
    deductions = json.loads(ai_eval.deductions) if (ai_eval and ai_eval.deductions) else []
    return {
        "success": True,
        "data": {
            "submission_id": sub.id,
            "room_code": sub.room.room_code if sub.room else "N/A",
            "week": sub.week,
            "submitted_at": sub.submitted_at.isoformat(),
            "image_url": sub.image_url,
            "image_urls": [photo.image_url for photo in sub.photos] or ([sub.image_url] if sub.image_url else []),
            "ai_result": {
                "status": ai_eval.status if ai_eval else "Chưa chấm",
                "score": round(ai_eval.score, 1) if ai_eval else 0.0,
                "is_valid_room_photo": ai_eval.is_valid_room_photo if ai_eval else True,
                "checklist": {
                    "bed_tidy": ai_eval.bed_tidy if ai_eval else False,
                    "floor_clean": ai_eval.floor_clean if ai_eval else False,
                    "desk_organized": ai_eval.desk_organized if ai_eval else False,
                    "shoes_arranged": ai_eval.shoes_arranged if ai_eval else False,
                },
                "issues_detected": issues,
                "positive_notes": positives,
                "deductions": deductions,
                "recommendations": ai_eval.recommendations if ai_eval else "",
                "ai_response_time_ms": ai_eval.ai_response_time_ms if ai_eval else 0,
            },
            "override_info": {
                "is_overridden": sub.is_overridden,
                "final_status": ai_eval.final_status if ai_eval else None,
                "final_score": ai_eval.final_score if ai_eval else None,
                "overridden_by": sub.overridden_by,
                "overridden_at": sub.overridden_at.isoformat() if sub.overridden_at else None,
                "override_note": sub.override_note,
            },
        },
        "message": "OK",
    }

@router.get("/rooms/{room_code}/history", summary="Xem lịch sử theo phòng")
@router.get("/history/{room_code}", summary="Xem lịch sử theo phòng (alias cũ)")
async def get_room_history(
    room_code: str,
    limit: int = Query(10, ge=1, le=50),
    page: int = Query(1, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Xem lịch sử các tuần đã nộp ảnh của 1 phòng (Ngày 12)
    """
    room = require_room_access(current_user, room_code, db)
    if not room:
        return {
            "success": True,
            "data": {
                "room_code": room_code,
                "total_submissions": 0,
                "history": [],
            },
            "message": f"Chưa có dữ liệu cho phòng {room_code}",
        }

    total_submissions = (
        db.query(Submission).filter(Submission.room_id == room.id).count()
    )

    offset = (page - 1) * limit
    submissions = (
        db.query(Submission)
        .filter(Submission.room_id == room.id)
        .order_by(Submission.submitted_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    history = []
    for s in submissions:
        eval_record = s.ai_evaluation
        status = normalize_status(
            eval_record.final_status or eval_record.status
            if eval_record
            else "Chưa chấm"
        )
        score = (
            eval_record.final_score if eval_record and eval_record.final_score is not None
            else (eval_record.score if eval_record else 0.0)
        )

        history.append({
            "submission_id": s.id,
            "week": s.week,
            "submitted_at": s.submitted_at.isoformat(),
            "image_url": s.image_url,
            "status": status,
            "score": round(score, 1),
            "is_overridden": s.is_overridden,
            "override_note": s.override_note,
        })

    return {
        "success": True,
        "data": {
            "room_code": room.room_code,
            "total_submissions": total_submissions,
            "history": history,
        },
        "message": f"Lấy lịch sử phòng {room_code} thành công",
    }


@router.post("/ai/evaluate", summary="Chấm điểm 4 ảnh phòng bằng AI Gemini Vision (kết nối trực tiếp Frontend)")
async def evaluate_four_photos(
    room_code: str = Form(..., description="Mã phòng, VD: A3-301"),
    captured_at: str = Form(..., description="Thời gian chụp ISO 8601"),
    image: list[UploadFile] = File(..., description="Bắt buộc 4 ảnh: Giường, Sàn nhà, Kệ giày dép, Bàn học"),
):
    """Nhận 4 ảnh từ giao diện Sinh viên B, nén ảnh, gọi AI Gemini Vision của Sinh viên A và trả kết quả chuẩn."""
    clean_room_code = room_code.strip().upper()
    if len(image) != 4:
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "data": None,
                "message": f"Bắt buộc chụp đủ 4 ảnh (Giường, Sàn nhà, Kệ giày dép, Bàn học). Hiện mới nhận {len(image)} ảnh.",
                "error_code": "INVALID_IMAGE",
            },
        )

    compressed_images = []
    size_kb = 0
    for position, photo in enumerate(image, start=1):
        raw_bytes = await photo.read(MAX_PHOTO_BYTES + 1)
        if not raw_bytes:
            return JSONResponse(
                status_code=400,
                content={"success": False, "data": None, "message": f"Ảnh số {position} không có dữ liệu.", "error_code": "INVALID_IMAGE"},
            )
        if len(raw_bytes) > MAX_PHOTO_BYTES:
            return JSONResponse(
                status_code=413,
                content={"success": False, "data": None, "message": f"Ảnh số {position} vượt quá 10 MB.", "error_code": "INVALID_IMAGE"},
            )
        try:
            compressed, photo_size_kb = process_and_compress_image(raw_bytes, max_dimension=1024, quality=80)
        except Exception:
            return JSONResponse(
                status_code=400,
                content={"success": False, "data": None, "message": f"Ảnh số {position} không đúng định dạng.", "error_code": "INVALID_IMAGE"},
            )
        compressed_images.append(compressed)
        size_kb += photo_size_kb

    # Gọi AI Gemini Vision của Sinh viên A
    try:
        ai_result = evaluate_room_image(compressed_images)
    except Exception as exc:
        logger.exception("Lỗi gọi Gemini Vision API cho phòng %s", clean_room_code)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "data": None,
                "message": f"Lỗi AI: {str(exc)}",
                "error_code": "AI_ERROR",
            },
        )

    # Luôn tự động lưu 4 file ảnh lên Cloudinary vào thư mục của phòng: ktx5s/{room_code}/
    image_urls = []
    for position, compressed in enumerate(compressed_images, start=1):
        url = await save_image(compressed, room_code=clean_room_code, filename_prefix=f"area_{position}")
        image_urls.append(url)

    if not ai_result.get("is_valid_room_photo", True):
        invalid_msg = (
            ai_result.get("invalid_reason")
            or ai_result.get("recommendations")
            or "Ảnh chụp không đúng góc quy định hoặc bị phát hiện gian lận. Vui lòng chụp lại đúng các khu vực trong phòng."
        )
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "data": {"image_urls": image_urls},
                "message": invalid_msg,
                "error_code": "INVALID_IMAGE",
            },
        )

    checklist = ai_result.get("checklist", {})
    clean_status = normalize_status(ai_result.get("status", "Bừa bộn"))
    score = round(float(ai_result.get("score", 0.0)), 1)
    issues_list = ai_result.get("issues_detected", [])
    positive_list = ai_result.get("positive_notes", [])
    recommendations_text = ai_result.get("recommendations", "")

    now = datetime.now()
    week_str = f"{now.year}-W{now.isocalendar()[1]:02d}"
    submission_id = f"sub_{week_str}_{clean_room_code}"

    # Nếu SQL Server đang bật thì tự động lưu luôn vào CSDL của Sinh viên A
    try:
        with SessionLocal() as db:
            room_obj = db.query(Room).filter(Room.room_code == clean_room_code).first()
            if not room_obj:
                parts = clean_room_code.split("-")
                building = parts[0][0] if parts and parts[0] else "A"
                floor_num = 1
                room_num = clean_room_code
                if len(parts) >= 2:
                    room_num = parts[1]
                    try:
                        floor_num = int(room_num[0])
                    except Exception:
                        floor_num = 1
                room_obj = Room(
                    room_code=clean_room_code,
                    building=building,
                    floor=floor_num,
                    room_number=room_num,
                    capacity=4,
                    is_active=True,
                )
                db.add(room_obj)
                db.commit()
                db.refresh(room_obj)

            existing = (
                db.query(Submission)
                .filter(Submission.room_id == room_obj.id, Submission.week == week_str)
                .first()
            )
            if existing:
                db.query(SubmissionPhoto).filter(SubmissionPhoto.submission_id == existing.id).delete()
                db.query(AiEvaluation).filter(AiEvaluation.submission_id == existing.id).delete()
                db.delete(existing)
                db.flush()

            sub = Submission(
                room_id=room_obj.id,
                week=week_str,
                image_url=image_urls[0],
                image_size_kb=size_kb,
                captured_at=datetime.utcnow(),
            )
            db.add(sub)
            db.flush()
            submission_id = sub.id

            ai_eval = AiEvaluation(
                submission_id=sub.id,
                status=clean_status,
                score=score,
                is_valid_room_photo=True,
                bed_tidy=bool(checklist.get("bed_tidy")),
                floor_clean=bool(checklist.get("floor_clean")),
                desk_organized=bool(checklist.get("desk_organized")),
                shoes_arranged=bool(checklist.get("shoes_arranged")),
                issues_detected=json.dumps(issues_list, ensure_ascii=False),
                positive_notes=json.dumps(positive_list, ensure_ascii=False),
                recommendations=recommendations_text,
                deductions=json.dumps(ai_result.get("deductions", []), ensure_ascii=False),
                final_status=clean_status,
                final_score=score,
                ai_response_time_ms=ai_result.get("ai_response_time_ms", 0),
            )
            db.add(ai_eval)
            for pos, u in enumerate(image_urls, start=1):
                db.add(SubmissionPhoto(submission_id=sub.id, position=pos, image_url=u))
            db.commit()
    except Exception:
        logger.warning("Bỏ qua lưu DB (SQL Server chưa kết nối), vẫn trả kết quả AI bình thường.")

    return {
        "success": True,
        "data": {
            "submission_id": submission_id,
            "room_code": clean_room_code,
            "submitted_at": now.isoformat(),
            "image_url": image_urls[0],
            "image_urls": image_urls,
            "ai_result": {
                "status": clean_status,
                "score": score,
                "is_valid_room_photo": True,
                "checklist": {
                    "bed_tidy": bool(checklist.get("bed_tidy")),
                    "floor_clean": bool(checklist.get("floor_clean")),
                    "desk_organized": bool(checklist.get("desk_organized")),
                    "shoes_arranged": bool(checklist.get("shoes_arranged")),
                },
                "issues_detected": issues_list,
                "positive_notes": positive_list,
                "recommendations": recommendations_text,
            },
        },
        "message": "Nộp 4 ảnh thành công! AI của bạn A đã chấm điểm xong.",
    }
