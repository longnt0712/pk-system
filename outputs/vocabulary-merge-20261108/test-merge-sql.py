"""Exercise the manual migration in a disposable LOCAL database, never the server."""
import os
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
SQLCMD = r'C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE'
DB = 'codex_vocab_merge_20261108_' + str(os.getpid())
assert re.fullmatch(r'codex_vocab_merge_20261108_\d+', DB)
SOURCE = (ROOT / 'richy/database/vocabulary-duplicates-english-merge.sql').read_text(encoding='utf-8-sig')

def sql(text, database=DB, fail=False, name='query'):
    file = OUT / (name + '.local-test.sql')
    file.write_text(text, encoding='utf-16')
    process = subprocess.run([SQLCMD, '-S', r'localhost\SQLEXPRESS', '-E', '-C', '-b', '-r', '1',
                              '-d', database, '-i', str(file), '-u', '-W', '-h', '-1', '-s', '|'],
                             stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=90)
    encoding = 'utf-16' if process.stdout.startswith((b'\xff\xfe',b'\xfe\xff')) else ('utf-16-le' if b'\0' in process.stdout[:80] else 'utf-8')
    output = process.stdout.decode(encoding, errors='replace') + process.stderr.decode('utf-8', errors='replace')
    (OUT / (name + '.log')).write_text(output, encoding='utf-8')
    if fail:
        assert process.returncode != 0, 'Expected a guarded failure: ' + output[-2000:]
    elif process.returncode:
        raise AssertionError(output[-5000:])
    return output

SCHEMA = """
SET NOCOUNT ON;
CREATE TABLE dbo.tbl_user(id bigint PRIMARY KEY,username nvarchar(100));
CREATE TABLE dbo.tbl_question(
 id bigint IDENTITY PRIMARY KEY,user_id bigint REFERENCES dbo.tbl_user(id),question_type bigint,
 parent_id bigint REFERENCES dbo.tbl_question(id),voided bit,question ntext,mother_tongue ntext,
 pronounce nvarchar(255),level nvarchar(2),status int,correct_answer int,wrong_answer int,time_reviewed int,
 modify_date datetime2,modified_by nvarchar(100),description ntext);
CREATE TABLE dbo.tbl_question_topic(id bigint IDENTITY PRIMARY KEY,question bigint NOT NULL REFERENCES dbo.tbl_question(id),topic bigint);
CREATE TABLE dbo.tbl_category(id bigint IDENTITY PRIMARY KEY,question bigint REFERENCES dbo.tbl_question(id),category bigint);
CREATE TABLE dbo.tbl_question_answer(id bigint IDENTITY PRIMARY KEY,question bigint NOT NULL REFERENCES dbo.tbl_question(id),answer bigint);
CREATE TABLE dbo.tbl_question_answer_test_result(id bigint PRIMARY KEY,question_answer bigint REFERENCES dbo.tbl_question_answer(id));
CREATE TABLE dbo.tbl_test_result(id bigint PRIMARY KEY,source_question_id bigint REFERENCES dbo.tbl_question(id));
CREATE TABLE dbo.tbl_enrolment_class_schedule_task(id bigint PRIMARY KEY,source_question_id bigint REFERENCES dbo.tbl_question(id),ielts_test_id bigint REFERENCES dbo.tbl_question(id));
INSERT dbo.tbl_user VALUES(26,N'english'),(27,N'other');
SET IDENTITY_INSERT dbo.tbl_question ON;
INSERT dbo.tbl_question(id,user_id,question_type,parent_id,voided,question,mother_tongue,pronounce,level,status,correct_answer,wrong_answer,time_reviewed,description)
VALUES
 (1,26,6,NULL,0,N'minimal',N'tối thiểu',N'/main/',N'B2',4,2,3,5,N'KEEP description'),
 (2,26,6,NULL,0,N' minimal ',N'tối  thiểu',N'/other/',N'C1',1,7,11,13,N'Other description'),
 (3,26,6,NULL,0,N'MINIMAL',N'tối'+NCHAR(160)+N'thiểu',N'/third/',N'A1',2,17,19,23,NULL),
 (4,26,6,NULL,0,N'minimal',N'rất nhỏ',NULL,NULL,1,0,0,0,NULL),
 (5,27,6,NULL,0,N'minimal',N'tối thiểu',NULL,NULL,1,100,0,0,NULL),
 (6,26,6,NULL,0,N'minimalism',N'tối thiểu',NULL,NULL,1,0,0,0,NULL),
 (7,26,6,NULL,0,N'has child',N'giữ nguyên',NULL,NULL,1,0,0,0,NULL),
 (8,26,6,NULL,0,N'has child',N'giữ nguyên',NULL,NULL,1,0,0,0,NULL),
 (9,26,6,7,0,N'child',N'con',NULL,NULL,1,0,0,0,NULL),
 (10,26,6,NULL,0,N'has task',N'bài giao',NULL,NULL,1,0,0,0,NULL),
 (11,26,6,NULL,0,N'has task',N'bài giao',NULL,NULL,1,0,0,0,NULL),
 (12,26,6,NULL,0,N'has result',N'kết quả',NULL,NULL,1,0,0,0,NULL),
 (13,26,6,NULL,0,N'has result',N'kết quả',NULL,NULL,1,0,0,0,NULL),
 (14,26,2,NULL,0,N'not vocab',N'không phải từ',NULL,NULL,1,0,0,0,NULL),
 (15,26,2,NULL,0,N'not vocab',N'không phải từ',NULL,NULL,1,0,0,0,NULL),
 (16,26,6,NULL,0,N'accent',N'đa',NULL,NULL,1,0,0,0,NULL),
 (17,26,6,NULL,0,N'accent',N'đà',NULL,NULL,1,0,0,0,NULL),
 (18,26,6,NULL,0,N'aspiration',N'khát vọng',NULL,NULL,1,0,0,0,NULL),
 (19,26,6,NULL,0,N'aspiration',N'hoài bão',NULL,NULL,1,0,0,0,NULL),
 (20,26,6,NULL,0,N'blank',N'',NULL,NULL,1,0,0,0,NULL),
 (21,26,6,NULL,0,N'blank',NULL,NULL,NULL,1,0,0,0,NULL),
 (22,26,6,NULL,0,N'symbol',N'lời ''nói'' / ký hiệu',NULL,NULL,1,0,0,0,NULL),
 (23,26,6,NULL,0,N'symbol',N'lời ''nói'' / ký hiệu',N'/x/',N'A1',1,0,0,0,NULL),
 (24,26,6,NULL,1,N'void card',N'ẩn',NULL,NULL,1,0,0,0,NULL),
 (25,26,6,NULL,0,N'void card',N'ẩn',NULL,NULL,1,0,0,0,NULL);
SET IDENTITY_INSERT dbo.tbl_question OFF;
INSERT dbo.tbl_enrolment_class_schedule_task VALUES(1,10,NULL);
INSERT dbo.tbl_test_result VALUES(1,12);
INSERT dbo.tbl_question_topic(question,topic) VALUES(1,100),(1,101),(2,100),(2,102),(3,103),(4,104),(5,105),(22,200),(23,200),(23,201);
INSERT dbo.tbl_category(question,category) VALUES(1,10),(2,10),(3,11),(5,12);
INSERT dbo.tbl_question_answer(question,answer) VALUES(1,10),(2,11),(3,12),(5,13),(22,14),(23,15);
INSERT dbo.tbl_question_answer_test_result VALUES(1,1),(2,2),(3,3),(4,4),(5,5),(6,6);
"""

def reset():
    sql("""DROP TABLE dbo.tbl_question_answer_test_result;
DROP TABLE dbo.tbl_test_result;DROP TABLE dbo.tbl_enrolment_class_schedule_task;
DROP TABLE dbo.tbl_question_topic;DROP TABLE dbo.tbl_category;DROP TABLE dbo.tbl_question_answer;
DROP TABLE dbo.tbl_question;DROP TABLE dbo.tbl_user;
DECLARE @x nvarchar(max)=N'';
SELECT @x=@x+N'DROP TABLE dbo.'+QUOTENAME(name)+N';' FROM sys.tables WHERE name LIKE N'vocab_merge_english[_]%';
IF @x<>N'' EXEC sys.sp_executesql @x;
GO
""" + SCHEMA, name='reset')

def script(apply=0, reviewed='', allow_test_references=False):
    result = SOURCE.replace("@ExpectedDatabase sysname = N'ecommerce'", "@ExpectedDatabase sysname = N'" + DB + "'")
    result = result.replace('DECLARE @Apply bit = 0;', 'DECLARE @Apply bit = ' + str(apply) + ';')
    if allow_test_references:
        result = result.replace('DECLARE @MergeTestReferences bit = 0;', 'DECLARE @MergeTestReferences bit = 1;')
    return re.sub(r'-- REVIEWED_MEANINGS_START.*?-- REVIEWED_MEANINGS_END',
                  '-- REVIEWED_MEANINGS_START\n' + reviewed + '\n-- REVIEWED_MEANINGS_END', result, flags=re.S)

VERIFY_UNCHANGED = """
IF (SELECT COUNT(*) FROM dbo.tbl_question)<>25 RAISERROR('Questions changed unexpectedly',16,1);
IF EXISTS(SELECT 1 FROM sys.tables WHERE name LIKE N'vocab_merge_english[_]%') RAISERROR('Backup tables should not exist',16,1);
IF (SELECT question FROM dbo.tbl_question_answer WHERE id=2)<>2 RAISERROR('History changed unexpectedly',16,1);
"""
created = False
try:
    sql("IF DB_ID(N'"+DB+"') IS NOT NULL RAISERROR('Test database already exists',16,1); ELSE EXEC(N'CREATE DATABASE ["+DB+"]');", 'master', name='create')
    created = True
    sql('ALTER DATABASE ['+DB+'] SET COMPATIBILITY_LEVEL=100;', 'master', name='compatibility')
    sql(SCHEMA, name='schema')
    sql(script(), name='preview')
    sql(VERIFY_UNCHANGED, name='verify-preview')
    print('PASS: preview leaves questions, links and backup schema untouched', flush=True)
    sql(script(1), name='apply')
    sql("""
IF (SELECT COUNT(*) FROM dbo.tbl_question)<>22 RAISERROR('Wrong merged count',16,1);
IF EXISTS(SELECT 1 FROM dbo.tbl_question WHERE id IN(2,3,23)) RAISERROR('Sources remain',16,1);
IF EXISTS(SELECT 1 FROM dbo.tbl_question WHERE id=1 AND (correct_answer<>26 OR wrong_answer<>33 OR time_reviewed<>41 OR status<>4 OR level<>N'B2' OR pronounce<>N'/main/' OR CONVERT(nvarchar(max),description)<>N'KEEP description')) RAISERROR('Canonical metadata or counters changed',16,1);
IF (SELECT COUNT(*) FROM dbo.tbl_question_topic WHERE question=1)<>4 RAISERROR('Topic union incorrect',16,1);
IF (SELECT question FROM dbo.tbl_question_topic WHERE id=1)<>1 RAISERROR('Canonical topic link removed',16,1);
IF (SELECT COUNT(*) FROM dbo.tbl_category WHERE question=1)<>2 RAISERROR('Category union incorrect',16,1);
IF EXISTS(SELECT 1 FROM dbo.tbl_question_answer WHERE id IN(1,2,3) AND question<>1) RAISERROR('Answers not moved',16,1);
IF (SELECT COUNT(*) FROM dbo.tbl_question_answer_test_result)<>6 RAISERROR('Result history lost',16,1);
IF (SELECT COUNT(*) FROM dbo.tbl_question WHERE id IN(4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,24,25))<>20 RAISERROR('Unselected owner, meaning, children or test roots changed',16,1);
IF (SELECT COUNT(*) FROM sys.tables WHERE name LIKE N'vocab_merge_english[_]%')<>5 RAISERROR('Missing backups',16,1);
""", name='verify-apply')
    print('PASS: exact meaning merge; complete topic/category union; metadata, other owners and result IDs preserved', flush=True)
    sql(script(1), name='repeat')
    sql("IF (SELECT COUNT(*) FROM dbo.tbl_question)<>22 RAISERROR('Repeat changed data',16,1);", name='verify-repeat')
    print('PASS: repeated exact merge is idempotent', flush=True)
    reset()
    reviewed = "INSERT #VM_Reviewed VALUES(19,18,N'aspiration',N'khát vọng',N'hoài bão',N'hoài bão');"
    sql(script(1, reviewed), name='reviewed')
    sql("IF EXISTS(SELECT 1 FROM dbo.tbl_question WHERE id=19) OR (SELECT CONVERT(nvarchar(max),mother_tongue) FROM dbo.tbl_question WHERE id=18)<>N'hoài bão' RAISERROR('Reviewed meaning not applied',16,1);", name='verify-reviewed')
    print('PASS: explicitly reviewed near meanings keep one chosen definition', flush=True)
    sql(script(1, reviewed), name='repeat-reviewed')
    sql("IF (SELECT COUNT(*) FROM dbo.tbl_question)<>21 OR (SELECT CONVERT(nvarchar(max),mother_tongue) FROM dbo.tbl_question WHERE id=18)<>N'hoài bão' RAISERROR('Repeat reviewed merge changed data',16,1);", name='verify-repeat-reviewed')
    print('PASS: repeating a reviewed plan keeps the chosen meaning without merging other senses', flush=True)
    reset()
    sql(script(1, reviewed.replace("N'hoài bão',N'hoài bão'", "N'stale',N'hoài bão'")), fail=True, name='stale')
    sql(VERIFY_UNCHANGED, name='verify-stale')
    print('PASS: stale approval refuses all merges', flush=True)
    sql('UPDATE dbo.tbl_question SET correct_answer=2147483647 WHERE id=1;', name='seed-overflow')
    sql(script(1), fail=True, name='overflow')
    sql(VERIFY_UNCHANGED, name='verify-overflow')
    print('PASS: counter overflow rolls back the entire batch', flush=True)
    reset()
    sql("CREATE TRIGGER dbo.codex_deny_delete ON dbo.tbl_question AFTER DELETE AS BEGIN RAISERROR('Synthetic failure after writes',16,1); END;", name='late-trigger')
    sql(script(1), fail=True, name='late-failure')
    sql(VERIFY_UNCHANGED + "IF (SELECT COUNT(*) FROM dbo.tbl_question_topic)<>10 RAISERROR('Topic changes not rolled back',16,1);", name='verify-late-failure')
    print('PASS: failure after link moves restores all data and removes transactional backups', flush=True)
    reset()
    sql("""
ALTER TABLE dbo.tbl_enrolment_class_schedule_task ADD required_successes int NULL, progress nvarchar(100) NULL;
ALTER TABLE dbo.tbl_test_result ADD attempt_key nvarchar(100) NULL,result_status nvarchar(20) NULL;
GO
UPDATE dbo.tbl_enrolment_class_schedule_task SET source_question_id=11,ielts_test_id=13,required_successes=3,progress=N'unchanged progress' WHERE id=1;
INSERT dbo.tbl_enrolment_class_schedule_task(id,source_question_id,ielts_test_id) VALUES(2,NULL,11);
UPDATE dbo.tbl_test_result SET source_question_id=13,attempt_key=N'same-attempt',result_status=N'SUCCESS' WHERE id=1;
""", name='seed-test-references')
    sql(script(allow_test_references=True), name='preview-test-references')
    sql(VERIFY_UNCHANGED + "IF (SELECT source_question_id FROM dbo.tbl_enrolment_class_schedule_task WHERE id=1)<>11 RAISERROR('Preview moved a task reference',16,1);", name='verify-preview-test-references')
    sql(script(1, allow_test_references=True), name='apply-test-references')
    sql("""
IF (SELECT COUNT(*) FROM dbo.tbl_question)<>20 RAISERROR('Wrong referenced merge count',16,1);
IF EXISTS(SELECT 1 FROM dbo.tbl_question WHERE id IN(2,3,11,13,23)) RAISERROR('Referenced source not merged',16,1);
IF NOT EXISTS(SELECT 1 FROM dbo.tbl_enrolment_class_schedule_task WHERE id=1 AND source_question_id=10 AND ielts_test_id=12 AND required_successes=3 AND progress=N'unchanged progress') RAISERROR('Task ID, settings or progress changed',16,1);
IF NOT EXISTS(SELECT 1 FROM dbo.tbl_enrolment_class_schedule_task WHERE id=2 AND source_question_id IS NULL AND ielts_test_id=10) RAISERROR('Nullable task reference changed',16,1);
IF NOT EXISTS(SELECT 1 FROM dbo.tbl_test_result WHERE id=1 AND source_question_id=12 AND attempt_key=N'same-attempt' AND result_status=N'SUCCESS') RAISERROR('Result ID, attempt or status changed',16,1);
IF (SELECT COUNT(*) FROM dbo.tbl_question_answer_test_result)<>6 RAISERROR('Answer result history lost',16,1);
IF (SELECT COUNT(*) FROM sys.tables WHERE name LIKE N'vocab_merge_english[_]%')<>7 RAISERROR('Referenced rows not backed up',16,1);
IF NOT EXISTS(SELECT 1 FROM dbo.tbl_question WHERE id=7) OR (SELECT parent_id FROM dbo.tbl_question WHERE id=9)<>7 RAISERROR('Nested test structure changed',16,1);
""", name='verify-apply-test-references')
    sql(script(1, allow_test_references=True), name='repeat-test-references')
    print('PASS: referenced cards merge; task/result IDs, progress, success status, attempt and answer history stay intact', flush=True)
    reset()
    sql("UPDATE dbo.tbl_enrolment_class_schedule_task SET source_question_id=11; UPDATE dbo.tbl_test_result SET source_question_id=13;", name='seed-reference-failure')
    sql("CREATE TRIGGER dbo.codex_deny_ref_delete ON dbo.tbl_question AFTER DELETE AS BEGIN RAISERROR('Failure after reference changes',16,1); END;", name='reference-trigger')
    sql(script(1, allow_test_references=True), fail=True, name='late-reference-failure')
    sql(VERIFY_UNCHANGED + "IF (SELECT source_question_id FROM dbo.tbl_enrolment_class_schedule_task WHERE id=1)<>11 OR (SELECT source_question_id FROM dbo.tbl_test_result WHERE id=1)<>13 RAISERROR('References not rolled back',16,1);", name='verify-reference-rollback')
    print('PASS: a late failure also restores task/result references and removes backups', flush=True)
    reset()
    changed = sql(script(1, reviewed.replace("N'hoài bão',N'hoài bão'", "N'stale',N'hoài bão'"), True), fail=True, name='reference-mode-stale')
    assert 'Nghĩa bản phụ không khớp XML' in changed, changed[-3000:]
    sql(VERIFY_UNCHANGED, name='verify-reference-mode-stale')
    print('PASS: enabling test references still rejects changed meanings and reports the specific blocked IDs/reason', flush=True)
finally:
    if created:
        sql('ALTER DATABASE ['+DB+'] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE ['+DB+'];', 'master', name='cleanup')
        print('Removed disposable local database ' + DB, flush=True)
