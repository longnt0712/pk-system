-- Linux runs with ddl-auto=none. Add only the nullable appearance column;
-- preserve School IDs, domains, memberships and all existing choices.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID(N'dbo.tbl_school', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.tbl_school', N'site_theme') IS NULL
    ALTER TABLE dbo.tbl_school ADD site_theme varchar(16) NULL;
COMMIT TRANSACTION;
