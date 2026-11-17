import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Room, Submission, AiEvaluation
from app.services import process_and_compress_image, save_image, evaluate_room_image

router = APIRouter()


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
    image: UploadFile = File(..., description="Ảnh chụp phòng trực tiếp từ camera"),
    db: Session = Depends(get_db),
):
    """
    Luồng xử lý hoàn chỉnh (Tuần 2 - Ngày 8 đến 11):
    1. Nhận ảnh từ sinh viên tải lên
    2. Nén và resize ảnh (Pillow) để dung lượng < 500KB và sửa góc xoay EXIF
    3. Gửi ảnh sang Gemini Vision API phân tích 5S
    4. Kiểm tra tính hợp lệ của ảnh (tránh ảnh mờ, đen, ảnh không phải phòng)
    5. Lưu ảnh (Cloudinary hoặc Local Storage)
    6. Lưu bản ghi Submission và AiEvaluation vào CSDL
    7. Trả kết quả JSON chuẩn theo API_SPEC_KTX5S.md
    """
    # 1. Kiểm tra / Tự động tìm phòng (hoặc tạo mới phòng nếu lần đầu test)
    room = db.query(Room).filter(Room.room_code == room_code.strip()).first()
    if not room:
        parts = room_code.split("-")
        building = parts[0] if len(parts) > 0 else "A"
        room_number = parts[1] if len(parts) > 1 else "101"
        floor = int(room_number[0]) if (room_number and room_number[0].isdigit()) else 1
        room = Room(
            room_code=room_code.strip(),
            building=building,
            floor=floor,
            room_number=room_number,
        )
        db.add(room)
        db.commit()
        db.refresh(room)

    # 2. Đọc file ảnh từ request
    try:
        raw_bytes = await image.read()
        if not raw_bytes:
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "data": None,
                    "message": "Không nhận được dữ liệu ảnh.",
                    "error_code": "INVALID_IMAGE",
                },
            )
    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "data": None,
                "message": f"Lỗi đọc file ảnh: {str(e)}",
                "error_code": "INVALID_IMAGE",
            },
        )

    # 3. Nén ảnh với Pillow (giảm dung lượng < 500KB và resize 1024px)
    try:
        compressed_bytes, size_kb = process_and_compress_image(
            raw_bytes, max_dimension=1024, quality=80
        )
    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "data": None,
                "message": f"Ảnh không đúng định dạng: {str(e)}",
                "error_code": "INVALID_IMAGE",
            },
        )

    # 4. Gửi ảnh sang Gemini Vision API phân tích 5S
    try:
        ai_result = evaluate_room_image(compressed_bytes)
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "data": None,
                "message": f"Lỗi xử lý AI: {str(e)}",
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

    # 6. Lưu trữ ảnh (Cloudinary hoặc Local Static Storage)
    try:
        image_url = await save_image(
            compressed_bytes,
            room_code=room.room_code,
            filename_prefix="5s",
        )
    except Exception as e:
        image_url = ""

    # 7. Tính mã tuần (VD: 2026-W47)
    now = datetime.now()
    week_str = f"{now.year}-W{now.isocalendar()[1]:02d}"

    # Parse captured_at
    try:
        captured_dt = datetime.fromisoformat(captured_at.replace("Z", "+00:00"))
    except Exception:
        captured_dt = datetime.now(timezone.utc)

    # 8. Lưu Submission vào Database
    submission = Submission(
        room_id=room.id,
        week=week_str,
        image_url=image_url,
        image_size_kb=size_kb,
        captured_at=captured_dt,
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)

    # 9. Lưu AiEvaluation vào Database
    checklist = ai_result.get("checklist", {})
    issues_list = ai_result.get("issues_detected", [])
    positive_list = ai_result.get("positive_notes", [])
    recommendations_text = ai_result.get("recommendations", "")
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
        final_status=clean_status,
        final_score=float(ai_result.get("score", 0.0)),
        ai_response_time_ms=ai_result.get("ai_response_time_ms", 0),
    )
    db.add(ai_eval)
    db.commit()
    db.refresh(ai_eval)

    # 10. Trả về đúng quy chuẩn API_SPEC_KTX5S.md
    return {
        "success": True,
        "data": {
            "submission_id": submission.id,
            "room_code": room.room_code,
            "submitted_at": submission.submitted_at.isoformat(),
            "image_url": image_url,
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


@router.get("/rooms/{room_code}/history", summary="Xem lịch sử đánh giá theo phòng")
async def get_room_history(
    room_code: str,
    limit: int = Query(10, ge=1, le=50),
    page: int = Query(1, ge=1),
    db: Session = Depends(get_db),
):
    """
    Xem lịch sử các tuần đã nộp ảnh của 1 phòng (Ngày 12)
    """
    room = db.query(Room).filter(Room.room_code == room_code.strip()).first()
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
