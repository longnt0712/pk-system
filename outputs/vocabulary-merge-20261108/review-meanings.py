"""Prepare ID-bound review candidates from the user-authorized XML export.

Only identical English headwords are considered. Matching uses whole Vietnamese
meaning components, never edit-distance, LIKE, SOUNDEX or accent removal.
Uncertain senses remain separate. This script never opens a database connection.
"""
from pathlib import Path
from collections import defaultdict, Counter
import csv
import json
import re
import unicodedata
import xml.etree.ElementTree as ET

OUT = Path(__file__).resolve().parent
INPUT = Path(r'C:/Users/Admin/Desktop/english-duplicates-20261108.xml')

def space(s):
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFC', s or '')).strip()

POS = r'(?:n\.?|v\.?|adj\.?|adv\.?|adjective|adverb|noun|verb|n[. ]?p\.?|phr\.?|phrase|idiom|prep\.?|pron\.?|conj\.?|det\.?|adj/n|n/v|adj\s*/\s*n|n\s*/\s*v)'

def clean(s):
    s = space(s).casefold()
    s = re.sub(r'^\(\s*'+POS+r'\s*\)\s*', '', s, flags=re.I)
    s = re.sub(r'\s*\(\s*'+POS+r'\s*\)\s*[.]*$', '', s, flags=re.I)
    s = re.sub(r'^(?:một cách |1 cách |sự |mang tính |có tính |thuộc về |thuộc |về mặt )', '', s)
    return s.strip(' .;,:…')

def atoms(s):
    """Do not split punctuation inside explanations, examples or quoted phrases."""
    s = clean(s)
    parts, start, depth = [], 0, 0
    for i, c in enumerate(s):
        if c in '([': depth += 1
        elif c in ')]': depth = max(0, depth-1)
        elif depth == 0 and c in '/;,':
            parts.append(clean(s[start:i])); start = i+1
    parts.append(clean(s[start:]))
    return frozenset(p for p in parts if p)

def eligible(c):
    return len(c['word'].encode('utf-16-le')) <= 400 and len(c['meaning'].encode('utf-16-le')) <= 1000 and bool(clean(c['meaning']))

data = INPUT.read_bytes()
if b'<!DOCTYPE' in data: raise ValueError('Unexpected document type')
root = ET.fromstring(data)
assert root.tag == 'english_duplicates'
groups, ids = defaultdict(list), set()
for e in root:
    c = {v.tag:v.text or '' for v in e}
    c['id'] = int(c['id'])
    assert c['id'] not in ids
    ids.add(c['id'])
    c['meaning'] = c.get('meaning','').strip(' ')
    groups[space(c['word']).lower()].append(c)
for cards in groups.values(): cards.sort(key=lambda c:c['id'])

clusters, left = [], []
manual_path = OUT/'manual-meanings.tsv'
manual = defaultdict(list)
if manual_path.exists():
    for row in csv.DictReader(manual_path.open(encoding='utf8'),delimiter='\t'):
        manual[row['word']].append(row)
for word, cards in sorted(groups.items()):
    remaining = [c for c in cards if eligible(c)]
    for approved in manual.get(word,[]):
        selected = {int(x) for x in approved['ids'].split(',')} if approved['ids']!='ALL' else {c['id'] for c in cards}
        chosen = [c for c in remaining if c['id'] in selected]
        assert len(chosen)>1 and {c['id'] for c in chosen}==selected,(word,selected)
        keep = next(c for c in chosen if c['id']==int(approved['keeper']))
        clusters.append({'word':word,'primary':min(selected),'ids':sorted(selected),'meaning':keep['meaning'],
                         'definition_from':keep['id'],'reason':'Đối chiếu nghĩa theo từng từ/cụm từ'})
        remaining=[c for c in remaining if c['id'] not in selected]
    # One existing definition must cover every component of every chosen card.
    # A short meaning cannot connect two otherwise different sense sets.
    while remaining:
        candidates = []
        for keeper in remaining:
            ka = atoms(keeper['meaning'])
            chosen = [c for c in remaining if atoms(c['meaning']) == ka or (
                atoms(c['meaning']) < ka and all(len(p) >= 4 for p in atoms(c['meaning'])))]
            if len(chosen) > 1:
                candidates.append((len(chosen),len(ka),-len(keeper['meaning']),-keeper['id'],keeper,chosen))
        if not candidates: break
        _,_,_,_,keeper,chosen=max(candidates,key=lambda x:x[:4])
        primary=min(chosen,key=lambda c:c['id'])
        final=keeper['meaning']
        clusters.append({'word':word,'primary':primary['id'],'ids':[c['id'] for c in chosen],
                         'meaning':final,'definition_from':keeper['id'],
                         'reason':'Trùng thành phần nghĩa; chỉ khác định dạng, thứ tự hoặc một định nghĩa đã bao hàm đầy đủ'})
        chosen_ids={c['id'] for c in chosen}
        remaining=[c for c in remaining if c['id'] not in chosen_ids]
    if len(remaining)>1 or (remaining and any(c['id'] not in {v['id'] for v in remaining} for c in cards)):
        left.append({'word':word,'cards':remaining,'all_cards':cards})

(OUT/'meaning-clusters.json').write_text(json.dumps(clusters,ensure_ascii=False,indent=2),encoding='utf8')
(OUT/'meaning-remaining.json').write_text(json.dumps(left,ensure_ascii=False,indent=2),encoding='utf8')
(OUT/'meaning-remaining.txt').write_text('\n'.join(f"{i+1}. {g['word']} | "+' || '.join(f"{c['id']}: {c['meaning']}" for c in g['cards']) for i,g in enumerate(left)),encoding='utf8')
with (OUT/'meaning-clusters.csv').open('w',encoding='utf-8-sig',newline='') as f:
    w=csv.writer(f);w.writerow(['word','primary_id','card_ids','meaning_kept','definition_from'])
    for g in clusters:w.writerow([g['word'],g['primary'],','.join(map(str,g['ids'])),g['meaning'],g['definition_from']])
print(json.dumps({'cards':len(ids),'words':len(groups),'safe_clusters':len(clusters),
                  'safe_removals':sum(len(g['ids'])-1 for g in clusters),'remaining_words':len(left)},ensure_ascii=False))
