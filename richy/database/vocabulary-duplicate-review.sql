-- SQL Server 2008 R2+. Chạy trước khi deploy JAR có chức năng gộp 10 nhóm / Đã check.
-- Chỉ thêm 2 cột nullable; không sửa từ vựng, topic hoặc kết quả đang có.
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF @@TRANCOUNT<>0
BEGIN
    RAISERROR(N'Hãy chạy trong phiên không có transaction đang mở.',16,1);
    RETURN;
END;
IF OBJECT_ID(N'dbo.tbl_question',N'U') IS NULL
BEGIN
    RAISERROR(N'Không tìm thấy dbo.tbl_question. Hãy chọn đúng database ứng dụng.',16,1);
    RETURN;
END;
BEGIN TRY
    BEGIN TRANSACTION;
    IF COL_LENGTH(N'dbo.tbl_question',N'duplicate_reviewed_key') IS NULL
        EXEC(N'ALTER TABLE dbo.tbl_question ADD duplicate_reviewed_key NVARCHAR(64) NULL;');
    IF COL_LENGTH(N'dbo.tbl_question',N'duplicate_reviewed_at') IS NULL
        EXEC(N'ALTER TABLE dbo.tbl_question ADD duplicate_reviewed_at DATETIME2(3) NULL;');
    IF NOT EXISTS(SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.tbl_question') AND name=N'duplicate_reviewed_key' AND system_type_id=231 AND max_length=128)
        OR NOT EXISTS(SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.tbl_question') AND name=N'duplicate_reviewed_at' AND system_type_id=42)
        RAISERROR(N'Cột đánh dấu đã tồn tại với kiểu dữ liệu khác. Chưa cập nhật schema.',16,1);
    COMMIT TRANSACTION;
    SELECT N'Đã sẵn sàng lưu trạng thái Đã check; có thể deploy JAR mới.' AS message;
END TRY
BEGIN CATCH
    DECLARE @Error NVARCHAR(2048);
    SET @Error=ERROR_MESSAGE();
    IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
    RAISERROR(N'%s',16,1,@Error);
END CATCH;
