-- SQL Server. Run in the application database after school-configuration.sql.
-- An admin chooses which roles to enable for each School after deployment.
SET XACT_ABORT ON;

BEGIN TRANSACTION;
IF OBJECT_ID(N'dbo.tbl_school_role', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.tbl_school_role (
        school_id BIGINT NOT NULL,
        role_id BIGINT NOT NULL,
        CONSTRAINT PK_school_role PRIMARY KEY (school_id, role_id),
        CONSTRAINT FK_school_role_school FOREIGN KEY (school_id) REFERENCES dbo.tbl_school(id),
        CONSTRAINT FK_school_role_role FOREIGN KEY (role_id) REFERENCES dbo.tbl_role(id) ON DELETE CASCADE
    );
END
ELSE IF EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE parent_object_id = OBJECT_ID(N'dbo.tbl_school_role')
        AND name = N'FK_school_role_role' AND delete_referential_action = 0
)
BEGIN
    ALTER TABLE dbo.tbl_school_role DROP CONSTRAINT FK_school_role_role;
    ALTER TABLE dbo.tbl_school_role WITH CHECK ADD CONSTRAINT FK_school_role_role
        FOREIGN KEY (role_id) REFERENCES dbo.tbl_role(id) ON DELETE CASCADE;
END;
COMMIT TRANSACTION;
