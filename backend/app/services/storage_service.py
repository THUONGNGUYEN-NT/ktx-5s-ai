import os
import io
import uuid
import logging
from pathlib import Path
from app.config import settings

logger = logging.getLogger(__name__)

# Thư mục lưu ảnh cục bộ (nếu không dùng Cloudinary hoặc mất mạng)
UPLOAD_DIR = Path("static/uploads")


def _safe_room_code(room_code: str) -> str:
    return room_code.strip().replace("/", "-").replace("\\", "-")


def _has_cloudinary() -> bool:
    return bool(
        settings.CLOUDINARY_CLOUD_NAME
        and settings.CLOUDINARY_API_KEY
        and settings.CLOUDINARY_API_SECRET
        and not settings.CLOUDINARY_CLOUD_NAME.startswith("your_")
    )


def _enforce_room_limit_local(room_folder: Path, max_images: int) -> int:
    """Giữ tối đa (max_images - 1) ảnh cũ trước khi lưu ảnh mới, để tổng số không vượt quá max_images."""
    if max_images <= 0 or not room_folder.exists():
        return 0
    files = [p for p in room_folder.iterdir() if p.is_file()]
    if len(files) < max_images:
        return 0
    files.sort(key=lambda p: p.stat().st_mtime)
    to_delete = files[: len(files) - max_images + 1]
    deleted = 0
    for old_file in to_delete:
        try:
            old_file.unlink()
            deleted += 1
        except Exception as exc:
            logger.warning("Không thể xóa ảnh cũ cục bộ %s: %s", old_file, exc)
    return deleted


def _enforce_room_limit_cloudinary(clean_folder: str, max_images: int) -> int:
    """Giữ tối đa (max_images - 1) ảnh cũ trong thư mục phòng trên Cloudinary trước khi upload ảnh mới."""
    if max_images <= 0:
        return 0
    import cloudinary.api

    resources = []
    next_cursor = None
    while True:
        kwargs = {
            "type": "upload",
            "prefix": f"{clean_folder}/",
            "max_results": 500,
        }
        if next_cursor:
            kwargs["next_cursor"] = next_cursor
        res = cloudinary.api.resources(**kwargs)
        resources.extend(res.get("resources", []))
        next_cursor = res.get("next_cursor")
        if not next_cursor:
            break

    if len(resources) < max_images:
        return 0

    resources.sort(key=lambda r: r.get("created_at", ""))
    to_delete = [r["public_id"] for r in resources[: len(resources) - max_images + 1] if r.get("public_id")]
    if not to_delete:
        return 0

    for i in range(0, len(to_delete), 100):
        cloudinary.api.delete_resources(to_delete[i : i + 100])
    logger.info("Đã xóa %d ảnh cũ trong %s để giữ giới hạn %d ảnh/phòng.", len(to_delete), clean_folder, max_images)
    return len(to_delete)


async def save_image(
    image_bytes: bytes,
    room_code: str,
    filename_prefix: str = "submission"
) -> str:
    """
    Lưu trữ ảnh theo từng phòng (mỗi phòng lưu tối đa MAX_IMAGES_PER_ROOM = 90 ảnh):
    - Nếu đã cấu hình Cloudinary trong .env thì upload lên Cloudinary (ktx5s/{room_code}/).
    - Nếu chưa hoặc lỗi mạng, tự động lưu vào thư mục static/uploads/rooms/{room_code}/ trên máy chủ local.
    - Khi số ảnh của phòng đạt ngưỡng tối đa (90 ảnh), tự động xóa ảnh cũ nhất của phòng đó.

    Returns:
        str: URL ảnh để lưu vào Database.
    """
    max_images = settings.MAX_IMAGES_PER_ROOM
    safe_code = _safe_room_code(room_code)

    has_cloudinary = _has_cloudinary()

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

            # Upload byte stream lên Cloudinary theo thư mục phòng, giữ tối đa 90 ảnh/phòng
            clean_folder = f"ktx5s/{safe_code}"
            try:
                _enforce_room_limit_cloudinary(clean_folder, max_images)
            except Exception as limit_exc:
                logger.warning("Không thể kiểm tra giới hạn %d ảnh cho phòng %s trên Cloudinary: %s", max_images, safe_code, limit_exc)

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

    # Phương án lưu cục bộ (Local Storage), giữ tối đa 90 ảnh/phòng
    room_folder = UPLOAD_DIR / "rooms" / safe_code
    room_folder.mkdir(parents=True, exist_ok=True)
    _enforce_room_limit_local(room_folder, max_images)

    file_name = f"{filename_prefix}_{uuid.uuid4().hex[:8]}.jpg"
    file_path = room_folder / file_name

    with open(file_path, "wb") as f:
        f.write(image_bytes)

    # Trả về đường dẫn truy cập qua HTTP (được mount static trong main.py)
    return f"/uploads/rooms/{safe_code}/{file_name}"


def cleanup_old_cloudinary_images(
    max_keep_days: int = 30,
    max_images_per_room: int | None = None,
) -> dict:
    """
    Tự động xóa các ảnh cũ trên Cloudinary để giải phóng dung lượng và giữ tối đa max_images_per_room (mặc định 90) ảnh/phòng.
    Xóa các ảnh trong 'ktx5s/' có ngày tạo vượt quá max_keep_days hoặc vượt quá giới hạn ảnh của từng phòng.
    """
    if max_images_per_room is None:
        max_images_per_room = settings.MAX_IMAGES_PER_ROOM

    if not _has_cloudinary():
        return {"success": False, "message": "Chưa cấu hình Cloudinary trong .env"}

    try:
        import cloudinary
        import cloudinary.api
        from datetime import datetime, timezone, timedelta
        from collections import defaultdict

        cloudinary.config(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            secure=True,
        )

        cutoff_date = datetime.now(timezone.utc) - timedelta(days=max_keep_days)
        resources = []
        next_cursor = None
        while True:
            kwargs = {
                "type": "upload",
                "prefix": "ktx5s/",
                "max_results": 500,
            }
            if next_cursor:
                kwargs["next_cursor"] = next_cursor
            res = cloudinary.api.resources(**kwargs)
            resources.extend(res.get("resources", []))
            next_cursor = res.get("next_cursor")
            if not next_cursor:
                break

        public_ids_to_delete = set()
        by_room: dict[str, list[dict]] = defaultdict(list)

        for r in resources:
            pid = r.get("public_id", "")
            created_at_str = r.get("created_at")
            is_expired = False
            if created_at_str:
                try:
                    c_date = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
                    if c_date < cutoff_date:
                        public_ids_to_delete.add(pid)
                        is_expired = True
                except Exception:
                    pass
            if not is_expired and pid:
                parts = pid.split("/")
                room_key = parts[1] if len(parts) >= 3 else "_root"
                by_room[room_key].append(r)

        if max_images_per_room > 0:
            for room_resources in by_room.values():
                if len(room_resources) > max_images_per_room:
                    room_resources.sort(key=lambda item: item.get("created_at", ""))
                    excess = len(room_resources) - max_images_per_room
                    for item in room_resources[:excess]:
                        if item.get("public_id"):
                            public_ids_to_delete.add(item["public_id"])

        delete_list = sorted(public_ids_to_delete)
        deleted_count = 0
        for i in range(0, len(delete_list), 100):
            cloudinary.api.delete_resources(delete_list[i : i + 100])
            deleted_count += len(delete_list[i : i + 100])

        if deleted_count:
            logger.info(
                "Đã xóa %d ảnh cũ trên Cloudinary (quá %d ngày hoặc vượt %d ảnh/phòng)",
                deleted_count,
                max_keep_days,
                max_images_per_room,
            )

        return {
            "success": True,
            "deleted_count": deleted_count,
            "max_images_per_room": max_images_per_room,
            "message": f"Đã dọn dẹp {deleted_count} ảnh cũ trên Cloudinary (giữ tối đa {max_images_per_room} ảnh/phòng, tối đa {max_keep_days} ngày).",
        }
    except Exception as e:
        logger.error("Lỗi dọn dẹp Cloudinary: %s", e)
        return {"success": False, "message": f"Lỗi Cloudinary: {str(e)}"}
