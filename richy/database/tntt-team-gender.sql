-- Additive; run before deploying the backend. Existing teams default to Tổng hợp.
IF COL_LENGTH('dbo.tbl_enrolment_class', 'team_gender') IS NULL
    ALTER TABLE dbo.tbl_enrolment_class ADD team_gender varchar(8) NULL;
