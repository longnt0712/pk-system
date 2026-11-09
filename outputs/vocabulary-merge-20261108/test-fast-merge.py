"""Validate incremental planning and the existing merge engine in a local test DB."""
import ast
import os
from pathlib import Path
import re
import subprocess

OUT=Path(__file__).resolve().parent
SQLCMD=r'C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE'
DB='codex_vocab_fast_20261108_'+str(os.getpid())
assert re.fullmatch(r'codex_vocab_fast_20261108_\d+',DB)
SOURCE=(OUT/'FAST_MERGE_TEMPLATE.sql').read_text(encoding='utf8')
tree=ast.parse((OUT/'test-merge-sql.py').read_text(encoding='utf8'))
SCHEMA=next(ast.literal_eval(node.value) for node in tree.body if isinstance(node,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='SCHEMA' for t in node.targets))

def sql(content,database=DB,fail=False,name='fast-query'):
    file=OUT/(name+'.local-test.sql');file.write_text(content,encoding='utf-16')
    result=subprocess.run([SQLCMD,'-S',r'localhost\SQLEXPRESS','-E','-C','-b','-r','1','-d',database,
        '-i',str(file),'-u','-W','-h','-1','-s','|'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=180)
    encoding='utf-16' if result.stdout.startswith((b'\xff\xfe',b'\xfe\xff')) else ('utf-16-le' if b'\0' in result.stdout[:80] else 'utf8')
    output=result.stdout.decode(encoding,errors='replace')+result.stderr.decode('utf8',errors='replace')
    (OUT/(name+'.log')).write_text(output,encoding='utf8')
    if fail: assert result.returncode!=0,'Expected rejection'
    else: assert result.returncode==0,output[-5000:]
    return output

def reset():
    sql("""IF OBJECT_ID(N'dbo.codex_extra_history',N'U') IS NOT NULL DROP TABLE dbo.codex_extra_history;
DROP TABLE dbo.tbl_question_answer_test_result; DROP TABLE dbo.tbl_test_result;
DROP TABLE dbo.tbl_enrolment_class_schedule_task; DROP TABLE dbo.tbl_question_topic;
DROP TABLE dbo.tbl_category; DROP TABLE dbo.tbl_question_answer; DROP TABLE dbo.tbl_question; DROP TABLE dbo.tbl_user;
DECLARE @ddl nvarchar(max)=N'';
SELECT @ddl=@ddl+N'DROP TABLE dbo.'+QUOTENAME(name)+N';' FROM sys.tables WHERE name LIKE N'vocab_merge_english[_]%';
IF @ddl<>N'' EXEC sys.sp_executesql @ddl;
GO
"""+SCHEMA,name='fast-reset')

def plan():
    return """INSERT #VM_Approved VALUES
(1,1,N'minimal',N'tối thiểu',N'ít nhất',N'tối thiểu'),
(1,2,N'minimal',N'tối  thiểu',NULL,N'tối thiểu'),
(1,3,N'minimal',N'tối'+NCHAR(160)+N'thiểu',NULL,N'tối thiểu'),
(2,22,N'symbol',N'lời ''nói'' / ký hiệu',NULL,N'lời ''nói'' / ký hiệu'),
(2,23,N'symbol',N'lời ''nói'' / ký hiệu',NULL,N'lời ''nói'' / ký hiệu'),
(3,18,N'aspiration',N'khát vọng',NULL,N'hoài bão'),
(3,19,N'aspiration',N'hoài bão',NULL,N'hoài bão'),
(4,10,N'has task',N'bài giao',NULL,N'bài giao'),
(4,11,N'has task',N'bài giao',NULL,N'bài giao'),
(5,12,N'has result',N'kết quả',NULL,N'kết quả'),
(5,13,N'has result',N'kết quả',NULL,N'kết quả'),
(6,7,N'has child',N'giữ nguyên',NULL,N'giữ nguyên'),
(6,8,N'has child',N'giữ nguyên',NULL,N'giữ nguyên'),
(7,24,N'void card',N'ẩn',NULL,N'ẩn'),
(7,25,N'void card',N'ẩn',NULL,N'ẩn');"""

def script(apply=0,limit=1000,approvals=None,refs=True):
    result=SOURCE.replace("@ExpectedDatabase sysname = N'ecommerce'","@ExpectedDatabase sysname = N'"+DB+"'")
    result=result.replace('DECLARE @Apply bit = 0;','DECLARE @Apply bit = '+str(apply)+';')
    result=result.replace('DECLARE @MaxGroups int = 1000;','DECLARE @MaxGroups int = '+str(limit)+';')
    if not refs: result=result.replace('DECLARE @MergeTestReferences bit = 1;','DECLARE @MergeTestReferences bit = 0;')
    return result.replace('-- FAST_APPROVALS_START\n-- FAST_APPROVALS_END',
        '-- FAST_APPROVALS_START\n'+(plan() if approvals is None else approvals)+'\n-- FAST_APPROVALS_END')

UNCHANGED="""
IF (SELECT COUNT(*) FROM dbo.tbl_question)<>25 RAISERROR('Unexpected question count',16,1);
IF EXISTS(SELECT 1 FROM sys.tables WHERE name LIKE N'vocab_merge_english[_]%') RAISERROR('Unexpected backup writes',16,1);
IF (SELECT question FROM dbo.tbl_question_answer WHERE id=2)<>2 RAISERROR('Answer link changed',16,1);
"""
created=False
try:
    sql("IF DB_ID(N'"+DB+"') IS NOT NULL RAISERROR('Test database exists',16,1); ELSE EXEC(N'CREATE DATABASE ["+DB+"]');",'master',name='fast-create');created=True
    sql('ALTER DATABASE ['+DB+'] SET COMPATIBILITY_LEVEL=100;','master',name='fast-compatibility')
    sql(SCHEMA,name='fast-schema')
    sql(script(),name='fast-preview');sql(UNCHANGED,name='fast-preview-verify')
    print('PASS preview has no data or backup writes',flush=True)
    sql("""ALTER TABLE dbo.tbl_enrolment_class_schedule_task ADD progress nvarchar(100),required_successes int;
ALTER TABLE dbo.tbl_test_result ADD result_status nvarchar(20),attempt_key nvarchar(100);
GO
UPDATE dbo.tbl_enrolment_class_schedule_task SET source_question_id=11,ielts_test_id=13,progress=N'keep progress',required_successes=3;
UPDATE dbo.tbl_test_result SET source_question_id=13,result_status=N'SUCCESS',attempt_key=N'keep attempt';""",name='fast-history-seed')
    sql(script(1),name='fast-apply')
    sql("""
IF (SELECT COUNT(*) FROM dbo.tbl_question)<>19 RAISERROR('Wrong merged count',16,1);
IF EXISTS(SELECT 1 FROM dbo.tbl_question WHERE id IN(2,3,11,13,19,23)) RAISERROR('Sources remain',16,1);
IF (SELECT COUNT(*) FROM dbo.tbl_question_topic WHERE question=1)<>4 RAISERROR('Topic union lost',16,1);
IF (SELECT question FROM dbo.tbl_question_topic WHERE id=1)<>1 RAISERROR('Primary topic link removed',16,1);
IF (SELECT COUNT(*) FROM dbo.tbl_category WHERE question=1)<>2 RAISERROR('Category union lost',16,1);
IF (SELECT COUNT(*) FROM dbo.tbl_question_answer_test_result)<>6 RAISERROR('Result IDs lost',16,1);
IF EXISTS(SELECT 1 FROM dbo.tbl_question_answer WHERE id IN(1,2,3) AND question<>1) RAISERROR('Answer history not moved',16,1);
IF NOT EXISTS(SELECT 1 FROM dbo.tbl_question WHERE id=1 AND correct_answer=26 AND wrong_answer=33 AND time_reviewed=41 AND status=4 AND level=N'B2' AND pronounce=N'/main/' AND CONVERT(nvarchar(max),description)=N'KEEP description') RAISERROR('Metadata or counters changed',16,1);
IF (SELECT CONVERT(nvarchar(max),mother_tongue) FROM dbo.tbl_question WHERE id=18)<>N'hoài bão' RAISERROR('Approved definition not kept',16,1);
IF NOT EXISTS(SELECT 1 FROM dbo.tbl_enrolment_class_schedule_task WHERE id=1 AND source_question_id=10 AND ielts_test_id=12 AND progress=N'keep progress' AND required_successes=3) RAISERROR('Task ID or progress changed',16,1);
IF NOT EXISTS(SELECT 1 FROM dbo.tbl_test_result WHERE id=1 AND source_question_id=12 AND result_status=N'SUCCESS' AND attempt_key=N'keep attempt') RAISERROR('Result or attempt changed',16,1);
IF (SELECT COUNT(*) FROM sys.tables WHERE name LIKE N'vocab_merge_english[_]%')<>7 RAISERROR('Missing backup tables',16,1);
IF (SELECT COUNT(*) FROM dbo.tbl_question WHERE id IN(4,5,6,7,8,9,14,15,16,17,20,21,24,25))<>14 RAISERROR('Unselected owner, sense, children, blank or void cards changed',16,1);
""",name='fast-apply-verify')
    sql(script(1),name='fast-repeat')
    sql("IF (SELECT COUNT(*) FROM dbo.tbl_question)<>19 OR (SELECT COUNT(*) FROM sys.tables WHERE name LIKE N'vocab_merge_english[_]%')<>7 RAISERROR('Repeat not idempotent',16,1);",name='fast-repeat-verify')
    print('PASS merge, topic/category unions, primary metadata, counters, saved answer/task/result IDs and repeatability',flush=True)
    reset()
    sql("UPDATE dbo.tbl_question SET mother_tongue=N'ĐÃ SỬA TAY / GIỮ NGUYÊN' WHERE id=19;",name='fast-manual-seed')
    out=sql(script(1),name='fast-manual-skip');assert 'Nghĩa đã sửa' in out
    sql("IF (SELECT COUNT(*) FROM dbo.tbl_question)<>20 OR (SELECT CONVERT(nvarchar(max),mother_tongue) FROM dbo.tbl_question WHERE id=19)<>N'ĐÃ SỬA TAY / GIỮ NGUYÊN' OR NOT EXISTS(SELECT 1 FROM dbo.tbl_question WHERE id=18) RAISERROR('Manual edit overwritten or other groups blocked',16,1);",name='fast-manual-verify')
    print('PASS manual edits skip their entire group while other approved groups continue',flush=True)
    reset()
    sql("UPDATE dbo.tbl_question_topic SET question=1 WHERE question=2; UPDATE dbo.tbl_category SET question=1 WHERE question=2; UPDATE dbo.tbl_question_answer SET question=1 WHERE question=2; DELETE dbo.tbl_question WHERE id=2; UPDATE dbo.tbl_question SET mother_tongue=N'ít nhất' WHERE id=1;",name='fast-partial-seed')
    sql(script(1),name='fast-partial')
    sql("IF (SELECT COUNT(*) FROM dbo.tbl_question)<>19 OR EXISTS(SELECT 1 FROM dbo.tbl_question WHERE id=3) OR (SELECT CONVERT(nvarchar(max),mother_tongue) FROM dbo.tbl_question WHERE id=1)<>N'tối thiểu' RAISERROR('Partial prior merge not handled',16,1);",name='fast-partial-verify')
    print('PASS missing source and an explicitly approved earlier definition allow incremental continuation',flush=True)
    reset()
    sql("UPDATE dbo.tbl_question_topic SET question=2 WHERE question=1; UPDATE dbo.tbl_category SET question=2 WHERE question=1; UPDATE dbo.tbl_question_answer SET question=2 WHERE question=1; DELETE dbo.tbl_question WHERE id=1;",name='fast-missing-primary-seed')
    sql(script(1),name='fast-missing-primary')
    sql("IF (SELECT COUNT(*) FROM dbo.tbl_question)<>19 OR EXISTS(SELECT 1 FROM dbo.tbl_question WHERE id=3) OR (SELECT CONVERT(nvarchar(max),mother_tongue) FROM dbo.tbl_question WHERE id=2)<>N'tối thiểu' RAISERROR('Missing primary not handled',16,1);",name='fast-missing-primary-verify')
    print('PASS missing old primary selects the smallest eligible remaining ID',flush=True)
    for name,change in [('foreign','user_id=27'),('renamed',"question=N'maximal'"),('long',"mother_tongue=REPLICATE(N'x',501)"),('type','question_type=2')]:
        reset();sql('UPDATE dbo.tbl_question SET '+change+' WHERE id=3;',name='fast-'+name+'-seed')
        sql(script(1),name='fast-'+name)
        sql("IF (SELECT COUNT(*) FROM dbo.tbl_question)<>21 OR (SELECT COUNT(*) FROM dbo.tbl_question WHERE id IN(1,2,3))<>3 RAISERROR('Unsafe member not excluded as a whole group',16,1);",name='fast-'+name+'-verify')
    print('PASS foreign owner, renamed word, overlength definition and non-vocabulary type skip the entire cluster',flush=True)
    reset()
    sql("SET IDENTITY_INSERT dbo.tbl_question ON; INSERT dbo.tbl_question(id,user_id,question_type,parent_id,voided,question,mother_tongue) VALUES(999,26,6,NULL,0,N'minimal',N'new unreviewed meaning'); SET IDENTITY_INSERT dbo.tbl_question OFF;",name='fast-new-seed')
    sql(script(1),name='fast-new')
    sql("IF (SELECT COUNT(*) FROM dbo.tbl_question)<>20 OR NOT EXISTS(SELECT 1 FROM dbo.tbl_question WHERE id=999 AND CONVERT(nvarchar(max),mother_tongue)=N'new unreviewed meaning') RAISERROR('New unreviewed card was merged',16,1);",name='fast-new-verify')
    print('PASS new cards outside the XML remain untouched',flush=True)
    reset()
    for iteration in range(6):sql(script(1,limit=1),name='fast-limit-'+str(iteration))
    sql("IF (SELECT COUNT(*) FROM dbo.tbl_question)<>19 OR (SELECT COUNT(*) FROM sys.tables WHERE name LIKE N'vocab_merge_english[_]%')<>35 RAISERROR('Batched continuation incorrect',16,1);",name='fast-limit-verify')
    print('PASS per-run limit, next-group continuation and completed-run no-op',flush=True)
    reset();sql('UPDATE dbo.tbl_question SET correct_answer=2147483647 WHERE id=1;',name='fast-overflow-seed')
    sql(script(1),fail=True,name='fast-overflow');sql(UNCHANGED,name='fast-overflow-verify')
    print('PASS counter overflow aborts before mutations',flush=True)
    reset();sql('CREATE TABLE dbo.codex_extra_history(id int PRIMARY KEY,question_id bigint REFERENCES dbo.tbl_question(id)); INSERT dbo.codex_extra_history VALUES(1,19);',name='fast-unknown-fk')
    sql(script(1),fail=True,name='fast-late-fk')
    sql(UNCHANGED+"IF (SELECT COUNT(*) FROM dbo.tbl_question_topic)<>10 RAISERROR('Late failure did not roll back links',16,1);",name='fast-late-fk-verify')
    print('PASS unknown FK failure restores all changes and transactional backups',flush=True)
finally:
    if created:
        sql('ALTER DATABASE ['+DB+'] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE ['+DB+'];','master',name='fast-cleanup')
        print('Removed disposable local database '+DB,flush=True)
