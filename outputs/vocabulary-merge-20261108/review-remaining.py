"""Summarize the fresh, private duplicate export. Never connects to a DB."""
from pathlib import Path
from collections import defaultdict,Counter
import hashlib,json,re,xml.etree.ElementTree as ET

OUT=Path(__file__).resolve().parent
SOURCE=Path(r'C:/Users/Admin/Desktop/english-duplicates-remaining-20261108.xml')
raw=SOURCE.read_bytes()
assert b'<!DOCTYPE' not in raw.upper()
root=ET.fromstring(raw);assert root.tag=='english_duplicates'
def key(s):return re.sub(r'[\t\n\x0b\f\r ]+',' ',(s or '').strip(' \t\n\x0b\f\r')).lower()
def part(s):return str(len(str(s).encode('utf-16-le'))//2)+':'+str(s)+';'
byword=defaultdict(list);ids=set()
for e in root:
    c={f.tag:f.text or '' for f in e};c['id']=int(c['id']);assert c['id'] not in ids;ids.add(c['id'])
    assert key(c.get('word'));byword[key(c['word'])].append(c)
groups=[]
for word,cards in sorted(byword.items()):
    cards.sort(key=lambda c:c['id']);assert len(cards)>=2
    digest=hashlib.sha256((part(word)+''.join(part(c['id']) for c in cards)).encode('utf8')).hexdigest()
    reviewed=any(c.get('duplicate_reviewed_key')==digest and c.get('duplicate_reviewed_at') for c in cards)
    originals=sorted([c for c in cards if c.get('created') and c['created']<'2026-11-06'],key=lambda c:(c['created'],c['id']))
    groups.append({'n':len(groups)+1,'word':word,'reviewed':reviewed,'originals':[c['id'] for c in originals],'cards':cards})
(OUT/'remaining-current-groups.json').write_text(json.dumps(groups,ensure_ascii=False,indent=2),encoding='utf8')
unreviewed=[g for g in groups if not g['reviewed']]
for label,selected in [('all',groups),('unreviewed',unreviewed)]:
    lines=[]
    for g in selected:
        lines.append(f"{g['n']}. {g['word']} [{'CHECKED' if g['reviewed'] else 'NEW REVIEW'}] old="+','.join(map(str,g['originals'])))
        for c in g['cards']:
            lines.append(f"  {c['id']} | {c.get('created','NO DATE')} | {c.get('meaning','')} | {c.get('cefr','')}")
    (OUT/f'remaining-{label}-review.txt').write_text('\n'.join(lines),encoding='utf8')
stats={'xml_sha256':hashlib.sha256(raw).hexdigest(),'cards':len(ids),'same_word_groups':len(groups),
       'unreviewed_groups':len(unreviewed),'checked_groups':sum(g['reviewed'] for g in groups),
       'groups_with_old_card':sum(bool(g['originals']) for g in groups),
       'groups_with_two_old_cards':sum(len(g['originals'])>1 for g in groups),
       'unreviewed_with_old_card':sum(bool(g['originals']) for g in unreviewed),
       'unreviewed_card_counts':dict(Counter(len(g['cards']) for g in unreviewed))}
(OUT/'remaining-current-summary.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(stats,ensure_ascii=False))
