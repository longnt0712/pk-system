-- SQL Server. Run in the application database after school-configuration.sql.
-- An admin chooses which roles to enable for each School after deployment.
IF OBJECT_ID(N'dbo.tbl_school_role', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.tbl_school_role (
        school_id BIGINT NOT NULL,
        role_id BIGINT NOT NULL,
        CONSTRAINT PK_school_role PRIMARY KEY (school_id, role_id),
        CONSTRAINT FK_school_role_school FOREIGN KEY (school_id) REFERENCES dbo.tbl_school(id),
        CONSTRAINT FK_school_role_role FOREIGN KEY (role_id) REFERENCES dbo.tbl_role(id)
    );
END;
