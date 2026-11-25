import json
import csv
import io
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Room, Submission, SubmissionPhoto, AiEvaluation, User
from app.services.auth_service import require_admin

router = APIRouter()


class OverrideRequest(BaseModel):
    status: str = Field(..., description="'Sạch' | 'Hơi bừa bộn' | 'Bừa bộn'")
    score: float = Field(..., description="Điểm sửa đổi từ 0.0 đến 10.0")
    override_note: str = Field(..., description="Lý do cán bộ sửa điểm")


# =============================================
# 1. DASHBOARD TỔNG QUAN
# =============================================
@router.get("/dashboard", summary="Thống kê tổng quan Dashboard (Cán bộ KTX)")
async def get_dashboard(
    week: Optional[str] = Query(None, description="Tuần cần xem, VD: 2026-W47"),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Lấy số liệu thống kê tổng hợp toàn ký túc xá theo tuần (Bảo vệ RBAC: Admin)."""
    if not week:
        now = datetime.now()
        week = f"{now.year}-W{now.isocalendar()[1]:02d}"

    total_rooms = db.query(Room).filter(Room.is_active == True).count()

    submissions = (
        db.query(Submission)
        .filter(Submission.week == week)
        .all()
    )

    submitted_room_ids = {s.room_id for s in submissions}
    submitted_count = len(submitted_room_ids)
    not_submitted_count = max(0, total_rooms - submitted_count)
    submission_rate = round((submitted_count / total_rooms * 100), 1) if total_rooms > 0 else 0.0

    clean_count = 0
    slightly_messy_count = 0
    messy_count = 0
    total_score = 0.0
    eval_count = 0

    for s in submissions:
        if s.ai_evaluation:
            status = s.ai_evaluation.final_status or s.ai_evaluation.status
            score = (
                s.ai_evaluation.final_score
                if s.ai_evaluation.final_score is not None
                else s.ai_evaluation.score
            )
            total_score += score
            eval_count += 1

            if status == "Sạch":
                clean_count += 1
            elif status == "Hơi bừa bộn":
                slightly_messy_count += 1
            elif status == "Bừa bộn":
                messy_count += 1

    avg_score = round(total_score / eval_count, 1) if eval_count > 0 else 0.0

    # Top phòng vi phạm trong tuần (điểm thấp nhất hoặc trạng thái Bừa bộn / Hơi bừa bộn)
    evaluated_subs = [s for s in submissions if s.ai_evaluation]
    evaluated_subs.sort(
        key=lambda s: (
            s.ai_evaluation.final_score
            if s.ai_evaluation.final_score is not None
            else (s.ai_evaluation.score if s.ai_evaluation.score is not None else 10.0)
        )
    )
    top_violations = []
    for s in evaluated_subs[:6]:
        status = s.ai_evaluation.final_status or s.ai_evaluation.status or "Bừa bộn"
        score = (
            s.ai_evaluation.final_score
            if s.ai_evaluation.final_score is not None
            else (s.ai_evaluation.score if s.ai_evaluation.score is not None else 0.0)
        )
        room = db.query(Room).filter(Room.id == s.room_id).first()
        room_code = room.room_code if room else f"Phòng #{s.room_id}"
        top_violations.append({
            "room_code": room_code,
            "score": round(score, 1),
            "status": status,
        })

    return {
        "success": True,
        "data": {
            "week": week,
            "summary": {
                "total_rooms": total_rooms,
                "submitted": submitted_count,
                "not_submitted": not_submitted_count,
                "submission_rate_percent": submission_rate,
            },
            "breakdown": {
                "clean": clean_count,
                "slightly_messy": slightly_messy_count,
                "messy": messy_count,
            },
            "avg_score": avg_score,
            "deadline": "Chủ Nhật hàng tuần lúc 21:00",
            "top_violations": top_violations,
        },
        "message": "OK",
    }


# =============================================
# 2. DANH SÁCH PHÒNG CÓ BỘ LỌC
# =============================================
@router.get("/rooms", summary="Danh sách phòng có bộ lọc (Cán bộ KTX)")
async def get_rooms(
    week: Optional[str] = Query(None, description="Tuần cần lọc"),
    status: Optional[str] = Query(None, description="clean / slightly_messy / messy / not_submitted"),
    building: Optional[str] = Query(None, description="Tòa nhà (VD: A, B)"),
    floor: Optional[int] = Query(None, description="Tầng"),
    room_code: Optional[str] = Query(None, description="Mã phòng hoặc tìm kiếm"),
    page: int = Query(1, ge=1),
    limit: int = Query(500, ge=1, le=1000),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Xem danh sách các phòng, tình trạng nộp ảnh và điểm số 5S theo tuần."""
    if not week:
        now = datetime.now()
        week = f"{now.year}-W{now.isocalendar()[1]:02d}"

    query = db.query(Room).filter(Room.is_active == True)
    if building:
        query = query.filter(Room.building == building.strip().upper())
    if floor is not None:
        query = query.filter(Room.floor == floor)
    if room_code:
        query = query.filter(Room.room_code.ilike(f"%{room_code.strip()}%"))

    rooms = query.all()
    result_list = []

    for r in rooms:
        sub = (
            db.query(Submission)
            .filter(Submission.room_id == r.id, Submission.week == week)
            .order_by(Submission.submitted_at.desc())
            .first()
        )

        r_status = "not_submitted"
        r_score = 0.0
        r_submitted_at = None
        r_image_url = None
        r_is_overridden = False

        if sub and sub.ai_evaluation:
            r_status = sub.ai_evaluation.final_status or sub.ai_evaluation.status
            r_score = (
                sub.ai_evaluation.final_score
                if sub.ai_evaluation.final_score is not None
                else sub.ai_evaluation.score
            )
            r_submitted_at = sub.submitted_at.isoformat()
            r_image_url = sub.image_url
            r_is_overridden = sub.is_overridden

        # Lọc theo status nếu có yêu cầu
        if status:
            status_map = {
                "clean": "Sạch",
                "slightly_messy": "Hơi bừa bộn",
                "messy": "Bừa bộn",
                "not_submitted": "Chưa nộp ảnh",
            }
            target_status = status_map.get(status.lower(), status)
            if r_status != target_status:
                continue

        result_list.append({
            "room_code": r.room_code,
            "submission_id": sub.id if sub and sub.ai_evaluation else None,
            "building": r.building,
            "floor": r.floor,
            "week": week,
            "status": r_status,
            "score": round(r_score, 1),
            "submitted_at": r_submitted_at,
            "image_url": r_image_url,
            "is_overridden": r_is_overridden,
        })

    # Phân trang
    total = len(result_list)
    start_idx = (page - 1) * limit
    paginated_rooms = result_list[start_idx : start_idx + limit]

    return {
        "success": True,
        "data": {
            "total": total,
            "page": page,
            "limit": limit,
            "rooms": paginated_rooms,
        },
        "message": "OK",
    }


@router.get("/rooms/hierarchy", summary="Lấy danh mục phân cấp Tòa -> Tầng -> Phòng")
async def get_rooms_hierarchy(
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Trả về cấu trúc cây phân cấp toàn bộ KTX phục vụ bộ lọc hàng nghìn phòng."""
    rooms = (
        db.query(Room)
        .filter(Room.is_active == True)
        .order_by(Room.building, Room.floor, Room.room_code)
        .all()
    )

    hierarchy = {}
    for r in rooms:
        b = r.building.strip().upper() if r.building else "N/A"
        f = r.floor
        if b not in hierarchy:
            hierarchy[b] = {}
        if f not in hierarchy[b]:
            hierarchy[b][f] = []
        hierarchy[b][f].append(r.room_code)

    formatted = []
    for b_name in sorted(hierarchy.keys()):
        floors = []
        for f_num in sorted(hierarchy[b_name].keys()):
            floors.append({
                "floor": f_num,
                "rooms": hierarchy[b_name][f_num],
            })
        formatted.append({
            "building": b_name,
            "floors": floors,
        })

    return {
        "success": True,
        "data": formatted,
        "message": "OK",
    }


# =============================================
# 3. CHI TIẾT 1 LƯỢT NỘP
# =============================================
@router.get("/submissions/{submission_id}", summary="Xem chi tiết 1 lượt nộp (Cán bộ KTX)")
async def get_submission_detail(
    submission_id: str,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Xem đầy đủ chi tiết ảnh chụp, checklist và kết quả AI phân tích."""
    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    if not sub:
        return JSONResponse(
            status_code=404,
            content={
                "success": False,
                "data": None,
                "message": f"Không tìm thấy lượt nộp có ID {submission_id}",
                "error_code": "NOT_FOUND",
            },
        )

    ai_eval = sub.ai_evaluation
    issues = json.loads(ai_eval.issues_detected) if (ai_eval and ai_eval.issues_detected) else []
    positives = json.loads(ai_eval.positive_notes) if (ai_eval and ai_eval.positive_notes) else []

    return {
        "success": True,
        "data": {
            "submission_id": sub.id,
            "room_code": sub.room.room_code if sub.room else "N/A",
            "week": sub.week,
            "submitted_at": sub.submitted_at.isoformat(),
            "image_url": sub.image_url,
            "image_urls": [photo.image_url for photo in sub.photos] or (
                [sub.image_url] if sub.image_url else []
            ),
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


# =============================================
# 4. DUYỆT ĐÈ KẾT QUẢ AI (HUMAN-IN-THE-LOOP)
# =============================================
@router.patch("/submissions/{submission_id}/override", summary="Cán bộ duyệt đè kết quả AI")
async def override_submission(
    submission_id: str,
    req: OverrideRequest,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Cơ chế Human-in-the-loop:
    Cán bộ có toàn quyền sửa điểm hoặc đổi trạng thái (Sạch / Hơi bừa / Bừa)
    kèm lý do ghi nhận vết kiểm toán (Audit log).
    """
    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    if not sub:
        return JSONResponse(
            status_code=404,
            content={
                "success": False,
                "data": None,
                "message": f"Không tìm thấy lượt nộp có ID {submission_id}",
                "error_code": "NOT_FOUND",
            },
        )

    ai_eval = sub.ai_evaluation
    if not ai_eval:
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "data": None,
                "message": "Lượt nộp này chưa có kết quả AI để duyệt đè.",
                "error_code": "NO_EVALUATION",
            },
        )

    # Cập nhật thông tin duyệt đè
    sub.is_overridden = True
    sub.override_note = req.override_note.strip()
    sub.overridden_by = current_admin.username
    sub.overridden_at = datetime.utcnow()

    # Cập nhật kết quả cuối cùng
    ai_eval.final_status = req.status
    ai_eval.final_score = round(req.score, 1)

    db.commit()
    db.refresh(sub)
    db.refresh(ai_eval)

    return {
        "success": True,
        "data": {
            "submission_id": sub.id,
            "final_status": ai_eval.final_status,
            "final_score": ai_eval.final_score,
            "is_overridden": True,
            "overridden_by": sub.overridden_by,
            "overridden_at": sub.overridden_at.isoformat(),
            "override_note": sub.override_note,
        },
        "message": f"Đã duyệt đè kết quả phòng thành công: {ai_eval.final_status} ({ai_eval.final_score} điểm).",
    }


# =============================================
# 5. XUẤT BÁO CÁO TUẦN (CSV / EXCEL)
# =============================================
@router.delete("/submissions", summary="Xóa toàn bộ lịch sử nộp (Admin)")
async def delete_all_submissions(
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Xóa toàn bộ dữ liệu submissions, submission_photos và ai_evaluations."""
    try:
        db.query(SubmissionPhoto).delete()
    except Exception:
        pass
    db.query(AiEvaluation).delete()
    db.query(Submission).delete()
    db.commit()
    return JSONResponse(status_code=200, content={"success": True, "message": "Đã xóa toàn bộ lịch sử nộp ảnh thành công."})


@router.get("/export", summary="Xuất báo cáo tuần (CSV)")
@router.get("/reports/export", summary="Xuất báo cáo tuần (CSV) alias")
async def export_report(
    week: Optional[str] = Query(None, description="Tuần cần xuất"),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Xuất file CSV danh sách phòng, trạng thái và điểm số tuần."""
    if not week:
        now = datetime.now()
        week = f"{now.year}-W{now.isocalendar()[1]:02d}"

    rooms = db.query(Room).filter(Room.is_active == True).all()

    output = io.StringIO()
    # Thêm BOM UTF-8 để Excel mở tiếng Việt không bị lỗi font
    output.write("\ufeff")
    writer = csv.writer(output)
    writer.writerow([
        "Mã phòng",
        "Tòa",
        "Tầng",
        "Tuần",
        "Trạng thái",
        "Điểm 5S",
        "Thời gian nộp",
        "Cán bộ duyệt đè",
        "Ghi chú của cán bộ",
    ])

    for r in rooms:
        sub = (
            db.query(Submission)
            .filter(Submission.room_id == r.id, Submission.week == week)
            .order_by(Submission.submitted_at.desc())
            .first()
        )
        if sub and sub.ai_evaluation:
            status = sub.ai_evaluation.final_status or sub.ai_evaluation.status
            score = (
                sub.ai_evaluation.final_score
                if sub.ai_evaluation.final_score is not None
                else sub.ai_evaluation.score
            )
            submitted_time = sub.submitted_at.strftime("%d/%m/%Y %H:%M")
            overridden_by = sub.overridden_by or ""
            override_note = sub.override_note or ""
        else:
            status = "Chưa nộp ảnh"
            score = ""
            submitted_time = ""
            overridden_by = ""
            override_note = ""

        writer.writerow([
            r.room_code,
            r.building,
            r.floor,
            week,
            status,
            score,
            submitted_time,
            overridden_by,
            override_note,
        ])

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=bao_cao_ktx5s_{week}.csv"
        },
    )


# =============================================
# 5. DỌN DẸP ẢNH CŨ TRÊN CLOUDINARY
# =============================================
@router.post("/cleanup-images", summary="Dọn dẹp ảnh cũ trên Cloudinary để giải phóng dung lượng")
async def cleanup_images(
    days: int = Query(30, ge=1, le=365, description="Số ngày tối đa lưu trữ (mặc định 30 ngày)"),
    max_images_per_room: int = Query(90, ge=1, le=500, description="Số ảnh tối đa giữ lại cho mỗi phòng (mặc định 90 ảnh)"),
    current_admin: User = Depends(require_admin),
):
    """Xóa các ảnh nộp cũ hơn số ngày chỉ định hoặc vượt quá giới hạn ảnh/phòng (mặc định 90 ảnh/phòng)."""
    from app.services.storage_service import cleanup_old_cloudinary_images
    result = cleanup_old_cloudinary_images(max_keep_days=days, max_images_per_room=max_images_per_room)
    return result

