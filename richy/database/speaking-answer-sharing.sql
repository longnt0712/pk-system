-- SQL Server 2008 R2+. Run in the IELTSRoom application database before deploying the new JAR.
SET XACT_ABORT ON;
BEGIN TRY
    BEGIN TRANSACTION;
    IF OBJECT_ID(N'dbo.tbl_speaking_set',N'U') IS NULL OR OBJECT_ID(N'dbo.tbl_user',N'U') IS NULL
        RAISERROR('Speaking tables are missing. Select the application database first.',16,1);
    IF OBJECT_ID(N'dbo.tbl_speaking_answer_share',N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.tbl_speaking_answer_share (
            id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            create_date DATETIME2 NOT NULL, created_by NVARCHAR(100) NOT NULL,
            modify_date DATETIME2 NULL, modified_by NVARCHAR(100) NULL,
            uuid_key VARCHAR(36) NULL, voided BIT NULL,
            set_id BIGINT NOT NULL, student_id BIGINT NOT NULL, creator_id BIGINT NOT NULL,
            permission VARCHAR(8) NOT NULL, token_hash VARCHAR(64) NOT NULL, revoked BIT NOT NULL,
            CONSTRAINT uk_speaking_share_token UNIQUE(token_hash),
            CONSTRAINT ck_speaking_share_permission CHECK(permission IN ('VIEW','EDIT')),
            CONSTRAINT fk_speaking_share_set FOREIGN KEY(set_id) REFERENCES dbo.tbl_speaking_set(id),
            CONSTRAINT fk_speaking_share_student FOREIGN KEY(student_id) REFERENCES dbo.tbl_user(id),
            CONSTRAINT fk_speaking_share_creator FOREIGN KEY(creator_id) REFERENCES dbo.tbl_user(id)
        );
        CREATE INDEX ix_speaking_share_subject ON dbo.tbl_speaking_answer_share(set_id,student_id,revoked);
    END;
    COMMIT TRANSACTION;
    PRINT 'Speaking view/edit sharing links: schema ready.';
END TRY
BEGIN CATCH
    DECLARE @SpeakingShareError NVARCHAR(2048);
    SET @SpeakingShareError=ERROR_MESSAGE();
    IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
    RAISERROR(N'%s',16,1,@SpeakingShareError);
END CATCH;
