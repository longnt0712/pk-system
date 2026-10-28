-- SQL Server 2008 / 2008 R2 and later. Shared appearance for IELTS Room only.
-- Idempotent: an administrator's existing theme selection is never overwritten.
IF OBJECT_ID(N'dbo.tbl_site_theme', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.tbl_site_theme (
        domain_name varchar(100) NOT NULL PRIMARY KEY CHECK (domain_name = 'ieltsroom.com'),
        theme varchar(16) NOT NULL CHECK (theme IN ('NORMAL', 'HALLOWEEN')),
        revision bigint NOT NULL DEFAULT 0,
        modified_by nvarchar(255) NULL,
        modify_date datetime2 NULL
    );
END;

-- The unique key and serializable range lock also cover simultaneous first installs.
BEGIN TRANSACTION;
IF NOT EXISTS (SELECT 1 FROM dbo.tbl_site_theme WITH (UPDLOCK, HOLDLOCK) WHERE domain_name = 'ieltsroom.com')
    INSERT INTO dbo.tbl_site_theme (domain_name, theme, revision)
    VALUES ('ieltsroom.com', 'HALLOWEEN', 0);
COMMIT TRANSACTION;
