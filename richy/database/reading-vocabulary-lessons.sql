-- Run in the application database before deploying the Reading vocabulary links.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.tbl_reading_vocab_lesson', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.tbl_reading_vocab_lesson (
        test_id BIGINT NOT NULL,
        topic_id BIGINT NOT NULL,
        CONSTRAINT PK_reading_vocab_lesson PRIMARY KEY (test_id, topic_id)
    );
END;

-- Hibernate may have already created the table and the two foreign keys.
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.tbl_reading_vocab_lesson')
           AND name = N'FK_reading_vocab_test' AND delete_referential_action = 0)
    ALTER TABLE dbo.tbl_reading_vocab_lesson DROP CONSTRAINT FK_reading_vocab_test;
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.tbl_reading_vocab_lesson')
               AND name = N'FK_reading_vocab_test')
    ALTER TABLE dbo.tbl_reading_vocab_lesson WITH CHECK ADD CONSTRAINT FK_reading_vocab_test
        FOREIGN KEY (test_id) REFERENCES dbo.tbl_question(id) ON DELETE CASCADE;

IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.tbl_reading_vocab_lesson')
           AND name = N'FK_reading_vocab_topic' AND delete_referential_action = 0)
    ALTER TABLE dbo.tbl_reading_vocab_lesson DROP CONSTRAINT FK_reading_vocab_topic;
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.tbl_reading_vocab_lesson')
               AND name = N'FK_reading_vocab_topic')
    ALTER TABLE dbo.tbl_reading_vocab_lesson WITH CHECK ADD CONSTRAINT FK_reading_vocab_topic
        FOREIGN KEY (topic_id) REFERENCES dbo.tbl_topic(id) ON DELETE CASCADE;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.tbl_reading_vocab_lesson')
               AND name = N'IX_reading_vocab_topic')
    CREATE INDEX IX_reading_vocab_topic ON dbo.tbl_reading_vocab_lesson (topic_id);

COMMIT TRANSACTION;
