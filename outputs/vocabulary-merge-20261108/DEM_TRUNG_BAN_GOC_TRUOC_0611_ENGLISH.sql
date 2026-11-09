/* CHỈ ĐỌC dữ liệu hiện tại của tài khoản english trong database ecommerce.
Đếm các nhóm có ít nhất 2 thẻ được TẠO trước 06/11/2026.
Không suy ngày tạo từ ID hoặc ngày sửa; không sửa/gộp/xóa thẻ.
Kết quả là số thẻ cũ còn tồn tại hiện nay, không khôi phục trạng thái trước các lượt gộp.
*/
SET NOCOUNT ON;
DECLARE @Before06 datetime2 = CONVERT(datetime2,'20261106',112);
DECLARE @AuditOwner bigint, @AuditOwnerCount int;
IF DB_NAME()<>N'ecommerce'
BEGIN
    RAISERROR(N'Hãy chọn database ecommerce.',16,1);
    RETURN;
END;
SELECT @AuditOwner=MIN(id),@AuditOwnerCount=COUNT(*) FROM dbo.tbl_user WHERE username=N'english';
IF @AuditOwnerCount<>1
BEGIN
    RAISERROR(N'Không xác định duy nhất được tài khoản english.',16,1);
    RETURN;
END;

-- Chuẩn hóa khoảng trắng để "word", " WORD " và tab/xuống dòng tương đương nhau.
-- Chỉ ghi bảng tạm; không thay đổi bảng dữ liệu ứng dụng.
IF OBJECT_ID('tempdb..#VocabBefore06Audit') IS NOT NULL DROP TABLE #VocabBefore06Audit;
SELECT q.id,q.create_date,
    LOWER(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(CONVERT(nvarchar(max),q.question),
        NCHAR(9),N' '),NCHAR(10),N' '),NCHAR(11),N' '),NCHAR(12),N' '),NCHAR(13),N' ')))) COLLATE Latin1_General_CI_AS AS word_key
INTO #VocabBefore06Audit
FROM dbo.tbl_question q
WHERE q.user_id=@AuditOwner AND q.question_type=6 AND q.parent_id IS NULL
    AND q.create_date<@Before06;
WHILE EXISTS(SELECT 1 FROM #VocabBefore06Audit WHERE word_key LIKE N'%  %')
    UPDATE #VocabBefore06Audit SET word_key=REPLACE(word_key,N'  ',N' ') WHERE word_key LIKE N'%  %';

;WITH Duplicates AS (
    SELECT word_key,COUNT_BIG(*) AS card_count FROM #VocabBefore06Audit
    WHERE word_key IS NOT NULL AND word_key<>N''
    GROUP BY word_key HAVING COUNT_BIG(*)>1
)
SELECT N'english' AS tai_khoan,N'Trước 06/11/2026, đếm dữ liệu còn tồn tại hiện nay' AS pham_vi,
    COUNT_BIG(*) AS so_nhom_tu_trung_goc,
    ISNULL(SUM(card_count),0) AS tong_ban_ghi_goc_trong_cac_nhom_trung,
    ISNULL(SUM(card_count-1),0) AS so_ban_ghi_du_neu_moi_nhom_giu_1
FROM Duplicates;

-- Bảng tiếp theo là danh sách các từ gốc còn trùng, không khẳng định chúng cùng nghĩa.
SELECT word_key AS tu,COUNT_BIG(*) AS so_ban_ghi_goc,
    MIN(create_date) AS ngay_tao_cu_nhat,MAX(create_date) AS ngay_tao_moi_nhat
FROM #VocabBefore06Audit WHERE word_key IS NOT NULL AND word_key<>N''
GROUP BY word_key HAVING COUNT_BIG(*)>1 ORDER BY word_key;

DROP TABLE #VocabBefore06Audit;
