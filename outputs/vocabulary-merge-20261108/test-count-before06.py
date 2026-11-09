"""Validate the read-only count against known fixtures in a disposable local DB."""
from pathlib import Path
import ast,os,re,subprocess

OUT=Path(__file__).resolve().parent
DB='codex_vocab_before06_'+str(os.getpid());assert re.fullmatch(r'codex_vocab_before06_\d+',DB)
SQLCMD=r'C:/Program Files/Microsoft SQL Server/Client SDK/ODBC/170/Tools/Binn/SQLCMD.EXE'
tree=ast.parse((OUT/'test-merge-sql.py').read_text(encoding='utf8'))
schema=next(ast.literal_eval(n.value) for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='SCHEMA' for t in n.targets)).split('SET IDENTITY_INSERT')[0]
def sql(text,name,database='master'):
    path=OUT/('count-before06-'+name+'.test.sql');path.write_text(text,encoding='utf-16')
    p=subprocess.run([SQLCMD,'-S',r'localhost\SQLEXPRESS','-E','-C','-b','-r','1','-d',database,'-i',str(path),'-u','-W','-h','-1','-s','|'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=30)
    encoding='utf-16' if p.stdout.startswith((b'\xff\xfe',b'\xfe\xff')) else ('utf-16-le' if b'\0' in p.stdout[:80] else 'utf8')
    out=p.stdout.decode(encoding,errors='replace')+p.stderr.decode('utf8',errors='replace')
    (OUT/('count-before06-'+name+'.log')).write_text(out,encoding='utf8')
    assert p.returncode==0,out[-3000:]
    return out
created=False
try:
    sql("IF DB_ID(N'"+DB+"') IS NOT NULL RAISERROR('Test DB exists',16,1); ELSE EXEC(N'CREATE DATABASE ["+DB+"]');",'create');created=True
    sql('ALTER DATABASE ['+DB+'] SET COMPATIBILITY_LEVEL=100;','compatibility')
    sql(schema+"ALTER TABLE dbo.tbl_question ADD create_date datetime2;\nGO\n"+"""
SET IDENTITY_INSERT dbo.tbl_question ON;
INSERT dbo.tbl_question(id,user_id,question_type,parent_id,question,create_date) VALUES
(1,26,6,NULL,N' Word ','20260101'),(2,26,6,NULL,N'word','20261105 23:59:59'),(3,26,6,NULL,N'WORD','20261101'),
(4,26,6,NULL,N'word','20261106'),(5,27,6,NULL,N'word','20260101'),(6,26,1,NULL,N'word','20260101'),
(7,26,6,1,N'word','20260101'),(8,26,6,NULL,N'word',NULL),
(9,26,6,NULL,N'another word','20260101'),(10,26,6,NULL,N'another'+NCHAR(9)+N'   word','20260101'),
(11,26,6,NULL,N'đa','20260101'),(12,26,6,NULL,N'đà','20260101'),(13,26,6,NULL,N'   ','20260101');
SET IDENTITY_INSERT dbo.tbl_question OFF;
""",'seed',DB)
    audit=(OUT/'DEM_TRUNG_BAN_GOC_TRUOC_0611_ENGLISH.sql').read_text(encoding='utf8').replace("IF DB_NAME()<>N'ecommerce'","IF DB_NAME()<>N'"+DB+"'")
    output=sql(audit+'\nGO\n'+audit,'audit-repeat',DB)
    lines=[s.strip() for s in output.splitlines() if s.strip().startswith('english|')]
    assert len(lines)==2 and all(s.endswith('|2|5|3') for s in lines),lines
    sql("IF (SELECT COUNT(*) FROM dbo.tbl_question)<>13 OR EXISTS(SELECT 1 FROM sys.tables WHERE name LIKE N'vocab_merge_english[_]%') RAISERROR('Count modified app data',16,1);",'verify',DB)
    print('PASS: 2 old duplicate groups, 5 old records, 3 excess records; cutoff, owner/type/parent/unknown-date filters, whitespace/case and Vietnamese accents; repeat read-only.')
finally:
    if created: sql('ALTER DATABASE ['+DB+'] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE ['+DB+'];','cleanup')
