import uuid
from datetime import datetime
from sqlalchemy import String, Integer, Float, Boolean, DateTime, Text, ForeignKey, Unicode, UnicodeText
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


def new_uuid() -> str:
    return str(uuid.uuid4())


# =============================================
# BẢNG 0: users — Tài khoản người dùng (Phân quyền Admin / Sinh viên)
# =============================================
class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(Unicode(100), nullable=False)
    role: Mapped[str] = mapped_column(String(20), default="admin")  # "admin" | "student"
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# =============================================
# BẢNG 1: rooms — Danh sách phòng KTX
# =============================================
class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    room_code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)  # VD: "A3-205"
    building: Mapped[str] = mapped_column(String(10), nullable=False)                # VD: "A"
    floor: Mapped[int] = mapped_column(Integer, nullable=False)                      # VD: 3
    room_number: Mapped[str] = mapped_column(String(10), nullable=False)             # VD: "205"
    capacity: Mapped[int] = mapped_column(Integer, default=4)                        # Số chỗ tối đa (2, 4, 6, 8)
    bed_count: Mapped[int] = mapped_column(Integer, nullable=True)                   # Số vị trí ngủ thực tế P (mặc định = capacity)
    qr_code_url: Mapped[str] = mapped_column(String(500), nullable=True)             # URL ảnh QR dán ở phòng
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Quan hệ
    students: Mapped[list["Student"]] = relationship("Student", back_populates="room")
    submissions: Mapped[list["Submission"]] = relationship("Submission", back_populates="room")


# =============================================
# BẢNG 2: students — Danh sách sinh viên
# =============================================
class Student(Base):
    __tablename__ = "students"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    student_code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)  # Mã sinh viên
    full_name: Mapped[str] = mapped_column(Unicode(100), nullable=False)
    room_id: Mapped[str] = mapped_column(String(36), ForeignKey("rooms.id"), nullable=True)
    phone: Mapped[str] = mapped_column(String(15), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Quan hệ
    room: Mapped["Room"] = relationship("Room", back_populates="students")


# =============================================
# BẢNG 3: submissions — Lượt nộp ảnh của từng phòng
# =============================================
class Submission(Base):
    __tablename__ = "submissions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    room_id: Mapped[str] = mapped_column(String(36), ForeignKey("rooms.id"), nullable=False)
    week: Mapped[str] = mapped_column(String(10), nullable=False)       # VD: "2026-W47"
    image_url: Mapped[str] = mapped_column(String(500), nullable=False) # URL ảnh trên Cloudinary
    image_size_kb: Mapped[int] = mapped_column(Integer, nullable=True)  # Dung lượng sau nén (KB)
    captured_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)   # Thời gian chụp từ client
    submitted_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    capture_session_id: Mapped[str] = mapped_column(String(36), nullable=True)
    student_code: Mapped[str] = mapped_column(String(20), nullable=True)
    fraud_flag: Mapped[bool] = mapped_column(Boolean, default=False)
    assessment_category: Mapped[str] = mapped_column(Unicode(60), nullable=True)

    # Duyệt đè bởi cán bộ
    is_overridden: Mapped[bool] = mapped_column(Boolean, default=False)
    override_note: Mapped[str] = mapped_column(UnicodeText, nullable=True)
    overridden_by: Mapped[str] = mapped_column(Unicode(100), nullable=True)  # Username cán bộ
    overridden_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    # Quan hệ
    room: Mapped["Room"] = relationship("Room", back_populates="submissions")
    photos: Mapped[list["SubmissionPhoto"]] = relationship(
        order_by="SubmissionPhoto.position", cascade="all, delete-orphan"
    )
    ai_evaluation: Mapped["AiEvaluation"] = relationship("AiEvaluation", back_populates="submission", uselist=False)


class SubmissionPhoto(Base):
    __tablename__ = "submission_photos"

    submission_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("submissions.id", ondelete="CASCADE"), primary_key=True
    )
    position: Mapped[int] = mapped_column(Integer, primary_key=True)
    image_url: Mapped[str] = mapped_column(String(500), nullable=False)
    slot_code: Mapped[str] = mapped_column(String(32), nullable=True)
    slot_label: Mapped[str] = mapped_column(Unicode(120), nullable=True)
    image_hash: Mapped[str] = mapped_column(String(64), nullable=True)


# =============================================
# BẢNG 3B: capture_sessions — Phiên chụp ảnh kiểm tra 5S (chống gian lận 7 lớp)
# =============================================
class CaptureSession(Base):
    __tablename__ = "capture_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    room_id: Mapped[str] = mapped_column(String(36), ForeignKey("rooms.id"), nullable=False)
    room_code: Mapped[str] = mapped_column(String(20), nullable=False)
    student_code: Mapped[str] = mapped_column(String(50), nullable=True)
    week: Mapped[str] = mapped_column(String(10), nullable=False)
    bed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=4)
    total_required: Mapped[int] = mapped_column(Integer, nullable=False, default=6)  # Số giường tầng + 4 khu vực chung
    qr_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    qr_token: Mapped[str] = mapped_column(String(100), nullable=True)
    challenge_slot_code: Mapped[str] = mapped_column(String(32), nullable=True)
    challenge_prompt: Mapped[str] = mapped_column(UnicodeText, nullable=True)
    audit_required: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(30), default="in_progress")  # in_progress | needs_retake | submitted | flagged
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    photos: Mapped[list["CaptureSessionPhoto"]] = relationship(
        "CaptureSessionPhoto", back_populates="session", cascade="all, delete-orphan"
    )


class CaptureSessionPhoto(Base):
    __tablename__ = "capture_session_photos"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("capture_sessions.id", ondelete="CASCADE"), nullable=False
    )
    slot_code: Mapped[str] = mapped_column(String(32), nullable=False)  # B01..B08, C01_OVERVIEW..C04_SHOES, CH01
    slot_group: Mapped[str] = mapped_column(String(20), nullable=False)  # bed | common | challenge
    slot_label: Mapped[str] = mapped_column(Unicode(120), nullable=False)
    image_url: Mapped[str] = mapped_column(String(500), nullable=False)
    image_hash: Mapped[str] = mapped_column(String(64), nullable=True)
    width: Mapped[int] = mapped_column(Integer, nullable=True)
    height: Mapped[int] = mapped_column(Integer, nullable=True)
    brightness: Mapped[float] = mapped_column(Float, nullable=True)
    blur_score: Mapped[float] = mapped_column(Float, nullable=True)
    captured_via_camera: Mapped[bool] = mapped_column(Boolean, default=True)
    captured_at_server: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    validation_status: Mapped[str] = mapped_column(String(30), default="passed")  # passed | needs_retake | insufficient_evidence | anomalous | suspected_fraud
    validation_reason: Mapped[str] = mapped_column(UnicodeText, nullable=True)

    session: Mapped["CaptureSession"] = relationship("CaptureSession", back_populates="photos")


# =============================================
# BẢNG 4: ai_evaluations — Kết quả AI chấm điểm
# =============================================
class AiEvaluation(Base):
    __tablename__ = "ai_evaluations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    submission_id: Mapped[str] = mapped_column(String(36), ForeignKey("submissions.id"), unique=True, nullable=False)

    # Kết quả chính (Dùng Unicode để lưu tiếng Việt không bị lỗi font trên SQL Server)
    status: Mapped[str] = mapped_column(Unicode(50), nullable=False)       # "Sạch" / "Hơi bừa bộn" / "Bừa bộn"
    score: Mapped[float] = mapped_column(Float, nullable=False)            # 0.0 - 10.0
    is_valid_room_photo: Mapped[bool] = mapped_column(Boolean, default=True)

    # Checklist (4 tiêu chí 5S)
    bed_tidy: Mapped[bool] = mapped_column(Boolean, nullable=True)
    floor_clean: Mapped[bool] = mapped_column(Boolean, nullable=True)
    desk_organized: Mapped[bool] = mapped_column(Boolean, nullable=True)
    shoes_arranged: Mapped[bool] = mapped_column(Boolean, nullable=True)

    # Chi tiết dạng text (lưu JSON string tiếng Việt chuẩn UnicodeText)
    issues_detected: Mapped[str] = mapped_column(UnicodeText, nullable=True)
    positive_notes: Mapped[str] = mapped_column(UnicodeText, nullable=True)
    recommendations: Mapped[str] = mapped_column(UnicodeText, nullable=True)
    deductions: Mapped[str] = mapped_column(UnicodeText, nullable=True)  # JSON string của các khoản trừ
    l1_l4_summary: Mapped[str] = mapped_column(UnicodeText, nullable=True)  # JSON tổng hợp L1..L4
    bed_details: Mapped[str] = mapped_column(UnicodeText, nullable=True)    # JSON chi tiết từng vị trí B01..BP
    retake_requests: Mapped[str] = mapped_column(UnicodeText, nullable=True)  # JSON yêu cầu chụp bổ sung

    # Kết quả sau khi cán bộ duyệt đè (nếu có)
    final_status: Mapped[str] = mapped_column(Unicode(50), nullable=True)  # Dùng cái này để hiển thị
    final_score: Mapped[float] = mapped_column(Float, nullable=True)

    # Meta
    ai_response_time_ms: Mapped[int] = mapped_column(Integer, nullable=True)  # Thời gian Gemini phản hồi (ms)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Quan hệ
    submission: Mapped["Submission"] = relationship("Submission", back_populates="ai_evaluation")
