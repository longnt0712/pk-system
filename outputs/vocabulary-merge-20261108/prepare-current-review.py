"""Prepare explicit review units, collapsing only literal gloss subsets into an older original."""
from pathlib import Path
from collections import Counter
import json,re,unicodedata

OUT=Path(__file__).resolve().parent
groups=json.loads((OUT/'remaining-current-groups.json').read_text(encoding='utf8'))
def normalize(s):return re.sub(r'\s+',' ',unicodedata.normalize('NFC',s or '')).strip().casefold()
def atoms(s):
    return {normalize(x).strip(' .') for x in re.split(r'[;/]',s) if normalize(x).strip(' .')}
auto=[];review=[]
for group in groups:
    if group['reviewed'] or not group['originals']:continue
    cards=group['cards'];used=set();units=[]
    for c in sorted(cards,key=lambda c:(c.get('created') or '9999',c['id'])):
        if c['id'] in used:continue
        members=[c['id']]
        if c['id'] in group['originals']:
            target=atoms(c.get('meaning',''))
            if target:
                for source in cards:
                    if source['id']==c['id'] or source['id'] in used:continue
                    # An earlier original must never be silently replaced by a later one.
                    if source.get('created') and (source['created'],source['id'])<(c['created'],c['id']):continue
                    donor=atoms(source.get('meaning',''))
                    if donor and donor<=target:members.append(source['id'])
        used.update(members)
        unit={'primary':c['id'],'ids':members,'meaning':c.get('meaning',''),'old':c['id'] in group['originals']}
        units.append(unit)
        if len(members)>1:auto.append({'word':group['word'],'ids':members,'reason':'Các mệnh đề nghĩa của bản phụ đã có nguyên văn trong bản gốc (chuẩn hóa khoảng trắng, chữ hoa và dấu phân cách).','original_group':group['n']})
    if len(units)>1:review.append({'n':len(review)+1,'word':group['word'],'original_group':group['n'],'units':units})
(OUT/'current-auto-approvals.json').write_text(json.dumps(auto,ensure_ascii=False,indent=2),encoding='utf8')
(OUT/'current-review-units.json').write_text(json.dumps(review,ensure_ascii=False,indent=2),encoding='utf8')
lines=[]
for g in review:
    lines.append(f"{g['n']} {g['word']} :: "+' || '.join(f"{i}{'*' if u['old'] else ''}[{u['primary']}] "+u['meaning'] for i,u in enumerate(g['units'],1)))
(OUT/'current-review-compact.txt').write_text('\n'.join(lines),encoding='utf8')
print(json.dumps({'exact_subset_clusters':len(auto),'exact_subset_removals':sum(len(a['ids'])-1 for a in auto),'remaining_to_review':len(review),'units':dict(Counter(len(g['units']) for g in review))}))
