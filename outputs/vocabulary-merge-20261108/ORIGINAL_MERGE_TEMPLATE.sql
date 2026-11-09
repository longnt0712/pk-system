/* GỘP BỔ SUNG V4.1 - CHỈ TÀI KHOẢN english - GIỮ NGUYÊN BẢN GỐC TRƯỚC 06/11/2026.
Sửa lỗi Msg 213 khi chạy sau V3 trong cùng tab SSMS: dùng bộ bảng tạm #VM4_ riêng.
Đây là các cụm mới đối chiếu SAU kế hoạch V3, không lặp lại số cụm cũ để báo thành quả mới.
Chọn database ecommerce, chạy TOÀN BỘ file. @Apply=0 xem trước, @Apply=1 gộp tối đa 1000 cụm/lượt.
Bản chính được chọn theo create_date trước 06/11, rồi ngày tạo cũ nhất và ID khi trùng ngày.
Giữ nguyên nghĩa, IPA, CEFR, mô tả, trạng thái, ngày tạo và ID bản chính; không tự nối / hay lấy nghĩa bản mới đè lên.
Gom topic/category, cộng bộ đếm và chuyển tham chiếu bài giao/lịch sử; giữ ID task/result/câu trả lời.
Bỏ qua cụm đã sửa khác kế hoạch hoặc không còn bản gốc đủ điều kiện. Không đoán ngày tạo từ ID.
Có backup cùng transaction, lỗi hoàn tác toàn lượt; chạy lại tự bỏ qua phần đã gộp.
Không cần frontend/JAR/migration mới. Không chạy script này đồng thời ở nhiều tab.
SHA-256 XML: 5ae5a6bfa07c766c6d406a0fca6d967655ac7b25c806757664857f32b7320795
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_WARNINGS ON;
DECLARE @Apply bit = 0;
DECLARE @OriginalBefore datetime2 = CONVERT(datetime2,'20261106',112); -- Chỉ giữ bản chính được tạo trước 06/11/2026.
DECLARE @MaxGroups int = 1000; -- Tối đa 1000 cụm/lượt; chạy lại để làm tiếp.
DECLARE @PreviewRows int = 200; -- Giới hạn số dòng mẫu để SSMS không bị chậm.
DECLARE @MergeTestReferences bit = 1;
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
IF OBJECT_ID('tempdb..#VM4_Approved') IS NOT NULL DROP TABLE #VM4_Approved;
CREATE TABLE #VM4_Approved (
    cluster_id int NOT NULL,
    member_id bigint NOT NULL PRIMARY KEY,
    expected_word nvarchar(200) NOT NULL,
    expected_meaning nvarchar(500) NOT NULL,
    previous_approved_meaning nvarchar(500) NULL,
    meaning_after nvarchar(500) NOT NULL
);
-- FAST_APPROVALS_START
-- FAST_APPROVALS_END
CREATE INDEX IX_VM_Approved_cluster ON #VM4_Approved(cluster_id);
IF OBJECT_ID('tempdb..#VM4_KnownMeanings') IS NOT NULL DROP TABLE #VM4_KnownMeanings;
CREATE TABLE #VM4_KnownMeanings(member_id bigint NOT NULL,meaning nvarchar(500) COLLATE Latin1_General_BIN2 NOT NULL);
-- KNOWN_MEANINGS_START
-- KNOWN_MEANINGS_END
CREATE INDEX IX_VM_KnownMeanings ON #VM4_KnownMeanings(member_id);


IF OBJECT_ID('tempdb..#VM4_ReviewedIds') IS NOT NULL DROP TABLE #VM4_ReviewedIds;
IF OBJECT_ID('tempdb..#VM4_ProtectedIds') IS NOT NULL DROP TABLE #VM4_ProtectedIds;
IF OBJECT_ID('tempdb..#VM4_Words') IS NOT NULL DROP TABLE #VM4_Words;
IF OBJECT_ID('tempdb..#VM4_Plan') IS NOT NULL DROP TABLE #VM4_Plan;
IF OBJECT_ID('tempdb..#VM4_Targets') IS NOT NULL DROP TABLE #VM4_Targets;
IF OBJECT_ID('tempdb..#VM4_Sums') IS NOT NULL DROP TABLE #VM4_Sums;
IF OBJECT_ID('tempdb..#VM4_Topics') IS NOT NULL DROP TABLE #VM4_Topics;
IF OBJECT_ID('tempdb..#VM4_Categories') IS NOT NULL DROP TABLE #VM4_Categories;
IF OBJECT_ID('tempdb..#VM4_TopicRows') IS NOT NULL DROP TABLE #VM4_TopicRows;
IF OBJECT_ID('tempdb..#VM4_CategoryRows') IS NOT NULL DROP TABLE #VM4_CategoryRows;
IF OBJECT_ID('tempdb..#VM4_Answers') IS NOT NULL DROP TABLE #VM4_Answers;
IF OBJECT_ID('tempdb..#VM4_TaskRefs') IS NOT NULL DROP TABLE #VM4_TaskRefs;
IF OBJECT_ID('tempdb..#VM4_ResultRefs') IS NOT NULL DROP TABLE #VM4_ResultRefs;
IF OBJECT_ID('tempdb..#VM4_Invalid') IS NOT NULL DROP TABLE #VM4_Invalid;

IF OBJECT_ID('tempdb..#VM4_FastSkipped') IS NOT NULL DROP TABLE #VM4_FastSkipped;
IF OBJECT_ID('tempdb..#VM4_FastEligible') IS NOT NULL DROP TABLE #VM4_FastEligible;

BEGIN TRY
    IF @MaxGroups<1 OR @MaxGroups>10000 OR @PreviewRows<1 OR @PreviewRows>100000
        RAISERROR(N'Số cụm hoặc số dòng xem trước không hợp lệ.',16,1);
    IF COL_LENGTH('dbo.tbl_question','create_date') IS NULL
        RAISERROR(N'Không có ngày tạo thẻ để xác định bản gốc. Chưa gộp từ.',16,1);
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

    CREATE TABLE #VM4_Words (
        id bigint NOT NULL PRIMARY KEY,
        word_text nvarchar(200) COLLATE Latin1_General_BIN2 NOT NULL,
        word_key nvarchar(200) COLLATE Latin1_General_CI_AS NOT NULL,
        meaning_text nvarchar(500) COLLATE Latin1_General_BIN2 NOT NULL,
        meaning_key nvarchar(500) COLLATE Latin1_General_BIN2 NOT NULL,
        ipa nvarchar(255) NULL, cefr nvarchar(2) NULL, status int NULL,
        correct bigint NOT NULL, wrong bigint NOT NULL, reviewed bigint NOT NULL,
        modified datetime2 NULL, created datetime2 NULL
    );
    -- Gom các tham chiếu cần bảo vệ một lần để không quét lịch sử cho từng thẻ.
    SELECT parent_id AS id INTO #VM4_ProtectedIds FROM dbo.tbl_question WHERE parent_id IS NOT NULL
    UNION SELECT source_question_id FROM dbo.tbl_enrolment_class_schedule_task WHERE @MergeTestReferences=0 AND source_question_id IS NOT NULL
    UNION SELECT ielts_test_id FROM dbo.tbl_enrolment_class_schedule_task WHERE @MergeTestReferences=0 AND ielts_test_id IS NOT NULL
    UNION SELECT source_question_id FROM dbo.tbl_test_result WHERE @MergeTestReferences=0 AND source_question_id IS NOT NULL;
    CREATE UNIQUE CLUSTERED INDEX IX_VM_ProtectedIds ON #VM4_ProtectedIds(id);
    -- Đọc trước, chưa giữ khóa ghi trên toàn bộ kho từ.
    INSERT #VM4_Words(id,word_text,word_key,meaning_text,meaning_key,ipa,cefr,status,correct,wrong,reviewed,modified,created)
    SELECT q.id, LTRIM(RTRIM(CONVERT(nvarchar(200),q.question))),
           LOWER(LTRIM(RTRIM(CONVERT(nvarchar(200),q.question)))),
           LTRIM(RTRIM(CONVERT(nvarchar(500),ISNULL(q.mother_tongue,N'')))),
           LTRIM(RTRIM(CONVERT(nvarchar(500),ISNULL(q.mother_tongue,N'')))),
           q.pronounce,q.level,q.status,
           ISNULL(q.correct_answer,0),ISNULL(q.wrong_answer,0),ISNULL(q.time_reviewed,0),q.modify_date,q.create_date
    FROM dbo.tbl_question q
    WHERE q.user_id=@Owner AND q.question_type=6 AND q.parent_id IS NULL AND ISNULL(q.voided,0)=0
      AND DATALENGTH(LTRIM(RTRIM(CONVERT(nvarchar(max),q.question)))) BETWEEN 2 AND 400
      AND DATALENGTH(LTRIM(RTRIM(CONVERT(nvarchar(max),ISNULL(q.mother_tongue,N'')))))<=1000
      AND NOT EXISTS (SELECT 1 FROM #VM4_ProtectedIds protected WHERE protected.id=q.id);
    UPDATE #VM4_Words SET
        word_key=LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(REPLACE(word_key,NCHAR(160),N' '),CHAR(9),N' '),CHAR(13),N' '),CHAR(10),N' '))),
        meaning_key=LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(REPLACE(meaning_key,NCHAR(160),N' '),CHAR(9),N' '),CHAR(13),N' '),CHAR(10),N' ')));
    WHILE EXISTS (SELECT 1 FROM #VM4_Words WHERE word_key LIKE N'%  %' OR meaning_key LIKE N'%  %')
        UPDATE #VM4_Words SET word_key=REPLACE(word_key,N'  ',N' '), meaning_key=REPLACE(meaning_key,N'  ',N' ')
        WHERE word_key LIKE N'%  %' OR meaning_key LIKE N'%  %';
    CREATE INDEX IX_VM_Words_word ON #VM4_Words(word_key) INCLUDE(meaning_key);

    -- Nhóm đã gộp/sửa tay không làm dừng các nhóm rõ ràng còn lại.
    -- ID mất được bỏ qua; bất kỳ ID còn sống nhưng đã đổi từ/nghĩa/chủ sở hữu
    -- thì bỏ qua TOÀN BỘ cụm, không ghi đè phần giáo viên vừa sửa.
    IF EXISTS (SELECT cluster_id FROM #VM4_Approved GROUP BY cluster_id
        HAVING COUNT(*)<2 OR COUNT(DISTINCT expected_word COLLATE Latin1_General_BIN2)<>1
            OR COUNT(DISTINCT meaning_after COLLATE Latin1_General_BIN2)<>1)
        OR EXISTS (SELECT 1 FROM #VM4_Approved WHERE LTRIM(RTRIM(meaning_after))=N'')
        RAISERROR(N'Kế hoạch đối chiếu không nhất quán. Chưa gộp từ.',16,1);

    SELECT DISTINCT a.cluster_id,a.expected_word,
        CASE WHEN q.user_id IS NULL OR q.user_id<>@Owner THEN N'Khác tài khoản english'
             WHEN q.question_type IS NULL OR q.question_type<>6 OR q.parent_id IS NOT NULL THEN N'Không phải thẻ từ gốc loại 6'
             WHEN ISNULL(q.voided,0)<>0 THEN N'Thẻ đã voided'
             WHEN p.id IS NOT NULL THEN N'Có câu con hoặc tham chiếu chưa được cho phép'
             WHEN w.id IS NULL THEN N'Thẻ không đủ điều kiện hoặc vượt giới hạn'
             WHEN w.word_key<>a.expected_word COLLATE Latin1_General_CI_AS THEN N'Từ đã thay đổi so với XML'
             ELSE N'Nghĩa đã sửa hoặc đã gộp thủ công; giữ nguyên' END AS reason
    INTO #VM4_FastSkipped
    FROM #VM4_Approved a JOIN dbo.tbl_question q ON q.id=a.member_id
        LEFT JOIN #VM4_Words w ON w.id=a.member_id
        LEFT JOIN #VM4_ProtectedIds p ON p.id=a.member_id
    WHERE w.id IS NULL OR w.word_key<>a.expected_word COLLATE Latin1_General_CI_AS
        OR NOT EXISTS (SELECT 1 FROM #VM4_KnownMeanings k WHERE k.member_id=a.member_id AND k.meaning=w.meaning_text COLLATE Latin1_General_BIN2);
    CREATE INDEX IX_VM_FastSkipped ON #VM4_FastSkipped(cluster_id);

    -- Không suy bản gốc từ ID hoặc modify_date: lấy ngày TẠO trực tiếp.
    ;WITH LiveClusters AS (
        SELECT a.cluster_id,COUNT(*) AS live_cards
        FROM #VM4_Approved a JOIN #VM4_Words w ON w.id=a.member_id
        WHERE NOT EXISTS (SELECT 1 FROM #VM4_FastSkipped s WHERE s.cluster_id=a.cluster_id)
        GROUP BY a.cluster_id HAVING COUNT(*)>1
    ), OriginalCandidates AS (
        SELECT a.cluster_id,w.id,
            ROW_NUMBER() OVER(PARTITION BY a.cluster_id ORDER BY w.created,w.id) AS position
        FROM #VM4_Approved a JOIN #VM4_Words w ON w.id=a.member_id
        WHERE w.created<@OriginalBefore AND LTRIM(RTRIM(w.meaning_text))<>N''
    )
    SELECT c.cluster_id,p.id AS primary_id,c.live_cards
    INTO #VM4_FastEligible FROM LiveClusters c JOIN OriginalCandidates p ON p.cluster_id=c.cluster_id AND p.position=1;
    CREATE UNIQUE CLUSTERED INDEX IX_VM_FastEligible ON #VM4_FastEligible(cluster_id);

    INSERT #VM4_FastSkipped(cluster_id,expected_word,reason)
    SELECT a.cluster_id,MIN(a.expected_word),N'Không còn bản gốc trước 06/11/2026'
    FROM #VM4_Approved a JOIN #VM4_Words w ON w.id=a.member_id
    WHERE NOT EXISTS (SELECT 1 FROM #VM4_FastSkipped s WHERE s.cluster_id=a.cluster_id)
        AND NOT EXISTS (SELECT 1 FROM #VM4_FastEligible e WHERE e.cluster_id=a.cluster_id)
    GROUP BY a.cluster_id HAVING COUNT(*)>1;

    CREATE TABLE #VM4_Plan (source_id bigint NOT NULL PRIMARY KEY,primary_id bigint NOT NULL,
        meaning_after nvarchar(500) NOT NULL,reason nvarchar(30) NOT NULL);
    INSERT #VM4_Plan(source_id,primary_id,meaning_after,reason)
    SELECT w.id,chosen.primary_id,original.meaning_text,N'Giữ nguyên bản gốc trước 06/11'
    FROM (SELECT TOP (@MaxGroups) cluster_id,primary_id FROM #VM4_FastEligible ORDER BY cluster_id) chosen
        JOIN #VM4_Approved a ON a.cluster_id=chosen.cluster_id JOIN #VM4_Words w ON w.id=a.member_id
        JOIN #VM4_Words original ON original.id=chosen.primary_id
    WHERE w.id<>chosen.primary_id;

    SELECT COUNT(*) AS eligible_groups_remaining_before_this_run,
        @MaxGroups AS group_limit_per_run,
        (SELECT COUNT(DISTINCT cluster_id) FROM #VM4_FastSkipped) AS skipped_changed_or_protected_groups
    FROM #VM4_FastEligible;
    SELECT reason,COUNT(DISTINCT cluster_id) AS skipped_groups FROM #VM4_FastSkipped GROUP BY reason;
    SELECT TOP (@PreviewRows) expected_word AS word,cluster_id,reason FROM #VM4_FastSkipped ORDER BY expected_word,cluster_id;

        -- Bảng 1: số nhóm và số bản phụ dự kiến được gộp.
    SELECT DB_NAME() AS database_name,@Username AS username,@Owner AS user_id,@Apply AS apply_changes,
           @MergeTestReferences AS transfer_test_references,COUNT(DISTINCT primary_id) AS merge_groups,COUNT(*) AS redundant_cards FROM #VM4_Plan;
    -- Bảng 2: danh sách ID chính/phụ, nghĩa và cách chọn từng bản.
    SELECT TOP (@PreviewRows) p.word_text AS word,m.primary_id,m.source_id,p.meaning_text AS primary_meaning,
           s.meaning_text AS source_meaning,m.meaning_after,p.created AS original_created_date,s.created AS source_created_date,p.ipa AS primary_ipa,p.cefr AS primary_cefr,m.reason
    FROM #VM4_Plan m JOIN #VM4_Words p ON p.id=m.primary_id JOIN #VM4_Words s ON s.id=m.source_id
    ORDER BY p.word_key,m.primary_id,m.source_id;
    -- Bảng 3: các thẻ sẽ còn trùng chữ sau kế hoạch; không mặc nhiên coi là cùng nghĩa.
    ;WITH Remaining AS (
        SELECT w.id,w.word_text,w.word_key,w.ipa,w.cefr,ISNULL(p.meaning_after,w.meaning_text) AS meaning
        FROM #VM4_Words w
        LEFT JOIN (SELECT primary_id,MAX(meaning_after) AS meaning_after FROM #VM4_Plan GROUP BY primary_id) p ON p.primary_id=w.id
        WHERE NOT EXISTS (SELECT 1 FROM #VM4_Plan m WHERE m.source_id=w.id)
    ), OtherSenses AS (SELECT word_key FROM Remaining GROUP BY word_key HAVING COUNT(*)>1)
    SELECT TOP (@PreviewRows) r.word_text AS word,r.id,r.meaning,r.ipa,r.cefr,N'Còn trùng sau lượt này; có thể đang chờ lượt tiếp theo hoặc cần duyệt riêng' AS review_state
    FROM Remaining r JOIN OtherSenses o ON o.word_key=r.word_key ORDER BY r.word_key,r.id;
    IF @MergeTestReferences=1
    BEGIN
        SELECT N'Giữ ID bài giao; chuyển tham chiếu thẻ từ về bản chính' AS reference_action,COUNT(*) AS affected_tasks
        FROM dbo.tbl_enrolment_class_schedule_task t
        WHERE EXISTS (SELECT 1 FROM #VM4_Plan p WHERE p.source_id=t.source_question_id OR p.source_id=t.ielts_test_id);
        SELECT N'Giữ ID kết quả; chuyển tham chiếu thẻ từ về bản chính' AS reference_action,COUNT(*) AS affected_results
        FROM dbo.tbl_test_result t WHERE EXISTS (SELECT 1 FROM #VM4_Plan p WHERE p.source_id=t.source_question_id);
    END;

    IF @Apply=0
    BEGIN
        SELECT N'CHỈ XEM TRƯỚC - không thay đổi dữ liệu. Đổi @Apply=1 sau khi kiểm tra Bảng 2 để thực hiện.' AS message;
        RETURN;
    END;
    IF NOT EXISTS (SELECT 1 FROM #VM4_Plan)
    BEGIN
        SELECT N'KHÔNG CÒN CẶP ĐỦ ĐIỀU KIỆN - không thay đổi dữ liệu.' AS message;
        RETURN;
    END;

    BEGIN TRANSACTION;
    -- Cùng khóa tài khoản với import/merge trên web; chỉ khóa các thẻ có trong kế hoạch.
    -- Nếu đang bị khóa bởi tác vụ khác thì dừng, không chờ và không đổi LOCK_TIMEOUT của phiên.
    SELECT @Locked=id FROM dbo.tbl_user WITH(UPDLOCK,HOLDLOCK,NOWAIT) WHERE id=@Owner AND username=@Username;
    IF @Locked IS NULL RAISERROR(N'Tài khoản đã thay đổi. Chưa gộp từ.',16,1);
    SELECT source_id AS original_id,primary_id AS canonical_id INTO #VM4_Targets FROM #VM4_Plan
    UNION SELECT primary_id,primary_id FROM #VM4_Plan;
    CREATE UNIQUE CLUSTERED INDEX IX_VM_Targets ON #VM4_Targets(original_id);
    SELECT @Locked=q.id FROM dbo.tbl_question q WITH(UPDLOCK,HOLDLOCK,NOWAIT) JOIN #VM4_Targets t ON t.original_id=q.id;
    IF EXISTS (
        SELECT 1 FROM #VM4_Targets t JOIN #VM4_Words w ON w.id=t.original_id LEFT JOIN dbo.tbl_question q ON q.id=w.id
        WHERE q.id IS NULL OR q.user_id IS NULL OR q.user_id<>@Owner OR q.question_type IS NULL OR q.question_type<>6
          OR q.parent_id IS NOT NULL OR ISNULL(q.voided,0)<>0
          OR ISNULL(LTRIM(RTRIM(CONVERT(nvarchar(max),q.question))),N'') COLLATE Latin1_General_BIN2<>w.word_text
          OR ISNULL(LTRIM(RTRIM(CONVERT(nvarchar(max),q.mother_tongue))),N'') COLLATE Latin1_General_BIN2<>w.meaning_text
          OR ISNULL(q.pronounce,N'') COLLATE Latin1_General_BIN2<>ISNULL(w.ipa,N'') COLLATE Latin1_General_BIN2
          OR ISNULL(q.level,N'') COLLATE Latin1_General_BIN2<>ISNULL(w.cefr,N'') COLLATE Latin1_General_BIN2
          OR ISNULL(q.status,0)<>ISNULL(w.status,0)
          OR ISNULL(q.correct_answer,0)<>w.correct OR ISNULL(q.wrong_answer,0)<>w.wrong OR ISNULL(q.time_reviewed,0)<>w.reviewed
          OR q.create_date<>w.created OR (q.create_date IS NULL AND w.created IS NOT NULL) OR (q.create_date IS NOT NULL AND w.created IS NULL)
          OR q.modify_date<>w.modified OR (q.modify_date IS NULL AND w.modified IS NOT NULL) OR (q.modify_date IS NOT NULL AND w.modified IS NULL)
    )
        RAISERROR(N'Có thẻ vừa được sửa sau khi lập kế hoạch. Chưa gộp nhóm nào; hãy chạy lại xem trước.',16,1);
    IF EXISTS (SELECT 1 FROM dbo.tbl_question child WITH(HOLDLOCK,NOWAIT) JOIN #VM4_Targets t ON t.original_id=child.parent_id)
        RAISERROR(N'Có thẻ chứa câu con. Cần đối chiếu cấu trúc riêng; chưa gộp nhóm nào.',16,1);
    IF @MergeTestReferences=0 AND (
        EXISTS (SELECT 1 FROM dbo.tbl_enrolment_class_schedule_task task WITH(HOLDLOCK,NOWAIT) JOIN #VM4_Targets t ON t.original_id=task.source_question_id OR t.original_id=task.ielts_test_id)
        OR EXISTS (SELECT 1 FROM dbo.tbl_test_result result WITH(HOLDLOCK,NOWAIT) JOIN #VM4_Targets t ON t.original_id=result.source_question_id))
        RAISERROR(N'Tham chiếu bài giao/kết quả chưa được cho phép chuyển. Chưa gộp nhóm nào.',16,1);

    SELECT t.canonical_id,SUM(CONVERT(bigint,ISNULL(q.correct_answer,0))) AS correct,
           SUM(CONVERT(bigint,ISNULL(q.wrong_answer,0))) AS wrong,SUM(CONVERT(bigint,ISNULL(q.time_reviewed,0))) AS reviewed
    INTO #VM4_Sums FROM #VM4_Targets t JOIN dbo.tbl_question q ON q.id=t.original_id GROUP BY t.canonical_id;
    IF EXISTS (SELECT 1 FROM #VM4_Sums WHERE correct>2147483647 OR correct<0 OR wrong>2147483647 OR wrong<0 OR reviewed>2147483647 OR reviewed<0)
        RAISERROR(N'Tổng lượt luyện vượt giới hạn. Chưa gộp nhóm nào.',16,1);

    SELECT DISTINCT t.canonical_id,l.topic INTO #VM4_Topics
    FROM dbo.tbl_question_topic l WITH(UPDLOCK,HOLDLOCK,NOWAIT) JOIN #VM4_Targets t ON t.original_id=l.question WHERE l.topic IS NOT NULL;
    SELECT DISTINCT t.canonical_id,l.category INTO #VM4_Categories
    FROM dbo.tbl_category l WITH(UPDLOCK,HOLDLOCK,NOWAIT) JOIN #VM4_Targets t ON t.original_id=l.question WHERE l.category IS NOT NULL;
    SELECT l.id,t.canonical_id,l.topic,
           ROW_NUMBER() OVER(PARTITION BY t.canonical_id,l.topic ORDER BY CASE WHEN l.question=t.canonical_id THEN 0 ELSE 1 END,l.id) AS position
    INTO #VM4_TopicRows FROM dbo.tbl_question_topic l WITH(UPDLOCK,HOLDLOCK,NOWAIT) JOIN #VM4_Targets t ON t.original_id=l.question;
    SELECT l.id,t.canonical_id,l.category,
           ROW_NUMBER() OVER(PARTITION BY t.canonical_id,l.category ORDER BY CASE WHEN l.question=t.canonical_id THEN 0 ELSE 1 END,l.id) AS position
    INTO #VM4_CategoryRows FROM dbo.tbl_category l WITH(UPDLOCK,HOLDLOCK,NOWAIT) JOIN #VM4_Targets t ON t.original_id=l.question;
    SELECT a.id,t.canonical_id INTO #VM4_Answers FROM dbo.tbl_question_answer a WITH(UPDLOCK,HOLDLOCK,NOWAIT) JOIN #VM4_Targets t ON t.original_id=a.question;
    -- Giữ nguyên task/result; chỉ đổi cột tham chiếu thẻ từ đã gộp.
    SELECT t.id,t.source_question_id AS old_source_id,t.ielts_test_id AS old_test_id,
           ISNULL(ms.primary_id,t.source_question_id) AS source_after,
           ISNULL(mi.primary_id,t.ielts_test_id) AS test_after
    INTO #VM4_TaskRefs FROM dbo.tbl_enrolment_class_schedule_task t WITH(UPDLOCK,HOLDLOCK,NOWAIT)
        LEFT JOIN #VM4_Plan ms ON ms.source_id=t.source_question_id LEFT JOIN #VM4_Plan mi ON mi.source_id=t.ielts_test_id
    WHERE @MergeTestReferences=1 AND (ms.source_id IS NOT NULL OR mi.source_id IS NOT NULL);
    CREATE UNIQUE CLUSTERED INDEX IX_VM_TaskRefs ON #VM4_TaskRefs(id);
    SELECT t.id,t.source_question_id AS old_source_id,m.primary_id AS source_after
    INTO #VM4_ResultRefs FROM dbo.tbl_test_result t WITH(UPDLOCK,HOLDLOCK,NOWAIT)
        JOIN #VM4_Plan m ON m.source_id=t.source_question_id WHERE @MergeTestReferences=1;
    CREATE UNIQUE CLUSTERED INDEX IX_VM_ResultRefs ON #VM4_ResultRefs(id);

    -- Sao lưu các dòng bị tác động trước khi sửa/xóa, cùng transaction.
    SET @Prefix=N'vocab_merge_english_'+CONVERT(nvarchar(8),GETDATE(),112)+N'_'+REPLACE(CONVERT(nvarchar(8),GETDATE(),108),N':',N'')+N'_'+LEFT(REPLACE(CONVERT(nvarchar(36),NEWID()),N'-',N''),8);
    SET @Sql=N'SELECT * INTO dbo.'+QUOTENAME(@Prefix+N'_map')+N' FROM #VM4_Plan;'
        +N'SELECT q.* INTO dbo.'+QUOTENAME(@Prefix+N'_question')+N' FROM dbo.tbl_question q JOIN #VM4_Targets t ON t.original_id=q.id;'
        +N'SELECT l.* INTO dbo.'+QUOTENAME(@Prefix+N'_question_topic')+N' FROM dbo.tbl_question_topic l JOIN #VM4_Targets t ON t.original_id=l.question;'
        +N'SELECT l.* INTO dbo.'+QUOTENAME(@Prefix+N'_category')+N' FROM dbo.tbl_category l JOIN #VM4_Targets t ON t.original_id=l.question;'
        +N'SELECT a.* INTO dbo.'+QUOTENAME(@Prefix+N'_question_answer')+N' FROM dbo.tbl_question_answer a JOIN #VM4_Targets t ON t.original_id=a.question;';
    IF @MergeTestReferences=1 SET @Sql=@Sql
        +N'SELECT t.* INTO dbo.'+QUOTENAME(@Prefix+N'_schedule_task')+N' FROM dbo.tbl_enrolment_class_schedule_task t JOIN #VM4_TaskRefs r ON r.id=t.id;'
        +N'SELECT t.* INTO dbo.'+QUOTENAME(@Prefix+N'_test_result')+N' FROM dbo.tbl_test_result t JOIN #VM4_ResultRefs r ON r.id=t.id;';
    EXEC sys.sp_executesql @Sql;

    DELETE l FROM dbo.tbl_question_topic l JOIN #VM4_TopicRows r ON r.id=l.id WHERE r.topic IS NOT NULL AND r.position>1;
    UPDATE l SET question=m.primary_id FROM dbo.tbl_question_topic l JOIN #VM4_Plan m ON m.source_id=l.question;
    DELETE l FROM dbo.tbl_category l JOIN #VM4_CategoryRows r ON r.id=l.id WHERE r.category IS NOT NULL AND r.position>1;
    UPDATE l SET question=m.primary_id FROM dbo.tbl_category l JOIN #VM4_Plan m ON m.source_id=l.question;
    -- Chỉ đổi question của câu trả lời; không xóa/đổi ID câu trả lời hay test result.
    UPDATE a SET question=m.primary_id FROM dbo.tbl_question_answer a JOIN #VM4_Plan m ON m.source_id=a.question;
    UPDATE t SET source_question_id=r.source_after,ielts_test_id=r.test_after
    FROM dbo.tbl_enrolment_class_schedule_task t JOIN #VM4_TaskRefs r ON r.id=t.id;
    UPDATE t SET source_question_id=r.source_after FROM dbo.tbl_test_result t JOIN #VM4_ResultRefs r ON r.id=t.id;
    UPDATE q SET correct_answer=s.correct,wrong_answer=s.wrong,time_reviewed=s.reviewed,
                 modify_date=GETDATE(),modified_by=@Username
    FROM dbo.tbl_question q JOIN #VM4_Sums s ON s.canonical_id=q.id
    JOIN (SELECT primary_id,MAX(meaning_after) AS meaning_after FROM #VM4_Plan GROUP BY primary_id) m ON m.primary_id=q.id;
    -- Chốt giữ nguyên nghĩa và ngày tạo của bản chính trước khi xóa bản phụ.
    IF EXISTS(SELECT 1 FROM #VM4_Sums s JOIN #VM4_Words w ON w.id=s.canonical_id
        JOIN dbo.tbl_question q ON q.id=s.canonical_id
        WHERE q.create_date IS NULL OR q.create_date>=@OriginalBefore OR q.create_date<>w.created
            OR ISNULL(LTRIM(RTRIM(CONVERT(nvarchar(max),q.mother_tongue))),N'') COLLATE Latin1_General_BIN2<>w.meaning_text)
        RAISERROR(N'Bản chính không còn đúng bản gốc hoặc nghĩa đã thay đổi. Hoàn tác lượt này.',16,1);
    DELETE q FROM dbo.tbl_question q JOIN #VM4_Plan m ON m.source_id=q.id WHERE q.user_id=@Owner;
    IF @@ROWCOUNT<>(SELECT COUNT(*) FROM #VM4_Plan) RAISERROR(N'Số bản phụ bị xóa không khớp kế hoạch. Hoàn tác toàn bộ.',16,1);

    IF EXISTS (SELECT canonical_id,topic FROM #VM4_Topics EXCEPT SELECT l.question,l.topic FROM dbo.tbl_question_topic l JOIN #VM4_Sums s ON s.canonical_id=l.question)
        OR EXISTS (SELECT canonical_id,category FROM #VM4_Categories EXCEPT SELECT l.question,l.category FROM dbo.tbl_category l JOIN #VM4_Sums s ON s.canonical_id=l.question)
        OR EXISTS (SELECT 1 FROM #VM4_Answers old LEFT JOIN dbo.tbl_question_answer a ON a.id=old.id WHERE a.id IS NULL OR a.question<>old.canonical_id)
        OR EXISTS (SELECT 1 FROM #VM4_TaskRefs old LEFT JOIN dbo.tbl_enrolment_class_schedule_task t ON t.id=old.id
                   WHERE t.id IS NULL OR ISNULL(t.source_question_id,-1)<>ISNULL(old.source_after,-1) OR ISNULL(t.ielts_test_id,-1)<>ISNULL(old.test_after,-1))
        OR EXISTS (SELECT 1 FROM #VM4_ResultRefs old LEFT JOIN dbo.tbl_test_result t ON t.id=old.id
                   WHERE t.id IS NULL OR ISNULL(t.source_question_id,-1)<>ISNULL(old.source_after,-1))
        RAISERROR(N'Liên kết topic hoặc câu trả lời chưa đủ. Hoàn tác toàn bộ.',16,1);
    COMMIT TRANSACTION;
    SELECT N'ĐÃ GỘP THÀNH CÔNG' AS message,COUNT(DISTINCT primary_id) AS merged_groups,COUNT(*) AS removed_redundant_cards,
           @Prefix AS backup_table_prefix FROM #VM4_Plan;
END TRY
BEGIN CATCH
    SET @Error=ERROR_MESSAGE();
    IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
    RAISERROR(N'%s',16,1,@Error);
END CATCH;
