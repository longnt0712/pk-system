"""Add explicitly reviewed groups; retain the live pre-6-Nov original and its definition.

This only generates private SQL artifacts. It never connects to a database.
"""
from pathlib import Path
from collections import defaultdict
import hashlib,json,re,unicodedata,xml.etree.ElementTree as ET

OUT=Path(__file__).resolve().parent
def norm(s): return re.sub(r'\s+',' ',unicodedata.normalize('NFC',s or '')).strip().casefold()
raw=Path(r'C:/Users/Admin/Desktop/english-duplicates-20261108.xml').read_bytes()
assert b'<!DOCTYPE' not in raw
root=ET.fromstring(raw); assert root.tag=='english_duplicates'
cards={int(e.findtext('id')):{c.tag:c.text or '' for c in e} for e in root}
pair_bytes=(OUT/'next-pairs.json').read_bytes()
pairs=json.loads(pair_bytes)
review=json.loads((OUT/'next-reviewed-pairs.json').read_text(encoding='utf8'))
assert review['source']=='next-pairs.json'
selected=[]
for batch in review['reviewed_batches']:
    excluded=set(batch['exclude'])
    assert len(excluded)==len(batch['exclude']) and all(batch['from']<=i<=batch['to'] for i in excluded)
    selected.extend(i for i in range(batch['from'],batch['to']+1) if i not in excluded)
assert len(selected)==len(set(selected))
allowed=defaultdict(set)
for identifier,card in cards.items(): allowed[identifier].add(card.get('meaning','').strip(' '))
for filename in ['meaning-clusters.json','fast-merge-plan.json']:
    for previous in json.loads((OUT/filename).read_text(encoding='utf8')):
        for identifier in previous['ids']: allowed[identifier].add(previous['meaning'])

groups=[]; used=set(); rows=[]; known=[]
for cluster,index in enumerate(selected,1):
    pair=pairs[index-1]; units=pair['units']; assert len(units)==2
    ids=sorted(identifier for u in units for identifier in u['ids'])
    assert len(ids)==len(set(ids)) and not used.intersection(ids)
    used.update(ids)
    for identifier in ids:
        assert norm(cards[identifier]['word'])==pair['word']
        expected=cards[identifier].get('meaning','').strip(' ')
        assert expected.strip() and len(expected.encode('utf-16-le'))<=1000
        rows.append((cluster,identifier,pair['word'],expected,None,units[0]['meaning']))
        for meaning in sorted(allowed[identifier]):
            assert len(meaning.encode('utf-16-le'))<=1000
            known.append((identifier,meaning))
    groups.append({'word':pair['word'],'ids':ids,'previous_units':units,'review_row':index})

template=(OUT/'FAST_MERGE_TEMPLATE.sql').read_text(encoding='utf8')
def replace(old,new):
    global template
    assert old in template,old[:100]
    template=template.replace(old,new)
replace('DECLARE @Apply bit = 0;','DECLARE @Apply bit = 0;\nDECLARE @OriginalBefore datetime2 = CONVERT(datetime2,\'20261106\',112); -- Chỉ giữ bản chính được tạo trước 06/11/2026.')
replace("    IF DB_NAME()<>@ExpectedDatabase", "    IF COL_LENGTH('dbo.tbl_question','create_date') IS NULL\n        RAISERROR(N'Không có ngày tạo thẻ để xác định bản gốc. Chưa gộp từ.',16,1);\n    IF DB_NAME()<>@ExpectedDatabase")
replace('modified datetime2 NULL','modified datetime2 NULL, created datetime2 NULL')
replace('    INSERT #VM_Words\n',
    '    INSERT #VM_Words(id,word_text,word_key,meaning_text,meaning_key,ipa,cefr,status,correct,wrong,reviewed,modified,created)\n')
replace('    INSERT #VM_Plan\n',
    '    INSERT #VM_Plan(source_id,primary_id,meaning_after,reason)\n')
replace('ISNULL(q.correct_answer,0),ISNULL(q.wrong_answer,0),ISNULL(q.time_reviewed,0),q.modify_date',
    'ISNULL(q.correct_answer,0),ISNULL(q.wrong_answer,0),ISNULL(q.time_reviewed,0),q.modify_date,q.create_date')
replace("CREATE INDEX IX_VM_Approved_cluster ON #VM_Approved(cluster_id);", "CREATE INDEX IX_VM_Approved_cluster ON #VM_Approved(cluster_id);\nIF OBJECT_ID('tempdb..#VM_KnownMeanings') IS NOT NULL DROP TABLE #VM_KnownMeanings;\nCREATE TABLE #VM_KnownMeanings(member_id bigint NOT NULL,meaning nvarchar(500) COLLATE Latin1_General_BIN2 NOT NULL);\n-- KNOWN_MEANINGS_START\n-- KNOWN_MEANINGS_END\nCREATE INDEX IX_VM_KnownMeanings ON #VM_KnownMeanings(member_id);")
replace("OR (w.meaning_text<>a.expected_meaning COLLATE Latin1_General_BIN2\n            AND w.meaning_text<>ISNULL(a.previous_approved_meaning,a.expected_meaning) COLLATE Latin1_General_BIN2\n            AND w.meaning_text<>a.meaning_after COLLATE Latin1_General_BIN2)",
    'OR NOT EXISTS (SELECT 1 FROM #VM_KnownMeanings k WHERE k.member_id=a.member_id AND k.meaning=w.meaning_text COLLATE Latin1_General_BIN2)')
start=template.index('    SELECT a.cluster_id,MIN(w.id) AS primary_id,COUNT(*) AS live_cards')
end=template.index('    CREATE TABLE #VM_Plan',start)
template=template[:start]+"""    -- Không suy bản gốc từ ID hoặc modify_date: lấy ngày TẠO trực tiếp.
    ;WITH LiveClusters AS (
        SELECT a.cluster_id,COUNT(*) AS live_cards
        FROM #VM_Approved a JOIN #VM_Words w ON w.id=a.member_id
        WHERE NOT EXISTS (SELECT 1 FROM #VM_FastSkipped s WHERE s.cluster_id=a.cluster_id)
        GROUP BY a.cluster_id HAVING COUNT(*)>1
    ), OriginalCandidates AS (
        SELECT a.cluster_id,w.id,
            ROW_NUMBER() OVER(PARTITION BY a.cluster_id ORDER BY w.created,w.id) AS position
        FROM #VM_Approved a JOIN #VM_Words w ON w.id=a.member_id
        WHERE w.created<@OriginalBefore AND LTRIM(RTRIM(w.meaning_text))<>N''
    )
    SELECT c.cluster_id,p.id AS primary_id,c.live_cards
    INTO #VM_FastEligible FROM LiveClusters c JOIN OriginalCandidates p ON p.cluster_id=c.cluster_id AND p.position=1;
    CREATE UNIQUE CLUSTERED INDEX IX_VM_FastEligible ON #VM_FastEligible(cluster_id);

    INSERT #VM_FastSkipped(cluster_id,expected_word,reason)
    SELECT a.cluster_id,MIN(a.expected_word),N'Không còn bản gốc trước 06/11/2026'
    FROM #VM_Approved a JOIN #VM_Words w ON w.id=a.member_id
    WHERE NOT EXISTS (SELECT 1 FROM #VM_FastSkipped s WHERE s.cluster_id=a.cluster_id)
        AND NOT EXISTS (SELECT 1 FROM #VM_FastEligible e WHERE e.cluster_id=a.cluster_id)
    GROUP BY a.cluster_id HAVING COUNT(*)>1;

"""+template[end:]
replace("SELECT w.id,chosen.primary_id,a.meaning_after,N'Đã đối chiếu nghĩa'", "SELECT w.id,chosen.primary_id,original.meaning_text,N'Giữ nguyên bản gốc trước 06/11'")
replace('JOIN #VM_Approved a ON a.cluster_id=chosen.cluster_id JOIN #VM_Words w ON w.id=a.member_id\n    WHERE',
    'JOIN #VM_Approved a ON a.cluster_id=chosen.cluster_id JOIN #VM_Words w ON w.id=a.member_id\n        JOIN #VM_Words original ON original.id=chosen.primary_id\n    WHERE')
replace('s.meaning_text AS source_meaning,m.meaning_after,p.ipa',
    's.meaning_text AS source_meaning,m.meaning_after,p.created AS original_created_date,s.created AS source_created_date,p.ipa')
replace('          OR q.modify_date<>w.modified',
    '          OR q.create_date<>w.created OR (q.create_date IS NULL AND w.created IS NOT NULL) OR (q.create_date IS NOT NULL AND w.created IS NULL)\n          OR q.modify_date<>w.modified')
replace('UPDATE q SET mother_tongue=m.meaning_after,correct_answer=s.correct',
    'UPDATE q SET correct_answer=s.correct')
replace('    DELETE q FROM dbo.tbl_question q JOIN #VM_Plan', """    -- Chốt giữ nguyên nghĩa và ngày tạo của bản chính trước khi xóa bản phụ.
    IF EXISTS(SELECT 1 FROM #VM_Sums s JOIN #VM_Words w ON w.id=s.canonical_id
        JOIN dbo.tbl_question q ON q.id=s.canonical_id
        WHERE q.create_date IS NULL OR q.create_date>=@OriginalBefore OR q.create_date<>w.created
            OR ISNULL(LTRIM(RTRIM(CONVERT(nvarchar(max),q.mother_tongue))),N'') COLLATE Latin1_General_BIN2<>w.meaning_text)
        RAISERROR(N'Bản chính không còn đúng bản gốc hoặc nghĩa đã thay đổi. Hoàn tác lượt này.',16,1);
    DELETE q FROM dbo.tbl_question q JOIN #VM_Plan""")
header="""/* GỘP BỔ SUNG V4.1 - CHỈ TÀI KHOẢN english - GIỮ NGUYÊN BẢN GỐC TRƯỚC 06/11/2026.
Sửa lỗi Msg 213 khi chạy sau V3 trong cùng tab SSMS: dùng bộ bảng tạm #VM4_ riêng.
Đây là các cụm mới đối chiếu SAU kế hoạch V3, không lặp lại số cụm cũ để báo thành quả mới.
Chọn database ecommerce, chạy TOÀN BỘ file. @Apply=0 xem trước, @Apply=1 gộp tối đa 1000 cụm/lượt.
Bản chính được chọn theo create_date trước 06/11, rồi ngày tạo cũ nhất và ID khi trùng ngày.
Giữ nguyên nghĩa, IPA, CEFR, mô tả, trạng thái, ngày tạo và ID bản chính; không tự nối / hay lấy nghĩa bản mới đè lên.
Gom topic/category, cộng bộ đếm và chuyển tham chiếu bài giao/lịch sử; giữ ID task/result/câu trả lời.
Bỏ qua cụm đã sửa khác kế hoạch hoặc không còn bản gốc đủ điều kiện. Không đoán ngày tạo từ ID.
Có backup cùng transaction, lỗi hoàn tác toàn lượt; chạy lại tự bỏ qua phần đã gộp.
Không cần frontend/JAR/migration mới. Không chạy script này đồng thời ở nhiều tab.
XML_SHA
*/
""".replace('XML_SHA','SHA-256 XML: '+hashlib.sha256(raw).hexdigest())
template=header+template[template.index('SET NOCOUNT ON;'):]
# SQL Server may bind INSERT against a surviving V3 temporary-table schema
# before executing DROP/CREATE in this batch. Use a version-specific namespace.
template=template.replace('#VM_','#VM4_')
(OUT/'ORIGINAL_MERGE_TEMPLATE.sql').write_text(template,encoding='utf8')

def literal(v):
    if v is None: return 'NULL'
    if isinstance(v,int): return str(v)
    return "N'"+v.replace("'","''")+"'"
def inserts(table,columns,data):
    return '\n'.join('INSERT '+table+'('+columns+') VALUES\n'+',\n'.join('('+','.join(map(literal,row))+')' for row in data[i:i+200])+';' for i in range(0,len(data),200))
sql=template.replace('-- FAST_APPROVALS_START\n-- FAST_APPROVALS_END','-- FAST_APPROVALS_START\n'+inserts('#VM4_Approved','cluster_id,member_id,expected_word,expected_meaning,previous_approved_meaning,meaning_after',rows)+'\n-- FAST_APPROVALS_END')
sql=sql.replace('-- KNOWN_MEANINGS_START\n-- KNOWN_MEANINGS_END','-- KNOWN_MEANINGS_START\n'+inserts('#VM4_KnownMeanings','member_id,meaning',known)+'\n-- KNOWN_MEANINGS_END')
dest=OUT/'GOP_BO_SUNG_GIU_BAN_GOC_ENGLISH_V4_1.sql';dest.write_text(sql,encoding='utf-8-sig')
(OUT/'original-merge-plan.json').write_text(json.dumps(groups,ensure_ascii=False,indent=2),encoding='utf8')
(OUT/'DANH_SACH_BO_SUNG_V4.txt').write_text('\n'.join(f"{i}. {g['word']} | "+' || '.join(f"{u['primary']}: {u['meaning']}" for u in g['previous_units']) for i,g in enumerate(groups,1)),encoding='utf8')
summary={'new_reviewed_groups':len(groups),'previous_remaining_same_word_groups':5812,
    'additional_removals_if_v3_completed_and_original_exists':len(groups),
    'raw_xml_ids_in_new_groups':len(used),'xml_sha256':hashlib.sha256(raw).hexdigest(),
    'review_source_sha256':hashlib.sha256(pair_bytes).hexdigest(),'sql_sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),
    'original_before':'2026-11-06','preserve_original_meaning':True}
(OUT/'original-merge-summary-v4-1.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(summary,ensure_ascii=False))
