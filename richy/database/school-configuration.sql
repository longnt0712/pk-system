-- SQL Server 2008 R2+. Select the IELTSRoom application database.
-- Existing programs without a School are assigned to School 2, as approved.
-- Run before deploying the new backend. Reruns preserve later School assignments.
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
BEGIN TRY
    BEGIN TRANSACTION;
    IF OBJECT_ID(N'dbo.tbl_education_program', N'U') IS NULL
        RAISERROR(N'Expected dbo.tbl_education_program. Select the application database.',16,1);
    IF OBJECT_ID(N'dbo.tbl_school', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.tbl_school (
            id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            create_date DATETIME2 NOT NULL, created_by NVARCHAR(100) NOT NULL,
            modify_date DATETIME2 NULL, modified_by NVARCHAR(100) NULL,
            uuid_key VARCHAR(36) NULL, voided BIT NULL,
            name NVARCHAR(255) NOT NULL, domain VARCHAR(253) NOT NULL,
            active BIT NOT NULL, show_attendance BIT NOT NULL,
            CONSTRAINT uk_school_domain UNIQUE(domain)
        );
    END;
    SET IDENTITY_INSERT dbo.tbl_school ON;
    IF NOT EXISTS(SELECT 1 FROM dbo.tbl_school WHERE id=1)
        INSERT dbo.tbl_school(id,create_date,created_by,name,domain,active,show_attendance)
        VALUES(1,GETDATE(),N'school-migration',N'IELTS ROOM','ieltsroom.com',1,0);
    IF NOT EXISTS(SELECT 1 FROM dbo.tbl_school WHERE id=2)
        INSERT dbo.tbl_school(id,create_date,created_by,name,domain,active,show_attendance)
        VALUES(2,GETDATE(),N'school-migration',N'TNTT Phung Khoang','tnttphungkhoang.com',1,1);
    SET IDENTITY_INSERT dbo.tbl_school OFF;
    IF OBJECT_ID(N'dbo.tbl_school_user_role', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.tbl_school_user_role (
            school_id BIGINT NOT NULL REFERENCES dbo.tbl_school(id),
            user_id BIGINT NOT NULL REFERENCES dbo.tbl_user(id),
            role_id BIGINT NOT NULL REFERENCES dbo.tbl_role(id),
            CONSTRAINT PK_school_user_role PRIMARY KEY (school_id,user_id,role_id)
        );
        CREATE INDEX IX_school_user_role_user ON dbo.tbl_school_user_role(user_id,school_id);
    END;
    IF COL_LENGTH(N'dbo.tbl_education_program',N'school_id') IS NULL
        ALTER TABLE dbo.tbl_education_program ADD school_id BIGINT NULL;
    EXEC(N'UPDATE dbo.tbl_education_program SET school_id=2 WHERE school_id IS NULL;');
    IF EXISTS(SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.tbl_education_program') AND name=N'school_id' AND is_nullable=1)
        EXEC(N'ALTER TABLE dbo.tbl_education_program ALTER COLUMN school_id BIGINT NOT NULL;');
    IF COL_LENGTH(N'dbo.tbl_education_program',N'is_main') IS NULL
        ALTER TABLE dbo.tbl_education_program ADD is_main BIT NULL;
    IF EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.tbl_education_program') AND name=N'UX_education_program_single_main')
        DROP INDEX UX_education_program_single_main ON dbo.tbl_education_program;
    IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.tbl_education_program') AND name=N'UX_education_program_school_main')
        EXEC(N'CREATE UNIQUE INDEX UX_education_program_school_main ON dbo.tbl_education_program(school_id) WHERE is_main=1;');
    IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name=N'FK_education_program_school')
        EXEC(N'ALTER TABLE dbo.tbl_education_program WITH CHECK ADD CONSTRAINT FK_education_program_school FOREIGN KEY(school_id) REFERENCES dbo.tbl_school(id);');
    COMMIT TRANSACTION;
    PRINT 'School configuration and per-School Main are ready.';
END TRY
BEGIN CATCH
    DECLARE @SchoolConfigError NVARCHAR(2048) = ERROR_MESSAGE();
    IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
    IF OBJECT_ID(N'dbo.tbl_school', N'U') IS NOT NULL SET IDENTITY_INSERT dbo.tbl_school OFF;
    RAISERROR(N'%s',16,1,@SchoolConfigError);
END CATCH;
