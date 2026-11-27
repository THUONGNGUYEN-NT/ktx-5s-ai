import io
import random
import statistics
from typing import Any
from PIL import Image, ImageOps, ImageFilter

MIN_LONG_SIDE = 1280
MIN_SHORT_SIDE = 720
MIN_BRIGHTNESS = 45.0
MAX_BRIGHTNESS = 238.0
MIN_BLUR_SCORE = 6.5
MAX_HASH_DISTANCE_DUPLICATE = 6

CHALLENGE_PROMPTS = [
    "Chụp góc cửa ra vào nhìn vào trong phòng.",
    "Chụp từ cuối phòng nhìn hướng ra cửa chính.",
    "Chụp khu vực gầm bàn học.",
    "Chụp khu vực gầm giường tầng đầu tiên.",
    "Chụp khu vực cửa sổ (hoặc ban công) của phòng.",
    "Chụp dãy tủ đồ cá nhân trong phòng.",
    "Chụp khu vực móc treo quần áo / mũ bảo hiểm.",
    "Chụp góc đặt thùng rác và chổi quét phòng.",
    "Chụp toàn cảnh lối đi chính giữa phòng.",
    "Chụp khu vực bình nước / kệ đồ dùng chung của phòng.",
]

COMMON_SLOTS = [
    {
        "slot_code": "C02_FLOOR",
        "slot_group": "common",
        "slot_label": "Sàn nhà và lối đi",
        "angle_hint": "Chụp chếch xuống 30–45°, thấy rõ mặt sàn và các lối di chuyển trong phòng.",
        "checklist_key": "floor_clean",
    },
    {
        "slot_code": "C03_DESK",
        "slot_group": "common",
        "slot_label": "Bàn học và khu vực học tập",
        "angle_hint": "Chụp chính diện hoặc chếch 30°, thấy rõ mặt bàn, sách vở và vật dụng.",
        "checklist_key": "desk_organized",
    },
    {
        "slot_code": "C04_SHOES",
        "slot_group": "common",
        "slot_label": "Kệ giày dép và khu vực để đồ",
        "angle_hint": "Chụp chính diện kệ giày dép và khu vực treo móc đồ cá nhân xung quanh.",
        "checklist_key": "shoes_arranged",
    },
]


def normalize_bed_count(raw_count: int | None) -> int:
    """Chuẩn hóa số vị trí ngủ P (hỗ trợ phòng 2, 4, 6, 8 người hoặc tùy chỉnh 1..12)."""
    if not raw_count or raw_count < 1:
        return 4
    return min(12, max(1, int(raw_count)))


def build_capture_slots(bed_count: int, challenge_prompt: str | None = None) -> list[dict[str, Any]]:
    """Tạo danh sách góc chụp bắt buộc: mỗi giường tầng (trên & dưới) là 1 ảnh + 4 khu vực chung."""
    p = normalize_bed_count(bed_count)
    bunk_count = max(1, (p + 1) // 2)
    slots: list[dict[str, Any]] = []

    for idx in range(1, bunk_count + 1):
        slot_code = f"B{idx:02d}"
        slot_label = f"{slot_code} · Giường tầng {idx} (Tầng trên & dưới)"
        angle_hint = (
            f"Chụp chính diện hoặc chếch 30–45° giường tầng {idx}, "
            "thấy rõ cả tầng trên và tầng dưới trong cùng 1 ảnh."
        )

        slots.append({
            "slot_code": slot_code,
            "slot_group": "bed",
            "slot_label": slot_label,
            "angle_hint": angle_hint,
            "checklist_key": "bed_tidy",
            "required": True,
        })

    for item in COMMON_SLOTS:
        slots.append({**item, "required": True})

    return slots


def pick_random_challenge() -> str:
    return random.choice(CHALLENGE_PROMPTS)


def compute_dhash(img: Image.Image) -> str:
    """Tính dHash 64-bit (16 hex chars) để phát hiện ảnh trùng lặp hoặc chụp lại ảnh cũ."""
    gray = img.convert("L").resize((9, 8), Image.Resampling.LANCZOS)
    pixels = list(gray.getdata())
    bits = 0
    for row in range(8):
        offset = row * 9
        for col in range(8):
            bits = (bits << 1) | (1 if pixels[offset + col] > pixels[offset + col + 1] else 0)
    return f"{bits:016x}"


def hamming_distance_hex(h1: str | None, h2: str | None) -> int:
    if not h1 or not h2 or len(h1) != len(h2):
        return 64
    try:
        return (int(h1, 16) ^ int(h2, 16)).bit_count()
    except ValueError:
        return 64


def inspect_photo_quality(raw_bytes: bytes, enforce_hd: bool = True) -> dict[str, Any]:
    """
    Lớp 6: Kiểm tra chất lượng kỹ thuật của ảnh trước khi đưa vào AI:
    - Độ phân giải tối thiểu 1280 x 720 (chấp nhận cả dọc 720 x 1280)
    - Ánh sáng (không quá tối hoặc cháy sáng)
    - Độ nét (không rung/nhòe)
    """
    with Image.open(io.BytesIO(raw_bytes)) as img:
        img = ImageOps.exif_transpose(img)
        width, height = img.size
        long_side = max(width, height)
        short_side = min(width, height)

        gray = img.convert("L")
        sample = gray.resize((256, 256), Image.Resampling.BILINEAR)
        pixels = list(sample.getdata())
        brightness = round(sum(pixels) / len(pixels), 1)

        edges = sample.filter(ImageFilter.FIND_EDGES)
        edge_pixels = list(edges.getdata())
        blur_score = round(statistics.pstdev(edge_pixels), 2)
        image_hash = compute_dhash(img)

    issues: list[str] = []
    status = "passed"

    if enforce_hd and (long_side < MIN_LONG_SIDE or short_side < MIN_SHORT_SIDE):
        issues.append(
            f"Độ phân giải ảnh ({width}×{height}) chưa đạt mức tối thiểu 1280×720 px."
        )
        status = "needs_retake"

    if brightness < MIN_BRIGHTNESS:
        issues.append("Ảnh quá tối, không đủ ánh sáng để quan sát vật thể. Vui lòng bật đèn và chụp lại.")
        status = "needs_retake"
    elif brightness > MAX_BRIGHTNESS:
        issues.append("Ảnh bị chói hoặc ngược sáng mạnh. Vui lòng điều chỉnh góc chụp.")
        status = "needs_retake"

    if blur_score < MIN_BLUR_SCORE:
        issues.append("Ảnh bị mờ hoặc rung tay, không rõ chi tiết. Vui lòng giữ chắc máy và chụp lại.")
        status = "needs_retake"

    return {
        "width": width,
        "height": height,
        "brightness": brightness,
        "blur_score": blur_score,
        "image_hash": image_hash,
        "validation_status": status,
        "issues": issues,
    }
