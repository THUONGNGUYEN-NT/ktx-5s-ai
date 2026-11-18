import io
import time
import json
from contextlib import ExitStack
from typing import Any
from PIL import Image
import google.generativeai as genai
from app.config import settings

# Danh sách model ưu tiên theo tốc độ và khả năng nhận diện hình ảnh
DEFAULT_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-3.8-flash"]

PROMPT_5S = """
SYSTEM: Bạn là Chuyên gia Đánh giá Vệ sinh KTX theo tiêu chuẩn 5S.
Nhiệm vụ của bạn là phân tích ảnh chụp phòng ở sinh viên và trả về đánh giá khách quan dưới dạng JSON chuẩn.

TIÊU CHUẨN ĐÁNH GIÁ 5S:
1. bed_tidy: Giường chiếu đã gấp gọn chăn màn, gối để ngay ngắn.
2. floor_clean: Sàn nhà sạch, không có rác, quần áo hay đồ vật cản trở lối đi.
3. desk_organized: Bàn học gọn gàng, sách vở/máy tính xếp ngăn nắp, không có rác hay đồ ăn thừa.
4. shoes_arranged: Giày dép để đúng nơi quy định (trên kệ hoặc sát tường ngay ngắn).

QUY TẮC GHI NHẬN:
- Tất cả ảnh là các góc chụp cho cùng một lượt nộp. Xem cả bộ ảnh rồi trả một checklist.
- Nếu thấy cùng một lỗi ở nhiều góc, chỉ tính một lần. Trong lý do ghi rõ ảnh số mấy thể hiện lỗi.
- Nếu các ảnh không thể dùng để đánh giá cùng một phòng, yêu cầu người dùng chụp lại.
- Chỉ đánh giá chi tiết thấy rõ trong ít nhất một ảnh. Checklist: true nếu đạt, false nếu thấy lỗi, null nếu không quan sát được.
- Mỗi mục false phải có đúng một mục deductions. Mỗi mục true hoặc null không có khoản trừ.
- Ghi tiêu chí (tên khóa), mức độ minor / moderate / severe và lý do cụ thể bằng tiếng Việt, nêu vật và vị trí nhìn thấy.
- minor: lỗi nhỏ, cục bộ. moderate: lỗi rõ ràng hoặc nhiều vật để sai chỗ. severe: mất vệ sinh nghiêm trọng hoặc cản trở lối đi.
- Không tự chấm điểm hoặc xếp loại. Server tính từ các lỗi đã ghi nhận.
- Ảnh quá tối/mờ, không phải phòng hoặc không thấy gì để đánh giá: trả is_valid_room_photo = false và hướng dẫn chụp lại trong recommendations.

JSON bắt buộc, không kèm Markdown. Ví dụ cấu trúc:
{
  "is_valid_room_photo": true,
  "checklist": {
    "bed_tidy": false,
    "floor_clean": true,
    "desk_organized": true,
    "shoes_arranged": null
  },
  "deductions": [
    {"criterion": "bed_tidy", "severity": "minor", "reason": "Chăn trên giường tầng dưới chưa gấp."}
  ],
  "positive_notes": [],
  "recommendations": "Gấp chăn trên giường tầng dưới."
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
    if result.get("is_valid_room_photo") is False:
        return

    checklist = result.get("checklist")
    if (
        result.get("is_valid_room_photo") is not True
        or not isinstance(checklist, dict)
        or set(checklist) != CRITERIA.keys()
        or any(value is not None and type(value) is not bool for value in checklist.values())
    ):
        raise ValueError("Checklist AI không đúng định dạng.")

    if all(value is None for value in checklist.values()):
        result["is_valid_room_photo"] = False
        result["recommendations"] = "Ảnh chưa thấy rõ các khu vực cần chấm. Vui lòng chụp lại."
        return

    deductions = result.get("deductions")
    if not isinstance(deductions, list):
        raise ValueError("AI chưa cung cấp danh sách điểm trừ.")

    issues = []
    seen = set()
    score = 10.0
    for item in deductions:
        criterion = item["criterion"]
        points = DEDUCTION_POINTS[item["severity"]]
        reason = item["reason"].strip()
        if criterion in seen or checklist.get(criterion) is not False or not reason:
            raise ValueError("Khoản trừ không khớp với checklist AI.")
        seen.add(criterion)
        score -= points
        display_points = f"{points:.1f}".replace(".", ",")
        issues.append(f"−{display_points} điểm · {CRITERIA[criterion]} · {reason}")

    if seen != {key for key, value in checklist.items() if value is False}:
        raise ValueError("AI chưa giải thích đủ các tiêu chí bị trừ điểm.")

    result["score"] = score
    result["status"] = "Sạch" if score >= 8 else "Hơi bừa bộn" if score >= 5 else "Bừa bộn"
    result["issues_detected"] = issues


def evaluate_room_image(image_bytes: bytes | list[bytes]) -> dict[str, Any]:
    """
    Gửi ảnh phòng đã nén sang Gemini Vision để chấm điểm 5S.

    Returns:
        dict: Kết quả phân tích kèm trường ai_response_time_ms.
    """
    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY chưa được thiết lập trong file .env")

    genai.configure(api_key=settings.GEMINI_API_KEY)
    images = [image_bytes] if isinstance(image_bytes, bytes) else image_bytes
    if not images:
        raise ValueError("Cần ít nhất một ảnh phòng.")

    start_time = time.time()
    last_error = None

    # Thử gọi model nhanh nhất có sẵn
    for model_name in DEFAULT_MODELS:
        try:
            model = genai.GenerativeModel(
                model_name=model_name,
                generation_config={"response_mime_type": "application/json"},
            )
            with ExitStack() as stack:
                content = [PROMPT_5S]
                for index, data in enumerate(images, start=1):
                    image = stack.enter_context(Image.open(io.BytesIO(data)))
                    content.extend([f"Ảnh số {index}", image])
                response = model.generate_content(content)
            duration_ms = int((time.time() - start_time) * 1000)

            # Parse JSON
            raw_text = response.text.strip()
            # Bỏ markdown ```json ... ``` nếu có
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
