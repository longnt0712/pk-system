-- SQL Server 2008 R2 and later. Run in the application database BEFORE starting
-- the updated backend. Re-running this migration leaves existing versions intact.
-- NULL is intentional for existing users; application security changes rotate it.
IF OBJECT_ID(N'dbo.tbl_user', N'U') IS NULL
BEGIN
    RAISERROR('tbl_user is missing. Select the application database first.', 16, 1);
    RETURN;
END;

IF COL_LENGTH(N'dbo.tbl_user', N'auth_version') IS NULL
BEGIN
    ALTER TABLE dbo.tbl_user ADD auth_version varchar(36) NULL;
END;
