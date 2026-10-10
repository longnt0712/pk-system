-- SQL Server 2008 / 2008 R2 and later. Run before deploying the updated backend.
-- Existing profiles remain unclassified; do not infer ranks from class names.
IF OBJECT_ID(N'dbo.tbl_person', N'U') IS NULL
BEGIN
    RAISERROR('tbl_person is missing. Check the selected application database.', 16, 1);
    RETURN;
END;

IF COL_LENGTH(N'dbo.tbl_person', N'tntt_member_type') IS NULL
    ALTER TABLE dbo.tbl_person ADD tntt_member_type varchar(24) NULL;
IF COL_LENGTH(N'dbo.tbl_person', N'tntt_branch') IS NULL
    ALTER TABLE dbo.tbl_person ADD tntt_branch varchar(24) NULL;
IF COL_LENGTH(N'dbo.tbl_person', N'tntt_level') IS NULL
    ALTER TABLE dbo.tbl_person ADD tntt_level int NULL;

PRINT 'TNTT profile columns are ready. Existing profile values are preserved.';
