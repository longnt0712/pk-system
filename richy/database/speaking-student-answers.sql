-- SQL Server 2008 R2 (10.50) and later. Run the entire script in the application database.
-- Personal responses only: existing shared samples, Pass marks and practice history are unchanged.
SET XACT_ABORT ON;
BEGIN TRY
    BEGIN TRANSACTION;
    IF OBJECT_ID(N'dbo.tbl_speaking_question', N'U') IS NULL OR OBJECT_ID(N'dbo.tbl_user', N'U') IS NULL
        RAISERROR('Speaking tables are missing. Select the application database and run speaking-studio.sql first.',16,1);
    IF OBJECT_ID(N'dbo.tbl_speaking_student_answer', N'U') IS NULL
    CREATE TABLE dbo.tbl_speaking_student_answer (
        id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        create_date DATETIME2 NOT NULL, created_by NVARCHAR(100) NOT NULL,
        modify_date DATETIME2 NULL, modified_by NVARCHAR(100) NULL,
        uuid_key VARCHAR(36) NULL, voided BIT NULL,
        student_id BIGINT NOT NULL, question_id BIGINT NOT NULL, editor_id BIGINT NOT NULL,
        answer_html NVARCHAR(MAX) NULL, notes_json NVARCHAR(MAX) NULL, revision BIGINT NOT NULL,
        notebook_json NVARCHAR(MAX) NULL,
        notebook_revision BIGINT DEFAULT(0) NOT NULL,
        CONSTRAINT uk_speaking_answer_student_question UNIQUE(student_id,question_id),
        CONSTRAINT fk_speaking_answer_question FOREIGN KEY(question_id) REFERENCES dbo.tbl_speaking_question(id)
    );
    COMMIT TRANSACTION;
    PRINT 'Speaking student answers: schema is ready.';
END TRY
BEGIN CATCH
    DECLARE @SpeakingAnswerError NVARCHAR(2048);
    SET @SpeakingAnswerError = ERROR_MESSAGE();
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    RAISERROR(N'%s',16,1,@SpeakingAnswerError);
END CATCH;
