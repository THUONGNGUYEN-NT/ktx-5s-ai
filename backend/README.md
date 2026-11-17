# Backend — KTX 5S AI

## Yêu cầu hệ thống
- Python 3.11+
- SQL Server 2019+ (hoặc SQL Server Express — miễn phí)
- ODBC Driver 17 for SQL Server

## Cài đặt

### Bước 1: Tạo môi trường ảo Python
```bash
cd backend
python -m venv venv
venv\Scripts\activate      # Windows
```

### Bước 2: Cài thư viện
```bash
pip install -r requirements.txt
```

### Bước 3: Tạo file .env
```bash
copy .env.example .env
# Mở .env và điền DB_PASSWORD, GEMINI_API_KEY
```

### Bước 4: Tạo Database SQL Server
Mở **SQL Server Management Studio (SSMS)** → Chạy file `database_schema.sql`

### Bước 5: Chạy server
```bash
uvicorn app.main:app --reload --port 8000
```

Mở trình duyệt: http://localhost:8000/docs

## Cấu trúc thư mục
```
backend/
├── app/
│   ├── main.py          # Entry point, khởi tạo FastAPI
│   ├── config.py        # Cấu hình từ .env
│   ├── database.py      # Kết nối SQL Server
│   ├── models/          # SQLAlchemy models (4 bảng)
│   ├── schemas/         # Pydantic schemas (validate data)
│   ├── routers/         # Các endpoint API
│   └── services/        # Logic nghiệp vụ (AI, Storage...)
├── database_schema.sql  # Script tạo DB cho SQL Server
├── requirements.txt
└── .env.example
```
