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
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.works) return d; } catch (e) { /* fall through */ }
  return seed();
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
function actionDefList(r) {
  return '<ol class="act-list">' + r.actions.map((a) => '<li><p class="govuk-body govuk-!-margin-bottom-1"><strong>' + esc(a.title) + '</strong> ' + legalTag(a) + '</p>' +
    '<p class="govuk-body-s govuk-!-margin-bottom-1">' + (a.description ? esc(a.description) : '<span class="muted">No description yet.</span>') + '</p>' +
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
  if (!r.versions) r.versions = [{ v: 1, at: now(), by: 'System', note: 'Initial version.', snap: snapOf(r) }];
  return r;
}
// The editable content of a rule, stored against each version so versions can be compared and restored.
const SNAP_KEYS = ['name', 'source', 'owner', 'status', 'conditions', 'requirementTitle', 'requirementDescription', 'tasks', 'actions', 'conditionsText', 'mandatory', 'why', 'kind', 'category', 'phases', 'standards', 'systems', 'guidance'];
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
  return groups;
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
  '<h3 class="kcard-title"><a class="govuk-link govuk-link--no-visited-state" href="#/actions/' + a.id + '">' + esc(a.title) + '</a></h3>' +
  '<p class="kcard-work">' + esc(reqTitle(a)) + '<br><a class="govuk-link govuk-link--no-visited-state" href="#/work/' + a.workId + '">' + esc(workName(a.workId)) + '</a></p>' +
  '<div class="kcard-foot">' + evBadge(a) + (actLegal(a) ? tag('Legal', 'govuk-tag--red') : '') + '<button type="button" class="link-btn" data-act="activity-open" data-id="' + a.id + '" data-type="evidence">Record activity<span class="govuk-visually-hidden"> for ' + esc(a.title) + '</span></button></div></article>';
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
  return '<tr class="govuk-table__row"><td class="govuk-table__cell"><a class="govuk-link govuk-link--no-visited-state" href="#/actions/' + a.id + '">' + esc(a.title) + '</a> <span class="muted">' + a.id + '</span>' +
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
function vRules() {
  const p = qs(), q = (p.get('q') || '').trim().toLowerCase(), fo = p.get('owner') || '', fs = p.get('source') || '', fe = p.get('status') || '', sort = p.get('sort') || 'id';
  const count = (r) => S.works.filter((w) => ruleMatches(w, r)).length;
  let list = S.rules.filter((r) => (!q || [r.id, r.name, r.source, r.owner, r.requirementTitle].join(' ').toLowerCase().includes(q)) &&
    (!fo || (fo === '__none' ? !r.owner : r.owner === fo)) && (!fs || r.source === fs) && (!fe || r.status === fe));
  const cmp = { id: (a, b) => a.id.localeCompare(b.id), name: (a, b) => a.name.localeCompare(b.name), owner: (a, b) => (a.owner || '\uffff').localeCompare(b.owner || '\uffff') || a.name.localeCompare(b.name),
    source: (a, b) => a.source.localeCompare(b.source) || a.name.localeCompare(b.name), work: (a, b) => count(b) - count(a) || a.name.localeCompare(b.name), status: (a, b) => (b.status === 'Published') - (a.status === 'Published') || a.id.localeCompare(b.id) };
  list = list.slice().sort(cmp[sort] || cmp.id);
  const opt = (v, l, cur) => '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(l) + '</option>';
  const owners = Array.from(new Set(S.rules.map((r) => r.owner).filter(Boolean))).sort(), sources = Array.from(new Set(S.rules.map((r) => r.source))).sort();
  const sel = (name, label, opts) => '<div class="govuk-form-group"><label class="govuk-label govuk-label--s" for="rf-' + name + '">' + label + '</label><select class="govuk-select" id="rf-' + name + '" name="' + name + '" data-act="rule-filter">' + opts + '</select></div>';
  const filtered = q || fo || fs;
  const pool = S.rules.filter((r) => (!q || [r.id, r.name, r.source, r.owner, r.requirementTitle].join(' ').toLowerCase().includes(q)) && (!fo || (fo === '__none' ? !r.owner : r.owner === fo)) && (!fs || r.source === fs));
  const pg = paged(list, p);
  const bar = '<form class="filter-bar" data-form="rule-filter" role="search" aria-label="Filter and sort rules">' + (fe ? '<input type="hidden" name="status" value="' + esc(fe) + '">' : '') + '<div class="govuk-form-group"><label class="govuk-label govuk-label--s" for="rf-q">Search</label><input class="govuk-input" id="rf-q" name="q" type="search" value="' + esc(p.get('q') || '') + '" placeholder="Name, ID, policy or owner"></div>' +
    sel('owner', 'Owner', opt('', 'All owners', fo) + opt('__none', 'Unassigned', fo) + owners.map((o) => opt(o, o, fo)).join('')) +
    sel('source', 'Policy or standard', opt('', 'All', fs) + sources.map((o) => opt(o, o, fs)).join('')) +
    sel('sort', 'Sort by', RULE_SORTS.map((o) => opt(o[0], o[1], sort)).join('')) +
    '<div class="govuk-form-group filter-bar__actions"><button class="govuk-button govuk-button--secondary" data-module="govuk-button" type="submit">Apply</button>' + (filtered || sort !== 'id' ? ' <a class="govuk-link" href="#/rules">Clear</a>' : '') + '</div></form>';
  return banner() + pageHead('Rules', 'Rulesets based on policies, standards and processes. They run on trigger events and return requirements.', btn('#/rules/new', 'Add rule')) + bar +
    tabsNav('rules', p, 'status', [['', 'All', pool.length], ['Published', 'Published', pool.filter((r) => r.status === 'Published').length], ['Draft', 'Draft', pool.filter((r) => r.status === 'Draft').length], ['Retired', 'Retired', pool.filter((r) => r.status === 'Retired').length]], '', 'Rule status') +
    (pg.items.length ? '' : '<div class="panel"><p class="govuk-body">No rules match these filters.</p></div>') + (pg.items.length ? table(['Rule', 'Owner', 'When', 'Requirement returned', 'Applies to', 'Status'], pg.items.map((r) => {
      const n = count(r);
      return [ruleChip(r.id) + '<br><a class="govuk-link" href="#/rules/' + r.id + '">' + esc(r.name) + '</a><br><span class="govuk-body-s">' + esc(r.source) + '</span>', ownerCell(r),
        r.conditions.map((c) => esc(condText(c))).join('<br>and '), esc(r.requirementTitle), n + ' work item' + (n === 1 ? '' : 's'), statusRule(r) + '<br><span class="muted">Version ' + r.version + '</span>'];
    }), 'compact') + pager('rules', p, pg) : '');
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
    (area ? '<textarea class="govuk-textarea" id="a' + k + '-' + i + '" name="a' + k + i + '" rows="2">' + esc(a[k]) + '</textarea>' : '<input class="govuk-input" id="a' + k + '-' + i + '" name="a' + k + i + '" value="' + esc(a[k]) + '">') + '</div>';
  return '<section class="act-edit"><div class="act-edit__head"><h3 class="govuk-heading-s govuk-!-margin-bottom-0">Action ' + (i + 1) + '</h3><button type="button" class="govuk-button govuk-button--warning govuk-!-margin-bottom-0" data-module="govuk-button" data-act="action-remove" data-i="' + i + '">Remove<span class="govuk-visually-hidden"> action ' + (i + 1) + '</span></button></div>' +
    f('title', 'Action') + f('description', 'What this action involves', true) + f('evidence', 'Expected evidence', true, 'What the team should attach or record to show it is done, for example a report, approval or link.') +
    '<div class="govuk-checkboxes govuk-checkboxes--small govuk-form-group" data-module="govuk-checkboxes"><div class="govuk-checkboxes__item"><input class="govuk-checkboxes__input" type="checkbox" id="alegal-' + i + '" name="alegal' + i + '" value="1"' + (a.legal ? ' checked' : '') + '><label class="govuk-label govuk-checkboxes__label" for="alegal-' + i + '">Legal requirement</label></div></div></section>';
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
const byPrio = (a, b) => actPrio(a) - actPrio(b) || a.id.localeCompare(b.id);
const recordBtn = (a, label) => '<button type="button" class="govuk-button govuk-button--secondary btn-sm" data-module="govuk-button" data-act="activity-open" data-id="' + a.id + '" data-type="evidence">' + (label || 'Record activity') + '<span class="govuk-visually-hidden"> for ' + esc(a.title) + '</span></button>';
const workLink = (id) => '<a class="govuk-link govuk-link--no-visited-state" href="#/work/' + id + '">' + esc(workName(id)) + '</a>';
const nextAction = (w) => S.actions.filter((a) => a.workId === w.id && isOpen(a)).sort(byPrio)[0];

const DOT = { 'Not started': 'grey', 'In progress': 'blue', 'Exception': 'orange', 'Complete': 'green', 'No longer required': 'grey' };
function qrow(a, showWork) {
  const flag = a.status === 'Exception' ? '<span class="flag flag--orange">Exception</span>' : a.status === 'Complete' ? (evCount(a) ? '' : '<span class="flag flag--yellow">No evidence</span>') : actLegal(a) ? '<span class="flag flag--red">Legal</span>' : '';
  return '<li class="qrow"><span class="dot dot--' + DOT[a.status] + '" aria-hidden="true"></span><div class="qrow-m"><a class="qrow-t govuk-link govuk-link--no-visited-state" href="#/actions/' + a.id + '">' + esc(a.title) + '</a><span class="qrow-s">' + (showWork === false ? '' : esc(workName(a.workId)) + ' · ') + esc(reqTitle(a)) + '</span></div><div class="qrow-r">' + flag + '<span class="qrow-st">' + a.status + '</span></div></li>';
}
function workRow(w) {
  const acts = S.actions.filter((a) => a.workId === w.id && isActive(a)), open = acts.filter(isOpen), p = workPct(w.id);
  const legal = open.filter(actLegal).length, exc = acts.filter((a) => a.status === 'Exception').length;
  return '<li class="wrow"><div class="wrow-main"><h2 class="wrow-title"><a class="govuk-link govuk-link--no-visited-state" href="#/work/' + w.id + '">' + esc(w.title) + '</a></h2>' +
    '<p class="wrow-desc">' + esc(w.stage) + ' · ' + esc(w.type) + (w.risk === 'High' ? ' · <strong class="red">High risk</strong>' : '') + '</p></div>' +
    '<div class="wrow-prog">' + bar(p, p + '% of actions complete') + '<span class="muted">' + (acts.length - open.length) + ' of ' + acts.length + ' done</span></div>' +
    '<div class="wrow-flags">' + (exc ? '<span class="flag flag--orange">' + exc + ' exception' + (exc === 1 ? '' : 's') + '</span>' : '') + (legal ? '<span class="flag flag--red">' + legal + ' legal</span>' : '') + (!exc && !legal ? '<span class="flag flag--green">On track</span>' : '') + '</div>' +
    '<button type="button" class="link-btn wrow-chg" data-act="cats-open" data-id="' + w.id + '">Change categories<span class="govuk-visually-hidden"> for ' + esc(w.title) + '</span></button></li>';
}

function vWork() {
  const p = qs(), q = (p.get('q') || '').trim().toLowerCase(), st = p.get('stage') || '', pr = p.get('priority') || '', tab = p.get('tab') || 'all';
  const base = S.works.filter((w) => (!q || [w.id, w.title, w.description].join(' ').toLowerCase().includes(q)) && (!st || w.stage === st) && (!pr || w.priority === pr));
  const blocked = (w) => S.actions.some((a) => a.workId === w.id && (a.status === 'Exception' || (isOpen(a) && actLegal(a))));
  const list = base.filter((w) => tab === 'all' || (tab === 'attention' ? blocked(w) : workPct(w.id) < 100)).sort((a, b) => (blocked(b) - blocked(a)) || a.id.localeCompare(b.id));
  const fb = filterForm('work', p, [{ type: 'search', name: 'q', label: 'Search', ph: 'Title, ID or description' },
    { name: 'stage', label: 'Stage', opts: [['', 'All stages']].concat(OPT.stage.map((o) => [o, o])) }, { name: 'priority', label: 'Priority', opts: [['', 'Any priority']].concat(OPT.level.map((o) => [o, o])) }], ['tab']);
  return banner() + pageHead('Work', 'Everything in flight. Change a work item\'s categories and the rules engine updates what applies.', btn('#/work/new', 'Add work')) +
    tabsNav('work', p, 'tab', [['all', 'All work', base.length], ['attention', 'Needs attention', base.filter(blocked).length], ['active', 'In progress', base.filter((w) => workPct(w.id) < 100).length]], 'all', 'Work filter') + fb +
    (list.length ? '<ul class="wlist">' + list.map(workRow).join('') + '</ul>' : '<div class="panel"><p class="govuk-body">No work matches these filters.</p></div>');
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
      (pg.items.length ? '<ul class="qlist">' + pg.items.map((a) => qrow(a)).join('') + '</ul>' + pager('actions', p, pg) : '<div class="panel"><p class="govuk-body">No actions match these filters.</p></div>');
  }
  return banner() + pageHead('Actions', 'Every requirement the rules engine has raised. Exceptions and legal requirements come first.', seg) + fb + body;
}

function vTasks() {
  const p = qs(), show = p.get('show') || 'open', wf = p.get('work') || '';
  const list = S.actions.filter((a) => isActive(a) && (!wf || a.workId === wf) && (show === 'all' || isOpen(a))).sort(byPrio);
  const works = S.works.filter((w) => list.some((a) => a.workId === w.id));
  const html = works.map((w) => {
    const l = list.filter((a) => a.workId === w.id), pc = workPct(w.id);
    return '<section class="panel"><div class="tgroup-head"><h2 class="govuk-heading-s govuk-!-margin-bottom-0"><a class="govuk-link govuk-link--no-visited-state" href="#/work/' + w.id + '">' + esc(w.title) + '</a></h2><span class="muted">' + pc + '% complete · ' + l.length + (show === 'all' ? ' actions' : ' to do') + '</span></div><ul class="qlist">' +
      l.map((a) => qrow(a, false)).join('') + '</ul></section>';
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
  document.body.classList.toggle('wide', a === 'rules' && !b);
  main.innerHTML = html;
  document.querySelectorAll('[data-nav]').forEach((li) => {
    const on = li.dataset.nav === nav, link = li.firstElementChild;
    li.classList.toggle('govuk-service-navigation__item--active', on);
    if (on) { link.setAttribute('aria-current', 'true'); link.innerHTML = '<strong class="govuk-service-navigation__active-fallback">' + link.textContent + '</strong>'; }
    else { link.removeAttribute('aria-current'); link.textContent = link.textContent; }
  });
  const h1 = main.querySelector('h1');
  document.title = (hasErr() ? 'Error: ' : '') + (h1 ? h1.textContent : 'Rules engine') + ' - COMPASS rules engine';
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
  else if (act === 'dialog-close') closeDialog();
  else if (act === 'focus-field') { e.preventDefault(); const el = document.getElementById(t.dataset.field); if (el) { el.scrollIntoView({ block: 'center' }); el.focus(); } }
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
    '<h3 class="govuk-heading-s">Requirement returned</h3><p class="govuk-body"><strong>' + esc(r.requirementTitle) + '</strong><br>' + esc(r.requirementDescription || '') + '</p>' +
    (r.actions.length ? '<h3 class="govuk-heading-s">Actions raised</h3>' + actionDefList(r) : '') +
    '<h3 class="govuk-heading-s">Currently applies to</h3>' + (apps.length ? '<ul class="govuk-list">' + apps.map((w) => '<li><a class="govuk-link" href="#/work/' + w.id + '" data-act="dialog-close">' + esc(w.title) + '</a></li>').join('') + '</ul>' : '<p class="govuk-body">No work items.</p>') +
    '<div class="govuk-button-group"><a class="govuk-button" role="button" draggable="false" href="#/rules/' + r.id + '" data-act="dialog-close">Edit rule</a><button type="button" class="govuk-button govuk-button--secondary" data-act="dialog-close">Close</button></div>';
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
const API_EXAMPLES = [
  ['GET', 'api/rules.json', '', 'Static', 'Every rule built from the CSV logs, as a published file'],
  ['GET', 'api/rules/RUL-101.json', '', 'Static', 'One rule, with its version history'],
  ['GET', '/rules?status=Published&stage=Design and test', '', 'Live', 'Published rules that apply at a stage'],
  ['GET', '/rules/RUL-001', '', 'Live', 'One rule from the admin store'],
  ['GET', '/rules/RUL-001/versions', '', 'Live', 'Version history of a rule'],
  ['GET', '/triggers', '', 'Live', 'Trigger definitions'],
  ['GET', '/work/WRK-001/requirements', '', 'Live', 'Requirements and actions raised for a work item'],
  ['POST', '/evaluate', JSON.stringify({ stage: 'Design and test', type: 'New', transactional: 'Yes', estTransactions: '250000', personalData: 'Yes', characteristics: ['Transactional'], channel: ['Online'] }, null, 2), 'Live', 'Which rules and actions apply to a described piece of work']
];
function vApi() {
  const pub = S.rules.filter((r) => r.status === 'Published').length;
  const ex = API_EXAMPLES[0];
  return pageHead('Rules API', 'JSON for the rules library. Static files are published with this site. Live endpoints are served from the rule admin store in this browser, so edits show up straight away.', '<button type="button" class="govuk-button govuk-button--secondary" data-module="govuk-button" data-act="api-download">Download live rules.json</button>') +
    '<p class="govuk-body">' + S.rules.length + ' rules in the library, ' + pub + ' published. Also available from the browser console as <code>RulesAPI.request(method, path, body)</code>.</p>' +
    '<h2 class="govuk-heading-m">Endpoints</h2>' + table(['Method', 'Path', 'Type', 'Returns', ''], API_EXAMPLES.map((e) => ['<strong class="govuk-tag ' + (e[0] === 'GET' ? 'govuk-tag--blue' : 'govuk-tag--green') + '">' + e[0] + '</strong>', '<code>' + esc(e[1].split('\n')[0]) + '</code>', e[3] === 'Static' ? tag('Static file', 'govuk-tag--grey') : tag('Live', 'govuk-tag--turquoise'), esc(e[4]),
      '<button type="button" class="govuk-button govuk-button--secondary govuk-!-margin-bottom-0" data-module="govuk-button" data-act="api-try" data-method="' + e[0] + '" data-path="' + esc(e[1]) + '" data-body="' + esc(e[2]) + '">Try</button>'])) +
    '<h2 class="govuk-heading-m">Try a request</h2><form id="api-form" data-form="api" novalidate><div class="api-line"><div class="govuk-form-group"><label class="govuk-label govuk-label--s" for="api-method">Method</label><select class="govuk-select" id="api-method" name="method"><option>GET</option><option>POST</option></select></div>' +
    '<div class="govuk-form-group"><label class="govuk-label govuk-label--s" for="api-path">Path</label><input class="govuk-input" id="api-path" name="path" value="' + esc(ex[1]) + '"></div></div>' +
    '<div class="govuk-form-group"><label class="govuk-label govuk-label--s" for="api-body">Request body (POST)</label><textarea class="govuk-textarea api-code" id="api-body" name="body" rows="8" spellcheck="false"></textarea></div>' +
    '<button class="govuk-button" type="submit" data-module="govuk-button">Send request</button></form>' +
    '<h2 class="govuk-heading-m">Response</h2><p class="govuk-body-s muted" id="api-status">No request sent yet.</p><pre class="api-out" id="api-out" tabindex="0">{}</pre>';
}
async function sendApi(form) {
  const d = formData(form), out = document.getElementById('api-out'), st = document.getElementById('api-status');
  let res;
  const path = (d.path || '').trim();
  if (/^api\//.test(path) || /^https?:/.test(path)) {
    try { const r = await fetch(path); const text = await r.text(); let b = text; try { b = JSON.parse(text); } catch (e) { /* leave as text */ } res = { status: r.status, body: b, bytes: text.length }; }
    catch (e) { res = { status: 0, body: { error: 'Could not fetch the file. Static files need the site served over http(s), not opened from disk.' } }; }
  } else res = apiRequest(d.method, path, d.body);
  const json = typeof res.body === 'string' ? res.body : JSON.stringify(res.body, null, 2);
  st.textContent = d.method + ' ' + path + ' → ' + res.status + ' · ' + (res.bytes || json.length).toLocaleString('en-GB') + ' characters';
  out.textContent = json.length > 20000 ? json.slice(0, 20000) + '\n… truncated for display (' + json.length.toLocaleString('en-GB') + ' characters)' : json;
}

/* ---------- Extra events ---------- */
document.addEventListener('submit', (e) => {
  const f = e.target;
  if (f.dataset.form === 'api') { e.preventDefault(); sendApi(f); }
  else if (f.dataset.form === 'raise') {
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
  if (act === 'api-try') { document.getElementById('api-method').value = t.dataset.method; document.getElementById('api-path').value = t.dataset.path; document.getElementById('api-body').value = t.dataset.body; sendApi(document.getElementById('api-form')); document.getElementById('api-form').scrollIntoView({ block: 'start' }); }
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
  const active = S.actions.filter((a) => a.workId === id && isActive(a)), p = workPct(id);
  const legalOpen = active.filter((a) => actDef(a).legal && isOpen(a)).length, exc = active.filter((a) => a.status === 'Exception').length;
  const trig = S.triggers.filter((t) => t.workId === id);
  const cats = Object.keys(FIELDS).map((k) => '<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">' + FIELDS[k].label + '</dt><dd class="govuk-summary-list__value">' + esc(fieldVal(w, k)) + '</dd><dd class="govuk-summary-list__actions"><button type="button" class="link-btn" data-act="cats-open" data-id="' + w.id + '" data-field="' + k + '">Change<span class="govuk-visually-hidden"> ' + FIELDS[k].label.toLowerCase() + '</span></button></dd></div>').join('');
  const groups = reqGroups(id).map((g) => {
    const r = ruleOf(g.ruleId), done = g.actions.filter((a) => a.status === 'Complete').length, open = g.actions.some(isOpen), pc = Math.round(done / g.actions.length * 100);
    return '<details class="req2"' + (open ? ' open' : '') + '><summary class="req2-head"><span class="req2-t">' + esc(g.title) + '</span><span class="req2-c">' + (g.ruleId ? '<span class="rule-chip rule-chip--static">' + esc(g.ruleId) + '</span> ' : '') + done + ' of ' + g.actions.length + ' complete</span></summary>' +
      bar(pc, pc + '% of this requirement complete') + (r ? '<p class="govuk-body-s muted req2-src">' + esc(r.source) + (r.mandatory ? ' · ' + esc(r.mandatory) : '') + ' · <button type="button" class="link-btn" data-act="rule-info" data-id="' + esc(r.id) + '">Rule details</button></p>' : '') +
      '<ul class="alist">' + g.actions.map(actRow).join('') + '</ul></details>';
  }).join('');
  const retired = S.actions.filter((a) => a.workId === id && !isActive(a));
  return banner() + '<a href="#/work" class="govuk-back-link">Back to work</a>' + errorSummary() +
    '<span class="govuk-caption-m">' + w.id + '</span>' + pageHead(esc(w.title) + ' ' + tag(w.stage, 'govuk-tag--blue'), esc(w.description), '<button type="button" class="govuk-button" data-module="govuk-button" data-act="cats-open" data-id="' + w.id + '">Change categories</button>' + btn('#/work/' + w.id + '/edit', 'Edit details', true)) +
    '<div class="stats"><div class="stat"><span class="stat-n">' + p + '%</span><span class="stat-l">Complete</span></div><div class="stat"><span class="stat-n">' + active.filter(isOpen).length + '</span><span class="stat-l">Open actions</span></div><div class="stat' + (legalOpen ? ' stat--warn' : '') + '"><span class="stat-n">' + legalOpen + '</span><span class="stat-l">Legal actions open</span></div><div class="stat"><span class="stat-n">' + exc + '</span><span class="stat-l">Exceptions</span></div></div>' +
    '<div class="two-col"><section><h2 class="govuk-heading-m">Actions to complete</h2><p class="govuk-body-s muted">Open an action to record activity and evidence against it.</p>' + (groups || '<p class="govuk-body">No requirements apply to this work yet.</p>') +
    (retired.length ? '<details class="govuk-details"><summary class="govuk-details__summary"><span class="govuk-details__summary-text">' + retired.length + ' no longer required</span></summary><div class="govuk-details__text"><ul class="alist">' + retired.map(actRow).join('') + '</ul></div></details>' : '') + '</section>' +
    '<aside><div class="panel"><h2 class="govuk-heading-s">Categories</h2><dl class="govuk-summary-list govuk-summary-list--compact">' + cats + '</dl></div>' +
    '<h2 class="govuk-heading-s govuk-!-margin-top-6">Recent triggers</h2>' + (trig.length ? triggerList(trig.slice(0, 3)) + (trig.length > 3 ? '<p class="govuk-body-s"><a class="govuk-link" href="#/triggers">All triggers</a></p>' : '') : '<p class="govuk-body-s muted">None yet.</p>') + '</aside></div>';
}

/* ---------- Action detail: evidence and activity ---------- */
const ACT_TYPES = [['evidence', 'Evidence', 'A document, link or output that shows the action is done'], ['note', 'Note', 'A progress update'], ['decision', 'Decision', 'A decision made about this action'], ['exception', 'Exception', 'The action cannot be met as written']];
function vActionDetail(id) {
  const a = S.actions.find((x) => x.id === id); if (!a) return notFound();
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
      act ? '<button type="button" class="govuk-button" data-module="govuk-button" data-act="activity-open" data-id="' + a.id + '" data-type="evidence">Add evidence</button><button type="button" class="govuk-button govuk-button--secondary" data-module="govuk-button" data-act="activity-open" data-id="' + a.id + '" data-type="note">Add note or update status</button>' : '') +
    '<div class="two-col"><section>' +
    '<h2 class="govuk-heading-m">About this action</h2><dl class="govuk-summary-list"><div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">What this involves</dt><dd class="govuk-summary-list__value">' + (d.description ? esc(d.description) : '<span class="muted">Not yet described.</span>') + '</dd></div>' +
    '<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Expected evidence</dt><dd class="govuk-summary-list__value">' + (d.evidence ? esc(d.evidence) : '<span class="muted">Not yet defined.</span>') + '</dd></div>' +
    '<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Requirement</dt><dd class="govuk-summary-list__value">' + (rule ? esc(rule.requirementTitle) + '<br><span class="muted">' + esc(rule.source) + '</span>' : 'Not linked to a rule') + '</dd></div></dl>' +
    '<h2 class="govuk-heading-m">Evidence <span class="muted">(' + ev.length + ')</span></h2>' +
    (ev.length ? '<ul class="evlist">' + ev.map(evItem).join('') + '</ul>' : '<div class="govuk-inset-text">No evidence recorded yet.' + (d.evidence ? ' Expected: ' + esc(d.evidence) : '') + (d.legal ? ' This is a legal requirement, so evidence is needed before it can be completed.' : '') + '</div>') +
    '<h2 class="govuk-heading-m">Activity</h2><ol class="tlist">' + rest.map(tl).join('') + '</ol></section>' +
    '<aside><div class="panel"><h2 class="govuk-heading-s">Status</h2><ol class="steps">' + STATUSES.filter((s) => s !== 'No longer required' || a.status === s).map((s) => '<li class="' + (s === a.status ? 'on' : '') + '">' + esc(s) + '</li>').join('') + '</ol></div>' +
    (sibs.length ? '<h2 class="govuk-heading-s govuk-!-margin-top-6">Other actions for this requirement</h2><ul class="govuk-list govuk-body-s">' + sibs.map((s) => '<li><a class="govuk-link" href="#/actions/' + s.id + '">' + esc(s.title) + '</a> ' + statusTag(s.status) + '</li>').join('') + '</ul>' : '') + '</aside></div>';
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
}, true);
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-act]'); if (!t) return;
  if (t.dataset.act === 'cats-open') openCats(t.dataset.id, t.dataset.field || '');
  else if (t.dataset.act === 'activity-open') openActivity(t.dataset.id, t.dataset.type);
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
  if (a && STATUSES.indexOf(status) > -1 && a.status !== status) { a.updates.push({ at: now(), type: 'system', text: 'Moved on board from ' + a.status + ' to ' + status + '.' }); a.status = status; save(); }
  rerender();
}

window.addEventListener('hashchange', () => { closeDialog(); ERR = {}; workDraft = null; render(); });
render();
})();
