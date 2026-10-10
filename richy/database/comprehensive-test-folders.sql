-- Run before deploying the backend if Hibernate schema updates are disabled.
-- Existing tests remain unfiled; teachers can select a folder when editing a test.
IF OBJECT_ID('dbo.tbl_test_folder', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.tbl_test_folder (
        id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        uuid_key VARCHAR(36) NULL,
        voided BIT NULL,
        create_date DATETIME2 NOT NULL,
        created_by NVARCHAR(100) NOT NULL,
        modify_date DATETIME2 NULL,
        modified_by NVARCHAR(100) NULL,
        name NVARCHAR(200) NOT NULL,
        parent_id BIGINT NULL,
        owner_id BIGINT NOT NULL,
        CONSTRAINT FK_test_folder_parent FOREIGN KEY (parent_id) REFERENCES dbo.tbl_test_folder(id),
        CONSTRAINT FK_test_folder_owner FOREIGN KEY (owner_id) REFERENCES dbo.tbl_user(id)
    );
    CREATE INDEX IX_test_folder_owner_parent ON dbo.tbl_test_folder(owner_id, parent_id);
END;

IF COL_LENGTH('dbo.tbl_question', 'test_folder_id') IS NULL
BEGIN
    ALTER TABLE dbo.tbl_question ADD test_folder_id BIGINT NULL;
    ALTER TABLE dbo.tbl_question ADD CONSTRAINT FK_question_test_folder
        FOREIGN KEY (test_folder_id) REFERENCES dbo.tbl_test_folder(id);
    CREATE INDEX IX_question_test_folder ON dbo.tbl_question(test_folder_id);
END;
