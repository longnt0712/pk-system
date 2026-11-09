"""Only a uniquely named disposable LOCAL SQL database. Never connects to production."""
from pathlib import Path
import argparse, ast, json, os, re, subprocess, time

OUT=Path(__file__).resolve().parent
parser=argparse.ArgumentParser(); parser.add_argument('--full',action='store_true'); args=parser.parse_args()
DB='codex_vocab_current_20261109_'+str(os.getpid())
assert re.fullmatch(r'codex_vocab_current_20261109_\d+',DB)
SQLCMD=r'C:/Program Files/Microsoft SQL Server/Client SDK/ODBC/170/Tools/Binn/SQLCMD.EXE'
TEMPLATE=(OUT/'CURRENT_MERGE_TEMPLATE.sql').read_text(encoding='utf8')
DELIVERY=(OUT/'GOP_TU_TRUNG_CON_LAI_GIU_BAN_GOC_ENGLISH_V5.sql').read_text(encoding='utf-8-sig')
tree=ast.parse((OUT/'test-merge-sql.py').read_text(encoding='utf8'))
SCHEMA=next(ast.literal_eval(n.value) for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='SCHEMA' for t in n.targets))
tree=ast.parse((OUT/'test-fast-merge.py').read_text(encoding='utf8'))
PLAN=ast.literal_eval(next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='plan').body[0].value).replace('#VM_','#VM5_')
ADDITIONS='''ALTER TABLE dbo.tbl_question ADD create_date datetime2,duplicate_reviewed_key varchar(64),duplicate_reviewed_at datetime2;
ALTER TABLE dbo.tbl_enrolment_class_schedule_task ADD progress nvarchar(100),required_successes int;
ALTER TABLE dbo.tbl_test_result ADD result_status nvarchar(20),attempt_key nvarchar(100);
GO
'''
DATES='''UPDATE dbo.tbl_question SET create_date='20261107';
UPDATE dbo.tbl_question SET create_date='20261105' WHERE id IN(1,10,12,18,22);
UPDATE dbo.tbl_question SET create_date='20261021',modify_date='20261108' WHERE id=3;
UPDATE dbo.tbl_enrolment_class_schedule_task SET source_question_id=11,ielts_test_id=13,progress=N'keep progress',required_successes=3;
UPDATE dbo.tbl_test_result SET source_question_id=13,result_status=N'SUCCESS',attempt_key=N'keep attempt';
SELECT id AS member_id,
 CASE WHEN id IN(1,2,3,4) THEN 1 WHEN id IN(22,23) THEN 2 WHEN id IN(18,19) THEN 3
 WHEN id IN(10,11) THEN 4 WHEN id IN(12,13) THEN 5 WHEN id IN(7,8) THEN 6 WHEN id IN(24,25) THEN 7 END AS word_group,
 CONVERT(nvarchar(max),question) AS word_text,CONVERT(nvarchar(max),ISNULL(mother_tongue,N'')) AS meaning_text,
 pronounce AS ipa,level AS cefr,status,create_date AS created,duplicate_reviewed_key AS review_key,duplicate_reviewed_at AS review_at
INTO dbo.codex_export_state FROM dbo.tbl_question WHERE id IN(1,2,3,4,22,23,18,19,10,11,12,13,7,8,24,25);
'''

def lit(value):return 'NULL' if value is None else "N'"+str(value).replace("'","''")+"'"
def insert(table,cols,rows):
    return '\n'.join('INSERT '+table+'('+cols+') VALUES\n'+',\n'.join('('+','.join(row)+')' for row in rows[i:i+150])+';' for i in range(0,len(rows),150))
def sql(content,name,fail=False,database=DB):
    file=OUT/('current-'+name+'.test.sql');file.write_text(content,encoding='utf-16')
    start=time.monotonic()
    p=subprocess.run([SQLCMD,'-S',r'localhost\SQLEXPRESS','-E','-C','-b','-r','1','-d',database,'-i',str(file),'-u','-W','-h','-1','-s','|'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=210)
    enc='utf-16' if p.stdout.startswith((b'\xff\xfe',b'\xfe\xff')) else ('utf-16-le' if b'\0' in p.stdout[:80] else 'utf8')
    output=p.stdout.decode(enc,errors='replace')+p.stderr.decode('utf8',errors='replace')
    (OUT/('current-'+name+'.log')).write_text(output,encoding='utf8')
    if fail:assert p.returncode!=0,'Expected failure '+output[-3000:]
    else:assert p.returncode==0,output[-7000:]
    print(name+': '+str(round(time.monotonic()-start,2))+'s',flush=True)
    return output
def configure(text,apply=0,limit=1000):
    return text.replace("@ExpectedDatabase sysname = N'ecommerce'","@ExpectedDatabase sysname = N'"+DB+"'").replace('DECLARE @Apply bit = 0;','DECLARE @Apply bit = '+str(apply)+';').replace('DECLARE @MaxGroups int = 1000;','DECLARE @MaxGroups int = '+str(limit)+';')
def script(apply=0,limit=1000):
    text=configure(TEMPLATE,apply,limit)
    text=text.replace('-- FAST_APPROVALS_START\n-- FAST_APPROVALS_END','-- FAST_APPROVALS_START\n'+PLAN+'\n-- FAST_APPROVALS_END')
    text=text.replace('-- KNOWN_MEANINGS_START\n-- KNOWN_MEANINGS_END','-- KNOWN_MEANINGS_START\nINSERT #VM5_KnownMeanings(member_id,meaning) SELECT member_id,expected_meaning FROM #VM5_Approved;\n-- KNOWN_MEANINGS_END')
    text=text.replace('-- CURRENT_CLUSTERS_START\n-- CURRENT_CLUSTERS_END','-- CURRENT_CLUSTERS_START\nINSERT #VM5_Clusters(cluster_id,word_group) SELECT DISTINCT cluster_id,cluster_id FROM #VM5_Approved;\n-- CURRENT_CLUSTERS_END')
    return text.replace('-- CURRENT_STATE_START\n-- CURRENT_STATE_END','-- CURRENT_STATE_START\nINSERT #VM5_ExportState(member_id,word_group,word_text,meaning_text,ipa,cefr,status,created,review_key,review_at) SELECT member_id,word_group,word_text,meaning_text,ipa,cefr,status,created,review_key,review_at FROM dbo.codex_export_state;\n-- CURRENT_STATE_END')
def reset():
    sql('''IF OBJECT_ID('dbo.codex_extra_history','U') IS NOT NULL DROP TABLE dbo.codex_extra_history;
DROP TABLE dbo.codex_export_state;
DROP TABLE dbo.tbl_question_answer_test_result;DROP TABLE dbo.tbl_test_result;DROP TABLE dbo.tbl_enrolment_class_schedule_task;
DROP TABLE dbo.tbl_question_topic;DROP TABLE dbo.tbl_category;DROP TABLE dbo.tbl_question_answer;DROP TABLE dbo.tbl_question;DROP TABLE dbo.tbl_user;
DECLARE @ddl nvarchar(max)=N'';SELECT @ddl=@ddl+N'DROP TABLE dbo.'+QUOTENAME(name)+N';' FROM sys.tables WHERE name LIKE N'vocab_merge_english[_]%';
IF @ddl<>N'' EXEC sys.sp_executesql @ddl;
GO
'''+SCHEMA+ADDITIONS+DATES,'reset')
UNCHANGED="IF (SELECT COUNT(*) FROM dbo.tbl_question)<>25 OR EXISTS(SELECT 1 FROM sys.tables WHERE name LIKE N'vocab_merge_english[_]%') RAISERROR('Unexpected writes',16,1);"
VERIFY='''IF (SELECT COUNT(*) FROM dbo.tbl_question)<>19 OR EXISTS(SELECT 1 FROM dbo.tbl_question WHERE id IN(1,2,11,13,19,23)) RAISERROR('Canonical IDs/count',16,1);
IF NOT EXISTS(SELECT 1 FROM dbo.tbl_question WHERE id=3 AND create_date='20261021' AND pronounce=N'/third/' AND level=N'A1' AND status=2 AND description IS NULL AND correct_answer=26 AND wrong_answer=33 AND time_reviewed=41 AND CONVERT(nvarchar(max),mother_tongue)=N'tối'+NCHAR(160)+N'thiểu') RAISERROR('Original metadata/content/counters',16,1);
IF (SELECT CONVERT(nvarchar(max),mother_tongue) FROM dbo.tbl_question WHERE id=18)<>N'khát vọng' RAISERROR('Original meaning overwritten',16,1);
IF (SELECT COUNT(*) FROM dbo.tbl_question_topic WHERE question=3)<>4 OR NOT EXISTS(SELECT 1 FROM dbo.tbl_question_topic WHERE id=5 AND question=3) RAISERROR('Topic union/original ID',16,1);
IF (SELECT COUNT(*) FROM dbo.tbl_category WHERE question=3)<>2 OR (SELECT COUNT(*) FROM dbo.tbl_question_answer_test_result)<>6 OR EXISTS(SELECT 1 FROM dbo.tbl_question_answer WHERE id IN(1,2,3) AND question<>3) RAISERROR('Links/history',16,1);
IF NOT EXISTS(SELECT 1 FROM dbo.tbl_enrolment_class_schedule_task WHERE id=1 AND source_question_id=10 AND ielts_test_id=12 AND progress=N'keep progress' AND required_successes=3) OR NOT EXISTS(SELECT 1 FROM dbo.tbl_test_result WHERE id=1 AND source_question_id=12 AND result_status=N'SUCCESS' AND attempt_key=N'keep attempt') RAISERROR('Tasks/results',16,1);
'''
created=False
try:
    sql("IF DB_ID(N'"+DB+"') IS NOT NULL RAISERROR('Test DB exists',16,1); ELSE EXEC(N'CREATE DATABASE ["+DB+"]');",'create',database='master');created=True
    sql('ALTER DATABASE ['+DB+'] SET COMPATIBILITY_LEVEL=100;','compatibility',database='master')
    if not args.full:
        sql(SCHEMA+ADDITIONS+DATES,'schema')
        sql(script(),'preview');sql(UNCHANGED,'preview-verify')
        sql(script(1),'apply');sql(VERIFY,'verify');sql(script(1),'repeat');sql(VERIFY,'repeat-verify')
        sql("IF (SELECT COUNT(*) FROM sys.tables WHERE name LIKE N'vocab_merge_english[_]%')<>7 RAISERROR('Unexpected backups',16,1);",'backup-verify')
        print('PASS preview/apply/idempotence; oldest pre-Nov6 original, topics, histories, task/result progress preserved',flush=True)
        for name,query in [
            ('meaning',"UPDATE dbo.tbl_question SET mother_tongue=N'Đã sửa khác nghĩa' WHERE id=4;"),
            ('review',"UPDATE dbo.tbl_question SET duplicate_reviewed_key=REPLICATE('a',64),duplicate_reviewed_at=GETDATE() WHERE id=4;"),
            ('owner','UPDATE dbo.tbl_question SET user_id=27 WHERE id=4;'),
            ('ipa',"UPDATE dbo.tbl_question SET pronounce=N'/new/' WHERE id=4;"),
            ('created',"UPDATE dbo.tbl_question SET create_date='20261106' WHERE id=3;"),
            ('new',"INSERT dbo.tbl_question(user_id,question_type,voided,question,mother_tongue,create_date) VALUES(26,6,0,N'minimal',N'mới','20261109');")]:
            reset();sql(query,name+'-seed');sql(script(1),name)
            count=22 if name=='new' else 21
            sql(f"IF (SELECT COUNT(*) FROM dbo.tbl_question)<>{count} OR (SELECT COUNT(*) FROM dbo.tbl_question WHERE id IN(1,2,3))<>3 OR NOT EXISTS(SELECT 1 FROM dbo.tbl_question WHERE id=18) OR EXISTS(SELECT 1 FROM dbo.tbl_question WHERE id=19) RAISERROR('Changed word group merged or unrelated group blocked',16,1);",name+'-verify')
        print('PASS even unselected sense edits/checks/ownership/metadata/new cards protect entire word group',flush=True)
        reset();sql('UPDATE dbo.tbl_question SET correct_answer=2147483647 WHERE id=1;','overflow-seed');sql(script(1),'overflow',fail=True);sql(UNCHANGED,'overflow-verify')
        reset();sql('CREATE TABLE dbo.codex_extra_history(id int PRIMARY KEY,question_id bigint REFERENCES dbo.tbl_question(id)); INSERT dbo.codex_extra_history VALUES(1,19);','fk-seed');sql(script(1),'fk',fail=True);sql(UNCHANGED,'fk-verify')
        print('PASS overflow and late FK roll back all groups and backups',flush=True)
        reset()
        race=script(1).replace('    BEGIN TRANSACTION;',"    UPDATE dbo.tbl_question SET duplicate_reviewed_key=REPLICATE('c',64) WHERE id=4;\n    BEGIN TRANSACTION;")
        sql(race,'late-review',fail=True);sql(UNCHANGED,'late-review-verify')
        reset();sql('''DELETE dbo.tbl_question_topic WHERE question=2;UPDATE dbo.tbl_category SET question=1 WHERE question=2;
UPDATE dbo.tbl_question_answer SET question=1 WHERE question=2;DELETE dbo.tbl_question WHERE id=2;''','partial-seed');sql(script(1),'partial')
        sql("IF (SELECT COUNT(*) FROM dbo.tbl_question)<>19 OR EXISTS(SELECT 1 FROM dbo.tbl_question WHERE id IN(1,2)) RAISERROR('Partial continuation failed',16,1);",'partial-verify')
        print('PASS race check and continuation after some sources were already merged',flush=True)
        reset()
        for i in range(6):sql(script(1,1),'limit-'+str(i))
        sql(VERIFY+"IF (SELECT COUNT(*) FROM sys.tables WHERE name LIKE N'vocab_merge_english[_]%')<>35 RAISERROR('Limit/repeat failed',16,1);",'limit-verify')
        reset()
        old=configure((OUT/'ORIGINAL_MERGE_TEMPLATE.sql').read_text(encoding='utf8')).replace('-- FAST_APPROVALS_START\n-- FAST_APPROVALS_END','-- FAST_APPROVALS_START\n'+PLAN.replace('#VM5_','#VM4_')+'\n-- FAST_APPROVALS_END').replace('-- KNOWN_MEANINGS_START\n-- KNOWN_MEANINGS_END','-- KNOWN_MEANINGS_START\nINSERT #VM4_KnownMeanings(member_id,meaning) SELECT member_id,expected_meaning FROM #VM4_Approved;\n-- KNOWN_MEANINGS_END')
        sql(old+'\nGO\n'+script()+'\nGO\n'+script(),'same-session-preview')
        sql(UNCHANGED,'same-session-preview-verify')
        sql(old+'\nGO\n'+script(1)+'\nGO\n'+script(1),'same-session-apply-repeat');sql(VERIFY,'same-session-verify')
        print('PASS multiple batches; V4 then V5 repeated in same SQL session; no Msg 213',flush=True)
    else:
        sql(SCHEMA.split('SET IDENTITY_INSERT')[0]+ADDITIONS,'xml-schema')
        groups=json.loads((OUT/'remaining-current-groups.json').read_text(encoding='utf8'))
        cards={c['id']:c for g in groups for c in g['cards']}
        plan=json.loads((OUT/'current-merge-plan.json').read_text(encoding='utf8'))
        summary=json.loads((OUT/'current-merge-summary.json').read_text(encoding='utf8'))
        rows=[[str(i),'26','6','NULL',c.get('voided') or '0',lit(c['word']),lit(c.get('meaning')),lit(c.get('ipa')),lit(c.get('cefr')),c.get('status') or 'NULL',c.get('correct') or '0',c.get('wrong') or '0',c.get('reviewed') or '0',lit(c.get('modified') or None),lit(c.get('created') or None),lit(c.get('duplicate_reviewed_key')),lit(c.get('duplicate_reviewed_at')),"N'Giữ nguyên mô tả riêng #"+str(i)+"'" ] for i,c in cards.items()]
        seed='SET IDENTITY_INSERT dbo.tbl_question ON;\n'+insert('dbo.tbl_question','id,user_id,question_type,parent_id,voided,question,mother_tongue,pronounce,level,status,correct_answer,wrong_answer,time_reviewed,modify_date,create_date,duplicate_reviewed_key,duplicate_reviewed_at,description',rows)+'\nSET IDENTITY_INSERT dbo.tbl_question OFF;\n'
        seed+='''INSERT dbo.tbl_question_topic(question,topic) SELECT id,1 FROM dbo.tbl_question;
INSERT dbo.tbl_question_topic(question,topic) SELECT id,id+200000 FROM dbo.tbl_question;
INSERT dbo.tbl_category(question,category) SELECT id,1 FROM dbo.tbl_question;
INSERT dbo.tbl_question_answer(question,answer) SELECT id,id FROM dbo.tbl_question;
INSERT dbo.tbl_question_answer_test_result(id,question_answer) SELECT id,id FROM dbo.tbl_question_answer;
INSERT dbo.tbl_enrolment_class_schedule_task(id,source_question_id,ielts_test_id,progress,required_successes) SELECT id,id,id,N'keep task',3 FROM dbo.tbl_question;
INSERT dbo.tbl_test_result(id,source_question_id,result_status,attempt_key) SELECT id,id,N'SUCCESS',N'keep attempt' FROM dbo.tbl_question;
SELECT * INTO dbo.codex_before FROM dbo.tbl_question;
SELECT * INTO dbo.codex_topic_before FROM dbo.tbl_question_topic;
'''
        sql(seed,'xml-seed')
        mappings=[[str(i),str(p['primary_id'])] for p in plan for i in p['ids']]
        expected='CREATE TABLE dbo.codex_map(member_id bigint PRIMARY KEY,canonical_id bigint);\n'+insert('dbo.codex_map','member_id,canonical_id',mappings)
        expected+='''INSERT dbo.codex_map(member_id,canonical_id) SELECT q.id,q.id FROM dbo.tbl_question q WHERE NOT EXISTS(SELECT 1 FROM dbo.codex_map m WHERE m.member_id=q.id);
SELECT m.canonical_id,SUM(CONVERT(bigint,ISNULL(q.correct_answer,0))) AS correct,SUM(CONVERT(bigint,ISNULL(q.wrong_answer,0))) AS wrong,SUM(CONVERT(bigint,ISNULL(q.time_reviewed,0))) AS reviewed
INTO dbo.codex_sums FROM dbo.codex_map m JOIN dbo.tbl_question q ON q.id=m.member_id GROUP BY m.canonical_id;'''
        sql(expected,'xml-expect')
        preview=sql(configure(DELIVERY),'xml-preview')
        assert '2758' in preview and '3823' in preview
        sql(f"IF (SELECT COUNT(*) FROM dbo.tbl_question)<>{len(cards)} OR EXISTS(SELECT 1 FROM sys.tables WHERE name LIKE N'vocab_merge_english[_]%') RAISERROR('Preview wrote data',16,1);",'xml-preview-verify')
        for i in range(4):sql(configure(DELIVERY,1),'xml-apply-'+str(i))
        removed=summary['source_cards_to_remove']
        verify=f'''IF (SELECT COUNT(*) FROM dbo.tbl_question)<>{len(cards)-removed} OR EXISTS(SELECT 1 FROM dbo.codex_map m JOIN dbo.tbl_question q ON q.id=m.member_id WHERE m.member_id<>m.canonical_id) RAISERROR('Unexpected merged count/source retained',16,1);
IF EXISTS(SELECT 1 FROM dbo.codex_before b JOIN dbo.codex_map m ON m.member_id=b.id AND m.canonical_id=b.id LEFT JOIN dbo.tbl_question q ON q.id=b.id
 WHERE q.id IS NULL OR CONVERT(nvarchar(max),q.question) COLLATE Latin1_General_BIN2<>CONVERT(nvarchar(max),b.question) COLLATE Latin1_General_BIN2
 OR ISNULL(CONVERT(nvarchar(max),q.mother_tongue),N'') COLLATE Latin1_General_BIN2<>ISNULL(CONVERT(nvarchar(max),b.mother_tongue),N'') COLLATE Latin1_General_BIN2
 OR ISNULL(CONVERT(nvarchar(max),q.description),N'') COLLATE Latin1_General_BIN2<>ISNULL(CONVERT(nvarchar(max),b.description),N'') COLLATE Latin1_General_BIN2
 OR ISNULL(q.pronounce,N'') COLLATE Latin1_General_BIN2<>ISNULL(b.pronounce,N'') COLLATE Latin1_General_BIN2
 OR ISNULL(q.level,N'')<>ISNULL(b.level,N'') OR ISNULL(q.status,0)<>ISNULL(b.status,0)
 OR q.create_date<>b.create_date OR (q.create_date IS NULL AND b.create_date IS NOT NULL)
 OR ISNULL(q.duplicate_reviewed_key,'')<>ISNULL(b.duplicate_reviewed_key,'')
 OR q.duplicate_reviewed_at<>b.duplicate_reviewed_at OR (q.duplicate_reviewed_at IS NULL AND b.duplicate_reviewed_at IS NOT NULL)) RAISERROR('Original or unselected content/metadata changed',16,1);
IF EXISTS(SELECT 1 FROM dbo.codex_sums s LEFT JOIN dbo.tbl_question q ON q.id=s.canonical_id WHERE q.id IS NULL OR ISNULL(q.correct_answer,0)<>s.correct OR ISNULL(q.wrong_answer,0)<>s.wrong OR ISNULL(q.time_reviewed,0)<>s.reviewed) RAISERROR('Counters lost',16,1);
IF (SELECT COUNT(*) FROM dbo.tbl_question_answer)<>{len(cards)} OR (SELECT COUNT(*) FROM dbo.tbl_question_answer_test_result)<>{len(cards)} OR (SELECT COUNT(*) FROM dbo.tbl_question_topic)<>{2*len(cards)-removed} OR (SELECT COUNT(*) FROM dbo.tbl_category)<>{len(cards)-removed} RAISERROR('Links/history lost',16,1);
IF EXISTS(SELECT 1 FROM dbo.tbl_question_answer a JOIN dbo.codex_map m ON m.member_id=a.answer WHERE a.question<>m.canonical_id) RAISERROR('Answer reference wrong',16,1);
IF EXISTS(SELECT 1 FROM dbo.tbl_enrolment_class_schedule_task t JOIN dbo.codex_map m ON m.member_id=t.id WHERE t.source_question_id<>m.canonical_id OR t.ielts_test_id<>m.canonical_id OR t.progress<>N'keep task' OR t.required_successes<>3)
 OR EXISTS(SELECT 1 FROM dbo.tbl_test_result r JOIN dbo.codex_map m ON m.member_id=r.id WHERE r.source_question_id<>m.canonical_id OR r.result_status<>N'SUCCESS' OR r.attempt_key<>N'keep attempt') RAISERROR('Task/result history changed',16,1);
IF EXISTS(SELECT 1 FROM dbo.codex_topic_before b JOIN dbo.codex_map m ON m.member_id=b.question AND m.member_id=m.canonical_id LEFT JOIN dbo.tbl_question_topic t ON t.id=b.id WHERE t.id IS NULL OR t.question<>b.question OR t.topic<>b.topic) RAISERROR('Canonical original topic IDs lost',16,1);
IF (SELECT COUNT(*) FROM sys.tables WHERE name LIKE N'vocab_merge_english[_]%')<>21 RAISERROR('Expected exactly 3 successful batches',16,1);
'''
        sql(verify,'xml-verify')
        out=sql(configure(DELIVERY,1),'xml-repeat');assert 'KHÔNG CÒN CẶP ĐỦ ĐIỀU KIỆN' in out
        sql(verify,'xml-repeat-verify')
        print(f'PASS ALL {len(cards)} fresh XML cards: {len(plan)} clusters/{removed} removals, all originals/checked/unselected preserved, topic union/history/counters preserved, three batches and repeats',flush=True)
finally:
    if created:
        sql('ALTER DATABASE ['+DB+'] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;DROP DATABASE ['+DB+'];','cleanup',database='master')
        print('Removed disposable LOCAL database '+DB,flush=True)
