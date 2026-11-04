-- SQL Server 2008 R2+. Run after class-teaching-pdf.sql in the IELTSRoom database, before deploying the JAR.
SET XACT_ABORT ON;

IF OBJECT_ID(N'dbo.tbl_class_teaching_pdf', N'U') IS NULL
BEGIN
    RAISERROR('Run class-teaching-pdf.sql first.', 16, 1);
    RETURN;
END;

BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.tbl_class_teaching_pdf_folder', N'U') IS NULL
    CREATE TABLE dbo.tbl_class_teaching_pdf_folder (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        owner_id BIGINT NOT NULL REFERENCES dbo.tbl_user(id),
        parent_id VARCHAR(36) NULL,
        name NVARCHAR(200) NOT NULL,
        CONSTRAINT uq_teaching_pdf_folder_owner_id UNIQUE (owner_id, id),
        CONSTRAINT uq_teaching_pdf_folder_sibling UNIQUE (owner_id, parent_id, name),
        CONSTRAINT fk_teaching_pdf_folder_parent FOREIGN KEY (owner_id, parent_id)
            REFERENCES dbo.tbl_class_teaching_pdf_folder (owner_id, id)
    );

IF COL_LENGTH(N'dbo.tbl_class_teaching_pdf', N'folder_id') IS NULL
    ALTER TABLE dbo.tbl_class_teaching_pdf ADD folder_id VARCHAR(36) NULL;

IF OBJECT_ID(N'dbo.fk_teaching_pdf_folder', N'F') IS NULL
    EXEC(N'ALTER TABLE dbo.tbl_class_teaching_pdf WITH CHECK ADD CONSTRAINT fk_teaching_pdf_folder
        FOREIGN KEY (owner_id, folder_id) REFERENCES dbo.tbl_class_teaching_pdf_folder (owner_id, id)');

COMMIT TRANSACTION;
