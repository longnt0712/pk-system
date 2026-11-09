/* CHỈ ĐỌC dữ liệu ứng dụng; SQL Server 2008 R2+.
   Xuất các nhóm CÙNG TỪ TIẾNG ANH còn tồn tại sau khi gộp để đối chiếu nghĩa.
   Không giới hạn ngày tạo, không bỏ nhóm Đã check; ngày tạo có trong XML để chọn bản gốc.
   Chọn database ecommerce, chạy toàn bộ, bấm ô XML và lưu file XML mới.
*/
SET NOCOUNT ON;
DECLARE @ExportOwner bigint, @ExportOwnerCount int;
IF DB_NAME()<>N'ecommerce'
BEGIN
    RAISERROR(N'Hãy chọn database ecommerce.',16,1);
    RETURN;
END;
SELECT @ExportOwner=MIN(id),@ExportOwnerCount=COUNT(*)
FROM dbo.tbl_user WHERE username=N'english';
IF @ExportOwnerCount<>1
BEGIN
    RAISERROR(N'Không xác định duy nhất được tài khoản english.',16,1);
    RETURN;
END;
IF OBJECT_ID('tempdb..#EnglishRemainingDuplicateExport') IS NOT NULL
    DROP TABLE #EnglishRemainingDuplicateExport;
SELECT q.id,q.question AS word,q.mother_tongue AS meaning,
    q.pronounce AS ipa,q.level AS cefr,q.status,q.voided,
    q.correct_answer AS correct,q.wrong_answer AS wrong,q.time_reviewed AS reviewed,
    q.create_date AS created,q.modify_date AS modified,
    q.duplicate_reviewed_key,q.duplicate_reviewed_at,
    LOWER(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(CONVERT(nvarchar(max),q.question),
        NCHAR(9),N' '),NCHAR(10),N' '),NCHAR(11),N' '),NCHAR(12),N' '),NCHAR(13),N' '))))
        COLLATE Latin1_General_CI_AS AS word_key
INTO #EnglishRemainingDuplicateExport
FROM dbo.tbl_question q
WHERE q.user_id=@ExportOwner AND q.question_type=6 AND q.parent_id IS NULL;
WHILE EXISTS(SELECT 1 FROM #EnglishRemainingDuplicateExport WHERE word_key LIKE N'%  %')
    UPDATE #EnglishRemainingDuplicateExport SET word_key=REPLACE(word_key,N'  ',N' ')
    WHERE word_key LIKE N'%  %';
;WITH Duplicates AS (
    SELECT word_key FROM #EnglishRemainingDuplicateExport
    WHERE word_key IS NOT NULL AND word_key<>N''
    GROUP BY word_key HAVING COUNT_BIG(*)>1
)
SELECT q.id,q.word,q.meaning,q.ipa,q.cefr,q.status,q.voided,
    q.correct,q.wrong,q.reviewed,q.created,q.modified,
    q.duplicate_reviewed_key,q.duplicate_reviewed_at
FROM #EnglishRemainingDuplicateExport q JOIN Duplicates d ON d.word_key=q.word_key
ORDER BY q.word_key,q.id
FOR XML PATH('card'),ROOT('english_duplicates'),TYPE;
DROP TABLE #EnglishRemainingDuplicateExport;
