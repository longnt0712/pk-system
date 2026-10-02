-- SQL Server 2008 / 2008 R2: run in the TNTT application database.
-- Add only the garden color column; preserve existing checks.
IF OBJECT_ID(N'dbo.tbl_campaign_flower_entry', N'U') IS NULL
BEGIN
    RAISERROR('Campaign flower entry table is missing. Check the selected database.', 16, 1);
    RETURN;
END;

IF COL_LENGTH(N'dbo.tbl_campaign_flower_entry', N'paint_color') IS NULL
BEGIN
    ALTER TABLE dbo.tbl_campaign_flower_entry ADD paint_color varchar(7) NULL;
    PRINT 'Added paint_color. Existing checks are unchanged.';
END
ELSE
BEGIN
    PRINT 'paint_color already exists. No change needed.';
END;
