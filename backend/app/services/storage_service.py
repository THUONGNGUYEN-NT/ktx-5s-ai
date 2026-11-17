import os
import uuid
from pathlib import Path
from app.config import settings

# Thư mục lưu ảnh cục bộ (nếu không dùng Cloudinary)
UPLOAD_DIR = Path("static/uploads")


async def save_image(
    image_bytes: bytes,
    room_code: str,
    filename_prefix: str = "submission"
) -> str:
    """
    Lưu trữ ảnh:
    - Nếu đã cấu hình Cloudinary trong .env thì upload lên Cloudinary.
    - Nếu chưa, tự động lưu vào thư mục static/uploads trên máy chủ local.

    Returns:
        str: URL ảnh để lưu vào Database.
    """
    has_cloudinary = (
        settings.CLOUDINARY_CLOUD_NAME
        and settings.CLOUDINARY_API_KEY
        and settings.CLOUDINARY_API_SECRET
        and not settings.CLOUDINARY_CLOUD_NAME.startswith("your_")
    )

    if has_cloudinary:
        try:
            import cloudinary
            import cloudinary.uploader

            cloudinary.config(
                cloud_name=settings.CLOUDINARY_CLOUD_NAME,
                api_key=settings.CLOUDINARY_API_KEY,
                api_secret=settings.CLOUDINARY_API_SECRET,
                secure=True,
            )

            # Upload byte stream lên Cloudinary theo thư mục phòng
            result = cloudinary.uploader.upload(
                image_bytes,
                folder=f"ktx5s/{room_code}",
                public_id=f"{filename_prefix}_{uuid.uuid4().hex[:8]}",
                resource_type="image",
            )
            return result.get("secure_url", "")
        except Exception as e:
            print(f"⚠️ Không thể upload lên Cloudinary ({e}), chuyển sang lưu local.")

    # Phương án lưu cục bộ (Local Storage)
    safe_room_code = room_code.replace("/", "-").replace("\\", "-")
    room_folder = UPLOAD_DIR / "rooms" / safe_room_code
    room_folder.mkdir(parents=True, exist_ok=True)

    file_name = f"{filename_prefix}_{uuid.uuid4().hex[:8]}.jpg"
    file_path = room_folder / file_name

    with open(file_path, "wb") as f:
        f.write(image_bytes)

    # Trả về đường dẫn truy cập qua HTTP (được mount static trong main.py)
    return f"/uploads/rooms/{safe_room_code}/{file_name}"
