/* Admin console prototype (Journey D): portfolio oversight, rule versioning with simulation, exceptions, connector health, roles and audit.
   Integrations here are simulated or manual; nothing is sent anywhere. Prototype-only state lives in ECO.get().ext.admin. */
(function () {
  'use strict';
  var h = UI.esc, ACTOR = 'Priya Nair';
  var testFor = null, exForm = null, flashNext = null;

  function A() {
    var S = ECO.get(); S.ext = S.ext || {};
    var a = S.ext.admin = S.ext.admin || {};
    a.drafts = a.drafts || {}; a.history = a.history || {}; a.pf = a.pf || { area: '', stage: '', type: '', enabling: '', gaps: false }; a.tab = a.tab || 'audit'; a.auditQ = a.auditQ || '';
    return a;
  }
  function today() { return new Date().toISOString().slice(0, 10); }
  function pubRules() { return ECO.get().rules.filter(function (r) { return r.status === 'published'; }); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function isGap(p, sid, cid) { var en = sid && ECO.enrolment(sid, cid); if (en && en.exceptionId) return false; return (p.outcome === 'required' || p.outcome === 'needs-review') && p.status !== 'active' && p.status !== 'pending'; }
  function svcLink(svc) { return '<a class="govuk-link" href="../enabling-services/#/services/' + h(svc.serviceId) + '">' + h(svc.name) + '</a>'; }
  function scroll(html) { return '<div style="overflow-x:auto">' + html + '</div>'; }
  function backLink(href, text) { return '<p class="govuk-body-s"><a class="govuk-link" href="' + href + '">' + h(text) + '</a></p>'; }

  /* ---------- Exceptions helpers ---------- */
  function activeEx() { return (ECO.get().exceptions || []).filter(function (x) { return x.status === 'approved'; }); }
  function applyExceptions() {
    activeEx().forEach(function (x) {
      var en = ECO.enrolment(x.serviceId, x.enablingId), svc = ECO.service(x.serviceId); if (!en) return;
      if (en.status !== 'not-applicable') ECO.setEnrolStatus(en, 'not-applicable', 'Exception ' + x.id + ' approved until ' + UI.fmtDate(x.expiry), svc);
      en.note = 'Exception ' + x.id + ' until ' + UI.fmtDate(x.expiry); en.exceptionId = x.id;
      var act = ECO.openAction(x.serviceId, x.enablingId); if (act && act.status !== 'Exception') { act.status = 'Exception'; act.updates.push({ at: new Date().toISOString(), type: 'system', text: 'Exception ' + x.id + ' approved by ' + x.approver + '.' }); }
    });
  }
  function release(x, why) {
    var en = ECO.enrolment(x.serviceId, x.enablingId), act = ECO.openAction(x.serviceId, x.enablingId);
    if (en) { delete en.note; delete en.exceptionId; }
    if (act && act.status === 'Exception') { act.status = 'Not started'; act.updates.push({ at: new Date().toISOString(), type: 'system', text: 'Exception ' + x.id + ' ' + why + '.' }); }
    ECO.sync(x.serviceId, 'Exception ' + x.id + ' ' + why + '.');
  }
  function expireDue() {
    var changed = false;
    activeEx().forEach(function (x) { if (x.expiry < today()) { x.status = 'expired'; release(x, 'expired'); ECO.audit('System', 'Exception expired', x.id + ' ' + x.serviceId + ' / ' + x.enablingId); changed = true; } });
    if (changed) ECO.save();
  }

  /* ---------- Portfolio ---------- */
  function portfolio() {
    expireDue();
    var a = A(), pf = a.pf, P = ECO.portfolio(), cats = ECO.CATALOGUE, S = ECO.get();
    var totE = 0, totEn = 0, totG = 0;
    cats.forEach(function (c) { var v = P.coverage[c.id]; totE += v.eligible; totEn += v.enrolled; totG += v.gaps; });
    var failing = S.integrations.filter(function (i) { return i.status !== 'healthy'; }).length;
    var stats = '<div class="stats">' + [
      UI.stat('Services', P.rows.length), UI.stat('Eligible enrolments', totE, 'Required or needs review'), UI.stat('Enrolled', totEn, totE ? Math.round(100 * totEn / totE) + '% of eligible' : ''),
      UI.stat('Gaps', totG, 'Eligible but not enrolled'), UI.stat('Active exceptions', activeEx().length), UI.stat('Connectors needing attention', failing)
    ].join('') + '</div>';

    var cov = UI.table(['Enabling service', 'Integration', 'Eligible', 'Enrolled', 'Gaps', 'Coverage'], cats.map(function (c) {
      var v = P.coverage[c.id], pct = v.eligible ? Math.round(100 * v.enrolled / v.eligible) : 100;
      return ['<a class="govuk-link" href="' + h(c.url) + '">' + h(c.name) + '</a>', UI.intKind(c.integration), v.eligible, v.enrolled, v.gaps ? '<strong>' + v.gaps + '</strong>' : '0', UI.bar(pct, pct + '% covered') + '<span class="govuk-hint" style="margin:0">' + pct + '%</span>'];
    }));

    var areas = [], types = ECO.TYPES;
    S.services.forEach(function (s) { if (areas.indexOf(s.area) < 0) areas.push(s.area); });
    function opt(lbl, list) { return [{ value: '', label: lbl }].concat(list.map(function (x) { return typeof x === 'object' ? x : { value: x, label: x }; })); }
    function sel(id, label, list, val) { return UI.select(id, label, list, val).replace('<select ', '<select data-pf="' + id.replace('pf-', '') + '" '); }
    var filters = '<form class="filters" style="display:flex;flex-wrap:wrap;gap:0 16px;align-items:flex-end" onsubmit="return false">' +
      sel('pf-area', 'Area', opt('All areas', areas), pf.area) + sel('pf-stage', 'Lifecycle stage', opt('All stages', ECO.STAGES), pf.stage) + sel('pf-type', 'Type', opt('All types', types), pf.type) +
      sel('pf-enabling', 'Enabling service', opt('All enabling services', cats.map(function (c) { return { value: c.id, label: c.name }; })), pf.enabling) +
      '<div class="govuk-form-group"><div class="govuk-checkboxes govuk-checkboxes--small"><div class="govuk-checkboxes__item"><input class="govuk-checkboxes__input" id="pf-gaps" type="checkbox" data-pf="gaps"' + (pf.gaps ? ' checked' : '') + '><label class="govuk-label govuk-checkboxes__label" for="pf-gaps">Only services with gaps</label></div></div></div></form>';

    var rows = P.rows.filter(function (r) {
      var s = r.svc; if (pf.area && s.area !== pf.area) return false; if (pf.stage && s.stage !== pf.stage) return false; if (pf.type && s.type !== pf.type) return false;
      if (pf.gaps) return cats.some(function (c) { return (!pf.enabling || pf.enabling === c.id) && isGap(r.per[c.id]); });
      return true;
    });
    var matrix = UI.table(['Service'].concat(cats.map(function (c) { return h(c.name); })), rows.map(function (r) {
      return ['<strong>' + svcLink(r.svc) + '</strong><br><span class="govuk-hint" style="margin:0">' + h(r.svc.area) + ' · ' + h(r.svc.stage) + ' · ' + h(r.svc.type) + '</span>'].concat(cats.map(function (c) {
        var p = r.per[c.id], en = ECO.enrolment(r.svc.serviceId, c.id);
        return UI.enrolTag(p.status) + (isGap(p, r.svc.serviceId, c.id) ? '<br><span class="govuk-hint" style="margin:0">Gap: ' + h(ECO.OUTCOMES[p.outcome].toLowerCase()) + '</span>' : (en && en.note ? '<br><span class="govuk-hint" style="margin:0">' + h(en.note) + '</span>' : ''));
      }));
    }));
    return UI.pageHead('Portfolio oversight', 'Adoption of enabling services across all services, and where the gaps are. Integrations are simulated or manual handoffs.') + stats +
      UI.panel('Coverage by enabling service', scroll(cov)) +
      UI.panel('Services by enabling service', filters + '<p class="govuk-body-s">Showing ' + rows.length + ' of ' + P.rows.length + ' services. Select a service to see why each rule evaluated as it did.</p>' + scroll(matrix));
  }

  /* ---------- Rules ---------- */
  function rulesList() {
    var a = A();
    var t = UI.table(['Rule', 'Name', 'Enabling service', 'Outcome', 'Version', 'Status', 'Effective'], ECO.get().rules.map(function (r) {
      var d = a.drafts[r.id];
      return [UI.ruleChip(r.id), '<a class="govuk-link" href="#/rules/' + h(r.id) + '">' + h(r.name) + '</a>', h(ECO.catalogue(r.enablingId).name), UI.outcomeTag(r.outcome), 'v' + r.version,
        UI.tag(r.status, r.status === 'published' ? 'green' : 'blue') + (d ? '<br>' + UI.tag('Draft v' + d.version + ' pending', 'blue') : ''), UI.fmtDate(r.effective)];
    }));
    return UI.pageHead('Rules', 'Versioned rules decide which enabling services apply. Edit a draft, test its impact on every service, then approve and publish.') + UI.panel('', scroll(t));
  }

  function condList(conds) { return conds.length ? '<ul class="govuk-list govuk-list--bullet">' + conds.map(function (c) { return '<li>' + h(ECO.condText(c)) + '</li>'; }).join('') + '</ul>' : '<p class="govuk-body">All work.</p>'; }

  function impact(rule, draft) {
    var rules = pubRules().map(function (r) { return r.id === rule.id ? draft : r; }), out = [], same = 0;
    ECO.get().services.forEach(function (svc) {
      var b = ECO.evaluate(svc)[rule.enablingId], af = ECO.evaluate(svc, { rules: rules })[rule.enablingId];
      if (b.outcome === af.outcome) { same++; return; }
      var en = ECO.enrolment(svc.serviceId, rule.enablingId), st = en ? en.status : 'not-applicable', eff;
      if (af.outcome === 'required' || af.outcome === 'needs-review') eff = (st === 'active' || st === 'pending') ? 'Stays enrolled' : 'New action, status becomes action required';
      else if (b.outcome === 'required' || b.outcome === 'needs-review') eff = (st === 'active' || st === 'pending') ? 'Flagged as attention needed' : 'Open action no longer required';
      else eff = 'Enrolment status unchanged';
      out.push({ svc: svc, before: b.outcome, after: af.outcome, eff: eff, st: st });
    });
    return { changed: out, same: same };
  }

  function ruleDetail(p) {
    var r = ECO.rule(p.id); if (!r) return UI.pageHead('Rule not found') + backLink('#/rules', 'Back to rules');
    var a = A(), d = a.drafts[r.id], hist = a.history[r.id] || [], body = '';
    body += backLink('#/rules', 'All rules') + UI.pageHead(r.id + ' ' + r.name, '', d ? '' : UI.button('Edit as draft', 'data-edit-draft="' + h(r.id) + '"'));
    if (flashNext) { body += UI.callout('ok', '', flashNext); flashNext = null; }
    body += UI.panel('Published rule', '<dl class="kv"><dt>Enabling service</dt><dd>' + h(ECO.catalogue(r.enablingId).name) + ' ' + UI.intKind(ECO.catalogue(r.enablingId).integration) + '</dd><dt>Outcome</dt><dd>' + UI.outcomeTag(r.outcome) + '</dd><dt>Source</dt><dd>' + h(r.source) +
      '</dd><dt>Version</dt><dd>v' + r.version + ', effective ' + UI.fmtDate(r.effective) + '</dd></dl><h3 class="govuk-heading-s" style="margin-top:12px">Applies when</h3>' + condList(r.conditions));
    if (d) {
      body += UI.panel('Draft v' + d.version + ' ' + UI.tag('Draft', 'blue'), '<dl class="kv"><dt>Outcome</dt><dd>' + UI.outcomeTag(d.outcome) + '</dd><dt>Effective</dt><dd>' + UI.fmtDate(d.effective) + '</dd></dl><h3 class="govuk-heading-s" style="margin-top:12px">Applies when</h3>' + condList(d.conditions) +
        '<div class="govuk-button-group">' + UI.button('Test draft', 'data-test-draft="' + h(r.id) + '"', 'govuk-button--secondary') + UI.button('Approve and publish', 'data-publish-draft="' + h(r.id) + '"') +
        '<a class="govuk-link" href="#/rules/' + h(r.id) + '/edit">Edit draft</a>' + UI.button('Discard draft', 'data-discard-draft="' + h(r.id) + '"', 'govuk-button--warning') + '</div>');
      if (testFor === r.id) {
        var im = impact(r, d);
        body += UI.panel('Test result (nothing has been changed)', UI.callout(im.changed.length ? 'warn' : 'ok', '', im.changed.length + ' of ' + (im.changed.length + im.same) + ' services would change outcome; ' + im.same + ' would not.') +
          UI.table(['Service', 'Before', 'After', 'Likely effect'], im.changed.map(function (c) { return [svcLink(c.svc), UI.outcomeTag(c.before), UI.outcomeTag(c.after), h(c.eff)]; })));
      }
    }
    body += UI.panel('Version history', UI.table(['Version', 'Outcome', 'Effective', 'Published', 'By', 'Change note'], [['v' + r.version + ' (current)', UI.outcomeTag(r.outcome), UI.fmtDate(r.effective), '\u2013', '\u2013', '\u2013']].concat(hist.map(function (x) {
      return ['v' + x.version, UI.outcomeTag(x.outcome), UI.fmtDate(x.effective), x.replacedAt ? 'Replaced ' + UI.fmtDate(x.replacedAt) : '\u2013', h(x.by || ''), h(x.note || '')]; }))));
    return body;
  }

  function editForm(p, vals, errs) {
    var r = ECO.rule(p.id); if (!r) return UI.pageHead('Rule not found');
    var d = A().drafts[r.id] || { outcome: r.outcome, effective: r.effective, conditions: r.conditions }, v = vals || { outcome: d.outcome, effective: d.effective, thr: {} };
    errs = errs || {};
    var summary = Object.keys(errs).map(function (k) { return { id: k, msg: errs[k] }; });
    var f = UI.errorSummary(summary) + '<form id="draft-form" data-rule-id="' + h(r.id) + '" novalidate>' +
      UI.select('outcome', 'Outcome', Object.keys(ECO.OUTCOMES).map(function (k) { return { value: k, label: ECO.OUTCOMES[k] }; }), v.outcome, { err: errs.outcome });
    d.conditions.forEach(function (c, i) {
      if (c.op === 'gte' || c.op === 'lte') {
        var cur = v.thr && v.thr[i] != null ? v.thr[i] : c.value;
        f += UI.input('thr-' + i, ({ estTransactions: 'Estimated transactions' }[c.field] || c.field) + ' threshold (' + (c.op === 'gte' ? 'at least' : 'at most') + ')', cur, { cls: 'govuk-input--width-10', hint: 'Whole number. The rule applies when ' + c.field + (c.op === 'gte' ? ' is at least ' : ' is at most ') + 'this value.', err: errs['thr-' + i] });
      }
    });
    f += UI.input('effective', 'Effective date', v.effective, { type: 'date', cls: 'govuk-input--width-10', hint: 'Cannot be earlier than today.', err: errs.effective }) +
      '<p class="govuk-body-s">Saving creates draft v' + (r.version + 1) + '. The published rule stays in force until you approve and publish.</p>' +
      '<div class="govuk-button-group"><button class="govuk-button" data-module="govuk-button" type="submit">Save draft</button><a class="govuk-link" href="#/rules/' + h(r.id) + '">Cancel</a></div></form>';
    return backLink('#/rules/' + h(r.id), 'Back to ' + r.id) + UI.pageHead('Edit ' + r.id + ' as draft', h(r.name)) + UI.panel('', f);
  }

  function saveDraft(form) {
    var r = ECO.rule(form.getAttribute('data-rule-id')), a = A(), v = UI.formData(form), errs = {}, base = a.drafts[r.id] || r, conds = clone(base.conditions), thr = {};
    if (!ECO.OUTCOMES[v.outcome]) errs.outcome = 'Select an outcome';
    conds.forEach(function (c, i) {
      if (c.op !== 'gte' && c.op !== 'lte') return;
      var raw = String(v['thr-' + i] || '').replace(/,/g, '').trim(); thr[i] = v['thr-' + i];
      if (!raw) errs['thr-' + i] = 'Enter a threshold'; else if (!/^\d+$/.test(raw) || Number(raw) < 1) errs['thr-' + i] = 'Threshold must be a whole number above zero'; else c.value = Number(raw);
    });
    if (!v.effective) errs.effective = 'Enter an effective date'; else if (isNaN(Date.parse(v.effective))) errs.effective = 'Effective date must be a real date'; else if (v.effective < today()) errs.effective = 'Effective date cannot be in the past';
    if (!Object.keys(errs).length && v.outcome === r.outcome && JSON.stringify(conds) === JSON.stringify(r.conditions) && v.effective === r.effective) errs.outcome = 'Change the outcome, a threshold or the effective date to create a draft';
    if (Object.keys(errs).length) { document.getElementById('app').innerHTML = editForm({ id: r.id }, { outcome: v.outcome, effective: v.effective, thr: thr }, errs); if (window.govukInit) window.govukInit(document.getElementById('app')); return; }
    a.drafts[r.id] = { id: r.id, enablingId: r.enablingId, name: r.name, source: r.source, version: r.version + 1, status: 'draft', effective: v.effective, outcome: v.outcome, conditions: conds };
    ECO.audit(ACTOR, 'Saved draft rule', r.id + ' v' + (r.version + 1)); ECO.save(); testFor = null; flashNext = 'Draft v' + (r.version + 1) + ' saved. Test it before you publish.'; UI.go('#/rules/' + r.id);
  }

  function publishModal(id, err, note) {
    var r = ECO.rule(id), d = A().drafts[id]; if (!r || !d) return;
    UI.modal('Approve and publish ' + id + ' v' + d.version, '<p class="govuk-body">This replaces the published v' + r.version + ' and re-evaluates every service. Enrolments and actions will change where the outcome changes.</p>' +
      (err ? UI.errorSummary([{ id: 'note', msg: err }]) : '') + '<form id="publish-form" data-rule-id="' + h(id) + '" novalidate>' +
      UI.textarea('note', 'Change note', note || '', { hint: 'Why is this change being made? It is recorded in the audit trail.', err: err }) +
      '<div class="govuk-button-group"><button class="govuk-button" data-module="govuk-button" type="submit">Approve and publish</button><button type="button" class="govuk-button govuk-button--secondary" data-close-modal>Cancel</button></div></form>');
  }

  function publish(form) {
    var id = form.getAttribute('data-rule-id'), note = (UI.formData(form).note || '').trim(), a = A(), S = ECO.get(), d = a.drafts[id], r = ECO.rule(id);
    if (!d || !r) return;
    if (note.length < 5) { publishModal(id, 'Enter a change note of at least 5 characters', note); return; }
    var idx = S.rules.indexOf(r), nActs = S.actions.length, enrChanged = 0, svcChanged = 0, enrBefore = {};
    S.enrolments.forEach(function (e) { enrBefore[e.id] = e.status; });
    (a.history[id] = a.history[id] || []).unshift({ version: r.version, outcome: r.outcome, effective: r.effective, conditions: r.conditions, replacedAt: new Date().toISOString(), by: ACTOR, note: note });
    var pubd = clone(d); pubd.status = 'published'; S.rules[idx] = pubd; delete a.drafts[id];
    ECO.audit(ACTOR, 'Published rule', id + ' v' + pubd.version + ' (was v' + r.version + '). ' + note);
    S.services.forEach(function (s) { var ch = ECO.sync(s.serviceId, 'Rule ' + id + ' v' + pubd.version + ' published.'); if (ch.length) svcChanged++; });
    applyExceptions();
    S.enrolments.forEach(function (e) { if (enrBefore[e.id] !== e.status) enrChanged++; });
    ECO.event('rule.published', null, { ruleId: id, ruleVersion: pubd.version, enablingServiceId: pubd.enablingId, detail: note, recordUrl: '../admin/#/rules/' + id });
    ECO.save(); UI.closeModal(); testFor = null;
    flashNext = 'Published ' + id + ' v' + pubd.version + '. Re-ran all ' + S.services.length + ' services: ' + enrChanged + ' enrolment' + (enrChanged === 1 ? '' : 's') + ' changed across ' + svcChanged + ' service' + (svcChanged === 1 ? '' : 's') + ', ' + (S.actions.length - nActs) + ' new action' + (S.actions.length - nActs === 1 ? '' : 's') + ' raised.';
    UI.go('#/rules/' + id);
  }

  /* ---------- Exceptions ---------- */
  function exceptionsPage() {
    expireDue();
    var S = ECO.get(), f = exForm || { vals: {}, errs: {} }, v = f.vals, errs = f.errs, approvers = S.people.filter(function (x) { return /administrator/.test(x.role); });
    var list = UI.table(['Reference', 'Service', 'Enabling service', 'Reason', 'Expiry', 'Approver', 'Status', ''], (S.exceptions || []).map(function (x) {
      var svc = ECO.service(x.serviceId);
      return [h(x.id), svc ? svcLink(svc) : h(x.serviceId), h(ECO.catalogue(x.enablingId).name), h(x.reason), UI.fmtDate(x.expiry), h(x.approver), UI.tag(x.status === 'approved' ? 'Approved' : x.status === 'revoked' ? 'Revoked' : 'Expired', x.status === 'approved' ? 'orange' : 'grey'),
        x.status === 'approved' ? '<button type="button" class="govuk-button govuk-button--secondary govuk-!-margin-bottom-0" data-module="govuk-button" data-revoke="' + h(x.id) + '">Revoke</button>' : ''];
    }));
    var summary = Object.keys(errs).map(function (k) { return { id: k, msg: errs[k] }; });
    var form = UI.errorSummary(summary) + '<form id="exception-form" novalidate>' +
      UI.select('serviceId', 'Service', [{ value: '', label: 'Select a service' }].concat(S.services.map(function (s) { return { value: s.serviceId, label: s.name }; })), v.serviceId || '', { err: errs.serviceId }) +
      UI.select('enablingId', 'Enabling service', [{ value: '', label: 'Select an enabling service' }].concat(ECO.CATALOGUE.map(function (c) { return { value: c.id, label: c.name }; })), v.enablingId || '', { err: errs.enablingId }) +
      UI.textarea('reason', 'Reason', v.reason || '', { hint: 'Why is the service excused from this requirement?', err: errs.reason }) +
      UI.input('expiry', 'Expiry date', v.expiry || '', { type: 'date', cls: 'govuk-input--width-10', hint: 'No more than 12 months from today.', err: errs.expiry }) +
      UI.select('approver', 'Approver', [{ value: '', label: 'Select an approver' }].concat(approvers.map(function (x) { return { value: x.name, label: x.name + ' (' + x.role + ')' }; })), v.approver || '', { err: errs.approver }) +
      '<button class="govuk-button" data-module="govuk-button" type="submit">Add exception</button></form>';
    return UI.pageHead('Exceptions', 'An approved exception marks the enrolment as not applicable until it expires or is revoked.') + UI.panel('Exceptions', scroll(list)) + UI.panel('Add an exception', form);
  }

  function addException(form) {
    var v = UI.formData(form), errs = {}, S = ECO.get(), svc = ECO.service(v.serviceId), cat = ECO.catalogue(v.enablingId);
    if (!svc) errs.serviceId = 'Select a service'; if (!cat) errs.enablingId = 'Select an enabling service';
    if (!(v.reason || '').trim() || v.reason.trim().length < 10) errs.reason = 'Enter a reason of at least 10 characters';
    var max = new Date(); max.setFullYear(max.getFullYear() + 1);
    if (!v.expiry) errs.expiry = 'Enter an expiry date'; else if (isNaN(Date.parse(v.expiry))) errs.expiry = 'Expiry date must be a real date'; else if (v.expiry <= today()) errs.expiry = 'Expiry date must be in the future'; else if (v.expiry > max.toISOString().slice(0, 10)) errs.expiry = 'Expiry date must be within 12 months';
    if (!v.approver) errs.approver = 'Select an approver';
    if (svc && cat && !errs.serviceId && !errs.enablingId) {
      var out = ECO.evaluate(svc)[cat.id].outcome;
      if (out !== 'required' && out !== 'needs-review') errs.enablingId = 'This service has no requirement for ' + cat.name + ', so an exception is not needed';
      else if (activeEx().some(function (x) { return x.serviceId === svc.serviceId && x.enablingId === cat.id; })) errs.enablingId = 'An approved exception already exists for this service and enabling service';
    }
    if (Object.keys(errs).length) { exForm = { vals: v, errs: errs }; UI.go('#/exceptions'); return; }
    S.seq.EXC = (S.seq.EXC || 0) + 1;
    var x = { id: 'EXC-' + String(S.seq.EXC).padStart(3, '0'), serviceId: svc.serviceId, enablingId: cat.id, reason: v.reason.trim(), expiry: v.expiry, approver: v.approver, status: 'approved', created: new Date().toISOString() };
    S.exceptions.unshift(x); applyExceptions();
    ECO.audit(ACTOR, 'Approved exception', x.id + ' ' + svc.serviceId + ' / ' + cat.id + ' until ' + x.expiry + ', approver ' + x.approver);
    ECO.event('exception.approved', svc, { enablingServiceId: cat.id, status: 'not-applicable', detail: x.reason + ' (expires ' + x.expiry + ')' });
    ECO.save(); exForm = null; flashNext = 'Exception ' + x.id + ' approved. ' + svc.name + ' is not applicable for ' + cat.name + ' until ' + UI.fmtDate(x.expiry) + '.'; UI.go('#/exceptions');
  }

  /* ---------- Connectors ---------- */
  function connectors() {
    var S = ECO.get();
    var t = UI.table(['Connector', 'Kind', 'Status', 'Last sync', 'Queue', 'Note', 'Log', ''], S.integrations.map(function (i) {
      var log = (i.log || []).slice(0, 3).map(function (l) { return '<li>' + UI.fmtTime(l.at) + ': ' + h(l.text) + '</li>'; }).join('');
      return [h(i.name), UI.intKind(i.kind), UI.tag(i.status), UI.fmtTime(i.lastSync), i.queue, h(i.note), '<ul class="govuk-list govuk-body-s" style="margin:0">' + log + '</ul>',
        i.status !== 'healthy' ? '<button type="button" class="govuk-button govuk-button--secondary govuk-!-margin-bottom-0" data-module="govuk-button" data-retry="' + h(i.id) + '">Retry</button>' : ''];
    }));
    return UI.pageHead('Connectors', 'Health of simulated integrations and manual handoffs. Retrying a simulated connector clears its queue in this prototype; nothing live is contacted.') + UI.panel('', scroll(t));
  }

  /* ---------- Roles ---------- */
  function roles() {
    var S = ECO.get();
    var caps = ['View portfolio and coverage', 'Edit service classification', 'Complete actions and add evidence', 'Edit draft rules', 'Approve and publish rules', 'Approve exceptions', 'Retry connectors', 'Manage roles', 'View audit trail'];
    var R = ['Platform administrator', 'Enabling service administrator', 'Service owner', 'Team member', 'Assessor', 'Reader'];
    var m = {
      'Platform administrator': [1, 1, 1, 1, 1, 1, 1, 1, 1], 'Enabling service administrator': [1, 0, 1, 1, 0, 1, 1, 0, 1], 'Service owner': [1, 1, 1, 0, 0, 0, 0, 0, 0],
      'Team member': [1, 0, 1, 0, 0, 0, 0, 0, 0], Assessor: [1, 0, 1, 0, 0, 0, 0, 0, 1], Reader: [1, 0, 0, 0, 0, 0, 0, 0, 0]
    };
    var people = UI.table(['Name', 'Role', 'Team'], S.people.map(function (p) { return [h(p.name), h(p.role), h(p.team)]; }));
    var mx = UI.table(['Capability'].concat(R.map(h)), caps.map(function (c, i) { return [h(c)].concat(R.map(function (r) { return m[r][i] ? 'Yes' : '<span class="govuk-hint" style="margin:0">No</span>'; })); }));
    return UI.pageHead('Roles', 'People and what each role can do. In this prototype you are signed in as ' + h(ACTOR) + ', a platform administrator. The capability matrix is explanatory and not enforced.') +
      UI.panel('People and roles', people) + UI.panel('Role capabilities', scroll(mx));
  }

  /* ---------- Audit ---------- */
  function auditPage() {
    var a = A(), S = ECO.get(), q = (a.auditQ || '').toLowerCase(), isAudit = a.tab === 'audit', body;
    function m(s) { return !q || s.toLowerCase().indexOf(q) > -1; }
    if (isAudit) {
      var rows = S.audit.filter(function (x) { return m([x.actor, x.action, x.target].join(' ')); }).slice(0, 100);
      body = UI.table(['When', 'Actor', 'Action', 'Target'], rows.map(function (x) { return [UI.fmtTime(x.at), h(x.actor), h(x.action), h(x.target)]; }));
    } else {
      var ev = S.events.filter(function (x) { return m([x.eventType, x.serviceId, x.enablingServiceId, x.ruleId, x.detail, x.sourceSystem].join(' ')); }).slice(0, 100);
      body = UI.table(['When', 'Event', 'Service', 'Enabling service', 'Rule', 'Detail'], ev.map(function (x) {
        return [UI.fmtTime(x.occurredAt), h(x.eventType), x.serviceId ? '<a class="govuk-link" href="' + h(x.recordUrl || '#') + '">' + h(x.serviceId) + '</a>' : '\u2013', h(x.enablingServiceId || '\u2013'), x.ruleId ? UI.ruleChip(x.ruleId, x.ruleVersion) : '\u2013', h(x.detail)]; }));
    }
    return UI.pageHead('Audit', 'Who changed what, and the events sent to central reporting. Showing up to 100 most recent matches.') +
      UI.seg([{ id: 'audit', label: 'Audit trail' }, { id: 'events', label: 'Event log' }], a.tab, 'tab') +
      '<form id="audit-filter" class="govuk-!-margin-top-3" style="display:flex;gap:12px;align-items:flex-end" novalidate>' + UI.input('auditQ', 'Filter', a.auditQ, { cls: 'govuk-input--width-20' }) + '<div class="govuk-form-group"><button class="govuk-button govuk-button--secondary" data-module="govuk-button" type="submit">Apply filter</button></div></form>' +
      UI.panel('', scroll(body));
  }

  /* ---------- Routes and events ---------- */
  UI.route('/', portfolio, 'portfolio');
  UI.route('/rules', rulesList, 'rules');
  UI.route('/rules/:id', ruleDetail, 'rules');
  UI.route('/rules/:id/edit', function (p) { return editForm(p); }, 'rules');
  UI.route('/exceptions', function () { var out = exceptionsPage(); if (flashNext) { out = UI.callout('ok', '', h(flashNext)) + out; flashNext = null; } return out; }, 'exceptions');
  UI.route('/connectors', connectors, 'connectors');
  UI.route('/roles', roles, 'roles');
  UI.route('/audit', auditPage, 'audit');

  UI.on('change', '[data-pf]', function (e, el) { var k = el.getAttribute('data-pf'); A().pf[k] = el.type === 'checkbox' ? el.checked : el.value; ECO.save(); UI.render(); });
  UI.on('click', '[data-tab]', function (e, el) { A().tab = el.getAttribute('data-tab'); ECO.save(); UI.render(); });
  UI.on('submit', '#audit-filter', function (e, el) { e.preventDefault(); A().auditQ = UI.formData(el).auditQ.trim(); ECO.save(); UI.render(); });
  UI.on('click', '[data-edit-draft]', function (e, el) { UI.go('#/rules/' + el.getAttribute('data-edit-draft') + '/edit'); });
  UI.on('submit', '#draft-form', function (e, el) { e.preventDefault(); saveDraft(el); });
  UI.on('click', '[data-test-draft]', function (e, el) { testFor = el.getAttribute('data-test-draft'); UI.render(); });
  UI.on('click', '[data-discard-draft]', function (e, el) {
    var id = el.getAttribute('data-discard-draft'); delete A().drafts[id]; ECO.audit(ACTOR, 'Discarded draft rule', id); ECO.save(); testFor = null; flashNext = 'Draft for ' + id + ' discarded. The published rule is unchanged.'; UI.go('#/rules/' + id);
  });
  UI.on('click', '[data-publish-draft]', function (e, el) { publishModal(el.getAttribute('data-publish-draft')); });
  UI.on('submit', '#publish-form', function (e, el) { e.preventDefault(); publish(el); });
  UI.on('submit', '#exception-form', function (e, el) { e.preventDefault(); addException(el); });
  UI.on('click', '[data-revoke]', function (e, el) {
    var x = ECO.get().exceptions.filter(function (q) { return q.id === el.getAttribute('data-revoke'); })[0]; if (!x) return;
    x.status = 'revoked'; release(x, 'revoked'); ECO.audit(ACTOR, 'Revoked exception', x.id + ' ' + x.serviceId + ' / ' + x.enablingId); ECO.event('exception.revoked', ECO.service(x.serviceId), { enablingServiceId: x.enablingId, detail: x.id });
    ECO.save(); flashNext = 'Exception ' + x.id + ' revoked. The requirement applies again.'; UI.go('#/exceptions');
  });
  UI.on('click', '[data-retry]', function (e, el) {
    var i = ECO.get().integrations.filter(function (q) { return q.id === el.getAttribute('data-retry'); })[0]; if (!i) return;
    var was = i.status, now = new Date().toISOString(); i.status = 'healthy'; i.lastSync = now; i.queue = 0; i.note = 'Recovered after retry (simulated)';
    i.log = i.log || []; i.log.unshift({ at: now, level: 'info', text: 'Retry succeeded (simulated). Previous status: ' + was + '. Queue cleared.' });
    ECO.audit(ACTOR, 'Retried connector', i.name); ECO.event('connector.retried', null, { sourceSystem: i.name, status: 'healthy', detail: 'Retry succeeded (simulated); was ' + was, recordUrl: '../admin/#/connectors' });
    ECO.save(); UI.flash(h(i.name) + ' is healthy again (simulated retry).'); UI.render();
  });

  UI.start();
})();
