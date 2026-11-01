-- Additive migration for SQL Server 2008 R2+. Run on the application database before enabling the feature.
SET XACT_ABORT ON;
BEGIN TRY
 BEGIN TRANSACTION;
 IF OBJECT_ID(N'dbo.tbl_tntt_document_entry',N'U') IS NULL
 CREATE TABLE dbo.tbl_tntt_document_entry (
  id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  create_date DATETIME2 NOT NULL,created_by NVARCHAR(100) NOT NULL,modify_date DATETIME2 NULL,modified_by NVARCHAR(100) NULL,uuid_key VARCHAR(36) NULL,voided BIT NULL,
  title NVARCHAR(200) NOT NULL,kind VARCHAR(20) NOT NULL,parent_id BIGINT NULL,creator_id BIGINT NOT NULL,editor_id BIGINT NOT NULL,updated_at BIGINT NOT NULL,
  archived BIT NOT NULL DEFAULT(0),shared BIT NOT NULL DEFAULT(0),notice_id BIGINT NULL,notebook_json NVARCHAR(MAX) NULL,revision BIGINT NOT NULL DEFAULT(0),
  CONSTRAINT fk_tntt_document_parent FOREIGN KEY(parent_id) REFERENCES dbo.tbl_tntt_document_entry(id)
 );
 IF OBJECT_ID(N'dbo.tbl_tntt_document_notice',N'U') IS NULL
 CREATE TABLE dbo.tbl_tntt_document_notice (
  id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  create_date DATETIME2 NOT NULL,created_by NVARCHAR(100) NOT NULL,modify_date DATETIME2 NULL,modified_by NVARCHAR(100) NULL,uuid_key VARCHAR(36) NULL,voided BIT NULL,
  entry_id BIGINT NOT NULL,request_key VARCHAR(36) NOT NULL,title NVARCHAR(200) NOT NULL,summary NVARCHAR(1000) NULL,starts_at BIGINT NOT NULL,ends_at BIGINT NOT NULL,published_at BIGINT NOT NULL,publisher_id BIGINT NOT NULL,disabled BIT NOT NULL DEFAULT(0),notebook_json NVARCHAR(MAX) NULL,
  CONSTRAINT uk_tntt_notice_request UNIQUE(request_key),CONSTRAINT fk_tntt_notice_entry FOREIGN KEY(entry_id) REFERENCES dbo.tbl_tntt_document_entry(id)
 );
 IF OBJECT_ID(N'dbo.tbl_tntt_document_recipient',N'U') IS NULL
 CREATE TABLE dbo.tbl_tntt_document_recipient (
  id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  create_date DATETIME2 NOT NULL,created_by NVARCHAR(100) NOT NULL,modify_date DATETIME2 NULL,modified_by NVARCHAR(100) NULL,uuid_key VARCHAR(36) NULL,voided BIT NULL,
  notice_id BIGINT NOT NULL,user_id BIGINT NOT NULL,read_at BIGINT NULL,email NVARCHAR(250) NULL,email_status VARCHAR(24) NOT NULL,email_error NVARCHAR(500) NULL,email_sent_at BIGINT NULL,revision BIGINT NOT NULL DEFAULT(0),
  CONSTRAINT uk_tntt_notice_user UNIQUE(notice_id,user_id),CONSTRAINT fk_tntt_recipient_notice FOREIGN KEY(notice_id) REFERENCES dbo.tbl_tntt_document_notice(id)
 );
 IF OBJECT_ID(N'dbo.tbl_tntt_document_version',N'U') IS NULL
 CREATE TABLE dbo.tbl_tntt_document_version (
  id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  create_date DATETIME2 NOT NULL,created_by NVARCHAR(100) NOT NULL,modify_date DATETIME2 NULL,modified_by NVARCHAR(100) NULL,uuid_key VARCHAR(36) NULL,voided BIT NULL,
  entry_id BIGINT NOT NULL,entry_revision BIGINT NOT NULL,actor_id BIGINT NOT NULL,saved_at BIGINT NOT NULL,title NVARCHAR(200) NOT NULL,notebook_json NVARCHAR(MAX) NULL,
  CONSTRAINT fk_tntt_version_entry FOREIGN KEY(entry_id) REFERENCES dbo.tbl_tntt_document_entry(id)
 );
 IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='ix_tntt_recipient_user' AND object_id=OBJECT_ID('dbo.tbl_tntt_document_recipient'))
  CREATE INDEX ix_tntt_recipient_user ON dbo.tbl_tntt_document_recipient(user_id,notice_id) INCLUDE(read_at,email_status);
 IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='ix_tntt_version_entry' AND object_id=OBJECT_ID('dbo.tbl_tntt_document_version'))
  CREATE INDEX ix_tntt_version_entry ON dbo.tbl_tntt_document_version(entry_id,id);
 COMMIT TRANSACTION;
END TRY
BEGIN CATCH
 DECLARE @TnttDocumentError NVARCHAR(2048);SET @TnttDocumentError=ERROR_MESSAGE();
 IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
 RAISERROR(N'%s',16,1,@TnttDocumentError);
END CATCH;
