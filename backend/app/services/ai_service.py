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
    """Tạo prompt AI động theo từng giường tầng (trên & dưới) + 4 khu vực chung và 4 nhóm lỗi L1–L4."""
    slot_lines = []
    for idx, item in enumerate(slot_items, start=1):
        slot_lines.append(
            f"- Image {idx} [{item['slot_code']}] ({item['slot_group']}): {item['slot_label']}"
        )
    slots_desc = "\n".join(slot_lines)

    return f"""
You are a senior Computer Vision 5S Inspector and Anti-Fraud Investigator for VNU-HCM Dormitory (KTX ĐHQG-HCM).
Room: {room_code} | Bunk bed units: {max(1, (bed_count + 1) // 2)} | Common areas: 4 (+ optional random challenge).

Submitted photos in this capture session:
{slots_desc}

=== 1. SLOT-BY-SLOT VERIFICATION ===
Inspect EVERY submitted image independently:
- Sleeping positions (B01..B{max(1, (bed_count + 1) // 2):02d}): Each photo represents one bunk bed unit showing BOTH the upper bunk and lower bunk clearly in the same frame (blankets, pillows, mattresses, no clutter/storage).
- C01_OVERVIEW: Wide view from the doorway showing overall layout of beds, desks, and walkway.
- C02_FLOOR: Angled 30-45° view of floor and walkway (trash, dust, obstacles).
- C03_DESK: Direct/30° view of study desk surface and items.
- C04_SHOES: Direct view of shoe rack, hanging clothes, and personal storage.
- CH01 (if present): Random challenge angle matching its description.

=== 2. DISTINGUISH PHOTO ISSUES VS SUSPECTED FRAUD ===
Do NOT jump to "fraud" for simple quality issues. Classify each problematic slot into one of:
- "needs_retake": Blurry, dark, backlit, wrong angle, or partially obscured.
- "insufficient_evidence": Cannot observe the target area clearly (e.g. upper bunk hidden, desk surface blocked).
- "anomalous": Minor inconsistency or duplicate image that requires re-capture.
- "suspected_fraud": Clearly spliced from different rooms, private non-dorm apartment/studio, stock/catalog image, or someone intentionally holding objects to hide mess.

=== 3. AGGREGATED 5S SCORING (L1 - L4) ===
DO NOT score each photo in isolation. Aggregate across the whole room:
- L1 (bed_tidy - Giường): Evaluate ALL beds B01..B{bed_count:02d} together. If ANY bed is messy or used as storage -> L1 fails.
- L2 (floor_clean - Sàn nhà và lối đi): Evaluate C02_FLOOR + C01_OVERVIEW.
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
    "confidence": "high|medium|low",
    "inconsistencies": ["Vietnamese description if any"]
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
    if is_same_room is False or is_authentic_dorm is False:
        has_fraud_signal = True

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
        reasons = [f"• {r['slot_label']}: {r['reason']}" for r in retake_requests]
        if not reasons and consistency.get("inconsistencies"):
            reasons = [f"• {x}" for x in consistency["inconsistencies"]]
        result["issues_detected"] = reasons or [result.get("recommendations") or "Cần chụp bổ sung ảnh."]
        if not result.get("recommendations"):
            result["recommendations"] = (
                "Cán bộ quản lý sẽ xác minh trường hợp nghi ngờ gian lận."
                if has_fraud_signal
                else "Vui lòng chụp bổ sung các góc ảnh chưa đạt yêu cầu."
            )
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
            if max_side > 512:
                scale = 512 / max_side
                img = img.resize((int(img.width * scale), int(img.height * scale)), Image.Resampling.LANCZOS)
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=75, optimize=True)
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
                _apply_session_scoring(result, slot_items, duplicate_errors=duplicate_errors)
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
