-- Nonunique: existing history is preserved, including any old duplicate attempt keys.
-- This lookup index avoids a broad TestResult scan while the student's save lock is held.
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.tbl_test_result')
      AND name = 'ix_test_result_attempt_lookup'
)
    CREATE NONCLUSTERED INDEX ix_test_result_attempt_lookup
        ON dbo.tbl_test_result(user_id, test_type, client_attempt_key);
