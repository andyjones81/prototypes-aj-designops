(function () {
  'use strict';
  var esc = UI.esc;
  var STATUSES = ['In delivery', 'Live', 'Closed'];
  var ATTR_LABELS = { type: 'Type', stage: 'Lifecycle stage', channels: 'Channels', personalData: 'Personal data', estTransactions: 'Estimated transactions a year', risk: 'Risk', status: 'Status' };

  function S() { return ECO.get(); }
  function ext() {
    var s = S(); s.ext = s.ext || {};
    var e = s.ext['enabling-services'] = s.ext['enabling-services'] || {};
    e.filters = e.filters || { register: { stage: '', type: '', q: '' }, actions: { status: '' } };
    if (e.last === undefined) e.last = null;
    if (e.draft === undefined) e.draft = null;
    return e;
  }
  function fmt(v) {
    if (Array.isArray(v)) return v.length ? v.join(', ') : '\u2013';
    if (v === true) return 'Yes';
    if (v === false) return 'No';
    if (v == null || v === '') return '\u2013';
    if (typeof v === 'number') return UI.num(v);
    return String(v);
  }
  function opt(list, blank) { return (blank ? [{ value: '', label: blank }] : []).concat(list.map(function (x) { return { value: x, label: x }; })); }
  function svcOr404(id) { return ECO.service(id); }
  function notFound() { return UI.pageHead('Service not found') + '<p class="govuk-body">' + UI.link('#/services', 'Return to the service register') + '</p>'; }
  function crumbs(items) {
    return '<nav class="govuk-breadcrumbs govuk-breadcrumbs--collapse-on-mobile" aria-label="Breadcrumb"><ol class="govuk-breadcrumbs__list">' + items.map(function (i) {
      return '<li class="govuk-breadcrumbs__list-item">' + (i.href ? '<a class="govuk-breadcrumbs__link" href="' + esc(i.href) + '">' + esc(i.text) + '</a>' : esc(i.text)) + '</li>'; }).join('') + '</ol></nav>';
  }
  function freshId(prefix, taken) {
    var id; do { id = ECO.uid(prefix); } while (taken.indexOf(id) > -1); return id;
  }
  function counts(svc) {
    var ev = ECO.evaluate(svc), c = { required: 0, active: 0, attention: 0 };
    ECO.CATALOGUE.forEach(function (cat) {
      var en = ECO.enrolment(svc.serviceId, cat.id);
      if (ev[cat.id].outcome === 'required') c.required++;
      if (en && en.status === 'active') c.active++;
      if (en && (en.status === 'action-required' || en.status === 'attention-needed')) c.attention++;
    });
    return c;
  }
  function flashAfter(msg) { setTimeout(function () { UI.flash(msg); }, 0); }

  /* ---------- 1. Service register ---------- */
  function registerTable() {
    var f = ext().filters.register, q = (f.q || '').toLowerCase();
    var list = S().services.filter(function (s) {
      return (!f.stage || s.stage === f.stage) && (!f.type || s.type === f.type) &&
        (!q || (s.name + ' ' + s.serviceId + ' ' + s.owner + ' ' + s.team).toLowerCase().indexOf(q) > -1);
    });
    var rows = list.map(function (s) {
      var c = counts(s);
      return ['<a class="govuk-link" href="#/services/' + esc(s.serviceId) + '">' + esc(s.name) + '</a><br><span class="muted">' + esc(s.serviceId) + '</span>', esc(s.type), esc(s.stage), UI.tag(s.status), esc(s.owner),
        String(c.required), String(c.active), c.attention ? UI.tag(String(c.attention), 'red') : '0'];
    });
    return '<p class="govuk-body-s" aria-live="polite">Showing ' + list.length + ' of ' + S().services.length + ' services.</p>' +
      UI.table(['Service', 'Type', 'Stage', 'Status', 'Owner', 'Required', 'Active', 'Needs attention'], rows);
  }
  function registerPage() {
    var f = ext().filters.register;
    return UI.pageHead('Service register', 'Services and the enabling services each one needs. Required counts rules that currently require an enabling service; needs attention counts enrolments with an open action or flagged for review.',
        '<a class="govuk-button" href="#/new">Add a service</a>') +
      '<form class="toolbar" onsubmit="return false"><div class="row">' +
      UI.input('f-q', 'Search', f.q, { cls: 'govuk-!-width-one-third' }) + UI.select('f-stage', 'Stage', opt(ECO.STAGES, 'All stages'), f.stage) + UI.select('f-type', 'Type', opt(ECO.TYPES, 'All types'), f.type) +
      '</div></form><div id="reg-table">' + registerTable() + '</div>';
  }

  /* ---------- 2. Service overview ---------- */
  function actionEvidenceHtml(a) {
    var ev = a.evidence.length ? '<ul class="govuk-list govuk-list--bullet">' + a.evidence.map(function (e) {
      return '<li>' + esc(e.text) + (e.link ? ' (' + esc(e.link) + ')' : '') + ' <span class="muted">' + esc(e.by) + ', ' + UI.fmtDate(e.at) + '</span></li>'; }).join('') + '</ul>' : '<span class="muted">No evidence recorded.</span>';
    return ev;
  }
  function enablingTable(svc) {
    var ev = ECO.evaluate(svc);
    var rows = ECO.CATALOGUE.map(function (cat) {
      var r = ev[cat.id], en = ECO.enrolment(svc.serviceId, cat.id), act = ECO.openAction(svc.serviceId, cat.id), status = en ? en.status : 'not-applicable';
      var canEnable = ['required', 'needs-review', 'recommended'].indexOf(r.outcome) > -1 && ['active', 'pending', 'retired', 'not-applicable'].indexOf(status) === -1;
      return ['<strong>' + esc(cat.name) + '</strong>', UI.outcomeTag(r.outcome), UI.enrolTag(status), UI.ruleChip(r.ruleId, r.ruleVersion), esc(r.reason), UI.intKind(cat.integration),
        act ? '<a class="govuk-link" href="#/actions">' + esc(act.id) + '</a> ' + UI.tag(act.status) : '\u2013',
        canEnable ? '<button type="button" class="govuk-button govuk-button--secondary govuk-!-margin-bottom-0" data-module="govuk-button" data-enable="' + esc(svc.serviceId + '|' + cat.id) + '">Enable<span class="govuk-visually-hidden"> ' + esc(cat.name) + '</span></button>' : '\u2013'];
    });
    return UI.table(['Enabling service', 'Outcome', 'Enrolment', 'Rule', 'Reason', 'Integration', 'Open action', ''], rows);
  }
  function enablingList(svc) {
    var ev = ECO.evaluate(svc);
    return '<ul class="elist">' + ECO.CATALOGUE.map(function (cat) {
      var r = ev[cat.id], en = ECO.enrolment(svc.serviceId, cat.id), act = ECO.openAction(svc.serviceId, cat.id), status = en ? en.status : 'not-applicable';
      var canEnable = ['required', 'needs-review', 'recommended'].indexOf(r.outcome) > -1 && ['active', 'pending', 'retired', 'not-applicable'].indexOf(status) === -1;
      return '<li class="elist__row"><div class="elist__main"><div class="elist__title"><strong>' + esc(cat.name) + '</strong> ' + UI.outcomeTag(r.outcome) + ' ' + UI.enrolTag(status) + ' ' + UI.intKind(cat.integration) + '</div>' +
        '<div class="elist__meta">' + UI.ruleChip(r.ruleId, r.ruleVersion) + ' <span>' + esc(r.reason) + '</span></div>' +
        (act ? '<div class="elist__meta"><a class="govuk-link" href="#/actions">' + esc(act.id) + '</a> ' + UI.tag(act.status) + ' <span class="muted">Due ' + UI.fmtDate(act.due) + '</span></div>' : '') + '</div>' +
        '<div class="elist__act">' + (canEnable ? '<button type="button" class="govuk-button govuk-button--secondary govuk-!-margin-bottom-0" data-module="govuk-button" data-enable="' + esc(svc.serviceId + '|' + cat.id) + '">Enable<span class="govuk-visually-hidden"> ' + esc(cat.name) + '</span></button>' : '') + '</div></li>';
    }).join('') + '</ul>';
  }
  function servicePage(p) {
    var svc = svcOr404(p.id); if (!svc) return notFound();
    var pv = svc.provenance || { source: 'Unknown', mismatches: [] };
    function kv(rows) { return '<dl class="kv">' + rows.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>'; }).join('') + '</dl>'; }
    var summary = '<dl class="sumstrip">' + [['Status', UI.tag(svc.status)], ['Lifecycle stage', esc(svc.stage)], ['Risk', UI.tag(svc.risk)], ['Owner', esc(svc.owner) + '<br><span class="muted">' + esc(svc.team) + '</span>'],
      ['Personal data', fmt(svc.personalData)], ['Est. transactions', fmt(svc.estTransactions)]].map(function (r) { return '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>'; }).join('') + '</dl>';
    var details = kv([['Service ID', esc(svc.serviceId)], ['Product ID', esc(svc.productId)], ['Work ID', esc(svc.workId)], ['Area', esc(svc.area)], ['Type', esc(svc.type)], ['Channels', esc(fmt(svc.channels))],
      ['URLs', svc.urls && svc.urls.length ? esc(svc.urls.join(', ')) : '\u2013'], ['Journeys', svc.journeys && svc.journeys.length ? esc(svc.journeys.map(function (j) { return j.name; }).join(', ')) : '\u2013']]);
    var prov = kv([['Source', esc(pv.source) + ' ' + UI.intKind('simulated')], ['Last synced', pv.syncedAt ? UI.fmtTime(pv.syncedAt) : '\u2013']]) +
      (pv.mismatches && pv.mismatches.length ? UI.callout('warn', 'Mismatches between sources.', '<ul class="govuk-list govuk-list--bullet">' + pv.mismatches.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>')
        : '<p class="govuk-body-s muted govuk-!-margin-top-2">No mismatches between sources.</p>');
    var acts = S().actions.filter(function (a) { return a.serviceId === svc.serviceId; });
    var actList = acts.length ? '<ul class="elist">' + acts.map(function (a) {
      var cat = ECO.catalogue(a.enablingId);
      return '<li class="elist__row"><div class="elist__main"><div class="elist__title"><strong>' + esc(a.title) + '</strong> ' + UI.tag(a.status) + '</div>' +
        '<div class="elist__meta"><span class="muted">' + esc(a.id) + (cat ? ', ' + esc(cat.name) : '') + '</span> ' + UI.ruleChip(a.ruleId) + ' <span class="muted">Due ' + UI.fmtDate(a.due) + '</span></div>' +
        '<div class="elist__meta">' + actionEvidenceHtml(a) + '</div></div></li>';
    }).join('') + '</ul>' : '<p class="govuk-body-s muted">No actions for this service.</p>';
    var evs = S().events.filter(function (e) { return e.serviceId === svc.serviceId; }).slice(0, 8);
    var evList = '<ul class="timeline">' + evs.map(function (e) {
      var cat = e.enablingServiceId ? ECO.catalogue(e.enablingServiceId) : null;
      return '<li><span class="muted">' + UI.fmtTime(e.occurredAt) + '</span><br><strong>' + esc(e.eventType) + '</strong>' + (cat ? ' \u00b7 ' + esc(cat.name) : '') + (e.detail ? '<br><span class="muted">' + esc(e.detail) + '</span>' : '') + '</li>';
    }).join('') + '</ul>';
    return crumbs([{ text: 'Service register', href: '#/services' }, { text: svc.name }]) +
      UI.pageHead(svc.name, esc(svc.description), '<a class="govuk-button govuk-button--secondary" href="#/services/' + esc(svc.serviceId) + '/classify">Edit classification</a>') + summary +
      '<div class="detail-grid"><div class="detail-main"><h2 class="govuk-heading-m">Enabling services</h2><p class="govuk-body-s muted">Outcomes come from the published rules for this service\u2019s current classification.</p>' + enablingList(svc) +
      '<h2 class="govuk-heading-m govuk-!-margin-top-7">Actions</h2>' + actList + '</div>' +
      '<aside class="detail-side"><h2 class="govuk-heading-s">Service details</h2>' + details + '<h2 class="govuk-heading-s govuk-!-margin-top-6">Provenance</h2>' + prov +
      '<h2 class="govuk-heading-s govuk-!-margin-top-6">Recent events</h2>' + evList + '</aside></div>';
  }

  function evidenceModal(svcId, enId, vals, errs) {
    var svc = ECO.service(svcId), cat = ECO.catalogue(enId), act = ECO.openAction(svcId, enId); vals = vals || {};
    var body;
    if (cat.integration === 'manual') {
      body = UI.errorSummary(errs) + '<p class="govuk-body">' + UI.intKind('manual') + '</p><h3 class="govuk-heading-s">Manual instructions</h3><p class="govuk-body">' + esc(cat.manual) + '</p>' +
        '<p class="govuk-body-s">Nothing is sent from this prototype. Complete the step in ' + esc(cat.system) + ', then record the evidence here.</p>' +
        '<form data-form="evidence" novalidate><input type="hidden" name="svc" value="' + esc(svcId) + '"><input type="hidden" name="en" value="' + esc(enId) + '">' +
        UI.textarea('ev-text', 'Evidence', vals.text || '', { hint: 'For example a reference number or confirmation', err: errs && errs.length ? errs[0].msg : '' }) +
        UI.input('ev-link', 'Link to evidence (optional)', vals.link || '') + '<button type="submit" class="govuk-button" data-module="govuk-button">Complete with evidence</button></form>';
    } else {
      body = '<p class="govuk-body">' + UI.intKind('simulated') + '</p><p class="govuk-body">This activates ' + esc(cat.name) + ' for ' + esc(svc.name) + ' in this prototype only. No request is sent to ' + esc(cat.system) + '.</p>' +
        (act ? '<p class="govuk-body-s">Action ' + esc(act.id) + ' will be marked complete.</p>' : '') +
        '<button type="button" class="govuk-button" data-module="govuk-button" data-confirm-sim="' + esc(svcId + '|' + enId) + '">Confirm activation</button>';
    }
    UI.modal('Enable ' + cat.name, body);
  }
  function activate(svcId, enId, text, link) {
    var svc = ECO.service(svcId), cat = ECO.catalogue(enId), act = ECO.openAction(svcId, enId), en = ECO.enrolment(svcId, enId), target = cat.integration === 'manual' ? 'active' : 'pending';
    if (act) { ECO.completeAction(act.id, text, link, svc.owner); }
    else if (text) { ECO.event('evidence.recorded', svc, { enablingServiceId: enId, detail: text }); }
    en = ECO.enrolment(svcId, enId);
    if (en && ['active', 'pending'].indexOf(en.status) === -1) ECO.setEnrolStatus(en, target, 'Enabled from the service overview', svc);
    ECO.audit(svc.owner, 'Enabled ' + cat.name, svcId);
    ECO.save();
  }

  /* ---------- 3. Classification ---------- */
  function classifyForm(svc, v, errs) {
    errs = errs || []; var by = {}; errs.forEach(function (e) { by[e.id] = e.msg; });
    return crumbs([{ text: 'Service register', href: '#/services' }, { text: svc.name, href: '#/services/' + svc.serviceId }, { text: 'Edit classification' }]) +
      UI.errorSummary(errs) + UI.pageHead('Edit classification', 'Changing these attributes re-runs the rules for ' + esc(svc.name) + '. You will see what changes before anything else happens.') +
      '<form data-form="classify" data-id="' + esc(svc.serviceId) + '" novalidate>' +
      UI.select('type', 'Type', opt(ECO.TYPES), v.type, { err: by.type }) + UI.select('stage', 'Lifecycle stage', opt(ECO.STAGES), v.stage, { err: by.stage }) +
      UI.checkboxes('channels', 'Channels', ECO.CHANNELS, v.channels) + (by['channels-0'] ? '<p class="govuk-error-message">' + esc(by['channels-0']) + '</p>' : '') +
      UI.radios('personalData', 'Does the service process personal data?', [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }], v.personalData, { err: by['personalData-0'] }) +
      UI.input('estTransactions', 'Estimated transactions a year', v.estTransactions, { hint: 'Leave blank if not known', err: by.estTransactions, cls: 'govuk-input--width-10' }) +
      UI.select('risk', 'Risk', opt(ECO.LEVELS), v.risk, { err: by.risk }) + UI.select('status', 'Status', opt(STATUSES), v.status, { err: by.status }) +
      '<div class="row"><button type="submit" class="govuk-button" data-module="govuk-button">Save and re-evaluate</button><a class="govuk-link" href="#/services/' + esc(svc.serviceId) + '">Cancel</a></div></form>';
  }
  function classifyValues(svc) {
    return { type: svc.type, stage: svc.stage, channels: svc.channels.slice(), personalData: svc.personalData ? 'yes' : 'no', estTransactions: svc.estTransactions == null ? '' : String(svc.estTransactions), risk: svc.risk, status: svc.status };
  }
  function classifyPage(p) { var svc = svcOr404(p.id); if (!svc) return notFound(); return { html: classifyForm(svc, classifyValues(svc)), title: 'Edit classification' }; }
  function validateAttrs(d, withStatus) {
    var errs = [];
    if (ECO.TYPES.indexOf(d.type) < 0) errs.push({ id: 'type', msg: 'Select a type' });
    if (ECO.STAGES.indexOf(d.stage) < 0) errs.push({ id: 'stage', msg: 'Select a lifecycle stage' });
    if (!d.channels || !d.channels.length) errs.push({ id: 'channels-0', msg: 'Select at least one channel' });
    if (d.personalData !== 'yes' && d.personalData !== 'no') errs.push({ id: 'personalData-0', msg: 'Select whether the service processes personal data' });
    var t = String(d.estTransactions || '').replace(/,/g, '').trim();
    if (t !== '' && (!/^\d+$/.test(t))) errs.push({ id: 'estTransactions', msg: 'Estimated transactions must be a whole number, for example 250000' });
    if (ECO.LEVELS.indexOf(d.risk) < 0) errs.push({ id: 'risk', msg: 'Select a risk level' });
    if (withStatus && STATUSES.indexOf(d.status) < 0) errs.push({ id: 'status', msg: 'Select a status' });
    return errs;
  }
  function toPatch(d) {
    var t = String(d.estTransactions || '').replace(/,/g, '').trim();
    return { type: d.type, stage: d.stage, channels: d.channels, personalData: d.personalData === 'yes', estTransactions: t === '' ? null : Number(t), risk: d.risk, status: d.status };
  }
  function outcomeSnapshot(ev) { var o = {}; Object.keys(ev).forEach(function (k) { o[k] = { outcome: ev[k].outcome, ruleId: ev[k].ruleId, ruleVersion: ev[k].ruleVersion }; }); return o; }

  function resultPage(p) {
    var svc = svcOr404(p.id), L = ext().last;
    if (!svc) return notFound();
    if (!L || L.serviceId !== svc.serviceId) return crumbs([{ text: 'Service register', href: '#/services' }, { text: svc.name, href: '#/services/' + svc.serviceId }]) + UI.pageHead('No recent change') +
      '<p class="govuk-body">' + UI.link('#/services/' + svc.serviceId + '/classify', 'Edit the classification') + '</p>';
    var diffRows = L.diff.map(function (d) { return [esc(ATTR_LABELS[d.field] || d.field), esc(fmt(d.from)), '<strong>' + esc(fmt(d.to)) + '</strong>']; });
    var outRows = ECO.CATALOGUE.map(function (cat) {
      var b = L.before[cat.id], a = L.after[cat.id], ch = L.changes.filter(function (c) { return c.enablingId === cat.id; })[0], na = L.newActions.filter(function (x) { return x.enablingId === cat.id; });
      var changed = b.outcome !== a.outcome;
      return ['<strong>' + esc(cat.name) + '</strong>', UI.outcomeTag(b.outcome), changed ? '<strong>' + UI.outcomeTag(a.outcome) + '</strong>' : UI.outcomeTag(a.outcome), UI.ruleChip(a.ruleId, a.ruleVersion),
        ch ? esc(ECO.ENROL_STATUS[ch.from]) + ' to <strong>' + esc(ECO.ENROL_STATUS[ch.to]) + '</strong>' : 'No change',
        na.length ? na.map(function (x) { return esc(x.id) + ': ' + esc(x.title) + ' (due ' + UI.fmtDate(x.due) + ')'; }).join('<br>') : '\u2013'];
    });
    var flags = [];
    if (L.after.sas && L.after.sas.outcome === 'required' && L.before.sas.outcome !== 'required') flags.push('A service assessment is now required. Plan a reassessment.');
    if (L.changes.some(function (c) { return c.to === 'attention-needed'; })) flags.push('Some active enrolments are no longer required by the rules. Review whether to retire them.');
    return crumbs([{ text: 'Service register', href: '#/services' }, { text: svc.name, href: '#/services/' + svc.serviceId }, { text: 'Classification result' }]) +
      UI.pageHead('Classification updated', esc(svc.name) + ' was re-evaluated against the published rules.') +
      (L.diff.length ? '' : UI.callout('warn', '', 'Nothing changed, so no rules were re-run.')) +
      (L.newActions.length ? UI.callout('ok', L.newActions.length + ' new action' + (L.newActions.length === 1 ? '' : 's') + ' created.', 'Existing open actions were kept, so nothing is duplicated.') : UI.callout('ok', '', 'No new actions were needed.')) +
      flags.map(function (f) { return UI.callout('warn', '', esc(f)); }).join('') +
      '<section class="panel"><h2 class="govuk-heading-s">Attributes changed</h2>' + UI.table(['Attribute', 'Before', 'After'], diffRows) + '</section>' +
      '<section class="panel"><h2 class="govuk-heading-s">Enabling service outcomes, before and after</h2>' + UI.table(['Enabling service', 'Before', 'After', 'Rule', 'Enrolment change', 'New action'], outRows) + '</section>' +
      '<div class="row"><a class="govuk-button" href="#/services/' + esc(svc.serviceId) + '">View the service</a><a class="govuk-link" href="#/actions">View all actions</a></div>';
  }

  /* ---------- 4. Catalogue ---------- */
  function cataloguePage() {
    var rows = ECO.CATALOGUE.map(function (c) {
      var rules = S().rules.filter(function (r) { return r.enablingId === c.id && r.status === 'published'; });
      return ['<strong>' + esc(c.name) + '</strong>', esc(c.owner), UI.intKind(c.integration) + '<br><span class="muted">' + esc(c.system) + '</span>', esc(c.summary),
        rules.map(function (r) { return '<div class="row">' + UI.ruleChip(r.id, r.version) + UI.outcomeTag(r.outcome) + '</div>'; }).join('')];
    });
    return UI.pageHead('Enabling services', 'The shared services a product may need, who owns them, how they are enabled in this prototype, and the published rules that decide when they apply.') +
      UI.table(['Enabling service', 'Owner', 'Integration', 'Summary', 'Governing rules'], rows);
  }

  /* ---------- 5. Add service wizard ---------- */
  function draft() {
    var e = ext();
    if (!e.draft) e.draft = { step: 1, v: { name: '', description: '', owner: '', team: '', area: '', type: 'Transactional', stage: 'Idea', channels: ['Online'], personalData: '', estTransactions: '', risk: 'Medium' }, errs: [] };
    return e.draft;
  }
  function tempService(v) {
    var t = String(v.estTransactions || '').replace(/,/g, '').trim();
    return { name: v.name, type: v.type, stage: v.stage, channels: v.channels || [], personalData: v.personalData === 'yes', estTransactions: t === '' ? null : Number(t), risk: v.risk, status: v.stage === 'Run' ? 'Live' : 'In delivery', formBuilder: false };
  }
  function wizardPage() {
    var d = draft(), v = d.v, errs = d.errs || [], by = {}; errs.forEach(function (e) { by[e.id] = e.msg; });
    var steps = ['Basics', 'Type, channels and stage', 'Personal data and volumes', 'Preview'];
    var head = UI.pageHead('Add a service', 'Step ' + d.step + ' of 4: ' + steps[d.step - 1]);
    var body = '';
    if (d.step === 1) {
      var owners = S().people.map(function (p) { return p.name; });
      body = '<form data-form="wiz" novalidate>' + UI.input('name', 'Service name', v.name, { err: by.name }) + UI.textarea('description', 'Description', v.description, { err: by.description }) +
        UI.select('owner', 'Owner', opt(owners, 'Select an owner'), v.owner, { err: by.owner }) + UI.input('team', 'Team', v.team, { err: by.team }) + UI.input('area', 'Policy area (optional)', v.area) +
        '<button type="submit" class="govuk-button" data-module="govuk-button">Continue</button></form>';
    } else if (d.step === 2) {
      body = '<form data-form="wiz" novalidate>' + UI.select('type', 'Type', opt(ECO.TYPES), v.type, { err: by.type }) + UI.select('stage', 'Lifecycle stage', opt(ECO.STAGES), v.stage, { err: by.stage }) +
        UI.checkboxes('channels', 'Channels', ECO.CHANNELS, v.channels) + (by['channels-0'] ? '<p class="govuk-error-message">' + esc(by['channels-0']) + '</p>' : '') +
        '<div class="row"><button type="submit" class="govuk-button" data-module="govuk-button">Continue</button><button type="button" class="govuk-button govuk-button--secondary" data-wiz-back>Back</button></div></form>';
    } else if (d.step === 3) {
      body = '<form data-form="wiz" novalidate>' + UI.radios('personalData', 'Does the service process personal data?', [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }], v.personalData, { err: by['personalData-0'] }) +
        UI.input('estTransactions', 'Estimated transactions a year', v.estTransactions, { hint: 'Leave blank if not known', err: by.estTransactions, cls: 'govuk-input--width-10' }) + UI.select('risk', 'Risk', opt(ECO.LEVELS), v.risk, { err: by.risk }) +
        '<div class="row"><button type="submit" class="govuk-button" data-module="govuk-button">Preview enabling services</button><button type="button" class="govuk-button govuk-button--secondary" data-wiz-back>Back</button></div></form>';
    } else {
      var t = tempService(v), ev = ECO.evaluate(t);
      var rows = ECO.CATALOGUE.map(function (cat) {
        var r = ev[cat.id], what = r.outcome === 'required' || r.outcome === 'needs-review' ? 'An action will be created' : r.outcome === 'recommended' ? 'Recommended, no action created' : 'Nothing to do';
        return ['<strong>' + esc(cat.name) + '</strong>', UI.outcomeTag(r.outcome), UI.ruleChip(r.ruleId, r.ruleVersion), esc(r.reason), UI.intKind(cat.integration), esc(what)];
      });
      var summary = '<dl class="kv"><dt>Name</dt><dd>' + esc(v.name) + '</dd><dt>Owner</dt><dd>' + esc(v.owner) + ', ' + esc(v.team) + '</dd><dt>Type</dt><dd>' + esc(t.type) + '</dd><dt>Stage</dt><dd>' + esc(t.stage) + '</dd><dt>Channels</dt><dd>' + esc(fmt(t.channels)) +
        '</dd><dt>Personal data</dt><dd>' + fmt(t.personalData) + '</dd><dt>Estimated transactions</dt><dd>' + fmt(t.estTransactions) + '</dd><dt>Risk</dt><dd>' + esc(t.risk) + '</dd></dl>';
      body = '<section class="panel"><h2 class="govuk-heading-s">Service details</h2>' + summary + '</section><section class="panel"><h2 class="govuk-heading-s">Enabling services this service would need</h2>' +
        UI.table(['Enabling service', 'Outcome', 'Rule', 'Reason', 'Integration', 'On confirming'], rows) + '</section>' +
        '<div class="row"><button type="button" class="govuk-button" data-module="govuk-button" data-wiz-confirm>Confirm and add service</button><button type="button" class="govuk-button govuk-button--secondary" data-wiz-back>Back</button></div>';
    }
    return UI.errorSummary(errs) + head + body;
  }
  function wizardCapture(form, d) {
    var f = UI.formData(form);
    Object.keys(f).forEach(function (k) { d.v[k] = f[k]; });
  }
  function wizardSubmit(form) {
    var d = draft(); wizardCapture(form, d); var v = d.v, errs = [];
    if (d.step === 1) {
      if (!v.name.trim()) errs.push({ id: 'name', msg: 'Enter a service name' });
      if (!v.description.trim()) errs.push({ id: 'description', msg: 'Enter a description' });
      if (!v.owner) errs.push({ id: 'owner', msg: 'Select an owner' });
      if (!v.team.trim()) errs.push({ id: 'team', msg: 'Enter a team' });
    } else if (d.step === 2) { errs = validateAttrs({ type: v.type, stage: v.stage, channels: v.channels, personalData: 'yes', risk: 'Low' }).filter(function (e) { return ['type', 'stage', 'channels-0'].indexOf(e.id) > -1; }); }
    else if (d.step === 3) { errs = validateAttrs({ type: 'API', stage: 'Run', channels: ['API'], personalData: v.personalData, estTransactions: v.estTransactions, risk: v.risk }); }
    d.errs = errs;
    if (!errs.length) d.step++;
    ECO.save(); UI.go('#/new');
  }
  function wizardConfirm() {
    var d = draft(), v = d.v, t = tempService(v), s = S();
    var svc = { serviceId: freshId('SVC', s.services.map(function (x) { return x.serviceId; })), productId: freshId('PRD', s.services.map(function (x) { return x.productId; })),
      serviceOfferingId: freshId('OFF', s.services.map(function (x) { return x.serviceOfferingId; })), workId: freshId('WRK', s.services.map(function (x) { return x.workId; })),
      name: v.name.trim(), description: v.description.trim(), owner: v.owner, team: v.team.trim(), area: (v.area || '').trim() || 'Not set', type: t.type, stage: t.stage, status: t.status, channels: t.channels, urls: [],
      journeys: [], formBuilder: false, personalData: t.personalData, users: [], policyOutcome: '', estTransactions: t.estTransactions, risk: t.risk,
      provenance: { source: 'Manual entry', syncedAt: new Date().toISOString(), mismatches: [] } };
    s.services.push(svc);
    var changes = ECO.sync(svc.serviceId, 'Raised when the service was added.');
    ECO.event('service.created', svc, { detail: 'Added through the service wizard; ' + changes.length + ' enrolment change(s)' });
    ECO.audit(v.owner, 'Added service', svc.serviceId);
    ext().draft = null; ECO.save();
    UI.go('#/services/' + svc.serviceId); flashAfter('<strong>' + esc(svc.name) + ' added.</strong> Enabling service actions were created where the rules require them.');
  }

  /* ---------- 6. Actions ---------- */
  function actionsTable() {
    var f = ext().filters.actions, list = S().actions.filter(function (a) { return !f.status || a.status === f.status; });
    var rows = list.map(function (a) {
      var svc = ECO.service(a.serviceId), cat = ECO.catalogue(a.enablingId);
      return ['<strong>' + esc(a.title) + '</strong><br><span class="muted">' + esc(a.id) + '</span>', svc ? UI.link('#/services/' + svc.serviceId, svc.name) : esc(a.serviceId), cat ? esc(cat.name) : '\u2013', UI.ruleChip(a.ruleId), UI.fmtDate(a.due),
        UI.select('st-' + a.id, 'Status', ECO.ACTION_STATUSES, a.status).replace('<label class="govuk-label govuk-label--s"', '<label class="govuk-visually-hidden"').replace(/<select /, '<select data-act-status="' + esc(a.id) + '" ').replace('govuk-label govuk-label--s', 'govuk-visually-hidden'),
        String(a.evidence.length)];
    });
    return '<p class="govuk-body-s" aria-live="polite">Showing ' + list.length + ' of ' + S().actions.length + ' actions.</p>' + UI.table(['Action', 'Service', 'Enabling service', 'Rule', 'Due', 'Status', 'Evidence'], rows);
  }
  function actionsPage() {
    var f = ext().filters.actions;
    return UI.pageHead('Actions', 'Every action generated for enabling services. Completing an action needs evidence.') +
      '<form class="toolbar" onsubmit="return false">' + UI.select('f-act', 'Filter by status', opt(ECO.ACTION_STATUSES, 'All statuses'), f.status) + '</form><div id="act-table">' + actionsTable() + '</div>';
  }
  function completeModal(id, err, vals) {
    var a = S().actions.filter(function (x) { return x.id === id; })[0]; vals = vals || {};
    UI.modal('Complete ' + a.id, (err ? UI.errorSummary([{ id: 'ca-text', msg: err }]) : '') + '<p class="govuk-body">' + esc(a.title) + '</p><form data-form="complete" novalidate><input type="hidden" name="id" value="' + esc(id) + '">' +
      UI.textarea('ca-text', 'Evidence', vals.text || '', { err: err }) + UI.input('ca-link', 'Link to evidence (optional)', vals.link || '') + '<button type="submit" class="govuk-button" data-module="govuk-button">Complete with evidence</button></form>');
  }

  /* ---------- Routes ---------- */
  UI.route('/', registerPage, 'services');
  UI.route('/services', registerPage, 'services');
  UI.route('/services/:id', servicePage, 'services');
  UI.route('/services/:id/classify', classifyPage, 'services');
  UI.route('/services/:id/classify/result', resultPage, 'services');
  UI.route('/catalogue', cataloguePage, 'catalogue');
  UI.route('/actions', actionsPage, 'actions');
  UI.route('/new', wizardPage, 'new');

  /* ---------- Events ---------- */
  function refresh(sel, html) { var el = document.getElementById(sel); if (el) el.innerHTML = html; }
  UI.on('input', '#f-q', function (e, el) { ext().filters.register.q = el.value; refresh('reg-table', registerTable()); });
  UI.on('change', '#f-stage', function (e, el) { ext().filters.register.stage = el.value; refresh('reg-table', registerTable()); });
  UI.on('change', '#f-type', function (e, el) { ext().filters.register.type = el.value; refresh('reg-table', registerTable()); });
  UI.on('change', '#f-act', function (e, el) { ext().filters.actions.status = el.value; refresh('act-table', actionsTable()); });

  UI.on('click', '[data-enable]', function (e, el) { var p = el.getAttribute('data-enable').split('|'); evidenceModal(p[0], p[1]); });
  UI.on('click', '[data-confirm-sim]', function (e, el) {
    var p = el.getAttribute('data-confirm-sim').split('|'), cat = ECO.catalogue(p[1]);
    activate(p[0], p[1], 'Confirmed activation in the simulated ' + cat.system + ' integration'); UI.closeModal(); UI.go('#/services/' + p[0]); flashAfter(esc(cat.name) + ' activated (simulated).');
  });
  UI.on('submit', 'form[data-form="evidence"]', function (e, form) {
    e.preventDefault(); var f = UI.formData(form), text = (f['ev-text'] || '').trim();
    if (!text) { evidenceModal(f.svc, f.en, { text: '', link: f['ev-link'] }, [{ id: 'ev-text', msg: 'Enter the evidence for this step' }]); return; }
    activate(f.svc, f.en, text, (f['ev-link'] || '').trim()); UI.closeModal(); UI.go('#/services/' + f.svc); flashAfter('Completed with evidence.');
  });

  UI.on('submit', 'form[data-form="classify"]', function (e, form) {
    e.preventDefault(); var d = UI.formData(form), id = form.getAttribute('data-id'), svc = ECO.service(id), errs = validateAttrs(d, true);
    if (errs.length) { document.getElementById('app').innerHTML = classifyForm(svc, d, errs); if (window.govukInit) window.govukInit(document.getElementById('app')); window.scrollTo(0, 0); return; }
    var known = S().actions.map(function (a) { return a.id; });
    var res = ECO.setAttrs(id, toPatch(d), svc.owner);
    var created = S().actions.filter(function (a) { return a.serviceId === id && known.indexOf(a.id) < 0; }).map(function (a) { return { id: a.id, title: a.title, enablingId: a.enablingId, due: a.due, ruleId: a.ruleId }; });
    ext().last = { serviceId: id, at: new Date().toISOString(), diff: res.diff, changes: res.changes, before: outcomeSnapshot(res.before), after: outcomeSnapshot(res.after), newActions: created };
    ECO.save(); UI.go('#/services/' + id + '/classify/result');
  });

  UI.on('submit', 'form[data-form="wiz"]', function (e, form) { e.preventDefault(); wizardSubmit(form); });
  UI.on('click', '[data-wiz-back]', function () {
    var d = draft(), f = document.querySelector('form[data-form="wiz"]'); if (f) wizardCapture(f, d);
    if (d.step > 1) d.step--; d.errs = []; ECO.save(); UI.go('#/new');
  });
  UI.on('click', '[data-wiz-confirm]', function () { wizardConfirm(); });

  UI.on('change', '[data-act-status]', function (e, el) {
    var id = el.getAttribute('data-act-status'), a = S().actions.filter(function (x) { return x.id === id; })[0], val = el.value;
    if (val === 'Complete') { completeModal(id); refresh('act-table', actionsTable()); return; }
    a.status = val; a.updates.push({ at: new Date().toISOString(), type: 'note', text: 'Status changed to ' + val + '.' });
    ECO.event('action.status.changed', ECO.service(a.serviceId), { enablingServiceId: a.enablingId, status: val, detail: a.title }); ECO.save(); refresh('act-table', actionsTable());
  });
  UI.on('submit', 'form[data-form="complete"]', function (e, form) {
    e.preventDefault(); var f = UI.formData(form), text = (f['ca-text'] || '').trim();
    if (!text) { completeModal(f.id, 'Enter the evidence for this action', { text: '', link: f['ca-link'] }); return; }
    ECO.completeAction(f.id, text, (f['ca-link'] || '').trim()); ECO.save(); UI.closeModal(); refresh('act-table', actionsTable()); flashAfter('Action ' + esc(f.id) + ' completed with evidence.');
  });

  UI.start();
})();
