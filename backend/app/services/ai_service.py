import io
import time
import json
import base64
from contextlib import ExitStack
from typing import Any
from PIL import Image, ImageOps
import google.generativeai as genai
from app.config import settings

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None

# Danh sách model Gemini đã được kiểm thử 100% hoạt động với API Key
DEFAULT_MODELS = [
    "gemini-3.8-flash",
    "gemini-3.1-flash-lite",
    "gemini-3-flash-preview",
]

PROMPT_5S = """
You are a senior Computer Vision 5S Inspector and Anti-Fraud Investigator for the 5S Dormitory Cleanliness Competition at Vietnam National University Ho Chi Minh City (VNU-HCM / KTX ĐHQG-HCM).
Analyze the 4 room photos submitted by a student.

=== 1. VNU-HCM DORMITORY REAL-WORLD CONTEXT ===
Authentic VNU-HCM Dormitory rooms (Khu A & Khu B) have specific characteristics:
- Room types: 2 students (2 single beds), 4 students (2 bunk beds), 6 or 8 students (multiple bunk beds, higher furniture & item density).
- Bed structures: Standard painted steel bunk beds (blue/green/white/gray frames) or single dorm beds with wooden/slat boards (vạt giường gỗ/sắt). May have mattress, woven sleeping mat (chiếu trúc/cối), blankets, pillows, or personal foldable bed desk.
- Study desks: Independent study desks, shared long tables along walls, or desks integrated underneath upper bunk beds.
- Environment: Dormitory tiled floors (ceramic/terrazzo tiles), dorm masonry/concrete walls with dorm windows/balcony doors.

=== 2. ANTI-FRAUD & CONTEXT VERIFICATION (CRUCIAL) ===
REJECT IMMEDIATELY (Set is_valid = false for that photo, and is_valid_room_photo = false) IF:
1. STOCK / E-COMMERCE CATALOG PHOTOS (Ảnh mạng / Pinterest / Shopee):
   - Photos taken from commercial furniture websites, studio product staging (e.g. pristine white metal shoe rack staged beside a luxury upholstered bed in a commercial catalog), Pinterest aesthetic photos, or downloaded from the internet.
   - Any photo that looks like an advertising/catalog photo instead of a real student dorm photo taken with a phone camera -> REJECT as "Ảnh tải từ mạng / ảnh quảng cáo thương mại".
2. NON-DORMITORY CONTEXT (Phòng trọ cao cấp / Căn hộ dịch vụ / Khách sạn / Nhà ở gia đình):
   - Private luxury studio apartments, high-end serviced rentals (phòng trọ tư nhân cao cấp) with wall-to-wall carpeting, designer downlights, luxury hotel upholstered headboards, or residential family homes that clearly lack student dormitory infrastructure -> REJECT as "Bối cảnh phòng trọ tư nhân/căn hộ dịch vụ, không phải KTX ĐHQG-HCM".
3. DUPLICATE / RECYCLED ROOM SHOTS:
   - Reusing the same overview room shot for Bed, Floor, and Desk instead of photographing each distinct area.

=== 3. INDEPENDENT AREA VALIDATION ===
Judge ONLY what is actually visible in each photo. Do NOT hallucinate objects that do not exist:
- Photo 1 — BED AREA: Must show a dorm bed (single bed, bunk bed, bare bed board with mattress, or bed with mini foldable bed table).
  * VALID: Any student bed in the room.
  * REJECT only if: Cooking pots/food, bathroom, pure floor with no bed structure.
- Photo 2 — FLOOR & WALKWAY: Must show the floor surface and walkway between dorm beds/furniture towards door.
  * VALID: Dorm room walkway and floor.
  * REJECT only if: Blocked by curtain, extreme close-up of furniture leg, bathroom.
- Photo 3 — SHOE RACK AREA: Must show a shoe rack or shoes arranged neatly near entrance/wall.
  * VALID: Any plastic, metal, or wooden shoe rack with shoes/slippers.
  * REJECT only if: Bathroom sinks, toilet, bare floor with only electric cords and NO shoes.
- Photo 4 — STUDY DESK AREA: Must show a student study desk or table.
  * VALID: Wooden/metal study desk, shared table, desks with chairs, or desk under bunk bed.
  * REJECT only if: Re-photographing bed mattress/bed frame without a desk, windowsill, bathroom.

=== 4. ROOM CONSISTENCY GUIDELINE ===
- REAL-WORLD FACT: Different corners of the same dormitory room naturally have different lighting, different furniture, and different perspectives.
- DEFAULT TO VALID (is_same_room = true) if all 4 photos look like plausible student dormitory spaces.
- ONLY flag is_same_room = false if there is an extreme, unmistakable contradiction (e.g. one photo is a luxury hotel with carpet and crystal chandelier, while others are a student dorm, or photos from completely different buildings).
- NEVER hallucinate or invent conflicting objects that are not clearly visible in the photos.

=== 5. SCORE 5S (ONLY IF ALL PHOTOS VALID, AUTHENTIC DORM & FROM SAME ROOM) ===
Criteria:
- bed_tidy: blanket folded neatly, pillow straight, bed neat → false if messy, unmade, or items piled up
- floor_clean: no trash/dust, clear walkway → false if dirty/blocked
- shoes_arranged: shoes lined up on rack → false if scattered/no rack
- desk_organized: books/laptop tidy on desk → false if cluttered/has trash

Deductions: minor (-0.5pt) | moderate (-1.5pt) | severe (-2.5pt)

=== OUTPUT: Pure JSON only, no markdown ===
Schema:
{
  "photo_check": {
    "photo_1_bed":   {"is_valid": bool, "detected_object": "string", "issue": "string or empty"},
    "photo_2_floor": {"is_valid": bool, "detected_object": "string", "issue": "string or empty"},
    "photo_3_shoes": {"is_valid": bool, "detected_object": "string", "issue": "string or empty"},
    "photo_4_desk":  {"is_valid": bool, "detected_object": "string", "issue": "string or empty"}
  },
  "room_consistency": {
    "is_same_room": bool,
    "confidence": "high|medium|low",
    "details": "Vietnamese explanation",
    "inconsistencies": ["Vietnamese descriptions of conflicts if is_same_room is false"]
  },
  "is_valid_room_photo": bool,
  "invalid_reason": "Vietnamese explanation if invalid or fraud, else empty string",
  "checklist": {"bed_tidy": bool|null, "floor_clean": bool|null, "shoes_arranged": bool|null, "desk_organized": bool|null},
  "deductions": [{"criterion": "bed_tidy|floor_clean|shoes_arranged|desk_organized", "severity": "minor|moderate|severe", "reason": "Vietnamese reason"}],
  "positive_notes": ["Vietnamese positive observation"],
  "recommendations": "Vietnamese improvement suggestions"
}
"""

CRITERIA = {
    "bed_tidy": "Giường chiếu",
    "floor_clean": "Sàn nhà và lối đi",
    "desk_organized": "Bàn học",
    "shoes_arranged": "Giày dép",
}
DEDUCTION_POINTS = {"minor": 0.5, "moderate": 1.5, "severe": 2.5}


def apply_scoring(result: dict[str, Any]) -> None:
    # 1. Kiểm tra chi tiết từng ảnh từ photo_check
    photo_labels = {
        "photo_1_bed": "Ảnh 1 (Giường ngủ)",
        "photo_2_floor": "Ảnh 2 (Sàn nhà)",
        "photo_3_shoes": "Ảnh 3 (Kệ giày dép)",
        "photo_4_desk": "Ảnh 4 (Bàn học)",
    }
    failed_photos = []
    photo_check = result.get("photo_check")
    if isinstance(photo_check, dict):
        for key, label in photo_labels.items():
            p_info = photo_check.get(key)
            if isinstance(p_info, dict) and p_info.get("is_valid") is False:
                issue = p_info.get("issue") or p_info.get("detected_object") or "Chưa đúng góc chụp yêu cầu"
                failed_photos.append(f"• {label}: {issue}")

    # 2. Kiểm tra tính đồng nhất phòng (Anti-fraud: same room)
    room_consistency = result.get("room_consistency")
    different_rooms_reason = None
    if isinstance(room_consistency, dict) and room_consistency.get("is_same_room") is False:
        inconsistencies = room_consistency.get("inconsistencies") or []
        details = room_consistency.get("details") or ""
        if inconsistencies:
            details_str = "\n".join(f"• {inc}" for inc in inconsistencies)
        elif details:
            details_str = f"• {details}"
        else:
            details_str = "• Chi tiết giường ngủ, nền gạch hoặc nội thất không trùng khớp giữa các ảnh."
        different_rooms_reason = f"Phát hiện ảnh chụp từ nhiều phòng khác nhau (không cùng một phòng):\n{details_str}"

    # Nếu có ảnh chụp sai hoặc không cùng phòng
    if failed_photos or different_rooms_reason or result.get("is_valid_room_photo") is False:
        result["is_valid_room_photo"] = False
        result["score"] = 0.0
        result["status"] = "Không hợp lệ (Gian lận)" if different_rooms_reason else "Không hợp lệ"
        
        if different_rooms_reason:
            full_reason = different_rooms_reason
            if failed_photos:
                full_reason += "\n\nNgoài ra, các góc sau chụp chưa đúng yêu cầu:\n" + "\n".join(failed_photos)
        elif failed_photos:
            full_reason = "Vui lòng chụp lại các góc sau:\n" + "\n".join(failed_photos)
        else:
            full_reason = result.get("invalid_reason") or "Ảnh chụp không đúng quy định. Vui lòng chụp lại."

        result["invalid_reason"] = full_reason
        result["issues_detected"] = [full_reason]
        result["recommendations"] = "Vui lòng chụp đầy đủ 4 góc trong cùng một phòng KTX theo đúng hướng dẫn."
        return

    checklist = result.get("checklist")
    if not isinstance(checklist, dict):
        checklist = {"bed_tidy": True, "floor_clean": True, "shoes_arranged": True, "desk_organized": True}
        result["checklist"] = checklist

    for k in CRITERIA.keys():
        if k not in checklist or (checklist[k] is not None and type(checklist[k]) is not bool):
            checklist[k] = True

    if all(value is None for value in checklist.values()):
        result["is_valid_room_photo"] = False
        result["invalid_reason"] = "Ảnh chưa thấy rõ các khu vực phòng KTX cần chấm. Vui lòng chụp lại."
        result["recommendations"] = result["invalid_reason"]
        result["score"] = 0.0
        result["status"] = "Không hợp lệ"
        result["issues_detected"] = [result["invalid_reason"]]
        return

    deductions = result.get("deductions")
    if not isinstance(deductions, list):
        deductions = []
        result["deductions"] = deductions

    issues = []
    seen = set()
    score = 10.0
    for item in deductions:
        if not isinstance(item, dict):
            continue
        criterion = item.get("criterion")
        if criterion not in CRITERIA:
            continue
        severity = item.get("severity", "minor")
        points = DEDUCTION_POINTS.get(severity, 0.5)
        reason = str(item.get("reason", "")).strip()
        if not reason:
            reason = f"Chưa đảm bảo tiêu chuẩn {CRITERIA[criterion]}"
        if criterion not in seen:
            seen.add(criterion)
            score -= points
            display_points = f"{points:.1f}".replace(".", ",")
            issues.append(f"−{display_points} điểm · {CRITERIA[criterion]} · {reason}")

    # Nếu checklist có tiêu chí false mà chưa có deduction giải thích
    for criterion, ok in checklist.items():
        if ok is False and criterion not in seen:
            points = 1.0
            score -= points
            issues.append(f"−1,0 điểm · {CRITERIA[criterion]} · Chưa đạt tiêu chuẩn ngăn nắp")

    score = max(0.0, round(score, 1))
    result["score"] = score
    result["status"] = "Sạch" if score >= 8.0 else "Hơi bừa bộn" if score >= 5.0 else "Bừa bộn"
    result["issues_detected"] = issues


def check_duplicate_photos(images: list[Image.Image]) -> list[str]:
    """Phát hiện nếu sinh viên nộp trùng hoặc nhân bản cùng một bức ảnh cho nhiều góc."""
    labels = ["Ảnh 1 (Giường ngủ)", "Ảnh 2 (Sàn nhà)", "Ảnh 3 (Kệ giày dép)", "Ảnh 4 (Bàn học)"]
    thumbnails = []
    for img in images:
        try:
            im = img.convert("L").resize((32, 32), Image.Resampling.BOX)
            thumbnails.append(list(im.getdata()))
        except Exception:
            thumbnails.append(None)

    dup_pairs = []
    n = len(thumbnails)
    for i in range(n):
        for j in range(i + 1, n):
            t1, t2 = thumbnails[i], thumbnails[j]
            if t1 and t2:
                # Tính chênh lệch độ sáng pixel trung bình giữa 2 ảnh (0 đến 255)
                avg_diff = sum(abs(p1 - p2) for p1, p2 in zip(t1, t2)) / 1024.0
                if avg_diff < 5.0:  # Trùng lặp > 98%
                    lbl_i = labels[i] if i < len(labels) else f"Ảnh {i+1}"
                    lbl_j = labels[j] if j < len(labels) else f"Ảnh {j+1}"
                    dup_pairs.append(f"{lbl_i} và {lbl_j}")
    return dup_pairs


def evaluate_room_image(image_bytes: bytes | list[bytes]) -> dict[str, Any]:
    """
    Gửi ảnh phòng đã nén sang AI Vision (Gemini Vision hoặc NVIDIA NIM) để chấm điểm 5S.

    Returns:
        dict: Kết quả phân tích kèm trường ai_response_time_ms.
    """
    raw_images = [image_bytes] if isinstance(image_bytes, bytes) else image_bytes
    if not raw_images:
        raise ValueError("Cần ít nhất một ảnh phòng.")

    # Chuẩn hóa & tối ưu kích thước ảnh trước khi gửi sang AI
    processed_buffers = []
    processed_images = []
    for data in raw_images:
        try:
            with Image.open(io.BytesIO(data)) as img:
                img = ImageOps.exif_transpose(img)
                if img.mode != "RGB":
                    img = img.convert("RGB")
                max_side = max(img.size)
                if max_side > 384:
                    scale = 384 / max_side
                    img = img.resize((int(img.width * scale), int(img.height * scale)), Image.Resampling.LANCZOS)
                buf = io.BytesIO()
                img.save(buf, format="JPEG", quality=70, optimize=True)
                b = buf.getvalue()
                processed_buffers.append(b)
                processed_images.append(Image.open(io.BytesIO(b)))
        except Exception:
            processed_buffers.append(data)
            processed_images.append(Image.open(io.BytesIO(data)))

    start_time = time.time()

    # =========================================================================
    # BƯỚC 0: KIỂM SOÁT GIAN LẬN — NỘP TRÙNG LẶP CÙNG 1 ẢNH CHO NHIỀU KHU VỰC
    # =========================================================================
    duplicate_errors = check_duplicate_photos(processed_images)
    if duplicate_errors:
        dup_msg = ", ".join(duplicate_errors)
        reason = (
            f"Phát hiện gian lận: Bạn đã nộp cùng một bức ảnh cho nhiều khu vực ({dup_msg}). "
            "Quy định 5S KTX ĐHQG-HCM bắt buộc phải chụp riêng biệt từng khu vực: "
            "Giường ngủ, Sàn nhà, Kệ giày dép và Bàn học."
        )
        duration_ms = int((time.time() - start_time) * 1000)
        return {
            "photo_check": {
                "photo_1_bed": {"is_valid": False, "detected_object": "Ảnh bị nộp trùng lặp", "issue": "Trùng ảnh với khu vực khác"},
                "photo_2_floor": {"is_valid": False, "detected_object": "Ảnh bị nộp trùng lặp", "issue": "Trùng ảnh với khu vực khác"},
                "photo_3_shoes": {"is_valid": False, "detected_object": "Ảnh bị nộp trùng lặp", "issue": "Trùng ảnh với khu vực khác"},
                "photo_4_desk": {"is_valid": False, "detected_object": "Ảnh bị nộp trùng lặp", "issue": "Trùng ảnh với khu vực khác"},
            },
            "room_consistency": {
                "is_same_room": False,
                "confidence": "high",
                "details": f"Trùng lặp ảnh giữa {dup_msg}",
                "inconsistencies": [f"Nộp cùng một ảnh cho: {dup_msg}"]
            },
            "is_valid_room_photo": False,
            "invalid_reason": reason,
            "checklist": {"bed_tidy": None, "floor_clean": None, "shoes_arranged": None, "desk_organized": None},
            "deductions": [],
            "positive_notes": [],
            "recommendations": "Vui lòng chụp đủ 4 góc phòng riêng biệt trong phòng KTX của bạn.",
            "score": 0.0,
            "status": "Không hợp lệ (Gian lận)",
            "issues_detected": [reason],
            "ai_response_time_ms": duration_ms
        }

    # =========================================================================
    # LỰA CHỌN 1: DÙNG NVIDIA NIM (nvidia/nemotron-3.5-super-vl-120b-a12b)
    # =========================================================================
    if getattr(settings, "AI_PROVIDER", "").lower() == "nvidia" and getattr(settings, "NVIDIA_API_KEY", ""):
        if OpenAI is None:
            raise RuntimeError("Thư viện openai chưa được cài đặt trong môi trường ảo.")

        try:
            client = OpenAI(
                base_url="https://integrate.api.nvidia.com/v1",
                api_key=settings.NVIDIA_API_KEY.strip(),
            )

            content: list[dict[str, Any]] = [{"type": "text", "text": PROMPT_5S}]
            labels = ["Ảnh 1 (Giường ngủ)", "Ảnh 2 (Sàn nhà & Lối đi)", "Ảnh 3 (Kệ giày dép)", "Ảnh 4 (Bàn học)"]
            for idx, buf_data in enumerate(processed_buffers):
                lbl = labels[idx] if idx < len(labels) else f"Ảnh số {idx + 1}"
                b64 = base64.b64encode(buf_data).decode("utf-8")
                content.append({"type": "text", "text": f"\n\n---\n{lbl}:"})
                content.append({
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{b64}"},
                })

            response = client.chat.completions.create(
                model="nvidia/nemotron-3.5-super-vl-120b-a12b",
                messages=[{"role": "user", "content": content}],
                temperature=0.1,
                max_tokens=1024,
                extra_body={"chat_template_kwargs": {"thinking": False}},
            )
            duration_ms = int((time.time() - start_time) * 1000)

            msg = response.choices[0].message
            raw_text = getattr(msg, "content", None) or ""
            raw_text = raw_text.strip()

            # Trích xuất JSON thuần
            if "```" in raw_text:
                import re
                match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", raw_text)
                if match:
                    raw_text = match.group(1).strip()
            
            if "{" in raw_text and "}" in raw_text:
                raw_text = raw_text[raw_text.find("{"):raw_text.rfind("}") + 1]

            if not raw_text:
                raise ValueError("NVIDIA model trả về nội dung rỗng")

            result = json.loads(raw_text)
            apply_scoring(result)
            result["ai_response_time_ms"] = duration_ms
            return result
        except Exception as e:
            import traceback
            print(f"[WARN] Lỗi khi gọi NVIDIA NIM ({e}), chi tiết:\n{traceback.format_exc()}")
            print("[INFO] Đang chuyển sang Gemini dự phòng...")

    # =========================================================================
    # LỰA CHỌN 2: DÙNG GOOGLE GEMINI VISION
    # =========================================================================
    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY chưa được thiết lập trong file .env")

    genai.configure(api_key=settings.GEMINI_API_KEY)
    last_error = None

    generation_config = {
        "response_mime_type": "application/json",
        "temperature": 0,
        "max_output_tokens": 700,
    }

    # Thử gọi model nhanh nhất có sẵn
    for model_name in DEFAULT_MODELS:
        try:
            model = genai.GenerativeModel(
                model_name=model_name,
                generation_config=generation_config,
            )
            content = [PROMPT_5S]
            labels = ["Ảnh 1 (Giường ngủ)", "Ảnh 2 (Sàn nhà & Lối đi)", "Ảnh 3 (Kệ giày dép)", "Ảnh 4 (Bàn học)"]
            for idx, img in enumerate(processed_images):
                lbl = labels[idx] if idx < len(labels) else f"Ảnh số {idx + 1}"
                content.extend([lbl, img])

            response = model.generate_content(content)
            duration_ms = int((time.time() - start_time) * 1000)

            # Parse JSON
            raw_text = response.text.strip()
            if raw_text.startswith("```"):
                lines = raw_text.splitlines()
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].startswith("```"):
                    lines = lines[:-1]
                raw_text = "\n".join(lines).strip()

            result = json.loads(raw_text)
            apply_scoring(result)
            result["ai_response_time_ms"] = duration_ms
            return result

        except Exception as e:
            last_error = e
            continue

    raise RuntimeError(f"Lỗi khi gọi Gemini Vision API: {last_error}")
