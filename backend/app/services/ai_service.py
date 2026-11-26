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
- Standard rooms (4 or 6 students): Standard painted steel bunk beds (khung sắt giường tầng màu xanh, xám, trắng) with wooden/metal slat boards. Shoes rack is placed separately near entrance/wall.
- Service rooms (phòng dịch vụ 4 sinh viên): May have wall-mounted air conditioner (máy lạnh), window curtains, and 4 single metal dorm beds or bunk beds.
- Private rental rooms (phòng trọ tư nhân cao cấp, phòng chung cư mini, studio gia đình có giường gỗ đôi, đèn trang trí phòng ngủ tư nhân) are NOT authentic VNU-HCM dormitories -> REJECT.

=== 2. ANTI-FRAUD & CONTEXT VERIFICATION (CRUCIAL) ===
IMPORTANT: You MUST inspect ALL 4 photos independently and completely. NEVER stop after finding the first invalid photo!
If multiple photos fail (e.g. Photo 1 AND Photo 2 AND Photo 3 are invalid), you MUST set `is_valid = false` and write a clear Vietnamese `issue` for EVERY single invalid photo in `photo_check`, and set `is_valid_room_photo = false`.

Mark a photo `is_valid = false` (and `is_valid_room_photo = false`) IF:
1. DUPLICATE / RECYCLED PHOTOS:
   - Submitting the same photo for more than one area (e.g. Photo 1 Bed and Photo 4 Desk are the same image) -> mark the duplicated photos `is_valid = false` with issue "Nộp trùng ảnh giữa các góc chụp".
2. SPLICED PHOTOS FROM DIFFERENT ROOMS (Ghép từ nhiều phòng khác nhau / Không cùng một không gian):
   - If photos have different bed types, different flooring tiles, or wall colors clearly belonging to different rooms/apartments -> SET `is_same_room = false` and list ALL conflicting details in `inconsistencies`.
3. NON-DORMITORY CONTEXT (Phòng trọ tư nhân ngoài KTX / Căn hộ mini gia đình):
   - Any photo showing a private rented room / mini apartment / family bedroom (wooden double bed, decorative lighting, home studio, non-dorm furniture) MUST have `is_valid = false` with issue "Bối cảnh phòng trọ tư nhân, không phải KTX ĐHQG-HCM". Check this for EACH of the 4 photos individually!
4. STOCK / CATALOG PHOTOS (Ảnh mạng / Shopee / Pinterest) or BLURRY / TOO DARK:
   - Any photo that is a stock/catalog product photo, too dark, or blurry MUST have `is_valid = false` with a specific Vietnamese `issue`.

=== 3. INDEPENDENT AREA VALIDATION ===
Judge EVERY photo (1, 2, 3, and 4) independently against BOTH its required area AND the VNU-HCM dormitory context:
- Photo 1 — BED AREA: Must show a student dorm bed (steel bunk bed, dorm single bed). If it shows a domestic wooden bed, private studio room, or wrong area -> set `photo_1_bed.is_valid = false`.
- Photo 2 — FLOOR & WALKWAY: Must show the dorm floor and walkway between beds. If it shows a private room/apartment floor, wrong area, or is too blurry/dark -> set `photo_2_floor.is_valid = false`.
- Photo 3 — SHOE RACK AREA: Must show a dorm shoe rack or shoes placed near the entrance/wall. If it is a Shopee/catalog product photo, private apartment, or wrong area -> set `photo_3_shoes.is_valid = false`.
- Photo 4 — STUDY DESK AREA: Must show a student study desk in a dorm room. Must NOT be a duplicate of Photo 1. If it shows a private room or wrong area -> set `photo_4_desk.is_valid = false`.

=== 4. ROOM CONSISTENCY GUIDELINE ===
- All 4 photos MUST belong to the SAME dormitory room.
- If photos show different rooms (e.g. different beds, different floor tiles, different wall colors) -> set `is_same_room = false` and list ALL inconsistencies clearly in `inconsistencies`.
- In `invalid_reason`, summarize ALL invalid photos and room inconsistencies together (do NOT mention only one photo if multiple are invalid).

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


def apply_scoring(result: dict[str, Any], duplicate_errors: list[str] | None = None) -> None:
    # 1. Kiểm tra chi tiết từng ảnh từ photo_check
    photo_labels = {
        "photo_1_bed": "Ảnh 1 (Giường ngủ)",
        "photo_2_floor": "Ảnh 2 (Sàn nhà)",
        "photo_3_shoes": "Ảnh 3 (Kệ giày dép)",
        "photo_4_desk": "Ảnh 4 (Bàn học)",
    }
    failed_photos = []
    if duplicate_errors:
        failed_photos.append(f"• Nộp trùng ảnh giữa các góc: {', '.join(duplicate_errors)}")
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
                full_reason += "\n\nCác ảnh không hợp lệ cần chụp lại:\n" + "\n".join(failed_photos)
        elif failed_photos:
            full_reason = f"Phát hiện {len(failed_photos)} ảnh chưa hợp lệ, vui lòng chụp lại:\n" + "\n".join(failed_photos)
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
                if avg_diff < 12.0:  # Trùng lặp > 95% (kể cả khi nén JPEG lại)
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
    # Không return sớm để AI vẫn kiểm tra hết các ảnh còn lại và liệt kê đủ tất cả lỗi.
    # =========================================================================
    duplicate_errors = check_duplicate_photos(processed_images)

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
                max_tokens=1400,
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
            apply_scoring(result, duplicate_errors=duplicate_errors)
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
        "max_output_tokens": 1400,
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
            apply_scoring(result, duplicate_errors=duplicate_errors)
            result["ai_response_time_ms"] = duration_ms
            return result

        except Exception as e:
            last_error = e
            continue

    raise RuntimeError(f"Lỗi khi gọi Gemini Vision API: {last_error}")


def build_session_prompt(slot_items: list[dict[str, Any]], room_code: str, bed_count: int) -> str:
    """Tạo prompt AI động theo từng giường tầng (trên & dưới) + 3 khu vực chung và 4 nhóm lỗi L1–L4."""
    bunk_count = max(1, (bed_count + 1) // 2)
    slot_lines = []
    for idx, item in enumerate(slot_items, start=1):
        slot_lines.append(
            f"- Image {idx} [{item['slot_code']}] ({item['slot_group']}): {item['slot_label']}"
        )
    slots_desc = "\n".join(slot_lines)

    return f"""
You are a senior Computer Vision 5S Inspector and Anti-Fraud Investigator for VNU-HCM Dormitory (KTX ĐHQG-HCM).
Room: {room_code} | Declared room capacity: {bed_count} students ({bunk_count} bunk bed unit(s), 2 tiers per bunk) | Common areas: 3 (+ optional random challenge).

Submitted photos in this capture session:
{slots_desc}

=== 0. ROOM CAPACITY & BUNK BED COUNT VERIFICATION (CRUCIAL) ===
You MUST visually count the ACTUAL number of bunk beds (giường tầng) in EVERY photo, especially wide-angle photos (C02_FLOOR, CH01, B01..B{bunk_count:02d}):
- Count along BOTH walls AND along the DEPTH (foreground + background)! In VNU-HCM dormitories, bunk beds are often placed END-TO-END or in an L-SHAPE on the SAME wall.
- CRITICAL: Two bunk beds placed end-to-end or in an L-shape on the SAME wall MUST be counted as **2 bunk beds**, NEVER 1! Count separate bunk beds by checking:
  (1) Separate upper-bunk safety rails / guardrails (2 thanh chắn tầng trên riêng biệt = 2 giường tầng),
  (2) Separate upper shelves/headboards or double vertical steel posts where two frames meet,
  (3) A desk/cabinet placed between two bed frames, or 2 separate sleeping boards/mattresses on the lower tier (count distinct sleeping bays: 2 upper sleeping bays + 2 lower sleeping bays = 2 bunk beds, NEVER 1!).
  * Example: 2 bunk beds end-to-end on the same wall (even with a desk between them) = 2 bunk beds (4-person room, INVALID for a 2-person room!).
  * Example: 2 bunk beds end-to-end on the left wall + 1 bunk bed on the right wall = 3 bunk beds total (6-person room!).
  * Example: 2 bunk beds end-to-end on the left wall + 2 bunk beds end-to-end on the right wall = 4 bunk beds total (8-person room!).
- For each photo in `per_image_bunk_counts`, count `left_bunk_beds` and `right_bunk_beds` separately, then sum them into `visible_bunk_beds`.
- 2-person room (`declared_bunk_units = 1`): ONLY 1 bunk bed in the entire room. If ANY photo shows 2 or more bunk beds -> MISMATCH!
- 4-person room (`declared_bunk_units = 2`): max 2 bunk beds. If ANY photo shows 3 or 4 bunk beds -> MISMATCH!
- 6-person room (`declared_bunk_units = 3`): max 3 bunk beds. If ANY photo shows 4 bunk beds -> MISMATCH!
- 8-person room (`declared_bunk_units = 4`): max 4 bunk beds.
Record the exact count for every photo in `room_capacity_check.per_image_bunk_counts`. If `max_visible_bunk_units > {bunk_count}`, set `matches_declared_room = false`, mark the violating slot(s) in `slot_checks` as `suspected_fraud`, and explain clearly in Vietnamese.

=== 1. REALISTIC DORMITORY ROOM CONSISTENCY GUIDELINES ===
Photos are taken in a shared student dorm room (2, 4, 6, or 8 students) where different students naturally use DIFFERENT bedding (drap/chiếu trúc/chăn nệm cá nhân khác màu nhau giữa các giường), và các góc chụp ở các thời điểm hoặc vị trí khác nhau trong phòng.
- ACCEPT normal real-life student dorm room variations:
  * Mỗi giường của từng sinh viên có thể dùng chiếu trúc, nệm hoặc chăn gối màu sắc khác nhau -> ĐÂY LÀ ĐIỀU BÌNH THƯỜNG TRONG KTX, KHÔNG ĐƯỢC COI LÀ GIAN LẬN!
  * Ánh sáng các góc chụp (gần cửa sổ vs trong góc) có thể chênh lệch sáng/tối -> HỢP LỆ.
  * Góc chụp rộng có thể nhìn thấy giường khác hoặc bàn học ở hậu cảnh -> HỢP LỆ.
- ONLY flag `suspected_fraud` IF EXTREMELY OBVIOUS:
  * Ảnh phòng trọ chung cư cao cấp bên ngoài với giường đôi gỗ gia đình sang trọng (không phải KTX).
  * Ảnh tải từ mạng / Shopee / catalog sản phẩm.
  * Hoặc cố tình nộp cùng một ảnh cho 2 khu vực khác nhau.

=== 1B. CROSS-PHOTO BEDDING & CONTEXT CONSISTENCY (CRUCIAL) ===
Compare the beds in `B01..B{bunk_count:02d}` against the beds visible in wide-angle context photos (`C02_FLOOR`, `CH01`):
- Inspect the EXACT colors and patterns of **bed sheets (ga trải giường), blankets (chăn), pillows (gối), bed frame color, and bedside items (fan, lamp, plushies)** in `B01..B{bunk_count:02d}`.
- Verify that these SAME bed sheets/blankets/pillows and frame colors actually appear in the wide-angle context photos (`C02_FLOOR`, `CH01`).
- Compare `CH01` (if present) directly against `C02_FLOOR` and `B01..B{bunk_count:02d}`! Check:
  (1) **Bed architecture**: traditional metal bunk beds vs integrated loft/bunk beds with built-in desks/drawers.
  (2) **Wall color, doorway layout, curtains, AC, water jugs, plastic shelves, and bedding colors/mattresses**.
  (3) If `CH01` shows a DIFFERENT room layout, different bed design, or different bedding/wall colors compared to `B01..` / `C02_FLOOR` -> set `challenge_consistency.ch01_matches_beds_and_floor = false`, `room_consistency.is_same_room = false`, list all differences in `challenge_consistency.ch01_differences`, and mark `CH01` as `suspected_fraud` in `slot_checks`!

=== 2. TARGET AREA & ANGLE REQUIREMENTS (REASONABLE) ===
Ensure photos capture the intended target area without overly pedantic angle rejections:
- Sleeping positions (B01..B{bunk_count:02d}): Shows student bunk bed or dorm bed area (gọn gàng, ngăn nắp, chăn gối xếp ngay ngắn).
- C02_FLOOR (Sàn nhà và lối đi):
  * Must clearly show the dormitory floor AND main walkway area (the floor/walkway must occupy a substantial, clearly observable portion of the frame — at least ~25% of the image — so trash, dust, and obstacles can be inspected).
  * If the photo is aimed horizontally at beds/desks/walls and the floor/walkway is barely visible in a tiny corner (<15% of frame), it is NOT enough to grade floor cleanliness -> mark `insufficient_evidence` with Vietnamese issue: "Vùng hiển thị sàn nhà và lối đi quá ít, chưa đủ điều kiện đánh giá. Vui lòng chụp chếch xuống thấy rõ mặt sàn và lối đi."
- C03_DESK (Bàn học và kệ): Shows the study desk surface and area.
- C04_SHOES (Kệ giày dép và móc treo): Shows the shoe rack or footwear neatly arranged.
- CH01 (Góc chụp thử thách nếu có): Wide-angle or context view of the room.

=== 3. BALANCED CLASSIFICATION & 5S SCORING ===
- "passed": The photo shows the required area and satisfies 5S cleanliness guidelines.
- "needs_retake": Only for unusable photos (completely blurry, completely dark, or completely missing the target subject).
- If a photo has some minor clutter (e.g. books unstacked, 1-2 pairs of shoes askew), do NOT reject the photo! Instead mark as "passed" and make a minor deduction (-0.5pt to -1.0pt) according to 5S criteria.



=== 3. AGGREGATED 5S SCORING (L1 - L4) ===
DO NOT score each photo in isolation. Aggregate across the whole room:
- L1 (bed_tidy - Giường): Evaluate ALL beds B01..B{max(1, (bed_count + 1) // 2):02d} together. If ANY bed is messy or used as storage -> L1 fails.
- L2 (floor_clean - Sàn nhà và lối đi): Evaluate C02_FLOOR.
- L3 (desk_organized - Bàn học và kệ): Evaluate C03_DESK.
- L4 (shoes_arranged - Đồ đạc và treo móc): Evaluate C04_SHOES + hanging items/clutter.
Deductions per group: minor (-0.5pt) | moderate (-1.5pt) | severe (-2.5pt).

=== OUTPUT: Pure JSON only, no markdown ===
{{
  "slot_checks": [
    {{
      "slot_code": "string",
      "status": "passed|needs_retake|insufficient_evidence|anomalous|suspected_fraud",
      "detected_object": "short Vietnamese description",
      "issue": "Vietnamese reason if not passed, else empty string"
    }}
  ],
  "bed_details": [
    {{
      "slot_code": "B01",
      "is_tidy": true,
      "note": "Vietnamese observation"
    }}
  ],
  "room_consistency": {{
    "is_same_room": true,
    "is_authentic_dorm": true,
    "bedding_matches_context": true,
    "confidence": "high|medium|low",
    "bedding_mismatches": ["Vietnamese description if bed sheets/blankets/pillows do not match context photos"],
    "inconsistencies": ["Vietnamese description if any"]
  }},
  "challenge_consistency": {{
    "ch01_matches_beds_and_floor": true,
    "ch01_differences": ["Vietnamese description if CH01 shows a different room/bed style/wall/doorway from B01.. or C02_FLOOR"]
  }},
  "room_capacity_check": {{
    "per_image_bunk_counts": [
      {{"slot_code": "C02_FLOOR", "left_bunk_beds": 0, "right_bunk_beds": 0, "visible_bunk_beds": 0, "note": "Vietnamese count note"}}
    ],
    "declared_students": {bed_count},
    "declared_bunk_units": {bunk_count},
    "observed_bunk_units": 0,
    "observed_capacity": 0,
    "matches_declared_room": true,
    "evidence_slot": "",
    "reason": ""
  }},
  "assessment_category": "Đạt yêu cầu|Ảnh không đạt yêu cầu|Ảnh thiếu bằng chứng|Ảnh có dấu hiệu bất thường|Nghi ngờ gian lận",
  "checklist": {{
    "bed_tidy": true,
    "floor_clean": true,
    "desk_organized": true,
    "shoes_arranged": true
  }},
  "deductions": [
    {{"criterion": "bed_tidy|floor_clean|desk_organized|shoes_arranged", "severity": "minor|moderate|severe", "reason": "Vietnamese reason"}}
  ],
  "positive_notes": ["Vietnamese positive observation"],
  "recommendations": "Vietnamese summary and actionable advice"
}}
"""


def _apply_session_scoring(
    result: dict[str, Any],
    slot_items: list[dict[str, Any]],
    duplicate_errors: list[str] | None = None,
    bed_count: int = 4,
) -> dict[str, Any]:
    slot_label_map = {item["slot_code"]: item["slot_label"] for item in slot_items}
    retake_requests: list[dict[str, str]] = []

    slot_checks = result.get("slot_checks") or []
    has_fraud_signal = False
    has_insufficient = False
    has_anomalous = False

    if duplicate_errors:
        has_anomalous = True
        for msg in duplicate_errors:
            retake_requests.append({
                "slot_code": "DUPLICATE",
                "slot_label": "Ảnh trùng lặp",
                "status": "anomalous",
                "reason": msg,
            })

    for chk in slot_checks:
        if not isinstance(chk, dict):
            continue
        code = str(chk.get("slot_code") or "")
        st = str(chk.get("status") or "passed")
        issue = str(chk.get("issue") or "").strip()
        if st != "passed":
            if st == "suspected_fraud":
                has_fraud_signal = True
            elif st == "insufficient_evidence":
                has_insufficient = True
            elif st == "anomalous":
                has_anomalous = True
            retake_requests.append({
                "slot_code": code,
                "slot_label": slot_label_map.get(code, code),
                "status": st,
                "reason": issue or "Ảnh chưa đủ điều kiện đánh giá, vui lòng chụp bổ sung.",
            })

    consistency = result.get("room_consistency") or {}
    is_same_room = consistency.get("is_same_room", True)
    is_authentic_dorm = consistency.get("is_authentic_dorm", True)
    bedding_matches = consistency.get("bedding_matches_context", True)
    bedding_mismatches = [
        str(x).strip() for x in (consistency.get("bedding_mismatches") or []) if str(x).strip()
    ]
    if is_same_room is False or is_authentic_dorm is False or bedding_matches is False or bedding_mismatches:
        has_fraud_signal = True

    ch_cons = result.get("challenge_consistency") or {}
    ch_matches = ch_cons.get("ch01_matches_beds_and_floor", True)
    ch_diffs = [str(x).strip() for x in (ch_cons.get("ch01_differences") or []) if str(x).strip()]
    if ch_matches is False or ch_diffs:
        has_fraud_signal = True

    cap_check = result.get("room_capacity_check") or {}
    expected_bunks = max(1, (bed_count + 1) // 2)
    observed_bunks = cap_check.get("observed_bunk_units") or 0
    ev_slot = str(cap_check.get("evidence_slot") or "")

    # Tự đối chiếu thêm từ per_image_bunk_counts để không phụ thuộc vào boolean của AI
    per_img_counts = cap_check.get("per_image_bunk_counts") or []
    capacity_violating_slots: dict[str, str] = {}
    for entry in per_img_counts:
        if isinstance(entry, dict):
            cnt = entry.get("visible_bunk_beds") or 0
            left_c = entry.get("left_bunk_beds") or 0
            right_c = entry.get("right_bunk_beds") or 0
            if isinstance(left_c, (int, float)) and isinstance(right_c, (int, float)):
                cnt = max(cnt, int(left_c) + int(right_c))
            s_code = str(entry.get("slot_code") or "")
            if isinstance(cnt, (int, float)) and cnt > expected_bunks:
                if s_code in slot_label_map:
                    capacity_violating_slots[s_code] = (
                        f"Không đạt (Ảnh cho thấy {int(cnt)} giường tầng, vượt mức phòng {bed_count} người chỉ có {expected_bunks} giường tầng)"
                    )
                if cnt > observed_bunks:
                    observed_bunks = int(cnt)
                    ev_slot = s_code or ev_slot

    capacity_mismatch = cap_check.get("matches_declared_room") is False or (
        isinstance(observed_bunks, (int, float)) and observed_bunks > expected_bunks
    )
    capacity_reason = ""
    if capacity_mismatch:
        has_fraud_signal = True
        ev_slot = ev_slot or "ảnh toàn phòng"
        obs_cap = cap_check.get("observed_capacity") or (
            int(observed_bunks) * 2 if isinstance(observed_bunks, (int, float)) and observed_bunks > 0 else "khác"
        )
        capacity_reason = str(cap_check.get("reason") or "").strip() or (
            f"Phòng khai báo {bed_count} người ({expected_bunks} giường tầng) nhưng {ev_slot} cho thấy {observed_bunks} giường tầng ({obs_cap} chỗ ngủ)."
        )
        if capacity_violating_slots:
            for v_code, v_reason in capacity_violating_slots.items():
                retake_requests.append({
                    "slot_code": v_code,
                    "slot_label": slot_label_map.get(v_code, v_code),
                    "status": "suspected_fraud",
                    "reason": v_reason,
                })
        else:
            if ev_slot in slot_label_map:
                capacity_violating_slots[ev_slot] = f"Không đạt ({capacity_reason})"
            retake_requests.append({
                "slot_code": ev_slot if ev_slot in slot_label_map else "CAPACITY_MISMATCH",
                "slot_label": slot_label_map.get(ev_slot, "Đối chiếu quy mô phòng"),
                "status": "suspected_fraud",
                "reason": capacity_reason,
            })

    if has_fraud_signal:
        category = "Nghi ngờ gian lận"
    elif has_insufficient:
        category = "Ảnh thiếu bằng chứng"
    elif has_anomalous:
        category = "Ảnh có dấu hiệu bất thường"
    elif retake_requests:
        category = "Ảnh không đạt yêu cầu"
    else:
        category = "Đạt yêu cầu"

    result["assessment_category"] = category
    result["retake_requests"] = retake_requests
    result["fraud_flag"] = has_fraud_signal

    if retake_requests or has_fraud_signal:
        result["is_valid_room_photo"] = False
        result["score"] = 0.0
        result["status"] = "Không hợp lệ (Gian lận)" if has_fraud_signal else "Không hợp lệ"

        summary_parts: list[str] = []
        if capacity_reason:
            summary_parts.append(f"Không khớp loại phòng đã khai báo:\n• {capacity_reason}")
        if bedding_mismatches or bedding_matches is False:
            bm_lines = [f"• {x}" for x in bedding_mismatches] or [
                "• Ga trải giường, chăn gối trong ảnh giường không khớp với ảnh bối cảnh chung (Sàn nhà / Góc thử thách)."
            ]
            summary_parts.append("Ga trải giường không khớp với bối cảnh phòng:\n" + "\n".join(bm_lines))
        if ch_diffs or ch_matches is False:
            ch_msg = "; ".join(ch_diffs) if ch_diffs else "Ảnh góc chụp thử thách (CH01) không khớp kiểu giường, ga giường hoặc bố cục phòng với các ảnh còn lại."
            if "CH01" in slot_label_map:
                capacity_violating_slots["CH01"] = f"Không đạt ({ch_msg})"
                retake_requests.append({
                    "slot_code": "CH01",
                    "slot_label": slot_label_map["CH01"],
                    "status": "suspected_fraud",
                    "reason": ch_msg,
                })
            summary_parts.append("Góc chụp thử thách (CH01) không khớp phòng:\n• " + ch_msg)
        if has_fraud_signal and consistency.get("inconsistencies"):
            inc_lines = [f"• {x}" for x in consistency["inconsistencies"]]
            summary_parts.append("Phát hiện dấu hiệu không đồng nhất / ngoài KTX:\n" + "\n".join(inc_lines))

        all_slot_lines: list[str] = []
        checked_map = {
            str(chk.get("slot_code") or ""): chk
            for chk in slot_checks
            if isinstance(chk, dict)
        }
        for item in slot_items:
            code = item["slot_code"]
            lbl = item["slot_label"]
            if code in capacity_violating_slots:
                all_slot_lines.append(f"• {lbl}: {capacity_violating_slots[code]}")
                continue
            chk = checked_map.get(code)
            if chk:
                st = str(chk.get("status") or "passed")
                issue = str(chk.get("issue") or "").strip()
                detected = str(chk.get("detected_object") or "").strip()
                if st != "passed":
                    all_slot_lines.append(f"• {lbl}: {issue or detected or 'Chưa đạt yêu cầu'}")
                else:
                    all_slot_lines.append(f"• {lbl}: Đạt ({detected or 'Hợp lệ'})")
            else:
                all_slot_lines.append(f"• {lbl}: Chưa có nhận xét chi tiết")

        if all_slot_lines:
            summary_parts.append(f"Nhận xét chi tiết toàn bộ {len(slot_items)} ảnh:\n" + "\n".join(all_slot_lines))

        full_msg = "\n\n".join(summary_parts) if summary_parts else (
            result.get("recommendations") or "Cần chụp bổ sung ảnh."
        )
        result["issues_detected"] = [full_msg]
        result["recommendations"] = full_msg
        return result

    # Tổng hợp điểm theo 4 nhóm L1..L4
    checklist = result.get("checklist") or {}
    bed_details = result.get("bed_details") or []
    if bed_details and any(b.get("is_tidy") is False for b in bed_details if isinstance(b, dict)):
        checklist["bed_tidy"] = False

    for k in CRITERIA:
        if k not in checklist or not isinstance(checklist[k], bool):
            checklist[k] = True
    result["checklist"] = checklist

    deductions = result.get("deductions") or []
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
        reason = str(item.get("reason", "")).strip() or f"Chưa đảm bảo tiêu chuẩn {CRITERIA[criterion]}"
        if criterion not in seen:
            seen.add(criterion)
            score -= points
            display_points = f"{points:.1f}".replace(".", ",")
            issues.append(f"−{display_points} điểm · {CRITERIA[criterion]} · {reason}")

    for criterion, ok in checklist.items():
        if ok is False and criterion not in seen:
            score -= 1.0
            issues.append(f"−1,0 điểm · {CRITERIA[criterion]} · Chưa đạt tiêu chuẩn ngăn nắp")

    score = max(0.0, round(score, 1))
    result["is_valid_room_photo"] = True
    result["score"] = score
    result["status"] = "Sạch" if score >= 8.0 else "Hơi bừa bộn" if score >= 5.0 else "Bừa bộn"
    result["issues_detected"] = issues
    result["l1_l4_summary"] = {
        "L1_giuong": checklist["bed_tidy"],
        "L2_san_nha": checklist["floor_clean"],
        "L3_ban_hoc": checklist["desk_organized"],
        "L4_do_dac": checklist["shoes_arranged"],
    }
    return result


def evaluate_room_session(
    slot_items: list[dict[str, Any]],
    room_code: str,
    bed_count: int,
    duplicate_errors: list[str] | None = None,
) -> dict[str, Any]:
    """Chấm điểm 5S tổng hợp cho bộ ảnh giường tầng + 4 khu vực chung (và thử thách nếu có)."""
    if not slot_items:
        raise ValueError("Cần ít nhất một ảnh trong phiên chụp.")

    processed_buffers: list[bytes] = []
    processed_images: list[Image.Image] = []
    for item in slot_items:
        with Image.open(io.BytesIO(item["bytes"])) as img:
            img = ImageOps.exif_transpose(img)
            if img.mode != "RGB":
                img = img.convert("RGB")
            max_side = max(img.size)
            if max_side > 896:
                scale = 896 / max_side
                img = img.resize((int(img.width * scale), int(img.height * scale)), Image.Resampling.LANCZOS)
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=80, optimize=True)
            b = buf.getvalue()
            processed_buffers.append(b)
            processed_images.append(Image.open(io.BytesIO(b)))

    prompt = build_session_prompt(slot_items, room_code=room_code, bed_count=bed_count)
    start_time = time.time()

    if getattr(settings, "AI_PROVIDER", "").lower() == "nvidia" and getattr(settings, "NVIDIA_API_KEY", ""):
        if OpenAI is not None:
            try:
                client = OpenAI(
                    base_url="https://integrate.api.nvidia.com/v1",
                    api_key=settings.NVIDIA_API_KEY.strip(),
                )
                content: list[dict[str, Any]] = [{"type": "text", "text": prompt}]
                for item, buf_data in zip(slot_items, processed_buffers):
                    b64 = base64.b64encode(buf_data).decode("utf-8")
                    content.append({"type": "text", "text": f"\n\n---\n[{item['slot_code']}] {item['slot_label']}:"})
                    content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}})

                response = client.chat.completions.create(
                    model="nvidia/nemotron-3.5-super-vl-120b-a12b",
                    messages=[{"role": "user", "content": content}],
                    temperature=0.1,
                    max_tokens=2000,
                    extra_body={"chat_template_kwargs": {"thinking": False}},
                )
                duration_ms = int((time.time() - start_time) * 1000)
                raw_text = (getattr(response.choices[0].message, "content", None) or "").strip()
                if "{" in raw_text and "}" in raw_text:
                    raw_text = raw_text[raw_text.find("{"):raw_text.rfind("}") + 1]
                result = json.loads(raw_text)
                _apply_session_scoring(result, slot_items, duplicate_errors=duplicate_errors, bed_count=bed_count)
                result["ai_response_time_ms"] = duration_ms
                return result
            except Exception as e:
                print(f"[WARN] NVIDIA session eval fallback to Gemini: {e}")

    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY chưa được thiết lập trong file .env")

    genai.configure(api_key=settings.GEMINI_API_KEY)
    generation_config = {
        "response_mime_type": "application/json",
        "temperature": 0,
        "max_output_tokens": 2000,
    }
    last_error = None
    for model_name in DEFAULT_MODELS:
        try:
            model = genai.GenerativeModel(model_name=model_name, generation_config=generation_config)
            content = [prompt]
            for item, img in zip(slot_items, processed_images):
                content.extend([f"[{item['slot_code']}] {item['slot_label']}", img])
            response = model.generate_content(content)
            duration_ms = int((time.time() - start_time) * 1000)
            raw_text = response.text.strip()
            if "{" in raw_text and "}" in raw_text:
                raw_text = raw_text[raw_text.find("{"):raw_text.rfind("}") + 1]
            result = json.loads(raw_text)
            _apply_session_scoring(result, slot_items, duplicate_errors=duplicate_errors)
            result["ai_response_time_ms"] = duration_ms
            return result
        except Exception as e:
            last_error = e
            continue

    raise RuntimeError(f"Lỗi khi gọi Gemini Vision API: {last_error}")
