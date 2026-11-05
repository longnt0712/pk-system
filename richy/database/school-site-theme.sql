-- Optional explicit migration. Hibernate schema update adds the same nullable
-- column automatically. Existing selections continue to use the legacy IELTS
-- setting or Normal for other schools until an admin saves a school choice.
IF OBJECT_ID(N'dbo.tbl_school', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.tbl_school', N'site_theme') IS NULL
    ALTER TABLE dbo.tbl_school ADD site_theme varchar(16) NULL;
