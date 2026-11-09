-- Existing categories stay at the root of the tree.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID(N'dbo.tbl_topic_category', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.tbl_topic_category', N'parent_id') IS NULL
    ALTER TABLE dbo.tbl_topic_category ADD parent_id BIGINT NULL
        CONSTRAINT FK_topic_category_parent REFERENCES dbo.tbl_topic_category(id);
COMMIT TRANSACTION;
