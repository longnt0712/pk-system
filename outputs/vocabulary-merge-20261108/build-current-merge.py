"""Build a private, reviewed SQL plan from the fresh export. Does not access SQL Server."""
from pathlib import Path
from collections import Counter
import hashlib, json, re

OUT = Path(__file__).resolve().parent
XML = Path('C:/Users/Admin/Desktop/english-duplicates-remaining-20261108.xml')
HASH = '1447f9f681479bef5f88c25bc725e4cbbaa34e62a7878453733156ccda1b0f32'
assert hashlib.sha256(XML.read_bytes()).hexdigest() == HASH
GROUPS = json.loads((OUT/'remaining-current-groups.json').read_text(encoding='utf8'))
UNITS = json.loads((OUT/'current-review-units.json').read_text(encoding='utf8'))
REVIEW = json.loads((OUT/'current-manual-review.json').read_text(encoding='utf8'))
AUTO = json.loads((OUT/'current-auto-approvals.json').read_text(encoding='utf8'))
assert REVIEW['source_sha256'] == HASH
by_group = {g['n']: g for g in GROUPS}
cards = {c['id']: c for g in GROUPS for c in g['cards']}
plans = []
used = set()
end = 0
for batch in REVIEW['batches']:
    assert batch['from'] == end+1
    end = batch['to']
    for number, clusters in batch['approved_units'].items():
        number = int(number)
        assert batch['from'] <= number <= batch['to']
        group = UNITS[number-1]
        assert group['n'] == number
        for indices in clusters:
            assert len(indices) >= 2 and len(indices) == len(set(indices))
            selected = [group['units'][i-1] for i in indices]
            ids = [i for unit in selected for i in unit['ids']]
            assert not used.intersection(ids), group
            used.update(ids)
            plans.append({'word': group['word'], 'original_group': group['original_group'],
                          'ids': ids, 'reason': 'Đã đối chiếu nghĩa từng bản trong XML mới.'})
assert end == len(UNITS)
for approval in AUTO:
    overlap = used.intersection(approval['ids'])
    if overlap:
        # The complete literal subset unit is already part of a reviewed cluster.
        assert set(approval['ids']) <= used
        assert any(set(approval['ids']) <= set(p['ids']) for p in plans)
        continue
    used.update(approval['ids'])
    plans.append(approval)

def units(text): return len(text.encode('utf-16-le')) // 2
def lit(value): return 'NULL' if value is None else "N'"+str(value).replace("'", "''")+"'"
def insert(table, columns, rows):
    return '\n'.join('INSERT '+table+'('+columns+') VALUES\n'+',\n'.join('('+','.join(row)+')' for row in rows[i:i+150])+';'
                     for i in range(0, len(rows), 150))

for plan in plans:
    group = by_group[plan['original_group']]
    assert not group['reviewed']
    assert group['word'] == plan['word'] and set(plan['ids']) <= {c['id'] for c in group['cards']}
    originals = [cards[i] for i in plan['ids'] if cards[i].get('created') and cards[i]['created'] < '2026-11-06']
    assert originals, plan
    original = min(originals, key=lambda c: (c['created'], c['id']))
    assert original['meaning'].strip()
    assert all(units(cards[i].get('meaning','').strip()) <= 500 and units(cards[i]['word'].strip()) <= 200 for i in plan['ids']), plan
    plan['primary_id'] = original['id']
    plan['meaning_after'] = original['meaning']
plans.sort(key=lambda p: (p['word'], p['primary_id']))
for index, plan in enumerate(plans, 1): plan['cluster_id'] = index
assert len(used) == sum(len(p['ids']) for p in plans)

sql = (OUT/'ORIGINAL_MERGE_TEMPLATE.sql').read_text(encoding='utf8').replace('#VM4_', '#VM5_').replace('IX_VM_', 'IX_VM5_')
sql = re.sub(r'/\*.*?\*/', '''/* GỘP TỪ CÒN LẠI V5 - CHỈ TÀI KHOẢN english - SQL SERVER 2008 R2.
Đối chiếu toàn bộ XML còn lại xuất ngày 08/11/2026; hoàn tất duyệt nghĩa ngày 09/11/2026.
Chỉ gộp các bản CÙNG TỪ TIẾNG ANH và cùng/gần nghĩa đã được duyệt tường minh.
Không gộp các từ tiếng Anh khác nhau chỉ vì cùng nghĩa tiếng Việt.
Giữ nguyên bản chính được tạo trước 06/11/2026: ngày tạo cũ nhất, rồi ID khi trùng ngày.
KHÔNG đổi nghĩa, IPA, CEFR, mô tả, trạng thái, ngày tạo hoặc ID bản chính. Không nối nghĩa bằng /.
Hợp nhất liên kết topic/category, cộng bộ đếm và chuyển tham chiếu; giữ ID lịch sử, bài giao và kết quả.
157 nhóm Đã check trong XML KHÔNG có trong kế hoạch. Nếu bất kỳ bản còn sống trong nhóm
đã đổi nghĩa, từ, thông tin thẻ hoặc dấu check sau lúc xuất XML, bỏ qua cả nhóm đó.
Bản đã bị xóa được bỏ qua để có thể chạy tiếp các lượt sau; không tạo lại bản đã gộp.
Mặc định @Apply=0 CHỈ XEM. Sau khi kiểm tra, đổi thành 1 và chạy TOÀN BỘ file để gộp
tối đa 1000 cụm nghĩa/lượt. Chạy lại cho tới eligible_groups_remaining_before_this_run = 0.
Chọn database ecommerce. Không chạy đồng thời ở nhiều tab. Có backup và transaction từng lượt.
Không cần JAR, frontend hoặc SQL thay đổi schema ứng dụng. Không dùng bảng tạm của V3/V4.
SHA-256 XML: '''+HASH+''' 
*/''', sql, count=1, flags=re.S)

def change(old, new):
    global sql
    assert sql.count(old) == 1, old[:160]
    sql = sql.replace(old, new)

extra_tables = '''IF OBJECT_ID('tempdb..#VM5_Clusters') IS NOT NULL DROP TABLE #VM5_Clusters;
CREATE TABLE #VM5_Clusters(cluster_id int NOT NULL PRIMARY KEY,word_group int NOT NULL);
-- CURRENT_CLUSTERS_START
-- CURRENT_CLUSTERS_END
IF OBJECT_ID('tempdb..#VM5_ExportState') IS NOT NULL DROP TABLE #VM5_ExportState;
CREATE TABLE #VM5_ExportState(
    member_id bigint NOT NULL PRIMARY KEY,word_group int NOT NULL,
    word_text nvarchar(max) COLLATE Latin1_General_BIN2 NOT NULL,
    meaning_text nvarchar(max) COLLATE Latin1_General_BIN2 NOT NULL,
    ipa nvarchar(255) COLLATE Latin1_General_BIN2 NULL,cefr nvarchar(2) COLLATE Latin1_General_BIN2 NULL,
    status int NULL,created datetime2 NULL,
    review_key varchar(64) COLLATE Latin1_General_BIN2 NULL,review_at datetime2 NULL
);
-- CURRENT_STATE_START
-- CURRENT_STATE_END
CREATE INDEX IX_VM5_ExportState_group ON #VM5_ExportState(word_group);
IF OBJECT_ID('tempdb..#VM5_ChangedGroups') IS NOT NULL DROP TABLE #VM5_ChangedGroups;
IF OBJECT_ID('tempdb..#VM5_RunGroups') IS NOT NULL DROP TABLE #VM5_RunGroups;
'''
change('\n\nBEGIN TRY', '\n'+extra_tables+'\nBEGIN TRY')
change("IF COL_LENGTH('dbo.tbl_question','create_date') IS NULL", "IF COL_LENGTH('dbo.tbl_question','create_date') IS NULL\n        OR COL_LENGTH('dbo.tbl_question','duplicate_reviewed_key') IS NULL\n        OR COL_LENGTH('dbo.tbl_question','duplicate_reviewed_at') IS NULL")

# Compare ALL exported members of the word, including senses not selected for merging.
# Do not compare modify_date here: our own previous batch updates it along with counters.
STATE_PREDICATE = '''q.user_id IS NULL OR q.user_id<>@Owner OR q.question_type IS NULL OR q.question_type<>6
          OR q.parent_id IS NOT NULL OR ISNULL(q.voided,0)<>0
          OR CONVERT(nvarchar(max),ISNULL(q.question,N'')) COLLATE Latin1_General_BIN2<>s.word_text
          OR DATALENGTH(CONVERT(nvarchar(max),ISNULL(q.question,N'')))<>DATALENGTH(s.word_text)
          OR CONVERT(nvarchar(max),ISNULL(q.mother_tongue,N'')) COLLATE Latin1_General_BIN2<>s.meaning_text
          OR DATALENGTH(CONVERT(nvarchar(max),ISNULL(q.mother_tongue,N'')))<>DATALENGTH(s.meaning_text)
          OR ISNULL(q.pronounce,N'') COLLATE Latin1_General_BIN2<>ISNULL(s.ipa,N'')
          OR ISNULL(q.level,N'') COLLATE Latin1_General_BIN2<>ISNULL(s.cefr,N'')
          OR ISNULL(q.status,-2147483648)<>ISNULL(s.status,-2147483648)
          OR q.create_date<>s.created OR (q.create_date IS NULL AND s.created IS NOT NULL) OR (q.create_date IS NOT NULL AND s.created IS NULL)
          OR ISNULL(q.duplicate_reviewed_key,'') COLLATE Latin1_General_BIN2<>ISNULL(s.review_key,'')
          OR q.duplicate_reviewed_at<>s.review_at OR (q.duplicate_reviewed_at IS NULL AND s.review_at IS NOT NULL)
          OR (q.duplicate_reviewed_at IS NOT NULL AND s.review_at IS NULL)'''
state_check = '''
    SELECT DISTINCT s.word_group,N'Nhóm đã thay đổi thông tin hoặc dấu check sau lúc xuất XML' AS reason
    INTO #VM5_ChangedGroups
    FROM #VM5_ExportState s JOIN dbo.tbl_question q ON q.id=s.member_id
    WHERE '''+STATE_PREDICATE+''';
    INSERT #VM5_ChangedGroups(word_group,reason)
    SELECT DISTINCT s.word_group,N'Có thêm bản mới ngoài XML; cần đối chiếu lại nhóm'
    FROM #VM5_Words w JOIN #VM5_Approved a ON a.expected_word COLLATE Latin1_General_CI_AS=w.word_key
        JOIN #VM5_Clusters c ON c.cluster_id=a.cluster_id
        JOIN (SELECT DISTINCT word_group FROM #VM5_ExportState) s ON s.word_group=c.word_group
    WHERE NOT EXISTS(SELECT 1 FROM #VM5_ExportState e WHERE e.member_id=w.id);
    CREATE INDEX IX_VM5_ChangedGroups ON #VM5_ChangedGroups(word_group);
'''
change('    -- Nhóm đã gộp/sửa tay không làm dừng các nhóm rõ ràng còn lại.', state_check+'\n    -- Nhóm đã gộp/sửa tay không làm dừng các nhóm rõ ràng còn lại.')
change('    SELECT DISTINCT a.cluster_id,a.expected_word,\n        CASE WHEN', '''    CREATE TABLE #VM5_FastSkipped(cluster_id int NOT NULL,expected_word nvarchar(200) NOT NULL,reason nvarchar(200) NOT NULL);
    INSERT #VM5_FastSkipped(cluster_id,expected_word,reason)
    SELECT DISTINCT a.cluster_id,a.expected_word,
        CASE WHEN''')
change('    INTO #VM5_FastSkipped\n', '')
change('    CREATE INDEX IX_VM5_FastSkipped ON #VM5_FastSkipped(cluster_id);', '''    INSERT #VM5_FastSkipped(cluster_id,expected_word,reason)
    SELECT DISTINCT c.cluster_id,a.expected_word,g.reason
    FROM #VM5_ChangedGroups g JOIN #VM5_Clusters c ON c.word_group=g.word_group
        JOIN #VM5_Approved a ON a.cluster_id=c.cluster_id;
    CREATE INDEX IX_VM5_FastSkipped ON #VM5_FastSkipped(cluster_id);''')
lock_marker = '    SELECT @Locked=q.id FROM dbo.tbl_question q WITH(UPDLOCK,HOLDLOCK,NOWAIT) JOIN #VM5_Targets t ON t.original_id=q.id;'
change(lock_marker, '''    SELECT DISTINCT c.word_group INTO #VM5_RunGroups
    FROM #VM5_Targets t JOIN #VM5_Approved a ON a.member_id=t.original_id JOIN #VM5_Clusters c ON c.cluster_id=a.cluster_id;
    SELECT @Locked=q.id FROM dbo.tbl_question q WITH(UPDLOCK,HOLDLOCK,NOWAIT)
        JOIN #VM5_ExportState s ON s.member_id=q.id JOIN #VM5_RunGroups g ON g.word_group=s.word_group;
    IF EXISTS(SELECT 1 FROM #VM5_ExportState s JOIN #VM5_RunGroups g ON g.word_group=s.word_group
        JOIN dbo.tbl_question q ON q.id=s.member_id WHERE '''+STATE_PREDICATE+''')
        RAISERROR(N'Nhóm vừa được sửa hoặc đánh dấu check. Chưa gộp nhóm nào; hãy chạy lại xem trước.',16,1);
'''+lock_marker)
(OUT/'CURRENT_MERGE_TEMPLATE.sql').write_text(sql, encoding='utf8')

approval_rows = [[str(p['cluster_id']), str(i), lit(p['word']), lit(cards[i].get('meaning','').strip()), 'NULL', lit(p['meaning_after'].strip())]
                 for p in plans for i in p['ids']]
group_ids = {p['original_group'] for p in plans}
state_rows = [[str(c['id']), str(g['n']),lit(c['word']),lit(c.get('meaning','')),lit(c.get('ipa')),lit(c.get('cefr')),
               c.get('status') or 'NULL',lit(c.get('created')),lit(c.get('duplicate_reviewed_key')),lit(c.get('duplicate_reviewed_at'))]
              for g in GROUPS if g['n'] in group_ids for c in g['cards']]
change('-- FAST_APPROVALS_START\n-- FAST_APPROVALS_END', '-- FAST_APPROVALS_START\n'+insert('#VM5_Approved','cluster_id,member_id,expected_word,expected_meaning,previous_approved_meaning,meaning_after',approval_rows)+'\n-- FAST_APPROVALS_END')
change('-- KNOWN_MEANINGS_START\n-- KNOWN_MEANINGS_END', '-- KNOWN_MEANINGS_START\nINSERT #VM5_KnownMeanings(member_id,meaning) SELECT member_id,expected_meaning FROM #VM5_Approved;\n-- KNOWN_MEANINGS_END')
change('-- CURRENT_CLUSTERS_START\n-- CURRENT_CLUSTERS_END','-- CURRENT_CLUSTERS_START\n'+insert('#VM5_Clusters','cluster_id,word_group',[[str(p['cluster_id']),str(p['original_group'])] for p in plans])+'\n-- CURRENT_CLUSTERS_END')
change('-- CURRENT_STATE_START\n-- CURRENT_STATE_END','-- CURRENT_STATE_START\n'+insert('#VM5_ExportState','member_id,word_group,word_text,meaning_text,ipa,cefr,status,created,review_key,review_at',state_rows)+'\n-- CURRENT_STATE_END')
delivery=OUT/'GOP_TU_TRUNG_CON_LAI_GIU_BAN_GOC_ENGLISH_V5.sql'
delivery.write_text(sql, encoding='utf-8-sig')
(OUT/'current-merge-plan.json').write_text(json.dumps(plans,ensure_ascii=False,indent=2),encoding='utf8')
removals=sum(len(p['ids'])-1 for p in plans)
remaining={g['word']:len(g['cards']) for g in GROUPS}
for p in plans: remaining[p['word']] -= len(p['ids'])-1
summary={'xml_sha256':HASH,'reviewed_units':end,'clusters':len(plans),'word_groups':len(group_ids),
         'source_cards_to_remove':removals,'cards_in_snapshot_after_merge':len(cards)-removals,
         'remaining_same_word_groups':sum(n>1 for n in remaining.values()),
         'remaining_unreviewed_same_word_groups':sum(remaining[g['word']]>1 for g in GROUPS if not g['reviewed']),
         'checked_groups_untouched':sum(g['reviewed'] for g in GROUPS),'snapshot_guard_cards':len(state_rows),
         'unreviewed_groups_untouched':sum(not g['reviewed'] and g['n'] not in group_ids for g in GROUPS),
         'sql_file':str(delivery),'bytes':delivery.stat().st_size}
(OUT/'current-merge-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf8')
(OUT/'DANH_SACH_GOP_CON_LAI_V5.txt').write_text('\n'.join(f"{p['cluster_id']}. {p['word']} | giữ #{p['primary_id']} ({cards[p['primary_id']]['created']}) | {p['meaning_after']}\n   Gộp bản: "+', '.join(f"#{i}: {cards[i].get('meaning','')}" for i in p['ids'] if i!=p['primary_id']) for p in plans),encoding='utf8')
print(json.dumps(summary,ensure_ascii=False,indent=2))
