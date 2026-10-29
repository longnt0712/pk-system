-- SQL Server 2008 R2 (10.50) and later. Run the whole script in the application database.
-- Preserves old tasks/results: NULL means the existing unsplit assignment / legacy time limit.
SET XACT_ABORT ON;
BEGIN TRY
    BEGIN TRANSACTION;
    IF OBJECT_ID(N'dbo.tbl_enrolment_class_schedule_task',N'U') IS NULL
        RAISERROR('Assignment task table is missing. Check the selected application database.',16,1);
    IF OBJECT_ID(N'dbo.tbl_test_result',N'U') IS NULL
        RAISERROR('Test result table is missing. Check the selected application database.',16,1);
    IF COL_LENGTH(N'dbo.tbl_enrolment_class_schedule_task',N'comprehensive_question_limit') IS NULL
        ALTER TABLE dbo.tbl_enrolment_class_schedule_task ADD comprehensive_question_limit INT NULL;
    IF COL_LENGTH(N'dbo.tbl_enrolment_class_schedule_task',N'comprehensive_time_limit_minutes') IS NULL
        ALTER TABLE dbo.tbl_enrolment_class_schedule_task ADD comprehensive_time_limit_minutes INT NULL;
    IF COL_LENGTH(N'dbo.tbl_enrolment_class_schedule_task',N'comprehensive_sections_json') IS NULL
        ALTER TABLE dbo.tbl_enrolment_class_schedule_task ADD comprehensive_sections_json NVARCHAR(MAX) NULL;
    IF COL_LENGTH(N'dbo.tbl_test_result',N'assignment_section_key') IS NULL
        ALTER TABLE dbo.tbl_test_result ADD assignment_section_key VARCHAR(40) NULL;
    -- Dynamic SQL lets the same batch add the new column before compiling its index definition.
    IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.tbl_test_result') AND name=N'ix_test_result_assignment_section')
        EXEC(N'CREATE INDEX ix_test_result_assignment_section ON dbo.tbl_test_result(assignment_task_id,assignment_section_key,user_id)');
    COMMIT TRANSACTION;
    PRINT 'Comprehensive assignment sections: schema is ready.';
END TRY
BEGIN CATCH
    DECLARE @ComprehensiveError NVARCHAR(2048);
    SET @ComprehensiveError = ERROR_MESSAGE();
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    RAISERROR(N'%s',16,1,@ComprehensiveError);
END CATCH;
