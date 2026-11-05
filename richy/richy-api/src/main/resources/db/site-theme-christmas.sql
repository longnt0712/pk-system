-- SQL Server 2008+; expand only the two known legacy theme checks.
-- Install the new domain/value guard before removing legacy guards, in one
-- transaction. Do not change any saved theme, revision or audit information.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID(N'dbo.tbl_site_theme', N'U') IS NOT NULL
BEGIN
    DECLARE @rows bigint;
    SELECT @rows = COUNT_BIG(*) FROM dbo.tbl_site_theme WITH (TABLOCKX, HOLDLOCK);
    IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID(N'dbo.tbl_site_theme') AND name = N'CK_tbl_site_theme_choice_v2')
        ALTER TABLE dbo.tbl_site_theme WITH CHECK ADD CONSTRAINT CK_tbl_site_theme_choice_v2
            CHECK (domain_name = 'ieltsroom.com' AND theme IN ('NORMAL', 'HALLOWEEN', 'CHRISTMAS'));

    DECLARE @drop nvarchar(max);
    SET @drop = N'';
    SELECT @drop = @drop + N'ALTER TABLE dbo.tbl_site_theme DROP CONSTRAINT ' + QUOTENAME(name) + N';'
    FROM sys.check_constraints
    CROSS APPLY (SELECT LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(definition, N'[', N''), N']', N''), N'(', N''), N')', N''), N' ', N''), CHAR(9), N''), CHAR(10), N''), CHAR(13), N'')) AS normalized) AS legacy
    WHERE parent_object_id = OBJECT_ID(N'dbo.tbl_site_theme')
        AND name <> N'CK_tbl_site_theme_choice_v2'
        AND normalized IN (
            N'themein''normal'',''halloween''',
            N'themein''halloween'',''normal''',
            N'theme=''normal''ortheme=''halloween''',
            N'theme=''halloween''ortheme=''normal''',
            N'domain_name=''ieltsroom.com''andthemein''normal'',''halloween''',
            N'domain_name=''ieltsroom.com''andthemein''halloween'',''normal''',
            N'domain_name=''ieltsroom.com''andtheme=''normal''ortheme=''halloween''',
            N'domain_name=''ieltsroom.com''andtheme=''halloween''ortheme=''normal'''
        );
    IF LEN(@drop) > 0 EXEC sp_executesql @drop;
END;
COMMIT TRANSACTION;
