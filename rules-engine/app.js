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
  single: [['is', 'is'], ['isnot', 'is not']],
  multi: [['includes', 'includes']],
  yesno: [['is', 'is']],
  number: [['gte', 'is at least'], ['lte', 'is at most']]
};
const OP_LABEL = { is: 'is', isnot: 'is not', includes: 'includes', gte: 'is at least', lte: 'is at most' };
const STATUSES = ['Not started', 'In progress', 'Complete', 'Exception', 'No longer required'];
const STATUS_TAG = { 'Not started': 'govuk-tag--grey', 'In progress': 'govuk-tag--blue', 'Complete': 'govuk-tag--green', 'Exception': 'govuk-tag--orange', 'No longer required': 'govuk-tag--purple' };
const KEY = 'compass-rules-engine-v2';

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
S = load();
S.rules.forEach((r) => { if (r.owner === undefined) r.owner = SEED_OWNER[r.name] || ''; });

/* ---------- Rules engine ---------- */
function condMatches(work, c) {
  const f = FIELDS[c.field]; if (!f) return false;
  const v = work[c.field];
  switch (c.op) {
    case 'is': return String(v) === String(c.value);
    case 'isnot': return String(v) !== String(c.value);
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
    rule.tasks.forEach((title) => {
      const existing = S.actions.find((a) => a.workId === work.id && a.ruleId === rule.id && !a.custom && a.title === title);
      if (!existing) {
        const a = {
          id: uid('ACT'), workId: work.id, ruleId: rule.id, title, status: 'Not started', created: now(),
          updates: [{ at: now(), type: 'system', text: 'Raised by rule ' + rule.id + ' (' + rule.name + '). ' + systemNote }]
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

function recordTrigger(work, event, changes, result) {
  const t = {
    id: uid('TRG'), at: now(), workId: work.id, event, changes,
    fired: result.fired, added: result.added.map((a) => a.id), reinstated: result.reinstated.map((a) => a.id), withdrawn: result.withdrawn.map((a) => a.id)
  };
  S.triggers.unshift(t);
  return t;
}

/* ---------- Seed data ---------- */
function seed() {
  S = { seq: {}, works: [], rules: [], actions: [], triggers: [] };
  const R = (name, source, conditions, title, desc, tasks) => S.rules.push({
    id: uid('RUL'), name, source, owner: SEED_OWNER[name] || '', enabled: true, conditions, requirementTitle: title, requirementDescription: desc, tasks
  });
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

  const W = (o) => S.works.push(Object.assign({ id: uid('WRK'), description: '', created: now(), characteristics: [], channel: [], users: [], transactional: 'No', estTransactions: '', personalData: 'No', priority: 'Medium', risk: 'Medium' }, o));
  W({ title: 'School trips booking service', description: 'Let parents book and pay for school trips online.', demand: 'New demand', type: 'New', stage: 'Idea', characteristics: ['Transactional'], channel: ['Online'], users: ['Parents and Carers', 'Teachers'], transactional: 'Yes', estTransactions: '250000', personalData: 'Yes', priority: 'High' });
  W({ title: 'Legacy case system replacement', description: 'Replace the legacy case management system.', demand: 'Retirement or Replacement', type: 'Procurement', stage: 'Understanding', characteristics: ['Data', 'API'], channel: ['Online'], users: ['Local Authorities'], personalData: 'Yes', risk: 'High' });
  W({ title: 'Guidance pages refresh', description: 'Improve the structure of published guidance.', demand: 'Feature or Improvement', type: 'Improvement', stage: 'Design and test', characteristics: ['Information'], channel: ['Online', 'Print'], users: ['Public'], priority: 'Low', risk: 'Low' });
  S.works.forEach((w) => { const r = runEngine(w, 'Initial categorisation.'); recordTrigger(w, 'Work created', [], r); });
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
const condText = (c) => (FIELDS[c.field] ? FIELDS[c.field].label : c.field) + ' ' + (OP_LABEL[c.op] || c.op) + ' ' + (FIELDS[c.field] && FIELDS[c.field].kind === 'number' ? Number(c.value).toLocaleString('en-GB') : c.value);
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
  '<div class="kcard-foot">' + evBadge(a) + statusSelect(a) + '</div></article>';
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
function vWork() {
  const rows = S.works.map((w) => {
    const acts = S.actions.filter((a) => a.workId === w.id && isActive(a));
    const done = acts.filter((a) => a.status === 'Complete').length, p = workPct(w.id);
    return ['<a class="govuk-link govuk-link--no-visited-state" href="#/work/' + w.id + '"><strong>' + esc(w.title) + '</strong></a><br><span class="muted">' + w.id + ' · ' + esc(w.description) + '</span>',
      esc(w.type) + '<br><span class="muted">' + esc(w.stage) + '</span>', prioTag(w.priority) + (w.risk === 'High' ? ' ' + tag('High risk', 'govuk-tag--red') : ''),
      reqGroups(w.id).length + '', done + ' of ' + acts.length + ' complete' + bar(p, p + '% of actions complete'),
      acts.filter((a) => a.status === 'Exception').length ? tag(acts.filter((a) => a.status === 'Exception').length + ' exception', 'govuk-tag--orange') : ''];
  });
  return banner() + pageHead('Work', 'Everything in flight, categorised so the rules engine knows what applies.', btn('#/work/new', 'Add work')) +
    (rows.length ? table(['Work', 'Type and stage', 'Priority', 'Requirements', 'Actions', ''], rows, 'compact') : '<p class="govuk-body">No work yet.</p>');
}

function actionRow(a, showWork) {
  return '<tr class="govuk-table__row"><td class="govuk-table__cell"><a class="govuk-link govuk-link--no-visited-state" href="#/actions/' + a.id + '">' + esc(a.title) + '</a> <span class="muted">' + a.id + '</span>' +
    (showWork ? '<br><a class="govuk-link govuk-link--no-visited-state muted" href="#/work/' + a.workId + '">' + esc(workName(a.workId)) + '</a>' : '') + '</td>' +
    '<td class="govuk-table__cell">' + evBadge(a) + '</td><td class="govuk-table__cell">' + (isActive(a) ? statusSelect(a) : statusTag(a.status)) + '</td></tr>';
}
const actionTable = (list, showWork) => '<table class="govuk-table compact"><thead class="govuk-table__head"><tr class="govuk-table__row"><th scope="col" class="govuk-table__header">Action</th><th scope="col" class="govuk-table__header">Evidence</th><th scope="col" class="govuk-table__header">Status</th></tr></thead><tbody class="govuk-table__body">' + list.map((a) => actionRow(a, showWork)).join('') + '</tbody></table>';

function vWorkDetail(id) {
  const w = S.works.find((x) => x.id === id); if (!w) return notFound();
  const active = S.actions.filter((a) => a.workId === id && isActive(a));
  const trig = S.triggers.filter((t) => t.workId === id);
  const summary = Object.keys(FIELDS).map((k) => '<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">' + FIELDS[k].label + '</dt><dd class="govuk-summary-list__value">' + esc(fieldVal(w, k)) + '</dd><dd class="govuk-summary-list__actions"><a class="govuk-link" href="#/work/' + w.id + '/edit">Change<span class="govuk-visually-hidden"> ' + FIELDS[k].label.toLowerCase() + '</span></a></dd></div>').join('');
  const p = workPct(id);
  const groups = reqGroups(id).map((g) => {
    const r = ruleOf(g.ruleId), done = g.actions.filter((a) => a.status === 'Complete').length, fid = 'newaction-' + (g.ruleId || 'x');
    return '<section class="req"><div class="req-head"><h3 class="req-title">' + (g.ruleId ? ruleChip(g.ruleId) + ' ' : '') + esc(g.title) + '</h3><span class="muted">' + done + ' of ' + g.actions.length + ' actions complete</span></div>' +
      (r ? '<p class="muted req-src">' + esc(r.source) + '</p>' : '') + actionTable(g.actions) +
      (g.ruleId ? '<form class="addrow" id="' + fid + '-form" data-form="action" data-work="' + id + '" data-rule="' + esc(g.ruleId) + '" novalidate><div class="' + grp(fid) + '"><label class="govuk-visually-hidden" for="' + fid + '">Add an action to ' + esc(g.title) + '</label>' + errMsg(fid, fid) +
        '<input class="govuk-input' + (ERR[fid] ? ' govuk-input--error' : '') + '" id="' + fid + '" name="newaction" placeholder="Add an action to this requirement"' + describedBy(fid, fid) + '></div><button class="govuk-button govuk-button--secondary" type="submit" data-module="govuk-button">Add action</button></form>' : '') + '</section>';
  }).join('');
  const retired = reqGroups(id, true).map((g) => ({ g, list: g.actions.filter((a) => !isActive(a)) })).filter((x) => x.list.length);
  const retiredCount = retired.reduce((n, x) => n + x.list.length, 0);
  return banner() + '<a href="#/work" class="govuk-back-link">Back to work</a>' + errorSummary() +
    '<span class="govuk-caption-m">' + w.id + '</span>' + pageHead(esc(w.title), esc(w.description), btn('#/work/' + w.id + '/edit', 'Change categorisation', true)) +
    '<div class="stats"><div class="stat"><span class="stat-n">' + p + '%</span><span class="stat-l">Actions complete</span></div><div class="stat"><span class="stat-n">' + active.filter(isOpen).length + '</span><span class="stat-l">Open actions</span></div><div class="stat"><span class="stat-n">' + active.filter((a) => a.status === 'Complete').length + '</span><span class="stat-l">Completed</span></div><div class="stat"><span class="stat-n">' + trig.length + '</span><span class="stat-l">Triggers</span></div></div>' +
    '<div class="two-col"><section><h2 class="govuk-heading-m">Requirements and actions</h2>' + (groups || '<p class="govuk-body">No requirements apply to this work yet.</p>') +
    (retiredCount ? '<details class="govuk-details"><summary class="govuk-details__summary"><span class="govuk-details__summary-text">' + retiredCount + ' no longer required</span></summary><div class="govuk-details__text">' + retired.map((x) => '<p class="govuk-body-s"><strong>' + esc(x.g.title) + '</strong></p>' + actionTable(x.list)).join('') + '</div></details>' : '') +
    '<h2 class="govuk-heading-m">Trigger history</h2>' + triggerList(trig) + '</section>' +
    '<aside><div class="panel"><h2 class="govuk-heading-s">Categorisation</h2><dl class="govuk-summary-list govuk-summary-list--compact">' + summary + '</dl></div></aside></div>';
}

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
  return list.map((t) => {
    const ch = t.changes.length ? '<ul class="govuk-list govuk-list--bullet">' + t.changes.map((c) => '<li><strong>' + esc(FIELDS[c.field].label) + '</strong>: ' + esc(c.from) + ' → ' + esc(c.to) + '</li>').join('') + '</ul>' : '';
    const links = (ids) => ids.map((i) => '<a class="govuk-link" href="#/actions/' + i + '">' + i + '</a>').join(', ');
    return '<div class="log-entry system"><p class="govuk-body-s govuk-!-margin-bottom-1">' + fmt(t.at) + ' · ' + t.id + ' · <a class="govuk-link" href="#/work/' + t.workId + '">' + esc(workName(t.workId)) + '</a></p>' +
      '<p class="govuk-body govuk-!-margin-bottom-1"><strong>' + esc(t.event) + '</strong></p>' + ch +
      '<p class="govuk-body-s govuk-!-margin-bottom-0">' + (t.fired.length ? 'Rules matched: ' + t.fired.map(ruleChip).join(' ') : 'No rules matched') +
      (t.added.length ? '<br>New requirements: ' + links(t.added) : '') +
      (t.reinstated.length ? '<br>Reinstated: ' + links(t.reinstated) : '') +
      (t.withdrawn.length ? '<br>No longer required: ' + links(t.withdrawn) : '') + '</p></div>';
  }).join('');
}
function vTriggers() {
  const signals = ['Transactional is set to Yes', 'Estimated transactions is set to 250,000 per year', 'Users is set to Parents and Carers', 'Captures or processes personal data is set to Yes'];
  return banner() + pageHead('Triggers', 'A trigger is raised whenever work is created or its categorisation changes.', '<button class="govuk-button govuk-button--secondary" data-module="govuk-button" data-act="rerun-all">Re-run rules on all work</button>') + flowDiagram(1) +
    '<div class="two-col"><section><h2 class="govuk-heading-l">History</h2>' + triggerList(S.triggers) + '</section>' +
    '<aside class="panel"><h2 class="govuk-heading-m">Example signals</h2><ul class="govuk-list govuk-list--bullet">' + signals.map((s) => '<li>' + s + '</li>').join('') + '</ul></aside></div>';
}

const RULE_SORTS = [['id', 'Rule ID'], ['name', 'Name A to Z'], ['owner', 'Owner'], ['source', 'Policy or standard'], ['work', 'Most work items'], ['status', 'Enabled first']];
function ownerCell(r) {
  return r.owner ? esc(r.owner) + '<br>' + tag(OWNER_TYPE(r.owner) || 'Owner', OWNER_TYPE(r.owner) === 'Team' ? 'govuk-tag--turquoise' : 'govuk-tag--purple') : '<span class="muted">Unassigned</span>';
}
function vRules() {
  const p = qs(), q = (p.get('q') || '').trim().toLowerCase(), fo = p.get('owner') || '', fs = p.get('source') || '', fe = p.get('enabled') || '', sort = p.get('sort') || 'id';
  const count = (r) => S.works.filter((w) => ruleMatches(w, r)).length;
  let list = S.rules.filter((r) => (!q || [r.id, r.name, r.source, r.owner, r.requirementTitle].join(' ').toLowerCase().includes(q)) &&
    (!fo || (fo === '__none' ? !r.owner : r.owner === fo)) && (!fs || r.source === fs) && (!fe || (fe === 'yes') === (r.enabled !== false)));
  const cmp = { id: (a, b) => a.id.localeCompare(b.id), name: (a, b) => a.name.localeCompare(b.name), owner: (a, b) => (a.owner || '\uffff').localeCompare(b.owner || '\uffff') || a.name.localeCompare(b.name),
    source: (a, b) => a.source.localeCompare(b.source) || a.name.localeCompare(b.name), work: (a, b) => count(b) - count(a) || a.name.localeCompare(b.name), status: (a, b) => (b.enabled !== false) - (a.enabled !== false) || a.id.localeCompare(b.id) };
  list = list.slice().sort(cmp[sort] || cmp.id);
  const opt = (v, l, cur) => '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(l) + '</option>';
  const owners = Array.from(new Set(S.rules.map((r) => r.owner).filter(Boolean))).sort(), sources = Array.from(new Set(S.rules.map((r) => r.source))).sort();
  const sel = (name, label, opts) => '<div class="govuk-form-group"><label class="govuk-label govuk-label--s" for="rf-' + name + '">' + label + '</label><select class="govuk-select" id="rf-' + name + '" name="' + name + '" data-act="rule-filter">' + opts + '</select></div>';
  const filtered = q || fo || fs || fe;
  const bar = '<form class="filter-bar" data-form="rule-filter" role="search" aria-label="Filter and sort rules"><div class="govuk-form-group"><label class="govuk-label govuk-label--s" for="rf-q">Search</label><input class="govuk-input" id="rf-q" name="q" type="search" value="' + esc(p.get('q') || '') + '" placeholder="Name, ID, policy or owner"></div>' +
    sel('owner', 'Owner', opt('', 'All owners', fo) + opt('__none', 'Unassigned', fo) + owners.map((o) => opt(o, o, fo)).join('')) +
    sel('source', 'Policy or standard', opt('', 'All', fs) + sources.map((o) => opt(o, o, fs)).join('')) +
    sel('enabled', 'Status', opt('', 'All', fe) + opt('yes', 'Enabled', fe) + opt('no', 'Disabled', fe)) +
    sel('sort', 'Sort by', RULE_SORTS.map((o) => opt(o[0], o[1], sort)).join('')) +
    '<div class="govuk-form-group filter-bar__actions"><button class="govuk-button govuk-button--secondary" data-module="govuk-button" type="submit">Apply</button>' + (filtered || sort !== 'id' ? ' <a class="govuk-link" href="#/rules">Clear</a>' : '') + '</div></form>';
  return banner() + pageHead('Rules', 'Rulesets based on policies, standards and processes. They run on trigger events and return requirements.', btn('#/rules/new', 'Add rule')) + bar +
    '<p class="govuk-body" role="status">Showing ' + list.length + ' of ' + S.rules.length + ' rules.</p>' +
    table(['Rule', 'Owner', 'When', 'Requirement returned', 'Applies to', 'Status'], list.map((r) => {
      const n = count(r);
      return [ruleChip(r.id) + '<br><a class="govuk-link" href="#/rules/' + r.id + '">' + esc(r.name) + '</a><br><span class="govuk-body-s">' + esc(r.source) + '</span>', ownerCell(r),
        r.conditions.map((c) => esc(condText(c))).join('<br>and '), esc(r.requirementTitle), n + ' work item' + (n === 1 ? '' : 's'), r.enabled !== false ? tag('Enabled', 'govuk-tag--green') : tag('Disabled', 'govuk-tag--grey')];
    }));
}

function condRow(c, i) {
  const f = FIELDS[c.field] || FIELDS.type;
  const ops = OPS[f.kind];
  const valCtl = f.kind === 'number'
    ? '<input class="govuk-input govuk-input--width-10" type="number" min="0" id="cval-' + i + '" name="cval' + i + '" value="' + esc(c.value) + '" aria-label="Value">'
    : '<select class="govuk-select" id="cval-' + i + '" name="cval' + i + '" aria-label="Value">' + f.options.map((o) => '<option' + (o === c.value ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select>';
  return '<div class="cond-row"><div class="govuk-form-group"><select class="govuk-select" name="cfield' + i + '" data-act="cond-field" data-i="' + i + '" aria-label="Field">' +
    Object.keys(FIELDS).map((k) => '<option value="' + k + '"' + (k === c.field ? ' selected' : '') + '>' + FIELDS[k].label + '</option>').join('') + '</select></div>' +
    '<div class="govuk-form-group"><select class="govuk-select" name="cop' + i + '" aria-label="Operator">' + ops.map((o) => '<option value="' + o[0] + '"' + (o[0] === c.op ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></div>' +
    '<div class="govuk-form-group">' + valCtl + '</div>' +
    '<button type="button" class="govuk-button govuk-button--warning govuk-!-margin-bottom-0" data-act="cond-remove" data-i="' + i + '">Remove</button></div>';
}
function vRuleForm(id) {
  if (!ruleDraft || ruleDraft.key !== id) {
    const r = id === 'new' ? { name: '', source: '', owner: '', enabled: true, conditions: [{ field: 'type', op: 'is', value: OPT.type[0] }], requirementTitle: '', requirementDescription: '', tasks: [] } : S.rules.find((x) => x.id === id);
    if (!r) return notFound();
    ruleDraft = { key: id, rule: JSON.parse(JSON.stringify(r)) };
  }
  const r = ruleDraft.rule;
  return '<a href="#/rules" class="govuk-back-link">Back to rules</a>' + errorSummary() + '<h1 class="govuk-heading-xl">' + (id === 'new' ? 'Add rule' : esc(r.name || 'Change rule')) + '</h1>' +
    '<div class="govuk-inset-text">Saving a rule re-runs it against all work, adding or withdrawing requirements.</div>' +
    '<form id="rule-form" data-id="' + esc(id) + '" novalidate>' +
    text('name', 'name', r.name, 'Rule name') +
    text('source', 'source', r.source, 'Policy, standard or process', {}) +
    '<div class="govuk-form-group"><label class="govuk-label govuk-label--s" for="owner">Rule owner</label><div id="owner-hint" class="govuk-hint">The person or team accountable for keeping this rule up to date.</div><select class="govuk-select" id="owner" name="owner" aria-describedby="owner-hint"><option value="">Unassigned</option>' +
    Object.keys(OWNERS).map((g) => '<optgroup label="' + (g === 'Team' ? 'Teams' : 'People') + '">' + OWNERS[g].map((o) => '<option' + (o === r.owner ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</optgroup>').join('') + '</select></div>' +
    '<h2 class="govuk-heading-m">Conditions</h2><p class="govuk-body">All conditions must be true.</p>' +
    (ERR.cond ? '<div class="govuk-form-group govuk-form-group--error">' + errMsg('cond', 'cond') : '<div>') +
    r.conditions.map(condRow).join('') + '</div>' +
    '<button type="button" class="govuk-button govuk-button--secondary" data-module="govuk-button" data-act="cond-add">Add condition</button>' +
    '<h2 class="govuk-heading-m">Requirement returned</h2>' +
    text('requirementTitle', 'rt', r.requirementTitle, 'Requirement title') +
    text('requirementDescription', 'rd', r.requirementDescription, 'Description', { area: true, rows: 3 }) +
    text('tasks', 'tasks', r.tasks.join('\n'), 'Actions', { area: true, rows: 4, hint: 'One per line. Each line becomes a separate action with its own status, evidence and history.' }) +
    checks('enabled', ['Enabled'], r.enabled !== false ? ['Enabled'] : [], 'Status') +
    '<div class="govuk-button-group"><button class="govuk-button" type="submit" data-module="govuk-button" data-prevent-double-click="true">Save and run rule</button>' +
    (id === 'new' ? '' : '<a class="govuk-link" href="#/rules/' + id + '/delete">Delete rule</a>') + '</div></form>';
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

function vActions() {
  const p = qs(), view = p.get('view') === 'board' ? 'board' : 'list', wf = p.get('work') || '';
  const all = S.actions.filter((a) => !wf || a.workId === wf);
  const seg = (q) => '<div class="seg" role="group" aria-label="View"><a class="seg-i' + (view === 'list' ? ' on' : '') + '" href="' + q({ view: '' }) + '"' + (view === 'list' ? ' aria-current="true"' : '') + '>List</a><a class="seg-i' + (view === 'board' ? ' on' : '') + '" href="' + q({ view: 'board' }) + '"' + (view === 'board' ? ' aria-current="true"' : '') + '>Board</a></div>';
  let body;
  if (view === 'board') {
    body = '<div class="board">' + BOARD_COLS.map((c) => {
      const items = all.filter((a) => a.status === c[0]);
      return '<section class="col" data-status="' + c[0] + '" aria-label="' + c[1] + '"><h2 class="col-head"><span>' + c[1] + '</span><span class="count">' + items.length + '</span></h2><div class="col-body">' +
        (items.map(actionCard).join('') || '<p class="col-empty">Nothing here</p>') + '</div></section>';
    }).join('') + '</div><p class="govuk-hint">Drag actions between columns, or use the status menu. Actions that no longer apply are in the list view.</p>';
  } else {
    const list = all.filter((a) => a.status !== 'No longer required' || p.get('all'));
    body = table(['Action', 'Requirement', 'Work', 'Evidence', 'Status'], list.map((a) => ['<a class="govuk-link govuk-link--no-visited-state" href="#/actions/' + a.id + '">' + esc(a.title) + '</a> <span class="muted">' + a.id + '</span>',
      (a.ruleId ? ruleChip(a.ruleId) + ' ' : '') + esc(reqTitle(a)), '<a class="govuk-link govuk-link--no-visited-state" href="#/work/' + a.workId + '">' + esc(workName(a.workId)) + '</a>', evBadge(a), isActive(a) ? statusSelect(a) : statusTag(a.status)]), 'compact') +
      (p.get('all') ? '' : '<p class="govuk-body-s"><a class="govuk-link" href="#/actions?all=1' + (wf ? '&work=' + wf : '') + '">Include actions that no longer apply</a></p>');
  }
  return banner() + pageHead('Actions', 'Each action is tracked on its own, with its own status, evidence and history.') + toolbar('actions', p, seg) + body;
}

function vTasks() {
  const p = qs(), wf = p.get('work') || '', show = p.get('show') || 'open';
  const list = S.actions.filter((a) => isActive(a) && (!wf || a.workId === wf) && (show === 'all' || isOpen(a)));
  const seg = (q) => '<div class="seg" role="group" aria-label="Show"><a class="seg-i' + (show === 'open' ? ' on' : '') + '" href="' + q({ show: '' }) + '">Open</a><a class="seg-i' + (show === 'all' ? ' on' : '') + '" href="' + q({ show: 'all' }) + '">All</a></div>';
  const html = S.works.filter((w) => list.some((a) => a.workId === w.id)).map((w) => '<section class="panel"><h2 class="govuk-heading-s"><a class="govuk-link govuk-link--no-visited-state" href="#/work/' + w.id + '">' + esc(w.title) + '</a> <span class="count">' + list.filter((a) => a.workId === w.id).length + '</span></h2><ul class="tasklist">' +
    list.filter((a) => a.workId === w.id).map((a) => '<li class="task' + (a.status === 'Complete' ? ' done' : '') + '"><div class="govuk-checkboxes govuk-checkboxes--small"><div class="govuk-checkboxes__item"><input class="govuk-checkboxes__input" type="checkbox" id="tt-' + a.id + '" data-act="task" data-id="' + a.id + '"' + (a.status === 'Complete' ? ' checked' : '') + '><label class="govuk-label govuk-checkboxes__label" for="tt-' + a.id + '">' + esc(a.title) + '</label></div></div>' +
      '<span class="task-meta">' + (a.ruleId ? ruleChip(a.ruleId) : '') + '<span class="muted">' + esc(reqTitle(a)) + '</span>' + evBadge(a) + statusTag(a.status) + '<a class="govuk-link govuk-link--no-visited-state" href="#/actions/' + a.id + '">Open</a></span></li>').join('') + '</ul></section>').join('');
  return banner() + pageHead('Tasks', 'Your actions, grouped by work. Tick one off when it is done, and record evidence on the action itself.') + toolbar('tasks', p, seg) +
    (html || '<div class="panel"><p class="govuk-body">No ' + (show === 'open' ? 'open ' : '') + 'actions.</p></div>');
}

function vDashboard() {
  const act = S.actions.filter(isActive), open = act.filter(isOpen);
  const noEv = act.filter((a) => a.status === 'Complete' && !evCount(a));
  const attn = open.filter((a) => a.status === 'Exception').concat(noEv).concat(open.filter((a) => a.status === 'Not started')).slice(0, 6);
  const stat = (n, l, href) => '<a class="stat" href="' + href + '"><span class="stat-n">' + n + '</span><span class="stat-l">' + l + '</span></a>';
  return banner() + pageHead('Dashboard', 'How work is categorised, which rules fired, and what still needs doing.', btn('#/work/new', 'Add work')) +
    '<div class="stats">' + stat(S.works.length, 'Work items', '#/work') + stat(open.length, 'Open actions', '#/actions') + stat(act.filter((a) => a.status === 'In progress').length, 'In progress', '#/actions?view=board') + stat(act.reduce((n, a) => n + evCount(a), 0), 'Pieces of evidence', '#/actions') + '</div>' +
    flowDiagram(-1) +
    '<div class="two-col"><section class="panel"><h2 class="govuk-heading-s">Needs attention</h2>' +
    (attn.length ? '<ul class="tasklist">' + attn.map((a) => '<li class="task"><span><a class="govuk-link govuk-link--no-visited-state" href="#/actions/' + a.id + '">' + esc(a.title) + '</a><br><span class="muted">' + esc(workName(a.workId)) + ' · ' + esc(reqTitle(a)) + '</span></span><span class="task-meta">' + (a.ruleId ? ruleChip(a.ruleId) : '') + (a.status === 'Complete' ? tag('Complete, no evidence', 'govuk-tag--yellow') : statusTag(a.status)) + '</span></li>').join('') + '</ul>' : '<p class="govuk-body">Nothing needs attention.</p>') +
    '<p class="govuk-body-s"><a class="govuk-link" href="#/actions">All actions</a></p></section>' +
    '<aside class="panel"><h2 class="govuk-heading-s">Latest triggers</h2>' + triggerList(S.triggers.slice(0, 3)) + '<p class="govuk-body-s"><a class="govuk-link" href="#/triggers">All triggers</a></p></aside></div>';
}

function vActionDetail(id) {
  const a = S.actions.find((x) => x.id === id); if (!a) return notFound();
  const log = a.updates.slice().reverse().map((u) => '<div class="log-entry ' + u.type + '"><p class="govuk-body-s govuk-!-margin-bottom-1">' + fmt(u.at) + ' · ' + tag(u.type, 'govuk-tag--grey') + '</p><p class="govuk-body govuk-!-margin-bottom-1">' + esc(u.text) + '</p>' +
    (u.link ? '<p class="govuk-body-s"><a class="govuk-link" href="' + esc(u.link) + '" target="_blank" rel="noopener noreferrer">' + esc(u.link) + '</a></p>' : '') + '</div>').join('');
  const rule = ruleOf(a.ruleId);
  const sibs = S.actions.filter((x) => x.workId === a.workId && x.ruleId === a.ruleId && x.id !== a.id && isActive(x));
  return banner() + '<a href="#/work/' + a.workId + '" class="govuk-back-link">Back to ' + esc(workName(a.workId)) + '</a>' + errorSummary() +
    '<span class="govuk-caption-m">' + a.id + ' · <a class="govuk-link" href="#/work/' + a.workId + '">' + esc(workName(a.workId)) + '</a></span>' +
    '<h1 class="govuk-heading-l">' + esc(a.title) + '</h1><p>' + statusTag(a.status) + ' ' + evBadge(a) + '</p>' +
    '<div class="two-col"><section><h2 class="govuk-heading-m">Record an update</h2><p class="govuk-body-s muted">Evidence, decisions and exceptions are recorded against this action only.</p>' +
    '<form id="update-form" data-id="' + a.id + '" novalidate>' +
    select('type', 'utype', ['Note', 'Evidence', 'Decision', 'Exception'], 'Note', 'Type of update').replace('<option value="">Select</option>', '') +
    text('text', 'utext', '', 'Details', { area: true, rows: 3 }) +
    text('link', 'ulink', '', 'Link to evidence (optional)', { type: 'url', hint: 'For example a link to a document, ticket or decision record.' }) +
    select('status', 'ustatus', STATUSES, a.status, 'Status').replace('<option value="">Select</option>', '') +
    '<button class="govuk-button" type="submit" data-module="govuk-button" data-prevent-double-click="true">Save update</button></form>' +
    '<h2 class="govuk-heading-m">History</h2>' + log + '</section>' +
    '<aside class="panel"><h2 class="govuk-heading-s">Requirement</h2>' + (rule ? '<p class="govuk-body-s">' + ruleChip(rule.id) + ' ' + esc(rule.requirementTitle) + '</p><p class="govuk-body-s muted">' + esc(rule.requirementDescription) + '<br>Source: ' + esc(rule.source) + '</p>' : '<p class="govuk-body-s">Not linked to a rule.</p>') +
    (sibs.length ? '<h3 class="govuk-heading-s">Other actions for this requirement</h3><ul class="govuk-list govuk-body-s">' + sibs.map((s) => '<li><a class="govuk-link" href="#/actions/' + s.id + '">' + esc(s.title) + '</a> ' + statusTag(s.status) + '</li>').join('') + '</ul>' : '') + '</aside></div>';
}
function notFound() { return '<h1 class="govuk-heading-l">Page not found</h1><p class="govuk-body"><a class="govuk-link" href="#/work">Go to work</a></p>'; }

/* ---------- Router ---------- */
function render(keep) {
  const h = location.hash.replace(/^#\/?/, '').split('?')[0].split('/');
  const [a, b, c] = h;
  let html, nav = a || 'dashboard';
  if (!a || a === 'dashboard') html = vDashboard();
  else if (a === 'tasks') html = vTasks();
  else if (a === 'work') html = !b ? vWork() : c === 'edit' ? vWorkForm(b) : b === 'new' ? vWorkForm('new') : vWorkDetail(b);
  else if (a === 'triggers') html = vTriggers();
  else if (a === 'rules') {
    if (!b) ruleDraft = null;
    html = !b ? vRules() : c === 'delete' ? vConfirm({ title: 'Are you sure you want to delete this rule?', warning: 'Actions this rule raised that are not complete will be marked as no longer required.', button: 'Delete rule', act: 'rule-delete', id: b, back: '#/rules/' + b }) : vRuleForm(b);
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
  const result = (isNew || changes.length) ? runEngine(w, note) : { added: [], withdrawn: [], reinstated: [], fired: matchingRules(w).map((r) => r.id) };
  if (isNew || changes.length) recordTrigger(w, event, changes, result);
  save();
  const li = (arr2, label) => arr2.length ? '<li>' + label + ': ' + arr2.map((a) => '<a class="govuk-notification-banner__link" href="#/actions/' + a.id + '">' + esc(a.title) + '</a>').join(', ') + '</li>' : '';
  flash = { title: 'Success', html: '<p class="govuk-notification-banner__heading">' + (changes.length ? changes.length + ' categorisation change' + (changes.length > 1 ? 's' : '') + ' triggered the rules engine.' : (isNew ? 'Work added and the rules engine ran.' : 'Work saved. No categorisation changes, so the rules engine did not need to run.')) + '</p><ul class="govuk-list govuk-list--bullet">' +
    (li(result.added, 'New requirements') + li(result.reinstated, 'Reinstated') + li(result.withdrawn, 'No longer required') || '<li>No requirement changes.</li>') + '</ul>' };
  go('#/work/' + w.id);
}

function readRuleDraft(form) {
  const d = formData(form), r = ruleDraft.rule;
  r.name = d.name || ''; r.source = d.source || ''; r.owner = d.owner || ''; r.requirementTitle = d.requirementTitle || ''; r.requirementDescription = d.requirementDescription || '';
  r.tasks = (d.tasks || '').split('\n').map((s) => s.trim()).filter(Boolean); r.enabled = !!d.enabled;
  r.conditions = r.conditions.map((c, i) => ({ field: d['cfield' + i], op: d['cop' + i], value: d['cval' + i] }));
}

function saveRule(form) {
  readRuleDraft(form);
  const id = form.dataset.id, r = ruleDraft.rule;
  ERR = {};
  if (!r.name.trim()) fail('name', 'Enter a rule name');
  if (!r.conditions.length) fail('cond', 'Add at least one condition', 'cond-add');
  else { const i = r.conditions.findIndex((c) => c.value === '' || c.value == null); if (i >= 0) fail('cond', 'Enter a value for every condition', 'cval-' + i); }
  if (!r.requirementTitle.trim()) fail('requirementTitle', 'Enter a requirement title', 'rt');
  if (hasErr()) { rerender(); return; }
  let saved;
  if (id === 'new') { saved = Object.assign({ id: uid('RUL') }, r); S.rules.push(saved); }
  else { saved = S.rules.find((x) => x.id === id); Object.assign(saved, r); }
  // Existing actions keep their own history; newly added rule actions are raised on the re-run below.
  const added = [], withdrawn = [];
  S.works.forEach((w) => {
    const res = runEngine(w, 'Rule ' + saved.id + ' was ' + (id === 'new' ? 'added' : 'changed') + '.');
    if (res.added.length || res.withdrawn.length || res.reinstated.length) { recordTrigger(w, 'Rule ' + (id === 'new' ? 'added' : 'changed') + ': ' + saved.name, [], res); added.push(...res.added, ...res.reinstated); withdrawn.push(...res.withdrawn); }
  });
  save(); ruleDraft = null;
  flash = { title: 'Success', html: '<p class="govuk-notification-banner__heading">Rule saved. ' + added.length + ' requirement' + (added.length === 1 ? '' : 's') + ' added or reinstated, ' + withdrawn.length + ' withdrawn.</p>' };
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
  const q = p.toString(); go('#/rules' + (q ? '?' + q : ''));
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
  }
});

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-act]'); if (!t) return;
  const act = t.dataset.act;
  if (act === 'rule-info') ruleInfo(t.dataset.id);
  else if (act === 'dialog-close') closeDialog();
  else if (act === 'focus-field') { e.preventDefault(); const el = document.getElementById(t.dataset.field); if (el) { el.scrollIntoView({ block: 'center' }); el.focus(); } }
  else if (act === 'cond-add') { readRuleDraft(t.closest('form')); ruleDraft.rule.conditions.push({ field: 'type', op: 'is', value: OPT.type[0] }); ERR = {}; rerender(); }
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
  d.innerHTML = '<div class="dlg-head"><div><span class="rule-chip rule-chip--static">' + esc(r.id) + '</span> ' + (r.enabled !== false ? tag('Enabled', 'govuk-tag--green') : tag('Disabled', 'govuk-tag--grey')) +
    '<h2 class="govuk-heading-l" id="rule-dialog-title">' + esc(r.name) + '</h2><p class="govuk-body-s">Source: ' + esc(r.source) + '<br>Owner: ' + (r.owner ? esc(r.owner) + ' (' + (OWNER_TYPE(r.owner) || 'owner').toLowerCase() + ')' : 'Unassigned') + '</p></div><button type="button" class="dlg-x" data-act="dialog-close" aria-label="Close">&times;</button></div>' +
    '<h3 class="govuk-heading-s">When</h3><ul class="govuk-list govuk-list--bullet">' + r.conditions.map((c) => '<li>' + esc(condText(c)) + '</li>').join('') + '</ul>' +
    '<h3 class="govuk-heading-s">Requirement returned</h3><p class="govuk-body"><strong>' + esc(r.requirementTitle) + '</strong><br>' + esc(r.requirementDescription || '') + '</p>' +
    (r.tasks && r.tasks.length ? '<h3 class="govuk-heading-s">Actions raised</h3><ul class="govuk-list govuk-list--bullet">' + r.tasks.map((t) => '<li>' + esc(t) + '</li>').join('') + '</ul>' : '') +
    '<h3 class="govuk-heading-s">Currently applies to</h3>' + (apps.length ? '<ul class="govuk-list">' + apps.map((w) => '<li><a class="govuk-link" href="#/work/' + w.id + '" data-act="dialog-close">' + esc(w.title) + '</a></li>').join('') + '</ul>' : '<p class="govuk-body">No work items.</p>') +
    '<div class="govuk-button-group"><a class="govuk-button" role="button" draggable="false" href="#/rules/' + r.id + '" data-act="dialog-close">Edit rule</a><button type="button" class="govuk-button govuk-button--secondary" data-act="dialog-close">Close</button></div>';
  if (d.showModal) d.showModal(); else d.setAttribute('open', '');
}
function closeDialog() { const d = document.getElementById('rule-dialog'); if (d && d.open) { d.close ? d.close() : d.removeAttribute('open'); } }
document.addEventListener('click', (e) => { const d = document.getElementById('rule-dialog'); if (e.target === d) closeDialog(); });

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
