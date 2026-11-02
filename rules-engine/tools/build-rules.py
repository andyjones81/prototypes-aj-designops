#!/usr/bin/env python3
"""Builds the static rules API (api/rules.json, api/rules/{id}.json, api/rules-seed.js) from the CSVs in spec/."""
import csv, json, re, os, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..')
OUT = os.path.join(HERE, '..', 'api')
FILES = [
    ('spec/ORR activity log-Grid view.csv', 'Operational Readiness Review', 'ORR'),
    ('spec/Other activity log-Grid view.csv', 'DDT activity log', 'OTH'),
]
STAGE_OF = {'explore': 'Idea', 'discovery': 'Understanding', 'alpha': 'Design and test', 'private beta': 'Build',
            'public beta': 'Build', 'build': 'Build', 'live': 'Run / Serve', 'run': 'Run / Serve',
            'decomissioning': 'Decommissioning', 'decommissioning': 'Decommissioning'}
STAGE_ORDER = ['Idea', 'Understanding', 'Design and test', 'Build', 'Run / Serve', 'Decommissioning']
PHASE_NAME = {'decomissioning': 'Decommissioning'}
CREATED = '2026-01-12T09:00:00.000Z'


def clean(s):
    return re.sub(r'[ \t]+', ' ', (s or '').replace('\r', '')).strip()


def steps_text(text):
    """The 'What needs to happen' cell as readable steps: bullets stay together as one description."""
    lines = []
    for line in clean(text).split('\n'):
        l = line.strip().lstrip("'").strip()
        if not l:
            continue
        if l.startswith(('-', '•', '*')):
            l = '• ' + l.lstrip('-•* ').strip()
        lines.append(l)
    return '\n'.join(lines)[:700]


def action_title(name):
    return re.sub(r'\s+', ' ', name).strip()[:140]


def derive_conditions(text, phases):
    conds, t = [], text.lower()
    stages = sorted({STAGE_OF[p.strip().lower()] for p in phases if p.strip().lower() in STAGE_OF}, key=STAGE_ORDER.index)
    if stages:
        conds.append({'field': 'stage', 'op': 'in', 'value': stages})
    if 'transactional' in t:
        conds.append({'field': 'transactional', 'op': 'is', 'value': 'Yes'})
    if 'personal data' in t:
        conds.append({'field': 'personalData', 'op': 'is', 'value': 'Yes'})
    return conds


def build():
    rules, n = [], 100
    for path, dataset, prefix in FILES:
        rows = list(csv.DictReader(open(os.path.join(ROOT, path), encoding='utf-8-sig')))
        for r in rows:
            name = clean(r['Action'])
            if not name:
                continue
            n += 1
            phases = [p.strip() for p in r['Delivery phase'].split(',') if p.strip()]
            assumed = False
            if not phases and prefix == 'ORR':
                phases, assumed = ['Build'], True
            conds = derive_conditions(clean(r['Conditions']), phases)
            standards = [s.strip() for s in clean(r['Standards applicable']).split('\n') if s.strip()]
            owner = clean(r['Assurance owner']) or clean(r['Activity owner'])
            ctext = clean(r['Conditions']).lower()
            # Free-text conditions we cannot encode need a person to confirm them, so those rules start as drafts.
            encodable = (not ctext) or ctext.startswith('universal') or any(c['field'] != 'stage' for c in conds)
            published = bool(conds) and 'stage' in [c['field'] for c in conds] and encodable
            rule = {
                'id': 'RUL-%03d' % n,
                'name': re.sub(r'\s+', ' ', name),
                'source': standards[0] if standards else dataset,
                'dataset': dataset,
                'kind': clean(r.get('[Unsure] Standard or Activity', '')) or 'Activity',
                'category': clean(r.get('[Unsure] Category', '')),
                'mandatory': clean(r['Mandatory status']) or 'Not stated',
                'owner': owner,
                'activityOwner': clean(r['Activity owner']),
                'stakeholder': clean(r['Stakeholder']),
                'enabled': published,
                'status': 'Published' if published else 'Draft',
                'conditions': conds,
                'conditionsText': clean(r['Conditions']),
                'phases': [PHASE_NAME.get(p.lower(), p) for p in phases],
                'phasesAssumed': assumed,
                'requirementTitle': re.sub(r'\s+', ' ', name),
                'requirementDescription': clean(r['What it means']) or clean(r['Why does this exist']),
                'why': clean(r['Why does this exist']),
                'tasks': [action_title(name)],
                'actions': [{'title': action_title(name), 'description': steps_text(r['What needs to happen']) or clean(r['What it means']), 'evidence': '', 'legal': 'legal' in clean(r['Mandatory status']).lower()}],
                'standards': standards,
                'systems': clean(r['Systems']),
                'guidance': clean(r['Guidance']),
                'version': 1,
                'versions': [{'v': 1, 'at': CREATED, 'by': 'CSV import', 'note': 'Imported from ' + os.path.basename(path) + '.'}],
            }
            rules.append(rule)
    return rules


def main():
    rules = build()
    os.makedirs(os.path.join(OUT, 'rules'), exist_ok=True)
    meta = {'generated': datetime.date.today().isoformat(), 'count': len(rules),
            'published': sum(r['status'] == 'Published' for r in rules), 'draft': sum(r['status'] == 'Draft' for r in rules)}
    json.dump({'meta': meta, 'rules': rules}, open(os.path.join(OUT, 'rules.json'), 'w'), indent=1, ensure_ascii=False)
    for r in rules:
        json.dump(r, open(os.path.join(OUT, 'rules', r['id'] + '.json'), 'w'), indent=1, ensure_ascii=False)
    open(os.path.join(OUT, 'rules-seed.js'), 'w').write('window.RULES_SEED = ' + json.dumps(rules, ensure_ascii=False) + ';\n')
    print(meta)


main()
