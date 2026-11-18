USE [ktx5s_db];
GO

SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.submission_photos', N'U') IS NULL
BEGIN
    DECLARE @id_type NVARCHAR(20);

    SELECT @id_type = CASE
        WHEN c.system_type_id = 167 AND c.max_length = 36 THEN N'VARCHAR(36)'
        WHEN c.system_type_id = 231 AND c.max_length = 72 THEN N'NVARCHAR(36)'
        WHEN c.system_type_id = 36 THEN N'UNIQUEIDENTIFIER'
    END
    FROM sys.columns AS c
    WHERE c.object_id = OBJECT_ID(N'dbo.submissions', N'U')
      AND c.name = N'id';

    IF @id_type IS NULL
        THROW 50010, N'Không tìm thấy dbo.submissions.id với kiểu dữ liệu được hỗ trợ.', 1;

    DECLARE @sql NVARCHAR(MAX) = N'
        CREATE TABLE dbo.submission_photos (
            submission_id ' + @id_type + N' NOT NULL,
            position INT NOT NULL,
            image_url NVARCHAR(500) NOT NULL,
            CONSTRAINT PK_submission_photos PRIMARY KEY (submission_id, position),
            CONSTRAINT FK_submission_photos_submission FOREIGN KEY (submission_id)
                REFERENCES dbo.submissions(id) ON DELETE CASCADE
        );';

    EXEC sys.sp_executesql @sql;
END;

SELECT N'dbo.submission_photos đã sẵn sàng.' AS ket_qua;
