-- SQL Server 2008 R2+. Run in the IELTSRoom application database before deploying the JAR.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.tbl_class_teaching_pdf', N'U') IS NULL
    CREATE TABLE dbo.tbl_class_teaching_pdf (
        id VARCHAR(36) PRIMARY KEY,
        owner_id BIGINT NOT NULL REFERENCES dbo.tbl_user(id),
        name NVARCHAR(255) NOT NULL,
        content VARBINARY(MAX) NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );

IF OBJECT_ID(N'dbo.tbl_class_teaching_pdf_run', N'U') IS NULL
    CREATE TABLE dbo.tbl_class_teaching_pdf_run (
        id VARCHAR(36) PRIMARY KEY,
        class_id BIGINT NOT NULL REFERENCES dbo.tbl_enrolment_class(id),
        pdf_id VARCHAR(36) NOT NULL REFERENCES dbo.tbl_class_teaching_pdf(id),
        revision INT NOT NULL DEFAULT 0,
        completed BIT NOT NULL DEFAULT 0,
        progress NVARCHAR(MAX) NULL
    );

IF OBJECT_ID(N'dbo.tbl_class_teaching_pdf_day', N'U') IS NULL
    CREATE TABLE dbo.tbl_class_teaching_pdf_day (
        day_id BIGINT NOT NULL REFERENCES dbo.tbl_enrolment_class_schedule_day(id) ON DELETE CASCADE,
        run_id VARCHAR(36) NOT NULL REFERENCES dbo.tbl_class_teaching_pdf_run(id),
        PRIMARY KEY (day_id, run_id)
    );

COMMIT TRANSACTION;
