import logging
import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.config import settings

logger = logging.getLogger("database")

sqlite_db_path = Path(__file__).resolve().parent.parent / "ktx5s.db"

# Khởi tạo engine: Dùng SQLite để phục vụ trực tiếp tức thì, đảm bảo ổn định và dữ liệu luôn hiển thị
engine = create_engine(
    f"sqlite:///{sqlite_db_path}",
    echo=False,
    connect_args={"check_same_thread": False},
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

