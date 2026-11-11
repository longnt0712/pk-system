-- Existing categories keep their hierarchy and remain shared (owner_id IS NULL).
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID(N'dbo.tbl_topic_category', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.tbl_topic_category', N'parent_id') IS NULL
    ALTER TABLE dbo.tbl_topic_category ADD parent_id BIGINT NULL
        CONSTRAINT FK_topic_category_parent REFERENCES dbo.tbl_topic_category(id);
IF OBJECT_ID(N'dbo.tbl_topic_category', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.tbl_topic_category', N'owner_id') IS NULL
    ALTER TABLE dbo.tbl_topic_category ADD owner_id BIGINT NULL;
IF OBJECT_ID(N'dbo.tbl_topic_category', N'U') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.tbl_topic_category')
                    AND name = N'IX_topic_category_owner')
    EXEC(N'CREATE INDEX IX_topic_category_owner ON dbo.tbl_topic_category(owner_id, id)');
COMMIT TRANSACTION;
