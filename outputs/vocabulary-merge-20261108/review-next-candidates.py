"""Review remaining units after V3. Scores order review only, never approve merges."""
from pathlib import Path
from collections import defaultdict
import difflib,json,re,unicodedata,xml.etree.ElementTree as ET

OUT=Path(__file__).resolve().parent
def norm(s): return re.sub(r'\s+',' ',unicodedata.normalize('NFC',s or '')).strip().casefold()
root=ET.parse(r'C:/Users/Admin/Desktop/english-duplicates-20261108.xml').getroot()
cards={int(e.findtext('id')):{v.tag:v.text or '' for v in e} for e in root}
units=defaultdict(list); used=set()
for group in json.loads((OUT/'fast-merge-plan.json').read_text(encoding='utf8')):
    units[group['word']].append(group); used.update(group['ids'])
for identifier,card in cards.items():
    if identifier not in used:
        units[norm(card['word'])].append({'word':norm(card['word']),'primary':identifier,'ids':[identifier],
            'meaning':card.get('meaning','').strip(),'definition_from':identifier})
short=[]
for word,items in units.items():
    if len(items)<2: continue
    score=0
    for i,left in enumerate(items):
        a=set(re.findall(r'\w+',norm(left['meaning'])))
        for right in items[i+1:]:
            b=set(re.findall(r'\w+',norm(right['meaning'])))
            score=max(score,len(a&b)/max(1,len(a|b)),difflib.SequenceMatcher(None,norm(left['meaning']),norm(right['meaning'])).ratio()*.75)
    short.append({'word':word,'units':items,'score':score})
short.sort(key=lambda g:(-g['score'],g['word']))
(OUT/'next-shortlist.json').write_text(json.dumps(short,ensure_ascii=False,indent=2),encoding='utf8')
(OUT/'next-shortlist.txt').write_text('\n'.join(f"{i+1}. {g['word']} | "+' || '.join(f"{u['primary']}: {u['meaning']}" for u in g['units']) for i,g in enumerate(short)),encoding='utf8')
print(json.dumps({'remaining_groups_from_old_xml_after_v3':len(short),'score_035_or_more':sum(g['score']>=.35 for g in short)}))
