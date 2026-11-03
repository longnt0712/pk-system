-- Run after tntt-documents.sql and before updating the backend.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF COL_LENGTH(N'dbo.tbl_tntt_document_entry', N'public_view_token') IS NULL
    ALTER TABLE dbo.tbl_tntt_document_entry ADD public_view_token VARCHAR(32) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_tntt_document_public_view_token'
    AND object_id = OBJECT_ID(N'dbo.tbl_tntt_document_entry'))
    EXEC(N'CREATE INDEX ix_tntt_document_public_view_token ON dbo.tbl_tntt_document_entry(public_view_token)');
COMMIT TRANSACTION;
