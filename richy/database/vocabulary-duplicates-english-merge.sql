/*
   GỘP TỪ TRÙNG - CHỈ TÀI KHOẢN english - SQL SERVER 2008 R2
   Mặc định @Apply=0: chỉ xem danh sách, không sửa dữ liệu.
   @Apply=1: giữ ID nhỏ nhất cho các bản cùng từ và cùng nghĩa đã chuẩn hóa
   khoảng trắng; gộp toàn bộ liên kết topic, giữ ID câu trả lời/lịch sử.
   Phiên âm, CEFR, mô tả và trạng thái giữ theo bản chính.
   Nghĩa gần nhau chỉ gộp theo danh sách ID đối chiếu từ XML ngày 08/11/2026.
   Chỉ giữ một định nghĩa có sẵn đã chọn; không nối thêm các nghĩa bằng dấu /.
   @MergeTestReferences=1: cho phép chuyển các tham chiếu bài giao/kết quả
   của THẺ TỪ về bản chính; giữ nguyên ID task và ID kết quả.
   Các đề có câu con vẫn cần xử lý riêng để không trộn cấu trúc câu hỏi.
   Chạy toàn bộ file trong database ecommerce. Không cần JAR mới.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_WARNINGS ON;
DECLARE @Apply bit = 0;
DECLARE @MergeTestReferences bit = 0;
DECLARE @Username nvarchar(100) = N'english';
DECLARE @ExpectedDatabase sysname = N'ecommerce';
DECLARE @Owner bigint, @OwnerCount int, @Locked bigint;
DECLARE @Prefix sysname, @Sql nvarchar(max), @Error nvarchar(2048);

IF @@TRANCOUNT<>0
BEGIN
    RAISERROR(N'Hãy chạy file trong tab không có transaction đang mở.',16,1);
    RETURN;
END;

-- Các cặp gần nghĩa đã được đối chiếu sẽ được khai báo tại đây.
-- Không suy đoán nghĩa bằng LIKE/SOUNDEX hoặc chỉ dựa vào độ giống ký tự.
IF OBJECT_ID('tempdb..#VM_Reviewed') IS NOT NULL DROP TABLE #VM_Reviewed;
CREATE TABLE #VM_Reviewed (
    source_id bigint NOT NULL PRIMARY KEY,
    primary_id bigint NOT NULL,
    expected_word nvarchar(200) NOT NULL,
    expected_primary_meaning nvarchar(500) NOT NULL,
    expected_source_meaning nvarchar(500) NOT NULL,
    meaning_after nvarchar(500) NOT NULL
);
-- REVIEWED_MEANINGS_START
-- REVIEWED_MEANINGS_END

IF OBJECT_ID('tempdb..#VM_ReviewedIds') IS NOT NULL DROP TABLE #VM_ReviewedIds;
IF OBJECT_ID('tempdb..#VM_ProtectedIds') IS NOT NULL DROP TABLE #VM_ProtectedIds;
IF OBJECT_ID('tempdb..#VM_Words') IS NOT NULL DROP TABLE #VM_Words;
IF OBJECT_ID('tempdb..#VM_Plan') IS NOT NULL DROP TABLE #VM_Plan;
IF OBJECT_ID('tempdb..#VM_Targets') IS NOT NULL DROP TABLE #VM_Targets;
IF OBJECT_ID('tempdb..#VM_Sums') IS NOT NULL DROP TABLE #VM_Sums;
IF OBJECT_ID('tempdb..#VM_Topics') IS NOT NULL DROP TABLE #VM_Topics;
IF OBJECT_ID('tempdb..#VM_Categories') IS NOT NULL DROP TABLE #VM_Categories;
IF OBJECT_ID('tempdb..#VM_TopicRows') IS NOT NULL DROP TABLE #VM_TopicRows;
IF OBJECT_ID('tempdb..#VM_CategoryRows') IS NOT NULL DROP TABLE #VM_CategoryRows;
IF OBJECT_ID('tempdb..#VM_Answers') IS NOT NULL DROP TABLE #VM_Answers;
IF OBJECT_ID('tempdb..#VM_TaskRefs') IS NOT NULL DROP TABLE #VM_TaskRefs;
IF OBJECT_ID('tempdb..#VM_ResultRefs') IS NOT NULL DROP TABLE #VM_ResultRefs;
IF OBJECT_ID('tempdb..#VM_Invalid') IS NOT NULL DROP TABLE #VM_Invalid;

BEGIN TRY
    IF DB_NAME()<>@ExpectedDatabase
        RAISERROR(N'Đang chọn sai database. Hãy chọn ecommerce trước khi chạy.',16,1);
    IF OBJECT_ID('dbo.tbl_question','U') IS NULL OR OBJECT_ID('dbo.tbl_user','U') IS NULL
        OR OBJECT_ID('dbo.tbl_question_topic','U') IS NULL OR OBJECT_ID('dbo.tbl_question_answer','U') IS NULL
        OR OBJECT_ID('dbo.tbl_category','U') IS NULL
        OR COL_LENGTH('dbo.tbl_enrolment_class_schedule_task','source_question_id') IS NULL
        OR COL_LENGTH('dbo.tbl_enrolment_class_schedule_task','ielts_test_id') IS NULL
        OR COL_LENGTH('dbo.tbl_test_result','source_question_id') IS NULL
        RAISERROR(N'Schema không khớp với ứng dụng hiện tại. Chưa gộp từ.',16,1);

    SELECT @OwnerCount=COUNT(*),@Owner=MIN(id) FROM dbo.tbl_user WHERE username=@Username;
    IF @OwnerCount<>1 OR @Username<>N'english'
        RAISERROR(N'Không xác định duy nhất được tài khoản english. Chưa gộp từ.',16,1);

    CREATE TABLE #VM_Words (
        id bigint NOT NULL PRIMARY KEY,
        word_text nvarchar(200) COLLATE Latin1_General_BIN2 NOT NULL,
        word_key nvarchar(200) COLLATE Latin1_General_CI_AS NOT NULL,
        meaning_text nvarchar(500) COLLATE Latin1_General_BIN2 NOT NULL,
        meaning_key nvarchar(500) COLLATE Latin1_General_BIN2 NOT NULL,
        ipa nvarchar(255) NULL, cefr nvarchar(2) NULL, status int NULL,
        correct bigint NOT NULL, wrong bigint NOT NULL, reviewed bigint NOT NULL,
        modified datetime2 NULL
    );
    -- Gom các tham chiếu cần bảo vệ một lần để không quét lịch sử cho từng thẻ.
    SELECT parent_id AS id INTO #VM_ProtectedIds FROM dbo.tbl_question WHERE parent_id IS NOT NULL
    UNION SELECT source_question_id FROM dbo.tbl_enrolment_class_schedule_task WHERE @MergeTestReferences=0 AND source_question_id IS NOT NULL
    UNION SELECT ielts_test_id FROM dbo.tbl_enrolment_class_schedule_task WHERE @MergeTestReferences=0 AND ielts_test_id IS NOT NULL
    UNION SELECT source_question_id FROM dbo.tbl_test_result WHERE @MergeTestReferences=0 AND source_question_id IS NOT NULL;
    CREATE UNIQUE CLUSTERED INDEX IX_VM_ProtectedIds ON #VM_ProtectedIds(id);
    -- Đọc trước, chưa giữ khóa ghi trên toàn bộ kho từ.
    INSERT #VM_Words
    SELECT q.id, LTRIM(RTRIM(CONVERT(nvarchar(200),q.question))),
           LOWER(LTRIM(RTRIM(CONVERT(nvarchar(200),q.question)))),
           LTRIM(RTRIM(CONVERT(nvarchar(500),ISNULL(q.mother_tongue,N'')))),
           LTRIM(RTRIM(CONVERT(nvarchar(500),ISNULL(q.mother_tongue,N'')))),
           q.pronounce,q.level,q.status,
           ISNULL(q.correct_answer,0),ISNULL(q.wrong_answer,0),ISNULL(q.time_reviewed,0),q.modify_date
    FROM dbo.tbl_question q
    WHERE q.user_id=@Owner AND q.question_type=6 AND q.parent_id IS NULL AND ISNULL(q.voided,0)=0
      AND DATALENGTH(LTRIM(RTRIM(CONVERT(nvarchar(max),q.question)))) BETWEEN 2 AND 400
      AND DATALENGTH(LTRIM(RTRIM(CONVERT(nvarchar(max),ISNULL(q.mother_tongue,N'')))))<=1000
      AND NOT EXISTS (SELECT 1 FROM #VM_ProtectedIds protected WHERE protected.id=q.id);
    UPDATE #VM_Words SET
        word_key=LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(REPLACE(word_key,NCHAR(160),N' '),CHAR(9),N' '),CHAR(13),N' '),CHAR(10),N' '))),
        meaning_key=LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(REPLACE(meaning_key,NCHAR(160),N' '),CHAR(9),N' '),CHAR(13),N' '),CHAR(10),N' ')));
    WHILE EXISTS (SELECT 1 FROM #VM_Words WHERE word_key LIKE N'%  %' OR meaning_key LIKE N'%  %')
        UPDATE #VM_Words SET word_key=REPLACE(word_key,N'  ',N' '), meaning_key=REPLACE(meaning_key,N'  ',N' ')
        WHERE word_key LIKE N'%  %' OR meaning_key LIKE N'%  %';
    CREATE INDEX IX_VM_Words_word ON #VM_Words(word_key) INCLUDE(meaning_key);

    -- Chạy lại sau khi đã gộp: chỉ bỏ qua cặp đã mất bản phụ và bản chính đúng nghĩa cuối.
    DELETE r FROM #VM_Reviewed r JOIN #VM_Words p ON p.id=r.primary_id
    WHERE NOT EXISTS (SELECT 1 FROM dbo.tbl_question q WHERE q.id=r.source_id)
      AND p.word_key=LOWER(LTRIM(RTRIM(r.expected_word))) COLLATE Latin1_General_CI_AS
      AND p.meaning_text=LTRIM(RTRIM(r.meaning_after)) COLLATE Latin1_General_BIN2;
    CREATE INDEX IX_VM_Reviewed_primary ON #VM_Reviewed(primary_id);
    SELECT source_id AS id INTO #VM_ReviewedIds FROM #VM_Reviewed UNION SELECT primary_id FROM #VM_Reviewed;
    CREATE UNIQUE CLUSTERED INDEX IX_VM_ReviewedIds ON #VM_ReviewedIds(id);
    SELECT r.primary_id,r.source_id,r.expected_word,
           r.expected_primary_meaning,r.expected_source_meaning,
           CONVERT(nvarchar(max),qp.question) AS current_primary_word,
           CONVERT(nvarchar(max),qs.question) AS current_source_word,
           CONVERT(nvarchar(max),qp.mother_tongue) AS current_primary_meaning,
           CONVERT(nvarchar(max),qs.mother_tongue) AS current_source_meaning,
           qp.user_id AS primary_owner,qs.user_id AS source_owner,
           qp.voided AS primary_voided,qs.voided AS source_voided,
           CASE WHEN qp.id IS NULL OR qs.id IS NULL THEN N'ID không còn tồn tại'
                WHEN qp.user_id<>@Owner OR qs.user_id<>@Owner THEN N'Khác tài khoản english'
                WHEN qp.question_type<>6 OR qs.question_type<>6 OR qp.parent_id IS NOT NULL OR qs.parent_id IS NOT NULL THEN N'Không phải thẻ từ gốc loại 6'
                WHEN ISNULL(qp.voided,0)<>0 OR ISNULL(qs.voided,0)<>0 THEN N'Thẻ đã được đánh dấu voided'
                WHEN bp.id IS NOT NULL OR bs.id IS NOT NULL THEN N'Có câu con hoặc tham chiếu chưa cho phép gộp'
                WHEN p.id IS NULL OR s.id IS NULL THEN N'Từ/nghĩa quá giới hạn hoặc thẻ không đủ điều kiện'
                WHEN p.word_key<>s.word_key OR p.word_key<>LOWER(LTRIM(RTRIM(r.expected_word))) COLLATE Latin1_General_CI_AS THEN N'Từ tiếng Anh không khớp XML'
                WHEN p.meaning_text<>LTRIM(RTRIM(r.expected_primary_meaning)) COLLATE Latin1_General_BIN2 THEN N'Nghĩa bản chính không khớp XML'
                WHEN s.meaning_text<>LTRIM(RTRIM(r.expected_source_meaning)) COLLATE Latin1_General_BIN2 THEN N'Nghĩa bản phụ không khớp XML'
                ELSE N'Cặp ID hoặc nghĩa cuối không hợp lệ' END AS blocking_reason
    INTO #VM_Invalid
    FROM #VM_Reviewed r LEFT JOIN #VM_Words p ON p.id=r.primary_id LEFT JOIN #VM_Words s ON s.id=r.source_id
        LEFT JOIN dbo.tbl_question qp ON qp.id=r.primary_id LEFT JOIN dbo.tbl_question qs ON qs.id=r.source_id
        LEFT JOIN #VM_ProtectedIds bp ON bp.id=r.primary_id LEFT JOIN #VM_ProtectedIds bs ON bs.id=r.source_id
        WHERE p.id IS NULL OR s.id IS NULL OR p.id=s.id OR p.word_key<>s.word_key
          OR p.word_key<>LOWER(LTRIM(RTRIM(r.expected_word))) COLLATE Latin1_General_CI_AS
          OR p.meaning_text<>LTRIM(RTRIM(r.expected_primary_meaning)) COLLATE Latin1_General_BIN2
          OR s.meaning_text<>LTRIM(RTRIM(r.expected_source_meaning)) COLLATE Latin1_General_BIN2
          OR LTRIM(RTRIM(r.meaning_after))=N''
    ;
    IF EXISTS (SELECT 1 FROM #VM_Invalid)
    BEGIN
        SELECT blocking_reason,COUNT(*) AS blocked_pairs FROM #VM_Invalid GROUP BY blocking_reason;
        SELECT * FROM #VM_Invalid ORDER BY expected_word,primary_id,source_id;
        RAISERROR(N'DANH SÁCH ĐỐI CHIẾU BỊ CHẶN: xem bảng Results để biết ID và lý do cụ thể. Chưa gộp từ.',16,1);
    END;
    IF EXISTS (SELECT 1 FROM #VM_Reviewed a JOIN #VM_Reviewed b ON a.primary_id=b.source_id)
        OR EXISTS (SELECT primary_id FROM #VM_Reviewed GROUP BY primary_id HAVING COUNT(DISTINCT meaning_after COLLATE Latin1_General_BIN2)>1)
        RAISERROR(N'Danh sách đối chiếu có chuỗi ID hoặc nghĩa cuối không nhất quán. Chưa gộp từ.',16,1);

    CREATE TABLE #VM_Plan (source_id bigint NOT NULL PRIMARY KEY, primary_id bigint NOT NULL, meaning_after nvarchar(500) NOT NULL, reason nvarchar(30) NOT NULL);
    INSERT #VM_Plan SELECT source_id,primary_id,LTRIM(RTRIM(meaning_after)),N'Đã đối chiếu nghĩa' FROM #VM_Reviewed;
    ;WITH ExactGroups AS (
        SELECT word_key,meaning_key,MIN(id) AS primary_id
        FROM #VM_Words w
        WHERE word_key<>N'' AND meaning_key<>N''
          AND NOT EXISTS (SELECT 1 FROM #VM_ReviewedIds r WHERE r.id=w.id)
        GROUP BY word_key,meaning_key HAVING COUNT(*)>1
    )
    INSERT #VM_Plan
    SELECT w.id,g.primary_id,p.meaning_text,N'Cùng từ, cùng nghĩa'
    FROM #VM_Words w JOIN ExactGroups g ON g.word_key=w.word_key AND g.meaning_key=w.meaning_key
    JOIN #VM_Words p ON p.id=g.primary_id WHERE w.id<>g.primary_id
      AND NOT EXISTS (SELECT 1 FROM #VM_ReviewedIds r WHERE r.id=w.id);

    -- Bảng 1: số nhóm và số bản phụ dự kiến được gộp.
    SELECT DB_NAME() AS database_name,@Username AS username,@Owner AS user_id,@Apply AS apply_changes,
           @MergeTestReferences AS transfer_test_references,COUNT(DISTINCT primary_id) AS merge_groups,COUNT(*) AS redundant_cards FROM #VM_Plan;
    -- Bảng 2: danh sách ID chính/phụ, nghĩa và cách chọn từng bản.
    SELECT p.word_text AS word,m.primary_id,m.source_id,p.meaning_text AS primary_meaning,
           s.meaning_text AS source_meaning,m.meaning_after,p.ipa AS primary_ipa,p.cefr AS primary_cefr,m.reason
    FROM #VM_Plan m JOIN #VM_Words p ON p.id=m.primary_id JOIN #VM_Words s ON s.id=m.source_id
    ORDER BY p.word_key,m.primary_id,m.source_id;
    -- Bảng 3: các thẻ sẽ còn trùng chữ sau kế hoạch; không mặc nhiên coi là cùng nghĩa.
    ;WITH Remaining AS (
        SELECT w.id,w.word_text,w.word_key,w.ipa,w.cefr,ISNULL(p.meaning_after,w.meaning_text) AS meaning
        FROM #VM_Words w
        LEFT JOIN (SELECT primary_id,MAX(meaning_after) AS meaning_after FROM #VM_Plan GROUP BY primary_id) p ON p.primary_id=w.id
        WHERE NOT EXISTS (SELECT 1 FROM #VM_Plan m WHERE m.source_id=w.id)
    ), OtherSenses AS (SELECT word_key FROM Remaining GROUP BY word_key HAVING COUNT(*)>1)
    SELECT r.word_text AS word,r.id,r.meaning,r.ipa,r.cefr,N'Giữ riêng - khác nghĩa hoặc cần đối chiếu thêm' AS review_state
    FROM Remaining r JOIN OtherSenses o ON o.word_key=r.word_key ORDER BY r.word_key,r.id;
    IF @MergeTestReferences=1
    BEGIN
        SELECT N'Giữ ID bài giao; chuyển tham chiếu thẻ từ về bản chính' AS reference_action,COUNT(*) AS affected_tasks
        FROM dbo.tbl_enrolment_class_schedule_task t
        WHERE EXISTS (SELECT 1 FROM #VM_Plan p WHERE p.source_id=t.source_question_id OR p.source_id=t.ielts_test_id);
        SELECT N'Giữ ID kết quả; chuyển tham chiếu thẻ từ về bản chính' AS reference_action,COUNT(*) AS affected_results
        FROM dbo.tbl_test_result t WHERE EXISTS (SELECT 1 FROM #VM_Plan p WHERE p.source_id=t.source_question_id);
    END;

    IF @Apply=0
    BEGIN
        SELECT N'CHỈ XEM TRƯỚC - không thay đổi dữ liệu. Đổi @Apply=1 sau khi kiểm tra Bảng 2 để thực hiện.' AS message;
        RETURN;
    END;
    IF NOT EXISTS (SELECT 1 FROM #VM_Plan)
    BEGIN
        SELECT N'KHÔNG CÒN CẶP ĐỦ ĐIỀU KIỆN - không thay đổi dữ liệu.' AS message;
        RETURN;
    END;

    BEGIN TRANSACTION;
    -- Cùng khóa tài khoản với import/merge trên web; chỉ khóa các thẻ có trong kế hoạch.
    -- Nếu đang bị khóa bởi tác vụ khác thì dừng, không chờ và không đổi LOCK_TIMEOUT của phiên.
    SELECT @Locked=id FROM dbo.tbl_user WITH(UPDLOCK,HOLDLOCK,NOWAIT) WHERE id=@Owner AND username=@Username;
    IF @Locked IS NULL RAISERROR(N'Tài khoản đã thay đổi. Chưa gộp từ.',16,1);
    SELECT source_id AS original_id,primary_id AS canonical_id INTO #VM_Targets FROM #VM_Plan
    UNION SELECT primary_id,primary_id FROM #VM_Plan;
    CREATE UNIQUE CLUSTERED INDEX IX_VM_Targets ON #VM_Targets(original_id);
    SELECT @Locked=q.id FROM dbo.tbl_question q WITH(UPDLOCK,HOLDLOCK,NOWAIT) JOIN #VM_Targets t ON t.original_id=q.id;
    IF EXISTS (
        SELECT 1 FROM #VM_Targets t JOIN #VM_Words w ON w.id=t.original_id LEFT JOIN dbo.tbl_question q ON q.id=w.id
        WHERE q.id IS NULL OR q.user_id IS NULL OR q.user_id<>@Owner OR q.question_type IS NULL OR q.question_type<>6
          OR q.parent_id IS NOT NULL OR ISNULL(q.voided,0)<>0
          OR ISNULL(LTRIM(RTRIM(CONVERT(nvarchar(max),q.question))),N'') COLLATE Latin1_General_BIN2<>w.word_text
          OR ISNULL(LTRIM(RTRIM(CONVERT(nvarchar(max),q.mother_tongue))),N'') COLLATE Latin1_General_BIN2<>w.meaning_text
          OR ISNULL(q.pronounce,N'') COLLATE Latin1_General_BIN2<>ISNULL(w.ipa,N'') COLLATE Latin1_General_BIN2
          OR ISNULL(q.level,N'') COLLATE Latin1_General_BIN2<>ISNULL(w.cefr,N'') COLLATE Latin1_General_BIN2
          OR ISNULL(q.status,0)<>ISNULL(w.status,0)
          OR ISNULL(q.correct_answer,0)<>w.correct OR ISNULL(q.wrong_answer,0)<>w.wrong OR ISNULL(q.time_reviewed,0)<>w.reviewed
          OR q.modify_date<>w.modified OR (q.modify_date IS NULL AND w.modified IS NOT NULL) OR (q.modify_date IS NOT NULL AND w.modified IS NULL)
    )
        RAISERROR(N'Có thẻ vừa được sửa sau khi lập kế hoạch. Chưa gộp nhóm nào; hãy chạy lại xem trước.',16,1);
    IF EXISTS (SELECT 1 FROM dbo.tbl_question child WITH(HOLDLOCK,NOWAIT) JOIN #VM_Targets t ON t.original_id=child.parent_id)
        RAISERROR(N'Có thẻ chứa câu con. Cần đối chiếu cấu trúc riêng; chưa gộp nhóm nào.',16,1);
    IF @MergeTestReferences=0 AND (
        EXISTS (SELECT 1 FROM dbo.tbl_enrolment_class_schedule_task task WITH(HOLDLOCK,NOWAIT) JOIN #VM_Targets t ON t.original_id=task.source_question_id OR t.original_id=task.ielts_test_id)
        OR EXISTS (SELECT 1 FROM dbo.tbl_test_result result WITH(HOLDLOCK,NOWAIT) JOIN #VM_Targets t ON t.original_id=result.source_question_id))
        RAISERROR(N'Tham chiếu bài giao/kết quả chưa được cho phép chuyển. Chưa gộp nhóm nào.',16,1);

    SELECT t.canonical_id,SUM(CONVERT(bigint,ISNULL(q.correct_answer,0))) AS correct,
           SUM(CONVERT(bigint,ISNULL(q.wrong_answer,0))) AS wrong,SUM(CONVERT(bigint,ISNULL(q.time_reviewed,0))) AS reviewed
    INTO #VM_Sums FROM #VM_Targets t JOIN dbo.tbl_question q ON q.id=t.original_id GROUP BY t.canonical_id;
    IF EXISTS (SELECT 1 FROM #VM_Sums WHERE correct>2147483647 OR correct<0 OR wrong>2147483647 OR wrong<0 OR reviewed>2147483647 OR reviewed<0)
        RAISERROR(N'Tổng lượt luyện vượt giới hạn. Chưa gộp nhóm nào.',16,1);

    SELECT DISTINCT t.canonical_id,l.topic INTO #VM_Topics
    FROM dbo.tbl_question_topic l WITH(UPDLOCK,HOLDLOCK,NOWAIT) JOIN #VM_Targets t ON t.original_id=l.question WHERE l.topic IS NOT NULL;
    SELECT DISTINCT t.canonical_id,l.category INTO #VM_Categories
    FROM dbo.tbl_category l WITH(UPDLOCK,HOLDLOCK,NOWAIT) JOIN #VM_Targets t ON t.original_id=l.question WHERE l.category IS NOT NULL;
    SELECT l.id,t.canonical_id,l.topic,
           ROW_NUMBER() OVER(PARTITION BY t.canonical_id,l.topic ORDER BY CASE WHEN l.question=t.canonical_id THEN 0 ELSE 1 END,l.id) AS position
    INTO #VM_TopicRows FROM dbo.tbl_question_topic l WITH(UPDLOCK,HOLDLOCK,NOWAIT) JOIN #VM_Targets t ON t.original_id=l.question;
    SELECT l.id,t.canonical_id,l.category,
           ROW_NUMBER() OVER(PARTITION BY t.canonical_id,l.category ORDER BY CASE WHEN l.question=t.canonical_id THEN 0 ELSE 1 END,l.id) AS position
    INTO #VM_CategoryRows FROM dbo.tbl_category l WITH(UPDLOCK,HOLDLOCK,NOWAIT) JOIN #VM_Targets t ON t.original_id=l.question;
    SELECT a.id,t.canonical_id INTO #VM_Answers FROM dbo.tbl_question_answer a WITH(UPDLOCK,HOLDLOCK,NOWAIT) JOIN #VM_Targets t ON t.original_id=a.question;
    -- Giữ nguyên task/result; chỉ đổi cột tham chiếu thẻ từ đã gộp.
    SELECT t.id,t.source_question_id AS old_source_id,t.ielts_test_id AS old_test_id,
           ISNULL(ms.primary_id,t.source_question_id) AS source_after,
           ISNULL(mi.primary_id,t.ielts_test_id) AS test_after
    INTO #VM_TaskRefs FROM dbo.tbl_enrolment_class_schedule_task t WITH(UPDLOCK,HOLDLOCK,NOWAIT)
        LEFT JOIN #VM_Plan ms ON ms.source_id=t.source_question_id LEFT JOIN #VM_Plan mi ON mi.source_id=t.ielts_test_id
    WHERE @MergeTestReferences=1 AND (ms.source_id IS NOT NULL OR mi.source_id IS NOT NULL);
    CREATE UNIQUE CLUSTERED INDEX IX_VM_TaskRefs ON #VM_TaskRefs(id);
    SELECT t.id,t.source_question_id AS old_source_id,m.primary_id AS source_after
    INTO #VM_ResultRefs FROM dbo.tbl_test_result t WITH(UPDLOCK,HOLDLOCK,NOWAIT)
        JOIN #VM_Plan m ON m.source_id=t.source_question_id WHERE @MergeTestReferences=1;
    CREATE UNIQUE CLUSTERED INDEX IX_VM_ResultRefs ON #VM_ResultRefs(id);

    -- Sao lưu các dòng bị tác động trước khi sửa/xóa, cùng transaction.
    SET @Prefix=N'vocab_merge_english_'+CONVERT(nvarchar(8),GETDATE(),112)+N'_'+REPLACE(CONVERT(nvarchar(8),GETDATE(),108),N':',N'')+N'_'+LEFT(REPLACE(CONVERT(nvarchar(36),NEWID()),N'-',N''),8);
    SET @Sql=N'SELECT * INTO dbo.'+QUOTENAME(@Prefix+N'_map')+N' FROM #VM_Plan;'
        +N'SELECT q.* INTO dbo.'+QUOTENAME(@Prefix+N'_question')+N' FROM dbo.tbl_question q JOIN #VM_Targets t ON t.original_id=q.id;'
        +N'SELECT l.* INTO dbo.'+QUOTENAME(@Prefix+N'_question_topic')+N' FROM dbo.tbl_question_topic l JOIN #VM_Targets t ON t.original_id=l.question;'
        +N'SELECT l.* INTO dbo.'+QUOTENAME(@Prefix+N'_category')+N' FROM dbo.tbl_category l JOIN #VM_Targets t ON t.original_id=l.question;'
        +N'SELECT a.* INTO dbo.'+QUOTENAME(@Prefix+N'_question_answer')+N' FROM dbo.tbl_question_answer a JOIN #VM_Targets t ON t.original_id=a.question;';
    IF @MergeTestReferences=1 SET @Sql=@Sql
        +N'SELECT t.* INTO dbo.'+QUOTENAME(@Prefix+N'_schedule_task')+N' FROM dbo.tbl_enrolment_class_schedule_task t JOIN #VM_TaskRefs r ON r.id=t.id;'
        +N'SELECT t.* INTO dbo.'+QUOTENAME(@Prefix+N'_test_result')+N' FROM dbo.tbl_test_result t JOIN #VM_ResultRefs r ON r.id=t.id;';
    EXEC sys.sp_executesql @Sql;

    DELETE l FROM dbo.tbl_question_topic l JOIN #VM_TopicRows r ON r.id=l.id WHERE r.topic IS NOT NULL AND r.position>1;
    UPDATE l SET question=m.primary_id FROM dbo.tbl_question_topic l JOIN #VM_Plan m ON m.source_id=l.question;
    DELETE l FROM dbo.tbl_category l JOIN #VM_CategoryRows r ON r.id=l.id WHERE r.category IS NOT NULL AND r.position>1;
    UPDATE l SET question=m.primary_id FROM dbo.tbl_category l JOIN #VM_Plan m ON m.source_id=l.question;
    -- Chỉ đổi question của câu trả lời; không xóa/đổi ID câu trả lời hay test result.
    UPDATE a SET question=m.primary_id FROM dbo.tbl_question_answer a JOIN #VM_Plan m ON m.source_id=a.question;
    UPDATE t SET source_question_id=r.source_after,ielts_test_id=r.test_after
    FROM dbo.tbl_enrolment_class_schedule_task t JOIN #VM_TaskRefs r ON r.id=t.id;
    UPDATE t SET source_question_id=r.source_after FROM dbo.tbl_test_result t JOIN #VM_ResultRefs r ON r.id=t.id;
    UPDATE q SET mother_tongue=m.meaning_after,correct_answer=s.correct,wrong_answer=s.wrong,time_reviewed=s.reviewed,
                 modify_date=GETDATE(),modified_by=@Username
    FROM dbo.tbl_question q JOIN #VM_Sums s ON s.canonical_id=q.id
    JOIN (SELECT primary_id,MAX(meaning_after) AS meaning_after FROM #VM_Plan GROUP BY primary_id) m ON m.primary_id=q.id;
    DELETE q FROM dbo.tbl_question q JOIN #VM_Plan m ON m.source_id=q.id WHERE q.user_id=@Owner;
    IF @@ROWCOUNT<>(SELECT COUNT(*) FROM #VM_Plan) RAISERROR(N'Số bản phụ bị xóa không khớp kế hoạch. Hoàn tác toàn bộ.',16,1);

    IF EXISTS (SELECT canonical_id,topic FROM #VM_Topics EXCEPT SELECT l.question,l.topic FROM dbo.tbl_question_topic l JOIN #VM_Sums s ON s.canonical_id=l.question)
        OR EXISTS (SELECT canonical_id,category FROM #VM_Categories EXCEPT SELECT l.question,l.category FROM dbo.tbl_category l JOIN #VM_Sums s ON s.canonical_id=l.question)
        OR EXISTS (SELECT 1 FROM #VM_Answers old LEFT JOIN dbo.tbl_question_answer a ON a.id=old.id WHERE a.id IS NULL OR a.question<>old.canonical_id)
        OR EXISTS (SELECT 1 FROM #VM_TaskRefs old LEFT JOIN dbo.tbl_enrolment_class_schedule_task t ON t.id=old.id
                   WHERE t.id IS NULL OR ISNULL(t.source_question_id,-1)<>ISNULL(old.source_after,-1) OR ISNULL(t.ielts_test_id,-1)<>ISNULL(old.test_after,-1))
        OR EXISTS (SELECT 1 FROM #VM_ResultRefs old LEFT JOIN dbo.tbl_test_result t ON t.id=old.id
                   WHERE t.id IS NULL OR ISNULL(t.source_question_id,-1)<>ISNULL(old.source_after,-1))
        RAISERROR(N'Liên kết topic hoặc câu trả lời chưa đủ. Hoàn tác toàn bộ.',16,1);
    COMMIT TRANSACTION;
    SELECT N'ĐÃ GỘP THÀNH CÔNG' AS message,COUNT(DISTINCT primary_id) AS merged_groups,COUNT(*) AS removed_redundant_cards,
           @Prefix AS backup_table_prefix FROM #VM_Plan;
END TRY
BEGIN CATCH
    SET @Error=ERROR_MESSAGE();
    IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
    RAISERROR(N'%s',16,1,@Error);
END CATCH;
