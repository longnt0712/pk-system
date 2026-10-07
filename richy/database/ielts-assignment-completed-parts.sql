-- Preserve single-Part results; grouped submissions store e.g. ,1,2,3,.
IF COL_LENGTH('dbo.tbl_test_result', 'completed_parts') IS NULL
    ALTER TABLE dbo.tbl_test_result ADD completed_parts VARCHAR(32) NULL;
