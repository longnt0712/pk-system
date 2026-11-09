"""Validate the generated, complete deployment plan against the actual export.

Only a newly created, uniquely named LOCAL test database is used. Minimal schema
and representative topic/category/history links exercise preservation at scale.
"""
from pathlib import Path
import argparse
import ast
import json
import os
import re
import subprocess
import time
import xml.etree.ElementTree as ET

OUT = Path(__file__).resolve().parent
parser=argparse.ArgumentParser()
parser.add_argument('--input',default='GOP_TU_TRUNG_ENGLISH_20261108.sql')
parser.add_argument('--clusters',default='meaning-clusters.json')
parser.add_argument('--max-groups',type=int,default=0)
args=parser.parse_args()
assert Path(args.input).name==args.input
assert Path(args.clusters).name==args.clusters and 0<=args.max_groups<=10000
deploy=(OUT/args.input).read_text(encoding='utf-8-sig')
allow_test_references='DECLARE @MergeTestReferences bit = 1;' in deploy
DB = 'codex_vocab_xml_20261108_'+str(os.getpid())
assert re.fullmatch(r'codex_vocab_xml_20261108_\d+', DB)
SQLCMD = r'C:/Program Files/Microsoft SQL Server/Client SDK/ODBC/170/Tools/Binn/SQLCMD.EXE'
def sql(text,database=DB,name='query'):
    file = OUT/(name+'.xml-test.sql')
    file.write_text(text,encoding='utf-16')
    started = time.monotonic()
    p = subprocess.run([SQLCMD,'-S',r'localhost\SQLEXPRESS','-E','-C','-b','-r','1','-d',database,'-i',str(file),'-u','-W','-h','-1','-s','|'],
                       stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=180)
    encoding='utf-16' if p.stdout.startswith((b'\xff\xfe',b'\xfe\xff')) else ('utf-16-le' if b'\0' in p.stdout[:80] else 'utf8')
    result = p.stdout.decode(encoding,errors='replace')+p.stderr.decode('utf8',errors='replace')
    (OUT/(name+'.xml-test.log')).write_text(result,encoding='utf8')
    if p.returncode: raise AssertionError(result[-5000:])
    print(name+': '+str(round(time.monotonic()-started,2))+'s',flush=True)
    return result
def lit(value):
    return 'NULL' if value is None else "N'"+str(value).replace("'","''")+"'"
def batches(table,columns,rows):
    return '\n'.join('INSERT '+table+' ('+columns+') VALUES\n'+',\n'.join('('+','.join(row)+')' for row in rows[i:i+500])+';'
                     for i in range(0,len(rows),500))
schema_tree = ast.parse((OUT/'test-merge-sql.py').read_text(encoding='utf8'))
schema = next(ast.literal_eval(n.value) for n in schema_tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='SCHEMA' for t in n.targets))
schema = schema.split('SET IDENTITY_INSERT')[0]
root = ET.parse(r'C:/Users/Admin/Desktop/english-duplicates-20261108.xml').getroot()
cards = [{field.tag:field.text or '' for field in e} for e in root]
clusters = json.loads((OUT/args.clusters).read_text(encoding='utf8'))
removed = sum(len(c['ids'])-1 for c in clusters)
created = False
try:
    sql("IF DB_ID(N'"+DB+"') IS NOT NULL RAISERROR('Test DB exists',16,1); ELSE EXEC(N'CREATE DATABASE ["+DB+"]');",'master','xml-create')
    created = True
    sql('ALTER DATABASE ['+DB+'] SET COMPATIBILITY_LEVEL=100;','master','xml-compatibility')
    sql(schema,name='xml-schema')
    rows=[]
    for c in cards:
        rows.append([c['id'],'26','6','NULL','0',lit(c['word']),lit(c.get('meaning')),
                     lit(c.get('ipa')),lit(c.get('cefr')),c.get('status') or 'NULL',
                     c.get('correct') or '0',c.get('wrong') or '0',c.get('reviewed') or '0',
                     lit(c.get('modified') or None),lit('preserve original metadata')])
    seed='SET IDENTITY_INSERT dbo.tbl_question ON;\n'+batches('dbo.tbl_question',
            'id,user_id,question_type,parent_id,voided,question,mother_tongue,pronounce,level,status,correct_answer,wrong_answer,time_reviewed,modify_date,description',rows)
    seed+='\nINSERT dbo.tbl_question(id,user_id,question_type,question,mother_tongue) VALUES(1000000,27,6,'+lit(cards[0]['word'])+','+lit(cards[0].get('meaning'))+');\nSET IDENTITY_INSERT dbo.tbl_question OFF;\n'
    seed+='INSERT dbo.tbl_question_topic(question,topic) SELECT id,1 FROM dbo.tbl_question WHERE user_id=26;\n'
    seed+='INSERT dbo.tbl_question_topic(question,topic) SELECT id,id+200000 FROM dbo.tbl_question WHERE user_id=26;\n'
    seed+='INSERT dbo.tbl_category(question,category) SELECT id,1 FROM dbo.tbl_question WHERE user_id=26;\n'
    seed+='INSERT dbo.tbl_question_answer(question,answer) SELECT id,id FROM dbo.tbl_question WHERE user_id=26;\n'
    seed+='INSERT dbo.tbl_question_answer_test_result(id,question_answer) SELECT id,id FROM dbo.tbl_question_answer;\n'
    referenced=next(c for c in clusters if len(c['ids'])>1)
    referenced_source=next(identifier for identifier in referenced['ids'] if identifier!=referenced['primary'])
    if allow_test_references:
        seed+=f'INSERT dbo.tbl_enrolment_class_schedule_task VALUES(1,{referenced_source},{referenced_source});\n'
        seed+=f'INSERT dbo.tbl_test_result VALUES(1,{referenced_source});\n'
    sql(seed,name='xml-seed')
    deploy=deploy.replace("@ExpectedDatabase sysname = N'ecommerce'","@ExpectedDatabase sysname = N'"+DB+"'")
    if args.max_groups:
        deploy=deploy.replace('DECLARE @MaxGroups int = 1000;','DECLARE @MaxGroups int = '+str(args.max_groups)+';')
    sql(deploy,name='xml-preview')
    sql("IF (SELECT COUNT(*) FROM dbo.tbl_question)<>"+str(len(cards)+1)+" OR EXISTS(SELECT 1 FROM sys.tables WHERE name LIKE 'vocab_merge_english[_]%') RAISERROR('Preview changed data',16,1);",name='xml-verify-preview')
    print('PASS: full 23,197-card export preview is read-only',flush=True)
    sql(deploy.replace('DECLARE @Apply bit = 0;','DECLARE @Apply bit = 1;'),name='xml-apply')
    expected_count=len(cards)+1-removed
    verify=f"""
IF (SELECT COUNT(*) FROM dbo.tbl_question)<>{expected_count} RAISERROR('Unexpected final card count',16,1);
IF NOT EXISTS(SELECT 1 FROM dbo.tbl_question WHERE id=1000000 AND user_id=27) RAISERROR('Other owner changed',16,1);
IF (SELECT COUNT(*) FROM dbo.tbl_question_answer_test_result)<>{len(cards)} OR (SELECT COUNT(*) FROM dbo.tbl_question_answer)<>{len(cards)} RAISERROR('History IDs lost',16,1);
IF (SELECT COUNT(*) FROM dbo.tbl_question_topic)<>{2*len(cards)-removed} RAISERROR('Topic union lost',16,1);
IF (SELECT COUNT(*) FROM dbo.tbl_category)<>{len(cards)-removed} RAISERROR('Category union lost',16,1);
IF (SELECT COUNT(*) FROM sys.tables WHERE name LIKE 'vocab_merge_english[_]%')<>{7 if allow_test_references else 5} RAISERROR('Backup missing',16,1);
CREATE TABLE #Expected(id bigint PRIMARY KEY,meaning nvarchar(500));
"""
    verify+=batches('#Expected','id,meaning',[[str(c['primary']),lit(c['meaning'])] for c in clusters])
    verify+="\nIF EXISTS(SELECT 1 FROM #Expected e LEFT JOIN dbo.tbl_question q ON q.id=e.id WHERE q.id IS NULL OR CONVERT(nvarchar(max),q.mother_tongue) COLLATE Latin1_General_BIN2<>e.meaning COLLATE Latin1_General_BIN2) RAISERROR('Kept meaning differs from approved definition',16,1);"
    if allow_test_references:
        verify+=f"\nIF NOT EXISTS(SELECT 1 FROM dbo.tbl_enrolment_class_schedule_task WHERE id=1 AND source_question_id={referenced['primary']} AND ielts_test_id={referenced['primary']}) OR NOT EXISTS(SELECT 1 FROM dbo.tbl_test_result WHERE id=1 AND source_question_id={referenced['primary']}) RAISERROR('Test references lost',16,1);"
    sql(verify,name='xml-verify-apply')
    print(f'PASS: {len(clusters)} clusters / {removed} removals, one chosen definition, topic unions and history preserved',flush=True)
    sql(deploy.replace('DECLARE @Apply bit = 0;','DECLARE @Apply bit = 1;'),name='xml-repeat')
    sql(verify,name='xml-verify-repeat')
    print('PASS: repeating the complete exported plan makes no further changes',flush=True)
finally:
    if created:
        sql('ALTER DATABASE ['+DB+'] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE ['+DB+'];','master','xml-cleanup')
        print('Removed disposable local database '+DB,flush=True)
