-- SQL Server 2008 / 2008 R2 and later. Run before deploying the updated backend.
-- Shared schedule; existing attendance rows are not changed.
IF OBJECT_ID(N'dbo.tbl_attendance_config', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.tbl_attendance_config (
        id int NOT NULL PRIMARY KEY CHECK (id = 1),
        mass_start_time varchar(5) NOT NULL,
        mass_late_minutes int NOT NULL,
        mass_auto_late bit NOT NULL,
        class_start_time varchar(5) NOT NULL,
        class_late_minutes int NOT NULL,
        class_auto_late bit NOT NULL,
        qr_switch_time varchar(5) NOT NULL,
        modified_by nvarchar(255) NULL,
        modify_date datetime2 NULL
    );
END;

IF NOT EXISTS (SELECT 1 FROM dbo.tbl_attendance_config WHERE id = 1)
    INSERT INTO dbo.tbl_attendance_config
        (id, mass_start_time, mass_late_minutes, mass_auto_late,
         class_start_time, class_late_minutes, class_auto_late, qr_switch_time)
    VALUES (1, '08:00', 5, 1, '09:00', 15, 0, '09:00');
