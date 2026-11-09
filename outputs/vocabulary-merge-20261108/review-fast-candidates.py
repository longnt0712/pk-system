"""Prepare a local semantic review shortlist, never mutate server data."""
from pathlib import Path
from collections import defaultdict
import difflib
import json
import re
import unicodedata
import xml.etree.ElementTree as ET

OUT=Path(__file__).resolve().parent
raw=Path(r'C:/Users/Admin/Desktop/english-duplicates-20261108.xml').read_bytes()
assert b'<!DOCTYPE' not in raw
root=ET.fromstring(raw)
assert root.tag=='english_duplicates'
cards={int(e.findtext('id')):{c.tag:c.text or '' for c in e} for e in root}
def norm(s): return re.sub(r'\s+',' ',unicodedata.normalize('NFC',s or '')).strip().casefold()
units=defaultdict(list)
seen=set()
for group in json.loads((OUT/'meaning-clusters.json').read_text(encoding='utf8')):
    units[group['word']].append(dict(group))
    seen.update(group['ids'])
for identifier,card in cards.items():
    if identifier not in seen:
        units[norm(card['word'])].append({'word':norm(card['word']),'primary':identifier,'ids':[identifier],
            'meaning':card.get('meaning','').strip(),'definition_from':identifier,'reason':'Chưa đối chiếu'})
short=[]
for word,items in sorted(units.items()):
    if len(items)<2: continue
    scores=[]
    for i,left in enumerate(items):
        a=set(re.findall(r'\w+',norm(left['meaning'])))
        for right in items[i+1:]:
            b=set(re.findall(r'\w+',norm(right['meaning'])))
            score=len(a&b)/max(1,len(a|b))
            char=difflib.SequenceMatcher(None,norm(left['meaning']),norm(right['meaning'])).ratio()
            scores.append(max(score,char*.75))
    short.append({'word':word,'units':items,'score':max(scores)})
short.sort(key=lambda row:(-row['score'],row['word']))
(OUT/'fast-shortlist.json').write_text(json.dumps(short,ensure_ascii=False,indent=2),encoding='utf8')
(OUT/'fast-shortlist.txt').write_text('\n'.join(str(i+1)+'. '+g['word']+' | '+' || '.join(str(u['primary'])+': '+u['meaning'] for u in g['units']) for i,g in enumerate(short)),encoding='utf8')
print(json.dumps({'remaining_same_word_groups':len(short),'overlap_review_candidates':sum(g['score']>=.35 for g in short)},ensure_ascii=False))
