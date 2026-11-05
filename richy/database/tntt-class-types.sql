-- SQL Server 2008 R2+. Select the application database before running.
-- Run before deploying the backend. Existing classes with no classification are treated as student classes.
IF COL_LENGTH(N'dbo.tbl_enrolment_class', N'staff_class') IS NULL
BEGIN
    ALTER TABLE dbo.tbl_enrolment_class ADD staff_class BIT NULL;
END;
