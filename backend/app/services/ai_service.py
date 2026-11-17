import io
import time
import json
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

QUY TẮC PHÂN LOẠI & ĐIỂM SỐ:
- "Sạch" (Điểm 8.0 - 10.0): Đạt tốt cả 4 tiêu chí trên.
- "Hơi bừa bộn" (Điểm 5.0 - 7.9): Có 1-2 tiêu chí chưa hoàn thiện nhưng không bẩn nghiêm trọng.
- "Bừa bộn" (Điểm 0.0 - 4.9): Có rác, đồ đạc vứt bừa bãi cản lối đi, phòng luộm thuộm hoặc mất vệ sinh.

LƯU Ý ĐẶC BIỆT:
- Nếu ảnh bị tối đen, mờ tịt, chụp trần nhà/ngón tay, hoặc không phải là phòng ở KTX: Đặt is_valid_room_photo = false, score = 0.0, status = "Bừa bộn", recommendations = "Ảnh không hợp lệ hoặc quá mờ/tối. Vui lòng chụp lại rõ nét toàn cảnh phòng."

JSON SCHEMA BẮT BUỘC (trả về đúng định dạng JSON, không kèm markdown code block):
{
  "status": "Sạch" | "Hơi bừa bộn" | "Bừa bộn",
  "score": 0.0,
  "is_valid_room_photo": true,
  "checklist": {
    "bed_tidy": true,
    "floor_clean": false,
    "desk_organized": true,
    "shoes_arranged": false
  },
  "issues_detected": ["danh sách cụ thể các lỗi phát hiện được bằng tiếng Việt"],
  "positive_notes": ["lời khen các điểm làm tốt bằng tiếng Việt"],
  "recommendations": "lời khuyên cụ thể để sinh viên dọn dẹp bằng tiếng Việt"
}
"""


def evaluate_room_image(image_bytes: bytes) -> dict[str, Any]:
    """
    Gửi ảnh phòng đã nén sang Gemini Vision để chấm điểm 5S.

    Returns:
        dict: Kết quả phân tích kèm trường ai_response_time_ms.
    """
    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY chưa được thiết lập trong file .env")

    genai.configure(api_key=settings.GEMINI_API_KEY)
    img = Image.open(io.BytesIO(image_bytes))

    start_time = time.time()
    last_error = None

    # Thử gọi model nhanh nhất có sẵn
    for model_name in DEFAULT_MODELS:
        try:
            model = genai.GenerativeModel(
                model_name=model_name,
                generation_config={"response_mime_type": "application/json"},
            )
            response = model.generate_content([PROMPT_5S, img])
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
            result["ai_response_time_ms"] = duration_ms
            return result

        except Exception as e:
            last_error = e
            continue

    raise RuntimeError(f"Lỗi khi gọi Gemini Vision API: {last_error}")
