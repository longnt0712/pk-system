"""Check current-duplicate XML export in a disposable local SQL database."""
from pathlib import Path
import ast,os,re,subprocess,xml.etree.ElementTree as ET

OUT=Path(__file__).resolve().parent
DB='codex_vocab_remaining_'+str(os.getpid())
assert re.fullmatch(r'codex_vocab_remaining_\d+',DB)
SQLCMD=r'C:/Program Files/Microsoft SQL Server/Client SDK/ODBC/170/Tools/Binn/SQLCMD.EXE'
tree=ast.parse((OUT/'test-merge-sql.py').read_text(encoding='utf8'))
schema=next(ast.literal_eval(n.value) for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='SCHEMA' for t in n.targets)).split('SET IDENTITY_INSERT')[0]
def sql(text,name,database='master'):
    path=OUT/('remaining-export-'+name+'.test.sql');path.write_text(text,encoding='utf-16')
    p=subprocess.run([SQLCMD,'-S',r'localhost\SQLEXPRESS','-E','-C','-b','-r','1','-d',database,'-i',str(path),'-u','-y','0','-w','65535'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=30)
    encoding='utf-16' if p.stdout.startswith((b'\xff\xfe',b'\xfe\xff')) else ('utf-16-le' if b'\0' in p.stdout[:80] else 'utf8')
    out=p.stdout.decode(encoding,errors='replace')+p.stderr.decode('utf8',errors='replace')
    (OUT/('remaining-export-'+name+'.log')).write_text(out,encoding='utf8')
    assert p.returncode==0,out[-3000:]
    return out
created=False
try:
    sql("IF DB_ID(N'"+DB+"') IS NOT NULL RAISERROR('Test DB exists',16,1); ELSE EXEC(N'CREATE DATABASE ["+DB+"]');",'create');created=True
    sql('ALTER DATABASE ['+DB+'] SET COMPATIBILITY_LEVEL=100;','compatibility')
    sql(schema+"ALTER TABLE dbo.tbl_question ADD create_date datetime2,duplicate_reviewed_key nvarchar(64),duplicate_reviewed_at datetime2;\nGO\n"+"""
SET IDENTITY_INSERT dbo.tbl_question ON;
INSERT dbo.tbl_question(id,user_id,question_type,parent_id,question,mother_tongue,create_date,duplicate_reviewed_key,duplicate_reviewed_at) VALUES
(1,26,6,NULL,N' Word ',N'cũ','20260101',N'already checked','20261108'),
(2,26,6,NULL,N'WORD',N'mới','20261106',NULL,NULL),
(3,27,6,NULL,N'word',N'khác chủ','20260101',NULL,NULL),
(4,26,1,NULL,N'word',N'đề bài','20260101',NULL,NULL),
(5,26,6,1,N'word',N'con','20260101',NULL,NULL),
(6,26,6,NULL,N'word',N'chưa rõ ngày',NULL,NULL,NULL),
(7,26,6,NULL,N'another word',N'nghĩa','20260101',NULL,NULL),
(8,26,6,NULL,N'another'+NCHAR(9)+N'   word',N'nghĩa','20260101',NULL,NULL),
(9,26,6,NULL,N'đa',N'khác dấu','20260101',NULL,NULL),
(10,26,6,NULL,N'đà',N'khác dấu','20260101',NULL,NULL),
(11,26,6,NULL,N'   ',N'trống','20260101',NULL,NULL);
SET IDENTITY_INSERT dbo.tbl_question OFF;
""",'seed',DB)
    audit=(OUT/'XUAT_TU_TRUNG_CON_LAI_ENGLISH.sql').read_text(encoding='utf8').replace("IF DB_NAME()<>N'ecommerce'","IF DB_NAME()<>N'"+DB+"'")
    out=sql(audit+'\nGO\n'+audit,'audit-repeat',DB)
    exports=re.findall(r'<english_duplicates>.*?</english_duplicates>',out,flags=re.S)
    assert len(exports)==2,repr(out[:2000])
    for xml in exports:
        root=ET.fromstring(xml)
        assert {int(c.findtext('id')) for c in root}=={1,2,6,7,8}
        original=next(c for c in root if c.findtext('id')=='1')
        assert original.findtext('created').startswith('2026-01-01T00:00:00')
        assert original.findtext('duplicate_reviewed_key')=='already checked'
        assert original.findtext('meaning')=='cũ'
    sql("IF (SELECT COUNT(*) FROM dbo.tbl_question)<>11 OR EXISTS(SELECT 1 FROM sys.tables WHERE name LIKE N'vocab_merge_english[_]%') RAISERROR('Export modified app data',16,1);",'verify',DB)
    print('PASS: export current duplicate roots only; old/new/unknown dates, checked metadata, whitespace/case and accents; repeated on one connection; app data unchanged.')
finally:
    if created: sql('ALTER DATABASE ['+DB+'] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE ['+DB+'];','cleanup')
