-- Run before deploying the backend if automatic Hibernate schema updates are disabled.
IF COL_LENGTH('dbo.tbl_question', 'video_url') IS NULL
    ALTER TABLE dbo.tbl_question ADD video_url VARCHAR(2048) NULL;

IF COL_LENGTH('dbo.tbl_question', 'video_time_seconds') IS NULL
    ALTER TABLE dbo.tbl_question ADD video_time_seconds INT NULL;

IF COL_LENGTH('dbo.tbl_question', 'video_answer_seconds') IS NULL
    ALTER TABLE dbo.tbl_question ADD video_answer_seconds INT NULL;
