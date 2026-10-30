-- SQL Server 2008 R2 (10.50) and later. Run the whole script in the application database.
-- Run speaking-studio.sql and speaking-student-answers.sql first, then this migration BEFORE the new JAR.
-- Adds shared question notebooks and answer checkpoints; current answers/samples/Pass/results are preserved.
SET XACT_ABORT ON;
BEGIN TRY
    BEGIN TRANSACTION;

    IF OBJECT_ID(N'dbo.tbl_speaking_student_answer', N'U') IS NULL
        RAISERROR('Speaking student answers are missing. Select the application database and run speaking-student-answers.sql first.',16,1);

    IF COL_LENGTH(N'dbo.tbl_speaking_student_answer', N'notebook_json') IS NULL
        ALTER TABLE dbo.tbl_speaking_student_answer ADD notebook_json NVARCHAR(MAX) NULL;
    IF COL_LENGTH(N'dbo.tbl_speaking_student_answer', N'notebook_revision') IS NULL
        ALTER TABLE dbo.tbl_speaking_student_answer ADD notebook_revision BIGINT NOT NULL
            CONSTRAINT df_speaking_answer_notebook_revision DEFAULT(0) WITH VALUES;

    IF OBJECT_ID(N'dbo.tbl_speaking_answer_version', N'U') IS NULL
    CREATE TABLE dbo.tbl_speaking_answer_version (
        id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        create_date DATETIME2 NOT NULL, created_by NVARCHAR(100) NOT NULL,
        modify_date DATETIME2 NULL, modified_by NVARCHAR(100) NULL,
        uuid_key VARCHAR(36) NULL, voided BIT NULL,
        answer_id BIGINT NOT NULL, answer_revision BIGINT NOT NULL,
        editor_id BIGINT NOT NULL, source NVARCHAR(20) NOT NULL,
        source_version_id BIGINT NULL, source_version_revision BIGINT NULL,
        started_at BIGINT NOT NULL, updated_at BIGINT NOT NULL,
        answer_html NVARCHAR(MAX) NULL, notes_json NVARCHAR(MAX) NULL,
        notebook_json NVARCHAR(MAX) NULL,
        CONSTRAINT fk_speaking_answer_version_answer FOREIGN KEY(answer_id) REFERENCES dbo.tbl_speaking_student_answer(id)
    );

    -- A restored source may later leave the retention window; keep its receipt
    -- identity without a foreign key so a lost-ACK retry remains idempotent.
    IF COL_LENGTH(N'dbo.tbl_speaking_answer_version', N'source_version_id') IS NULL
        ALTER TABLE dbo.tbl_speaking_answer_version ADD source_version_id BIGINT NULL;
    IF COL_LENGTH(N'dbo.tbl_speaking_answer_version', N'source_version_revision') IS NULL
        ALTER TABLE dbo.tbl_speaking_answer_version ADD source_version_revision BIGINT NULL;

    IF NOT EXISTS (SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.tbl_speaking_answer_version')
          AND name = N'ix_speaking_answer_version_answer')
        CREATE INDEX ix_speaking_answer_version_answer ON dbo.tbl_speaking_answer_version(answer_id,id);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.tbl_speaking_answer_version')
          AND name = N'ix_speaking_answer_version_updated')
        CREATE INDEX ix_speaking_answer_version_updated ON dbo.tbl_speaking_answer_version(updated_at);

    COMMIT TRANSACTION;
    PRINT 'Speaking answer history and shared notebooks: schema is ready.';
END TRY
BEGIN CATCH
    DECLARE @SpeakingHistoryError NVARCHAR(2048);
    SET @SpeakingHistoryError = ERROR_MESSAGE();
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    RAISERROR(N'%s',16,1,@SpeakingHistoryError);
END CATCH;
