(function () {
'use strict';

/* ---------- Reference data (from the Rules Engine diagram) ---------- */
const OPT = {
  demand: ['New demand', 'Planned change', 'BAU / Incident driven', 'Feature or Improvement', 'Risk remediation', 'Retirement or Replacement', 'Purchase or Procurement'],
  type: ['Change', 'New', 'Procurement', 'Improvement', 'BAU'],
  stage: ['Idea', 'Understanding', 'Design and test', 'Build', 'Run / Serve', 'Decommissioning'],
  characteristics: ['Transactional', 'Information', 'Data', 'Campaign', 'API'],
  channel: ['Online', 'Native app', 'Face to face', 'Print', 'Email'],
  users: ['SBP', 'Public', 'Parents and Carers', 'Teachers', 'Local Authorities', 'HCPs'],
  yesno: ['Yes', 'No'],
  level: ['High', 'Medium', 'Low']
};
// kind: single | multi | yesno | number
const FIELDS = {
  demand: { label: 'Work source', kind: 'single', options: OPT.demand },
  type: { label: 'Type of work', kind: 'single', options: OPT.type },
  stage: { label: 'Stage', kind: 'single', options: OPT.stage },
  characteristics: { label: 'Characteristics', kind: 'multi', options: OPT.characteristics },
  channel: { label: 'Channel', kind: 'multi', options: OPT.channel },
  users: { label: 'Users', kind: 'multi', options: OPT.users },
  transactional: { label: 'Transactional', kind: 'yesno', options: OPT.yesno },
  estTransactions: { label: 'Estimated transactions per year', kind: 'number' },
  personalData: { label: 'Captures or processes personal data', kind: 'yesno', options: OPT.yesno },
  priority: { label: 'Priority', kind: 'single', options: OPT.level },
  risk: { label: 'Risk and impact', kind: 'single', options: OPT.level }
};
const OPS = {
  single: [['is', 'is'], ['isnot', 'is not'], ['in', 'is one of']],
  multi: [['includes', 'includes']],
  yesno: [['is', 'is']],
  number: [['gte', 'is at least'], ['lte', 'is at most']]
};
const OP_LABEL = { in: 'is one of', is: 'is', isnot: 'is not', includes: 'includes', gte: 'is at least', lte: 'is at most' };
const STATUSES = ['Not started', 'In progress', 'Complete', 'Exception', 'No longer required'];
const STATUS_TAG = { 'Not started': 'govuk-tag--grey', 'In progress': 'govuk-tag--blue', 'Complete': 'govuk-tag--green', 'Exception': 'govuk-tag--orange', 'No longer required': 'govuk-tag--purple' };
const KEY = 'compass-rules-engine-v4';

/* ---------- State ---------- */
let S;
let ERR = {};
let workDraft = null;      // retained entries when the work form fails validation
let flash = null;          // one-off notification banner
let ruleDraft = null;      // rule form state

function load() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.works) return migrateDeps(d); } catch (e) { /* fall through */ }
  return migrateDeps(seed());
}
function save() { localStorage.setItem(KEY, JSON.stringify(S)); }
const uid = (p) => { S.seq[p] = (S.seq[p] || 0) + 1; return p + '-' + String(S.seq[p]).padStart(3, '0'); };
const now = () => new Date().toISOString();
const fmt = (iso) => new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const arr = (v) => Array.isArray(v) ? v : (v ? [v] : []);


// Rule owners: a person or a team. Older saved data without an owner is filled in here.
const OWNERS = { Team: ['Data Protection Office', 'Service Assurance Team', 'Accessibility Team', 'Safeguarding Team', 'Commercial Team', 'Technical Standards Group', 'Risk and Assurance Team'], Person: ['Amara Okafor', 'Chris Walker', 'Dan Fraser', 'Jo Bennett'] };
const OWNER_TYPE = (name) => OWNERS.Person.includes(name) ? 'Person' : OWNERS.Team.includes(name) ? 'Team' : '';
const SEED_OWNER = { 'Service assessment for high volume transactional services': 'Service Assurance Team', 'DPIA high risk screener': 'Data Protection Office', 'Accessibility enrolment': 'Accessibility Team', 'Children and families safeguarding review': 'Safeguarding Team', 'Procurement route and commercial approval': 'Commercial Team', 'API standards review': 'Dan Fraser', 'Decommissioning plan': 'Jo Bennett', 'High risk assurance board': 'Risk and Assurance Team' };
const legalTag = (a) => a.legal ? tag('Legal requirement', 'govuk-tag--red') : tag('Not a legal requirement', 'govuk-tag--grey');
function stepItems(text) {
  return String(text || '').split(/\n+/).map((l) => l.trim().replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
}
function stepList(text) {
  const items = stepItems(text);
  if (!items.length) return '<p class="govuk-body"><span class="muted">No description yet.</span></p>';
  if (items.length === 1) return '<p class="govuk-body">' + esc(items[0]) + '</p>';
  return '<ul class="govuk-list govuk-list--bullet">' + items.map((l) => '<li>' + esc(l) + '</li>').join('') + '</ul>';
}
function actionDefList(r) {
  return '<ol class="act-list">' + r.actions.map((a) => '<li><p class="govuk-body govuk-!-margin-bottom-1"><strong>' + esc(a.title) + '</strong> ' + legalTag(a) + '</p>' +
    stepList(a.description) +
    '<p class="govuk-body-s govuk-!-margin-bottom-0"><strong>Expected evidence:</strong> ' + (a.evidence ? esc(a.evidence) : '<span class="muted">Not yet defined.</span>') + '</p></li>').join('') + '</ol>';
}
const actDef = (a) => { const r = ruleOf(a.ruleId), d = r && r.actions.find((x) => x.title === a.title); return d || { description: a.description, evidence: a.evidence, legal: a.legal }; };
const isLegal = (r) => /legal/i.test(r.mandatory || '');
function actionsFromTasks(r) { return (r.tasks || []).map((t) => ({ title: t, description: '', evidence: '', legal: isLegal(r) })); }
function normRule(r) {
  if (!r.actions) r.actions = actionsFromTasks(r);
  r.tasks = r.actions.map((a) => a.title);
  if (r.owner === undefined) r.owner = SEED_OWNER[r.name] || '';
  if (!r.status) r.status = r.enabled === false ? 'Retired' : 'Published';
  r.enabled = r.status === 'Published';
  if (!r.version) r.version = 1;
  if (!r.dependsOn) r.dependsOn = [];
  if (!r.versions) r.versions = [{ v: 1, at: now(), by: 'System', note: 'Initial version.', snap: snapOf(r) }];
  return r;
}
// The editable content of a rule, stored against each version so versions can be compared and restored.
const SNAP_KEYS = ['name', 'source', 'owner', 'status', 'conditions', 'requirementTitle', 'requirementDescription', 'tasks', 'actions', 'conditionsText', 'dependsOn', 'mandatory', 'why', 'kind', 'category', 'phases', 'standards', 'systems', 'guidance'];
function snapOf(r) { const o = {}; SNAP_KEYS.forEach((k) => { if (r[k] !== undefined) o[k] = JSON.parse(JSON.stringify(r[k])); }); return o; }
const TRIGGER_SEED = [
  { name: 'Work created', event: 'created', fields: [] },
  { name: 'Stage changed', event: 'changed', fields: ['stage'] },
  { name: 'Type or work source changed', event: 'changed', fields: ['type', 'demand'] },
  { name: 'Characteristics, channel or users changed', event: 'changed', fields: ['characteristics', 'channel', 'users'] },
  { name: 'Data or transactions changed', event: 'changed', fields: ['transactional', 'estTransactions', 'personalData'] },
  { name: 'Risk or priority changed', event: 'changed', fields: ['risk', 'priority'] },
  { name: 'Rule published or changed', event: 'rule', fields: [] }
];
function seedTriggerDefs() { S.triggerDefs = TRIGGER_SEED.map((t, i) => Object.assign({ id: 'TD-' + String(i + 1).padStart(2, '0'), enabled: true }, t)); S.seq.TD = TRIGGER_SEED.length; }
S = load();
S.rules.forEach(normRule);
if (!S.triggerDefs) { S.seq = S.seq || {}; seedTriggerDefs(); }

/* ---------- Rules engine ---------- */
function condMatches(work, c) {
  const f = FIELDS[c.field]; if (!f) return false;
  const v = work[c.field];
  switch (c.op) {
    case 'is': return String(v) === String(c.value);
    case 'isnot': return String(v) !== String(c.value);
    case 'in': return arr(c.value).includes(String(v));
    case 'includes': return arr(v).includes(c.value);
    case 'gte': return Number(v) >= Number(c.value);
    case 'lte': return v !== '' && v != null && Number(v) <= Number(c.value);
  }
  return false;
}
function ruleMatches(work, rule) {
  return rule.enabled !== false && rule.conditions.length > 0 && rule.conditions.every((c) => condMatches(work, c));
}
function matchingRules(work) { return S.rules.filter((r) => ruleMatches(work, r)); }

// Reconciles a work item's actions with the rules that currently apply. Returns a summary.
function runEngine(work, systemNote) {
  const result = { added: [], withdrawn: [], reinstated: [], fired: [] };
  const matched = matchingRules(work);
  result.fired = matched.map((r) => r.id);
  // Each rule task becomes its own action with its own status, evidence and history.
  matched.forEach((rule) => {
    rule.actions.forEach((def) => {
      const title = def.title;
      const existing = S.actions.find((a) => a.workId === work.id && a.ruleId === rule.id && !a.custom && a.title === title);
      if (!existing) {
        const a = {
          id: uid('ACT'), workId: work.id, ruleId: rule.id, ruleVersion: rule.version, title, description: def.description || '', evidence: def.evidence || '', legal: !!def.legal, status: 'Not started', created: now(),
          updates: [{ at: now(), type: 'system', text: 'Raised by rule ' + rule.id + ' v' + rule.version + ' (' + rule.name + '). ' + systemNote }]
        };
        S.actions.push(a); result.added.push(a);
      } else if (existing.status === 'No longer required') {
        existing.status = 'Not started';
        existing.updates.push({ at: now(), type: 'system', text: 'Action applies again. ' + systemNote });
        result.reinstated.push(existing);
      }
    });
  });
  S.actions.filter((a) => a.workId === work.id && !matched.some((r) => r.id === a.ruleId) && a.ruleId && a.status !== 'No longer required' && a.status !== 'Complete')
    .forEach((a) => {
      a.status = 'No longer required';
      a.updates.push({ at: now(), type: 'system', text: 'Rule ' + a.ruleId + ' no longer applies. ' + systemNote });
      result.withdrawn.push(a);
    });
  return result;
}

function diffWork(oldW, newW) {
  const changes = [];
  Object.keys(FIELDS).forEach((k) => {
    const a = FIELDS[k].kind === 'multi' ? arr(oldW[k]).slice().sort().join(', ') : String(oldW[k] == null ? '' : oldW[k]);
    const b = FIELDS[k].kind === 'multi' ? arr(newW[k]).slice().sort().join(', ') : String(newW[k] == null ? '' : newW[k]);
    if (a !== b) changes.push({ field: k, from: a || 'not set', to: b || 'not set' });
  });
  return changes;
}

function recordTrigger(work, event, changes, result, def) {
  const t = {
    id: uid('TRG'), at: now(), workId: work.id, event, changes, defId: def ? def.id : '', defName: def ? def.name : '',
    fired: result.fired, added: result.added.map((a) => a.id), reinstated: result.reinstated.map((a) => a.id), withdrawn: result.withdrawn.map((a) => a.id)
  };
  S.triggers.unshift(t);
  return t;
}

/* ---------- Seed data ---------- */
function seed() {
  S = { seq: {}, works: [], rules: [], actions: [], triggers: [] };
  seedTriggerDefs();
  const SEED_ACT = {
    'Book assessment slot': ['Book a slot with the service assessment team.', 'Booking confirmation or calendar invite.', false],
    'Prepare service assessment pack': ['Pull together the evidence and artefacts the panel asks for.', 'Link to the completed assessment pack.', false],
    'Complete assessment and record outcome': ['Attend the assessment and record the panel outcome.', 'Assessment report with the outcome.', false],
    'Complete screener': ['Answer the DPIA high risk screener questions.', 'Completed screener form.', true],
    'Data Protection Officer review': ['The DPO reviews the screener and advises on a full DPIA.', 'DPO sign-off or advice note.', true],
    'Enrol service': ['Enrol the service in the Accessibility Issues and Statement Service.', 'Enrolment confirmation.', true],
    'Publish accessibility statement': ['Publish an accessibility statement on the live service.', 'Link to the published statement.', true],
    'Safeguarding review': ['Review safeguarding risks for children, parents and carers.', 'Safeguarding review record.', false],
    'Agree user research plan': ['Agree an inclusive research plan with the safeguarding team.', 'Approved research plan.', false],
    'Confirm route to market': ['Confirm the procurement route.', 'Route to market decision record.', false],
    'Commercial approval': ['Get commercial sign-off to proceed.', 'Approval email or record.', false],
    'Cost and resource sign off': ['Agree costs and resourcing.', 'Signed-off cost and resource plan.', false],
    'Register API in catalogue': ['Register the API in the API catalogue.', 'Catalogue entry link.', false],
    'Architecture review': ['Review the design against the API standards.', 'Architecture review outcome.', false],
    'Data retention decision': ['Decide what data is kept, archived or deleted.', 'Retention decision record.', true],
    'User communications': ['Tell users the service is closing.', 'Copy of the communications sent.', false],
    'Archive records': ['Archive records in line with the retention decision.', 'Archive confirmation.', true],
    'Prepare risk summary': ['Summarise the risks and impact for the board.', 'Risk summary paper.', false],
    'Present to board': ['Present the work to the assurance board.', 'Board minute or decision.', false]
  };
  const R = (name, source, conditions, title, desc, tasks) => S.rules.push(normRule({
    actions: tasks.map((t) => ({ title: t, description: (SEED_ACT[t] || [])[0] || '', evidence: (SEED_ACT[t] || [])[1] || '', legal: !!(SEED_ACT[t] || [])[2] })),
    id: uid('RUL'), name, source, owner: SEED_OWNER[name] || '', kind: 'Policy', mandatory: 'Must have', conditions, requirementTitle: title, requirementDescription: desc, tasks
  }));
  R('Service assessment for high volume transactional services', 'GDS Service Standard',
    [{ field: 'transactional', op: 'is', value: 'Yes' }, { field: 'estTransactions', op: 'gte', value: '100000' }],
    'Service assessment (transactional, over 100k transactions)', 'Services with more than 100,000 transactions a year need a service assessment.',
    ['Book assessment slot', 'Prepare service assessment pack', 'Complete assessment and record outcome']);
  R('DPIA high risk screener', 'UK GDPR / Data protection policy',
    [{ field: 'personalData', op: 'is', value: 'Yes' }],
    'DPIA High Risk Screener', 'Work that captures or processes personal data must complete the DPIA high risk screener.',
    ['Complete screener', 'Data Protection Officer review']);
  R('Accessibility enrolment', 'Public sector accessibility regulations',
    [{ field: 'channel', op: 'includes', value: 'Online' }],
    'Enrol to Accessibility Issues and Statement Service', 'Online services must enrol and keep an accessibility statement.',
    ['Enrol service', 'Publish accessibility statement']);
  R('Children and families safeguarding review', 'Safeguarding policy',
    [{ field: 'users', op: 'includes', value: 'Parents and Carers' }],
    'Safeguarding and user research review', 'Services used by parents and carers need a safeguarding review and inclusive research plan.',
    ['Safeguarding review', 'Agree user research plan']);
  R('Procurement route and commercial approval', 'Procurement standards',
    [{ field: 'type', op: 'is', value: 'Procurement' }],
    'Procurement approval', 'Procurement work needs commercial approval and a route to market.',
    ['Confirm route to market', 'Commercial approval', 'Cost and resource sign off']);
  R('API standards review', 'Technical standards',
    [{ field: 'characteristics', op: 'includes', value: 'API' }],
    'API standards review', 'APIs must be reviewed against the API standards before build.',
    ['Register API in catalogue', 'Architecture review']);
  R('Decommissioning plan', 'Retirement policy',
    [{ field: 'stage', op: 'is', value: 'Decommissioning' }],
    'Decommissioning plan', 'Work in decommissioning needs a plan covering data retention and user comms.',
    ['Data retention decision', 'User communications', 'Archive records']);
  R('High risk assurance board', 'Risk management framework',
    [{ field: 'risk', op: 'is', value: 'High' }],
    'Risk assurance board review', 'High risk and impact work goes to the assurance board.',
    ['Prepare risk summary', 'Present to board']);

  // Rules imported from the CSV examples in spec/ (built by tools/build-rules.py)
  (window.RULES_SEED || []).forEach((r) => S.rules.push(normRule(Object.assign(JSON.parse(JSON.stringify(r)), { versions: r.versions.map((v) => Object.assign({}, v, { snap: snapOf(r) })) }))));
  S.seq.RUL = Math.max(S.seq.RUL || 0, ...S.rules.map((r) => Number(r.id.slice(4)) || 0));

  const W = (o) => S.works.push(Object.assign({ id: uid('WRK'), description: '', created: now(), characteristics: [], channel: [], users: [], transactional: 'No', estTransactions: '', personalData: 'No', priority: 'Medium', risk: 'Medium' }, o));
  W({ title: 'School trips booking service', description: 'Let parents book and pay for school trips online.', demand: 'New demand', type: 'New', stage: 'Idea', characteristics: ['Transactional'], channel: ['Online'], users: ['Parents and Carers', 'Teachers'], transactional: 'Yes', estTransactions: '250000', personalData: 'Yes', priority: 'High' });
  W({ title: 'Legacy case system replacement', description: 'Replace the legacy case management system.', demand: 'Retirement or Replacement', type: 'Procurement', stage: 'Understanding', characteristics: ['Data', 'API'], channel: ['Online'], users: ['Local Authorities'], personalData: 'Yes', risk: 'High' });
  W({ title: 'Guidance pages refresh', description: 'Improve the structure of published guidance.', demand: 'Feature or Improvement', type: 'Improvement', stage: 'Design and test', characteristics: ['Information'], channel: ['Online', 'Print'], users: ['Public'], priority: 'Low', risk: 'Low' });
  S.works.forEach((w) => { const r = runEngine(w, 'Initial categorisation.'); recordTrigger(w, 'Work created', [], r, S.triggerDefs[0]); });
  // a little sample progress
  const a = S.actions.find((x) => x.workId === 'WRK-003' && x.title === 'Enrol service');
  if (a) { a.status = 'Complete'; a.updates.push({ at: now(), type: 'evidence', text: 'Service enrolled, confirmation received.', link: 'https://example.com/enrolment' }, { at: now(), type: 'system', text: 'Status changed from Not started to Complete.' }); }
  const b = S.actions.find((x) => x.workId === 'WRK-001' && x.title === 'Complete screener');
  if (b) { b.status = 'In progress'; b.updates.push({ at: now(), type: 'note', text: 'Screener drafted, awaiting answers from the delivery team.' }, { at: now(), type: 'system', text: 'Status changed from Not started to In progress.' }); }
  localStorage.setItem(KEY, JSON.stringify(S));
  return S;
}

/* ---------- View helpers ---------- */
const workName = (id) => { const w = S.works.find((x) => x.id === id); return w ? w.title : id; };
const tag = (text, cls) => '<strong class="govuk-tag ' + (cls || '') + '">' + esc(text) + '</strong>';
const statusTag = (s) => tag(s, STATUS_TAG[s]);
const fieldVal = (w, k) => FIELDS[k].kind === 'multi' ? (arr(w[k]).join(', ') || 'None') : (w[k] === '' || w[k] == null ? 'Not set' : (FIELDS[k].kind === 'number' ? Number(w[k]).toLocaleString('en-GB') : w[k]));
const condText = (c) => (FIELDS[c.field] ? FIELDS[c.field].label : c.field) + ' ' + (OP_LABEL[c.op] || c.op) + ' ' + (Array.isArray(c.value) ? c.value.join(' or ') : FIELDS[c.field] && FIELDS[c.field].kind === 'number' ? Number(c.value).toLocaleString('en-GB') : c.value);
const evCount = (a) => a.updates.filter((u) => u.type === 'evidence').length;
const isActive = (a) => a.status !== 'No longer required';
const isOpen = (a) => a.status !== 'No longer required' && a.status !== 'Complete';
const ruleOf = (id) => S.rules.find((r) => r.id === id);
// Rule dependencies: a rule's actions wait until the actions of every rule it depends on are complete.
const depsOf = (r) => (r && r.dependsOn) || [];
const requiredBy = (id) => S.rules.filter((r) => depsOf(r).includes(id));
function depDepth(id, seen) { seen = seen || []; if (seen.includes(id)) return 0; const ds = depsOf(ruleOf(id)); return ds.length ? 1 + Math.max.apply(null, ds.map((d) => depDepth(d, seen.concat(id)))) : 0; }
function dependsTransitively(id, target, seen) { seen = seen || []; if (id === target) return true; if (seen.includes(id)) return false; return depsOf(ruleOf(id)).some((d) => dependsTransitively(d, target, seen.concat(id))); }
function blockers(a) {
  return depsOf(ruleOf(a.ruleId)).map((id) => ({ rule: ruleOf(id), actions: S.actions.filter((x) => x.workId === a.workId && x.ruleId === id && isOpen(x)) })).filter((b) => b.rule && b.actions.length);
}
const isBlocked = (a) => isOpen(a) && blockers(a).length > 0;
const blockText = (a) => blockers(a).map((b) => b.rule.requirementTitle).join(', ');
const blockTag = (a) => isBlocked(a) ? '<span class="flag flag--grey" title="Waiting for: ' + esc(blockText(a)) + '">Blocked</span>' : '';
const gate = (a, status) => (isBlocked(a) && (status === 'In progress' || status === 'Complete')) ? 'This action is blocked until ' + blockText(a) + ' is complete.' : '';
function blockNotice(a) {
  const bl = isOpen(a) ? blockers(a) : []; if (!bl.length) return '';
  return '<div class="govuk-notification-banner blocked-note" role="region" aria-labelledby="blk-t"><div class="govuk-notification-banner__header"><h2 class="govuk-notification-banner__title" id="blk-t">Blocked</h2></div><div class="govuk-notification-banner__content"><p class="govuk-notification-banner__heading">Waiting for ' + bl.map((b) => esc(b.rule.requirementTitle)).join(' and ') + '</p><p class="govuk-body">' + esc(ruleOf(a.ruleId).name) + ' depends on this being complete first. It will unlock when these actions are done:</p><ul class="govuk-list govuk-list--bullet">' +
    bl.map((b) => b.actions.map((x) => '<li><a class="govuk-link" href="#/actions/' + x.id + '">' + esc(x.title) + '</a> ' + statusTag(x.status) + '</li>').join('')).join('') + '</ul></div></div>';
}
const depList = (r) => '<ul class="govuk-list govuk-body-s deplist">' + depsOf(r).map((id) => '<li><span class="muted">Needs first</span> ' + ruleChip(id) + ' ' + esc((ruleOf(id) || {}).name || '') + '</li>').join('') + requiredBy(r.id).map((x) => '<li><span class="muted">Required by</span> ' + ruleChip(x.id) + ' ' + esc(x.name) + '</li>').join('') + '</ul>';
function migrateDeps(d) {
  const SEED_DEPS = { 'Service assessment for high volume transactional services': ['DPIA high risk screener'], 'High risk assurance board': ['DPIA high risk screener'] };
  if (d.depsMigrated) return d;
  d.rules.forEach((r) => { if (!r.dependsOn || !r.dependsOn.length) r.dependsOn = (SEED_DEPS[r.name] || []).map((n) => (d.rules.find((x) => x.name === n) || {}).id).filter(Boolean); });
  d.depsMigrated = true; return d;
}
const reqTitle = (a) => { const r = ruleOf(a.ruleId); return r ? r.requirementTitle : 'Other actions'; };
const workPct = (id) => { const l = S.actions.filter((a) => a.workId === id && isActive(a)); return l.length ? Math.round(l.filter((a) => a.status === 'Complete').length / l.length * 100) : 0; };
const bar = (p, label) => '<div class="bar" role="img" aria-label="' + esc(label || p + '% complete') + '"><span style="width:' + p + '%"></span></div>';
// Requirements for a work item: actions grouped by the rule that raised them
function reqGroups(workId, includeRetired) {
  const groups = [];
  S.actions.filter((a) => a.workId === workId && (includeRetired || isActive(a))).forEach((a) => {
    let g = groups.find((x) => x.ruleId === a.ruleId);
    if (!g) { g = { ruleId: a.ruleId, title: reqTitle(a), actions: [] }; groups.push(g); }
    g.actions.push(a);
  });
  return groups.sort((x, y) => depDepth(x.ruleId) - depDepth(y.ruleId));
}
// Rule ID chip: opens the rule information dialog
const ruleChip = (id) => S.rules.some((r) => r.id === id)
  ? '<button type="button" class="rule-chip" data-act="rule-info" data-id="' + esc(id) + '" aria-haspopup="dialog">' + esc(id) + '</button>'
  : '<span class="rule-chip rule-chip--gone">' + esc(id) + '</span>';
const pageHead = (title, sub, actions) => '<div class="page-head"><div><h1 class="govuk-heading-l">' + title + '</h1>' + (sub ? '<p class="govuk-body page-sub">' + sub + '</p>' : '') + '</div>' + (actions ? '<div class="page-actions">' + actions + '</div>' : '') + '</div>';
const btn = (href, label, secondary) => '<a href="' + href + '" role="button" draggable="false" class="govuk-button' + (secondary ? ' govuk-button--secondary' : '') + '" data-module="govuk-button">' + label + '</a>';
const prioTag = (p) => tag(p || 'Not set', p === 'High' ? 'govuk-tag--red' : p === 'Medium' ? 'govuk-tag--yellow' : 'govuk-tag--grey');
const statusSelect = (a) => '<label class="govuk-visually-hidden" for="mv-' + a.id + '">Status of ' + esc(a.title) + '</label><select class="kmove" id="mv-' + a.id + '" data-act="move" data-id="' + a.id + '">' + STATUSES.map((s) => '<option' + (s === a.status ? ' selected' : '') + '>' + s + '</option>').join('') + '</select>';
const evBadge = (a) => evCount(a) ? '<span class="ev ev--yes">' + evCount(a) + ' evidence</span>' : '<span class="ev">No evidence</span>';
const actionCard = (a) => '<article class="kcard" draggable="true" data-id="' + a.id + '">' +
  '<div class="kcard-top">' + (a.ruleId ? ruleChip(a.ruleId) : '<span></span>') + '<span class="kcard-id">' + a.id + '</span></div>' +
  '<h3 class="kcard-title"><a class="govuk-link govuk-link--no-visited-state" href="#/actions/' + a.id + '">' + esc(a.title) + '</a></h3>' + (isBlocked(a) ? '<p class="kcard-work">' + blockTag(a) + ' Waiting for ' + esc(blockText(a)) + '</p>' : '') +
  '<p class="kcard-work">' + esc(reqTitle(a)) + '<br><a class="govuk-link govuk-link--no-visited-state" href="#/work/' + a.workId + '">' + esc(workName(a.workId)) + '</a></p>' +
  '<div class="kcard-foot">' + evBadge(a) + (actLegal(a) ? tag('Legal', 'govuk-tag--red') : '') + '<a class="link-btn" href="#/actions/' + a.id + '">Record activity<span class="govuk-visually-hidden"> for ' + esc(a.title) + '</span></a></div></article>';
function banner() {
  if (!flash) return '';
  const html = '<div class="govuk-notification-banner govuk-notification-banner--success" role="alert" data-module="govuk-notification-banner"><div class="govuk-notification-banner__header"><h2 class="govuk-notification-banner__title">' + esc(flash.title) + '</h2></div><div class="govuk-notification-banner__content">' + flash.html + '</div></div>';
  flash = null; return html;
}
function table(head, rows, cls) {
  return '<table class="govuk-table ' + (cls || '') + '"><thead class="govuk-table__head"><tr class="govuk-table__row">' + head.map((h) => '<th scope="col" class="govuk-table__header">' + h + '</th>').join('') + '</tr></thead><tbody class="govuk-table__body">' +
    rows.map((r) => '<tr class="govuk-table__row">' + r.map((c) => '<td class="govuk-table__cell">' + c + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
}
// Validation errors for the form currently shown: { fieldName: { msg, id } }
function fail(name, msg, id) { ERR[name] = { msg, id: id || name }; }
const hasErr = () => Object.keys(ERR).length > 0;
const grp = (name) => 'govuk-form-group' + (ERR[name] ? ' govuk-form-group--error' : '');
const errMsg = (name, id) => ERR[name] ? '<p id="' + id + '-error" class="govuk-error-message"><span class="govuk-visually-hidden">Error:</span> ' + esc(ERR[name].msg) + '</p>' : '';
const describedBy = (name, id, hint) => { const ids = [hint ? id + '-hint' : '', ERR[name] ? id + '-error' : ''].filter(Boolean).join(' '); return ids ? ' aria-describedby="' + ids + '"' : ''; };
function errorSummary() {
  if (!hasErr()) return '';
  return '<div class="govuk-error-summary" data-module="govuk-error-summary"><div role="alert"><h2 class="govuk-error-summary__title">There is a problem</h2><div class="govuk-error-summary__body"><ul class="govuk-list govuk-error-summary__list">' +
    Object.keys(ERR).map((k) => '<li><a href="#" data-act="focus-field" data-field="' + esc(ERR[k].id) + '">' + esc(ERR[k].msg) + '</a></li>').join('') + '</ul></div></div></div>';
}
function select(name, id, options, value, label) {
  return '<div class="' + grp(name) + '"><label class="govuk-label govuk-label--s" for="' + id + '">' + label + '</label>' + errMsg(name, id) +
    '<select class="govuk-select' + (ERR[name] ? ' govuk-select--error' : '') + '" id="' + id + '" name="' + name + '"' + describedBy(name, id) + '>' +
    '<option value="">Select</option>' + options.map((o) => '<option' + (o === value ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select></div>';
}
function checks(name, options, values, label) {
  return '<div class="' + grp(name) + '"><fieldset class="govuk-fieldset"><legend class="govuk-fieldset__legend govuk-fieldset__legend--s">' + label + '</legend>' + errMsg(name, name) + '<div class="govuk-checkboxes govuk-checkboxes--small" data-module="govuk-checkboxes">' +
    options.map((o, i) => '<div class="govuk-checkboxes__item"><input class="govuk-checkboxes__input" id="' + name + '-' + i + '" name="' + name + '" type="checkbox" value="' + esc(o) + '"' + (arr(values).includes(o) ? ' checked' : '') + '><label class="govuk-label govuk-checkboxes__label" for="' + name + '-' + i + '">' + esc(o) + '</label></div>').join('') +
    '</div></fieldset></div>';
}
function radios(name, options, value, label) {
  return '<div class="' + grp(name) + '"><fieldset class="govuk-fieldset"><legend class="govuk-fieldset__legend govuk-fieldset__legend--s">' + label + '</legend>' + errMsg(name, name) + '<div class="govuk-radios govuk-radios--small govuk-radios--inline" data-module="govuk-radios">' +
    options.map((o, i) => '<div class="govuk-radios__item"><input class="govuk-radios__input" id="' + name + '-' + i + '" name="' + name + '" type="radio" value="' + esc(o) + '"' + (o === value ? ' checked' : '') + '><label class="govuk-label govuk-radios__label" for="' + name + '-' + i + '">' + esc(o) + '</label></div>').join('') +
    '</div></fieldset></div>';
}
function text(name, id, value, label, opts) {
  opts = opts || {};
  const err = ERR[name] ? ' govuk-input--error' : '';
  return '<div class="' + grp(name) + '"><label class="govuk-label govuk-label--s" for="' + id + '">' + label + '</label>' + (opts.hint ? '<div id="' + id + '-hint" class="govuk-hint">' + opts.hint + '</div>' : '') + errMsg(name, id) +
    (opts.area ? '<textarea class="govuk-textarea' + (ERR[name] ? ' govuk-textarea--error' : '') + '" id="' + id + '" name="' + name + '" rows="' + (opts.rows || 4) + '"' + describedBy(name, id, opts.hint) + '>' + esc(value) + '</textarea>'
      : '<input class="govuk-input ' + (opts.cls || '') + err + '" id="' + id + '" name="' + name + '" type="' + (opts.type || 'text') + '" value="' + esc(value) + '"' + describedBy(name, id, opts.hint) + (opts.type === 'number' ? ' inputmode="numeric" min="0"' : '') + '>') + '</div>';
}
const flowDiagram = (active) => {
  const steps = [['Work', 'Categorised by type, stage, characteristics'], ['Trigger', 'A categorisation change raises a signal'], ['Rules engine', 'Policies and standards are evaluated'], ['Requirements', 'Assurance plan is returned'], ['Actions', 'Tasks, evidence, decisions']];
  return '<div class="flow">' + steps.map((s, i) => '<div class="flow-step' + (i === active ? ' active' : '') + '"><strong>' + s[0] + '</strong><span class="govuk-body-s">' + s[1] + '</span></div>').join('') + '</div>';
};

/* ---------- Views ---------- */
function actionRow(a, showWork) {
  return '<tr class="govuk-table__row"><td class="govuk-table__cell"><a class="govuk-link govuk-link--no-visited-state" href="#/actions/' + a.id + '">' + esc(a.title) + '</a> <span class="muted">' + a.id + '</span> ' + blockTag(a) +
    (showWork ? '<br><a class="govuk-link govuk-link--no-visited-state muted" href="#/work/' + a.workId + '">' + esc(workName(a.workId)) + '</a>' : '') + '</td>' +
    '<td class="govuk-table__cell">' + evBadge(a) + '</td><td class="govuk-table__cell">' + (isActive(a) ? statusSelect(a) : statusTag(a.status)) + '</td></tr>';
}
const actionTable = (list, showWork) => '<table class="govuk-table compact"><thead class="govuk-table__head"><tr class="govuk-table__row"><th scope="col" class="govuk-table__header">Action</th><th scope="col" class="govuk-table__header">Evidence</th><th scope="col" class="govuk-table__header">Status</th></tr></thead><tbody class="govuk-table__body">' + list.map((a) => actionRow(a, showWork)).join('') + '</tbody></table>';


function vWorkForm(id) {
  const isNew = id === 'new';
  const base = isNew ? { characteristics: [], channel: [], users: [], transactional: 'No', personalData: 'No', priority: 'Medium', risk: 'Medium', estTransactions: '' } : S.works.find((x) => x.id === id);
  if (!base) return notFound();
  const w = workDraft && workDraft.key === id ? workDraft.data : base;
  return '<a href="' + (isNew ? '#/work' : '#/work/' + id) + '" class="govuk-back-link">Back</a>' + errorSummary() +
    '<h1 class="govuk-heading-xl">' + (isNew ? 'Add work' : 'Change categorisation') + '</h1>' +
    (isNew ? '' : '<div class="govuk-inset-text">Saving changes raises a trigger. The rules engine re-runs and requirements are added or withdrawn as needed.</div>') +
    '<form id="work-form" data-id="' + esc(id) + '" novalidate>' +
    text('title', 'title', w.title, 'Title') +
    text('description', 'description', w.description, 'Description', { area: true, rows: 3 }) +
    select('demand', 'demand', OPT.demand, w.demand, 'Where did the work come from?') +
    select('type', 'type', OPT.type, w.type, 'Type of work') +
    select('stage', 'stage', OPT.stage, w.stage, 'Stage') +
    checks('characteristics', OPT.characteristics, w.characteristics, 'Characteristics') +
    checks('channel', OPT.channel, w.channel, 'Channel') +
    checks('users', OPT.users, w.users, 'Users') +
    radios('transactional', OPT.yesno, w.transactional, 'Is it transactional?') +
    text('estTransactions', 'est', w.estTransactions, 'Estimated transactions per year', { type: 'number', cls: 'govuk-input--width-10' }) +
    radios('personalData', OPT.yesno, w.personalData, 'Does it capture or process personal data?') +
    select('priority', 'priority', OPT.level, w.priority, 'Priority') +
    select('risk', 'risk', OPT.level, w.risk, 'Risk and impact') +
    '<button class="govuk-button" type="submit" data-module="govuk-button" data-prevent-double-click="true">Save and run rules</button></form>';
}

function triggerList(list) {
  if (!list.length) return '<p class="govuk-body">No triggers recorded.</p>';
  const more = (label, items, fn) => items.length ? '<details class="tl-more"><summary>' + label + ' (' + items.length + ')</summary><p>' + items.map(fn).join(' ') + '</p></details>' : '';
  const alink = (i) => '<a class="govuk-link" href="#/actions/' + i + '">' + i + '</a>';
  return list.map((t) => {
    const ch = t.changes.length ? '<ul class="govuk-list govuk-list--bullet">' + t.changes.map((c) => '<li><strong>' + esc(FIELDS[c.field].label) + '</strong>: ' + esc(c.from) + ' → ' + esc(c.to) + '</li>').join('') + '</ul>' : '';
    return '<div class="log-entry system"><p class="govuk-body-s govuk-!-margin-bottom-1">' + fmt(t.at) + ' · ' + t.id + ' · <a class="govuk-link" href="#/work/' + t.workId + '">' + esc(workName(t.workId)) + '</a></p>' +
      '<p class="govuk-body govuk-!-margin-bottom-1"><strong>' + esc(t.event) + '</strong>' + (t.defName ? ' ' + tag(t.defName, 'govuk-tag--grey') : '') + '</p>' + ch +
      (t.fired.length ? more('Rules matched', t.fired, ruleChip) : '<p class="govuk-body-s muted">No rules matched</p>') + more('New requirements', t.added, alink) + more('Reinstated', t.reinstated, alink) + more('No longer required', t.withdrawn, alink) + '</div>';
  }).join('');
}

const statusRule = (r) => tag(r.status, r.status === 'Published' ? 'govuk-tag--green' : r.status === 'Draft' ? 'govuk-tag--yellow' : 'govuk-tag--grey');
const RULE_SORTS = [['id', 'Rule ID'], ['name', 'Name A to Z'], ['owner', 'Owner'], ['source', 'Policy or standard'], ['work', 'Most work items'], ['status', 'Published first']];
function ownerCell(r) {
  return r.owner ? esc(r.owner) + '<br>' + tag(OWNER_TYPE(r.owner) || 'Owner', OWNER_TYPE(r.owner) === 'Team' ? 'govuk-tag--turquoise' : 'govuk-tag--purple') : '<span class="muted">Unassigned</span>';
}
function ruleDataset(r) { return r.dataset || 'Other'; }
function ruleAtStage(r, stage) {
  return r.conditions.some((c) => c.field === 'stage' && (c.op === 'is' ? String(c.value) === stage : c.op === 'in' && arr(c.value).includes(stage)));
}
function sourceLabel(r) {
  const parts = String(r.source || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return ruleDataset(r);
  return parts.length > 1 ? parts[0] + ' +' + (parts.length - 1) : parts[0];
}
function clipText(s, n) {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1).trim() + '…' : s;
}
function vRules() {
  const p = qs(), q = (p.get('q') || '').trim().toLowerCase(), fo = p.get('owner') || '', fd = p.get('dataset') || '', fst = p.get('stage') || '', fe = p.get('status') || '', sort = p.get('sort') || 'id';
  const count = (r) => S.works.filter((w) => ruleMatches(w, r)).length;
  const hay = (r) => [r.id, r.name, r.source, r.owner, r.requirementTitle, r.dataset, r.mandatory, r.conditionsText, (r.phases || []).join(' ')].join(' ').toLowerCase();
  const inPool = (r) => (!q || hay(r).includes(q)) && (!fo || (fo === '__none' ? !r.owner : r.owner === fo)) && (!fd || ruleDataset(r) === fd) && (!fst || ruleAtStage(r, fst));
  let list = S.rules.filter((r) => inPool(r) && (!fe || r.status === fe));
  const cmp = { id: (a, b) => a.id.localeCompare(b.id), name: (a, b) => a.name.localeCompare(b.name), owner: (a, b) => (a.owner || '\uffff').localeCompare(b.owner || '\uffff') || a.name.localeCompare(b.name),
    source: (a, b) => a.source.localeCompare(b.source) || a.name.localeCompare(b.name), work: (a, b) => count(b) - count(a) || a.name.localeCompare(b.name), status: (a, b) => (b.status === 'Published') - (a.status === 'Published') || a.id.localeCompare(b.id) };
  list = list.slice().sort(cmp[sort] || cmp.id);
  const opt = (v, l, cur) => '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(l) + '</option>';
  const owners = Array.from(new Set(S.rules.map((r) => r.owner).filter(Boolean))).sort();
  const datasets = Array.from(new Set(S.rules.map(ruleDataset))).sort();
  const sel = (name, label, opts) => '<div class="govuk-form-group"><label class="govuk-label govuk-label--s" for="rf-' + name + '">' + label + '</label><select class="govuk-select" id="rf-' + name + '" name="' + name + '" data-act="rule-filter">' + opts + '</select></div>';
  const filtered = q || fo || fd || fst;
  const pool = S.rules.filter(inPool);
  const pg = paged(list, p);
  const bar = '<form class="filter-bar" data-form="rule-filter" role="search" aria-label="Filter and sort rules">' + (fe ? '<input type="hidden" name="status" value="' + esc(fe) + '">' : '') + '<div class="govuk-form-group"><label class="govuk-label govuk-label--s" for="rf-q">Search</label><input class="govuk-input" id="rf-q" name="q" type="search" value="' + esc(p.get('q') || '') + '" placeholder="Name, ID, owner or condition"></div>' +
    sel('dataset', 'Rule set', opt('', 'All rule sets', fd) + datasets.map((o) => opt(o, o, fd)).join('')) +
    sel('stage', 'Stage', opt('', 'Any stage', fst) + OPT.stage.map((o) => opt(o, o, fst)).join('')) +
    sel('owner', 'Owner', opt('', 'All owners', fo) + opt('__none', 'Unassigned', fo) + owners.map((o) => opt(o, o, fo)).join('')) +
    sel('sort', 'Sort by', RULE_SORTS.map((o) => opt(o[0], o[1], sort)).join('')) +
    '<div class="govuk-form-group filter-bar__actions"><button class="govuk-button govuk-button--secondary" data-module="govuk-button" type="submit">Apply</button>' + (filtered || sort !== 'id' ? ' <a class="govuk-link" href="#/rules">Clear</a>' : '') + '</div></form>';
  const rows = pg.items.map((r) => {
    const n = count(r);
    const sameReturn = (r.requirementTitle || '').trim().toLowerCase() === (r.name || '').trim().toLowerCase();
    const note = clipText(r.conditionsText, 180);
    const phases = (r.phases || []).filter(Boolean);
    const meta = [phases.length ? esc(phases.join(', ')) : '', r.mandatory ? esc(r.mandatory) : '', (r.actions || []).length + ' action' + ((r.actions || []).length === 1 ? '' : 's'), depsOf(r).length ? 'Needs ' + esc(depsOf(r).join(', ')) + ' first' : '', requiredBy(r.id).length ? 'Required by ' + esc(requiredBy(r.id).map((x) => x.id).join(', ')) : '', r.owner ? esc(r.owner) : 'Unassigned'].filter(Boolean);
    return '<li class="rrow"><div class="rrow-main"><p class="rrow-k">' + ruleChip(r.id) + ' <span>' + esc(sourceLabel(r)) + '</span> ' + statusRule(r) + ' <span class="muted">v' + r.version + '</span></p>' +
      '<h2 class="rrow-t"><a class="govuk-link govuk-link--no-visited-state" href="#/rules/' + r.id + '">' + esc(r.name) + '</a></h2>' +
      '<p class="rrow-w"><strong>When</strong> ' + (r.conditions.length ? r.conditions.map((c) => '<span class="cpill">' + esc(condText(c)) + '</span>').join('<span class="cand">and</span>') : '<span class="muted">No conditions</span>') + '</p>' +
      (note ? '<p class="rrow-note">' + esc(note) + '</p>' : '') +
      (sameReturn ? '' : '<p class="rrow-w"><strong>Returns</strong> ' + esc(r.requirementTitle) + '</p>') +
      '<p class="rrow-meta">' + meta.join('<span aria-hidden="true">·</span>') + '</p></div>' +
      '<div class="rrow-side"><span class="rrow-n"><b>' + n + '</b> work item' + (n === 1 ? '' : 's') + '</span></div></li>';
  }).join('');
  return banner() + pageHead('Rules', 'Published rules run when their conditions match a piece of work, and return actions.', btn('#/rules/new', 'Add rule')) + bar +
    tabsNav('rules', p, 'status', [['', 'All', pool.length], ['Published', 'Published', pool.filter((r) => r.status === 'Published').length], ['Draft', 'Draft', pool.filter((r) => r.status === 'Draft').length], ['Retired', 'Retired', pool.filter((r) => r.status === 'Retired').length]], '', 'Rule status') +
    (pg.total ? '<p class="govuk-body-s muted rcount">Showing ' + pg.from + ' to ' + pg.to + ' of ' + pg.total + ' rules</p>' : '') +
    (pg.items.length ? '<ul class="rlist">' + rows + '</ul>' + pager('rules', p, pg) : '<div class="panel"><p class="govuk-body">No rules match these filters.</p></div>');
}

function condRow(c, i) {
  const f = FIELDS[c.field] || FIELDS.type;
  const ops = OPS[f.kind];
  const valCtl = c.op === 'in'
    ? '<fieldset class="govuk-fieldset"><legend class="govuk-visually-hidden">Values</legend><div class="govuk-checkboxes govuk-checkboxes--small">' + f.options.map((o, k) => '<div class="govuk-checkboxes__item"><input class="govuk-checkboxes__input" id="cval-' + i + '-' + k + '" name="cval' + i + '" type="checkbox" value="' + esc(o) + '"' + (arr(c.value).includes(o) ? ' checked' : '') + '><label class="govuk-label govuk-checkboxes__label" for="cval-' + i + '-' + k + '">' + esc(o) + '</label></div>').join('') + '</div></fieldset>'
    : f.kind === 'number'
    ? '<input class="govuk-input govuk-input--width-10" type="number" min="0" id="cval-' + i + '" name="cval' + i + '" value="' + esc(c.value) + '" aria-label="Value">'
    : '<select class="govuk-select" id="cval-' + i + '" name="cval' + i + '" aria-label="Value">' + f.options.map((o) => '<option' + (o === c.value ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select>';
  return '<div class="cond-row"><div class="govuk-form-group"><select class="govuk-select" name="cfield' + i + '" data-act="cond-field" data-i="' + i + '" aria-label="Field">' +
    Object.keys(FIELDS).map((k) => '<option value="' + k + '"' + (k === c.field ? ' selected' : '') + '>' + FIELDS[k].label + '</option>').join('') + '</select></div>' +
    '<div class="govuk-form-group"><select class="govuk-select" name="cop' + i + '" data-act="cond-op" data-i="' + i + '" aria-label="Operator">' + ops.map((o) => '<option value="' + o[0] + '"' + (o[0] === c.op ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></div>' +
    '<div class="govuk-form-group">' + valCtl + '</div>' +
    '<button type="button" class="govuk-button govuk-button--warning govuk-!-margin-bottom-0" data-act="cond-remove" data-i="' + i + '">Remove</button></div>';
}
function actionEditor(a, i) {
  const f = (k, label, area, hint) => '<div class="govuk-form-group"><label class="govuk-label govuk-label--s" for="a' + k + '-' + i + '">' + label + '</label>' + (hint ? '<div class="govuk-hint">' + hint + '</div>' : '') +
    (area ? '<textarea class="govuk-textarea" id="a' + k + '-' + i + '" name="a' + k + i + '" rows="3">' + esc(a[k]) + '</textarea>' : '<input class="govuk-input" id="a' + k + '-' + i + '" name="a' + k + i + '" value="' + esc(a[k]) + '">') + '</div>';
  const steps = stepItems(a.description);
  const involves = steps.length > 1
    ? '<div class="govuk-form-group"><p class="govuk-label govuk-label--s">What this action involves</p>' + stepList(a.description) + '<input type="hidden" name="adescription' + i + '" value="' + esc(a.description) + '"></div>'
    : f('description', 'What this action involves', true);
  return '<section class="act-edit"><div class="act-edit__head"><h3 class="govuk-heading-s govuk-!-margin-bottom-0">Action ' + (i + 1) + '</h3><button type="button" class="govuk-button govuk-button--warning govuk-!-margin-bottom-0" data-module="govuk-button" data-act="action-remove" data-i="' + i + '">Remove<span class="govuk-visually-hidden"> action ' + (i + 1) + '</span></button></div>' +
    f('title', 'Action') + involves + f('evidence', 'Expected evidence', true, 'What the team should attach or record to show it is done, for example a report, approval or link.') +
    '<div class="govuk-checkboxes govuk-checkboxes--small govuk-form-group" data-module="govuk-checkboxes"><div class="govuk-checkboxes__item"><input class="govuk-checkboxes__input" type="checkbox" id="alegal-' + i + '" name="alegal' + i + '" value="1"' + (a.legal ? ' checked' : '') + '><label class="govuk-label govuk-checkboxes__label" for="alegal-' + i + '">Legal requirement</label></div></div></section>';
}
function depEditor(r, id) {
  const cur = r.dependsOn || [], self = id === 'new' ? null : id;
  const opts = S.rules.filter((x) => x.id !== self && !cur.includes(x.id) && !(self && dependsTransitively(x.id, self))).sort((a, b) => a.id.localeCompare(b.id));
  return '<h2 class="govuk-heading-m">Dependencies</h2><p class="govuk-body">Choose rules that must be completed first. Actions from this rule stay blocked on a piece of work until every action from those rules is complete.</p>' +
    (cur.length ? '<ul class="deplist deplist--edit">' + cur.map((d, i) => '<li>' + ruleChip(d) + ' <span>' + esc((ruleOf(d) || {}).name || d) + '</span><button type="button" class="link-btn" data-act="dep-remove" data-i="' + i + '">Remove<span class="govuk-visually-hidden"> ' + esc(d) + '</span></button></li>').join('') + '</ul>' : '<p class="govuk-hint">This rule does not depend on any other rule.</p>') +
    '<div class="dep-add"><div class="govuk-form-group"><label class="govuk-label" for="depadd">Add a dependency</label><select class="govuk-select" id="depadd" name="depadd"><option value="">Select a rule</option>' + opts.map((x) => '<option value="' + esc(x.id) + '">' + esc(x.id + ' · ' + x.name) + '</option>').join('') + '</select></div><button type="button" class="govuk-button govuk-button--secondary" data-module="govuk-button" data-act="dep-add">Add dependency</button></div>';
}
function vRuleForm(id) {
  if (!ruleDraft || ruleDraft.key !== id) {
    const r = id === 'new' ? { name: '', source: '', owner: '', status: 'Published', changeNote: '', conditions: [{ field: 'type', op: 'is', value: OPT.type[0] }], requirementTitle: '', requirementDescription: '', mandatory: 'Must have', actions: [{ title: '', description: '', evidence: '', legal: false }] } : S.rules.find((x) => x.id === id);
    if (!r) return notFound();
    ruleDraft = { key: id, rule: JSON.parse(JSON.stringify(r)) };
  }
  const r = ruleDraft.rule;
  return '<a href="#/rules" class="govuk-back-link">Back to rules</a>' + errorSummary() + '<h1 class="govuk-heading-xl">' + (id === 'new' ? 'Add rule' : esc(r.name || 'Change rule')) + '</h1>' +
    '<div class="govuk-inset-text">Each save creates a new version. Published versions run against all work, adding or withdrawing requirements.</div>' +
    (r.version ? '<p class="govuk-body">' + tag('Version ' + r.version, 'govuk-tag--blue') + (r.mandatory ? ' ' + tag(r.mandatory, 'govuk-tag--grey') : '') + '</p>' : '') +
    (r.conditionsText ? '<div class="govuk-inset-text"><strong>Original conditions (free text from the source log)</strong><br>' + esc(r.conditionsText).replace(/\n/g, '<br>') + (r.phasesAssumed ? '<br>Delivery phase was blank in the source, so Build was assumed.' : '') + '</div>' : '') +
    '<form id="rule-form" data-id="' + esc(id) + '" novalidate>' +
    text('name', 'name', r.name, 'Rule name') +
    text('source', 'source', r.source, 'Policy, standard or process', {}) +
    '<div class="govuk-form-group"><label class="govuk-label govuk-label--s" for="owner">Rule owner</label><div id="owner-hint" class="govuk-hint">The person or team accountable for keeping this rule up to date.</div><select class="govuk-select" id="owner" name="owner" aria-describedby="owner-hint"><option value="">Unassigned</option>' +
    (r.owner && !OWNER_TYPE(r.owner) ? '<option selected>' + esc(r.owner) + '</option>' : '') + Object.keys(OWNERS).map((g) => '<optgroup label="' + (g === 'Team' ? 'Teams' : 'People') + '">' + OWNERS[g].map((o) => '<option' + (o === r.owner ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</optgroup>').join('') + '</select></div>' +
    '<h2 class="govuk-heading-m">Conditions</h2><p class="govuk-body">All conditions must be true.</p>' +
    (ERR.cond ? '<div class="govuk-form-group govuk-form-group--error">' + errMsg('cond', 'cond') : '<div>') +
    r.conditions.map(condRow).join('') + '</div>' +
    '<button type="button" class="govuk-button govuk-button--secondary" data-module="govuk-button" data-act="cond-add">Add condition</button>' +
    depEditor(r, id) +
    '<h2 class="govuk-heading-m">Requirement returned</h2>' +
    text('requirementTitle', 'rt', r.requirementTitle, 'Requirement title') +
    text('requirementDescription', 'rd', r.requirementDescription, 'Description', { area: true, rows: 3 }) +
    '<h2 class="govuk-heading-m">Actions</h2><p class="govuk-body">Each action is raised for the work, with its own status, evidence and history. Say what it is, what evidence is expected and whether it is a legal requirement.</p>' +
    (ERR.actions ? '<div class="govuk-form-group govuk-form-group--error">' + errMsg('actions', 'atitle-0') : '<div>') + (r.actions || []).map(actionEditor).join('') + '</div>' +
    '<button type="button" class="govuk-button govuk-button--secondary" data-module="govuk-button" data-act="action-add">Add action</button>' +
    radios('status', ['Published', 'Draft', 'Retired'], r.status || 'Published', 'Status') +
    '<p class="govuk-hint">Only published rules run. Draft and retired rules stay in the library but raise no actions.</p>' +
    text('changeNote', 'cn', r.changeNote || '', 'What changed in this version?', { hint: 'Shown in the version history.' }) +
    '<div class="govuk-button-group"><button class="govuk-button" type="submit" data-module="govuk-button" data-prevent-double-click="true">Save as new version</button>' +
    (id === 'new' ? '' : '<a class="govuk-link" href="#/rules/' + id + '/history">Version history</a><a class="govuk-link" href="#/rules/' + id + '/delete">Delete rule</a>') + '</div></form>';
}

function vConfirm(o) {
  return '<a href="' + o.back + '" class="govuk-back-link">Back</a><h1 class="govuk-heading-xl">' + esc(o.title) + '</h1>' +
    '<div class="govuk-warning-text"><span class="govuk-warning-text__icon" aria-hidden="true">!</span><strong class="govuk-warning-text__text"><span class="govuk-visually-hidden">Warning</span>' + esc(o.warning) + '</strong></div>' +
    '<div class="govuk-button-group"><button class="govuk-button govuk-button--warning" data-module="govuk-button" data-act="' + o.act + '" data-id="' + esc(o.id || '') + '">' + esc(o.button) + '</button><a class="govuk-link" href="' + o.back + '">Cancel</a></div>';
}

const BOARD_COLS = [['Not started', 'To do'], ['In progress', 'In progress'], ['Exception', 'Exception'], ['Complete', 'Done']];
function qs() { return new URLSearchParams((location.hash.split('?')[1] || '')); }
function toolbar(base, p, extra) {
  const q = (o) => { const n = new URLSearchParams(p); Object.keys(o).forEach((k) => o[k] ? n.set(k, o[k]) : n.delete(k)); const s = n.toString(); return '#/' + base + (s ? '?' + s : ''); };
  const wsel = '<label class="govuk-visually-hidden" for="wf">Filter by work</label><select class="govuk-select tb-select" id="wf" data-act="filter-work" data-base="' + base + '"><option value="">All work</option>' + S.works.map((w) => '<option value="' + w.id + '"' + (p.get('work') === w.id ? ' selected' : '') + '>' + esc(w.title) + '</option>').join('') + '</select>';
  return '<div class="toolbar">' + (extra ? extra(q) : '') + wsel + '</div>';
}

/* ---------- Shared list helpers ---------- */
const PAGE = 20;
const qhref = (base, p, o) => { const n = new URLSearchParams(p); Object.keys(o).forEach((k) => (o[k] ? n.set(k, o[k]) : n.delete(k))); const s = n.toString(); return '#/' + base + (s ? '?' + s : ''); };
function tabsNav(base, p, key, items, def, label) {
  const cur = p.get(key) || def;
  return '<nav class="seg tabs" aria-label="' + label + '">' + items.map((i) => '<a class="seg-i' + (i[0] === cur ? ' on' : '') + '" href="' + qhref(base, p, { [key]: i[0] === def ? '' : i[0], page: '' }) + '"' + (i[0] === cur ? ' aria-current="true"' : '') + '>' + i[1] + (i[2] != null ? ' <span class="count">' + i[2] + '</span>' : '') + '</a>').join('') + '</nav>';
}
function paged(list, p) {
  const last = Math.max(1, Math.ceil(list.length / PAGE)), cur = Math.min(Math.max(1, Number(p.get('page')) || 1), last);
  return { items: list.slice((cur - 1) * PAGE, cur * PAGE), cur, last, total: list.length, from: list.length ? (cur - 1) * PAGE + 1 : 0, to: Math.min(cur * PAGE, list.length) };
}
const pager = (base, p, pg) => pg.last < 2 ? '' : '<nav class="pager" aria-label="Pagination">' +
  (pg.cur > 1 ? '<a class="govuk-link" href="' + qhref(base, p, { page: pg.cur > 2 ? pg.cur - 1 : '' }) + '">Previous page</a>' : '<span></span>') +
  '<span class="muted">Showing ' + pg.from + ' to ' + pg.to + ' of ' + pg.total + '</span>' +
  (pg.cur < pg.last ? '<a class="govuk-link" href="' + qhref(base, p, { page: pg.cur + 1 }) + '">Next page</a>' : '<span></span>') + '</nav>';
function filterForm(base, p, controls, keep) {
  const f = controls.map((c) => c.type === 'search'
    ? '<div class="fb-search"><label class="govuk-visually-hidden" for="f-' + c.name + '">' + c.label + '</label><input class="govuk-input" id="f-' + c.name + '" name="' + c.name + '" type="search" data-act="rule-filter" value="' + esc(p.get(c.name) || '') + '" placeholder="' + esc(c.ph || c.label) + '"></div>'
    : '<div><label class="govuk-visually-hidden" for="f-' + c.name + '">' + c.label + '</label><select class="govuk-select" id="f-' + c.name + '" name="' + c.name + '" data-act="rule-filter">' +
      c.opts.map((o) => '<option value="' + esc(o[0]) + '"' + (o[0] === (p.get(c.name) || '') ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select></div>').join('');
  const used = controls.some((c) => p.get(c.name));
  return '<form class="filter-bar compact" data-form="rule-filter" data-base="' + base + '" role="search">' + (keep || []).map((k) => p.get(k) ? '<input type="hidden" name="' + k + '" value="' + esc(p.get(k)) + '">' : '').join('') + f +
    '<button class="govuk-visually-hidden" type="submit">Apply filters</button>' + (used ? '<a class="govuk-link" href="' + qhref(base, p, Object.assign({ page: '' }, ...controls.map((c) => ({ [c.name]: '' })))) + '">Clear</a>' : '') + '</form>';
}
const actLegal = (a) => !!actDef(a).legal;
const actPrio = (a) => (a.status === 'Exception' ? 0 : actLegal(a) && isOpen(a) ? 1 : a.status === 'In progress' ? 2 : a.status === 'Not started' ? 3 : 4);
const byPrio = (a, b) => (isBlocked(a) - isBlocked(b)) || actPrio(a) - actPrio(b) || a.id.localeCompare(b.id);
const recordBtn = (a, label) => '<a class="govuk-button govuk-button--secondary btn-sm" role="button" draggable="false" data-module="govuk-button" href="#/actions/' + a.id + '">' + (label || 'Record activity') + '<span class="govuk-visually-hidden"> for ' + esc(a.title) + '</span></a>';
const workLink = (id) => '<a class="govuk-link govuk-link--no-visited-state" href="#/work/' + id + '">' + esc(workName(id)) + '</a>';
const nextAction = (w) => S.actions.filter((a) => a.workId === w.id && isOpen(a)).sort(byPrio)[0];

const DOT = { 'Not started': 'grey', 'In progress': 'blue', 'Exception': 'orange', 'Complete': 'green', 'No longer required': 'grey' };
function qrow(a, showWork, href, sel) {
  const flag = isBlocked(a) ? '<span class="flag flag--grey" title="Waiting for: ' + esc(blockText(a)) + '">Blocked</span>' : a.status === 'Exception' ? '<span class="flag flag--orange">Exception</span>' : a.status === 'Complete' ? (evCount(a) ? '' : '<span class="flag flag--yellow">No evidence</span>') : actLegal(a) ? '<span class="flag flag--red">Legal</span>' : '';
  return '<li class="qrow' + (sel ? ' sel' : '') + '"><span class="dot dot--' + DOT[a.status] + '" aria-hidden="true"></span><div class="qrow-m"><a class="qrow-t govuk-link govuk-link--no-visited-state" href="' + (href || '#/actions/' + a.id) + '"' + (sel ? ' aria-current="true"' : '') + '>' + esc(a.title) + '</a><span class="qrow-s">' + (showWork === false ? '' : esc(workName(a.workId)) + ' · ') + esc(reqTitle(a)) + '</span></div><div class="qrow-r">' + flag + '<button type="button" class="info-btn" data-act="action-info" data-id="' + a.id + '" aria-label="Help for ' + esc(a.title) + '" aria-haspopup="dialog">?</button><span class="qrow-st">' + a.status + '</span></div></li>';
}
function workRow(w, href, sel) {
  const acts = S.actions.filter((a) => a.workId === w.id && isActive(a)), open = acts.filter(isOpen), p = workPct(w.id);
  const legal = open.filter(actLegal).length, exc = acts.filter((a) => a.status === 'Exception').length;
  return '<li class="wrow' + (sel ? ' sel' : '') + '"><div class="wrow-main"><h2 class="wrow-title"><a class="govuk-link govuk-link--no-visited-state" href="' + (href || '#/work/' + w.id) + '"' + (sel ? ' aria-current="true"' : '') + '>' + esc(w.title) + '</a></h2>' +
    '<p class="wrow-desc">' + esc(w.stage) + ' · ' + esc(w.type) + (w.risk === 'High' ? ' · <strong class="red">High risk</strong>' : '') + '</p></div>' +
    '<div class="wrow-prog">' + bar(p, p + '% of actions complete') + '<span class="muted">' + (acts.length - open.length) + ' of ' + acts.length + ' done</span></div>' +
    '<div class="wrow-flags">' + (exc ? '<span class="flag flag--orange">' + exc + ' exception' + (exc === 1 ? '' : 's') + '</span>' : '') + (legal ? '<span class="flag flag--red">' + legal + ' legal</span>' : '') + (!exc && !legal ? '<span class="flag flag--green">On track</span>' : '') + '</div>' +
    '<button type="button" class="link-btn wrow-chg" data-act="cats-open" data-id="' + w.id + '">Change categories<span class="govuk-visually-hidden"> for ' + esc(w.title) + '</span></button></li>';
}

function vWork() {
  if (qs().get('sel')) { location.replace('#/work/' + qs().get('sel')); return ''; }
  const p = qs(), q = (p.get('q') || '').trim().toLowerCase(), st = p.get('stage') || '', pr = p.get('priority') || '', tab = p.get('tab') || 'all';
  const base = S.works.filter((w) => (!q || [w.id, w.title, w.description].join(' ').toLowerCase().includes(q)) && (!st || w.stage === st) && (!pr || w.priority === pr));
  const blocked = (w) => S.actions.some((a) => a.workId === w.id && (a.status === 'Exception' || (isOpen(a) && actLegal(a))));
  const list = base.filter((w) => tab === 'all' || (tab === 'attention' ? blocked(w) : workPct(w.id) < 100)).sort((a, b) => (blocked(b) - blocked(a)) || a.id.localeCompare(b.id));
  const fb = filterForm('work', p, [{ type: 'search', name: 'q', label: 'Search', ph: 'Title, ID or description' },
    { name: 'stage', label: 'Stage', opts: [['', 'All stages']].concat(OPT.stage.map((o) => [o, o])) }, { name: 'priority', label: 'Priority', opts: [['', 'Any priority']].concat(OPT.level.map((o) => [o, o])) }], ['tab']);
  return banner() + pageHead('Work', 'Everything in flight. Change a work item\'s categories and the rules engine updates what applies.', btn('#/work/new', 'Add work')) +
    tabsNav('work', p, 'tab', [['all', 'All work', base.length], ['attention', 'Needs attention', base.filter(blocked).length], ['active', 'In progress', base.filter((w) => workPct(w.id) < 100).length]], 'all', 'Work filter') + fb +
    (list.length ? '<ul class="wlist">' + list.map((w) => workRow(w)).join('') + '</ul>' : '<div class="panel"><p class="govuk-body">No work matches these filters.</p></div>');
}

const ACT_TABS = [['open', 'Open'], ['Not started', 'To do'], ['In progress', 'In progress'], ['Exception', 'Exception'], ['Complete', 'Done'], ['all', 'All']];
function actionListRow(a) {
  return '<tr class="govuk-table__row"><td class="govuk-table__cell"><a class="govuk-link govuk-link--no-visited-state" href="#/actions/' + a.id + '"><strong>' + esc(a.title) + '</strong></a><br><span class="muted">' + a.id + ' · ' + (a.ruleId ? ruleChip(a.ruleId) + ' ' : '') + esc(reqTitle(a)) + '</span></td>' +
    '<td class="govuk-table__cell">' + workLink(a.workId) + '</td><td class="govuk-table__cell">' + (actLegal(a) ? tag('Legal', 'govuk-tag--red') + '<br>' : '') + evBadge(a) + '</td>' +
    '<td class="govuk-table__cell">' + statusTag(a.status) + '</td><td class="govuk-table__cell cell-right">' + (isActive(a) ? recordBtn(a) : '') + '</td></tr>';
}
function vActions() {
  const p = qs(), view = p.get('view') === 'board' ? 'board' : 'list', tab = p.get('tab') || 'open', q = (p.get('q') || '').trim().toLowerCase();
  const base = S.actions.filter((a) => isActive(a) && (!p.get('work') || a.workId === p.get('work')) && (!p.get('legal') || actLegal(a)) && (p.get('ev') !== 'none' || !evCount(a)) &&
    (!q || [a.id, a.title, reqTitle(a), workName(a.workId)].join(' ').toLowerCase().includes(q)));
  const inTab = (a, t) => t === 'all' || (t === 'open' ? isOpen(a) : a.status === t);
  const seg = '<div class="seg" role="group" aria-label="View"><a class="seg-i' + (view === 'list' ? ' on' : '') + '" href="' + qhref('actions', p, { view: '', page: '' }) + '">List</a><a class="seg-i' + (view === 'board' ? ' on' : '') + '" href="' + qhref('actions', p, { view: 'board', page: '', tab: '' }) + '">Board</a></div>';
  const fb = filterForm('actions', p, [{ type: 'search', name: 'q', label: 'Search', ph: 'Action, requirement or work' },
    { name: 'work', label: 'Work', opts: [['', 'All work']].concat(S.works.map((w) => [w.id, w.title])) },
    { name: 'legal', label: 'Legal', opts: [['', 'Any requirement'], ['1', 'Legal only']] }, { name: 'ev', label: 'Evidence', opts: [['', 'Any evidence'], ['none', 'No evidence yet']] }], ['view', 'tab']);
  let body;
  if (view === 'board') {
    body = '<div class="board">' + BOARD_COLS.map((c) => {
      const items = base.filter((a) => a.status === c[0]).sort(byPrio);
      return '<section class="col" data-status="' + c[0] + '" aria-label="' + c[1] + '"><h2 class="col-head"><span>' + c[1] + '</span><span class="count">' + items.length + '</span></h2><div class="col-body">' +
        (items.map(actionCard).join('') || '<p class="col-empty">Nothing here</p>') + '</div></section>';
    }).join('') + '</div><p class="govuk-hint">Drag a card to another column to change its status. To add evidence or a note, use Record activity.</p>';
  } else {
    const list = base.filter((a) => inTab(a, tab)).sort(byPrio), pg = paged(list, p);
    body = tabsNav('actions', p, 'tab', ACT_TABS.map((t) => [t[0], t[1], base.filter((a) => inTab(a, t[0])).length]), 'open', 'Action status') +
      (() => {
        const selA = list.find((a) => a.id === p.get('sel')) || pg.items[0];
        const lst = pg.items.length ? '<ul class="qlist">' + pg.items.map((a) => qrow(a, true, qhref('actions', p, { sel: a.id }), selA && a.id === selA.id)).join('') + '</ul>' + pager('actions', p, pg) : '<div class="panel"><p class="govuk-body">No actions match these filters.</p></div>';
        return '<div class="split"><div class="split-list">' + lst + '</div>' + (selA ? actionPane(selA) : '') + '</div>';
      })();
  }
  return banner() + pageHead('Actions', 'Every requirement the rules engine has raised. Exceptions and legal requirements come first.', seg) + fb + body;
}

function workPane(w) {
  const acts = S.actions.filter((a) => a.workId === w.id && isActive(a)), open = acts.filter(isOpen).sort(byPrio), pc = workPct(w.id), legal = open.filter(actLegal).length;
  return '<aside class="pane" aria-label="Work details"><p class="pane-k">' + esc(w.id) + ' · ' + esc(w.type) + ' · ' + esc(w.stage) + '</p><h2 class="pane-t">' + esc(w.title) + '</h2>' +
    '<p class="pane-tags">' + prioTag(w.priority) + (legal ? '<span class="flag flag--red">' + legal + ' legal open</span>' : '') + '</p>' +
    '<p class="pane-p">' + esc(w.description) + '</p>' +
    '<div class="govuk-button-group"><a class="govuk-button" role="button" draggable="false" href="#/work/' + w.id + '">Open work</a><button type="button" class="govuk-button govuk-button--secondary" data-module="govuk-button" data-act="cats-open" data-id="' + w.id + '">Change categories</button></div>' +
    '<h3 class="pane-h">Progress</h3>' + bar(pc, pc + '% complete') + '<p class="pane-p muted">' + (acts.length - open.length) + ' of ' + acts.length + ' actions done</p>' +
    '<h3 class="pane-h">Do next</h3>' + (open.length ? '<ul class="qlist">' + open.slice(0, 4).map((a) => qrow(a, false)).join('') + '</ul>' : '<p class="pane-p muted">Nothing left to do.</p>') + '</aside>';
}
function actionPane(a) {
  const df = actDef(a), r = ruleOf(a.ruleId), w = S.works.find((x) => x.id === a.workId), recent = a.updates.slice().reverse().slice(0, 4);
  return '<aside class="pane" aria-label="Action details"><p class="pane-k">' + esc(a.id) + ' · <a class="govuk-link" href="#/work/' + a.workId + '">' + esc(workName(a.workId)) + '</a></p>' +
    '<h2 class="pane-t">' + esc(a.title) + '</h2><p class="pane-tags">' + statusTag(a.status) + ' ' + legalTag(df) + '</p>' +
    (isActive(a) ? '<div class="govuk-button-group"><button type="button" class="govuk-button" data-module="govuk-button" data-act="activity-open" data-id="' + a.id + '" data-type="evidence">Add evidence</button><a class="govuk-button govuk-button--secondary" role="button" draggable="false" href="#/actions/' + a.id + '">Open full page</a></div>' : '') +
    '<h3 class="pane-h">What this involves</h3><p class="pane-p">' + (df.description ? esc(df.description) : '<span class="muted">Not yet described.</span>') + '</p>' +
    '<h3 class="pane-h">Expected evidence</h3><p class="pane-p">' + (df.evidence ? esc(df.evidence) : '<span class="muted">Not yet defined.</span>') + '</p>' +
    '<h3 class="pane-h">Requirement</h3><p class="pane-p">' + (r ? esc(r.requirementTitle) + '<br><span class="muted">' + esc(r.source) + '</span> ' + ruleChip(r.id) : 'Not linked to a rule.') + (w ? '<br><span class="muted">' + esc(w.stage) + '</span>' : '') + '</p>' +
    '<h3 class="pane-h">Recent activity</h3>' + (recent.length ? '<ul class="pane-log">' + recent.map((u) => '<li><strong>' + esc(u.type) + '</strong> <span class="muted">' + fmt(u.at) + '</span><br>' + esc(u.text || u.link || '') + '</li>').join('') + '</ul>' : '<p class="pane-p muted">Nothing recorded yet.</p>') + '</aside>';
}

function trow(a) {
  const blocked = isBlocked(a), d = actDef(a), ev = evCount(a);
  return '<li class="trow' + (blocked ? ' trow--blocked' : '') + '"><span class="dot dot--' + DOT[a.status] + '" aria-hidden="true"></span>' +
    '<div class="trow-m"><a class="trow-t govuk-link govuk-link--no-visited-state" href="#/actions/' + a.id + '">' + esc(a.title) + '</a><span class="trow-s">' + esc(reqTitle(a)) + (blocked ? ' · <strong>Waiting for ' + esc(blockText(a)) + '</strong>' : '') + '</span></div>' +
    '<div class="trow-i">' + (a.ruleId ? ruleChip(a.ruleId) : '') + (actLegal(a) ? '<span class="flag flag--red">Legal</span>' : '') + blockTag(a) + '</div>' +
    '<div class="trow-e">' + (ev ? '<span class="ev ev--yes">' + ev + ' evidence</span>' : '<span class="ev">No evidence</span>') + '</div>' +
    '<div class="trow-st">' + statusTag(a.status) + '</div>' +
    '<a class="trow-go govuk-link" href="#/actions/' + a.id + '">' + (a.status === 'Complete' ? 'View' : a.status === 'Not started' ? 'Start' : 'Continue') + '<span class="govuk-visually-hidden"> ' + esc(a.title) + '</span></a></li>';
}
function vTasks() {
  const p = qs(), show = p.get('show') || 'open', wf = p.get('work') || '';
  const list = S.actions.filter((a) => isActive(a) && (!wf || a.workId === wf) && (show === 'all' || isOpen(a))).sort(byPrio);
  const works = S.works.filter((w) => list.some((a) => a.workId === w.id));
  const html = works.map((w) => {
    const l = list.filter((a) => a.workId === w.id), pc = workPct(w.id), nb = l.filter(isBlocked).length;
    return '<section class="tgroup"><div class="tgroup-head"><div><h2 class="tgroup-t"><a class="govuk-link govuk-link--no-visited-state" href="#/work/' + w.id + '">' + esc(w.title) + '</a></h2><p class="tgroup-s">' + esc(w.stage) + ' · ' + esc(w.type) + (w.risk === 'High' ? ' · <strong class="red">High risk</strong>' : '') + '</p></div>' +
      '<div class="tgroup-p">' + bar(pc, pc + '% complete') + '<span class="muted">' + pc + '% complete · ' + l.length + (show === 'all' ? ' actions' : ' to do') + (nb ? ' · ' + nb + ' blocked' : '') + '</span></div></div>' +
      '<ul class="trows">' + l.map(trow).join('') + '</ul></section>';
  }).join('');
  return banner() + pageHead('Tasks', 'What to do next, grouped by work. Open an action to record activity and evidence.') +
    '<div class="toolbar">' + tabsNav('tasks', p, 'show', [['open', 'To do', S.actions.filter((a) => isOpen(a) && (!wf || a.workId === wf)).length], ['all', 'Everything']], 'open', 'Tasks') +
    '<label class="govuk-visually-hidden" for="wf">Filter by work</label><select class="govuk-select tb-select" id="wf" data-act="filter-work" data-base="tasks"><option value="">All work</option>' + S.works.map((w) => '<option value="' + w.id + '"' + (wf === w.id ? ' selected' : '') + '>' + esc(w.title) + '</option>').join('') + '</select></div>' +
    (html || '<div class="panel"><p class="govuk-body">Nothing to do. Every action is complete.</p></div>');
}

function vDashboard() {
  const act = S.actions.filter(isActive), open = act.filter(isOpen), done = act.length - open.length, pct = act.length ? Math.round(done / act.length * 100) : 0;
  const cnt = (st) => act.filter((a) => a.status === st).length;
  const exc = cnt('Exception'), legal = open.filter(actLegal).length, noEv = act.filter((a) => a.status === 'Complete' && !evCount(a)).length;
  const next = act.filter(isOpen).sort(byPrio).slice(0, 6);
  const kpi = (n, l, href, cls) => '<a class="kpi ' + (cls || '') + '" href="' + href + '"><span class="kpi-n">' + n + '</span><span class="kpi-l">' + l + '</span></a>';
  const seg = (n, cls, l) => n ? '<span class="sbar-s sbar-s--' + cls + '" style="flex:' + n + '" title="' + l + ': ' + n + '"></span>' : '';
  const leg = (n, cls, l) => '<li><span class="dot dot--' + cls + '"></span>' + l + ' <strong>' + n + '</strong></li>';
  const brief = (t) => '<li class="tbrief"><a class="govuk-link" href="#/work/' + t.workId + '">' + esc(workName(t.workId)) + '</a><br><span class="muted">' + esc(t.event) + ' · ' + t.added.length + ' new action' + (t.added.length === 1 ? '' : 's') + ' · ' + fmt(t.at) + '</span></li>';
  return banner() + pageHead('Overview', 'Where your work stands, and what to do next.', btn('#/work/new', 'Add work')) +
    '<div class="kpis"><div class="kpi kpi--ring"><div class="ring" style="--p:' + pct + '"><span>' + pct + '%</span></div><span class="kpi-l">' + done + ' of ' + act.length + ' actions done</span></div>' +
    kpi(exc + legal, 'Need action now', '#/actions', exc + legal ? 'kpi--red' : '') + kpi(cnt('In progress'), 'In progress', '#/actions?tab=In%20progress', 'kpi--blue') + kpi(noEv, 'Done without evidence', '#/actions?tab=Complete&ev=none', noEv ? 'kpi--amber' : 'kpi--green') + '</div>' +
    '<section class="panel"><div class="sbar">' + seg(cnt('Not started'), 'grey', 'To do') + seg(cnt('In progress'), 'blue', 'In progress') + seg(exc, 'orange', 'Exception') + seg(cnt('Complete'), 'green', 'Done') + '</div>' +
    '<ul class="legend">' + leg(cnt('Not started'), 'grey', 'To do') + leg(cnt('In progress'), 'blue', 'In progress') + leg(exc, 'orange', 'Exception') + leg(cnt('Complete'), 'green', 'Done') + '</ul></section>' +
    '<div class="two-col"><section><div class="sec-head"><h2 class="govuk-heading-m">Do next</h2><a class="govuk-link" href="#/actions">All actions</a></div>' +
    (next.length ? '<ul class="qlist">' + next.map((a) => qrow(a)).join('') + '</ul>' : '<div class="panel"><p class="govuk-body">All caught up.</p></div>') + '</section>' +
    '<section><div class="sec-head"><h2 class="govuk-heading-m">Your work</h2><a class="govuk-link" href="#/work">All work</a></div><ul class="wlist wlist--side">' + S.works.map(workRow).join('') + '</ul>' +
    '<div class="sec-head"><h2 class="govuk-heading-s">Recent rules engine runs</h2><a class="govuk-link" href="#/triggers?tab=log">Log</a></div>' + (S.triggers.length ? '<ul class="tasklist">' + S.triggers.slice(0, 3).map(brief).join('') + '</ul>' : '<p class="govuk-body muted">None yet.</p>') + '</section></div>';
}

function vTriggers() {
  const p = qs(), tab = p.get('tab') || 'defs';
  const defRows = S.triggerDefs.map((d) => {
    const n = S.triggers.filter((t) => (t.defId || '').split(', ').includes(d.id)).length;
    return ['<a class="govuk-link" href="#/triggers/' + d.id + '"><strong>' + esc(d.name) + '</strong></a><br><span class="muted">' + d.id + '</span>', esc(EVENT_LABEL[d.event]),
      d.event === 'changed' ? d.fields.map((f) => esc(FIELDS[f].label)).join(', ') : '<span class="muted">Not applicable</span>', n + ' time' + (n === 1 ? '' : 's'),
      '<div class="govuk-checkboxes govuk-checkboxes--small"><div class="govuk-checkboxes__item"><input class="govuk-checkboxes__input" type="checkbox" id="td-' + d.id + '" data-act="trigdef-toggle" data-id="' + d.id + '"' + (d.enabled ? ' checked' : '') + '><label class="govuk-label govuk-checkboxes__label" for="td-' + d.id + '">Enabled<span class="govuk-visually-hidden"> ' + esc(d.name) + '</span></label></div></div>'];
  });
  let body;
  if (tab === 'log') {
    const pg = paged(S.triggers, p);
    body = (pg.items.length ? triggerList(pg.items) + pager('triggers', p, pg) : '<div class="panel"><p class="govuk-body">No triggers raised yet.</p></div>');
  } else {
    body = table(['Trigger', 'Raised when', 'Watches', 'Raised', 'Status'], defRows) +
      '<section class="panel"><h2 class="govuk-heading-s">Run the rules engine now</h2><p class="govuk-body-s muted">Re-check a work item against every published rule, for example after a rule has changed.</p><form data-form="raise" class="filter-bar"><div class="govuk-form-group"><label class="govuk-label govuk-label--s" for="raise-work">Work item</label><select class="govuk-select" id="raise-work" name="work">' +
      S.works.map((w) => '<option value="' + w.id + '">' + esc(w.title) + '</option>').join('') + '</select></div><div class="govuk-form-group filter-bar__actions"><button class="govuk-button" data-module="govuk-button" type="submit">Check this work</button> <button class="govuk-button govuk-button--secondary" data-module="govuk-button" type="button" data-act="rerun-all">Check all work</button></div></form></section>' +
      '<details class="govuk-details"><summary class="govuk-details__summary"><span class="govuk-details__summary-text">How the rules engine works</span></summary><div class="govuk-details__text">' + flowDiagram(1) + '</div></details>';
  }
  return banner() + pageHead('Triggers', 'A trigger decides when the rules engine runs. Each enabled trigger that matches a change runs the engine.', btn('#/triggers/new', 'Add trigger')) +
    tabsNav('triggers', p, 'tab', [['defs', 'Definitions', S.triggerDefs.length], ['log', 'Log', S.triggers.length]], 'defs', 'Triggers') + body;
}

function notFound() { return '<h1 class="govuk-heading-l">Page not found</h1><p class="govuk-body"><a class="govuk-link" href="#/work">Go to work</a></p>'; }

/* ---------- Router ---------- */
function render(keep) {
  const h = location.hash.replace(/^#\/?/, '').split('?')[0].split('/');
  const [a, b, c] = h;
  let html, nav = a || 'dashboard';
  if (!a || a === 'dashboard') html = vDashboard();
  else if (a === 'tasks') html = vTasks();
  else if (a === 'work') html = !b ? vWork() : c === 'categories' ? vWorkCats(b) : c === 'edit' ? vWorkForm(b) : b === 'new' ? vWorkForm('new') : vWorkDetail(b);
  else if (a === 'triggers') html = !b ? vTriggers() : vTriggerForm(b);
  else if (a === 'api') html = vApi();
  else if (a === 'rules') {
    if (!b) ruleDraft = null;
    html = !b ? vRules() : c === 'history' ? vRuleHistory(b) : c === 'delete' ? vConfirm({ title: 'Are you sure you want to delete this rule?', warning: 'Actions this rule raised that are not complete will be marked as no longer required.', button: 'Delete rule', act: 'rule-delete', id: b, back: '#/rules/' + b }) : vRuleForm(b);
  }
  else if (a === 'actions') html = !b ? vActions() : vActionDetail(b);
  else if (a === 'reset') html = vConfirm({ title: 'Are you sure you want to reset the demo data?', warning: 'All work, rules, actions, evidence and trigger history will be replaced with the demo set.', button: 'Reset demo data', act: 'reset', back: '#/work' });
  else html = notFound();
  const main = document.getElementById('main-content');
  main.innerHTML = html;
  document.querySelectorAll('[data-nav]').forEach((li) => {
    const on = li.dataset.nav === nav, link = li.firstElementChild;
    li.classList.toggle('on', on);
    const cnt = { actions: S.actions.filter((x) => isActive(x) && isOpen(x)).length, work: S.works.length }[li.dataset.nav];
    let nc = link.querySelector('.nav-count'); if (cnt != null) { if (!nc) { nc = document.createElement('span'); nc.className = 'nav-count'; link.appendChild(nc); } nc.textContent = cnt; }
    if (on) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
  const cr = document.getElementById('crumbs');
  if (cr) {
    const sec = { dashboard: 'Dashboard', work: 'Work', actions: 'Actions', tasks: 'Tasks', triggers: 'Triggers', rules: 'Rules', api: 'API' }, parts = location.hash.replace(/^#\//, '').split('?')[0].split('/').filter(Boolean), li = (t, h) => '<li class="govuk-breadcrumbs__list-item">' + (h ? '<a class="govuk-breadcrumbs__link" href="' + h + '">' + t + '</a>' : t) + '</li>';
    cr.innerHTML = '<ol class="govuk-breadcrumbs__list">' + li('Rules engine', '#/dashboard') + (parts[0] && sec[parts[0]] ? li(sec[parts[0]], parts[1] ? '#/' + parts[0] : '') : '') + (parts[1] ? li(esc(parts[1])) : '') + '</ol>';
  }
  const h1 = main.querySelector('h1');
  document.title = (hasErr() ? 'Error: ' : '') + (h1 ? h1.textContent : 'Rules engine') + ' - Rules engine';
  if (!keep) window.scrollTo(0, 0);
  if (window.govukInit) window.govukInit(main);
}
// Navigate and render exactly once (hashchange renders when the hash differs).
function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
function rerender() { render(true); }


/* ---------- Events ---------- */
function formData(form) {
  const d = {};
  new FormData(form).forEach((v, k) => { if (d[k] === undefined) d[k] = v; else d[k] = [].concat(d[k], v); });
  return d;
}

// The enabled trigger definitions that fire for a work creation or a set of category changes (null if none).
function firingDef(changes, isNew) {
  const defs = S.triggerDefs.filter((d) => d.enabled && (isNew ? d.event === 'created' : d.event === 'changed' && changes.some((c) => d.fields.includes(c.field))));
  return defs.length ? { id: defs.map((d) => d.id).join(', '), name: defs.map((d) => d.name).join(' + ') } : null;
}
function saveWork(form) {
  const d = formData(form), id = form.dataset.id, isNew = id === 'new';
  const next = { title: (d.title || '').trim(), description: d.description || '', demand: d.demand || '', type: d.type || '', stage: d.stage || '',
    characteristics: arr(d.characteristics), channel: arr(d.channel), users: arr(d.users), transactional: d.transactional || 'No',
    estTransactions: (d.estTransactions || '').trim(), personalData: d.personalData || 'No', priority: d.priority || '', risk: d.risk || '' };
  ERR = {};
  if (!next.title) fail('title', 'Enter a title');
  if (!next.demand) fail('demand', 'Select where the work came from');
  if (!next.type) fail('type', 'Select a type of work');
  if (!next.stage) fail('stage', 'Select a stage');
  if (next.estTransactions && !/^\d+$/.test(next.estTransactions)) fail('estTransactions', 'Estimated transactions must be a whole number, like 250000', 'est');
  if (next.transactional === 'Yes' && !next.estTransactions && !ERR.estTransactions) fail('estTransactions', 'Enter the estimated transactions per year for a transactional service', 'est');
  if (hasErr()) { workDraft = { key: id, data: next }; rerender(); return; }
  workDraft = null;
  let w, changes, event;
  if (isNew) {
    w = Object.assign({ id: uid('WRK'), created: now() }, next); S.works.push(w); changes = []; event = 'Work created';
  } else {
    w = S.works.find((x) => x.id === id); changes = diffWork(w, next); Object.assign(w, next); event = changes.length ? 'Categorisation changed' : 'Work updated (no categorisation change)';
  }
  const note = isNew ? 'Initial categorisation.' : 'Triggered by categorisation change.';
  const def = firingDef(isNew ? null : changes, isNew);
  const empty = { added: [], withdrawn: [], reinstated: [], fired: [] };
  const result = def ? runEngine(w, note) : empty;
  if (def) recordTrigger(w, event, changes, result, def);
  else if (changes.length) recordTrigger(w, 'Categorisation changed, but no enabled trigger watches these fields', changes, empty, null);
  save();
  const li = (arr2, label) => arr2.length ? '<li>' + label + ': ' + arr2.map((a) => '<a class="govuk-notification-banner__link" href="#/actions/' + a.id + '">' + esc(a.title) + '</a>').join(', ') + '</li>' : '';
  flash = { title: 'Success', html: '<p class="govuk-notification-banner__heading">' + (changes.length && !def ? 'Categories saved. No enabled trigger watches the fields you changed, so the rules engine did not run.' : changes.length ? changes.length + ' categorisation change' + (changes.length > 1 ? 's' : '') + ' triggered the rules engine (' + esc(def.name) + ').' : (isNew ? 'Work added and the rules engine ran.' : 'Work saved. No categorisation changes, so the rules engine did not need to run.')) + '</p><ul class="govuk-list govuk-list--bullet">' +
    (li(result.added, 'New requirements') + li(result.reinstated, 'Reinstated') + li(result.withdrawn, 'No longer required') || '<li>No requirement changes.</li>') + '</ul>' };
  go('#/work/' + w.id);
}

function readRuleDraft(form) {
  const d = formData(form), r = ruleDraft.rule;
  r.name = d.name || ''; r.source = d.source || ''; r.owner = d.owner || ''; r.requirementTitle = d.requirementTitle || ''; r.requirementDescription = d.requirementDescription || '';
  r.actions = r.actions.map((a, i) => ({ title: (d['atitle' + i] || '').trim(), description: (d['adescription' + i] || '').trim(), evidence: (d['aevidence' + i] || '').trim(), legal: !!d['alegal' + i] })); r.status = d.status || 'Published'; r.enabled = r.status === 'Published'; r.changeNote = d.changeNote || '';
  r.conditions = r.conditions.map((c, i) => ({ field: d['cfield' + i], op: d['cop' + i], value: d['cop' + i] === 'in' ? arr(d['cval' + i]) : (Array.isArray(d['cval' + i]) ? d['cval' + i][0] : d['cval' + i]) }));
}

function saveRule(form) {
  readRuleDraft(form);
  const id = form.dataset.id, r = ruleDraft.rule;
  ERR = {};
  if (!r.name.trim()) fail('name', 'Enter a rule name');
  if (!r.conditions.length) fail('cond', 'Add at least one condition', 'cond-add');
  else { const i = r.conditions.findIndex((c) => c.value === '' || c.value == null || (Array.isArray(c.value) && !c.value.length)); if (i >= 0) fail('cond', 'Enter a value for every condition', 'cval-' + i); }
  if (!r.actions.length || r.actions.some((a) => !a.title)) fail('actions', r.actions.length ? 'Enter a name for every action' : 'Add at least one action', r.actions.length ? 'atitle-' + r.actions.findIndex((a) => !a.title) : 'action-add');
  if (id !== 'new' && (r.dependsOn || []).some((d) => dependsTransitively(d, id))) fail('deps', 'A rule cannot depend on itself, directly or through other rules');
  if (!r.requirementTitle.trim()) fail('requirementTitle', 'Enter a requirement title', 'rt');
  if (!r.changeNote.trim()) fail('changeNote', 'Enter a note describing what changed in this version', 'cn');
  if (hasErr()) { rerender(); return; }
  let saved;
  r.status = r.status || 'Published'; r.enabled = r.status === 'Published';
  if (id === 'new') { saved = normRule(Object.assign({ id: uid('RUL'), version: 1, versions: [{}] }, r)); saved.versions = []; S.rules.push(saved); }
  else { saved = S.rules.find((x) => x.id === id); Object.assign(saved, r); saved.version = (saved.version || 1) + 1; }
  saved.tasks = saved.actions.map((a) => a.title);
  saved.versions.push({ v: saved.version, at: now(), by: 'You', note: r.changeNote.trim(), snap: snapOf(saved) });
  // Existing actions keep their own history; newly added rule actions are raised on the re-run below.
  const added = [], withdrawn = [];
  const rdef = S.triggerDefs.find((d) => d.enabled && d.event === 'rule');
  if (rdef) S.works.forEach((w) => {
    const res = runEngine(w, 'Rule ' + saved.id + ' v' + saved.version + ' was ' + (id === 'new' ? 'added' : 'published') + '.');
    if (res.added.length || res.withdrawn.length || res.reinstated.length) { recordTrigger(w, 'Rule ' + (id === 'new' ? 'added' : 'changed') + ': ' + saved.name + ' (v' + saved.version + ')', [], res, rdef); added.push(...res.added, ...res.reinstated); withdrawn.push(...res.withdrawn); }
  });
  save(); ruleDraft = null;
  flash = { title: 'Success', html: '<p class="govuk-notification-banner__heading">Rule saved as version ' + saved.version + '. ' + added.length + ' requirement' + (added.length === 1 ? '' : 's') + ' added or reinstated, ' + withdrawn.length + ' withdrawn.</p>' };
  go('#/rules');
}

document.addEventListener('submit', (e) => {
  const f = e.target; e.preventDefault();
  if (f.id === 'work-form') saveWork(f);
  else if (f.id === 'rule-form') saveRule(f);
  else if (f.dataset.form === 'action') {
    const rid = f.dataset.rule, fid = 'newaction-' + rid, title = (formData(f).newaction || '').trim(); ERR = {};
    if (!title) { fail(fid, 'Enter an action', fid); rerender(); return; }
    const rule = ruleOf(rid), a = { id: uid('ACT'), workId: f.dataset.work, ruleId: rid, title, status: 'Not started', created: now(), custom: true,
      updates: [{ at: now(), type: 'system', text: 'Action added manually to ' + (rule ? rule.requirementTitle : 'requirement') + '.' }] };
    S.actions.push(a); save();
    flash = { title: 'Success', html: '<p class="govuk-notification-banner__heading">Action added.</p>' }; rerender();
  } else if (f.id === 'update-form') {
    const a = S.actions.find((x) => x.id === f.dataset.id), d = formData(f);
    const type = d.type.toLowerCase(), body = (d.text || '').trim(); ERR = {};
    if (!body && d.status === a.status) fail('text', 'Enter details of the update or change the status', 'utext');
    else if (!body && type !== 'note') fail('text', 'Enter details of the ' + type, 'utext');
    if (d.link && !/^https?:\/\/\S+$/i.test(d.link.trim())) fail('link', 'Enter a link that starts with http:// or https://', 'ulink');
    if (hasErr()) { rerender(); return; }
    if (body) a.updates.push({ at: now(), type, text: body, link: (d.link || '').trim() });
    if (d.status !== a.status) { a.updates.push({ at: now(), type: 'system', text: 'Status changed from ' + a.status + ' to ' + d.status + '.' }); a.status = d.status; }
    save(); flash = { title: 'Success', html: '<p class="govuk-notification-banner__heading">Your update has been recorded.</p>' }; rerender();
  }
});

function applyRuleFilter(form) {
  const p = new URLSearchParams(); new FormData(form).forEach((v, k) => { if (v && !(k === 'sort' && v === 'id')) p.set(k, v); });
  const q = p.toString(); go('#/' + (form.dataset.base || 'rules') + (q ? '?' + q : ''));
}
document.addEventListener('submit', (e) => { if (e.target.dataset && e.target.dataset.form === 'rule-filter') { e.preventDefault(); applyRuleFilter(e.target); } });
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset && t.dataset.act === 'flow-yn') { const x = t.closest('.govuk-form-group').querySelector('.fx'); if (x) x.hidden = t.value !== 'Yes'; }
  if (t.dataset.act === 'rule-filter') { applyRuleFilter(t.form); return; }
  if (t.dataset.act === 'move') moveAction(t.dataset.id, t.value);
  else if (t.dataset.act === 'filter-work') { const p = qs(); if (t.value) p.set('work', t.value); else p.delete('work'); const q = p.toString(); go('#/' + t.dataset.base + (q ? '?' + q : '')); }
  else if (t.dataset.act === 'task') moveAction(t.dataset.id, t.checked ? 'Complete' : 'In progress');
  else if (t.dataset.act === 'cond-field') {
    const form = t.closest('form'); readRuleDraft(form);
    const c = ruleDraft.rule.conditions[Number(t.dataset.i)], f = FIELDS[c.field];
    c.op = OPS[f.kind][0][0]; c.value = f.kind === 'number' ? '' : f.options[0];
    ERR = {}; rerender();
  } else if (t.dataset.act === 'cond-op') {
    readRuleDraft(t.closest('form'));
    const c = ruleDraft.rule.conditions[Number(t.dataset.i)], f = FIELDS[c.field];
    c.value = c.op === 'in' ? [] : f.options[0];
    ERR = {}; rerender();
  } else if (t.dataset.act === 'trigdef-toggle') { const d = S.triggerDefs.find((x) => x.id === t.dataset.id); if (d) { d.enabled = t.checked; save(); rerender(); } }
  else if (t.form && t.form.dataset.mode === 'cats') previewCats(t.form);
});

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-act]'); if (!t) return;
  const act = t.dataset.act;
  if (act === 'rule-info') ruleInfo(t.dataset.id);
  else if (act === 'action-info') actionInfo(t.dataset.id);
  else if (act === 'dialog-close') closeDialog();
  else if (act === 'focus-field') { e.preventDefault(); const el = document.getElementById(t.dataset.field); if (el) { el.scrollIntoView({ block: 'center' }); el.focus(); } }
  else if (act === 'dep-add') { const fm = t.closest('form'); readRuleDraft(fm); const v = fm.elements.depadd.value, rd = ruleDraft.rule; if (v && !(rd.dependsOn || []).includes(v)) { rd.dependsOn = (rd.dependsOn || []).concat(v); } ERR = {}; rerender(); }
  else if (act === 'dep-remove') { readRuleDraft(t.closest('form')); ruleDraft.rule.dependsOn.splice(Number(t.dataset.i), 1); ERR = {}; rerender(); }
  else if (act === 'cond-add') { readRuleDraft(t.closest('form')); ruleDraft.rule.conditions.push({ field: 'type', op: 'is', value: OPT.type[0] }); ERR = {}; rerender(); }
  else if (act === 'action-add') { readRuleDraft(t.closest('form')); ruleDraft.rule.actions.push({ title: '', description: '', evidence: '', legal: false }); ERR = {}; rerender(); }
  else if (act === 'action-remove') { readRuleDraft(t.closest('form')); ruleDraft.rule.actions.splice(Number(t.dataset.i), 1); ERR = {}; rerender(); }
  else if (act === 'cond-remove') { readRuleDraft(t.closest('form')); ruleDraft.rule.conditions.splice(Number(t.dataset.i), 1); ERR = {}; rerender(); }
  else if (act === 'rule-delete') {
    S.rules = S.rules.filter((r) => r.id !== t.dataset.id);
    S.works.forEach((w) => { const res = runEngine(w, 'Rule ' + t.dataset.id + ' was deleted.'); if (res.withdrawn.length) recordTrigger(w, 'Rule deleted: ' + t.dataset.id, [], res); });
    save(); ruleDraft = null;
    flash = { title: 'Success', html: '<p class="govuk-notification-banner__heading">Rule ' + esc(t.dataset.id) + ' deleted.</p>' };
    go('#/rules');
  } else if (act === 'rerun-all') {
    let n = 0;
    S.works.forEach((w) => { const res = runEngine(w, 'Manual re-run.'); if (res.added.length || res.withdrawn.length || res.reinstated.length) { recordTrigger(w, 'Manual re-run', [], res); n++; } });
    save();
    flash = { title: 'Success', html: '<p class="govuk-notification-banner__heading">' + (n ? 'Rules re-run. Requirements changed for ' + n + ' work item' + (n === 1 ? '' : 's') + '.' : 'Rules re-run. No requirement changes.') + '</p>' };
    rerender();
  } else if (act === 'reset') {
    localStorage.removeItem(KEY); S = seed(); workDraft = null; ruleDraft = null;
    flash = { title: 'Success', html: '<p class="govuk-notification-banner__heading">Demo data restored.</p>' };
    go('#/dashboard');
  }
});

function ruleInfo(id) {
  const r = S.rules.find((x) => x.id === id), d = document.getElementById('rule-dialog'); if (!r || !d) return;
  const apps = S.works.filter((w) => ruleMatches(w, r));
  d.className = 'rule-dialog'; d.innerHTML = '<div class="dlg-head"><div><span class="rule-chip rule-chip--static">' + esc(r.id) + '</span> ' + statusRule(r) + ' ' + tag('Version ' + r.version, 'govuk-tag--blue') +
    '<h2 class="govuk-heading-l" id="rule-dialog-title">' + esc(r.name) + '</h2><p class="govuk-body-s">Source: ' + esc(r.source) + '<br>Owner: ' + (r.owner ? esc(r.owner) + ' (' + (OWNER_TYPE(r.owner) || 'owner').toLowerCase() + ')' : 'Unassigned') + '</p></div><button type="button" class="dlg-x" data-act="dialog-close" aria-label="Close">&times;</button></div>' +
    '<h3 class="govuk-heading-s">When</h3><ul class="govuk-list govuk-list--bullet">' + r.conditions.map((c) => '<li>' + esc(condText(c)) + '</li>').join('') + '</ul>' +
    ((depsOf(r).length || requiredBy(r.id).length) ? '<h3 class="govuk-heading-s">Dependencies</h3>' + depList(r) : '') +
    '<h3 class="govuk-heading-s">Requirement returned</h3><p class="govuk-body"><strong>' + esc(r.requirementTitle) + '</strong><br>' + esc(r.requirementDescription || '') + '</p>' +
    (r.actions.length ? '<h3 class="govuk-heading-s">Actions raised</h3>' + actionDefList(r) : '') +
    '<h3 class="govuk-heading-s">Currently applies to</h3>' + (apps.length ? '<ul class="govuk-list">' + apps.map((w) => '<li><a class="govuk-link" href="#/work/' + w.id + '" data-act="dialog-close">' + esc(w.title) + '</a></li>').join('') + '</ul>' : '<p class="govuk-body">No work items.</p>') +
    '<div class="govuk-button-group"><a class="govuk-button" role="button" draggable="false" href="#/rules/' + r.id + '" data-act="dialog-close">Edit rule</a><button type="button" class="govuk-button govuk-button--secondary" data-act="dialog-close">Close</button></div>';
  if (d.showModal) d.showModal(); else d.setAttribute('open', '');
}
function actionInfo(id) {
  const a = S.actions.find((x) => x.id === id), d = document.getElementById('rule-dialog'); if (!a || !d) return;
  const df = actDef(a), r = ruleOf(a.ruleId);
  d.className = 'rule-dialog';
  d.innerHTML = '<div class="dlg-head"><div><span class="govuk-caption-m">' + esc(a.id) + ' · Help</span><h2 class="govuk-heading-m" id="rule-dialog-title">' + esc(a.title) + '</h2></div><button type="button" class="dlg-x" data-act="dialog-close" aria-label="Close">&times;</button></div>' +
    '<p class="govuk-body">' + statusTag(a.status) + ' ' + legalTag(df) + '</p>' +
    '<h3 class="govuk-heading-s">What this involves</h3>' + stepList(df.description) +
    '<h3 class="govuk-heading-s">Expected evidence</h3><p class="govuk-body">' + (df.evidence ? esc(df.evidence) : '<span class="muted">Not yet defined.</span>') + '</p>' +
    '<h3 class="govuk-heading-s">Why it applies</h3><p class="govuk-body">' + (r ? esc(r.requirementTitle) + '<br><span class="muted">' + esc(r.source) + '</span> ' + ruleChip(r.id) : 'Not linked to a rule.') + '</p>' +
    '<div class="govuk-button-group"><a class="govuk-button" role="button" draggable="false" href="#/actions/' + a.id + '" data-act="dialog-close">Open action</a><button type="button" class="govuk-button govuk-button--secondary" data-act="dialog-close">Close</button></div>';
  if (d.showModal) d.showModal(); else d.setAttribute('open', '');
}
function closeDialog() { const d = document.getElementById('rule-dialog'); if (d && d.open) { d.close ? d.close() : d.removeAttribute('open'); } }
document.addEventListener('click', (e) => { const d = document.getElementById('rule-dialog'); if (e.target === d) closeDialog(); });

/* ---------- Work categories: change categories, preview the rules engine result ---------- */
function workFromForm(form, base) {
  const d = formData(form);
  return Object.assign({}, base, { demand: d.demand || '', type: d.type || '', stage: d.stage || '', characteristics: arr(d.characteristics), channel: arr(d.channel), users: arr(d.users),
    transactional: d.transactional || 'No', estTransactions: (d.estTransactions || '').trim(), personalData: d.personalData || 'No', priority: d.priority || '', risk: d.risk || '' });
}
function ruleLine(r) {
  return '<li><span class="rule-chip rule-chip--static">' + esc(r.id) + '</span> ' + esc(r.requirementTitle) + ' <span class="muted">v' + r.version + ' · ' + r.actions.length + ' action' + (r.actions.length === 1 ? '' : 's') + '</span></li>';
}
function listCap(list, fn, n) {
  return '<ul class="govuk-list">' + list.slice(0, n).map(fn).join('') + '</ul>' + (list.length > n ? '<p class="govuk-body-s muted">and ' + (list.length - n) + ' more</p>' : '');
}
function catsPreviewHtml(w, draft) {
  const changes = diffWork(w, draft), before = matchingRules(w), after = matchingRules(draft);
  const added = after.filter((r) => !before.some((b) => b.id === r.id)), removed = before.filter((r) => !after.some((a) => a.id === r.id));
  const def = changes.length ? firingDef(changes, false) : null;
  let h = '<h2 class="govuk-heading-m">What will happen</h2>';
  if (!changes.length) return h + '<p class="govuk-body">Change a category to see which trigger fires and which rules apply.</p><p class="govuk-body-s muted">' + before.length + ' published rules currently apply to this work.</p>';
  h += '<ul class="govuk-list govuk-list--bullet">' + changes.map((c) => '<li><strong>' + esc(FIELDS[c.field].label) + '</strong>: ' + esc(c.from) + ' → ' + esc(c.to) + '</li>').join('') + '</ul>';
  h += def ? '<p class="govuk-body">' + tag('Trigger fires', 'govuk-tag--green') + ' ' + esc(def.name) + '</p>' : '<p class="govuk-body">' + tag('No trigger', 'govuk-tag--grey') + ' No enabled trigger watches these fields, so the rules engine will not run. <a class="govuk-link" href="#/triggers">Manage triggers</a></p>';
  if (def) {
    h += '<h3 class="govuk-heading-s">New requirements (' + added.length + ')</h3>' + (added.length ? listCap(added, ruleLine, 8) : '<p class="govuk-body-s muted">None.</p>');
    h += '<h3 class="govuk-heading-s">No longer required (' + removed.length + ')</h3>' + (removed.length ? listCap(removed, ruleLine, 8) + '<p class="govuk-body-s muted">Completed actions are kept.</p>' : '<p class="govuk-body-s muted">None.</p>');
    h += '<p class="govuk-body-s muted">' + after.length + ' published rule' + (after.length === 1 ? '' : 's') + ' will apply in total.</p>';
  }
  return h;
}
function vWorkCats(id) {
  const w = S.works.find((x) => x.id === id); if (!w) return notFound();
  const d = workDraft && workDraft.key === id ? workDraft.data : w;
  return '<a href="#/work/' + id + '" class="govuk-back-link">Back to work</a>' + errorSummary() + '<span class="govuk-caption-l">' + esc(w.id + ' · ' + w.title) + '</span><h1 class="govuk-heading-l">Change categories</h1>' +
    '<p class="govuk-body">Changing categories raises a trigger. The rules engine then works out which rules and actions apply.</p>' +
    '<div class="two-col"><form id="work-form" data-id="' + id + '" data-mode="cats" novalidate>' +
    '<input type="hidden" name="title" value="' + esc(w.title) + '"><input type="hidden" name="description" value="' + esc(w.description) + '">' +
    select('stage', 'stage', OPT.stage, d.stage, 'Stage') + select('type', 'type', OPT.type, d.type, 'Type of work') + select('demand', 'demand', OPT.demand, d.demand, 'Work source') +
    checks('characteristics', OPT.characteristics, d.characteristics, 'Characteristics') + checks('channel', OPT.channel, d.channel, 'Channel') + checks('users', OPT.users, d.users, 'Users') +
    radios('transactional', OPT.yesno, d.transactional, 'Transactional') + text('estTransactions', 'est', d.estTransactions, 'Estimated transactions per year', { cls: 'govuk-input--width-10', type: 'number' }) +
    radios('personalData', OPT.yesno, d.personalData, 'Captures or processes personal data') + select('priority', 'priority', OPT.level, d.priority, 'Priority') + select('risk', 'risk', OPT.level, d.risk, 'Risk and impact') +
    '<div class="govuk-button-group"><button class="govuk-button" type="submit" data-module="govuk-button" data-prevent-double-click="true">Save and run rules</button><a class="govuk-link" href="#/work/' + id + '">Cancel</a></div></form>' +
    '<aside class="panel" id="cat-preview" aria-live="polite">' + catsPreviewHtml(w, d) + '</aside></div>';
}
function previewCats(form) {
  const w = S.works.find((x) => x.id === form.dataset.id), el = document.getElementById('cat-preview');
  if (w && el) el.innerHTML = catsPreviewHtml(w, form.dataset.fields ? catsFromForm(form, w) : workFromForm(form, w));
}

/* ---------- Rule version history ---------- */
const SNAP_LABEL = { name: 'name', source: 'policy or standard', owner: 'owner', status: 'status', conditions: 'conditions', requirementTitle: 'requirement title', requirementDescription: 'description', actions: 'actions' };
function snapDiff(a, b) {
  return Object.keys(SNAP_LABEL).filter((k) => JSON.stringify((a || {})[k]) !== JSON.stringify((b || {})[k])).map((k) => SNAP_LABEL[k]);
}
function vRuleHistory(id) {
  const r = ruleOf(id); if (!r) return notFound();
  const vs = r.versions.slice().reverse();
  const rows = vs.map((v, i) => {
    const prev = vs[i + 1], changed = prev ? snapDiff(prev.snap, v.snap) : [];
    return ['<strong>Version ' + v.v + '</strong>' + (v.v === r.version ? ' ' + tag('Current', 'govuk-tag--blue') : ''), fmt(v.at) + '<br><span class="muted">' + esc(v.by) + '</span>', esc(v.note) + (changed.length ? '<br><span class="muted">Changed: ' + changed.join(', ') + '</span>' : ''),
      v.snap ? tag(v.snap.status || 'Published', v.snap.status === 'Draft' ? 'govuk-tag--yellow' : v.snap.status === 'Retired' ? 'govuk-tag--grey' : 'govuk-tag--green') : '',
      v.v === r.version || !v.snap ? '' : '<button type="button" class="govuk-button govuk-button--secondary govuk-!-margin-bottom-0" data-module="govuk-button" data-act="rule-restore" data-id="' + id + '" data-v="' + v.v + '">Restore as new version</button>'];
  });
  return '<a href="#/rules/' + id + '" class="govuk-back-link">Back to rule</a><span class="govuk-caption-l">' + esc(r.id) + '</span>' + pageHead(esc(r.name), 'Every save is kept as a version. Actions record the version of the rule that raised them.', btn('#/rules/' + id, 'Edit rule')) +
    table(['Version', 'Saved', 'Note', 'Status', ''], rows);
}

/* ---------- Triggers ---------- */
const EVENT_LABEL = { created: 'Work created', changed: 'Categories changed', rule: 'Rule published or changed' };
let trigDraft = null;
function vTriggerForm(id) {
  const isNew = id === 'new', base = isNew ? { name: '', event: 'changed', fields: [], enabled: true } : S.triggerDefs.find((x) => x.id === id);
  if (!base) return notFound();
  if (!trigDraft || trigDraft.key !== id) trigDraft = { key: id, d: JSON.parse(JSON.stringify(base)) };
  const d = trigDraft.d;
  return '<a href="#/triggers" class="govuk-back-link">Back to triggers</a>' + errorSummary() + '<h1 class="govuk-heading-l">' + (isNew ? 'Add trigger' : esc(base.name)) + '</h1>' +
    '<form id="trigger-form" data-id="' + id + '" novalidate>' + text('name', 'tname', d.name, 'Name') +
    '<div class="' + grp('event') + '"><fieldset class="govuk-fieldset"><legend class="govuk-fieldset__legend govuk-fieldset__legend--s">Raised when</legend><div class="govuk-radios govuk-radios--small" data-module="govuk-radios">' +
    Object.keys(EVENT_LABEL).map((k) => '<div class="govuk-radios__item"><input class="govuk-radios__input" id="ev-' + k + '" name="event" type="radio" value="' + k + '"' + (d.event === k ? ' checked' : '') + '><label class="govuk-label govuk-radios__label" for="ev-' + k + '">' + EVENT_LABEL[k] + '</label></div>').join('') + '</div></fieldset></div>' +
    '<div class="' + grp('fields') + '"><fieldset class="govuk-fieldset"><legend class="govuk-fieldset__legend govuk-fieldset__legend--s">Categories to watch</legend><div class="govuk-hint">Only used when the trigger is raised on a category change.</div>' + errMsg('fields', 'f-' + Object.keys(FIELDS)[0]) +
    '<div class="govuk-checkboxes govuk-checkboxes--small" data-module="govuk-checkboxes">' + Object.keys(FIELDS).map((k) => '<div class="govuk-checkboxes__item"><input class="govuk-checkboxes__input" id="f-' + k + '" name="fields" type="checkbox" value="' + k + '"' + (d.fields.includes(k) ? ' checked' : '') + '><label class="govuk-label govuk-checkboxes__label" for="f-' + k + '">' + esc(FIELDS[k].label) + '</label></div>').join('') + '</div></fieldset></div>' +
    '<div class="govuk-checkboxes govuk-checkboxes--small govuk-form-group" data-module="govuk-checkboxes"><div class="govuk-checkboxes__item"><input class="govuk-checkboxes__input" id="t-enabled" name="enabled" type="checkbox" value="1"' + (d.enabled ? ' checked' : '') + '><label class="govuk-label govuk-checkboxes__label" for="t-enabled">Enabled</label></div></div>' +
    '<div class="govuk-button-group"><button class="govuk-button" type="submit" data-module="govuk-button">Save trigger</button><a class="govuk-link" href="#/triggers">Cancel</a></div></form>';
}

/* ---------- Rules API ---------- */
const slim = (r) => ({ id: r.id, name: r.name, version: r.version, status: r.status, kind: r.kind || 'Policy', source: r.source, owner: r.owner, mandatory: r.mandatory || null, phases: r.phases || [], conditions: r.conditions, conditionsText: r.conditionsText || null, requirementTitle: r.requirementTitle, actions: r.actions, updated: r.versions[r.versions.length - 1].at });
function evaluate(input) {
  const w = Object.assign({ characteristics: [], channel: [], users: [], transactional: 'No', estTransactions: '', personalData: 'No', priority: 'Medium', risk: 'Medium' }, input || {});
  const matched = matchingRules(w);
  return { work: w, rulesEvaluated: S.rules.filter((r) => r.enabled).length, matched: matched.map((r) => ({ id: r.id, name: r.name, version: r.version, mandatory: r.mandatory || null, requirementTitle: r.requirementTitle, actions: r.actions })), actionCount: matched.reduce((n, r) => n + r.actions.length, 0) };
}
function apiRequest(method, path, body) {
  const u = new URL(path.replace(/^\//, ''), 'http://api.local/'), seg = u.pathname.split('/').filter(Boolean), q = u.searchParams;
  const ok = (b) => ({ status: 200, body: b }), nf = (m) => ({ status: 404, body: { error: m || 'Not found' } });
  if (method === 'GET' && seg[0] === 'rules' && seg.length === 1) {
    let list = S.rules;
    if (q.get('status')) list = list.filter((r) => r.status === q.get('status'));
    if (q.get('stage')) list = list.filter((r) => r.conditions.some((c) => c.field === 'stage' && condMatches({ stage: q.get('stage') }, c)));
    if (q.get('q')) list = list.filter((r) => (r.name + ' ' + r.source + ' ' + r.owner).toLowerCase().includes(q.get('q').toLowerCase()));
    return ok({ count: list.length, rules: list.map(slim) });
  }
  if (method === 'GET' && seg[0] === 'rules' && seg.length >= 2) {
    const r = ruleOf(seg[1]); if (!r) return nf('No rule ' + seg[1]);
    if (seg[2] === 'versions') return ok({ id: r.id, current: r.version, versions: r.versions.map((v) => ({ version: v.v, at: v.at, by: v.by, note: v.note, status: v.snap ? v.snap.status : null })) });
    return ok(Object.assign(slim(r), { requirementDescription: r.requirementDescription, why: r.why || null, standards: r.standards || [], systems: r.systems || null, guidance: r.guidance || null }));
  }
  if (method === 'GET' && seg[0] === 'triggers') return ok({ triggers: S.triggerDefs });
  if (method === 'GET' && seg[0] === 'work' && seg[2] === 'requirements') {
    const w = S.works.find((x) => x.id === seg[1]); if (!w) return nf('No work item ' + seg[1]);
    return ok({ work: w.id, requirements: reqGroups(w.id).map((g) => ({ ruleId: g.ruleId, title: g.title, actions: g.actions.map((a) => ({ id: a.id, title: a.title, status: a.status, ruleVersion: a.ruleVersion || null })) })) });
  }
  if (method === 'POST' && seg[0] === 'evaluate') {
    let input; try { input = JSON.parse(body || '{}'); } catch (e) { return { status: 400, body: { error: 'Request body is not valid JSON' } }; }
    return ok(evaluate(input));
  }
  return nf('No endpoint ' + method + ' /' + seg.join('/'));
}
window.RulesAPI = { request: apiRequest };
const EVALUATE_EXAMPLE = {
  title: 'School trips booking service',
  stage: 'Build',
  type: 'New',
  demand: 'New demand',
  characteristics: ['Transactional'],
  channel: ['Online'],
  users: ['Parents and Carers', 'Teachers'],
  transactional: 'Yes',
  estTransactions: '250000',
  personalData: 'Yes',
  priority: 'High',
  risk: 'Medium'
};
const API_EXAMPLES = [
  ['POST', '/evaluate', JSON.stringify(EVALUATE_EXAMPLE, null, 2), 'Live', 'Rules and actions that apply to the work object you send'],
  ['GET', '/rules?status=Published&stage=Build', '', 'Live', 'Published rules whose conditions include a stage'],
  ['GET', '/rules/RUL-101', '', 'Live', 'One rule from the admin store'],
  ['GET', '/rules/RUL-101/versions', '', 'Live', 'Version history of a rule'],
  ['GET', '/triggers', '', 'Live', 'Trigger definitions'],
  ['GET', '/work/WRK-001/requirements', '', 'Live', 'Requirements and actions already raised for a work item'],
  ['GET', 'api/rules.json', '', 'Static', 'Every rule built from the CSV logs, as a published file'],
  ['GET', 'api/rules/RUL-101.json', '', 'Static', 'One rule, as a static file']
];
function apiStatusLine(method, path, res, chars) {
  const matched = res.body && Array.isArray(res.body.matched) ? ' · ' + res.body.matched.length + ' rules apply · ' + (res.body.actionCount || 0) + ' actions' : '';
  return method + ' ' + path + ' → ' + res.status + matched + ' · ' + chars.toLocaleString('en-GB') + ' characters';
}
const API_DOCS = [
  { tag: 'Evaluate', m: 'POST', p: '/evaluate', sum: 'Evaluate a work object', desc: 'Send a work object. The rules engine checks every published rule against it and returns the rules that apply, the requirements they raise and the actions for each.', params: [['body', 'JSON', 'Work object: stage, type, demand, characteristics, channel, users, transactional, estTransactions, personalData, priority, risk']], body: JSON.stringify(EVALUATE_EXAMPLE, null, 2) },
  { tag: 'Evaluate', m: 'POST', p: '/evaluate', sum: 'Example: a live service handling personal data', desc: 'Change the stage to see different rules apply.', params: [['body', 'JSON', 'Work object']], body: JSON.stringify(Object.assign({}, EVALUATE_EXAMPLE, { title: 'Benefits checker', stage: 'Run / Serve', personalData: 'Yes' }), null, 2) },
  { tag: 'Rules', m: 'GET', p: '/rules?status=Published&stage=Build', sum: 'List rules', desc: 'Returns rules from the admin store.', params: [['status', 'query', 'Published, Draft or Retired'], ['stage', 'query', 'Only rules that apply at this stage'], ['q', 'query', 'Search name, source or owner']] },
  { tag: 'Rules', m: 'GET', p: '/rules/RUL-101', sum: 'Get a rule', desc: 'One rule with its requirement, rationale, standards and guidance.', params: [['id', 'path', 'Rule ID, for example RUL-101']] },
  { tag: 'Rules', m: 'GET', p: '/rules/RUL-101/versions', sum: 'Rule version history', desc: 'Every saved version with who changed it and why.', params: [['id', 'path', 'Rule ID']] },
  { tag: 'Triggers', m: 'GET', p: '/triggers', sum: 'List trigger definitions', desc: 'The events that cause rules to be re-run against work.', params: [] },
  { tag: 'Work', m: 'GET', p: '/work/WRK-001/requirements', sum: 'Requirements raised for a work item', desc: 'The requirements and actions already raised, with status and the rule version that raised them.', params: [['id', 'path', 'Work ID, for example WRK-001']] },
  { tag: 'Static files', m: 'GET', p: 'api/rules.json', sum: 'All rules (static file)', desc: 'Every rule built from the CSV logs, published as a file for GitHub Pages.', params: [], stat: true },
  { tag: 'Static files', m: 'GET', p: 'api/rules/RUL-101.json', sum: 'One rule (static file)', desc: 'A single rule as a static file.', params: [], stat: true }
];
function apiCurl(e, path, body) {
  const base = location.origin + location.pathname.replace(/[^/]*$/, '');
  if (e.stat) return 'curl ' + base + path;
  return e.m === 'POST' ? 'RulesAPI.request("POST", "' + path + '", ' + JSON.stringify(body || '') + ')' : 'RulesAPI.request("GET", "' + path + '")';
}
function vApi() {
  const pub = S.rules.filter((r) => r.status === 'Published').length;
  const tags = Array.from(new Set(API_DOCS.map((e) => e.tag)));
  return banner() + pageHead('Rules API', 'Explore and test the rules engine API. Open an endpoint, edit the request and press Execute.', '<button type="button" class="govuk-button govuk-button--secondary" data-module="govuk-button" data-act="api-download">Download live rules.json</button>') +
    '<div class="api-meta"><span><b>' + S.rules.length + '</b> rules</span><span><b>' + pub + '</b> published</span><span><b>' + S.triggerDefs.length + '</b> triggers</span><span>Version <b>1.0</b></span><span>Console: <code>RulesAPI.request(method, path, body)</code></span></div>' +
    tags.map((t) => '<section class="api-group"><h2 class="api-gh">' + esc(t) + '</h2>' + API_DOCS.map((e, i) => e.tag === t ? apiOp(e, i) : '').join('') + '</section>').join('');
}
function apiOp(e, i) {
  const m = e.m.toLowerCase();
  return '<details class="api-op api-op--' + m + '" data-i="' + i + '"><summary><span class="api-m">' + e.m + '</span><code class="api-p">' + esc(e.p) + '</code><span class="api-s">' + esc(e.sum) + '</span></summary><div class="api-body">' +
    '<p class="govuk-body">' + esc(e.desc) + '</p>' +
    (e.params.length ? '<h3 class="api-h">Parameters</h3><table class="api-params"><tbody>' + e.params.map((p) => '<tr><th scope="row"><code>' + esc(p[0]) + '</code></th><td>' + esc(p[1]) + '</td><td>' + esc(p[2]) + '</td></tr>').join('') + '</tbody></table>' : '') +
    '<h3 class="api-h">Request</h3><div class="govuk-form-group"><label class="govuk-label" for="ap-' + i + '">Path</label><input class="govuk-input" id="ap-' + i + '" data-role="path" value="' + esc(e.p) + '"></div>' +
    (e.m === 'POST' ? '<div class="govuk-form-group"><label class="govuk-label" for="ab-' + i + '">Body (JSON)</label><textarea class="govuk-textarea api-code" id="ab-' + i + '" data-role="body" rows="12" spellcheck="false">' + esc(e.body || '') + '</textarea></div>' : '') +
    '<div class="govuk-button-group"><button type="button" class="govuk-button" data-module="govuk-button" data-act="api-exec" data-i="' + i + '">Execute</button><button type="button" class="govuk-button govuk-button--secondary" data-module="govuk-button" data-act="api-reset" data-i="' + i + '">Reset</button></div>' +
    '<div class="api-res" hidden><h3 class="api-h">Response <span class="api-code-tag" data-role="status"></span></h3><p class="govuk-body-s" data-role="line"></p><pre class="api-out" data-role="out" tabindex="0"></pre><h3 class="api-h">Call</h3><pre class="api-out api-out--s" data-role="curl"></pre></div>' +
    '</div></details>';
}
async function execApi(i) {
  const e = API_DOCS[i], box = document.querySelector('.api-op[data-i="' + i + '"]'), g = (r) => box.querySelector('[data-role=' + r + ']');
  const path = g('path').value.trim(), body = g('body') ? g('body').value : '';
  let res;
  if (e.stat || /^https?:/.test(path)) {
    try { const r = await fetch(path); const text = await r.text(); let b = text; try { b = JSON.parse(text); } catch (x) { /* text */ } res = { status: r.status, body: b, bytes: text.length }; }
    catch (x) { res = { status: 0, body: { error: 'Could not fetch the file. Static files need the site served over http(s).' } }; }
  } else res = apiRequest(e.m, path, body);
  const json = typeof res.body === 'string' ? res.body : JSON.stringify(res.body, null, 2);
  box.querySelector('.api-res').hidden = false;
  g('status').textContent = res.status; g('status').className = 'api-code-tag ' + (res.status >= 200 && res.status < 300 ? 'ok' : 'bad');
  g('line').textContent = apiStatusLine(e.m, path, res, res.bytes || json.length);
  g('out').textContent = json.length > 20000 ? json.slice(0, 20000) + '\n… truncated for display (' + json.length.toLocaleString('en-GB') + ' characters)' : json;
  g('curl').textContent = apiCurl(e, path, body);
}

/* ---------- Extra events ---------- */
document.addEventListener('submit', (e) => {
  const f = e.target;
  if (f.dataset.form === 'raise') {
    e.preventDefault();
    const w = S.works.find((x) => x.id === formData(f).work); if (!w) return;
    const res = runEngine(w, 'Triggered manually.'); recordTrigger(w, 'Raised manually', [], res, { id: '', name: 'Manual' }); save();
    flash = { title: 'Success', html: '<p class="govuk-notification-banner__heading">Rules checked for ' + esc(w.title) + '. ' + res.fired.length + ' rules apply, ' + res.added.length + ' new action' + (res.added.length === 1 ? '' : 's') + ', ' + res.withdrawn.length + ' withdrawn, ' + res.reinstated.length + ' reinstated.</p>' };
    rerender();
  } else if (f.id === 'trigger-form') {
    e.preventDefault();
    const d = formData(f), id = f.dataset.id, next = { name: (d.name || '').trim(), event: d.event || '', fields: arr(d.fields), enabled: !!d.enabled };
    trigDraft = { key: id, d: next }; ERR = {};
    if (!next.name) fail('name', 'Enter a name for the trigger');
    if (!next.event) fail('event', 'Select when the trigger is raised', 'ev-created');
    if (next.event === 'changed' && !next.fields.length) fail('fields', 'Select at least one category to watch', 'f-' + Object.keys(FIELDS)[0]);
    if (next.event !== 'changed') next.fields = [];
    if (hasErr()) { rerender(); return; }
    if (id === 'new') S.triggerDefs.push(Object.assign({ id: uid('TD') }, next)); else Object.assign(S.triggerDefs.find((x) => x.id === id), next);
    save(); trigDraft = null; flash = { title: 'Success', html: '<p class="govuk-notification-banner__heading">Trigger saved.</p>' }; go('#/triggers');
  }
}, true);
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-act]'); if (!t) return;
  const act = t.dataset.act;
  if (act === 'api-exec') execApi(+t.dataset.i);
  else if (act === 'api-reset') { const e = API_DOCS[+t.dataset.i], box = t.closest('.api-op'); box.querySelector('[data-role=path]').value = e.p; const b = box.querySelector('[data-role=body]'); if (b) b.value = e.body || ''; box.querySelector('.api-res').hidden = true; }

  else if (act === 'api-download') {
    const blob = new Blob([JSON.stringify({ meta: { generated: now(), count: S.rules.length }, rules: S.rules.map((r) => Object.assign(slim(r), { requirementDescription: r.requirementDescription })) }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'rules.json'; document.body.appendChild(a); a.click(); a.remove();
  } else if (act === 'rule-restore') {
    const r = ruleOf(t.dataset.id), v = r && r.versions.find((x) => String(x.v) === t.dataset.v); if (!v || !v.snap) return;
    Object.assign(r, JSON.parse(JSON.stringify(v.snap))); if (!v.snap.actions) r.actions = actionsFromTasks(r); r.tasks = r.actions.map((a) => a.title); r.enabled = r.status === 'Published'; r.version += 1;
    r.versions.push({ v: r.version, at: now(), by: 'You', note: 'Restored version ' + v.v + '.', snap: snapOf(r) });
    const rdef = S.triggerDefs.find((d) => d.enabled && d.event === 'rule'); let n = 0;
    if (rdef) S.works.forEach((w) => { const res = runEngine(w, 'Rule ' + r.id + ' v' + r.version + ' restored from v' + v.v + '.'); if (res.added.length || res.withdrawn.length || res.reinstated.length) { recordTrigger(w, 'Rule changed: ' + r.name + ' (v' + r.version + ')', [], res, rdef); n++; } });
    save(); flash = { title: 'Success', html: '<p class="govuk-notification-banner__heading">Version ' + v.v + ' restored as version ' + r.version + '. Requirements changed for ' + n + ' work item' + (n === 1 ? '' : 's') + '.</p>' };
    go('#/rules/' + r.id + '/history');
  }
});

/* ---------- Modals ---------- */
function openModal(html, cls) {
  const d = document.getElementById('rule-dialog'); if (!d) return;
  d.className = 'rule-dialog' + (cls ? ' ' + cls : ''); d.innerHTML = html;
  if (d.showModal) d.showModal(); else d.setAttribute('open', '');
  if (window.govukInit) window.govukInit(d);
}
const modalHead = (cap, title) => '<div class="dlg-head"><div><span class="govuk-caption-m">' + esc(cap) + '</span><h2 class="govuk-heading-l govuk-!-margin-bottom-0" id="rule-dialog-title">' + esc(title) + '</h2></div><button type="button" class="dlg-x" data-act="dialog-close" aria-label="Close">&times;</button></div>';

/* ---------- Work: change categories in a modal with a live rules preview ---------- */
const CAT_GROUPS = { stage: ['stage'], type: ['type'], demand: ['demand'], characteristics: ['characteristics'], channel: ['channel'], users: ['users'], transactional: ['transactional', 'estTransactions'], estTransactions: ['transactional', 'estTransactions'], personalData: ['personalData'], priority: ['priority'], risk: ['risk'] };
function catControl(k, w) {
  const f = FIELDS[k];
  if (k === 'estTransactions') return text(k, 'est', w[k], f.label, { cls: 'govuk-input--width-10', type: 'number' });
  if (f.kind === 'single') return select(k, k, f.options, w[k], f.label);
  if (f.kind === 'multi') return checks(k, f.options, w[k], f.label);
  return radios(k, f.options, w[k], f.label);
}
function catsFromForm(form, w) {
  const fd = new FormData(form), o = Object.assign({}, w);
  (form.dataset.fields || '').split(',').filter(Boolean).forEach((k) => { o[k] = FIELDS[k].kind === 'multi' ? fd.getAll(k) : (fd.get(k) || ''); });
  o.estTransactions = String(o.estTransactions == null ? '' : o.estTransactions).trim();
  return o;
}
function openCats(id, field) {
  const w = S.works.find((x) => x.id === id); if (!w) return;
  const keys = field ? CAT_GROUPS[field] : Object.keys(FIELDS);
  openModal(modalHead(w.id + ' · ' + w.title, field ? 'Change ' + FIELDS[field].label.toLowerCase() : 'Change categories') +
    '<p class="govuk-body">The rules engine runs as soon as you apply the change. The result below updates as you choose.</p>' +
    '<form id="cats-form" data-id="' + id + '" data-fields="' + keys.join(',') + '" data-mode="cats" novalidate>' + keys.map((k) => catControl(k, w)).join('') +
    '<div class="panel preview" id="cat-preview" aria-live="polite">' + catsPreviewHtml(w, w) + '</div><div id="cats-err" role="alert"></div>' +
    '<div class="govuk-button-group"><button class="govuk-button" type="submit" data-module="govuk-button" data-prevent-double-click="true">Apply and run rules</button><button type="button" class="govuk-button govuk-button--secondary" data-module="govuk-button" data-act="dialog-close">Cancel</button></div></form>', 'wide');
}
function applyCats(form) {
  const w = S.works.find((x) => x.id === form.dataset.id), d = catsFromForm(form, w), changes = diffWork(w, d), err = document.getElementById('cats-err');
  const bad = (m) => { err.innerHTML = '<p class="govuk-error-message"><span class="govuk-visually-hidden">Error:</span> ' + esc(m) + '</p>'; };
  if (!changes.length) { closeDialog(); return; }
  if (!d.stage || !d.type || !d.demand) return bad('Stage, type of work and work source cannot be left blank');
  if (d.estTransactions && !/^\d+$/.test(d.estTransactions)) return bad('Estimated transactions must be a whole number, like 250000');
  if (d.transactional === 'Yes' && !d.estTransactions) return bad('Enter the estimated transactions per year for a transactional service');
  Object.assign(w, { stage: d.stage, type: d.type, demand: d.demand, characteristics: d.characteristics, channel: d.channel, users: d.users, transactional: d.transactional, estTransactions: d.estTransactions, personalData: d.personalData, priority: d.priority, risk: d.risk });
  const def = firingDef(changes, false), empty = { added: [], withdrawn: [], reinstated: [], fired: [] };
  const result = def ? runEngine(w, 'Triggered by categorisation change.') : empty;
  recordTrigger(w, def ? 'Categorisation changed' : 'Categorisation changed, but no enabled trigger watches these fields', changes, result, def);
  save();
  const li = (l, label) => l.length ? '<li>' + label + ': ' + l.map((a) => '<a class="govuk-notification-banner__link" href="#/actions/' + a.id + '">' + esc(a.title) + '</a>').join(', ') + '</li>' : '';
  flash = { title: 'Success', html: '<p class="govuk-notification-banner__heading">' + (def ? changes.length + ' change' + (changes.length > 1 ? 's' : '') + ' saved and the rules engine ran (' + esc(def.name) + ').' : 'Saved. No enabled trigger watches the fields you changed, so the rules engine did not run.') + '</p><ul class="govuk-list govuk-list--bullet">' +
    (li(result.added, 'New actions') + li(result.reinstated, 'Reinstated') + li(result.withdrawn, 'No longer required') || '<li>No action changes.</li>') + '</ul>' };
  closeDialog(); rerender();
}

/* ---------- Work detail ---------- */
function actRow(a) {
  const d = actDef(a);
  return '<li class="arow"><span class="arow-s">' + statusTag(a.status) + '</span><div class="arow-m"><a class="govuk-link govuk-link--no-visited-state" href="#/actions/' + a.id + '">' + esc(a.title) + '</a><span class="arow-meta">' + (d.legal ? tag('Legal', 'govuk-tag--red') + ' ' : '') + evBadge(a) + ' <span class="muted">' + a.id + '</span></span></div>' +
    '<a class="govuk-link arow-go" href="#/actions/' + a.id + '">' + (isActive(a) ? 'Record activity' : 'View') + '<span class="govuk-visually-hidden"> for ' + esc(a.title) + '</span></a></li>';
}
function vWorkDetail(id) {
  const w = S.works.find((x) => x.id === id); if (!w) return notFound();
  const p = qs(), tab = p.get('tab') || 'todo', base = 'work/' + id;
  const all = S.actions.filter((a) => a.workId === id), active = all.filter(isActive), open = active.filter(isOpen), doneL = active.filter((a) => a.status === 'Complete'), pc = workPct(id);
  const legalOpen = open.filter(actLegal).length, exc = active.filter((a) => a.status === 'Exception').length;
  const tabs = tabsNav(base, p, 'tab', [['todo', 'To do', open.length], ['done', 'Done', doneL.length], ['reqs', 'Requirements', reqGroups(id).length], ['cats', 'Categories'], ['activity', 'Activity']], 'todo', 'Work sections');
  let body = '';
  if (tab === 'todo') {
    const list = open.slice().sort(byPrio), nx = list[0];
    body = (nx ? '<section class="nextup"><div><p class="nextup-k">Next up</p><h2 class="nextup-t"><a class="govuk-link govuk-link--no-visited-state" href="#/actions/' + nx.id + '">' + esc(nx.title) + '</a></h2><p class="nextup-s">' + esc(reqTitle(nx)) + (actLegal(nx) ? ' · <strong class="red">Legal requirement</strong>' : '') + '</p></div>' +
      '<div class="nextup-b"><a class="govuk-button" role="button" draggable="false" data-module="govuk-button" href="#/actions/' + nx.id + '">Record activity</a></div></section>' : '<div class="panel"><p class="govuk-body">Nothing left to do. Every action is complete.</p></div>') +
      (list.length > 1 ? '<ul class="qlist">' + list.slice(1).map((a) => qrow(a, false)).join('') + '</ul>' : '');
  } else if (tab === 'done') {
    body = doneL.length ? '<ul class="qlist">' + doneL.map((a) => qrow(a, false)).join('') + '</ul>' : '<div class="panel"><p class="govuk-body">Nothing is done yet.</p></div>';
    const gone = all.filter((a) => !isActive(a));
    if (gone.length) body += '<h2 class="govuk-heading-s">No longer required</h2><ul class="qlist">' + gone.map((a) => qrow(a, false)).join('') + '</ul>';
  } else if (tab === 'reqs') {
    body = '<ul class="qlist">' + (reqGroups(id).map((g) => {
      const r = ruleOf(g.ruleId), d = g.actions.filter((a) => a.status === 'Complete').length, pg = Math.round(d / g.actions.length * 100);
      return '<li class="qrow"><div class="qrow-m"><strong>' + esc(g.title) + '</strong><span class="qrow-s">' + (r ? esc(r.source) + (r.mandatory ? ' · ' + esc(r.mandatory) : '') : '') + '</span></div><div class="qrow-r"><span class="muted">' + d + ' of ' + g.actions.length + ' done</span>' + (g.ruleId ? ruleChip(g.ruleId) : '') + '</div></li>';
    }).join('') || '<li class="qrow"><span class="muted">No requirements apply to this work yet.</span></li>') + '</ul>';
  } else if (tab === 'cats') {
    body = '<div class="catgrid">' + Object.keys(FIELDS).map((k) => '<div class="catcell"><span class="catcell-l">' + FIELDS[k].label + '</span><span class="catcell-v">' + esc(fieldVal(w, k) || 'Not set') + '</span><button type="button" class="link-btn" data-act="cats-open" data-id="' + w.id + '" data-field="' + k + '">Change<span class="govuk-visually-hidden"> ' + FIELDS[k].label.toLowerCase() + '</span></button></div>').join('') + '</div>' +
      '<p class="govuk-hint">Changing a category runs the rules engine straight away. You will see what will change before you apply it.</p>';
  } else {
    const ups = all.flatMap((a) => a.updates.filter((u) => u.type !== 'system').map((u) => ({ u, a }))).sort((x, y) => String(y.u.at).localeCompare(String(x.u.at))).slice(0, 10);
    const trig = S.triggers.filter((t) => t.workId === id).slice(0, 5);
    body = '<div class="two-col"><section><h2 class="govuk-heading-s">Updates on actions</h2>' + (ups.length ? ups.map((x) => '<div class="log-entry ' + esc(x.u.type) + '"><p class="govuk-body-s govuk-!-margin-bottom-1">' + fmt(x.u.at) + ' · <a class="govuk-link" href="#/actions/' + x.a.id + '">' + esc(x.a.title) + '</a></p><p class="govuk-body govuk-!-margin-bottom-0"><strong>' + esc(x.u.type) + '</strong>: ' + esc(x.u.text) + '</p></div>').join('') : '<p class="govuk-body muted">No updates recorded yet.</p>') + '</section>' +
      '<section><h2 class="govuk-heading-s">Rules engine runs</h2>' + (trig.length ? triggerList(trig) : '<p class="govuk-body muted">None yet.</p>') + '</section></div>';
  }
  return banner() + '<a href="#/work" class="govuk-back-link">Back to work</a>' + errorSummary() +
    '<div class="case-head"><div class="ring ring--sm" style="--p:' + pc + '"><span>' + pc + '%</span></div><div class="case-title"><p class="case-sub">' + w.id + ' · ' + esc(w.type) + ' · ' + esc(w.stage) + '</p><h1 class="govuk-heading-l">' + esc(w.title) + '</h1>' +
    '<p class="case-sub">' + esc(w.description) + '</p><p class="case-flags">' + prioTag(w.priority) + (legalOpen ? '<span class="flag flag--red">' + legalOpen + ' legal open</span>' : '') + (exc ? '<span class="flag flag--orange">' + exc + ' exception' + (exc === 1 ? '' : 's') + '</span>' : '') + '</p></div>' +
    '<div class="page-actions"><button type="button" class="govuk-button" data-module="govuk-button" data-act="cats-open" data-id="' + w.id + '">Change categories</button>' + btn('#/work/' + w.id + '/edit', 'Edit details', true) + '<button type="button" class="govuk-button govuk-button--secondary" data-module="govuk-button" data-act="add-action-open" data-id="' + w.id + '">Add action</button>' + '</div></div>' +
    tabs + '<div class="with-rail"><div class="rail-main">' + body + '</div>' + workRail(w, all, active, open, doneL) + '</div>';
}
function workRail(w, all, active, open, doneL) {
  const noEv = doneL.filter((a) => !evCount(a)).length, legal = open.filter(actLegal).length, groups = reqGroups(w.id).slice(0, 5);
  return '<aside class="rail" aria-label="About this work">' +
    '<section class="rail-card"><h2 class="rail-h">Progress</h2><p class="rail-p">' + doneL.length + ' of ' + active.length + ' actions done</p>' + bar(workPct(w.id), workPct(w.id) + '% complete') +
    '<ul class="rail-list"><li>' + legal + ' legal requirement' + (legal === 1 ? '' : 's') + ' still open</li><li>' + noEv + ' done without evidence</li></ul></section>' +
    '<section class="rail-card"><h2 class="rail-h">How this works</h2><p class="rail-p">Rules look at this work\'s categories. When one changes, the rules engine runs and adds, keeps or withdraws actions.</p><button type="button" class="link-btn" data-act="cats-open" data-id="' + w.id + '">Change a category</button></section>' +
    '<section class="rail-card"><h2 class="rail-h">Rules applied</h2>' + (groups.length ? '<ul class="rail-list">' + groups.map((g) => '<li>' + (g.ruleId ? ruleChip(g.ruleId) + ' ' : '') + esc(g.title) + '</li>').join('') + '</ul>' : '<p class="rail-p">No rules apply yet.</p>') + '</section></aside>';
}

/* ---------- Action detail: evidence and activity ---------- */
const ACT_TYPES = [['evidence', 'Evidence', 'A document, link or output that shows the action is done'], ['note', 'Note', 'A progress update'], ['decision', 'Decision', 'A decision made about this action'], ['exception', 'Exception', 'The action cannot be met as written']];
function vActionDetail(id) {
  const a = S.actions.find((x) => x.id === id); if (!a) return notFound();
  flowTick(a);
  const rule = ruleOf(a.ruleId), d = actDef(a), w = S.works.find((x) => x.id === a.workId);
  const ev = a.updates.filter((u) => u.type === 'evidence').slice().reverse();
  const rest = a.updates.slice().reverse();
  const sibs = S.actions.filter((x) => x.workId === a.workId && x.ruleId === a.ruleId && x.id !== a.id && isActive(x));
  const evItem = (u) => '<li class="evi"><p class="govuk-body-s muted govuk-!-margin-bottom-1">' + fmt(u.at) + '</p>' + (u.text ? '<p class="govuk-body govuk-!-margin-bottom-1">' + esc(u.text) + '</p>' : '') +
    (u.link ? '<p class="govuk-body-s govuk-!-margin-bottom-0"><a class="govuk-link" href="' + esc(u.link) + '" target="_blank" rel="noopener noreferrer">' + esc(u.link) + ' (opens in new tab)</a></p>' : '') + '</li>';
  const tl = (u) => '<li class="tl tl--' + u.type + '"><p class="govuk-body-s govuk-!-margin-bottom-1"><strong>' + esc(u.type === 'system' ? 'System' : u.type.charAt(0).toUpperCase() + u.type.slice(1)) + '</strong> <span class="muted">' + fmt(u.at) + '</span></p><p class="govuk-body-s govuk-!-margin-bottom-0">' + esc(u.text || '') + (u.link ? ' <a class="govuk-link" href="' + esc(u.link) + '" target="_blank" rel="noopener noreferrer">Link</a>' : '') + '</p></li>';
  const act = isActive(a);
  return banner() + '<a href="#/work/' + a.workId + '" class="govuk-back-link">Back to ' + esc(workName(a.workId)) + '</a>' +
    '<span class="govuk-caption-m">' + a.id + ' · <a class="govuk-link" href="#/work/' + a.workId + '">' + esc(workName(a.workId)) + '</a>' + (w ? ' · ' + esc(w.stage) : '') + '</span>' +
    pageHead(esc(a.title), statusTag(a.status) + ' ' + legalTag(d) + (a.ruleVersion ? ' <span class="muted">Rule ' + esc(a.ruleId) + ' v' + a.ruleVersion + '</span>' : ''),
      act ? (flowKind(a) ? '' : '<button type="button" class="govuk-button" data-module="govuk-button" data-act="activity-open" data-id="' + a.id + '" data-type="evidence">Add evidence</button>') + '<button type="button" class="govuk-button govuk-button--secondary" data-module="govuk-button" data-act="activity-open" data-id="' + a.id + '" data-type="note">Add note or update status</button>' : '') +
    '<div class="two-col' + (flowKind(a) ? ' flow-page' : '') + '"><section><div class="flow-main">' + blockNotice(a) + (isBlocked(a) ? '' : flowPanel(a)) + '</div><div class="flow-rest">' +
    '<h2 class="govuk-heading-m">About this action</h2><dl class="govuk-summary-list"><div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">What this involves</dt><dd class="govuk-summary-list__value">' + stepList(d.description) + '</dd></div>' +
    '<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Expected evidence</dt><dd class="govuk-summary-list__value">' + (d.evidence ? esc(d.evidence) : '<span class="muted">Not yet defined.</span>') + '</dd></div>' +
    '<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Requirement</dt><dd class="govuk-summary-list__value">' + (rule ? esc(rule.requirementTitle) + '<br><span class="muted">' + esc(rule.source) + '</span>' : 'Not linked to a rule') + '</dd></div></dl>' +
    '<h2 class="govuk-heading-m">Evidence <span class="muted">(' + ev.length + ')</span></h2>' +
    (ev.length ? '<ul class="evlist">' + ev.map(evItem).join('') + '</ul>' : '<div class="govuk-inset-text">No evidence recorded yet.' + (d.evidence ? ' Expected: ' + esc(d.evidence) : '') + (d.legal ? ' This is a legal requirement, so evidence is needed before it can be completed.' : '') + '</div>') +
    '<h2 class="govuk-heading-m">Activity</h2><ol class="tlist">' + rest.map(tl).join('') + '</ol></div></section>' +
    '<aside>' + (rule && (depsOf(rule).length || requiredBy(rule.id).length) ? '<h2 class="govuk-heading-s">Dependencies</h2>' + depList(rule) : '') + '<div class="panel"><h2 class="govuk-heading-s">Status</h2><ol class="steps">' + STATUSES.filter((s) => s !== 'No longer required' || a.status === s).map((s) => '<li class="' + (s === a.status ? 'on' : '') + '">' + esc(s) + '</li>').join('') + '</ol></div>' +
    (sibs.length ? '<h2 class="govuk-heading-s govuk-!-margin-top-6">Other actions for this requirement</h2><ul class="govuk-list govuk-body-s">' + sibs.map((s) => '<li><a class="govuk-link" href="#/actions/' + s.id + '">' + esc(s.title) + '</a> ' + statusTag(s.status) + '</li>').join('') + '</ul>' : '') + '</aside></div>';
}
const SCR_GROUPS = [
  { id: 'g1', t: 'Does the processing activity involve any of the following?', hint: 'These are on the ICO list of processing that always needs a DPIA.', f: [
    ['adm', 'Use systematic and extensive profiling or automated decision-making to make significant decisions about people.', 'What decisions or profiles, who is affected and why?'],
    ['specialLarge', 'Process special category data or criminal offence data on a large scale.', 'List all fields and why you need them, including whose data you are processing and how many people.'],
    ['publicMonitor', 'Systematically monitor a publicly accessible area on a large scale.', 'Who is monitored, why and where?']] },
  { id: 'g2', t: 'Does the processing activity involve any of the following?', f: [
    ['accessDecision', 'Make decisions on someone\'s access to a service or product on the basis of automated decision making (including profiling) or the processing of special category data.', 'Which decisions, who is affected and why?'],
    ['profilingLarge', 'Carry out profiling on a large scale.', 'Who is profiled, why and how many people?'],
    ['matching', 'Match or combine datasets obtained from multiple sources, from two or more processing operations performed for different purposes or by different data controllers, in a way that would exceed the reasonable expectations of the data subject.', 'Is it all DfE data? Is there non-DfE data? Would people expect this? Why are you matching the data?'],
    ['children', 'Profile children, target marketing at them or offer online services to them.', 'Describe how children are affected.'],
    ['harm', 'Use personal information that might result in physical harm in the event of a personal data breach.', 'Describe the data and the potential harm.']] },
  { id: 'g3', t: 'Does the processing activity involve any of the following?', f: [
    ['innovative', 'Use innovative technology.', 'How does this apply? Is it an existing dataset processed in a new way? What data, what technology and why?'],
    ['biometric', 'Process biometric data for the purpose of uniquely identifying an individual.', 'What biometric data, whose and why?'],
    ['genetic', 'Process genetic data.', 'What genetic data, whose and why?'],
    ['invisible', 'Collect personal data from a third party or source without providing a privacy notice to the individuals (invisible processing).', 'What data, from whom and why is no notice given?'],
    ['tracking', 'Track individuals\' online or offline location or behaviour.', 'Who is tracked, how and why?']] },
  { id: 'g4', t: 'Does the processing activity involve any of the following?', f: [
    ['scoring', 'Undertake evaluation or scoring.', 'Who is evaluated or scored, how and why?'],
    ['sysMon', 'Systematic monitoring.', 'Who is monitored, why and where?'],
    ['sensitive', 'Use sensitive personal data or data of a highly personal nature, including criminal offence data.', 'List all fields and why you need them, including whose data you are processing.'],
    ['large', 'Process personal data on a large scale.', 'How many individuals? Is the scope local, regional, national or international? Is it one-off, time-limited or ongoing?'],
    ['vulnerable', 'Use the personal data of vulnerable data subjects.', 'Who are they? Do they have a choice? Are there negative impacts? What are the benefits?'],
    ['rights', 'Prevent people from exercising a right or using a service or a contract.', 'Who, why and what is prevented?'],
    ['admLegal', 'Use automated decision-making with a legal or similar significant effect.', 'What decisions, who is affected and why?']] }
];
const CURRENT_USER = { name: 'Andy Jones', email: 'andy.jones@education.gov.uk' };
function screenerPrefill(w) {
  const v = { name: w.title || '', uname: CURRENT_USER.name, uemail: CURRENT_USER.email, what: w.description || '', wider: 'Yes', x_wider: (w.title || '') + ' (' + (w.type || 'work') + ', ' + (w.stage || '') + ')', ai: 'No', pre: ['name', 'uname', 'uemail', 'what'] };
  const n = parseInt(String(w.estTransactions || '').replace(/\D/g, ''), 10) || 0;
  if (w.personalData === 'Yes' && n >= 10000) { v.f_large = 'Yes'; v.x_f_large = 'About ' + n.toLocaleString('en-GB') + ' transactions a year. Users: ' + ((w.users || []).join(', ') || 'not set') + '. Channels: ' + ((w.channel || []).join(', ') || 'not set') + '.'; }
  return v;
}
const SCR_FACTORS = SCR_GROUPS.reduce((l, g) => l.concat(g.f.map((x) => ({ key: x[0], text: x[1], prompt: x[2], g: g.id }))), []);
const REVIEW_MS = 10000, ENROL_STEPS = [['Check the service details', 'Validating the service URL and contact email'], ['Send the enrolment request', 'POST /v1/services to the AISS API'], ['Create the service record', 'AISS registers the service and issues a reference'], ['Set up the accessibility statement', 'Creating the statement template for the service'], ['Confirm enrolment', 'Receiving the confirmation from AISS']], ENROL_STEP_MS = 2000;
let flowTimer = null;
const STMT_CHECKS = [['Reaching the statement', 'Fetching the statement page'], ['Matching it to your service', 'Checking it is published against your service'], ['Checking the AISS record', 'Confirming AISS holds the same statement']];
const aissUrl = (f) => 'https://accessibility-statements.education.gov.uk/services/' + encodeURIComponent(f.ref || '');
const REVIEW_STEPS = [['Form received', 'Logged with the Office of the Data Protection Officer'], ['Risk factors assessed', 'Checking your answers against the ICO list'], ['DPIA decision made', 'Deciding whether a DPIA is required or advised']];
const flowSteps = (idx, list) => '<ol class="enrol-steps">' + list.map((t, i) => '<li class="' + (i < idx ? 'done' : i === idx ? 'on' : '') + '"><span class="enrol-ic">' + (i < idx ? '✓' : i === idx ? '<span class="spin"></span>' : i + 1) + '</span><div class="enrol-tx"><strong>' + esc(t[0]) + '</strong><span>' + esc(t[1]) + '</span></div><span class="enrol-st">' + (i < idx ? 'Done' : i === idx ? 'In progress' : 'Waiting') + '</span></li>').join('') + '</ol>';
const flowKind = (a) => (a.title === 'Complete screener' ? 'screener' : a.title === 'Enrol service' ? 'enrol' : null);
function screenerOutcome(ans) {
  const yes = SCR_FACTORS.filter((f) => ans['f_' + f.key] === 'Yes'), ico = yes.filter((f) => f.g === 'g1'), other = yes.filter((f) => f.g !== 'g1');
  const list = (a) => a.map((f) => f.text.replace(/\.$/, '').toLowerCase()).join('; ');
  let dpia, advise, rationale;
  if (ico.length) { dpia = 'Yes'; advise = 'Yes'; rationale = 'The activity is on the ICO list of processing that requires a DPIA: ' + list(ico) + '.'; }
  else if (other.length >= 2) { dpia = 'Yes'; advise = 'Yes'; rationale = 'Two or more EDPB high-risk factors apply together: ' + list(other) + '.'; }
  else if (other.length === 1 || ans.major === 'Yes') { dpia = 'No'; advise = 'Yes'; rationale = (other.length ? 'One risk factor applies (' + list(other) + ')' : 'This is a major project') + '. A DPIA is not strictly required but the SRO should consider one.'; }
  else { dpia = 'No'; advise = 'No'; rationale = 'No high-risk factors were identified. No further data protection assessment is needed.'; }
  return { code: dpia === 'Yes' ? 'full' : advise === 'Yes' ? 'low' : 'none', dpia, advise, rationale,
    title: dpia === 'Yes' ? 'A DPIA is required' : advise === 'Yes' ? 'A DPIA is not required, but consider one' : 'No DPIA required', text: rationale };
}
function flowTick(a) {
  const f = a.flow; if (!f) return;
  if (f.stage === 'review' && Date.now() - f.start >= REVIEW_MS) {
    const o = screenerOutcome(f.answers); f.stage = 'outcome'; f.outcome = o; f.doneAt = now();
    a.updates.push({ at: now(), type: 'decision', text: 'Data protection review outcome: ' + o.title + '. ' + o.text });
    a.updates.push({ at: now(), type: 'system', text: 'Status changed from ' + a.status + ' to Complete.' }); a.status = 'Complete'; save();
  } else if (f.stage === 'enrolling' && Date.now() - f.start >= ENROL_STEPS.length * ENROL_STEP_MS) {
    f.stage = 'enrolled'; f.ref = 'AISS-' + (10000 + Math.floor(Math.random() * 89999)); f.doneAt = now();
    a.updates.push({ at: now(), type: 'evidence', text: 'Enrolment confirmed by AISS. Reference ' + f.ref + '.' });
    a.updates.push({ at: now(), type: 'system', text: 'Next: get the accessibility statement link from AISS and add it to the service.' }); save();
  } else if (f.stage === 'checking' && Date.now() - f.checkStart >= STMT_CHECKS.length * ENROL_STEP_MS) {
    f.stage = 'complete'; f.completeAt = now();
    a.updates.push({ at: now(), type: 'evidence', text: 'Accessibility statement linked from the service and verified.', link: f.stmt });
    a.updates.push({ at: now(), type: 'system', text: 'Status changed from ' + a.status + ' to Complete.' }); a.status = 'Complete'; save();
  }
}
function flowTracker(names, cur) {
  return '<ol class="flow-steps">' + names.map((n, i) => '<li class="' + (i < cur ? 'done' : i === cur ? 'on' : '') + '"><span class="flow-n">' + (i < cur ? '✓' : i + 1) + '</span>' + esc(n) + '</li>').join('') + '</ol>';
}
function flowPanel(a) {
  const k = flowKind(a); if (!k) return '';
  const w = S.works.find((x) => x.id === a.workId) || {}, f = a.flow;
  clearTimeout(flowTimer);
  if (f && (f.stage === 'review' || f.stage === 'enrolling' || f.stage === 'checking')) flowTimer = setTimeout(() => { if (location.hash.indexOf('#/actions/' + a.id) === 0) rerender(); }, 1000);
  const head = (t, p) => '<section class="flow"><h2 class="flow-t">' + t + '</h2>' + (p ? '<p class="flow-p">' + p + '</p>' : '');
  const again = '<p class="flow-p"><button type="button" class="link-btn" data-act="flow-reset" data-id="' + a.id + '">Start again</button></p>';
  if (k === 'screener') {
    const names = ['Complete the form', 'Submitted', 'Data protection review', 'Outcome'];
    const draft = !f || f.stage === 'draft', v = draft ? (f ? f.answers : screenerPrefill(w)) : {};
    const yn = (name, label, extra) => '<div class="govuk-form-group" id="fq-' + name + '"><fieldset class="govuk-fieldset"><legend class="govuk-fieldset__legend">' + label + '</legend><div class="fq-err"></div><div class="govuk-radios govuk-radios--small govuk-radios--inline" data-module="govuk-radios">' +
      ['Yes', 'No'].map((o) => '<div class="govuk-radios__item"><input class="govuk-radios__input" id="fq-' + name + '-' + o + '" name="' + name + '" type="radio" value="' + o + '"' + (v[name] === o ? ' checked' : '') + ' data-act="flow-yn"><label class="govuk-label govuk-radios__label" for="fq-' + name + '-' + o + '">' + o + '</label></div>').join('') + '</div></fieldset>' +
      (extra ? '<div class="fx"' + (v[name] === 'Yes' ? '' : ' hidden') + '><label class="govuk-label" for="fx-' + name + '">' + esc(extra) + '</label><textarea class="govuk-textarea" id="fx-' + name + '" name="x_' + name + '" rows="3">' + esc(v['x_' + name] || '') + '</textarea></div>' : '') + '</div>';
    const txt = (name, label, hint, rows, type) => '<div class="govuk-form-group" id="fq-' + name + '"><label class="govuk-label govuk-label--s" for="fq-' + name + '-t">' + label + (v.pre && v.pre.indexOf(name) >= 0 ? ' <span class="prefill">Pre-filled</span>' : '') + '</label>' + (hint ? '<div class="govuk-hint">' + hint + '</div>' : '') + '<div class="fq-err"></div>' +
      (rows ? '<textarea class="govuk-textarea" id="fq-' + name + '-t" name="' + name + '" rows="' + rows + '">' + esc(v[name] || '') + '</textarea>' : '<input class="govuk-input' + (type === 'email' ? '' : ' govuk-!-width-two-thirds') + '" id="fq-' + name + '-t" name="' + name + '" type="' + (type || 'text') + '" value="' + esc(v[name] || '') + '"' + (type === 'email' ? ' spellcheck="false"' : '') + '>') + '</div>';
    if (draft) {
      return head('High risk screening document', 'Completing this form is the evidence for this action. Save a draft at any time and come back to finish it. When you send it, the Office of the Data Protection Officer reviews it.') + flowTracker(names, 0) +
        (() => { const keys = ['name', 'team', 'uname', 'uemail', 'sro', 'what', 'why', 'wider', 'legislation', 'ai', 'major'].concat(SCR_FACTORS.map((x) => 'f_' + x.key)), done = keys.filter((k) => (v[k] || '').toString().trim()).length, pct = Math.round(done / keys.length * 100);
          return '<div class="enrol-card scr-sum"><div class="enrol-top"><div><strong>' + (f ? 'Draft saved ' + fmt(f.savedAt) : 'Not started') + '</strong><br><span class="muted">We have filled in ' + ((v.pre || []).length) + ' answers from <strong>' + esc(w.title || 'the work item') + '</strong> and your account. Check every answer. Nothing is sent until you choose Send.</span></div><div class="enrol-pct"><b>' + pct + '%</b><span class="muted">' + done + ' of ' + keys.length + ' answered</span></div></div>' + bar(pct, pct + '% answered') + '</div>'; })() +
        '<form id="flow-screener" data-id="' + a.id + '" novalidate><section class="fsec"><h3 class="flow-h"><span class="fnum">1</span>About your processing activity</h3><div class="fgrid">' +
        txt('name', 'Name of the processing activity') + txt('team', 'Group, directorate or team responsible') + txt('uname', 'Your name') + txt('uemail', 'Your email address', '', 0, 'email') + txt('sro', 'Senior Responsible Officer (SRO) for this activity') + '</div>' +
        yn('wider', 'Does this form part of a wider service, contract or activity?', 'Name of the service and how this activity fits into it') + txt('dpias', 'Linked DPIAs (optional)', 'Have you considered updating an existing DPIA instead? Does this replace one?', 2) +
        '</section><section class="fsec"><h3 class="flow-h"><span class="fnum">2</span>Describe the processing</h3>' + txt('what', 'What are you doing?', 'Do not use acronyms or terms only your work area will understand.', 3) + txt('why', 'Why are you doing it?', '', 3) +
        yn('legislation', 'Does it involve or require new legislation?', 'Give details') + yn('ai', 'Are you intending to use AI, such as machine learning or large language models?', 'Give details') +
        '</section><section class="fsec"><h3 class="flow-h"><span class="fnum">3</span>Risk factors</h3>' + '<p class="govuk-body">Read the definitions and guidance before you answer. For every Yes, explain why, with evidence that you meet the criteria.</p>' +
        SCR_GROUPS.map((g, gi) => '<div class="flow-group"><h4 class="flow-gt">Set ' + (gi + 1) + ' of ' + SCR_GROUPS.length + ': ' + esc(g.t) + '</h4>' + (g.hint ? '<p class="govuk-hint">' + esc(g.hint) + '</p>' : '') + g.f.map((x) => yn('f_' + x[0], esc(x[1]), x[2])).join('') + '</div>').join('') +
        '</section><section class="fsec"><h3 class="flow-h"><span class="fnum">4</span>Good practice</h3>' + yn('major', 'Is this a major project involving personal data, such as a high-profile new national programme?', 'Explain, with any relevant press coverage or historical background') +
        '</section><div class="flow-bar"><span class="flow-bar-t">Your answers are only sent when you choose Send.</span><div class="govuk-button-group"><button class="govuk-button" type="submit" data-module="govuk-button">Send to the data protection team</button><button type="button" class="govuk-button govuk-button--secondary" data-module="govuk-button" data-act="flow-draft" data-id="' + a.id + '">Save draft</button></div></div></form></section>';
    }
    const ys = SCR_FACTORS.filter((x) => f.answers['f_' + x.key] === 'Yes');
    const row = (k, v) => '<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">' + k + '</dt><dd class="govuk-summary-list__value">' + v + '</dd></div>';
    const ans = '<dl class="govuk-summary-list govuk-summary-list--no-border">' + row('Activity', esc(f.answers.name)) + row('Completed by', esc(f.answers.uname) + ', ' + esc(f.answers.uemail)) + row('Team', esc(f.answers.team)) + row('SRO', esc(f.answers.sro)) + row('What and why', esc(f.answers.what) + '<br>' + esc(f.answers.why)) +
      row('AI', esc(f.answers.ai || 'No') + (f.answers.x_ai ? ': ' + esc(f.answers.x_ai) : '')) + row('Major project', esc(f.answers.major || 'No')) +
      row('Risk factors', ys.length ? '<ul class="govuk-list govuk-list--bullet">' + ys.map((x) => '<li>' + esc(x.text) + (f.answers['x_f_' + x.key] ? '<br><span class="muted">' + esc(f.answers['x_f_' + x.key]) + '</span>' : '') + '</li>').join('') + '</ul>' : 'None') + '</dl>';
    const answersHtml = '<details class="govuk-details"><summary class="govuk-details__summary"><span class="govuk-details__summary-text">Your answers</span></summary><div class="govuk-details__text">' + ans + '</div></details>';
    if (f.stage === 'review') {
      const el = Date.now() - f.start, per = REVIEW_MS / REVIEW_STEPS.length, idx = Math.min(REVIEW_STEPS.length, Math.floor(el / per)), pct = Math.min(99, Math.round(el / REVIEW_MS * 100));
      return head('Being reviewed', 'The Office of the Data Protection Officer is reviewing your form. You do not need to do anything.') + flowTracker(names, 2) +
        '<div class="enrol-card"><div class="enrol-top"><div><strong>' + esc(f.answers.name || w.title || 'Screening form') + '</strong><br><span class="muted">Sent ' + fmt(f.submittedAt) + '</span></div><div class="enrol-pct"><b>' + pct + '%</b><span class="muted">Step ' + Math.min(idx + 1, REVIEW_STEPS.length) + ' of ' + REVIEW_STEPS.length + '</span></div></div>' + bar(pct, 'Review ' + pct + '% complete') + flowSteps(idx, REVIEW_STEPS) + '</div>' + answersHtml + '</section>';
    }
    const o = f.outcome, cls = o.code === 'full' ? '' : ' govuk-notification-banner--success';
    return head('Review outcome') + flowTracker(names, 4) + '<div class="govuk-notification-banner' + cls + '" role="alert"><div class="govuk-notification-banner__header"><h2 class="govuk-notification-banner__title">' + (o.code === 'full' ? 'Important' : 'Review complete') + '</h2></div><div class="govuk-notification-banner__content"><p class="govuk-notification-banner__heading">' + esc(o.title) + '</p><p class="govuk-body">' + esc(o.rationale) + '</p></div></div>' +
      '<div class="enrol-card"><h3 class="flow-h">Data protection team review</h3><dl class="govuk-summary-list"><div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">DPIA required by UK GDPR or the ICO?</dt><dd class="govuk-summary-list__value">' + esc(o.dpia) + '</dd></div><div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">SRO should consider a DPIA anyway?</dt><dd class="govuk-summary-list__value">' + esc(o.advise) + '</dd></div><div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Reviewed by</dt><dd class="govuk-summary-list__value">Office of the Data Protection Officer, ' + fmt(f.doneAt) + '</dd></div></dl>' + flowSteps(REVIEW_STEPS.length, REVIEW_STEPS) + '</div>' + answersHtml + again + '</section>';
  }
  const names = ['Confirm details', 'Enrolling with AISS', 'Get statement link', 'Complete'];
  if (!f) {
    return head('Enrol in the Accessibility Issues and Statement Service (AISS)', 'Enrolment is sent to AISS for you. Check the details, then start.') + flowTracker(names, 0) +
      '<form id="flow-enrol" data-id="' + a.id + '" novalidate><dl class="govuk-summary-list"><div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Service</dt><dd class="govuk-summary-list__value">' + esc(w.title || '') + '</dd></div><div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Stage</dt><dd class="govuk-summary-list__value">' + esc(w.stage || '') + '</dd></div></dl>' +
      '<div class="govuk-form-group" id="fe-url"><label class="govuk-label govuk-label--s" for="fe-url-t">Service URL</label><div class="fq-err"></div><input class="govuk-input" id="fe-url-t" name="url" type="url" value="https://' + esc((w.title || 'service').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')) + '.service.gov.uk"></div>' +
      '<div class="govuk-form-group" id="fe-email"><label class="govuk-label govuk-label--s" for="fe-email-t">Contact email for accessibility issues</label><div class="fq-err"></div><input class="govuk-input" id="fe-email-t" name="email" type="email" spellcheck="false" value="' + esc(CURRENT_USER.email) + '"></div>' +
      '<button class="govuk-button" type="submit" data-module="govuk-button">Enrol service</button></form></section>';
  }
  const stepsHtml = (idx, list) => '<ol class="enrol-steps">' + (list || ENROL_STEPS).map((t, i) => {
    const st = i < idx ? 'done' : i === idx ? 'on' : '';
    return '<li class="' + st + '"><span class="enrol-ic">' + (i < idx ? '✓' : i === idx ? '<span class="spin"></span>' : i + 1) + '</span><div class="enrol-tx"><strong>' + esc(t[0]) + '</strong><span>' + esc(t[1]) + '</span></div><span class="enrol-st">' + (i < idx ? 'Done' : i === idx ? 'In progress' : 'Waiting') + '</span></li>';
  }).join('') + '</ol>';
  if (f.stage === 'enrolling') {
    const el = Date.now() - f.start, total = ENROL_STEPS.length * ENROL_STEP_MS, idx = Math.min(ENROL_STEPS.length, Math.floor(el / ENROL_STEP_MS)), pct = Math.min(99, Math.round(el / total * 100));
    return head('Enrolling with AISS', 'We are sending your service to the Accessibility Issues and Statement Service. You do not need to do anything.') + flowTracker(names, 1) +
      '<div class="enrol-card"><div class="enrol-top"><div><strong>' + esc(w.title || 'Service') + '</strong><br><span class="muted">' + esc(f.url) + '</span></div><div class="enrol-pct"><b>' + pct + '%</b><span class="muted">Step ' + Math.min(idx + 1, ENROL_STEPS.length) + ' of ' + ENROL_STEPS.length + '</span></div></div>' + bar(pct, 'Enrolment ' + pct + '% complete') + stepsHtml(idx) + '</div></section>';
  }
  const done = f.stage === 'complete', bannerLink = aissUrl(f);
  const receipt = JSON.stringify({ status: 'enrolled', reference: f.ref, service: w.title, url: f.url, contact: f.email, enrolledAt: f.doneAt }, null, 2);
  const banner = '<div class="govuk-notification-banner govuk-notification-banner--success" role="alert"><div class="govuk-notification-banner__header"><h2 class="govuk-notification-banner__title">Success</h2></div><div class="govuk-notification-banner__content"><p class="govuk-notification-banner__heading">' + esc(w.title || 'The service') + ' is enrolled in AISS</p><p class="govuk-body">Reference <strong>' + esc(f.ref) + '</strong>. AISS will email ' + esc(f.email) + ' when accessibility checks are due.</p></div></div>';
  const receiptHtml = '<details class="govuk-details"><summary class="govuk-details__summary"><span class="govuk-details__summary-text">Response from AISS</span></summary><div class="govuk-details__text"><pre class="api-out">' + esc(receipt) + '</pre></div></details>';
  if (f.stage === 'enrolled') {
    return head('Add your accessibility statement') + flowTracker(names, 2) + banner +
      '<div class="enrol-card"><h3 class="flow-h">Get your statement link from AISS</h3><p class="govuk-body">AISS has created an accessibility statement for ' + esc(w.title || 'your service') + '. Open it, complete any missing sections, then copy the public link and add it to your service footer.</p><p><a class="govuk-button govuk-button--secondary" data-module="govuk-button" href="' + esc(bannerLink) + '" target="_blank" rel="noopener noreferrer">Open your statement in AISS (opens in new tab)</a></p>' +
      '<form id="flow-stmt" data-id="' + a.id + '" novalidate><div class="govuk-form-group" id="fs-url"><label class="govuk-label govuk-label--s" for="fs-url-t">Link to your accessibility statement</label><div class="govuk-hint">The link you have added to your service, for example ' + esc(f.url) + '/accessibility</div><div class="fq-err"></div><input class="govuk-input" id="fs-url-t" name="stmt" type="url" spellcheck="false" value="' + esc((f.stmtDraft || '')) + '"></div><button class="govuk-button" type="submit" data-module="govuk-button">Check and complete</button></form></div>' + receiptHtml + again + '</section>';
  }
  if (f.stage === 'checking') {
    const el = Date.now() - f.checkStart, idx = Math.min(STMT_CHECKS.length, Math.floor(el / ENROL_STEP_MS)), pct = Math.min(99, Math.round(el / (STMT_CHECKS.length * ENROL_STEP_MS) * 100));
    return head('Checking your statement') + flowTracker(names, 2) + '<div class="enrol-card"><div class="enrol-top"><div><strong>Verifying your accessibility statement</strong><br><span class="muted">' + esc(f.stmt) + '</span></div><div class="enrol-pct"><b>' + pct + '%</b></div></div>' + bar(pct, 'Checks ' + pct + '% complete') + stepsHtml(idx, STMT_CHECKS) + '</div></section>';
  }
  return head('Enrolment complete') + flowTracker(names, 4) + banner +
    '<div class="enrol-card"><h3 class="flow-h">Accessibility statement</h3><dl class="govuk-summary-list"><div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Statement link</dt><dd class="govuk-summary-list__value"><a class="govuk-link" href="' + esc(f.stmt) + '" target="_blank" rel="noopener noreferrer">' + esc(f.stmt) + '</a></dd></div><div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Managed in AISS</dt><dd class="govuk-summary-list__value"><a class="govuk-link" href="' + esc(bannerLink) + '" target="_blank" rel="noopener noreferrer">Edit statement in AISS</a></dd></div><div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Verified</dt><dd class="govuk-summary-list__value">' + fmt(f.completeAt) + '</dd></div></dl>' + stepsHtml(STMT_CHECKS.length, STMT_CHECKS) + '</div>' + receiptHtml + again + '</section>';
}
function saveDraft(form) {
  const a = S.actions.find((x) => x.id === form.dataset.id); if (!a) return;
  const d = formData(form), answers = {}; Object.keys(d).forEach((k) => { answers[k] = typeof d[k] === 'string' ? d[k].trim() : d[k]; });
  if (isBlocked(a)) return;
  const first = !a.flow;
  a.flow = { stage: 'draft', answers, savedAt: now() };
  if (first) a.updates.push({ at: now(), type: 'system', text: 'Started the High Risk Screening Document (draft saved).' });
  if (a.status === 'Not started') { a.updates.push({ at: now(), type: 'system', text: 'Status changed from Not started to In progress.' }); a.status = 'In progress'; }
  save(); flash = { title: 'Success', html: '<p class="govuk-notification-banner__heading">Draft saved. You can finish it later.</p>' }; rerender();
}
function flowErr(form, key, msg) {
  const g = form.querySelector('#' + key); if (!g) return;
  g.classList.add('govuk-form-group--error'); const e = g.querySelector('.fq-err'); e.innerHTML = '<p class="govuk-error-message"><span class="govuk-visually-hidden">Error:</span> ' + esc(msg) + '</p>';
}
function submitFlow(form) {
  const a = S.actions.find((x) => x.id === form.dataset.id); if (!a || isBlocked(a)) return;
  const d = formData(form); let bad = 0;
  form.querySelectorAll('.govuk-form-group--error').forEach((g) => { g.classList.remove('govuk-form-group--error'); g.querySelector('.fq-err').innerHTML = ''; });
  if (form.id === 'flow-screener') {
    const req = (k, m) => { if (!(d[k] || '').trim()) { flowErr(form, 'fq-' + k, m); bad++; } };
    ['name:Enter the name of the processing activity', 'uname:Enter your name', 'uemail:Enter your email address',  'team:Enter the team responsible', 'sro:Enter the Senior Responsible Officer', 'what:Enter what you are doing', 'why:Enter why you are doing it'].forEach((x) => req(x.split(':')[0], x.split(':')[1]));
    ['wider', 'legislation', 'ai', 'major'].concat(SCR_FACTORS.map((x) => 'f_' + x.key)).forEach((k) => {
      if (!d[k]) { flowErr(form, 'fq-' + k, 'Select yes or no'); bad++; }
      else if (d[k] === 'Yes' && /^(f_|major$)/.test(k) && !(d['x_' + k] || '').trim()) { flowErr(form, 'fq-' + k, 'Explain why you answered yes'); bad++; }
    });
    if (bad) { const g = form.querySelector('.govuk-form-group--error'); if (g) g.scrollIntoView({ block: 'center' }); return; }
    const answers = {}; Object.keys(d).forEach((k) => { answers[k] = typeof d[k] === 'string' ? d[k].trim() : d[k]; });
    a.flow = { stage: 'review', answers, start: Date.now(), submittedAt: now(), savedAt: a.flow && a.flow.savedAt };
    const n = SCR_FACTORS.filter((x) => answers['f_' + x.key] === 'Yes').length;
    a.updates.push({ at: now(), type: 'evidence', text: 'High risk screening document submitted for review (' + n + ' risk factor' + (n === 1 ? '' : 's') + ' identified).' });
    a.updates.push({ at: now(), type: 'system', text: 'Sent to the Office of the Data Protection Officer for review.' });
  } else if (form.id === 'flow-stmt') {
    const f = a.flow, u = (d.stmt || '').trim(); f.stmtDraft = u; let host = '', svc = '';
    try { host = new URL(u).hostname; svc = new URL(f.url).hostname; } catch (e) { host = ''; }
    if (!host || !/^https:/i.test(u)) flowErr(form, 'fs-url', 'Enter the full link, starting with https://');
    else if (!/accessib/i.test(u)) flowErr(form, 'fs-url', 'The link should go to your accessibility statement, for example ' + f.url + '/accessibility');
    else if (host !== svc && !/\.gov\.uk$/.test(host)) flowErr(form, 'fs-url', 'The statement must be on your service (' + svc + ') or a gov.uk domain');
    else { f.stmt = u; f.stage = 'checking'; f.checkStart = Date.now(); a.updates.push({ at: now(), type: 'system', text: 'Statement link submitted for verification: ' + u }); save(); rerender(); return; }
    save(); return;
  } else {
    if (!/^https?:\/\/\S+\.\S+/i.test((d.url || '').trim())) { flowErr(form, 'fe-url', 'Enter a service URL that starts with https://'); bad++; }
    if (!/^\S+@\S+\.\S+$/.test((d.email || '').trim())) { flowErr(form, 'fe-email', 'Enter an email address, like name@example.gov.uk'); bad++; }
    if (bad) return;
    a.flow = { stage: 'enrolling', url: d.url.trim(), email: d.email.trim(), start: Date.now() };
    a.updates.push({ at: now(), type: 'system', text: 'Enrolment request sent to AISS for ' + a.flow.url + '.' });
  }
  if (a.status !== 'In progress') { a.updates.push({ at: now(), type: 'system', text: 'Status changed from ' + a.status + ' to In progress.' }); a.status = 'In progress'; }
  save(); rerender();
}
function openAddAction(workId) {
  const w = S.works.find((x) => x.id === workId); if (!w) return;
  const groups = reqGroups(workId).filter((g) => g.ruleId);
  openModal(modalHead(w.title, 'Add an action') +
    '<form id="addaction-form" data-work="' + workId + '" novalidate><div class="govuk-form-group"><label class="govuk-label govuk-label--s" for="na-title">What needs to be done?</label><input class="govuk-input" id="na-title" name="title" type="text"></div>' +
    '<div class="govuk-form-group"><label class="govuk-label govuk-label--s" for="na-rule">Which requirement does it belong to?</label><select class="govuk-select" id="na-rule" name="rule"><option value="">Other actions</option>' + groups.map((g) => '<option value="' + esc(g.ruleId) + '">' + esc(g.title) + '</option>').join('') + '</select></div>' +
    '<div class="govuk-form-group"><label class="govuk-label govuk-label--s" for="na-desc">Details (optional)</label><textarea class="govuk-textarea" id="na-desc" name="description" rows="3"></textarea></div>' +
    '<div class="govuk-form-group"><label class="govuk-label govuk-label--s" for="na-ev">Expected evidence (optional)</label><input class="govuk-input" id="na-ev" name="evidence" type="text"></div>' +
    '<div class="govuk-checkboxes govuk-checkboxes--small govuk-form-group" data-module="govuk-checkboxes"><div class="govuk-checkboxes__item"><input class="govuk-checkboxes__input" id="na-legal" name="legal" type="checkbox" value="1"><label class="govuk-label govuk-checkboxes__label" for="na-legal">This is a legal requirement</label></div></div>' +
    '<div id="act-err" role="alert"></div><div class="govuk-button-group"><button class="govuk-button" type="submit" data-module="govuk-button" data-prevent-double-click="true">Add action</button><button type="button" class="govuk-button govuk-button--secondary" data-act="dialog-close">Cancel</button></div></form>', 'wide');
  const t = document.getElementById('na-title'); if (t) t.focus();
}
function saveAddAction(form) {
  const d = formData(form), title = (d.title || '').trim(), err = document.getElementById('act-err');
  if (!title) { err.innerHTML = '<p class="govuk-error-message"><span class="govuk-visually-hidden">Error:</span> Enter what needs to be done</p>'; return; }
  const rule = d.rule ? ruleOf(d.rule) : null;
  S.actions.push({ id: uid('ACT'), workId: form.dataset.work, ruleId: d.rule || null, title, description: (d.description || '').trim(), evidence: (d.evidence || '').trim(), legal: !!d.legal, status: 'Not started', created: now(), custom: true,
    updates: [{ at: now(), type: 'system', text: 'Action added manually' + (rule ? ' to ' + rule.requirementTitle : '') + '.' }] });
  save(); flash = { title: 'Success', html: '<p class="govuk-notification-banner__heading">Action added.</p>' }; closeDialog(); rerender();
}
function openActivity(id, type) {
  const a = S.actions.find((x) => x.id === id); if (!a) return;
  openModal(modalHead(a.id + ' · ' + a.title, 'Record activity') +
    '<form id="activity-form" data-id="' + id + '" novalidate><div class="govuk-form-group"><fieldset class="govuk-fieldset"><legend class="govuk-fieldset__legend govuk-fieldset__legend--s">What are you recording?</legend><div class="govuk-radios govuk-radios--small" data-module="govuk-radios">' +
    ACT_TYPES.map((t) => '<div class="govuk-radios__item"><input class="govuk-radios__input" id="at-' + t[0] + '" name="type" type="radio" value="' + t[0] + '"' + (t[0] === type ? ' checked' : '') + ' data-act="act-type"><label class="govuk-label govuk-radios__label" for="at-' + t[0] + '">' + t[1] + '</label><div class="govuk-hint govuk-radios__hint">' + t[2] + '</div></div>').join('') + '</div></fieldset></div>' +
    '<div class="govuk-form-group"><label class="govuk-label govuk-label--s" for="a-text">Details</label><textarea class="govuk-textarea" id="a-text" name="text" rows="3"></textarea></div>' +
    '<div class="govuk-form-group"><label class="govuk-label govuk-label--s" for="a-link">Link (optional)</label><div class="govuk-hint">For example a document, ticket or decision record.</div><input class="govuk-input" id="a-link" name="link" type="url" inputmode="url"></div>' +
    '<div class="govuk-form-group"><fieldset class="govuk-fieldset"><legend class="govuk-fieldset__legend govuk-fieldset__legend--s">Status after this update</legend><div class="govuk-radios govuk-radios--small govuk-radios--inline" data-module="govuk-radios">' +
    STATUSES.filter((s) => s !== 'No longer required').map((s, i) => '<div class="govuk-radios__item"><input class="govuk-radios__input" id="as-' + i + '" name="status" type="radio" value="' + s + '"' + (s === a.status ? ' checked' : '') + '><label class="govuk-label govuk-radios__label" for="as-' + i + '">' + s + '</label></div>').join('') + '</div></fieldset></div>' +
    '<div id="act-err" role="alert"></div><div class="govuk-button-group"><button class="govuk-button" type="submit" data-module="govuk-button" data-prevent-double-click="true">Save</button><button type="button" class="govuk-button govuk-button--secondary" data-module="govuk-button" data-act="dialog-close">Cancel</button></div></form>', 'wide');
}
function saveActivity(form) {
  const a = S.actions.find((x) => x.id === form.dataset.id), d = formData(form), err = document.getElementById('act-err');
  const type = d.type || 'note', body = (d.text || '').trim(), link = (d.link || '').trim(), status = d.status || a.status;
  const bad = (m) => { err.innerHTML = '<p class="govuk-error-message"><span class="govuk-visually-hidden">Error:</span> ' + esc(m) + '</p>'; };
  if (gate(a, status)) return bad(gate(a, status));
  if (link && !/^https?:\/\/\S+$/i.test(link)) return bad('Enter a link that starts with http:// or https://');
  if (type === 'evidence' && !body && !link) return bad('Describe the evidence or add a link to it');
  if (type !== 'note' && !body && !link) return bad('Enter details of the ' + type);
  if (!body && !link && status === a.status) return bad('Enter details or change the status');
  if (status === 'Complete' && actDef(a).legal && !evCount(a) && !(type === 'evidence' && (body || link))) return bad('This is a legal requirement. Add evidence before marking it complete.');
  if (body || link) a.updates.push({ at: now(), type, text: body, link });
  if (status !== a.status) { a.updates.push({ at: now(), type: 'system', text: 'Status changed from ' + a.status + ' to ' + status + '.' }); a.status = status; }
  save(); flash = { title: 'Success', html: '<p class="govuk-notification-banner__heading">' + (type === 'evidence' ? 'Evidence added.' : 'Activity recorded.') + '</p>' };
  closeDialog(); rerender();
}
document.addEventListener('submit', (e) => {
  const f = e.target;
  if (f.id === 'cats-form') { e.preventDefault(); e.stopImmediatePropagation(); applyCats(f); }
  else if (f.id === 'activity-form') { e.preventDefault(); e.stopImmediatePropagation(); saveActivity(f); }
  else if (f.id === 'flow-screener' || f.id === 'flow-enrol' || f.id === 'flow-stmt') { e.preventDefault(); e.stopImmediatePropagation(); submitFlow(f); }
  else if (f.id === 'addaction-form') { e.preventDefault(); e.stopImmediatePropagation(); saveAddAction(f); }
}, true);
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-act]'); if (!t) return;
  if (t.dataset.act === 'cats-open') openCats(t.dataset.id, t.dataset.field || '');
  else if (t.dataset.act === 'activity-open') openActivity(t.dataset.id, t.dataset.type);
  else if (t.dataset.act === 'flow-draft') saveDraft(t.closest('form'));
  else if (t.dataset.act === 'flow-reset') { const a = S.actions.find((x) => x.id === t.dataset.id); if (a) { delete a.flow; a.updates.push({ at: now(), type: 'system', text: 'Workflow restarted.' }); save(); rerender(); } }
  else if (t.dataset.act === 'add-action-open') openAddAction(t.dataset.id);
});
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset && t.dataset.act === 'act-type' && t.form) {
    const a = S.actions.find((x) => x.id === t.form.dataset.id), r = t.form.querySelector('input[name=status][value="' + (t.value === 'exception' ? 'Exception' : a.status) + '"]');
    if (r) r.checked = true;
  }
});

let dragId = null;
document.addEventListener('dragstart', (e) => { const c = e.target.closest && e.target.closest('.kcard'); if (!c) return; dragId = c.dataset.id; c.classList.add('dragging'); if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId); } });
document.addEventListener('dragend', () => { dragId = null; document.querySelectorAll('.dragging,.over').forEach((x) => x.classList.remove('dragging', 'over')); });
document.addEventListener('dragover', (e) => { const c = e.target.closest && e.target.closest('.col'); if (c && dragId) { e.preventDefault(); document.querySelectorAll('.col.over').forEach((x) => x !== c && x.classList.remove('over')); c.classList.add('over'); } });
document.addEventListener('drop', (e) => { const c = e.target.closest && e.target.closest('.col'); if (c && dragId) { e.preventDefault(); moveAction(dragId, c.dataset.status); dragId = null; } });
function moveAction(id, status) {
  const a = S.actions.find((x) => x.id === id);
  const gm = a ? gate(a, status) : '';
  if (gm) { flash = { title: 'Important', html: '<p class="govuk-notification-banner__heading">' + esc(gm) + '</p>' }; rerender(); return; }
  if (a && STATUSES.indexOf(status) > -1 && a.status !== status) { a.updates.push({ at: now(), type: 'system', text: 'Moved on board from ' + a.status + ' to ' + status + '.' }); a.status = status; save(); }
  rerender();
}

window.addEventListener('hashchange', () => { closeDialog(); ERR = {}; workDraft = null; render(); });
render();
})();

document.addEventListener('submit', (e) => {
  const f = e.target.closest('form[data-form=global-search]'); if (!f) return;
  e.preventDefault(); const v = f.elements.q.value.trim(); go('#/actions' + (v ? '?q=' + encodeURIComponent(v) : ''));
});
