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
You are a strict dormitory 5S cleanliness inspector. Analyze the 4 room photos submitted by a student.

=== STEP 1: VALIDATE EACH PHOTO (REQUIRED FIRST) ===
Check each photo independently against its required subject:

Photo 1 — BED AREA: Must clearly show a bed with mattress/blanket/pillow.
REJECT if: shows cooking pots/pans/food items, random dark clutter unrecognizable as a bed, desk, floor, window, or ceiling instead of bed.

Photo 2 — FLOOR/WALKWAY: Must clearly show floor surface (tiles/cement) covering ≥50% of frame with a clear walkway.
REJECT if: blocked by sheer curtain (màn tuyn), hanging laundry, or fabric in front of camera; extreme close-up of furniture legs hiding floor; blurry/dark/outside balcony shot.

Photo 3 — SHOE RACK AREA: Must clearly show a shoe rack or neatly arranged shoes near the entrance door.
REJECT if: only shows floor/electrical cords/power strips with NO shoe rack or shoes visible; shows bed corner, desk, or other area.

Photo 4 — STUDY DESK: Must clearly show the student's desk surface or bookshelf.
REJECT if: shows windowsill, window frame, window glass, bare wall corner; shows bed or floor instead of desk.

ANTI-SPOOFING: Reject if photo appears to be re-photographed from a screen (Moiré patterns, screen bezels visible).

Verdict rules:
- For each photo set: is_valid (true/false), detected_object (brief Vietnamese description of what is seen), issue (Vietnamese reason if invalid).
- If ANY photo is invalid: set is_valid_room_photo=false, list ALL violations in invalid_reason, set checklist fields to null, deductions=[].

=== STEP 2: SCORE (ONLY IF ALL 4 PHOTOS VALID) ===
Criteria (all start true, mark false if failing):
- bed_tidy: blanket folded neatly, pillow straight → false if messy/unfolded
- floor_clean: no trash/dust, clear walkway → false if dirty/blocked
- shoes_arranged: shoes lined up on rack → false if scattered
- desk_organized: books/laptop tidy → false if cluttered/has trash

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
  "is_valid_room_photo": bool,
  "invalid_reason": "Vietnamese explanation if invalid, else empty string",
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
                issue = p_info.get("issue") or p_info.get("detected_object") or "Sai góc chụp quy định"
                failed_photos.append(f"• {label}: {issue}")

    # Nếu có bất kỳ ảnh nào vi phạm quy định
    if failed_photos or result.get("is_valid_room_photo") is False:
        result["is_valid_room_photo"] = False
        result["score"] = 0.0
        result["status"] = "Không hợp lệ"
        if failed_photos:
            reason = "Phát hiện ảnh chụp không đúng quy định:\n" + "\n".join(failed_photos)
        else:
            reason = result.get("invalid_reason") or "Ảnh chụp không đúng góc quy định hoặc bị phát hiện gian lận."
        result["invalid_reason"] = reason
        result["issues_detected"] = [reason]
        result["recommendations"] = "Vui lòng chụp lại các ảnh vi phạm theo đúng góc hướng dẫn."
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
                if max_side > 512:
                    scale = 512 / max_side
                    img = img.resize((int(img.width * scale), int(img.height * scale)), Image.Resampling.LANCZOS)
                buf = io.BytesIO()
                img.save(buf, format="JPEG", quality=75, optimize=True)
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
                max_tokens=2048,
            )
            duration_ms = int((time.time() - start_time) * 1000)

            msg = response.choices[0].message
            raw_text = getattr(msg, "content", None) or ""
            raw_text = raw_text.strip()

            # Xử lý chuỗi JSON nếu model bọc trong ```json ... ```
            if "```" in raw_text:
                import re
                match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", raw_text)
                if match:
                    raw_text = match.group(1).strip()

            if not raw_text:
                raise ValueError("NVIDIA model trả về nội dung rỗng")

            result = json.loads(raw_text)
            apply_scoring(result)
            result["ai_response_time_ms"] = duration_ms
            return result
        except Exception as e:
            print(f"[WARN] Lỗi khi gọi NVIDIA NIM ({e}), chuyển sang Gemini dự phòng...")

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
