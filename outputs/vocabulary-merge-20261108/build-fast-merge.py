"""Generate an incremental, ID-bound SQL plan from the local XML review.

The existing SQL mutation engine is reused; only the plan admission changes.
No database is opened here. Never apply similarity scores as approval rules.
"""
from pathlib import Path
from collections import defaultdict
import csv
import hashlib
import json
import re
import unicodedata
import xml.etree.ElementTree as ET

OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[1]
def norm(s): return re.sub(r'\s+',' ',unicodedata.normalize('NFC',s or '')).strip().casefold()
raw=Path(r'C:/Users/Admin/Desktop/english-duplicates-20261108.xml').read_bytes()
assert b'<!DOCTYPE' not in raw
root=ET.fromstring(raw); assert root.tag=='english_duplicates'
cards={int(e.findtext('id')):{c.tag:c.text or '' for c in e} for e in root}
assert len(cards)==len(root)
base=json.loads((OUT/'meaning-clusters.json').read_text(encoding='utf8'))
units={}; alternatives={}; covered=set()
for group in base:
    units[group['primary']]=dict(group); covered.update(group['ids'])
    alternatives[group['primary']]=group['meaning']
for identifier,card in cards.items():
    if identifier not in covered:
        units[identifier]={'word':norm(card['word']),'primary':identifier,'ids':[identifier],
            'meaning':card.get('meaning','').strip(),'definition_from':identifier,'reason':'Chưa đối chiếu'}

consumed=set(); groups=[]
reviews=list(csv.DictReader((OUT/'fast-reviewed.tsv').open(encoding='utf8'),delimiter='\t'))
for reviewed in reviews:
    selected=list(map(int,reviewed['units'].split(','))); keep=int(reviewed['keep_unit'])
    assert keep in selected and len(selected)>=2 and len(selected)==len(set(selected)),reviewed
    assert not consumed.intersection(selected),reviewed
    chosen=[units[identifier] for identifier in selected]
    assert all(group['word']==reviewed['word'] for group in chosen),reviewed
    identifiers=sorted(identifier for group in chosen for identifier in group['ids'])
    assert len(identifiers)==len(set(identifiers)),reviewed
    keeper=units[keep]
    groups.append({'word':reviewed['word'],'primary':min(identifiers),'ids':identifiers,
        'meaning':keeper['meaning'],'definition_from':keeper['definition_from'],
        'reason':'Đối chiếu nghĩa bổ sung từng nhóm; giữ riêng các nghĩa khác'})
    consumed.update(selected)
groups.extend(group for primary,group in units.items() if primary not in consumed and len(group['ids'])>1)
groups.sort(key=lambda group:(group['word'],group['primary']))
seen=set(); rows=[]
for index,group in enumerate(groups,1):
    assert not seen.intersection(group['ids']); seen.update(group['ids'])
    assert group['definition_from'] in group['ids']
    assert norm(group['meaning'])==norm(cards[group['definition_from']].get('meaning'))
    assert group['meaning'].strip() and len(group['meaning'].encode('utf-16-le'))<=1000
    for identifier in group['ids']:
        card=cards[identifier]
        assert norm(card['word'])==group['word']
        assert len(group['word'].encode('utf-16-le'))<=400
        expected=card.get('meaning','').strip(' ')
        assert len(expected.encode('utf-16-le'))<=1000
        alt=alternatives.get(identifier)
        rows.append([index,identifier,group['word'],expected,alt,group['meaning']])

def literal(value):
    if value is None: return 'NULL'
    if isinstance(value,int): return str(value)
    return "N'"+value.replace("'","''")+"'"

SCHEMA="""IF OBJECT_ID('tempdb..#VM_Approved') IS NOT NULL DROP TABLE #VM_Approved;
CREATE TABLE #VM_Approved (
    cluster_id int NOT NULL,
    member_id bigint NOT NULL PRIMARY KEY,
    expected_word nvarchar(200) NOT NULL,
    expected_meaning nvarchar(500) NOT NULL,
    previous_approved_meaning nvarchar(500) NULL,
    meaning_after nvarchar(500) NOT NULL
);
-- FAST_APPROVALS_START
-- FAST_APPROVALS_END
CREATE INDEX IX_VM_Approved_cluster ON #VM_Approved(cluster_id);
"""

PLANNER="""-- Nhóm đã gộp/sửa tay không làm dừng các nhóm rõ ràng còn lại.
    -- ID mất được bỏ qua; bất kỳ ID còn sống nhưng đã đổi từ/nghĩa/chủ sở hữu
    -- thì bỏ qua TOÀN BỘ cụm, không ghi đè phần giáo viên vừa sửa.
    IF EXISTS (SELECT cluster_id FROM #VM_Approved GROUP BY cluster_id
        HAVING COUNT(*)<2 OR COUNT(DISTINCT expected_word COLLATE Latin1_General_BIN2)<>1
            OR COUNT(DISTINCT meaning_after COLLATE Latin1_General_BIN2)<>1)
        OR EXISTS (SELECT 1 FROM #VM_Approved WHERE LTRIM(RTRIM(meaning_after))=N'')
        RAISERROR(N'Kế hoạch đối chiếu không nhất quán. Chưa gộp từ.',16,1);

    SELECT DISTINCT a.cluster_id,a.expected_word,
        CASE WHEN q.user_id IS NULL OR q.user_id<>@Owner THEN N'Khác tài khoản english'
             WHEN q.question_type IS NULL OR q.question_type<>6 OR q.parent_id IS NOT NULL THEN N'Không phải thẻ từ gốc loại 6'
             WHEN ISNULL(q.voided,0)<>0 THEN N'Thẻ đã voided'
             WHEN p.id IS NOT NULL THEN N'Có câu con hoặc tham chiếu chưa được cho phép'
             WHEN w.id IS NULL THEN N'Thẻ không đủ điều kiện hoặc vượt giới hạn'
             WHEN w.word_key<>a.expected_word COLLATE Latin1_General_CI_AS THEN N'Từ đã thay đổi so với XML'
             ELSE N'Nghĩa đã sửa hoặc đã gộp thủ công; giữ nguyên' END AS reason
    INTO #VM_FastSkipped
    FROM #VM_Approved a JOIN dbo.tbl_question q ON q.id=a.member_id
        LEFT JOIN #VM_Words w ON w.id=a.member_id
        LEFT JOIN #VM_ProtectedIds p ON p.id=a.member_id
    WHERE w.id IS NULL OR w.word_key<>a.expected_word COLLATE Latin1_General_CI_AS
        OR (w.meaning_text<>a.expected_meaning COLLATE Latin1_General_BIN2
            AND w.meaning_text<>ISNULL(a.previous_approved_meaning,a.expected_meaning) COLLATE Latin1_General_BIN2
            AND w.meaning_text<>a.meaning_after COLLATE Latin1_General_BIN2);
    CREATE INDEX IX_VM_FastSkipped ON #VM_FastSkipped(cluster_id);

    SELECT a.cluster_id,MIN(w.id) AS primary_id,COUNT(*) AS live_cards
    INTO #VM_FastEligible
    FROM #VM_Approved a JOIN #VM_Words w ON w.id=a.member_id
    WHERE NOT EXISTS (SELECT 1 FROM #VM_FastSkipped skipped WHERE skipped.cluster_id=a.cluster_id)
    GROUP BY a.cluster_id HAVING COUNT(*)>1;
    CREATE UNIQUE CLUSTERED INDEX IX_VM_FastEligible ON #VM_FastEligible(cluster_id);

    CREATE TABLE #VM_Plan (source_id bigint NOT NULL PRIMARY KEY,primary_id bigint NOT NULL,
        meaning_after nvarchar(500) NOT NULL,reason nvarchar(30) NOT NULL);
    INSERT #VM_Plan
    SELECT w.id,chosen.primary_id,a.meaning_after,N'Đã đối chiếu nghĩa'
    FROM (SELECT TOP (@MaxGroups) cluster_id,primary_id FROM #VM_FastEligible ORDER BY cluster_id) chosen
        JOIN #VM_Approved a ON a.cluster_id=chosen.cluster_id JOIN #VM_Words w ON w.id=a.member_id
    WHERE w.id<>chosen.primary_id;

    SELECT COUNT(*) AS eligible_groups_remaining_before_this_run,
        @MaxGroups AS group_limit_per_run,
        (SELECT COUNT(DISTINCT cluster_id) FROM #VM_FastSkipped) AS skipped_changed_or_protected_groups
    FROM #VM_FastEligible;
    SELECT reason,COUNT(DISTINCT cluster_id) AS skipped_groups FROM #VM_FastSkipped GROUP BY reason;
    SELECT TOP (@PreviewRows) expected_word AS word,cluster_id,reason FROM #VM_FastSkipped ORDER BY expected_word,cluster_id;

    """

template=(ROOT/'richy/database/vocabulary-duplicates-english-merge.sql').read_text(encoding='utf-8-sig')
start=template.index("IF OBJECT_ID('tempdb..#VM_Reviewed')")
end=template.index('-- REVIEWED_MEANINGS_END',start)+len('-- REVIEWED_MEANINGS_END')
template=template[:start]+SCHEMA+template[end:]
start=template.index('    -- Chạy lại sau khi đã gộp:')
end=template.index('    -- Bảng 1:',start)
template=template[:start]+'    '+PLANNER+template[end:]
template=template.replace('DECLARE @Apply bit = 0;',
    'DECLARE @Apply bit = 0;\nDECLARE @MaxGroups int = 1000; -- Tối đa 1000 cụm/lượt; chạy lại để làm tiếp.\nDECLARE @PreviewRows int = 200; -- Giới hạn số dòng mẫu để SSMS không bị chậm.')
template=template.replace('DECLARE @MergeTestReferences bit = 0;','DECLARE @MergeTestReferences bit = 1;')
template=template.replace('BEGIN TRY\n','BEGIN TRY\n    IF @MaxGroups<1 OR @MaxGroups>10000 OR @PreviewRows<1 OR @PreviewRows>100000\n        RAISERROR(N\'Số cụm hoặc số dòng xem trước không hợp lệ.\',16,1);\n',1)
template=template.replace('BEGIN TRY',
    "IF OBJECT_ID('tempdb..#VM_FastSkipped') IS NOT NULL DROP TABLE #VM_FastSkipped;\n"
    "IF OBJECT_ID('tempdb..#VM_FastEligible') IS NOT NULL DROP TABLE #VM_FastEligible;\n\nBEGIN TRY",1)
template=template.replace('SELECT p.word_text AS word,m.primary_id', 'SELECT TOP (@PreviewRows) p.word_text AS word,m.primary_id')
template=template.replace('SELECT r.word_text AS word,r.id,r.meaning','SELECT TOP (@PreviewRows) r.word_text AS word,r.id,r.meaning')
template=template.replace("N'Giữ riêng - khác nghĩa hoặc cần đối chiếu thêm'", "N'Còn trùng sau lượt này; có thể đang chờ lượt tiếp theo hoặc cần duyệt riêng'")
header="""/* GỘP NHANH CÁC NHÓM ĐÃ ĐỐI CHIẾU - CHỈ TÀI KHOẢN english.
SQL Server 2008 R2+. Chọn database ecommerce, chạy TOÀN BỘ file.
@Apply=0: xem trước. @Apply=1: thực hiện tối đa @MaxGroups cụm mỗi lượt.
Chạy lại để xử lý tiếp; ID đã mất/đã gộp được bỏ qua.
Nhóm có ID còn sống đã sửa nghĩa/từ hoặc không đủ điều kiện được bỏ qua toàn cụm.
Không suy đoán nghĩa mới từ độ giống chữ, không nối các nghĩa khác nhau bằng /.
Giữ một định nghĩa đã có, toàn bộ topic/category và ID câu trả lời/lịch sử.
Tham chiếu thẻ từ trong bài giao/kết quả được chuyển, giữ ID task/result và tiến độ.
Có bản sao lưu trong database và transaction rollback nếu lỗi.
Không cần cập nhật frontend, JAR hay chạy migration schema.
SHA-256 XML: XML_HASH
*/
""".replace('XML_HASH',hashlib.sha256(raw).hexdigest())
template=header+template[template.index('SET NOCOUNT ON;'):]
(OUT/'FAST_MERGE_TEMPLATE.sql').write_text(template,encoding='utf8')
inserts=[]
for offset in range(0,len(rows),200):
    inserts.append('INSERT #VM_Approved(cluster_id,member_id,expected_word,expected_meaning,previous_approved_meaning,meaning_after) VALUES\n'+
        ',\n'.join('('+','.join(map(literal,row))+')' for row in rows[offset:offset+200])+';')
sql=template.replace('-- FAST_APPROVALS_START\n-- FAST_APPROVALS_END',
    '-- FAST_APPROVALS_START\n'+'\n'.join(inserts)+'\n-- FAST_APPROVALS_END')
dest=OUT/'GOP_NHANH_ENGLISH_20261108_V3.sql'
dest.write_text(sql,encoding='utf-8-sig')
(OUT/'fast-merge-plan.json').write_text(json.dumps(groups,ensure_ascii=False,indent=2),encoding='utf8')
(OUT/'DANH_SACH_GOP_NHANH.txt').write_text('\n'.join(f"{i}. {g['word']} | ID: {','.join(map(str,g['ids']))} | Giữ nghĩa: {g['meaning']}" for i,g in enumerate(groups,1)),encoding='utf8')
summary={'xml_cards':len(cards),'xml_same_word_groups':len({norm(c['word']) for c in cards.values()}),
    'reviewed_merge_groups':len(groups),'planned_redundant_cards':sum(len(group['ids'])-1 for group in groups),
    'additional_semantic_review_groups':len(reviews),'additional_semantic_removals':sum(len(row['units'].split(','))-1 for row in reviews),
    'max_groups_per_run':1000,'xml_sha256':hashlib.sha256(raw).hexdigest(),'sql_sha256':hashlib.sha256(dest.read_bytes()).hexdigest()}
(OUT/'fast-merge-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(summary,ensure_ascii=False))
