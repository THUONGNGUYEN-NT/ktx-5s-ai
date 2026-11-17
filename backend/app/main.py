from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.config import settings
from app.database import engine, Base

# Import models để SQLAlchemy nhận diện khi tạo bảng
from app.models import User, Room, Student, Submission, AiEvaluation  # noqa

# Import routers
from app.routers import auth, submissions, rooms, admin

# =============================================
# Khởi tạo ứng dụng FastAPI
# =============================================
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Hệ thống đánh giá vệ sinh phòng ở Ký túc xá tự động (KTX 5S AI)",
    docs_url="/docs",       # Swagger UI: http://localhost:8000/docs
    redoc_url="/redoc",
)

# =============================================
# CORS — Cho phép Frontend (React) gọi API
# =============================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],  # Port của React/Vite
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =============================================
# Static Files — Phục vụ ảnh lưu cục bộ (Local Storage)
# =============================================
upload_dir = Path("static/uploads")
upload_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(upload_dir)), name="uploads")

# =============================================
# Đăng ký các Router
# =============================================
app.include_router(auth.router,        prefix="/api/auth", tags=["Auth — Đăng nhập & Phân quyền"])
app.include_router(submissions.router, prefix="/api", tags=["Submissions — Sinh viên nộp ảnh"])
app.include_router(rooms.router,       prefix="/api", tags=["Rooms — Thông tin phòng"])
app.include_router(admin.router,       prefix="/api/admin", tags=["Admin — Cán bộ KTX"])


# =============================================
# Tạo bảng trong DB khi khởi động (nếu chưa có)
# =============================================
@app.on_event("startup")
async def startup():
    Base.metadata.create_all(bind=engine)
    print(f"✅ {settings.APP_NAME} v{settings.APP_VERSION} đang chạy!")
    print(f"📄 Tài liệu API: http://localhost:8000/docs")


# =============================================
# Giao diện Web Trực quan (Sinh viên & Cán bộ KTX)
# =============================================
@app.get("/", tags=["UI"])
async def root():
    html_file = Path(__file__).parent / "static" / "index.html"
    if html_file.exists():
        return FileResponse(str(html_file))
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "app": settings.APP_NAME}
