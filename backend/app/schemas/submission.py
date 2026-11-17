from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field


class ChecklistSchema(BaseModel):
    bed_tidy: bool = Field(..., description="Giường chiếu gấp gọn")
    floor_clean: bool = Field(..., description="Sàn nhà sạch sẽ")
    desk_organized: bool = Field(..., description="Bàn học ngăn nắp")
    shoes_arranged: bool = Field(..., description="Giày dép đúng nơi")


class AiResultSchema(BaseModel):
    status: str = Field(..., description="'Sạch' | 'Hơi bừa bộn' | 'Bừa bộn'")
    score: float = Field(..., description="Thang điểm từ 0.0 đến 10.0")
    is_valid_room_photo: bool = Field(..., description="Ảnh hợp lệ hay không")
    checklist: ChecklistSchema
    issues_detected: List[str] = Field(default_factory=list, description="Danh sách lỗi phát hiện")
    positive_notes: List[str] = Field(default_factory=list, description="Điểm làm tốt")
    recommendations: str = Field(..., description="Lời khuyên khắc phục")


class SubmissionData(BaseModel):
    submission_id: str
    room_code: str
    submitted_at: datetime
    image_url: str
    ai_result: AiResultSchema


class ApiResponse(BaseModel):
    success: bool
    data: Optional[dict] = None
    message: str
    error_code: Optional[str] = None


class SubmissionHistoryItem(BaseModel):
    submission_id: str
    week: str
    submitted_at: datetime
    image_url: str
    status: str
    score: float
    is_overridden: bool = False
    override_note: Optional[str] = None
