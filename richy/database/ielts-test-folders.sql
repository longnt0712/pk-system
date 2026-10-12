-- Run before deploying the backend. Existing folders remain in Comprehensive.
-- For a fresh installation, run comprehensive-test-folders.sql first.
IF COL_LENGTH('dbo.tbl_test_folder', 'test_mode') IS NULL
BEGIN
    ALTER TABLE dbo.tbl_test_folder ADD test_mode VARCHAR(20) NOT NULL
        CONSTRAINT DF_test_folder_mode DEFAULT 'COMPREHENSIVE' WITH VALUES;
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_test_folder_mode_owner_parent'
        AND object_id = OBJECT_ID('dbo.tbl_test_folder'))
BEGIN
    CREATE INDEX IX_test_folder_mode_owner_parent ON dbo.tbl_test_folder(test_mode, owner_id, parent_id);
END;
