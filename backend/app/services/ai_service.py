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
You are a strict dormitory 5S cleanliness inspector and anti-fraud investigator.
Analyze the 4 room photos submitted by a student.

=== STEP 1: VALIDATE EACH PHOTO (REQUIRED FIRST) ===
Check each photo independently against its required subject:

Photo 1 — BED AREA: Must clearly show a dorm bed (mattress, mat/chiếu, blanket, pillow, bed frame).
- VALID: If a small foldable bed desk (bàn gấp gọn trên giường) or mini bookshelf is placed ON TOP of the bed, IT IS STILL FULLY VALID (is_valid = true) because students commonly use foldable bed tables on their beds. Do NOT reject the bed just because there is a small foldable study desk or mini shelf on it.
- REJECT only if: shows cooking pots/pans/food, bathroom/toilet, dark unrecognizable clutter, bare floor, window sill, or a standalone table with chairs away from bed.

Photo 2 — FLOOR & WALKWAY: Must clearly show the floor surface (tiles/cement) covering ≥50% of frame with a clear walkway between beds/furniture towards the door.
- REJECT if: blocked by sheer curtain (màn tuyn), hanging laundry, or fabric in front of camera; extreme close-up of furniture legs hiding floor; blurry/dark/outside balcony shot.

Photo 3 — SHOE RACK AREA: Must clearly show a shoe rack or neatly arranged shoes near the entrance door.
- REJECT if: shows bathroom sinks (bồn rửa mặt), toilet, shower, bare electrical cords with NO shoes/rack, bed corner, or other non-shoe areas.

Photo 4 — STANDALONE STUDY DESK AREA: Must clearly show a dedicated, standalone study desk/table (with chairs, wooden/metal desk frame separated from bed sleeping surface).
- REJECT if: photo is taken of a bed sleeping surface (mattress, mat, blanket, pillows, under-bunk sleeping area) even if it has books or a mini shelf. The study desk MUST BE A SEPARATE TABLE/DESK to evaluate the complete room.
- REJECT if: shows window sill, bare wall, bathroom, or floor instead of a study desk.

ANTI-SPOOFING: Reject if photo appears to be re-photographed from a screen (Moiré patterns, screen bezels visible).

=== STEP 2: ROOM CONSISTENCY CHECK (CROSS-PHOTO SAME ROOM VERIFICATION) ===
Verify whether all 4 photos belong to the EXACT SAME DORM ROOM by cross-referencing visual details:
1. Cross-matching wide shot (Photo 2) with close-up shots (Photo 1, 4):
   - Check if bedding sets, bed mats (chiếu trúc/cối), sheets, blankets, pillows, plush toys, mini fans, or decorative posters seen in Photo 1 and Photo 4 correspond to the beds visible in Photo 2.
   - Matching furniture: Bunk bed steel frame color/design, desk style, window frame style, room door color.
   - Matching environment: Floor tile color/pattern/grout lines, wall paint color and marks.
2. If items and architectural details match across the photos (e.g. bed in Photo 1 and 4 match the left/right bunks in Photo 2):
   -> is_same_room = true.
3. If there are obvious contradictions (e.g. photos from completely different rooms with conflicting tile colors, wall colors, or unrelated buildings):
   -> is_same_room = false, list discrepancies in inconsistencies.
   (Note: Bathroom sinks in Photo 3 is an invalid photo issue for Photo 3, not necessarily a different room if attached to dorm, but Photo 3 must be marked invalid).

=== STEP 3: SCORE 5S (ONLY IF ALL PHOTOS VALID & FROM SAME ROOM) ===
Criteria (all start true, mark false if failing):
- bed_tidy: blanket folded neatly, pillow straight, bed neat → false if messy/unfolded
- floor_clean: no trash/dust, clear walkway → false if dirty/blocked
- shoes_arranged: shoes lined up on rack → false if scattered/no rack
- desk_organized: books/laptop tidy on desk → false if cluttered/has trash

Deductions list (per failing criterion):
- severity: "minor" (-0.5pt) small localized issue | "moderate" (-1.5pt) clearly messy | "severe" (-2.5pt) unsanitary

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
    "details": "Vietnamese explanation (e.g. Khớp chi tiết ga gối, chiếu và quạt mini giữa ảnh 1, 4 với ảnh toàn cảnh lối đi 2)",
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

    # 2. Kiểm tra tính đồng nhất phòng (CHỈ kích hoạt khi các ảnh đều đã chụp đúng chủ đề)
    room_consistency = result.get("room_consistency")
    different_rooms_reason = None
    if not failed_photos and isinstance(room_consistency, dict) and room_consistency.get("is_same_room") is False:
        inconsistencies = room_consistency.get("inconsistencies") or []
        details = room_consistency.get("details") or ""
        if inconsistencies:
            details_str = "\n".join(f"• {inc}" for inc in inconsistencies)
        elif details:
            details_str = f"• {details}"
        else:
            details_str = "• Nền gạch sàn hoặc màu sơn tường không trùng khớp giữa các ảnh."
        different_rooms_reason = f"Phát hiện ảnh chụp từ nhiều phòng khác nhau (không cùng một phòng):\n{details_str}"

    # Nếu có ảnh chụp sai hoặc không cùng phòng
    if failed_photos or different_rooms_reason or result.get("is_valid_room_photo") is False:
        result["is_valid_room_photo"] = False
        result["score"] = 0.0
        result["status"] = "Không hợp lệ"
        
        if failed_photos:
            full_reason = "Vui lòng chụp lại các góc sau:\n" + "\n".join(failed_photos)
        elif different_rooms_reason:
            full_reason = different_rooms_reason
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
