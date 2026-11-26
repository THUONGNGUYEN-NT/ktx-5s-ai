from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.config import settings
from app.database import engine, Base

# Import models để SQLAlchemy nhận diện khi tạo bảng
from app.models import User, Room, Student, Submission, AiEvaluation, CaptureSession, CaptureSessionPhoto  # noqa

# Import routers
from app.routers import auth, submissions, rooms, admin, capture_sessions

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
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:8000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:8000",
        "http://localhost:5173",
        "https://thuongnguyen-nt.github.io",
    ],
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
app.include_router(auth.router,             prefix="/api/auth", tags=["Auth — Đăng nhập & Phân quyền"])
app.include_router(submissions.router,      prefix="/api", tags=["Submissions — Sinh viên nộp ảnh"])
app.include_router(capture_sessions.router, prefix="/api", tags=["Capture Sessions — Phiên chụp 7 lớp"])
app.include_router(rooms.router,            prefix="/api", tags=["Rooms — Thông tin phòng"])
app.include_router(admin.router,            prefix="/api/admin", tags=["Admin — Cán bộ KTX"])


# =============================================
# Tạo bảng và Khởi tạo đầy đủ 200 phòng KTX khi khởi động
# =============================================
@app.on_event("startup")
async def startup():
    try:
        Base.metadata.create_all(bind=engine)
        from app.database import SessionLocal
        from app.models import Room, Student, User
        from app.services.auth_service import hash_password

        with SessionLocal() as db:
            room_count = db.query(Room).count()
            if room_count < 200:
                print(f"📦 Đang khởi tạo danh mục đầy đủ 200 phòng KTX (4 tòa A-D × 10 tầng)...")
                buildings = ["A", "B", "C", "D"]
                floors = 10
                rooms_per_floor = 5

                for b in buildings:
                    for f in range(1, floors + 1):
                        for r in range(1, rooms_per_floor + 1):
                            code = f"{b}{f}-{f}{r:02d}"
                            exists = db.query(Room).filter(Room.room_code == code).first()
                            if not exists:
                                room = Room(
                                    room_code=code,
                                    building=b,
                                    floor=f,
                                    room_number=f"{f}{r:02d}",
                                    capacity=4 if (f + r) % 2 == 0 else 6,
                                    is_active=True,
                                )
                                db.add(room)
                                db.flush()
                                student = Student(
                                    student_code=f"sv_{code.lower().replace('-', '_')}",
                                    full_name=f"Sinh viên phòng {code}",
                                    room_id=room.id,
                                    phone=f"09{f:02d}{r:02d}8888",
                                    is_active=True,
                                )
                                db.add(student)
                db.commit()
                print(f"✅ Đã khởi tạo thành công 200 phòng KTX vào cơ sở dữ liệu!")
    except Exception as e:
        print(f"⚠️ Warning startup: {e}")
    print(f"✅ {settings.APP_NAME} v{settings.APP_VERSION} đang chạy!")
    print(f"📄 Tài liệu API: http://localhost:8000/docs")


# =============================================
# Giao diện Web Trực quan (Sinh viên & Cán bộ KTX)
# =============================================
@app.get("/legacy-ui", tags=["UI"])
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


# Phục vụ giao diện Next.js tĩnh ngay trên cổng 8000 (gộp chung 1 cổng)
static_site_dir = Path(__file__).parent / "static_site"
if static_site_dir.exists():
    app.mount("/", StaticFiles(directory=str(static_site_dir), html=True), name="frontend_site")
