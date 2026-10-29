-- Speaking studio. SQL Server 2008 R2 (10.50) and later.
-- Run the entire script in the existing application database.
-- Adds six new tables only. Does not change old tests, results or assignments.
SET XACT_ABORT ON;
BEGIN TRY
    BEGIN TRANSACTION;
    IF OBJECT_ID(N'dbo.tbl_user', N'U') IS NULL
        RAISERROR('Select the IELTSROOM application database before running this script.',16,1);

    IF OBJECT_ID(N'dbo.tbl_speaking_set', N'U') IS NULL
    CREATE TABLE dbo.tbl_speaking_set (
        id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        create_date DATETIME2 NOT NULL, created_by NVARCHAR(100) NOT NULL,
        modify_date DATETIME2 NULL, modified_by NVARCHAR(100) NULL,
        uuid_key VARCHAR(36) NULL, voided BIT NULL,
        owner_id BIGINT NOT NULL, season_year INT NOT NULL, set_number INT NOT NULL,
        name NVARCHAR(200) NOT NULL, class_ids NVARCHAR(MAX) NULL, student_ids NVARCHAR(MAX) NULL,
        import_token VARCHAR(40) NULL, import_rows NVARCHAR(MAX) NULL, revision BIGINT NULL,
        CONSTRAINT uk_speaking_set_owner_period UNIQUE(owner_id,season_year,set_number),
        CONSTRAINT ck_speaking_set_period CHECK(set_number BETWEEN 1 AND 3 AND season_year BETWEEN 1900 AND 2200)
    );

    IF OBJECT_ID(N'dbo.tbl_speaking_question', N'U') IS NULL
    CREATE TABLE dbo.tbl_speaking_question (
        id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        create_date DATETIME2 NOT NULL, created_by NVARCHAR(100) NOT NULL,
        modify_date DATETIME2 NULL, modified_by NVARCHAR(100) NULL,
        uuid_key VARCHAR(36) NULL, voided BIT NULL,
        owner_id BIGINT NOT NULL, part INT NOT NULL, topic NVARCHAR(300) NOT NULL,
        prompt NVARCHAR(MAX) NULL, sample NVARCHAR(MAX) NULL, content_key VARCHAR(64) NOT NULL,
        revision BIGINT NULL,
        CONSTRAINT uk_speaking_question_owner_content UNIQUE(owner_id,content_key),
        CONSTRAINT ck_speaking_question_part CHECK(part BETWEEN 1 AND 3)
    );

    IF OBJECT_ID(N'dbo.tbl_speaking_set_entry', N'U') IS NULL
    CREATE TABLE dbo.tbl_speaking_set_entry (
        id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        create_date DATETIME2 NOT NULL, created_by NVARCHAR(100) NOT NULL,
        modify_date DATETIME2 NULL, modified_by NVARCHAR(100) NULL,
        uuid_key VARCHAR(36) NULL, voided BIT NULL,
        set_id BIGINT NOT NULL, question_id BIGINT NOT NULL, entry_key VARCHAR(64) NOT NULL,
        import_code NVARCHAR(100) NOT NULL, sample NVARCHAR(MAX) NULL, linked_part2_id BIGINT NULL,
        CONSTRAINT uk_speaking_entry_set_key UNIQUE(set_id,entry_key),
        CONSTRAINT fk_speaking_entry_set FOREIGN KEY(set_id) REFERENCES dbo.tbl_speaking_set(id),
        CONSTRAINT fk_speaking_entry_question FOREIGN KEY(question_id) REFERENCES dbo.tbl_speaking_question(id),
        CONSTRAINT fk_speaking_entry_cue FOREIGN KEY(linked_part2_id) REFERENCES dbo.tbl_speaking_question(id)
    );

    IF OBJECT_ID(N'dbo.tbl_speaking_pass', N'U') IS NULL
    CREATE TABLE dbo.tbl_speaking_pass (
        id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        create_date DATETIME2 NOT NULL, created_by NVARCHAR(100) NOT NULL,
        modify_date DATETIME2 NULL, modified_by NVARCHAR(100) NULL,
        uuid_key VARCHAR(36) NULL, voided BIT NULL,
        student_id BIGINT NOT NULL, question_id BIGINT NOT NULL, teacher_id BIGINT NOT NULL,
        passed BIT NOT NULL, note NVARCHAR(1000) NULL,
        CONSTRAINT uk_speaking_pass_student_question UNIQUE(student_id,question_id),
        CONSTRAINT fk_speaking_pass_question FOREIGN KEY(question_id) REFERENCES dbo.tbl_speaking_question(id)
    );

    IF OBJECT_ID(N'dbo.tbl_speaking_practice', N'U') IS NULL
    CREATE TABLE dbo.tbl_speaking_practice (
        id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        create_date DATETIME2 NOT NULL, created_by NVARCHAR(100) NOT NULL,
        modify_date DATETIME2 NULL, modified_by NVARCHAR(100) NULL,
        uuid_key VARCHAR(36) NULL, voided BIT NULL,
        student_id BIGINT NOT NULL, bank_owner_id BIGINT NOT NULL, client_key VARCHAR(80) NOT NULL,
        status VARCHAR(20) NOT NULL, snapshot_json NVARCHAR(MAX) NULL,
        current_index INT NOT NULL, elapsed_seconds BIGINT NOT NULL, ai_status VARCHAR(20) NOT NULL,
        CONSTRAINT uk_speaking_practice_student_attempt UNIQUE(student_id,client_key),
        CONSTRAINT ck_speaking_practice_status CHECK(status IN ('ACTIVE','DONE')),
        CONSTRAINT ck_speaking_practice_elapsed CHECK(elapsed_seconds BETWEEN 0 AND 604800)
    );

    IF OBJECT_ID(N'dbo.tbl_speaking_recording', N'U') IS NULL
    CREATE TABLE dbo.tbl_speaking_recording (
        id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        create_date DATETIME2 NOT NULL, created_by NVARCHAR(100) NOT NULL,
        modify_date DATETIME2 NULL, modified_by NVARCHAR(100) NULL,
        uuid_key VARCHAR(36) NULL, voided BIT NULL,
        practice_id BIGINT NOT NULL, student_id BIGINT NOT NULL, upload_key VARCHAR(80) NOT NULL,
        storage_key VARCHAR(40) NOT NULL, content_type VARCHAR(60) NOT NULL,
        chunks_json NVARCHAR(MAX) NULL, complete BIT NOT NULL, byte_count BIGINT NOT NULL,
        question_index INT NOT NULL, sha256 VARCHAR(64) NULL,
        CONSTRAINT uk_speaking_recording_session_upload UNIQUE(practice_id,upload_key),
        CONSTRAINT fk_speaking_recording_practice FOREIGN KEY(practice_id) REFERENCES dbo.tbl_speaking_practice(id),
        CONSTRAINT ck_speaking_recording_size CHECK(byte_count BETWEEN 0 AND 67108864)
    );
    IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.tbl_speaking_practice') AND name=N'ix_speaking_practice_owner_student')
        CREATE INDEX ix_speaking_practice_owner_student ON dbo.tbl_speaking_practice(bank_owner_id,student_id,id DESC);
    IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.tbl_speaking_set_entry') AND name=N'ix_speaking_entry_question')
        CREATE INDEX ix_speaking_entry_question ON dbo.tbl_speaking_set_entry(question_id);
    COMMIT TRANSACTION;
    PRINT 'Speaking studio: schema is ready (6 tables).';
END TRY
BEGIN CATCH
    DECLARE @SpeakingErrorMessage NVARCHAR(2048);
    SET @SpeakingErrorMessage = ERROR_MESSAGE();
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    RAISERROR(N'%s', 16, 1, @SpeakingErrorMessage);
END CATCH;
