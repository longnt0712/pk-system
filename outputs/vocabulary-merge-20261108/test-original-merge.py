"""Test only in a uniquely named disposable localhost database. Never production."""
from pathlib import Path
import argparse,ast,json,os,re,subprocess,time,xml.etree.ElementTree as ET

OUT=Path(__file__).resolve().parent
parser=argparse.ArgumentParser();parser.add_argument('--full',action='store_true');parser.add_argument('--same-session',action='store_true');args=parser.parse_args()
DB='codex_vocab_original_20261108_'+str(os.getpid());assert re.fullmatch(r'codex_vocab_original_20261108_\d+',DB)
SQLCMD=r'C:/Program Files/Microsoft SQL Server/Client SDK/ODBC/170/Tools/Binn/SQLCMD.EXE'
SOURCE=(OUT/'ORIGINAL_MERGE_TEMPLATE.sql').read_text(encoding='utf8')
DELIVERY=OUT/'GOP_BO_SUNG_GIU_BAN_GOC_ENGLISH_V4_1.sql'
tree=ast.parse((OUT/'test-merge-sql.py').read_text(encoding='utf8'))
SCHEMA=next(ast.literal_eval(n.value) for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='SCHEMA' for t in n.targets))
fast_tree=ast.parse((OUT/'test-fast-merge.py').read_text(encoding='utf8'))
plan_node=next(n for n in fast_tree.body if isinstance(n,ast.FunctionDef) and n.name=='plan')
PLAN=ast.literal_eval(plan_node.body[0].value)

def lit(v): return 'NULL' if v is None else "N'"+str(v).replace("'","''")+"'"
def batches(table,cols,rows):
    return '\n'.join('INSERT '+table+'('+cols+') VALUES\n'+',\n'.join('('+','.join(r)+')' for r in rows[i:i+200])+';' for i in range(0,len(rows),200))
def sql(content,name='query',fail=False,database=DB):
    file=OUT/('original-'+name+'.test.sql');file.write_text(content,encoding='utf-16')
    started=time.monotonic()
    p=subprocess.run([SQLCMD,'-S',r'localhost\SQLEXPRESS','-E','-C','-b','-r','1','-d',database,'-i',str(file),'-u','-W','-h','-1','-s','|'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=180)
    enc='utf-16' if p.stdout.startswith((b'\xff\xfe',b'\xfe\xff')) else ('utf-16-le' if b'\0' in p.stdout[:80] else 'utf8')
    output=p.stdout.decode(enc,errors='replace')+p.stderr.decode('utf8',errors='replace')
    (OUT/('original-'+name+'.log')).write_text(output,encoding='utf8')
    if fail: assert p.returncode!=0,'Expected failure: '+output[-1000:]
    else: assert p.returncode==0,output[-5000:]
    if args.full: print(name+': '+str(round(time.monotonic()-started,2))+'s',flush=True)
    return output

DATES="""ALTER TABLE dbo.tbl_question ADD create_date datetime2;
GO
UPDATE dbo.tbl_question SET create_date='20261107';
UPDATE dbo.tbl_question SET create_date='20261105' WHERE id IN(1,10,12,18,22);
UPDATE dbo.tbl_question SET create_date='20261021',modify_date='20261108' WHERE id=3;
"""
def reset():
    sql("""IF OBJECT_ID('dbo.codex_extra_history','U') IS NOT NULL DROP TABLE dbo.codex_extra_history;
DROP TABLE dbo.tbl_question_answer_test_result; DROP TABLE dbo.tbl_test_result; DROP TABLE dbo.tbl_enrolment_class_schedule_task;
DROP TABLE dbo.tbl_question_topic; DROP TABLE dbo.tbl_category; DROP TABLE dbo.tbl_question_answer; DROP TABLE dbo.tbl_question; DROP TABLE dbo.tbl_user;
DECLARE @ddl nvarchar(max)=N'';SELECT @ddl=@ddl+N'DROP TABLE dbo.'+QUOTENAME(name)+N';' FROM sys.tables WHERE name LIKE N'vocab_merge_english[_]%';
IF @ddl<>N'' EXEC sys.sp_executesql @ddl;
GO
"""+SCHEMA+DATES,'reset')
def script(apply=0,limit=1000):
    result=SOURCE.replace("@ExpectedDatabase sysname = N'ecommerce'","@ExpectedDatabase sysname = N'"+DB+"'")
    result=result.replace('DECLARE @Apply bit = 0;','DECLARE @Apply bit = '+str(apply)+';').replace('DECLARE @MaxGroups int = 1000;','DECLARE @MaxGroups int = '+str(limit)+';')
    result=result.replace('-- FAST_APPROVALS_START\n-- FAST_APPROVALS_END','-- FAST_APPROVALS_START\n'+PLAN.replace('#VM_','#VM4_')+'\n-- FAST_APPROVALS_END')
    known="INSERT #VM4_KnownMeanings(member_id,meaning) SELECT member_id,expected_meaning FROM #VM4_Approved;\nINSERT #VM4_KnownMeanings(member_id,meaning) SELECT member_id,previous_approved_meaning FROM #VM4_Approved WHERE previous_approved_meaning IS NOT NULL;"
    return result.replace('-- KNOWN_MEANINGS_START\n-- KNOWN_MEANINGS_END','-- KNOWN_MEANINGS_START\n'+known+'\n-- KNOWN_MEANINGS_END')
UNCHANGED="""IF (SELECT COUNT(*) FROM dbo.tbl_question)<>25 OR EXISTS(SELECT 1 FROM sys.tables WHERE name LIKE N'vocab_merge_english[_]%') RAISERROR('Unexpected writes',16,1);"""
created=False
try:
    sql("IF DB_ID(N'"+DB+"') IS NOT NULL RAISERROR('Test database exists',16,1); ELSE EXEC(N'CREATE DATABASE ["+DB+"]');",'create',database='master');created=True
    sql('ALTER DATABASE ['+DB+'] SET COMPATIBILITY_LEVEL=100;','compatibility',database='master')
    if args.same_session:
        sql(SCHEMA+DATES,'same-session-schema')
        previous=(OUT/'FAST_MERGE_TEMPLATE.sql').read_text(encoding='utf8')
        previous=previous.replace("@ExpectedDatabase sysname = N'ecommerce'","@ExpectedDatabase sysname = N'"+DB+"'")
        previous=previous.replace('-- FAST_APPROVALS_START\n-- FAST_APPROVALS_END','-- FAST_APPROVALS_START\n'+PLAN+'\n-- FAST_APPROVALS_END')
        # One SQLCMD call, one SPID, independent batches: temporary tables survive GO.
        sql(previous+'\nGO\n'+script()+'\nGO\n'+script(),'same-session-preview')
        sql(UNCHANGED,'same-session-no-writes')
        sql(previous+'\nGO\n'+script(1)+'\nGO\n'+script(1),'same-session-apply-repeat')
        sql("IF (SELECT COUNT(*) FROM dbo.tbl_question)<>19 OR (SELECT COUNT(*) FROM sys.tables WHERE name LIKE N'vocab_merge_english[_]%')<>7 OR NOT EXISTS(SELECT 1 FROM dbo.tbl_question WHERE id=3 AND create_date='20261021') RAISERROR('Same-session apply/repeat changed data incorrectly',16,1);",'same-session-apply-verify')
        print('PASS V3 then V4.1 then V4.1 in SAME SQL session: preview is read-only, apply preserves original, repeat is no-op',flush=True)
    elif not args.full:
        sql(SCHEMA+DATES,'schema')
        sql(script(),'preview');sql(UNCHANGED,'preview-verify')
        print('PASS preview does not write data',flush=True)
        sql(script(1),'apply')
        sql("""
IF (SELECT COUNT(*) FROM dbo.tbl_question)<>19 OR EXISTS(SELECT 1 FROM dbo.tbl_question WHERE id IN(1,2,11,13,19,23)) RAISERROR('Unexpected canonical IDs/count',16,1);
IF NOT EXISTS(SELECT 1 FROM dbo.tbl_question WHERE id=3 AND create_date='20261021' AND pronounce=N'/third/' AND level=N'A1' AND status=2 AND description IS NULL AND correct_answer=26 AND wrong_answer=33 AND time_reviewed=41 AND CONVERT(nvarchar(max),mother_tongue)=N'tối'+NCHAR(160)+N'thiểu') RAISERROR('Original date, meaning, metadata or counters changed',16,1);
IF (SELECT CONVERT(nvarchar(max),mother_tongue) FROM dbo.tbl_question WHERE id=18)<>N'khát vọng' RAISERROR('Original meaning overwritten by donor',16,1);
IF (SELECT COUNT(*) FROM dbo.tbl_question_topic WHERE question=3)<>4 OR NOT EXISTS(SELECT 1 FROM dbo.tbl_question_topic WHERE id=5 AND question=3) RAISERROR('Topic union or original link lost',16,1);
IF (SELECT COUNT(*) FROM dbo.tbl_category WHERE question=3)<>2 OR EXISTS(SELECT 1 FROM dbo.tbl_question_answer WHERE id IN(1,2,3) AND question<>3) OR (SELECT COUNT(*) FROM dbo.tbl_question_answer_test_result)<>6 RAISERROR('Category or history lost',16,1);
IF (SELECT COUNT(*) FROM sys.tables WHERE name LIKE N'vocab_merge_english[_]%')<>7 RAISERROR('Backup missing',16,1);
""",'verify')
        sql(script(1),'repeat');sql("IF (SELECT COUNT(*) FROM dbo.tbl_question)<>19 OR (SELECT COUNT(*) FROM sys.tables WHERE name LIKE N'vocab_merge_english[_]%')<>7 RAISERROR('Repeat changed data',16,1);",'repeat-verify')
        print('PASS old larger-ID original wins by create_date despite recent edit; meaning/metadata/topics/history preserved; repeat is no-op',flush=True)
        for mode,seed in [('cutoff',"UPDATE dbo.tbl_question SET create_date='20261106' WHERE id IN(1,2,3);"),('null-date',"UPDATE dbo.tbl_question SET create_date=NULL WHERE id IN(1,2,3);")]:
            reset();sql(seed,mode+'-seed');sql(script(1),mode)
            sql("IF (SELECT COUNT(*) FROM dbo.tbl_question)<>21 OR (SELECT COUNT(*) FROM dbo.tbl_question WHERE id IN(1,2,3))<>3 RAISERROR('No-original group changed',16,1);",mode+'-verify')
        print('PASS 6-Nov cutoff and missing dates skip whole group; other approved groups continue',flush=True)
        reset();sql("UPDATE dbo.tbl_question SET mother_tongue=N'ĐÃ SỬA TAY / GIỮ NGUYÊN' WHERE id=18;",'manual-seed');sql(script(1),'manual')
        sql("IF (SELECT COUNT(*) FROM dbo.tbl_question)<>20 OR (SELECT CONVERT(nvarchar(max),mother_tongue) FROM dbo.tbl_question WHERE id=18)<>N'ĐÃ SỬA TAY / GIỮ NGUYÊN' OR NOT EXISTS(SELECT 1 FROM dbo.tbl_question WHERE id=19) RAISERROR('Manual edit/group lost',16,1);",'manual-verify')
        print('PASS edits made after XML are kept; other groups continue',flush=True)
        reset();sql('UPDATE dbo.tbl_question SET user_id=27 WHERE id=3;','owner-seed');sql(script(1),'owner')
        sql("IF (SELECT COUNT(*) FROM dbo.tbl_question)<>21 OR NOT EXISTS(SELECT 1 FROM dbo.tbl_question WHERE id=3 AND user_id=27) RAISERROR('Foreign owner changed',16,1);",'owner-verify')
        print('PASS owner boundary',flush=True)
        reset();sql("UPDATE dbo.tbl_question SET mother_tongue=N'ít nhất' WHERE id=1; DELETE dbo.tbl_question_topic WHERE question=2; UPDATE dbo.tbl_category SET question=1 WHERE question=2; UPDATE dbo.tbl_question_answer SET question=1 WHERE question=2; DELETE dbo.tbl_question WHERE id=2;",'partial-seed');sql(script(1),'partial')
        sql("IF (SELECT COUNT(*) FROM dbo.tbl_question)<>19 OR EXISTS(SELECT 1 FROM dbo.tbl_question WHERE id IN(1,2)) OR NOT EXISTS(SELECT 1 FROM dbo.tbl_question WHERE id=3 AND create_date='20261021') RAISERROR('Incremental continuation failed',16,1);",'partial-verify')
        print('PASS partial prior merge and known previous meaning',flush=True)
        reset()
        for i in range(6): sql(script(1,1),'limit-'+str(i))
        sql("IF (SELECT COUNT(*) FROM dbo.tbl_question)<>19 OR (SELECT COUNT(*) FROM sys.tables WHERE name LIKE N'vocab_merge_english[_]%')<>35 RAISERROR('Batch continuation failed',16,1);",'limit-verify')
        print('PASS per-run limit and next-run continuation',flush=True)
        reset();sql('UPDATE dbo.tbl_question SET correct_answer=2147483647 WHERE id=1;','overflow-seed');sql(script(1),'overflow',fail=True);sql(UNCHANGED,'overflow-verify')
        reset();sql('CREATE TABLE dbo.codex_extra_history(id int PRIMARY KEY,question_id bigint REFERENCES dbo.tbl_question(id)); INSERT dbo.codex_extra_history VALUES(1,19);','fk-seed');sql(script(1),'fk',fail=True);sql(UNCHANGED,'fk-verify')
        print('PASS overflow and late FK failures roll back the entire run including backups',flush=True)
    else:
        sql(SCHEMA.split('SET IDENTITY_INSERT')[0]+'ALTER TABLE dbo.tbl_question ADD create_date datetime2;','xml-schema')
        root=ET.parse(r'C:/Users/Admin/Desktop/english-duplicates-20261108.xml').getroot()
        cards={int(e.findtext('id')):{c.tag:c.text or '' for c in e} for e in root}
        rows=[[str(i),'26','6','NULL','0',lit(c['word']),lit(c.get('meaning')),lit(c.get('ipa')),lit(c.get('cefr')),c.get('status') or 'NULL',c.get('correct') or '0',c.get('wrong') or '0',c.get('reviewed') or '0',lit(c.get('modified') or None),"N'keep original metadata'","'20261101'"] for i,c in cards.items()]
        seed='SET IDENTITY_INSERT dbo.tbl_question ON;\n'+batches('dbo.tbl_question','id,user_id,question_type,parent_id,voided,question,mother_tongue,pronounce,level,status,correct_answer,wrong_answer,time_reviewed,modify_date,description,create_date',rows)+'\nSET IDENTITY_INSERT dbo.tbl_question OFF;\n'
        seed+='INSERT dbo.tbl_question_topic(question,topic) SELECT id,1 FROM dbo.tbl_question; INSERT dbo.tbl_question_topic(question,topic) SELECT id,id+200000 FROM dbo.tbl_question; INSERT dbo.tbl_category(question,category) SELECT id,1 FROM dbo.tbl_question; INSERT dbo.tbl_question_answer(question,answer) SELECT id,id FROM dbo.tbl_question; INSERT dbo.tbl_question_answer_test_result(id,question_answer) SELECT id,id FROM dbo.tbl_question_answer;'
        sql(seed,'xml-seed')
        v3=(OUT/'GOP_NHANH_ENGLISH_20261108_V3.sql').read_text(encoding='utf-8-sig').replace("@ExpectedDatabase sysname = N'ecommerce'","@ExpectedDatabase sysname = N'"+DB+"'").replace('DECLARE @Apply bit = 0;','DECLARE @Apply bit = 1;').replace('DECLARE @MaxGroups int = 1000;','DECLARE @MaxGroups int = 10000;')
        sql(v3,'xml-prior-v3')
        plan=json.loads((OUT/'original-merge-plan.json').read_text(encoding='utf8'))
        # Snapshot the surviving original chosen from LIVE data after V3, including its exact definition.
        expected='CREATE TABLE #Members(cluster_id int,member_id bigint);\n'+batches('#Members','cluster_id,member_id',[[str(ci),str(i)] for ci,g in enumerate(plan,1) for i in g['ids']])
        expected+="\nSELECT c.cluster_id,q.id,q.mother_tongue AS meaning,q.pronounce,q.level,q.status,q.description,q.create_date INTO dbo.codex_expected FROM (SELECT m.cluster_id,MIN(q.id) AS primary_id FROM #Members m JOIN dbo.tbl_question q ON q.id=m.member_id GROUP BY m.cluster_id) c JOIN dbo.tbl_question q ON q.id=c.primary_id;"
        sql(expected,'xml-expect')
        v4=DELIVERY.read_text(encoding='utf-8-sig').replace("@ExpectedDatabase sysname = N'ecommerce'","@ExpectedDatabase sysname = N'"+DB+"'").replace('DECLARE @MaxGroups int = 1000;','DECLARE @MaxGroups int = 10000;')
        sql(v4,'xml-preview')
        prior_removed=sum(len(g['ids'])-1 for g in json.loads((OUT/'fast-merge-plan.json').read_text(encoding='utf8')))
        sql(f"IF (SELECT COUNT(*) FROM dbo.tbl_question)<>{len(cards)-prior_removed} RAISERROR('Preview changed data',16,1);",'xml-preview-verify')
        sql(v4.replace('DECLARE @Apply bit = 0;','DECLARE @Apply bit = 1;'),'xml-apply')
        removed=prior_removed+len(plan)
        verify=f"""IF (SELECT COUNT(*) FROM dbo.tbl_question)<>{len(cards)-removed} RAISERROR('Unexpected merged count',16,1);
IF EXISTS(SELECT 1 FROM dbo.codex_expected e LEFT JOIN dbo.tbl_question q ON q.id=e.id WHERE q.id IS NULL OR CONVERT(nvarchar(max),q.mother_tongue) COLLATE Latin1_General_BIN2<>CONVERT(nvarchar(max),e.meaning) COLLATE Latin1_General_BIN2 OR q.create_date<>e.create_date OR ISNULL(q.pronounce,N'')<>ISNULL(e.pronounce,N'') OR ISNULL(q.level,N'')<>ISNULL(e.level,N'') OR ISNULL(q.status,0)<>ISNULL(e.status,0) OR CONVERT(nvarchar(max),q.description)<>CONVERT(nvarchar(max),e.description)) RAISERROR('Original content/metadata changed',16,1);
IF (SELECT COUNT(*) FROM dbo.tbl_question_answer)<>{len(cards)} OR (SELECT COUNT(*) FROM dbo.tbl_question_answer_test_result)<>{len(cards)} OR (SELECT COUNT(*) FROM dbo.tbl_question_topic)<>{2*len(cards)-removed} OR (SELECT COUNT(*) FROM dbo.tbl_category)<>{len(cards)-removed} RAISERROR('Links/history lost',16,1);"""
        sql(verify,'xml-verify');sql(v4.replace('DECLARE @Apply bit = 0;','DECLARE @Apply bit = 1;'),'xml-repeat');sql(verify,'xml-repeat-verify')
        print(f'PASS full XML: V3 then {len(plan)} ADDITIONAL groups; live original content/metadata and all history/topics preserved; repeat no-op',flush=True)
finally:
    if created:
        sql('ALTER DATABASE ['+DB+'] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE ['+DB+'];','cleanup',database='master')
        print('Removed disposable local database '+DB,flush=True)
