-- Run in the IELTSROOM application database before deploying the new backend.
-- Existing questions use 20 seconds when this optional value is NULL.
IF COL_LENGTH('dbo.tbl_question', 'video_answer_seconds') IS NULL
    ALTER TABLE dbo.tbl_question ADD video_answer_seconds INT NULL;
