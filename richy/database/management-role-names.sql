-- Rename the roles in place so user and School assignments retain their role IDs.
SET XACT_ABORT ON;
BEGIN TRY
    BEGIN TRANSACTION;
    DECLARE @names TABLE (old_name VARCHAR(150), new_name VARCHAR(150));
    INSERT INTO @names VALUES
        ('ROLE_EDUCATION_MANAGERMENT','ROLE_EDUCATION_MANAGEMENT'),
        ('ROLE_STUDENT_MANAGERMENT','ROLE_STUDENT_MANAGEMENT'),
        ('ROLE_EXAM_MANAGERMENT','ROLE_EXAM_MANAGEMENT'),
        ('ROLE_FINANCIAL_MANAGERMENT','ROLE_FINANCIAL_MANAGEMENT');

    IF EXISTS (
        SELECT 1 FROM @names n JOIN dbo.tbl_role oldRole ON oldRole.role_name=n.old_name
        JOIN dbo.tbl_role newRole ON newRole.role_name=n.new_name AND newRole.id<>oldRole.id
    )
        RAISERROR(N'Both spellings exist for a role. Review assignments before merging role IDs.',16,1);

    UPDATE r SET role_name=n.new_name
    FROM dbo.tbl_role r JOIN @names n ON r.role_name=n.old_name;
    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    DECLARE @error NVARCHAR(2048) = ERROR_MESSAGE();
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    RAISERROR(N'%s',16,1,@error);
END CATCH;
