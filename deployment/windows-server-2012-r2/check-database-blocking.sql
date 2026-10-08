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
