from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.services.auth_service import get_current_user, require_room_access

router = APIRouter()


@router.get("/rooms/{room_code}", summary="Xem thông tin 1 phòng")
async def get_room(
    room_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    room = require_room_access(current_user, room_code, db)
    if not room:
        return {
            "success": False,
            "data": None,
            "message": f"Không tìm thấy phòng {room_code}",
            "error_code": "ROOM_NOT_FOUND",
        }
    return {
        "success": True,
        "data": {
            "id": room.id,
            "room_code": room.room_code,
            "building": room.building,
            "floor": room.floor,
            "room_number": room.room_number,
            "capacity": room.capacity,
            "qr_code_url": room.qr_code_url,
        },
        "message": "OK",
    }
