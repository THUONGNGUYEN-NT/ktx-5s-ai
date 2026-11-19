import io
from PIL import Image, ImageOps


def process_and_compress_image(
    image_bytes: bytes,
    max_dimension: int = 768,
    quality: int = 75,
) -> tuple[bytes, int]:
    """
    Xử lý & nén ảnh:
    1. Tự động xoay ảnh đúng chiều theo metadata EXIF của camera điện thoại.
    2. Chuyển đổi định dạng về RGB (nếu là RGBA, P,...).
    3. Thu nhỏ (resize) ảnh sao cho chiều dài nhất tối đa max_dimension (mặc định 1024px).
    4. Nén lưu dạng JPEG chất lượng tối ưu (quality=80) để dung lượng < 500KB.

    Returns:
        tuple[bytes, int]: (Dữ liệu byte ảnh đã nén, Dung lượng ảnh tính theo KB)
    """
    with Image.open(io.BytesIO(image_bytes)) as img:
        # 1. Sửa góc xoay EXIF (rất quan trọng cho ảnh chụp từ camera điện thoại)
        img = ImageOps.exif_transpose(img)

        # 2. Đổi hệ màu sang RGB nếu cần
        if img.mode in ("RGBA", "P", "LA"):
            img = img.convert("RGB")

        # 3. Resize nếu kích thước vượt quá max_dimension
        orig_width, orig_height = img.size
        max_side = max(orig_width, orig_height)

        if max_side > max_dimension:
            scale = max_dimension / max_side
            new_width = int(orig_width * scale)
            new_height = int(orig_height * scale)
            img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

        # 4. Xuất ảnh ra buffer JPEG
        output_buffer = io.BytesIO()
        img.save(output_buffer, format="JPEG", quality=quality, optimize=True)
        compressed_bytes = output_buffer.getvalue()
        size_kb = len(compressed_bytes) // 1024

        return compressed_bytes, size_kb
