-- Read-only inventory of current role assignments. Zero current assignments
-- cannot establish whether the role was ever assigned or used in the past.
IF OBJECT_ID(N'dbo.tbl_school_user_role',N'U') IS NOT NULL
BEGIN
    EXEC(N'SELECT r.id,r.role_name,r.role_description,
        (SELECT COUNT(DISTINCT ur.user_id) FROM dbo.tbl_user_role ur WHERE ur.role_id=r.id) AS global_accounts,
        (SELECT COUNT(DISTINCT ur.user_id) FROM dbo.tbl_user_role ur JOIN dbo.tbl_user u ON u.id=ur.user_id WHERE ur.role_id=r.id AND u.active=1) AS active_global_accounts,
        (SELECT COUNT(*) FROM dbo.tbl_school_user_role sr WHERE sr.role_id=r.id) AS school_assignments
        FROM dbo.tbl_role r ORDER BY r.role_name,r.id;
        SELECT s.id AS school_id,s.name AS school_name,r.role_name,COUNT(*) AS school_accounts,
            SUM(CASE WHEN u.active=1 THEN 1 ELSE 0 END) AS active_school_accounts
        FROM dbo.tbl_school_user_role sr JOIN dbo.tbl_school s ON s.id=sr.school_id
        JOIN dbo.tbl_role r ON r.id=sr.role_id JOIN dbo.tbl_user u ON u.id=sr.user_id
        GROUP BY s.id,s.name,r.role_name ORDER BY s.id,r.role_name;');
END
ELSE
BEGIN
    SELECT r.id,r.role_name,r.role_description,
        (SELECT COUNT(DISTINCT ur.user_id) FROM dbo.tbl_user_role ur WHERE ur.role_id=r.id) AS global_accounts,
        (SELECT COUNT(DISTINCT ur.user_id) FROM dbo.tbl_user_role ur JOIN dbo.tbl_user u ON u.id=ur.user_id WHERE ur.role_id=r.id AND u.active=1) AS active_global_accounts
    FROM dbo.tbl_role r ORDER BY r.role_name,r.id;
END;
