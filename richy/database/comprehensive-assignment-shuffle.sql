-- Existing assignments retain their original order; new assignments default to shuffle in the editor/service.
IF COL_LENGTH('dbo.tbl_enrolment_class_schedule_task', 'shuffle_questions') IS NULL
    ALTER TABLE dbo.tbl_enrolment_class_schedule_task ADD shuffle_questions BIT NULL;
