-- Run in the application's actual database in SSMS.
-- Read-only diagnostics for SQL Server 2008 and later; VIEW SERVER STATE is required.
SELECT session_id, status, command, blocking_session_id,
       wait_type, wait_time, wait_resource, total_elapsed_time,
       DB_NAME(database_id) AS database_name
FROM sys.dm_exec_requests
WHERE database_id = DB_ID() AND session_id <> @@SPID
ORDER BY total_elapsed_time DESC;

SELECT st.session_id, dt.database_transaction_begin_time,
       dt.database_transaction_state,
       dt.database_transaction_log_bytes_used
FROM sys.dm_tran_session_transactions AS st
JOIN sys.dm_tran_database_transactions AS dt
  ON dt.transaction_id = st.transaction_id
WHERE dt.database_id = DB_ID()
ORDER BY dt.database_transaction_begin_time;

SELECT COL_LENGTH('dbo.tbl_question', 'video_url') AS video_url_length,
       COL_LENGTH('dbo.tbl_question', 'video_time_seconds') AS video_time_seconds_length;

-- A blocking session can be sleeping, so it will not appear in dm_exec_requests.
-- Include sessions with an open transaction in this database and their blocker.
;WITH relevant_sessions AS (
    SELECT session_id FROM sys.dm_exec_requests WHERE database_id = DB_ID()
    UNION
    SELECT st.session_id
    FROM sys.dm_tran_session_transactions AS st
    JOIN sys.dm_tran_database_transactions AS dt ON dt.transaction_id = st.transaction_id
    WHERE dt.database_id = DB_ID()
    UNION
    SELECT blocking_session_id FROM sys.dm_exec_requests
    WHERE database_id = DB_ID() AND blocking_session_id > 0
)
SELECT s.session_id, s.status, s.host_name, s.program_name,
       s.last_request_start_time, s.last_request_end_time,
       r.command, r.blocking_session_id, r.wait_type, r.wait_time, r.wait_resource
FROM relevant_sessions AS relevant
JOIN sys.dm_exec_sessions AS s ON s.session_id = relevant.session_id
LEFT JOIN sys.dm_exec_requests AS r ON r.session_id = s.session_id
WHERE s.session_id <> @@SPID
ORDER BY s.session_id;

-- Locks on Topic/Question/User/Battle tables show whether saving is waiting for SQL.
SELECT l.request_session_id, l.resource_type, l.request_mode, l.request_status,
       COALESCE(OBJECT_NAME(p.object_id, DB_ID()),
           CASE WHEN l.resource_type = 'OBJECT'
                THEN OBJECT_NAME(CAST(l.resource_associated_entity_id AS int), DB_ID()) END) AS table_name,
       l.resource_description
FROM sys.dm_tran_locks AS l
LEFT JOIN sys.partitions AS p ON p.hobt_id = l.resource_associated_entity_id
WHERE l.resource_database_id = DB_ID() AND l.request_session_id <> @@SPID
ORDER BY l.request_session_id, l.request_status;

-- Check Battle schema too; listing can succeed while a write references missing columns.
SELECT expected.table_name, expected.column_name,
       COL_LENGTH(expected.table_name, expected.column_name) AS column_length
FROM (VALUES
    ('dbo.tbl_question', 'video_url'),
    ('dbo.tbl_question', 'video_time_seconds'),
    ('dbo.tbl_battle_music_track', 'music_purpose'),
    ('dbo.tbl_user', 'selected_learning_pet'),
    ('dbo.tbl_test_result', 'client_attempt_key')
) AS expected(table_name, column_name);
