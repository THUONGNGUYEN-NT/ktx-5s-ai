from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.config import settings

# Tạo engine kết nối SQL Server
engine = create_engine(
    settings.DATABASE_URL,
    echo=False,                # Tắt log SQL để console gọn gàng, dễ theo dõi lỗi thực tế
    pool_pre_ping=True,        # Tự kiểm tra kết nối trước khi dùng
    pool_size=10,
    max_overflow=20,
)

# Session factory — dùng để tương tác với DB
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# Base class cho tất cả Model
class Base(DeclarativeBase):
    pass


# Dependency — FastAPI inject session vào từng request
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
