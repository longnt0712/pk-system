-- Run once before deploying the API. Safe to rerun on SQL Server.
IF OBJECT_ID('dbo.tbl_enrolment_class_schedule_task_topic', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.tbl_enrolment_class_schedule_task_topic (
        task_id BIGINT NOT NULL,
        topic_id BIGINT NOT NULL,
        display_order INT NOT NULL,
        CONSTRAINT pk_class_schedule_task_topic PRIMARY KEY (task_id, display_order),
        CONSTRAINT fk_class_schedule_task_topic_task FOREIGN KEY (task_id)
            REFERENCES dbo.tbl_enrolment_class_schedule_task(id),
        CONSTRAINT fk_class_schedule_task_topic_topic FOREIGN KEY (topic_id)
            REFERENCES dbo.tbl_topic(id)
    );
    CREATE INDEX ix_class_schedule_task_topic_topic
        ON dbo.tbl_enrolment_class_schedule_task_topic(topic_id);
END;

IF COL_LENGTH('dbo.tbl_test_result', 'assignment_topic_id') IS NULL
    ALTER TABLE dbo.tbl_test_result ADD assignment_topic_id BIGINT NULL;
GO

-- Existing task_id/topic_id rows remain readable. Preserve their successful attempts
-- when a teacher later adds more topics to that task. Never infer a topic for a
-- grouped task from the first item or from the question's overlapping topic tags.
UPDATE dbo.tbl_test_result
SET assignment_topic_id = (
    SELECT t.topic_id FROM dbo.tbl_enrolment_class_schedule_task t
    WHERE t.id = tbl_test_result.assignment_task_id
)
WHERE test_type = 1 AND assignment_topic_id IS NULL
  AND EXISTS (
      SELECT 1 FROM dbo.tbl_enrolment_class_schedule_task t
      WHERE t.id = tbl_test_result.assignment_task_id AND t.topic_id IS NOT NULL
        AND (t.activity_type = 'DAILY_VOCAB' OR t.activity_type IS NULL)
        AND EXISTS (SELECT 1 FROM dbo.tbl_test_result_topic rt
                    WHERE rt.test_result_id = tbl_test_result.id AND rt.topic_id = t.topic_id)
        AND NOT EXISTS (SELECT 1 FROM dbo.tbl_enrolment_class_schedule_task_topic tt
                        WHERE tt.task_id = t.id AND tt.topic_id <> t.topic_id)
        AND (SELECT COUNT(*) FROM dbo.tbl_enrolment_class_schedule_task_topic tt WHERE tt.task_id = t.id) <= 1
  );
