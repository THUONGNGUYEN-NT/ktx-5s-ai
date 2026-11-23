import os
import io
import uuid
import logging
from pathlib import Path
from app.config import settings

logger = logging.getLogger(__name__)

# Thư mục lưu ảnh cục bộ (nếu không dùng Cloudinary hoặc mất mạng)
UPLOAD_DIR = Path("static/uploads")


async def save_image(
    image_bytes: bytes,
    room_code: str,
    filename_prefix: str = "submission"
) -> str:
    """
    Lưu trữ ảnh:
    - Nếu đã cấu hình Cloudinary trong .env thì upload lên Cloudinary.
    - Nếu chưa hoặc lỗi mạng, tự động lưu vào thư mục static/uploads trên máy chủ local.

    Returns:
        str: URL ảnh để lưu vào Database.
    """
    has_cloudinary = bool(
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
            clean_folder = f"ktx5s/{room_code.strip().replace('/', '-').replace('\\', '-')}"
            result = cloudinary.uploader.upload(
                io.BytesIO(image_bytes),
                folder=clean_folder,
                public_id=f"{filename_prefix}_{uuid.uuid4().hex[:8]}",
                resource_type="image",
                overwrite=False,
            )
            secure_url = result.get("secure_url") or result.get("url")
            if secure_url:
                logger.info("Upload Cloudinary thành công: %s", secure_url)
                return secure_url
        except Exception as e:
            logger.warning("Không thể upload lên Cloudinary (%s), tự động chuyển sang lưu cục bộ.", e)

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


def cleanup_old_cloudinary_images(max_keep_days: int = 30) -> dict:
    """
    Tự động xóa các ảnh cũ trên Cloudinary để giải phóng dung lượng bộ nhớ miễn phí (Free Tier).
    Xóa các thư mục ảnh trong 'ktx5s/' có ngày tạo vượt quá max_keep_days.
    """
    has_cloudinary = bool(
        settings.CLOUDINARY_CLOUD_NAME
        and settings.CLOUDINARY_API_KEY
        and settings.CLOUDINARY_API_SECRET
        and not settings.CLOUDINARY_CLOUD_NAME.startswith("your_")
    )

    if not has_cloudinary:
        return {"success": False, "message": "Chưa cấu hình Cloudinary trong .env"}

    try:
        import cloudinary
        import cloudinary.api
        from datetime import datetime, timezone, timedelta

        cloudinary.config(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            secure=True,
        )

        cutoff_date = datetime.now(timezone.utc) - timedelta(days=max_keep_days)
        deleted_count = 0

        # Lấy danh sách ảnh trong folder ktx5s
        res = cloudinary.api.resources(
            type="upload",
            prefix="ktx5s/",
            max_results=500,
        )

        resources = res.get("resources", [])
        public_ids_to_delete = []

        for r in resources:
            created_at_str = r.get("created_at")
            if created_at_str:
                # Format: 2026-11-19T08:11:00Z
                try:
                    c_date = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
                    if c_date < cutoff_date:
                        public_ids_to_delete.append(r["public_id"])
                except Exception:
                    pass

        if public_ids_to_delete:
            del_res = cloudinary.api.delete_resources(public_ids_to_delete)
            deleted_count = len(public_ids_to_delete)
            logger.info("Đã xóa %d ảnh cũ trên Cloudinary (quá %d ngày)", deleted_count, max_keep_days)

        return {
            "success": True,
            "deleted_count": deleted_count,
            "message": f"Đã dọn dẹp {deleted_count} ảnh cũ trên Cloudinary (lưu quá {max_keep_days} ngày).",
        }
    except Exception as e:
        logger.error("Lỗi dọn dẹp Cloudinary: %s", e)
        return {"success": False, "message": f"Lỗi Cloudinary: {str(e)}"}
