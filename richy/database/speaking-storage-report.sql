-- Read-only storage report for SQL Server 2008 R2 and later.
-- Select the application database. Returns aggregate sizes only, no student names or answer text.
SELECT CAST(SERVERPROPERTY('Edition') AS NVARCHAR(128)) AS sql_edition,
       DB_NAME() AS database_name;
SELECT type_desc, SUM(CAST(size AS BIGINT))*8.0/1024 AS allocated_mb
FROM sys.database_files GROUP BY type_desc;

IF OBJECT_ID(N'dbo.tbl_speaking_student_answer', N'U') IS NOT NULL
BEGIN
    DECLARE @SpeakingCurrentBytes NVARCHAR(MAX), @SpeakingReport NVARCHAR(MAX);
    SET @SpeakingCurrentBytes = N'COALESCE(DATALENGTH(answer_html),0)+COALESCE(DATALENGTH(notes_json),0)';
    IF COL_LENGTH(N'dbo.tbl_speaking_student_answer', N'notebook_json') IS NOT NULL
        SET @SpeakingCurrentBytes = @SpeakingCurrentBytes + N'+COALESCE(DATALENGTH(notebook_json),0)';
    SET @SpeakingReport = N'SELECT COUNT_BIG(*) AS saved_answer_count,
        SUM(stored_bytes)/1048576.0 AS current_content_mb,
        AVG(CAST(stored_bytes AS FLOAT))/1024 AS avg_content_kb,
        MAX(stored_bytes)/1024.0 AS largest_content_kb,
        16000.0*5*AVG(CAST(stored_bytes AS FLOAT))/1000000000 AS estimate_16000_answers_5_versions_gb
        FROM (SELECT ' + @SpeakingCurrentBytes + N' AS stored_bytes FROM dbo.tbl_speaking_student_answer) AS sizes;';
    EXEC sp_executesql @SpeakingReport;
END
ELSE PRINT 'Speaking student answer table has not been created.';

IF OBJECT_ID(N'dbo.tbl_speaking_answer_version', N'U') IS NOT NULL
    EXEC sp_executesql N'SELECT COUNT_BIG(*) AS checkpoint_count,
        SUM(stored_bytes)/1048576.0 AS history_content_mb,
        AVG(CAST(stored_bytes AS FLOAT))/1024 AS avg_checkpoint_kb,
        MAX(stored_bytes)/1024.0 AS largest_checkpoint_kb
        FROM (SELECT COALESCE(DATALENGTH(answer_html),0)+COALESCE(DATALENGTH(notes_json),0)
            +COALESCE(DATALENGTH(notebook_json),0) AS stored_bytes
            FROM dbo.tbl_speaking_answer_version) AS sizes;';
ELSE PRINT 'Speaking history table has not been created.';

-- Content totals exclude indexes, audit fields, row/page overhead and backup/log files.
-- The 16,000-answer projection assumes the current sample is representative and all answers have 5 checkpoints.
