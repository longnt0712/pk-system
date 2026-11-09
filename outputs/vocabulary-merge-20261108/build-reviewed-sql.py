"""Build a guarded deploy SQL from the approved, local English vocabulary export.

No database connection. A final meaning is always one existing definition;
definitions are never concatenated. Keep private vocabulary rows in outputs.
"""
from pathlib import Path
from collections import defaultdict
import argparse
import hashlib
import json
import re
import xml.etree.ElementTree as ET

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[1]
XML = Path(r'C:/Users/Admin/Desktop/english-duplicates-20261108.xml')
SOURCE = ROOT/'richy/database/vocabulary-duplicates-english-merge.sql'
parser = argparse.ArgumentParser()
parser.add_argument('--allow-test-references',action='store_true')
parser.add_argument('--output',default='GOP_TU_TRUNG_ENGLISH_20261108.sql')
args = parser.parse_args()
assert Path(args.output).name == args.output and args.output.endswith('.sql')
DEST = OUT/args.output
raw = XML.read_bytes()
assert b'<!DOCTYPE' not in raw
root = ET.fromstring(raw)
assert root.tag == 'english_duplicates'
cards = {}
for element in root:
    card = {field.tag:field.text or '' for field in element}
    key = int(card['id'])
    assert key not in cards
    cards[key] = card
clusters = json.loads((OUT/'meaning-clusters.json').read_text(encoding='utf8'))
selected, rows, remaining = set(), [], defaultdict(list)
for cluster in clusters:
    primary = cluster['primary']
    assert primary == min(cluster['ids']) and len(cluster['ids']) >= 2
    assert cluster['definition_from'] in cluster['ids']
    assert cluster['meaning'] == cards[cluster['definition_from']]['meaning'].strip(' ')
    assert cluster['meaning'].strip() and len(cluster['meaning'].encode('utf-16-le')) <= 1000
    for identifier in cluster['ids']:
        assert identifier not in selected
        selected.add(identifier)
        assert ' '.join(cards[identifier]['word'].split()).lower() == cluster['word']
        if identifier != primary:
            rows.append([identifier,primary,cards[primary]['word'].strip(' '),
                         cards[primary].get('meaning','').strip(' '),
                         cards[identifier].get('meaning','').strip(' '),cluster['meaning']])
    remaining[cluster['word']].append(primary)
for identifier,card in cards.items():
    if identifier not in selected:
        remaining[' '.join(card['word'].split()).lower()].append(identifier)
assert len(set(row[0] for row in rows)) == len(rows)
assert not set(row[0] for row in rows) & set(row[1] for row in rows)
def literal(value):
    return str(value) if isinstance(value,int) else "N'"+value.replace("'","''")+"'"
parts = ["-- Kế hoạch theo XML 08/11/2026; chỉ chọn một định nghĩa có sẵn.",
         '-- SHA-256 XML: '+hashlib.sha256(raw).hexdigest(),
         '-- '+str(len(clusters))+' cụm; '+str(len(rows))+' bản phụ dự kiến được gộp.']
for index in range(0,len(rows),200):
    parts.append('INSERT #VM_Reviewed (source_id,primary_id,expected_word,expected_primary_meaning,expected_source_meaning,meaning_after) VALUES\n'+
                 ',\n'.join('('+','.join(map(literal,row))+')' for row in rows[index:index+200])+';')
source = SOURCE.read_text(encoding='utf-8-sig')
assert source.count('-- REVIEWED_MEANINGS_START') == source.count('-- REVIEWED_MEANINGS_END') == 1
sql = re.sub(r'-- REVIEWED_MEANINGS_START.*?-- REVIEWED_MEANINGS_END',
             lambda match:'-- REVIEWED_MEANINGS_START\n'+'\n'.join(parts)+'\n-- REVIEWED_MEANINGS_END', source, flags=re.S)
assert 'DECLARE @Apply bit = 0;' in sql
if args.allow_test_references:
    sql=sql.replace('DECLARE @MergeTestReferences bit = 0;','DECLARE @MergeTestReferences bit = 1;')
DEST.write_text(sql,encoding='utf-8-sig')
stats = {'xml_cards':len(cards),'xml_words':len(remaining),'merge_clusters':len(clusters),'redundant_cards':len(rows),
         'different_or_unresolved_words':sum(len(ids)>1 for ids in remaining.values()),
         'remaining_duplicate_cards':sum(len(ids) for ids in remaining.values() if len(ids)>1),
         'transfer_test_references':args.allow_test_references,
         'sql_sha256':hashlib.sha256(DEST.read_bytes()).hexdigest(),'xml_sha256':hashlib.sha256(raw).hexdigest()}
(OUT/(DEST.stem+'-summary.json')).write_text(json.dumps(stats,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(stats,ensure_ascii=False))
