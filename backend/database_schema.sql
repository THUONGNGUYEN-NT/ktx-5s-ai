-- =============================================
-- KTX 5S AI — Script tạo Database SQL Server
-- Chạy script này trong SQL Server Management Studio (SSMS)
-- =============================================

-- Bước 1: Tạo Database mới
CREATE DATABASE ktx5s_db;
GO

USE ktx5s_db;
GO

-- =============================================
-- BẢNG 0: users — Quản lý tài khoản & phân quyền
-- =============================================
CREATE TABLE users (
    id            NVARCHAR(36)  PRIMARY KEY DEFAULT NEWID(),
    username      NVARCHAR(50)  NOT NULL UNIQUE,
    password_hash NVARCHAR(255) NOT NULL,
    full_name     NVARCHAR(100) NOT NULL,
    role          NVARCHAR(20)  NOT NULL DEFAULT 'admin', -- 'admin' hoặc 'student'
    is_active     BIT           NOT NULL DEFAULT 1,
    created_at    DATETIME2     NOT NULL DEFAULT GETDATE()
);
GO

-- =============================================
-- BẢNG 1: rooms — Danh sách phòng KTX
-- =============================================
CREATE TABLE rooms (
    id           NVARCHAR(36)  PRIMARY KEY DEFAULT NEWID(),
    room_code    NVARCHAR(20)  NOT NULL UNIQUE,   -- VD: 'A3-205'
    building     NVARCHAR(10)  NOT NULL,           -- VD: 'A'
    floor        INT           NOT NULL,           -- VD: 3
    room_number  NVARCHAR(10)  NOT NULL,           -- VD: '205'
    capacity     INT           NOT NULL DEFAULT 4,
    qr_code_url  NVARCHAR(500) NULL,
    is_active    BIT           NOT NULL DEFAULT 1,
    created_at   DATETIME2     NOT NULL DEFAULT GETDATE()
);
GO

-- =============================================
-- BẢNG 2: students — Danh sách sinh viên
-- =============================================
CREATE TABLE students (
    id            NVARCHAR(36)  PRIMARY KEY DEFAULT NEWID(),
    student_code  NVARCHAR(20)  NOT NULL UNIQUE,
    full_name     NVARCHAR(100) NOT NULL,
    room_id       NVARCHAR(36)  NULL REFERENCES rooms(id),
    phone         NVARCHAR(15)  NULL,
    is_active     BIT           NOT NULL DEFAULT 1,
    created_at    DATETIME2     NOT NULL DEFAULT GETDATE()
);
GO

-- =============================================
-- BẢNG 3: submissions — Lượt nộp ảnh của từng phòng
-- =============================================
CREATE TABLE submissions (
    id              NVARCHAR(36)  PRIMARY KEY DEFAULT NEWID(),
    room_id         NVARCHAR(36)  NOT NULL REFERENCES rooms(id),
    week            NVARCHAR(10)  NOT NULL,         -- VD: '2026-W47'
    image_url       NVARCHAR(500) NOT NULL,
    image_size_kb   INT           NULL,
    captured_at     DATETIME2     NOT NULL,          -- Thời gian chụp từ client
    submitted_at    DATETIME2     NOT NULL DEFAULT GETDATE(),

    -- Duyệt đè bởi cán bộ
    is_overridden   BIT           NOT NULL DEFAULT 0,
    override_note   NVARCHAR(MAX) NULL,
    overridden_by   NVARCHAR(100) NULL,
    overridden_at   DATETIME2     NULL,

    -- Mỗi phòng chỉ được nộp 1 lần mỗi tuần
    CONSTRAINT UQ_room_week UNIQUE (room_id, week)
);
GO

-- =============================================
-- BẢNG 4: ai_evaluations — Kết quả AI chấm điểm
-- =============================================
CREATE TABLE ai_evaluations (
    id                   NVARCHAR(36) PRIMARY KEY DEFAULT NEWID(),
    submission_id        NVARCHAR(36) NOT NULL UNIQUE REFERENCES submissions(id),

    -- Kết quả chính từ AI
    status               NVARCHAR(20)  NOT NULL,  -- 'Sạch' / 'Hơi bừa bộn' / 'Bừa bộn'
    score                DECIMAL(4,1)  NOT NULL,  -- 0.0 - 10.0
    is_valid_room_photo  BIT           NOT NULL DEFAULT 1,

    -- Checklist 4 tiêu chí 5S
    bed_tidy             BIT           NULL,
    floor_clean          BIT           NULL,
    desk_organized       BIT           NULL,
    shoes_arranged       BIT           NULL,

    -- Chi tiết (lưu dạng JSON string)
    issues_detected      NVARCHAR(MAX) NULL,  -- JSON: ["lỗi 1", "lỗi 2"]
    positive_notes       NVARCHAR(MAX) NULL,  -- JSON: ["điểm tốt 1"]
    recommendations      NVARCHAR(MAX) NULL,

    -- Kết quả cuối (sau khi cán bộ duyệt đè, nếu có)
    final_status         NVARCHAR(20)  NULL,
    final_score          DECIMAL(4,1)  NULL,

    -- Hiệu năng
    ai_response_time_ms  INT           NULL,
    created_at           DATETIME2     NOT NULL DEFAULT GETDATE()
);
GO

-- =============================================
-- INDEX — Tối ưu tốc độ truy vấn
-- =============================================
CREATE INDEX IX_submissions_room_week    ON submissions (room_id, week);
CREATE INDEX IX_submissions_submitted_at ON submissions (submitted_at);
CREATE INDEX IX_ai_eval_status           ON ai_evaluations (status);
CREATE INDEX IX_ai_eval_score            ON ai_evaluations (score);
GO

-- =============================================
-- DỮ LIỆU MẪU — Thêm 5 phòng để test
-- =============================================
INSERT INTO rooms (room_code, building, floor, room_number) VALUES
('A1-101', 'A', 1, '101'),
('A1-102', 'A', 1, '102'),
('A2-201', 'A', 2, '201'),
('B1-101', 'B', 1, '101'),
('B2-305', 'B', 3, '305');
GO

PRINT '✅ Database KTX 5S AI đã được tạo thành công!';
