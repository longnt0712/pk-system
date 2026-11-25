-- SQL Server. Run once in the application database to speed up homework review.
-- Reruns retain the existing indexes and all submitted answers.
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.tbl_test_result')
        AND name = N'ix_test_result_homework_review'
)
    CREATE NONCLUSTERED INDEX ix_test_result_homework_review
        ON dbo.tbl_test_result(user_id, create_date)
        INCLUDE (assignment_task_id, source_question_id, test_type, result_status,
            completed_part, completed_parts, assignment_section_key);

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.tbl_question_answer_test_result')
        AND name = N'ix_question_answer_result_homework_review'
)
    CREATE NONCLUSTERED INDEX ix_question_answer_result_homework_review
        ON dbo.tbl_question_answer_test_result(test_result, ordinal_number)
        INCLUDE (question_answer);
