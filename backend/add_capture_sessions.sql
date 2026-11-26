-- =============================================
-- KTX 5S AI — Migration bổ sung bảng Capture Sessions & giường tầng + 4 khu vực chung
-- Chạy script này trên SQL Server nếu DB đã tồn tại từ trước
-- =============================================
USE [ktx5s_db];
GO

IF COL_LENGTH('dbo.rooms', 'bed_count') IS NULL
    ALTER TABLE dbo.rooms ADD bed_count INT NULL;
GO

IF COL_LENGTH('dbo.submissions', 'capture_session_id') IS NULL
    ALTER TABLE dbo.submissions ADD capture_session_id NVARCHAR(36) NULL;
IF COL_LENGTH('dbo.submissions', 'student_code') IS NULL
    ALTER TABLE dbo.submissions ADD student_code NVARCHAR(20) NULL;
IF COL_LENGTH('dbo.submissions', 'fraud_flag') IS NULL
    ALTER TABLE dbo.submissions ADD fraud_flag BIT NOT NULL DEFAULT 0;
IF COL_LENGTH('dbo.submissions', 'assessment_category') IS NULL
    ALTER TABLE dbo.submissions ADD assessment_category NVARCHAR(60) NULL;
GO

IF COL_LENGTH('dbo.submission_photos', 'slot_code') IS NULL
    ALTER TABLE dbo.submission_photos ADD slot_code NVARCHAR(32) NULL;
IF COL_LENGTH('dbo.submission_photos', 'slot_label') IS NULL
    ALTER TABLE dbo.submission_photos ADD slot_label NVARCHAR(120) NULL;
IF COL_LENGTH('dbo.submission_photos', 'image_hash') IS NULL
    ALTER TABLE dbo.submission_photos ADD image_hash NVARCHAR(64) NULL;
GO

IF COL_LENGTH('dbo.ai_evaluations', 'l1_l4_summary') IS NULL
    ALTER TABLE dbo.ai_evaluations ADD l1_l4_summary NVARCHAR(MAX) NULL;
IF COL_LENGTH('dbo.ai_evaluations', 'bed_details') IS NULL
    ALTER TABLE dbo.ai_evaluations ADD bed_details NVARCHAR(MAX) NULL;
IF COL_LENGTH('dbo.ai_evaluations', 'retake_requests') IS NULL
    ALTER TABLE dbo.ai_evaluations ADD retake_requests NVARCHAR(MAX) NULL;
GO

IF OBJECT_ID(N'dbo.capture_sessions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.capture_sessions (
        id                  NVARCHAR(36)  PRIMARY KEY DEFAULT NEWID(),
        room_id             NVARCHAR(36)  NOT NULL REFERENCES dbo.rooms(id),
        room_code           NVARCHAR(20)  NOT NULL,
        student_code        NVARCHAR(50)  NULL,
        week                NVARCHAR(10)  NOT NULL,
        bed_count           INT           NOT NULL DEFAULT 4,
        total_required      INT           NOT NULL DEFAULT 8,
        qr_verified         BIT           NOT NULL DEFAULT 0,
        qr_token            NVARCHAR(100) NULL,
        challenge_slot_code NVARCHAR(32)  NULL,
        challenge_prompt    NVARCHAR(MAX) NULL,
        audit_required      BIT           NOT NULL DEFAULT 0,
        status              NVARCHAR(30)  NOT NULL DEFAULT 'in_progress',
        created_at          DATETIME2     NOT NULL DEFAULT GETDATE(),
        expires_at          DATETIME2     NOT NULL
    );
END;
GO

IF OBJECT_ID(N'dbo.capture_session_photos', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.capture_session_photos (
        id                  NVARCHAR(36)  PRIMARY KEY DEFAULT NEWID(),
        session_id          NVARCHAR(36)  NOT NULL REFERENCES dbo.capture_sessions(id) ON DELETE CASCADE,
        slot_code           NVARCHAR(32)  NOT NULL,
        slot_group          NVARCHAR(20)  NOT NULL,
        slot_label          NVARCHAR(120) NOT NULL,
        image_url           NVARCHAR(500) NOT NULL,
        image_hash          NVARCHAR(64)  NULL,
        width               INT           NULL,
        height              INT           NULL,
        brightness          FLOAT         NULL,
        blur_score          FLOAT         NULL,
        captured_via_camera BIT           NOT NULL DEFAULT 1,
        captured_at_server  DATETIME2     NOT NULL DEFAULT GETDATE(),
        validation_status   NVARCHAR(30)  NOT NULL DEFAULT 'passed',
        validation_reason   NVARCHAR(MAX) NULL
    );
END;
GO
