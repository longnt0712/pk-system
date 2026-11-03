-- SQL Server 2008 R2+. Run before deploying the backend that reads is_main.
-- Additive and rerunnable. Existing programs are not automatically selected as Main.
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;

IF OBJECT_ID(N'dbo.tbl_education_program', N'U') IS NULL
BEGIN
    RAISERROR(N'Expected table dbo.tbl_education_program does not exist.', 16, 1);
    RETURN;
END;

BEGIN TRY
    BEGIN TRANSACTION;
    IF COL_LENGTH(N'dbo.tbl_education_program', N'is_main') IS NULL
        ALTER TABLE dbo.tbl_education_program ADD is_main bit NULL;

    IF COL_LENGTH(N'dbo.tbl_education_program', N'school_id') IS NULL
       AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.tbl_education_program') AND name = N'UX_education_program_single_main')
        EXEC(N'CREATE UNIQUE INDEX UX_education_program_single_main ON dbo.tbl_education_program(is_main) WHERE is_main = 1;');
    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    DECLARE @message nvarchar(4000) = ERROR_MESSAGE();
    RAISERROR(@message, 16, 1);
END CATCH;
