import uuid
from datetime import datetime
from sqlalchemy import String, Integer, Float, Boolean, DateTime, Text, ForeignKey
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
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
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
    capacity: Mapped[int] = mapped_column(Integer, default=4)                        # Số chỗ tối đa
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
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
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

    # Duyệt đè bởi cán bộ
    is_overridden: Mapped[bool] = mapped_column(Boolean, default=False)
    override_note: Mapped[str] = mapped_column(Text, nullable=True)
    overridden_by: Mapped[str] = mapped_column(String(100), nullable=True)  # Username cán bộ
    overridden_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    # Quan hệ
    room: Mapped["Room"] = relationship("Room", back_populates="submissions")
    ai_evaluation: Mapped["AiEvaluation"] = relationship("AiEvaluation", back_populates="submission", uselist=False)


# =============================================
# BẢNG 4: ai_evaluations — Kết quả AI chấm điểm
# =============================================
class AiEvaluation(Base):
    __tablename__ = "ai_evaluations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    submission_id: Mapped[str] = mapped_column(String(36), ForeignKey("submissions.id"), unique=True, nullable=False)

    # Kết quả chính
    status: Mapped[str] = mapped_column(String(20), nullable=False)       # "Sạch" / "Hơi bừa bộn" / "Bừa bộn"
    score: Mapped[float] = mapped_column(Float, nullable=False)            # 0.0 - 10.0
    is_valid_room_photo: Mapped[bool] = mapped_column(Boolean, default=True)

    # Checklist (4 tiêu chí 5S)
    bed_tidy: Mapped[bool] = mapped_column(Boolean, nullable=True)
    floor_clean: Mapped[bool] = mapped_column(Boolean, nullable=True)
    desk_organized: Mapped[bool] = mapped_column(Boolean, nullable=True)
    shoes_arranged: Mapped[bool] = mapped_column(Boolean, nullable=True)

    # Chi tiết dạng text (lưu JSON string)
    issues_detected: Mapped[str] = mapped_column(Text, nullable=True)     # JSON array string
    positive_notes: Mapped[str] = mapped_column(Text, nullable=True)      # JSON array string
    recommendations: Mapped[str] = mapped_column(Text, nullable=True)

    # Kết quả sau khi cán bộ duyệt đè (nếu có)
    final_status: Mapped[str] = mapped_column(String(20), nullable=True)  # Dùng cái này để hiển thị
    final_score: Mapped[float] = mapped_column(Float, nullable=True)

    # Meta
    ai_response_time_ms: Mapped[int] = mapped_column(Integer, nullable=True)  # Thời gian Gemini phản hồi (ms)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Quan hệ
    submission: Mapped["Submission"] = relationship("Submission", back_populates="ai_evaluation")
