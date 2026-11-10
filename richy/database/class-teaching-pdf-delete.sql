-- Run after class-teaching-pdf-folders.sql in the IELTSRoom SQL Server database.
SET XACT_ABORT ON;

IF COL_LENGTH(N'dbo.tbl_class_teaching_pdf', N'folder_id') IS NULL
BEGIN
    RAISERROR('Run class-teaching-pdf-folders.sql first.', 16, 1);
    RETURN;
END;

IF COL_LENGTH(N'dbo.tbl_class_teaching_pdf', N'library_deleted') IS NULL
    ALTER TABLE dbo.tbl_class_teaching_pdf ADD library_deleted BIT NOT NULL
        CONSTRAINT df_class_teaching_pdf_library_deleted DEFAULT (0);
