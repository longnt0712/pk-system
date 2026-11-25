-- Preserve existing flower checks and colors on SQL Server deployments.
IF OBJECT_ID(N'dbo.tbl_campaign_flower_entry', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.tbl_campaign_flower_entry', N'prayer_text') IS NULL
BEGIN
    ALTER TABLE dbo.tbl_campaign_flower_entry ADD prayer_text nvarchar(120) NULL;
END;
