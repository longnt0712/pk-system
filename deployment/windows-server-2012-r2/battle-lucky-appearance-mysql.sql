-- Optional when spring.jpa.hibernate.ddl-auto=update is enabled (the application
-- creates this table automatically). Run before deploying when DDL updates are disabled.
-- Rerunning this script preserves the selected appearance.
CREATE TABLE IF NOT EXISTS tbl_battle_config (
    id INT NOT NULL PRIMARY KEY,
    lum_lucky_appearance VARCHAR(16) NOT NULL,
    revision BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT ck_battle_config_singleton CHECK (id = 1),
    CONSTRAINT ck_battle_config_lucky_appearance CHECK (lum_lucky_appearance IN ('PUMPKIN', 'LIGHTNING'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO tbl_battle_config (id, lum_lucky_appearance, revision)
SELECT 1, 'PUMPKIN', 0
WHERE NOT EXISTS (SELECT 1 FROM tbl_battle_config WHERE id = 1);
