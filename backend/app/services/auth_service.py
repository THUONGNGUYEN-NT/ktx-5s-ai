import os
import hmac
import hashlib
import base64
import json
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db
from app.models import User

# Sử dụng SECRET_KEY từ config hoặc tạo một key mặc định an toàn
JWT_SECRET = settings.SECRET_KEY or "ktx5s_super_secret_jwt_key_2026_xyz"
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # Token có hiệu lực 7 ngày

security = HTTPBearer(auto_error=False)


# =============================================
# 1. HASH & VERIFY PASSWORD (PBKDF2-HMAC-SHA256)
# =============================================
def hash_password(password: str) -> str:
    """Mã hóa mật khẩu bằng thuật toán PBKDF2 với salt ngẫu nhiên."""
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        iterations=100_000,
    )
    return f"{salt}:{key.hex()}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Kiểm tra mật khẩu nhập vào khớp với chuỗi đã hash."""
    try:
        salt, key_hex = hashed_password.split(":")
        new_key = hashlib.pbkdf2_hmac(
            "sha256",
            plain_password.encode("utf-8"),
            salt.encode("utf-8"),
            iterations=100_000,
        )
        return hmac.compare_digest(new_key.hex(), key_hex)
    except Exception:
        return False


# =============================================
# 2. JWT TOKEN GENERATION & VERIFICATION
# =============================================
def _base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")


def _base64url_decode(data: str) -> bytes:
    padding = "=" * (4 - (len(data) % 4))
    return base64.urlsafe_b64decode(data + padding)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Tạo JWT access token chuẩn HS256."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": int(expire.timestamp())})

    header = {"alg": JWT_ALGORITHM, "typ": "JWT"}
    header_bytes = json.dumps(header, separators=(",", ":")).encode("utf-8")
    payload_bytes = json.dumps(to_encode, separators=(",", ":")).encode("utf-8")

    unsigned_token = f"{_base64url_encode(header_bytes)}.{_base64url_encode(payload_bytes)}"
    signature = hmac.new(
        JWT_SECRET.encode("utf-8"),
        unsigned_token.encode("utf-8"),
        hashlib.sha256,
    ).digest()

    return f"{unsigned_token}.{_base64url_encode(signature)}"


def decode_access_token(token: str) -> dict:
    """Giải mã và xác thực chữ ký của JWT token."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            raise ValueError("Token không hợp lệ (sai số lượng phần)")

        header_b64, payload_b64, sig_b64 = parts
        expected_sig = hmac.new(
            JWT_SECRET.encode("utf-8"),
            f"{header_b64}.{payload_b64}".encode("utf-8"),
            hashlib.sha256,
        ).digest()

        if not hmac.compare_digest(_base64url_decode(sig_b64), expected_sig):
            raise ValueError("Chữ ký token không chính xác")

        payload = json.loads(_base64url_decode(payload_b64).decode("utf-8"))

        # Kiểm tra hạn dùng
        exp = payload.get("exp")
        if exp and datetime.now(timezone.utc).timestamp() > exp:
            raise ValueError("Token đã hết hạn sử dụng")

        return payload
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token không hợp lệ hoặc đã hết hạn: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


# =============================================
# 3. FASTAPI DEPENDENCY — BẢO VỆ PHÂN QUYỀN RBAC
# =============================================
async def get_current_user(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """Lấy thông tin user hiện tại từ Bearer token."""
    if not auth or not auth.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Yêu cầu đăng nhập để truy cập tính năng này.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(auth.credentials)
    username = payload.get("sub")
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token không chứa thông tin người dùng.",
        )

    user = db.query(User).filter(User.username == username, User.is_active == True).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Người dùng không tồn tại hoặc đã bị khóa.",
        )
    return user


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Bắt buộc người dùng phải có quyền Admin (Cán bộ KTX)."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền Cán bộ KTX để thực hiện hành động này.",
        )
    return current_user
