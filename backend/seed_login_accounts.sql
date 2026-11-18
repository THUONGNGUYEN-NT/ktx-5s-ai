USE [ktx5s_db];
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID(N'dbo.users', N'U') IS NULL
    OR OBJECT_ID(N'dbo.students', N'U') IS NULL
    OR OBJECT_ID(N'dbo.rooms', N'U') IS NULL
BEGIN
    THROW 50001, N'Database cần có đủ ba bảng dbo.users, dbo.students và dbo.rooms.', 1;
END;

DECLARE @accounts TABLE (
    username      NVARCHAR(20)  PRIMARY KEY,
    full_name     NVARCHAR(100) NOT NULL,
    role          NVARCHAR(20)  NOT NULL,
    password_hash NVARCHAR(255) NOT NULL,
    room_code     NVARCHAR(20)  NULL
);

INSERT INTO @accounts
    (username, full_name, role, password_hash, room_code)
VALUES
    (
        N'canbo_demo', N'Cán bộ demo', N'admin',
        N'a20534b5749e7cb2077b4fc0043581b7:b2ccbb16f2dcd4909aec0b65425c1ae78d41b9e09d51a7f18c748ea91cb27c5c',
        NULL
    ),
    (
        N'sv_demo_101', N'Sinh viên demo 101', N'student',
        N'ff6e0d59ca5e3cf527955fc510a2ecc1:a8e910fddcae6360f34dfa1ec1bd9128eb01b6523ca28d4e0e7e8ad3a8455801',
        N'A1-101'
    ),
    (
        N'sv_demo_102', N'Sinh viên demo 102', N'student',
        N'b1578e8f684cbaba24a3bd853ac184ff:86f979dfa830638526b92f198a687f6d35328717fd1aba9eaf911482962c340d',
        N'A1-102'
    ),
    (
        N'sv_demo_201', N'Sinh viên demo 201', N'student',
        N'42297c655454b1fed8b559b95b1d457b:e63840753d54092f0a76a1ba4b080d8967052855ba9045840747da0a4b68e997',
        N'A2-201'
    );

BEGIN TRY
    BEGIN TRANSACTION;

    IF EXISTS (
        SELECT 1
        FROM @accounts AS a
        LEFT JOIN dbo.rooms AS r
            ON r.room_code = a.room_code
            AND r.is_active = 1
        WHERE a.role = N'student'
            AND r.id IS NULL
    )
    BEGIN
        THROW 50002, N'Một phòng mẫu chưa tồn tại hoặc đang bị khóa. Kiểm tra A1-101, A1-102 và A2-201.', 1;
    END;

    IF EXISTS (
        SELECT 1
        FROM @accounts AS a
        JOIN dbo.users AS u WITH (UPDLOCK, HOLDLOCK)
            ON u.username = a.username
        WHERE u.role <> a.role
    )
    BEGIN
        THROW 50003, N'Trùng tên với tài khoản có vai trò khác. Hãy đổi tên tài khoản mẫu.', 1;
    END;

    INSERT INTO dbo.users
        (id, username, password_hash, full_name, role, is_active, created_at)
    SELECT
        CONVERT(NVARCHAR(36), NEWID()),
        a.username,
        a.password_hash,
        a.full_name,
        a.role,
        1,
        SYSUTCDATETIME()
    FROM @accounts AS a
    WHERE NOT EXISTS (
        SELECT 1
        FROM dbo.users AS u WITH (UPDLOCK, HOLDLOCK)
        WHERE u.username = a.username
    );

    INSERT INTO dbo.students
        (id, student_code, full_name, room_id, is_active, created_at)
    SELECT
        CONVERT(NVARCHAR(36), NEWID()),
        a.username,
        a.full_name,
        r.id,
        1,
        SYSUTCDATETIME()
    FROM @accounts AS a
    JOIN dbo.rooms AS r
        ON r.room_code = a.room_code
        AND r.is_active = 1
    WHERE a.role = N'student'
        AND NOT EXISTS (
            SELECT 1
            FROM dbo.students AS s WITH (UPDLOCK, HOLDLOCK)
            WHERE s.student_code = a.username
        );

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0
        ROLLBACK TRANSACTION;

    THROW;
END CATCH;

SELECT
    u.username,
    u.full_name,
    u.role,
    u.is_active AS account_active,
    r.room_code,
    s.is_active AS student_active,
    r.is_active AS room_active
FROM dbo.users AS u
LEFT JOIN dbo.students AS s
    ON u.role = N'student'
    AND s.student_code = u.username
LEFT JOIN dbo.rooms AS r
    ON r.id = s.room_id
ORDER BY u.role, u.username;