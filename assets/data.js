/* Shared fictional data and cross-prototype logic for the enabling services suite.
   window.ECO: seeded store (localStorage), rules evaluation, enrolment/action orchestration, reporting events.
   All prototypes read and write the same store so a change in one shows in the others. */
(function () {
  'use strict';
  var KEY = 'enabling-services-suite-v1';
  var DAY = 86400000;

  /* ---------- Reference data ---------- */
  var STAGES = ['Idea', 'Understanding', 'Design and test', 'Build', 'Run', 'Decommissioning'];
  var TYPES = ['Transactional', 'Information', 'Campaign', 'API'];
  var CHANNELS = ['Online', 'Native app', 'API', 'Face to face', 'Email'];
  var LEVELS = ['High', 'Medium', 'Low'];
  var OUTCOMES = { required: 'Required', 'needs-review': 'Needs review', recommended: 'Recommended', 'not-applicable': 'Not applicable' };
  var ENROL_STATUS = { 'not-applicable': 'Not applicable', 'not-enrolled': 'Not enrolled', 'action-required': 'Action required', pending: 'Pending', active: 'Active', 'attention-needed': 'Attention needed', retired: 'Retired' };
  var ENROL_TAG = { 'not-applicable': 'govuk-tag--grey', 'not-enrolled': 'govuk-tag--yellow', 'action-required': 'govuk-tag--orange', pending: 'govuk-tag--blue', active: 'govuk-tag--green', 'attention-needed': 'govuk-tag--red', retired: 'govuk-tag--purple' };
  var ACTION_STATUSES = ['Not started', 'In progress', 'Complete', 'Exception', 'No longer required'];
  var INTEGRATION_KINDS = { simulated: 'Simulated integration', manual: 'Manual handoff', real: 'Live integration' };

  // integration: how the service is enabled in this prototype. No live integrations exist.
  var CATALOGUE = [
    { id: 'user-feedback', name: 'User feedback', integration: 'simulated', owner: 'Digital insight', system: 'Feedback service', url: '../feedback-satisfaction/#/feedback',
      summary: 'Per-page "Was this page useful?" feedback embedded in digital pages.', manual: '' },
    { id: 'user-satisfaction', name: 'User satisfaction', integration: 'simulated', owner: 'Digital insight', system: 'Satisfaction service', url: '../feedback-satisfaction/#/satisfaction',
      summary: 'End-of-transaction and journey surveys, including email invitations.', manual: '' },
    { id: 'analytics', name: 'Analytics reporting', integration: 'simulated', owner: 'Performance analysis', system: 'Central analytics', url: '../analytics-reporting/#/connectors',
      summary: 'Standard service performance metrics published to central reporting.', manual: '' },
    { id: 'aiss', name: 'Accessibility (AISS)', integration: 'manual', owner: 'Accessibility team', system: 'AISS', url: '../assurance/#/accessibility',
      summary: 'Accessibility issues and statement management.', manual: 'Enrol the service in AISS using the service name, URL and owner, then record the AISS reference as evidence.' },
    { id: 'standards', name: 'DDT standards compliance', integration: 'manual', owner: 'Assurance team', system: 'SHCA PowerApp', url: '../assurance/#/standards',
      summary: 'Applicable DDT standards, attestations and evidence.', manual: 'Open the SHCA PowerApp, complete the compliance return for this product, and attach the submission reference as evidence.' },
    { id: 'sas', name: 'Service assessment (SAS)', integration: 'manual', owner: 'Service assessment team', system: 'SAS', url: '../assurance/#/assessments',
      summary: 'Service assessment booking and outcomes.', manual: 'Request an assessment slot in SAS, then record the booking reference and the date as evidence.' },
    { id: 'compass', name: 'COMPASS work and RAID', integration: 'simulated', owner: 'Portfolio office', system: 'COMPASS', url: '../rules-engine/#/dashboard',
      summary: 'Work, actions, risks and issues in the delivery record.', manual: '' }
  ];

  var STANDARDS = [
    { id: 'STD-SS', name: 'Service Standard', source: 'GDS Service Standard', when: [] },
    { id: 'STD-ACC', name: 'Accessibility', source: 'Public sector accessibility regulations', when: [{ field: 'channels', op: 'includes', value: 'Online' }] },
    { id: 'STD-DP', name: 'Data protection', source: 'UK GDPR / DfE data protection policy', when: [{ field: 'personalData', op: 'is', value: true }] },
    { id: 'STD-API', name: 'API standards', source: 'DDT technical standards', when: [{ field: 'type', op: 'is', value: 'API' }] },
    { id: 'STD-CON', name: 'Content design', source: 'GOV.UK style guide', when: [{ field: 'type', op: 'in', value: ['Information', 'Campaign'] }] },
    { id: 'STD-SEC', name: 'Security', source: 'DfE security policy', when: [{ field: 'status', op: 'is', value: 'Live' }] }
  ];

  var RULES = [
    { id: 'RULE-001', name: 'Feedback on live and pre-live online services', enablingId: 'user-feedback', outcome: 'required', source: 'DDT user feedback policy', version: 2, status: 'published', effective: '2026-04-01',
      conditions: [{ field: 'channels', op: 'includes', value: 'Online' }, { field: 'stage', op: 'in', value: ['Build', 'Run'] }] },
    { id: 'RULE-002', name: 'Feedback recommended during design', enablingId: 'user-feedback', outcome: 'recommended', source: 'DDT user feedback policy', version: 1, status: 'published', effective: '2026-04-01',
      conditions: [{ field: 'channels', op: 'includes', value: 'Online' }, { field: 'stage', op: 'is', value: 'Design and test' }] },
    { id: 'RULE-003', name: 'Satisfaction for high volume transactional services', enablingId: 'user-satisfaction', outcome: 'required', source: 'DDT performance measurement standard', version: 1, status: 'published', effective: '2026-04-01',
      conditions: [{ field: 'type', op: 'is', value: 'Transactional' }, { field: 'stage', op: 'in', value: ['Build', 'Run'] }, { field: 'estTransactions', op: 'gte', value: 100000 }] },
    { id: 'RULE-004', name: 'Satisfaction recommended for other transactional services', enablingId: 'user-satisfaction', outcome: 'recommended', source: 'DDT performance measurement standard', version: 1, status: 'published', effective: '2026-04-01',
      conditions: [{ field: 'type', op: 'is', value: 'Transactional' }, { field: 'stage', op: 'in', value: ['Build', 'Run'] }] },
    { id: 'RULE-005', name: 'Analytics for live online and API services', enablingId: 'analytics', outcome: 'required', source: 'DDT performance measurement standard', version: 1, status: 'published', effective: '2026-04-01',
      conditions: [{ field: 'channels', op: 'includesAny', value: ['Online', 'API'] }, { field: 'stage', op: 'is', value: 'Run' }] },
    { id: 'RULE-006', name: 'Analytics recommended in build', enablingId: 'analytics', outcome: 'recommended', source: 'DDT performance measurement standard', version: 1, status: 'published', effective: '2026-04-01',
      conditions: [{ field: 'channels', op: 'includesAny', value: ['Online', 'API'] }, { field: 'stage', op: 'is', value: 'Build' }] },
    { id: 'RULE-007', name: 'AISS enrolment for online services before live', enablingId: 'aiss', outcome: 'required', source: 'Public sector accessibility regulations', version: 3, status: 'published', effective: '2026-02-01',
      conditions: [{ field: 'channels', op: 'includes', value: 'Online' }, { field: 'stage', op: 'in', value: ['Build', 'Run'] }] },
    { id: 'RULE-008', name: 'Standards compliance for live services', enablingId: 'standards', outcome: 'required', source: 'DDT standards compliance policy', version: 1, status: 'published', effective: '2026-04-01',
      conditions: [{ field: 'status', op: 'is', value: 'Live' }] },
    { id: 'RULE-009', name: 'Standards compliance recommended in build', enablingId: 'standards', outcome: 'recommended', source: 'DDT standards compliance policy', version: 1, status: 'published', effective: '2026-04-01',
      conditions: [{ field: 'stage', op: 'is', value: 'Build' }] },
    { id: 'RULE-010', name: 'Service assessment for high volume transactional services', enablingId: 'sas', outcome: 'required', source: 'GDS Service Standard', version: 2, status: 'published', effective: '2026-03-01',
      conditions: [{ field: 'type', op: 'is', value: 'Transactional' }, { field: 'stage', op: 'in', value: ['Design and test', 'Build'] }, { field: 'estTransactions', op: 'gte', value: 100000 }] },
    { id: 'RULE-011', name: 'Service assessment for high risk work', enablingId: 'sas', outcome: 'required', source: 'Risk management framework', version: 1, status: 'published', effective: '2026-03-01',
      conditions: [{ field: 'risk', op: 'is', value: 'High' }, { field: 'stage', op: 'in', value: ['Design and test', 'Build'] }] },
    { id: 'RULE-012', name: 'Assessment route needs review when volumes are unknown', enablingId: 'sas', outcome: 'needs-review', source: 'GDS Service Standard', version: 1, status: 'published', effective: '2026-03-01',
      conditions: [{ field: 'type', op: 'is', value: 'Transactional' }, { field: 'stage', op: 'in', value: ['Design and test', 'Build'] }, { field: 'estTransactions', op: 'missing' }] },
    { id: 'RULE-013', name: 'COMPASS record for all work', enablingId: 'compass', outcome: 'required', source: 'Portfolio management policy', version: 1, status: 'published', effective: '2026-01-01', conditions: [] }
  ];

  var PEOPLE = [
    { id: 'P-01', name: 'Priya Nair', role: 'Platform administrator', team: 'Enabling services' },
    { id: 'P-02', name: 'Tom Hughes', role: 'Enabling service administrator', team: 'Digital insight' },
    { id: 'P-03', name: 'Amara Okafor', role: 'Service owner', team: 'Schools Digital' },
    { id: 'P-04', name: 'Chris Walker', role: 'Service owner', team: 'Early Years Digital' },
    { id: 'P-05', name: 'Jo Bennett', role: 'Team member', team: 'Schools Digital' },
    { id: 'P-06', name: 'Sam Patel', role: 'Assessor', team: 'Service assessment' },
    { id: 'P-07', name: 'Elena Rossi', role: 'Reader', team: 'Portfolio office' },
    { id: 'P-08', name: 'Dan Fraser', role: 'Service owner', team: 'Teaching Workforce' }
  ];

  var SERVICES = [
    { serviceId: 'SVC-001', productId: 'PRD-001', serviceOfferingId: 'OFF-001', workId: 'WRK-001', name: 'School trips booking service', description: 'Lets parents book and pay for school trips online.',
      owner: 'Amara Okafor', team: 'Schools Digital', area: 'Schools', type: 'Transactional', stage: 'Build', status: 'In delivery', channels: ['Online'], urls: ['https://school-trips.example.gov.uk'],
      journeys: [{ id: 'JNY-001', name: 'Book a trip', transactional: true }, { id: 'JNY-002', name: 'Pay for a trip', transactional: true }], formBuilder: true, personalData: true, users: ['Parents and Carers', 'Teachers'],
      policyOutcome: 'Reduce paper permission slips', estTransactions: 250000, risk: 'Medium' },
    { serviceId: 'SVC-002', productId: 'PRD-002', serviceOfferingId: 'OFF-002', workId: 'WRK-002', name: 'Find teacher training', description: 'Helps graduates find and compare teacher training courses.',
      owner: 'Dan Fraser', team: 'Teaching Workforce', area: 'Teaching workforce', type: 'Information', stage: 'Run', status: 'Live', channels: ['Online'], urls: ['https://find-teacher-training.example.gov.uk'],
      journeys: [{ id: 'JNY-003', name: 'Search for a course', transactional: false }], formBuilder: false, personalData: false, users: ['Public'],
      policyOutcome: 'Increase teacher recruitment', estTransactions: null, risk: 'Low' },
    { serviceId: 'SVC-003', productId: 'PRD-003', serviceOfferingId: 'OFF-003', workId: 'WRK-003', name: 'Early years funding claims', description: 'Providers claim funding for early years places.',
      owner: 'Chris Walker', team: 'Early Years Digital', area: 'Early years', type: 'Transactional', stage: 'Run', status: 'Live', channels: ['Online', 'Email'], urls: ['https://early-years-claims.example.gov.uk'],
      journeys: [{ id: 'JNY-004', name: 'Submit a claim', transactional: true }, { id: 'JNY-005', name: 'Amend a claim', transactional: true }], formBuilder: true, personalData: true, users: ['Local Authorities', 'Providers'],
      policyOutcome: 'Timely funding for providers', estTransactions: 480000, risk: 'Medium' },
    { serviceId: 'SVC-004', productId: 'PRD-004', serviceOfferingId: 'OFF-004', workId: 'WRK-004', name: 'Schools data API', description: 'Provides school and trust reference data to other services.',
      owner: 'Jo Bennett', team: 'Schools Digital', area: 'Data', type: 'API', stage: 'Run', status: 'Live', channels: ['API'], urls: ['https://api.schools-data.example.gov.uk'],
      journeys: [{ id: 'JNY-006', name: 'Look up a school', transactional: false }], formBuilder: false, personalData: true, users: ['Developers'],
      policyOutcome: 'Single source of school data', estTransactions: 9000000, risk: 'Medium' },
    { serviceId: 'SVC-005', productId: 'PRD-005', serviceOfferingId: 'OFF-005', workId: 'WRK-005', name: 'Back to school campaign', description: 'Campaign pages to encourage attendance.',
      owner: 'Amara Okafor', team: 'Schools Digital', area: 'Schools', type: 'Campaign', stage: 'Design and test', status: 'In delivery', channels: ['Online', 'Email'], urls: ['https://back-to-school.example.gov.uk'],
      journeys: [{ id: 'JNY-007', name: 'Read the campaign', transactional: false }], formBuilder: false, personalData: false, users: ['Parents and Carers'],
      policyOutcome: 'Improve attendance', estTransactions: null, risk: 'Low' },
    { serviceId: 'SVC-006', productId: 'PRD-006', serviceOfferingId: 'OFF-006', workId: 'WRK-006', name: 'Case management replacement', description: 'Replaces the legacy casework system.',
      owner: 'Chris Walker', team: 'Early Years Digital', area: 'Casework', type: 'Transactional', stage: 'Design and test', status: 'In delivery', channels: ['Online'], urls: [],
      journeys: [{ id: 'JNY-008', name: 'Raise a case', transactional: true }], formBuilder: false, personalData: true, users: ['Caseworkers'],
      policyOutcome: 'Retire legacy platform', estTransactions: null, risk: 'High' },
    { serviceId: 'SVC-007', productId: 'PRD-007', serviceOfferingId: 'OFF-007', workId: 'WRK-007', name: 'Free school meals eligibility checker', description: 'Parents check eligibility for free school meals.',
      owner: 'Amara Okafor', team: 'Schools Digital', area: 'Schools', type: 'Transactional', stage: 'Run', status: 'Live', channels: ['Online'], urls: ['https://free-school-meals.example.gov.uk'],
      journeys: [{ id: 'JNY-009', name: 'Check eligibility', transactional: true }], formBuilder: true, personalData: true, users: ['Parents and Carers'],
      policyOutcome: 'Increase take-up of free school meals', estTransactions: 120000, risk: 'Medium' }
  ];

  var INTEGRATIONS = [
    { id: 'INT-01', name: 'Service register', kind: 'simulated', status: 'healthy', lastSync: 0.1, note: 'Authoritative service and product records' },
    { id: 'INT-02', name: 'COMPASS', kind: 'simulated', status: 'healthy', lastSync: 0.2, note: 'Work, actions and RAID' },
    { id: 'INT-03', name: 'Feedback service', kind: 'simulated', status: 'healthy', lastSync: 0.05, note: 'Per-page feedback' },
    { id: 'INT-04', name: 'Satisfaction service', kind: 'simulated', status: 'degraded', lastSync: 1.4, note: 'Email invitation provider rate limited' },
    { id: 'INT-05', name: 'Central analytics', kind: 'simulated', status: 'failing', lastSync: 3.2, note: 'Authentication token expired for one property' },
    { id: 'INT-06', name: 'AISS', kind: 'manual', status: 'healthy', lastSync: 6, note: 'Manual handoff, status confirmed by the service team' },
    { id: 'INT-07', name: 'SHCA PowerApp', kind: 'manual', status: 'healthy', lastSync: 9, note: 'Interim compliance returns, manual extract' },
    { id: 'INT-08', name: 'SAS', kind: 'manual', status: 'healthy', lastSync: 4, note: 'Assessment booking handled in SAS' }
  ];

  /* ---------- Utilities ---------- */
  function rng(seed) { var a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function iso(ms) { return new Date(ms).toISOString(); }
  function ago(days) { return iso(Date.now() - days * DAY); }
  function ahead(days) { return iso(Date.now() + days * DAY); }

  var S = null;
  function uid(prefix) { S.seq[prefix] = (S.seq[prefix] || 0) + 1; return prefix + '-' + String(S.seq[prefix]).padStart(3, '0'); }

  /* ---------- Rules evaluation ---------- */
  function condMatch(svc, c) {
    var v = svc[c.field];
    switch (c.op) {
      case 'is': return v === c.value;
      case 'isnot': return v !== c.value;
      case 'in': return c.value.indexOf(v) > -1;
      case 'includes': return (v || []).indexOf(c.value) > -1;
      case 'includesAny': return (v || []).some(function (x) { return c.value.indexOf(x) > -1; });
      case 'gte': return v != null && Number(v) >= Number(c.value);
      case 'lte': return v != null && Number(v) <= Number(c.value);
      case 'missing': return v == null || v === '';
    }
    return false;
  }
  function condText(c) {
    var labels = { type: 'Type', stage: 'Lifecycle stage', channels: 'Channels', personalData: 'Personal data', estTransactions: 'Estimated transactions', risk: 'Risk', status: 'Status', formBuilder: 'Uses form builder' };
    var ops = { is: 'is', isnot: 'is not', in: 'is one of', includes: 'includes', includesAny: 'includes any of', gte: 'is at least', lte: 'is at most', missing: 'is not known' };
    var val = c.op === 'missing' ? '' : ' ' + (Array.isArray(c.value) ? c.value.join(', ') : typeof c.value === 'number' ? c.value.toLocaleString('en-GB') : (c.value === true ? 'Yes' : c.value === false ? 'No' : c.value));
    return (labels[c.field] || c.field) + ' ' + (ops[c.op] || c.op) + val;
  }
  var RANK = { required: 4, 'needs-review': 3, recommended: 2, 'not-applicable': 1 };
  // Returns { enablingId: { outcome, rule, matched:[rule], reason, source, ruleVersion } } for one service.
  // opts.rules lets the admin console evaluate a draft rule set.
  function evaluate(svc, opts) {
    var rules = (opts && opts.rules) || S.rules.filter(function (r) { return r.status === 'published'; });
    var out = {};
    CATALOGUE.forEach(function (e) {
      var matched = rules.filter(function (r) { return r.enablingId === e.id && r.conditions.every(function (c) { return condMatch(svc, c); }); });
      matched.sort(function (a, b) { return RANK[b.outcome] - RANK[a.outcome]; });
      var top = matched[0];
      out[e.id] = top ? { outcome: top.outcome, rule: top, matched: matched, ruleId: top.id, ruleVersion: top.version, source: top.source, reason: top.conditions.length ? top.conditions.map(condText).join('; ') : 'Applies to all work' }
        : { outcome: 'not-applicable', rule: null, matched: [], ruleId: null, ruleVersion: null, source: 'No rule applies', reason: 'No published rule matches this service\u2019s classification' };
    });
    return out;
  }
  function applicableStandards(svc) {
    return STANDARDS.filter(function (s) { return s.when.every(function (c) { return condMatch(svc, c); }); }).map(function (s) { return { id: s.id, name: s.name, source: s.source, why: s.when.length ? s.when.map(condText).join('; ') : 'Applies to all services' }; });
  }

  /* ---------- Events and audit (the common reporting contract) ---------- */
  function event(type, svc, extra) {
    extra = extra || {};
    var ev = { eventId: 'EVT-' + String(++S.seq.EVT).padStart(5, '0'), eventType: type, occurredAt: iso(Date.now()), sourceSystem: extra.sourceSystem || 'enabling-services-suite',
      serviceId: svc ? svc.serviceId : null, productId: svc ? svc.productId : null, workId: svc ? svc.workId : null, enablingServiceId: extra.enablingServiceId || null,
      status: extra.status || null, ruleId: extra.ruleId || null, ruleVersion: extra.ruleVersion || null, recordUrl: extra.recordUrl || (svc ? '../enabling-services/#/services/' + svc.serviceId : null), detail: extra.detail || '' };
    S.events.unshift(ev); if (S.events.length > 400) S.events.length = 400;
    return ev;
  }
  function audit(actor, action, target) { S.audit.unshift({ id: 'AUD-' + String(++S.seq.AUD).padStart(5, '0'), at: iso(Date.now()), actor: actor || 'System', action: action, target: target || '' }); if (S.audit.length > 400) S.audit.length = 400; }

  /* ---------- Enrolment and action orchestration ---------- */
  function getEnrolment(serviceId, enablingId) { return S.enrolments.filter(function (e) { return e.serviceId === serviceId && e.enablingId === enablingId; })[0]; }
  function openAction(serviceId, enablingId) { return S.actions.filter(function (a) { return a.serviceId === serviceId && a.enablingId === enablingId && a.source === 'rules' && a.status !== 'Complete' && a.status !== 'No longer required'; })[0]; }
  function setEnrolStatus(en, status, note, svc) {
    if (en.status === status) return;
    var from = en.status; en.status = status; en.updated = iso(Date.now());
    en.history.unshift({ at: en.updated, from: from, to: status, note: note || '' });
    event('enrolment.' + (status === 'active' ? 'activated' : 'status.changed'), svc, { enablingServiceId: en.enablingId, status: status, detail: note || '' });
  }
  function createAction(svc, cat, ev, note) {
    var a = { id: uid('ACT'), serviceId: svc.serviceId, workId: svc.workId, enablingId: cat.id, ruleId: ev.ruleId, type: 'action', source: 'rules',
      title: cat.id === 'sas' ? 'Book service assessment' : cat.id === 'aiss' ? 'Enrol in AISS' : cat.id === 'standards' ? 'Complete standards compliance return' : 'Set up ' + cat.name.toLowerCase(),
      description: cat.manual || ('Activate ' + cat.name.toLowerCase() + ' for this service in the ' + cat.system + '.'), owner: svc.owner, due: ahead(cat.id === 'sas' ? 28 : 14), status: 'Not started', created: iso(Date.now()),
      evidence: [], updates: [{ at: iso(Date.now()), type: 'system', text: 'Raised by ' + ev.ruleId + ' v' + ev.ruleVersion + '. ' + (note || '') }], manual: cat.integration === 'manual' };
    S.actions.push(a); event('action.created', svc, { enablingServiceId: cat.id, ruleId: ev.ruleId, ruleVersion: ev.ruleVersion, detail: a.title });
    return a;
  }
  // Reconcile enrolments and generated actions with the rules for one service. Idempotent: never duplicates an open action.
  // Returns [{enablingId, change, from, to}] describing what changed.
  function sync(serviceId, note) {
    var svc = S.services.filter(function (s) { return s.serviceId === serviceId; })[0]; if (!svc) return [];
    var ev = evaluate(svc), changes = [];
    CATALOGUE.forEach(function (cat) {
      var r = ev[cat.id], en = getEnrolment(serviceId, cat.id), act = openAction(serviceId, cat.id);
      if (!en) { en = { id: uid('ENR'), serviceId: serviceId, enablingId: cat.id, status: 'not-applicable', mode: cat.integration, updated: iso(Date.now()), history: [], lastEval: null }; S.enrolments.push(en); }
      var prev = en.lastEval;
      if (!prev || prev.outcome !== r.outcome || prev.ruleId !== r.ruleId || prev.ruleVersion !== r.ruleVersion) {
        event('rule.evaluated', svc, { enablingServiceId: cat.id, ruleId: r.ruleId, ruleVersion: r.ruleVersion, status: r.outcome, detail: r.reason });
        en.lastEval = { outcome: r.outcome, ruleId: r.ruleId, ruleVersion: r.ruleVersion, at: iso(Date.now()) };
      }
      var before = en.status;
      if (r.outcome === 'required' || r.outcome === 'needs-review') {
        if (en.status === 'not-applicable' || en.status === 'not-enrolled' || en.status === 'retired') { setEnrolStatus(en, 'action-required', 'Rule ' + r.ruleId + ' v' + r.ruleVersion + ' applies', svc); }
        if (['action-required', 'attention-needed'].indexOf(en.status) > -1 && !act && cat.id !== 'compass') { createAction(svc, cat, r, note); }
        if (en.status === 'attention-needed' && !act && en.status !== before) { /* already flagged */ }
      } else if (r.outcome === 'recommended') {
        if (en.status === 'not-applicable') setEnrolStatus(en, 'not-enrolled', 'Recommended by ' + r.ruleId, svc);
        if (act && en.status === 'action-required') { en.status = 'not-enrolled'; }
      } else {
        if (en.status === 'action-required' || en.status === 'not-enrolled') {
          setEnrolStatus(en, 'not-applicable', 'No rule applies after the change', svc);
          if (act) { act.status = 'No longer required'; act.updates.push({ at: iso(Date.now()), type: 'system', text: 'No longer required. ' + (note || '') }); }
        } else if (['active', 'pending'].indexOf(en.status) > -1) {
          setEnrolStatus(en, 'attention-needed', 'No longer required by the rules; review whether to retire', svc);
        }
      }
      if (before !== en.status) changes.push({ enablingId: cat.id, from: before, to: en.status, outcome: r.outcome });
    });
    return changes;
  }
  // Change classification attributes, record the difference, re-evaluate. Returns { diff, changes, before, after }.
  function setAttrs(serviceId, patch, actor) {
    var svc = S.services.filter(function (s) { return s.serviceId === serviceId; })[0], before = evaluate(svc), diff = [];
    Object.keys(patch).forEach(function (k) { if (JSON.stringify(svc[k]) !== JSON.stringify(patch[k])) { diff.push({ field: k, from: svc[k], to: patch[k] }); svc[k] = patch[k]; } });
    if (!diff.length) return { diff: diff, changes: [], before: before, after: before };
    event('service.classified', svc, { detail: diff.map(function (d) { return d.field + ': ' + d.from + ' to ' + d.to; }).join('; ') });
    audit(actor || 'Service owner', 'Changed classification', svc.serviceId + ' ' + diff.map(function (d) { return d.field; }).join(', '));
    var changes = sync(serviceId, 'Triggered by a classification change.');
    return { diff: diff, changes: changes, before: before, after: evaluate(svc) };
  }
  function completeAction(id, evidenceText, link, actor) {
    var a = S.actions.filter(function (x) { return x.id === id; })[0]; if (!a) return;
    if (evidenceText) a.evidence.push({ id: 'EV-' + (a.evidence.length + 1), text: evidenceText, link: link || '', at: iso(Date.now()), by: actor || a.owner });
    a.status = 'Complete'; a.updates.push({ at: iso(Date.now()), type: evidenceText ? 'evidence' : 'system', text: evidenceText || 'Marked complete.', link: link || '' });
    var svc = S.services.filter(function (s) { return s.serviceId === a.serviceId; })[0], en = getEnrolment(a.serviceId, a.enablingId);
    if (en && en.status === 'action-required') setEnrolStatus(en, a.manual ? 'active' : 'pending', 'Action ' + a.id + ' completed', svc);
    event('action.completed', svc, { enablingServiceId: a.enablingId, detail: a.title });
  }

  /* ---------- Signals ---------- */
  function avg(list, f) { return list.length ? list.reduce(function (n, x) { return n + f(x); }, 0) / list.length : null; }
  // Compares the last 7 days with the previous 28 days for each journey; raises a signal when satisfaction or usefulness drops past a threshold.
  function detectSignals() {
    var created = [], now = Date.now();
    S.services.forEach(function (svc) {
      svc.journeys.forEach(function (j) {
        var rs = S.satisfaction.filter(function (r) { return r.serviceId === svc.serviceId && r.journeyId === j.id; });
        var recent = rs.filter(function (r) { return now - Date.parse(r.at) <= 7 * DAY; }), base = rs.filter(function (r) { var d = now - Date.parse(r.at); return d > 7 * DAY && d <= 35 * DAY; });
        if (recent.length >= 8 && base.length >= 8) {
          var a = avg(recent, function (r) { return r.score; }), b = avg(base, function (r) { return r.score; });
          if (b - a >= 0.5 && !S.signals.some(function (s) { return s.serviceId === svc.serviceId && s.journeyId === j.id && s.kind === 'satisfaction' && s.status === 'open'; })) {
            var sig = { id: uid('SIG'), serviceId: svc.serviceId, workId: svc.workId, journeyId: j.id, kind: 'satisfaction', at: iso(now), status: 'open', actionId: null,
              detail: 'Satisfaction for "' + j.name + '" fell from ' + b.toFixed(1) + ' to ' + a.toFixed(1) + ' out of 5 (last 7 days against the previous 28), from ' + recent.length + ' recent responses.' };
            S.signals.unshift(sig); created.push(sig); event('signal.raised', svc, { detail: sig.detail, recordUrl: '../feedback-satisfaction/#/signals' });
          }
        }
      });
      var fr = S.feedback.filter(function (r) { return r.serviceId === svc.serviceId; });
      var fRecent = fr.filter(function (r) { return now - Date.parse(r.at) <= 7 * DAY; }), fBase = fr.filter(function (r) { var d = now - Date.parse(r.at); return d > 7 * DAY && d <= 35 * DAY; });
      if (fRecent.length >= 10 && fBase.length >= 10) {
        var pa = avg(fRecent, function (r) { return r.useful ? 1 : 0; }), pb = avg(fBase, function (r) { return r.useful ? 1 : 0; });
        if (pb - pa >= 0.15 && !S.signals.some(function (s) { return s.serviceId === svc.serviceId && s.kind === 'feedback' && s.status === 'open'; })) {
          var s2 = { id: uid('SIG'), serviceId: svc.serviceId, workId: svc.workId, journeyId: null, kind: 'feedback', at: iso(now), status: 'open', actionId: null,
            detail: 'Share of "useful" page feedback fell from ' + Math.round(pb * 100) + '% to ' + Math.round(pa * 100) + '% (last 7 days against the previous 28).' };
          S.signals.unshift(s2); created.push(s2); event('signal.raised', svc, { detail: s2.detail, recordUrl: '../feedback-satisfaction/#/signals' });
        }
      }
    });
    return created;
  }
  // Authorised user confirms a signal: creates a linked risk, issue or improvement action in the work record.
  function confirmSignal(id, kind, actor) {
    var sig = S.signals.filter(function (s) { return s.id === id; })[0]; if (!sig) return null;
    var svc = S.services.filter(function (s) { return s.serviceId === sig.serviceId; })[0];
    var a = { id: uid('ACT'), serviceId: svc.serviceId, workId: svc.workId, enablingId: sig.kind === 'satisfaction' ? 'user-satisfaction' : 'user-feedback', ruleId: null, type: kind, source: 'signal', signalId: sig.id,
      title: (kind === 'risk' ? 'Risk: ' : kind === 'issue' ? 'Issue: ' : 'Improve: ') + sig.detail.split(' fell')[0].replace('Satisfaction for ', '').replace('Share of ', ''),
      description: sig.detail, owner: svc.owner, due: ahead(21), status: 'Not started', created: iso(Date.now()), evidence: [], updates: [{ at: iso(Date.now()), type: 'system', text: 'Created from signal ' + sig.id + ' confirmed by ' + (actor || 'service owner') + '.' }], manual: false };
    S.actions.push(a); sig.status = 'confirmed'; sig.actionId = a.id; event('action.created', svc, { enablingServiceId: a.enablingId, detail: a.title, recordUrl: '../rules-engine/#/actions' });
    return a;
  }
  // Journey C helper: adds a burst of poor satisfaction and negative feedback so the signal detector fires.
  function simulateDecline(serviceId, journeyId) {
    var svc = S.services.filter(function (s) { return s.serviceId === serviceId; })[0], r = rng(Date.now() % 100000), i;
    for (i = 0; i < 14; i++) S.satisfaction.push({ id: uid('SAT'), serviceId: serviceId, journeyId: journeyId, at: ago(r() * 5), score: r() < 0.7 ? 1 + Math.floor(r() * 2) : 3, channel: r() < 0.7 ? 'Online' : 'Email', comment: ['The form kept timing out', 'Could not upload my evidence', 'Page errors after I submitted', 'Too many questions'][Math.floor(r() * 4)] });
    for (i = 0; i < 16; i++) S.feedback.push({ id: uid('FBK'), serviceId: serviceId, page: svc.urls[0] ? '/' + svc.journeys[0].name.toLowerCase().replace(/ /g, '-') : '/', at: ago(r() * 5), useful: r() < 0.25, comment: r() < 0.5 ? 'Something went wrong when I tried to continue' : '', theme: 'Technical error', status: 'new', actionId: null });
    event('simulation.decline', svc, { detail: 'Simulated deteriorating satisfaction for ' + journeyId });
    return detectSignals();
  }

  /* ---------- Portfolio roll-up ---------- */
  function portfolio() {
    var rows = S.services.map(function (svc) {
      var ev = evaluate(svc), per = {};
      CATALOGUE.forEach(function (c) { var en = getEnrolment(svc.serviceId, c.id); per[c.id] = { outcome: ev[c.id].outcome, status: en ? en.status : 'not-applicable' }; });
      return { svc: svc, per: per };
    });
    var coverage = {};
    CATALOGUE.forEach(function (c) {
      var eligible = rows.filter(function (r) { return r.per[c.id].outcome === 'required' || r.per[c.id].outcome === 'needs-review'; });
      var enrolled = eligible.filter(function (r) { return r.per[c.id].status === 'active' || r.per[c.id].status === 'pending'; });
      coverage[c.id] = { eligible: eligible.length, enrolled: enrolled.length, gaps: eligible.length - enrolled.length };
    });
    return { rows: rows, coverage: coverage };
  }

  /* ---------- Seed ---------- */
  function seed() {
    S = { seq: { EVT: 0, AUD: 0 }, services: clone(SERVICES), rules: clone(RULES), enrolments: [], actions: [], feedback: [], satisfaction: [], signals: [], events: [], audit: [], exceptions: [],
      integrations: [], metrics: {}, assessments: [], aiss: {}, compliance: {}, risks: [], people: clone(PEOPLE), ext: {}, createdAt: iso(Date.now()), version: 1 };
    S.services.forEach(function (s) { s.provenance = { source: 'Service register', syncedAt: ago(0.1), mismatches: [] }; });
    S.services[2].provenance.mismatches.push('Owner in COMPASS is "C. Walker"; the service register says "Chris Walker".');
    S.services[3].provenance.mismatches.push('Product ID PRD-004 has two service offerings in the register; only OFF-004 is linked here.');
    S.services[5].provenance.mismatches.push('No URL recorded in the service register yet.');
    S.integrations = INTEGRATIONS.map(function (i) { var c = clone(i); c.lastSync = ago(c.lastSync); c.queue = c.status === 'failing' ? 3 : c.status === 'degraded' ? 1 : 0; c.log = [{ at: c.lastSync, level: c.status === 'healthy' ? 'info' : 'error', text: c.status === 'healthy' ? 'Synchronised successfully' : c.note }]; return c; });
    S.services.forEach(function (s) { sync(s.serviceId, 'Initial evaluation.'); });

    // Realistic enrolment progress
    function put(sv, en, status, evidenceText) {
      var e = getEnrolment(sv, en), svc = S.services.filter(function (s) { return s.serviceId === sv; })[0], a = openAction(sv, en);
      if (a && (status === 'active' || status === 'pending')) completeAction(a.id, evidenceText || 'Completed during onboarding.');
      e = getEnrolment(sv, en); if (e.status !== status) { e.status = status; e.updated = ago(5); e.history.unshift({ at: e.updated, from: 'action-required', to: status, note: 'Seeded' }); }
    }
    put('SVC-002', 'user-feedback', 'active'); put('SVC-002', 'analytics', 'active'); put('SVC-002', 'aiss', 'active', 'AISS ref AISS-2201'); put('SVC-002', 'standards', 'active', 'SHCA return SHCA-5541'); put('SVC-002', 'compass', 'active');
    put('SVC-003', 'user-feedback', 'active'); put('SVC-003', 'analytics', 'active'); put('SVC-003', 'aiss', 'active', 'AISS ref AISS-2188'); put('SVC-003', 'compass', 'active');
    put('SVC-003', 'standards', 'attention-needed');
    put('SVC-004', 'analytics', 'active'); put('SVC-004', 'standards', 'active', 'SHCA return SHCA-5602'); put('SVC-004', 'compass', 'active');
    put('SVC-007', 'user-feedback', 'active'); put('SVC-007', 'user-satisfaction', 'pending'); put('SVC-007', 'analytics', 'active'); put('SVC-007', 'compass', 'active'); put('SVC-007', 'aiss', 'active', 'AISS ref AISS-2310');
    put('SVC-001', 'compass', 'active'); put('SVC-005', 'compass', 'active'); put('SVC-006', 'compass', 'active');
    var a1 = openAction('SVC-001', 'aiss'); if (a1) { a1.status = 'In progress'; a1.updates.push({ at: ago(2), type: 'note', text: 'Waiting for the production URL before enrolling.' }); }
    var a2 = openAction('SVC-003', 'user-satisfaction'); if (a2) { a2.status = 'In progress'; a2.due = ago(6); }

    // Time series: feedback, satisfaction, metrics (deterministic)
    var r = rng(2026), themes = ['Navigation', 'Content clarity', 'Technical error', 'Missing information', 'Positive'], comments = {
      Navigation: ['I could not find the next step', 'The menu was confusing'], 'Content clarity': ['The guidance was hard to follow', 'Too much jargon'],
      'Technical error': ['The page did not load', 'I got an error after I clicked continue'], 'Missing information': ['I could not find the deadline', 'Does not say what documents I need'], Positive: ['Clear and quick', 'Found what I needed'] };
    var fbBase = { 'SVC-001': 0.62, 'SVC-002': 0.82, 'SVC-003': 0.7, 'SVC-005': 0.7, 'SVC-006': 0.55, 'SVC-007': 0.78 };
    Object.keys(fbBase).forEach(function (sid) {
      var svc = S.services.filter(function (s) { return s.serviceId === sid; })[0], pages = svc.journeys.map(function (j) { return '/' + j.name.toLowerCase().replace(/ /g, '-'); }).concat(['/start', '/help']);
      for (var i = 0; i < 90; i++) {
        var day = r() * 56, useful = r() < fbBase[sid], th = useful ? (r() < 0.5 ? 'Positive' : 'Content clarity') : themes[Math.floor(r() * 4)];
        S.feedback.push({ id: uid('FBK'), serviceId: sid, page: pages[Math.floor(r() * pages.length)], at: ago(day), useful: useful, comment: r() < 0.55 ? comments[th][Math.floor(r() * 2)] : '', theme: th, status: useful ? 'closed' : (r() < 0.8 ? 'new' : 'investigating'), actionId: null });
      }
    });
    S.services.filter(function (s) { return s.type === 'Transactional' && ['Build', 'Run'].indexOf(s.stage) > -1; }).forEach(function (svc) {
      svc.journeys.forEach(function (j) {
        var mean = svc.serviceId === 'SVC-003' ? 4.2 : svc.serviceId === 'SVC-007' ? 3.9 : 3.6;
        for (var i = 0; i < 70; i++) {
          var day = r() * 56, m = (svc.serviceId === 'SVC-003' && j.id === 'JNY-004' && day < 9) ? 2.6 : mean, sc = Math.max(1, Math.min(5, Math.round(m + (r() - 0.5) * 3)));
          S.satisfaction.push({ id: uid('SAT'), serviceId: svc.serviceId, journeyId: j.id, at: ago(day), score: sc, channel: r() < 0.65 ? 'Online' : 'Email', comment: sc <= 2 && r() < 0.6 ? ['The form timed out', 'Could not save my draft', 'Slow to load'][Math.floor(r() * 3)] : '' });
        }
      });
    });
    S.services.forEach(function (svc) {
      var live = svc.status === 'Live', base = { 'SVC-002': 120000, 'SVC-003': 61000, 'SVC-004': 950000, 'SVC-007': 15000 }[svc.serviceId];
      if (!base) return;
      var series = [];
      for (var w = 11; w >= 0; w--) {
        var v = Math.round(base * (0.85 + r() * 0.3));
        series.push({ weekStart: ago(w * 7 + 6), visits: v, completion: Math.round((0.62 + r() * 0.2) * 1000) / 10, errorRate: Math.round((0.4 + r() * 1.6) * 10) / 10, avgSeconds: Math.round(150 + r() * 120) });
      }
      var gap = svc.serviceId === 'SVC-007' ? 8 : -1; if (gap > -1) series[gap].visits = null;
      S.metrics[svc.serviceId] = { connected: svc.serviceId !== 'SVC-004' || true, source: svc.serviceId === 'SVC-004' ? 'Matomo' : 'GA4', property: svc.serviceId === 'SVC-004' ? 'MTM-77' : 'G-' + svc.serviceId.slice(-3) + 'X91',
        lastImport: svc.serviceId === 'SVC-004' ? ago(3.2) : ago(0.4), status: svc.serviceId === 'SVC-004' ? 'failing' : 'healthy', series: series,
        annotations: [{ at: ago(30), text: 'Release 4.2: new start page' }, { at: ago(12), text: 'Planned maintenance window' }], live: live };
    });

    // Assurance data
    S.assessments = [
      { id: 'ASM-001', serviceId: 'SVC-001', type: 'Beta assessment', status: 'Required', due: ahead(28), result: null, findings: [], bookingRef: '' },
      { id: 'ASM-002', serviceId: 'SVC-003', type: 'Live assessment', status: 'Completed', due: ago(120), result: 'Met with recommendations', findings: [{ id: 'F-1', text: 'Improve error messages on the claim form', status: 'Open', owner: 'Chris Walker' }], bookingRef: 'SAS-3301' },
      { id: 'ASM-003', serviceId: 'SVC-006', type: 'Alpha assessment', status: 'Booked', due: ahead(21), result: null, findings: [], bookingRef: 'SAS-3390' },
      { id: 'ASM-004', serviceId: 'SVC-007', type: 'Live assessment', status: 'Completed', due: ago(200), result: 'Met', findings: [], bookingRef: 'SAS-3150' }
    ];
    S.aiss = {
      'SVC-002': { enrolled: true, ref: 'AISS-2201', statement: 'Published', reviewDue: ahead(120), issues: [{ id: 'AI-1', title: 'Low contrast on filter chips', severity: 'Medium', owner: 'Dan Fraser', fixBy: ahead(30), status: 'Open' }] },
      'SVC-003': { enrolled: true, ref: 'AISS-2188', statement: 'Published', reviewDue: ago(14), issues: [{ id: 'AI-2', title: 'Date picker not keyboard accessible', severity: 'High', owner: 'Chris Walker', fixBy: ago(10), status: 'Open' }, { id: 'AI-3', title: 'Missing form error summary', severity: 'Medium', owner: 'Chris Walker', fixBy: ahead(14), status: 'Open' }] },
      'SVC-007': { enrolled: true, ref: 'AISS-2310', statement: 'Draft', reviewDue: ahead(40), issues: [] },
      'SVC-001': { enrolled: false, ref: '', statement: 'Missing', reviewDue: null, issues: [] }
    };
    S.compliance = {
      'SVC-002': { 'STD-SS': 'Compliant', 'STD-ACC': 'Compliant', 'STD-CON': 'Compliant', 'STD-SEC': 'Compliant' },
      'SVC-003': { 'STD-SS': 'Compliant', 'STD-ACC': 'Partial', 'STD-DP': 'Overdue', 'STD-SEC': 'Compliant' },
      'SVC-004': { 'STD-SS': 'Compliant', 'STD-DP': 'Compliant', 'STD-API': 'Partial', 'STD-SEC': 'Compliant' },
      'SVC-007': { 'STD-SS': 'Compliant', 'STD-ACC': 'Partial', 'STD-DP': 'Not assessed', 'STD-SEC': 'Compliant' }
    };
    S.risks = [
      { id: 'RSK-001', serviceId: 'SVC-003', workId: 'WRK-003', type: 'issue', title: 'Overdue DPIA review for claims data', severity: 'High', status: 'Open', source: 'standards', owner: 'Chris Walker' },
      { id: 'RSK-002', serviceId: 'SVC-006', workId: 'WRK-006', type: 'risk', title: 'Legacy platform contract ends before go-live', severity: 'High', status: 'Open', source: 'manual', owner: 'Chris Walker' }
    ];
    audit('Priya Nair', 'Published rule set', 'Rules v2026.2'); audit('Tom Hughes', 'Approved connector configuration', 'Central analytics');
    detectSignals();
    localStorage.setItem(KEY, JSON.stringify(S));
    return S;
  }

  function load() {
    try { var d = JSON.parse(localStorage.getItem(KEY)); if (d && d.services && d.version === 1) { S = d; return S; } } catch (e) { /* reseed */ }
    return seed();
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(S)); }
  load();

  window.ECO = {
    get: function () { return S; }, save: save, reset: function () { localStorage.removeItem(KEY); seed(); }, uid: uid, clone: clone,
    STAGES: STAGES, TYPES: TYPES, CHANNELS: CHANNELS, LEVELS: LEVELS, OUTCOMES: OUTCOMES, ENROL_STATUS: ENROL_STATUS, ENROL_TAG: ENROL_TAG, ACTION_STATUSES: ACTION_STATUSES,
    INTEGRATION_KINDS: INTEGRATION_KINDS, CATALOGUE: CATALOGUE, STANDARDS: STANDARDS,
    service: function (id) { return S.services.filter(function (s) { return s.serviceId === id; })[0]; },
    catalogue: function (id) { return CATALOGUE.filter(function (c) { return c.id === id; })[0]; },
    rule: function (id) { return S.rules.filter(function (r) { return r.id === id; })[0]; },
    person: function (name) { return S.people.filter(function (p) { return p.name === name; })[0]; },
    enrolment: getEnrolment, openAction: openAction, evaluate: evaluate, applicableStandards: applicableStandards, condText: condText, condMatch: condMatch,
    sync: sync, setAttrs: setAttrs, completeAction: completeAction, setEnrolStatus: setEnrolStatus,
    event: event, audit: audit, detectSignals: detectSignals, confirmSignal: confirmSignal, simulateDecline: simulateDecline, portfolio: portfolio,
    ago: ago, ahead: ahead, DAY: DAY
  };
})();
