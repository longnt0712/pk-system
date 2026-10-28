-- Optional when spring.jpa.hibernate.ddl-auto=update is enabled (the application
-- creates this table automatically). Run before deploying when DDL updates are disabled.
-- Rerunning this script preserves the selected appearance.
IF OBJECT_ID(N'dbo.tbl_battle_config', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.tbl_battle_config (
        id INT NOT NULL PRIMARY KEY,
        lum_lucky_appearance NVARCHAR(16) NOT NULL,
        revision BIGINT NOT NULL CONSTRAINT df_battle_config_revision DEFAULT 0,
        CONSTRAINT ck_battle_config_singleton CHECK (id = 1),
        CONSTRAINT ck_battle_config_lucky_appearance CHECK (lum_lucky_appearance IN (N'PUMPKIN', N'LIGHTNING'))
    );
END;

IF NOT EXISTS (SELECT 1 FROM dbo.tbl_battle_config WHERE id = 1)
BEGIN
    INSERT INTO dbo.tbl_battle_config (id, lum_lucky_appearance, revision)
    VALUES (1, N'PUMPKIN', 0);
END;
