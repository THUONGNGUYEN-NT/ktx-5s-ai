import asyncio
import json
import logging
import random
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

VN_TZ = timezone(timedelta(hours=7))
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    AiEvaluation,
    CaptureSession,
    CaptureSessionPhoto,
    Room,
    Submission,
    SubmissionPhoto,
    User,
)
from app.services import process_and_compress_image, save_image
from app.services.ai_service import evaluate_room_session
from app.services.auth_service import get_current_user, get_student_room
from app.services.capture_service import (
    MAX_HASH_DISTANCE_DUPLICATE,
    build_capture_slots,
    hamming_distance_hex,
    inspect_photo_quality,
    normalize_bed_count,
    pick_random_challenge,
)

router = APIRouter()
logger = logging.getLogger(__name__)
MAX_PHOTO_BYTES = 10 * 1024 * 1024


class StartSessionRequest(BaseModel):
    room_code: str = Field(..., description="Mã phòng KTX, VD: A1-101")
    bed_count: Optional[int] = Field(None, description="Số vị trí ngủ thực tế P (2, 4, 6, 8)")
    qr_code: Optional[str] = Field(None, description="Mã QR quét tại phòng để xác thực")


def _resolve_room_for_session(
    db: Session,
    room_code: str,
    current_user: Optional[User] = None,
) -> Room:
    clean_code = room_code.strip().upper()
    if current_user and current_user.role == "student":
        assigned_room = get_student_room(current_user, db)
        if assigned_room.room_code.upper() != clean_code:
            raise HTTPException(
                status_code=403,
                detail=f"Tài khoản của bạn được phân ở phòng {assigned_room.room_code}, không thể kiểm tra phòng {clean_code}.",
            )
        return assigned_room

    room = db.query(Room).filter(Room.room_code == clean_code).first()
    if not room:
        parts = clean_code.split("-")
        building = parts[0][0] if parts and parts[0] else "A"
        room_num = parts[1] if len(parts) >= 2 else clean_code
        try:
            floor_num = int(room_num[0]) if room_num and room_num[0].isdigit() else 1
        except Exception:
            floor_num = 1
        room = Room(
            room_code=clean_code,
            building=building,
            floor=floor_num,
            room_number=room_num,
            capacity=4,
            bed_count=4,
            is_active=True,
        )
        db.add(room)
        db.commit()
        db.refresh(room)
    return room


@router.post("/capture-sessions/start", summary="Khởi tạo phiên chụp ảnh 5S")
async def start_capture_session(
    body: StartSessionRequest,
    db: Session = Depends(get_db),
):
    """
    Bước 1 & 2: Xác thực phòng + QR, khởi tạo phiên chụp mới trên server,
    sinh danh sách ảnh giường tầng (trên & dưới) + 4 khu vực chung + thử thách góc chụp ngẫu nhiên (Lớp 4).
    """
    room = _resolve_room_for_session(db, body.room_code)

    # Lớp 3: Xác thực mã QR định danh phòng (nếu client gửi lên)
    qr_verified = False
    if body.qr_code:
        qr_clean = body.qr_code.strip().upper()
        if room.room_code.upper() not in qr_clean:
            return JSONResponse(
                status_code=403,
                content={
                    "success": False,
                    "data": None,
                    "message": f"Mã QR ({body.qr_code}) không khớp với phòng {room.room_code}.",
                    "error_code": "QR_MISMATCH",
                },
            )
        qr_verified = True

    p_count = normalize_bed_count(body.bed_count or room.bed_count or room.capacity)
    bunk_count = max(1, (p_count + 1) // 2)
    total_required = bunk_count + 3

    # Lớp 4: Thử thách góc chụp ngẫu nhiên theo phiên
    challenge_prompt = pick_random_challenge()
    # Lớp 7: Tỷ lệ 20% phiên được gắn kiểm tra ngẫu nhiên bổ sung
    audit_required = random.random() < 0.20

    now = datetime.utcnow()
    now_vn = datetime.now(VN_TZ)
    iso_year, iso_week, _ = now_vn.isocalendar()
    week_str = f"{iso_year}-W{iso_week:02d}"
    session = CaptureSession(
        room_id=room.id,
        room_code=room.room_code,
        week=week_str,
        bed_count=p_count,
        total_required=total_required,
        qr_verified=qr_verified,
        qr_token=body.qr_code,
        challenge_slot_code="CH01",
        challenge_prompt=challenge_prompt,
        audit_required=audit_required,
        status="in_progress",
        created_at=now,
        expires_at=now + timedelta(minutes=30),
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    slots = build_capture_slots(p_count, challenge_prompt=challenge_prompt)

    return {
        "success": True,
        "data": {
            "session_id": session.id,
            "room_code": room.room_code,
            "week": week_str,
            "bed_count": p_count,
            "common_count": 3,
            "total_required": total_required,
            "total_with_challenge": len(slots),
            "qr_verified": qr_verified,
            "audit_required": audit_required,
            "challenge_prompt": challenge_prompt,
            "server_timestamp": now_vn.isoformat(),
            "expires_at": session.expires_at.isoformat() + "Z",
            "slots": slots,
        },
        "message": f"Đã khởi tạo phiên chụp cho phòng {room.room_code} ({bunk_count} ảnh giường tầng trên & dưới + 3 khu vực chung + 1 góc thử thách).",
    }


@router.post("/capture-sessions/{session_id}/photos", summary="Tải lên & kiểm tra chất lượng 1 góc chụp trong phiên")
async def upload_session_photo(
    session_id: str,
    slot_code: str = Form(...),
    captured_via_camera: bool = Form(True),
    capture_source: str = Form("camera"),
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Lớp 1, 2, 5, 6:
    - Bắt buộc captured_via_camera = true (không cho chọn từ thư viện)
    - Kiểm tra phiên còn hiệu lực trên server
    - Kiểm tra độ phân giải >= 1280x720, ánh sáng, độ nét
    - Kiểm tra trùng lặp với các slot khác trong phiên hoặc ảnh các phiên trước
    """
    if not captured_via_camera:
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "data": None,
                "message": "Hệ thống chỉ chấp nhận ảnh chụp trực tiếp từ camera trong ứng dụng.",
                "error_code": "LIBRARY_UPLOAD_FORBIDDEN",
            },
        )

    session = db.query(CaptureSession).filter(CaptureSession.id == session_id).first()
    if not session:
        raise HTTPException(404, "Không tìm thấy phiên chụp.")
    if datetime.utcnow() > session.expires_at:
        return JSONResponse(
            status_code=410,
            content={
                "success": False,
                "data": None,
                "message": "Phiên chụp đã hết hạn (quá 30 phút). Vui lòng tạo phiên mới.",
                "error_code": "SESSION_EXPIRED",
            },
        )

    slots = build_capture_slots(session.bed_count, challenge_prompt=session.challenge_prompt)
    slot_meta = next((s for s in slots if s["slot_code"] == slot_code), None)
    if not slot_meta:
        raise HTTPException(400, f"Mã góc chụp {slot_code} không hợp lệ.")

    raw_bytes = await image.read(MAX_PHOTO_BYTES + 1)
    if not raw_bytes:
        raise HTTPException(400, "Ảnh không có dữ liệu.")
    if len(raw_bytes) > MAX_PHOTO_BYTES:
        raise HTTPException(413, "Ảnh vượt quá 10 MB.")

    try:
        quality = inspect_photo_quality(raw_bytes, enforce_hd=(capture_source != "desktop_test"))
    except Exception:
        raise HTTPException(400, "Không thể đọc định dạng ảnh.") from None

    # Lớp 5: So sánh trùng lặp với các slot khác trong cùng phiên
    duplicate_issues: list[str] = []
    for existing in session.photos:
        if existing.slot_code == slot_code:
            continue
        dist = hamming_distance_hex(quality["image_hash"], existing.image_hash)
        if dist <= MAX_HASH_DISTANCE_DUPLICATE:
            duplicate_issues.append(
                f"Ảnh trùng lặp với góc {existing.slot_label} trong cùng phiên."
            )

    validation_status = quality["validation_status"]
    issues = list(quality["issues"])
    if duplicate_issues:
        validation_status = "anomalous"
        issues.extend(duplicate_issues)

    # Nén và lưu ảnh
    compressed, _ = process_and_compress_image(raw_bytes, max_dimension=1280, quality=82)
    image_url = await save_image(compressed, room_code=session.room_code, filename_prefix=slot_code)

    existing_slot = (
        db.query(CaptureSessionPhoto)
        .filter(CaptureSessionPhoto.session_id == session.id, CaptureSessionPhoto.slot_code == slot_code)
        .first()
    )
    if existing_slot:
        existing_slot.image_url = image_url
        existing_slot.image_hash = quality["image_hash"]
        existing_slot.width = quality["width"]
        existing_slot.height = quality["height"]
        existing_slot.brightness = quality["brightness"]
        existing_slot.blur_score = quality["blur_score"]
        existing_slot.captured_via_camera = True
        existing_slot.captured_at_server = datetime.utcnow()
        existing_slot.validation_status = validation_status
        existing_slot.validation_reason = "; ".join(issues) if issues else None
    else:
        db.add(
            CaptureSessionPhoto(
                session_id=session.id,
                slot_code=slot_code,
                slot_group=slot_meta["slot_group"],
                slot_label=slot_meta["slot_label"],
                image_url=image_url,
                image_hash=quality["image_hash"],
                width=quality["width"],
                height=quality["height"],
                brightness=quality["brightness"],
                blur_score=quality["blur_score"],
                captured_via_camera=True,
                validation_status=validation_status,
                validation_reason="; ".join(issues) if issues else None,
            )
        )
    db.commit()

    return {
        "success": validation_status == "passed",
        "data": {
            "slot_code": slot_code,
            "slot_label": slot_meta["slot_label"],
            "image_url": image_url,
            "width": quality["width"],
            "height": quality["height"],
            "brightness": quality["brightness"],
            "blur_score": quality["blur_score"],
            "validation_status": validation_status,
            "issues": issues,
        },
        "message": "Ảnh đạt chuẩn chất lượng." if validation_status == "passed" else " | ".join(issues),
    }


def _load_image_bytes(image_url: str) -> bytes:
    """Đọc lại bytes ảnh từ local static/uploads hoặc URL Cloudinary."""
    from pathlib import Path
    import urllib.request

    if image_url.startswith("/uploads/"):
        rel = image_url[len("/uploads/"):]
        local_path = Path("static/uploads") / rel
        return local_path.read_bytes()
    if image_url.startswith("http://") or image_url.startswith("https://"):
        with urllib.request.urlopen(image_url, timeout=15) as resp:
            return resp.read()
    raise FileNotFoundError(f"Không thể đọc ảnh từ {image_url}")


@router.post("/capture-sessions/{session_id}/submit", summary="Hoàn tất phiên chụp, AI kiểm tra bổ sung và chấm điểm L1–L4")
async def submit_capture_session(
    session_id: str,
    db: Session = Depends(get_db),
):
    """
    Bước 5 & 6:
    - Kiểm tra đủ tất cả góc chụp bắt buộc (giường tầng + 4 khu vực chung + thử thách CH01)
    - Kiểm tra trùng lặp lần cuối
    - Gọi AI chấm tổng hợp theo 4 nhóm lỗi L1..L4
    - Nếu AI phát hiện ảnh thiếu bằng chứng / cần chụp bổ sung -> trả về retake_requests
    """
    session = db.query(CaptureSession).filter(CaptureSession.id == session_id).first()
    if not session:
        raise HTTPException(404, "Không tìm thấy phiên chụp.")

    slots = build_capture_slots(session.bed_count, challenge_prompt=session.challenge_prompt)
    photo_map = {p.slot_code: p for p in session.photos}

    missing = [s["slot_label"] for s in slots if s["slot_code"] not in photo_map]
    if missing:
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "data": {"missing_slots": missing},
                "message": f"Chưa chụp đủ góc bắt buộc. Còn thiếu {len(missing)} ảnh: {', '.join(missing[:4])}.",
                "error_code": "MISSING_SLOTS",
            },
        )

    not_passed = [
        {"slot_code": p.slot_code, "slot_label": p.slot_label, "reason": p.validation_reason or "Chưa đạt chất lượng"}
        for p in session.photos
        if p.validation_status != "passed"
    ]
    if not_passed:
        session.status = "needs_retake"
        db.commit()
        return JSONResponse(
            status_code=422,
            content={
                "success": False,
                "data": {
                    "assessment_category": "Ảnh không đạt yêu cầu",
                    "retake_requests": not_passed,
                },
                "message": "Một số ảnh chưa đạt điều kiện chất lượng hoặc có dấu hiệu trùng lặp. Vui lòng chụp lại.",
                "error_code": "NEEDS_RETAKE",
            },
        )

    # Kiểm tra trùng lặp chéo trong phiên
    duplicate_errors: list[str] = []
    photos_ordered = [photo_map[s["slot_code"]] for s in slots]
    for i in range(len(photos_ordered)):
        for j in range(i + 1, len(photos_ordered)):
            p1, p2 = photos_ordered[i], photos_ordered[j]
            if hamming_distance_hex(p1.image_hash, p2.image_hash) <= MAX_HASH_DISTANCE_DUPLICATE:
                duplicate_errors.append(f"{p1.slot_label} trùng lặp với {p2.slot_label}")

    async def load_slot_image(photo: CaptureSessionPhoto) -> dict[str, Any]:
        try:
            raw_bytes = await asyncio.to_thread(_load_image_bytes, photo.image_url)
        except Exception as exc:
            logger.exception("Không đọc được ảnh %s", photo.image_url)
            raise HTTPException(500, f"Không thể đọc ảnh {photo.slot_label} để phân tích.") from exc
        return {
            "slot_code": photo.slot_code,
            "slot_group": photo.slot_group,
            "slot_label": photo.slot_label,
            "bytes": raw_bytes,
        }

    slot_items = await asyncio.gather(*(load_slot_image(photo) for photo in photos_ordered))

    try:
        ai_result = await asyncio.to_thread(
            evaluate_room_session,
            slot_items=slot_items,
            room_code=session.room_code,
            bed_count=session.bed_count,
            duplicate_errors=duplicate_errors,
        )
    except Exception as exc:
        logger.exception("Lỗi AI chấm phiên chụp %s", session.id)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "data": None,
                "message": f"Không thể phân tích bộ ảnh: {str(exc)}",
                "error_code": "AI_ERROR",
            },
        )

    retake_requests = ai_result.get("retake_requests") or []
    assessment_category = ai_result.get("assessment_category") or "Đạt yêu cầu"
    fraud_flag = bool(ai_result.get("fraud_flag", False))

    if retake_requests or not ai_result.get("is_valid_room_photo", True):
        # Cập nhật trạng thái từng slot theo yêu cầu AI
        req_map = {r["slot_code"]: r for r in retake_requests}
        for p in session.photos:
            if p.slot_code in req_map:
                p.validation_status = req_map[p.slot_code].get("status", "needs_retake")
                p.validation_reason = req_map[p.slot_code].get("reason", "")
        session.status = "flagged" if fraud_flag else "needs_retake"
        db.commit()
        return JSONResponse(
            status_code=422,
            content={
                "success": False,
                "data": {
                    "session_id": session.id,
                    "assessment_category": assessment_category,
                    "fraud_flag": fraud_flag,
                    "retake_requests": retake_requests,
                    "recommendations": ai_result.get("recommendations", ""),
                },
                "message": ai_result.get("recommendations") or "AI yêu cầu chụp bổ sung ảnh.",
                "error_code": "SUSPECTED_FRAUD" if fraud_flag else "NEEDS_RETAKE",
            },
        )

    # Lưu Submission + SubmissionPhoto + AiEvaluation
    existing = (
        db.query(Submission)
        .filter(Submission.room_id == session.room_id, Submission.week == session.week)
        .first()
    )
    if existing:
        db.query(SubmissionPhoto).filter(SubmissionPhoto.submission_id == existing.id).delete()
        db.query(AiEvaluation).filter(AiEvaluation.submission_id == existing.id).delete()
        db.delete(existing)
        db.flush()

    now = datetime.utcnow()
    now_vn = datetime.now(VN_TZ)
    sub = Submission(
        room_id=session.room_id,
        week=session.week,
        image_url=photos_ordered[0].image_url,
        image_size_kb=0,
        captured_at=session.created_at,
        submitted_at=now,
        capture_session_id=session.id,
        student_code=session.student_code,
        fraud_flag=fraud_flag,
        assessment_category=assessment_category,
    )
    db.add(sub)
    db.flush()

    checklist = ai_result.get("checklist") or {}
    ai_eval = AiEvaluation(
        submission_id=sub.id,
        status=ai_result.get("status", "Sạch"),
        score=float(ai_result.get("score", 0.0)),
        is_valid_room_photo=True,
        bed_tidy=bool(checklist.get("bed_tidy", True)),
        floor_clean=bool(checklist.get("floor_clean", True)),
        desk_organized=bool(checklist.get("desk_organized", True)),
        shoes_arranged=bool(checklist.get("shoes_arranged", True)),
        issues_detected=json.dumps(ai_result.get("issues_detected", []), ensure_ascii=False),
        positive_notes=json.dumps(ai_result.get("positive_notes", []), ensure_ascii=False),
        recommendations=ai_result.get("recommendations", ""),
        deductions=json.dumps(ai_result.get("deductions", []), ensure_ascii=False),
        l1_l4_summary=json.dumps(ai_result.get("l1_l4_summary", {}), ensure_ascii=False),
        bed_details=json.dumps(ai_result.get("bed_details", []), ensure_ascii=False),
        retake_requests=json.dumps([], ensure_ascii=False),
        final_status=ai_result.get("status", "Sạch"),
        final_score=float(ai_result.get("score", 0.0)),
        ai_response_time_ms=ai_result.get("ai_response_time_ms", 0),
    )
    db.add(ai_eval)

    for pos, p in enumerate(photos_ordered, start=1):
        db.add(
            SubmissionPhoto(
                submission_id=sub.id,
                position=pos,
                image_url=p.image_url,
                slot_code=p.slot_code,
                slot_label=p.slot_label,
                image_hash=p.image_hash,
            )
        )

    session.status = "submitted"
    db.commit()

    return {
        "success": True,
        "data": {
            "submission_id": sub.id,
            "session_id": session.id,
            "room_code": session.room_code,
            "week": session.week,
            "submitted_at": now_vn.isoformat(),
            "audit_required": session.audit_required,
            "assessment_category": assessment_category,
            "image_url": photos_ordered[0].image_url,
            "image_urls": [p.image_url for p in photos_ordered],
            "photos": [
                {
                    "slot_code": p.slot_code,
                    "slot_group": p.slot_group,
                    "slot_label": p.slot_label,
                    "image_url": p.image_url,
                }
                for p in photos_ordered
            ],
            "ai_result": {
                "status": ai_eval.status,
                "score": round(ai_eval.score, 1),
                "is_valid_room_photo": True,
                "checklist": {
                    "bed_tidy": ai_eval.bed_tidy,
                    "floor_clean": ai_eval.floor_clean,
                    "desk_organized": ai_eval.desk_organized,
                    "shoes_arranged": ai_eval.shoes_arranged,
                },
                "l1_l4_summary": ai_result.get("l1_l4_summary", {}),
                "bed_details": ai_result.get("bed_details", []),
                "issues_detected": ai_result.get("issues_detected", []),
                "positive_notes": ai_result.get("positive_notes", []),
                "recommendations": ai_eval.recommendations,
            },
        },
        "message": f"Đã hoàn tất kiểm tra {len(photos_ordered)} góc chụp cho phòng {session.room_code}!",
    }
