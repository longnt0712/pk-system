-- READ ONLY. SQL Server 2008 R2. Export current duplicate cards for semantic review.
-- Run in the ecommerce database; click the XML result and save as UTF-8 XML.
SET NOCOUNT ON;
DECLARE @owner bigint;
SELECT @owner=id FROM dbo.tbl_user WHERE username=N'english';
IF OBJECT_ID('tempdb..#EnglishDuplicateExport') IS NOT NULL DROP TABLE #EnglishDuplicateExport;
SELECT q.id, q.question AS word, q.mother_tongue AS meaning,
       q.pronounce AS ipa, q.level AS cefr, q.status,
       q.correct_answer AS correct, q.wrong_answer AS wrong, q.time_reviewed AS reviewed,
       q.modify_date AS modified,
       LOWER(LTRIM(RTRIM(CONVERT(nvarchar(200),q.question)))) COLLATE Latin1_General_CI_AS AS word_key
INTO #EnglishDuplicateExport
FROM dbo.tbl_question q
WHERE q.user_id=@owner AND q.question_type=6 AND q.parent_id IS NULL
  AND DATALENGTH(LTRIM(RTRIM(CONVERT(nvarchar(max),q.question)))) BETWEEN 2 AND 400;
CREATE INDEX IX_EnglishDuplicateExport_word ON #EnglishDuplicateExport(word_key);
;WITH Duplicates AS (
    SELECT word_key FROM #EnglishDuplicateExport WHERE word_key<>N'' GROUP BY word_key HAVING COUNT(*)>1
)
SELECT q.id,q.word,q.meaning,q.ipa,q.cefr,q.status,q.correct,q.wrong,q.reviewed,q.modified
FROM #EnglishDuplicateExport q JOIN Duplicates d ON d.word_key=q.word_key
ORDER BY q.word_key,q.id
FOR XML PATH('card'), ROOT('english_duplicates'), TYPE;
