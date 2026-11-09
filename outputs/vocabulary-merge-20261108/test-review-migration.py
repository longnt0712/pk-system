"""Run the schema migration only in a disposable LOCAL database."""
import os
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
SQLCMD = r'C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE'
DB = 'codex_vocab_review_20261108_' + str(os.getpid())
assert re.fullmatch(r'codex_vocab_review_20261108_\d+', DB)
MIGRATION = (ROOT / 'richy/database/vocabulary-duplicate-review.sql').read_text(encoding='utf-8-sig')

def sql(content, database=DB, fail=False, name='review-migration'):
    file = OUT / (name + '.local-test.sql')
    file.write_text(content, encoding='utf-16')
    result = subprocess.run([SQLCMD, '-S', r'localhost\SQLEXPRESS', '-E', '-C', '-b', '-r', '1',
                             '-d', database, '-i', str(file), '-u', '-W', '-h', '-1'],
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=45)
    encoding = 'utf-16' if result.stdout.startswith((b'\xff\xfe', b'\xfe\xff')) else ('utf-16-le' if b'\0' in result.stdout[:80] else 'utf-8')
    output = result.stdout.decode(encoding, errors='replace') + result.stderr.decode('utf-8', errors='replace')
    (OUT / (name + '.log')).write_text(output, encoding='utf-8')
    if fail:
        assert result.returncode != 0, 'Expected schema guard to reject the wrong type'
    else:
        assert result.returncode == 0, output[-4000:]
    return output

created = False
try:
    sql("IF DB_ID(N'" + DB + "') IS NOT NULL RAISERROR('Test database already exists',16,1); ELSE EXEC(N'CREATE DATABASE [" + DB + "]');",
        'master', name='review-create')
    created = True
    sql('ALTER DATABASE ['+DB+'] SET COMPATIBILITY_LEVEL=100;', 'master', name='review-compatibility')
    sql("CREATE TABLE dbo.tbl_question(id bigint PRIMARY KEY, question nvarchar(200), mother_tongue nvarchar(500));\n"
        "INSERT dbo.tbl_question VALUES(1,N'minimal',N'tối thiểu');", name='review-schema')
    sql(MIGRATION, name='review-first')
    sql(MIGRATION, name='review-repeat')
    sql("IF (SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.tbl_question') AND name IN (N'duplicate_reviewed_key',N'duplicate_reviewed_at') AND is_nullable=1)<>2 RAISERROR('Missing nullable columns',16,1);\n"
        "IF (SELECT COUNT(*) FROM dbo.tbl_question WHERE id=1 AND question=N'minimal' AND mother_tongue=N'tối thiểu' AND duplicate_reviewed_key IS NULL AND duplicate_reviewed_at IS NULL)<>1 RAISERROR('Existing vocabulary changed',16,1);",
        name='review-verify')
    sql('DROP TABLE dbo.tbl_question;\nGO\nCREATE TABLE dbo.tbl_question(id bigint PRIMARY KEY, duplicate_reviewed_key int);\nGO\nINSERT dbo.tbl_question(id,duplicate_reviewed_key) VALUES(1,42);', name='review-wrong-schema')
    sql(MIGRATION, fail=True, name='review-wrong-type')
    sql("IF COL_LENGTH(N'dbo.tbl_question',N'duplicate_reviewed_at') IS NOT NULL RAISERROR('DDL did not roll back',16,1);\n"
        "IF (SELECT duplicate_reviewed_key FROM dbo.tbl_question WHERE id=1)<>42 RAISERROR('Existing data changed',16,1);",
        name='review-rollback')
    print('PASS: initial migration, idempotent repeat, unchanged vocabulary, and rollback for a wrong existing column type.')
finally:
    if created:
        sql('ALTER DATABASE ['+DB+'] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE ['+DB+'];',
            'master', name='review-cleanup')
