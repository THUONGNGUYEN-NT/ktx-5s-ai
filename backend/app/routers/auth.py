from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.services.auth_service import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)

router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str
    full_name: str
    role: Optional[str] = "admin"  # "admin" | "student"


@router.post("/login", summary="Đăng nhập hệ thống (Cán bộ / Quản trị viên)")
async def login(req: LoginRequest, db: Session = Depends(get_db)):
    """
    API Đăng nhập:
    - Trả về JWT Access Token để Cán bộ KTX gọi các API trong /api/admin/*
    - Tự động khởi tạo tài khoản admin mặc định (admin / admin123) nếu DB chưa có tài khoản nào.
    """
    username = req.username.strip()
    password = req.password

    # Kiểm tra xem DB đã có user nào chưa, nếu chưa có thì tự động tạo tài khoản admin mặc định
    user_count = db.query(User).count()
    if user_count == 0:
        default_admin = User(
            username="admin",
            password_hash=hash_password("admin123"),
            full_name="Cán bộ Quản lý KTX",
            role="admin",
        )
        db.add(default_admin)
        db.commit()
        db.refresh(default_admin)

    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(password, user.password_hash):
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={
                "success": False,
                "data": None,
                "message": "Tên đăng nhập hoặc mật khẩu không chính xác.",
                "error_code": "UNAUTHORIZED",
            },
        )

    if not user.is_active:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={
                "success": False,
                "data": None,
                "message": "Tài khoản của bạn đã bị vô hiệu hóa.",
                "error_code": "ACCOUNT_DISABLED",
            },
        )

    # Sinh JWT Token
    token_payload = {
        "sub": user.username,
        "role": user.role,
        "name": user.full_name,
        "user_id": user.id,
    }
    access_token = create_access_token(token_payload)

    return {
        "success": True,
        "data": {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "username": user.username,
                "full_name": user.full_name,
                "role": user.role,
            },
        },
        "message": f"Đăng nhập thành công! Chào mừng {user.full_name}.",
    }


@router.post("/register", summary="Tạo mới tài khoản (Admin)")
async def register(
    req: RegisterRequest,
    current_admin: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Chỉ Cán bộ KTX (Admin) mới có quyền tạo thêm tài khoản mới."""
    if current_admin.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ có quyền Admin mới được tạo tài khoản.",
        )

    existing = db.query(User).filter(User.username == req.username.strip()).first()
    if existing:
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "data": None,
                "message": f"Tên đăng nhập '{req.username}' đã tồn tại.",
                "error_code": "USERNAME_EXISTS",
            },
        )

    new_user = User(
        username=req.username.strip(),
        password_hash=hash_password(req.password),
        full_name=req.full_name.strip(),
        role=req.role or "admin",
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "success": True,
        "data": {
            "id": new_user.id,
            "username": new_user.username,
            "full_name": new_user.full_name,
            "role": new_user.role,
        },
        "message": "Tạo tài khoản thành công.",
    }


@router.get("/me", summary="Lấy thông tin tài khoản đang đăng nhập")
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "success": True,
        "data": {
            "id": current_user.id,
            "username": current_user.username,
            "full_name": current_user.full_name,
            "role": current_user.role,
        },
        "message": "OK",
    }
