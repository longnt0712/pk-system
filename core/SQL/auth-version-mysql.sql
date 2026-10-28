-- MySQL 5.6 and later. Select the application database and run BEFORE starting
-- the updated backend. Re-running this migration leaves existing versions intact.
-- NULL is intentional for existing users; application security changes rotate it.
SET @auth_version_migration_sql = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE `tbl_user` ADD COLUMN `auth_version` varchar(36) NULL',
        'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'tbl_user'
      AND column_name = 'auth_version'
);
PREPARE auth_version_migration FROM @auth_version_migration_sql;
EXECUTE auth_version_migration;
DEALLOCATE PREPARE auth_version_migration;
