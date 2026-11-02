/* Assurance prototype: AISS accessibility, DDT standards, SAS assessments, RAID and material change.
   AISS, SHCA PowerApp and SAS are manual handoffs: this prototype records references and evidence only. */
(function (UI0) {
  'use strict';
  // Navigation renders on hashchange, which would wipe a flash shown straight away, so flashes are deferred until after the render.
  var pending = null;
  function flushFlash() { if (pending) { var p = pending; pending = null; UI0.flash(p[0], p[1]); } }
  var UI = Object.assign({}, UI0, { flash: function (m, k) { pending = [m, k]; setTimeout(flushFlash, 40); } });
  window.addEventListener('hashchange', function () { setTimeout(flushFlash, 0); });
  var esc = UI.esc, tag = UI.tag, link = UI.link, fmt = UI.fmtDate;
  var ACTOR = 'Assurance lead';
  var lastChange = null;

  function S() { return ECO.get(); }
  function svcs() { return S().services; }
  function svc(id) { return ECO.service(id); }
  function isPast(iso) { return !!iso && new Date(iso).getTime() < Date.now(); }
  function toIso(d) { return d ? new Date(d + 'T12:00:00Z').toISOString() : null; }
  function dateVal(iso) { return iso ? String(iso).slice(0, 10) : ''; }
  function svcLink(s, href) { return link(href || '#/', s.name); }
  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }

  function ext() {
    var e = S().ext; if (!e.assurance) { e.assurance = { evidence: [] }; }
    var a = e.assurance;
    if (!a.evidence) a.evidence = [];
    if (!a.seeded) {
      a.seeded = true;
      Object.keys(S().aiss).forEach(function (sid) { var x = S().aiss[sid]; if (x.enrolled && x.ref) addEvidence(sid, 'aiss', 'AISS enrolment', 'AISS reference ' + x.ref, '', null); });
      S().assessments.forEach(function (m) { if (m.bookingRef) addEvidence(m.serviceId, 'assessment', m.id, 'SAS booking reference ' + m.bookingRef, '', null); });
      ECO.save();
    }
    return a;
  }
  function addEvidence(serviceId, kind, refId, text, url, reusedFrom) {
    var a = S().ext.assurance, n = a.evidence.length + 1, ev = { id: 'EVD-' + String(n).padStart(3, '0'), serviceId: serviceId, kind: kind, refId: refId, text: text, link: url || '', at: new Date().toISOString(), reusedFrom: reusedFrom || null };
    a.evidence.push(ev); return ev;
  }
  function evById(id) { return ext().evidence.filter(function (e) { return e.id === id; })[0]; }

  /* ---------- Derived position ---------- */
  function aiss(sid) { var s = svc(sid), a = S().aiss[sid]; return a || { enrolled: false, ref: '', statement: 'Missing', reviewDue: null, issues: [], _none: true, online: s.channels.indexOf('Online') > -1 }; }
  function aissEntry(sid) { if (!S().aiss[sid]) S().aiss[sid] = { enrolled: false, ref: '', statement: 'Missing', reviewDue: null, issues: [] }; return S().aiss[sid]; }
  function issueOverdue(i) { return i.status !== 'Resolved' && isPast(i.fixBy); }
  function openIssues(a) { return a.issues.filter(function (i) { return i.status !== 'Resolved'; }); }
  function aissStatus(s) {
    var a = aiss(s.serviceId), req = ECO.evaluate(s).aiss.outcome;
    if (s.channels.indexOf('Online') < 0 && !a.enrolled) return { text: 'Not applicable', colour: 'grey' };
    if (a.enrolled) return { text: 'Enrolled', colour: 'green' };
    return req === 'required' ? { text: 'Required, not enrolled', colour: 'orange' } : { text: 'Not enrolled', colour: 'yellow' };
  }
  function stdRows(s) {
    var c = S().compliance[s.serviceId] || {};
    return ECO.applicableStandards(s).map(function (a) { a.status = c[a.id] || 'Not assessed'; return a; });
  }
  function stdCounts(s) {
    var r = { Compliant: 0, Partial: 0, Overdue: 0, 'Not assessed': 0, total: 0 };
    stdRows(s).forEach(function (x) { r[x.status]++; r.total++; }); return r;
  }
  function assessmentsFor(sid) { return S().assessments.filter(function (m) { return m.serviceId === sid; }); }
  function latestAssessment(sid) { var l = assessmentsFor(sid); return l[l.length - 1]; }
  function openFindings(m) { return m.findings.filter(function (f) { return f.status !== 'Closed'; }); }
  function risksFor(sid) { return S().risks.filter(function (r) { return r.serviceId === sid && r.status !== 'Closed'; }); }
  function assessmentText(s) {
    var m = latestAssessment(s.serviceId);
    if (m) return m.status + (m.result ? ': ' + m.result : '') + (m.status !== 'Completed' && m.due ? ' (' + fmt(m.due) + ')' : '');
    var en = ECO.enrolment(s.serviceId, 'sas');
    return en && en.status === 'action-required' ? 'Required, not booked' : 'None needed now';
  }
  function flags(s) {
    var f = [], a = aiss(s.serviceId), st = aissStatus(s), cnt = stdCounts(s), m = latestAssessment(s.serviceId), en = ECO.enrolment(s.serviceId, 'sas');
    if (st.text === 'Required, not enrolled') f.push('AISS enrolment needed');
    if (a.enrolled && a.statement !== 'Published') f.push('Accessibility statement ' + a.statement.toLowerCase());
    if (a.enrolled && isPast(a.reviewDue)) f.push('AISS review overdue');
    var od = a.issues.filter(issueOverdue).length; if (od) f.push(plural(od, 'accessibility fix') + ' overdue');
    if (cnt.Overdue) f.push(plural(cnt.Overdue, 'standard') + ' overdue');
    if (m && m.status === 'Required' && isPast(m.due)) f.push('Assessment overdue');
    else if (!m && en && en.status === 'action-required') f.push('Assessment needs booking');
    if (m && m.result === 'Not met') f.push('Assessment not met');
    return f;
  }
  function flagTags(f) { return f.length ? f.map(function (x) { return tag(x, 'orange'); }).join(' ') : '<span class="govuk-hint" style="margin:0">None</span>'; }
  function nav(id) { return id; }

  function manualBox(enablingId) {
    var c = ECO.catalogue(enablingId);
    return '<div class="callout callout--warn">' + UI.intKind('manual') + ' <strong>' + esc(c.system) + '</strong> is not connected to this prototype. ' + esc(c.manual) + '</div>';
  }
  function backTo(href, text) { return '<p class="govuk-body-s">' + link(href, '\u2190 ' + text) + '</p>'; }
  function serviceHeader(s) {
    return '<dl class="kv" style="margin-bottom:14px"><dt>Service</dt><dd>' + esc(s.name) + ' (' + esc(s.serviceId) + ', ' + esc(s.productId) + ')</dd><dt>Owner</dt><dd>' + esc(s.owner) + '</dd><dt>Stage and status</dt><dd>' + esc(s.stage) + ', ' + esc(s.status) + '</dd><dt>URL</dt><dd>' + esc((s.urls || []).join(', ') || 'None recorded') + '</dd></dl>';
  }
  function errs(list) { return UI.errorSummary(list); }
  function today() { return new Date().toISOString().slice(0, 10); }

  /* ---------- Overview ---------- */
  UI.route('/', function () {
    ext();
    var rows = svcs().map(function (s) {
      var st = aissStatus(s), a = aiss(s.serviceId), c = stdCounts(s), m = latestAssessment(s.serviceId), fcount = 0;
      assessmentsFor(s.serviceId).forEach(function (x) { fcount += openFindings(x).length; });
      var rk = risksFor(s.serviceId).length, f = flags(s);
      return [link('#/accessibility/' + s.serviceId, s.name) + '<br><span class="govuk-hint" style="margin:0">' + esc(s.stage) + ', ' + esc(s.status) + '</span>',
        tag(st.text, st.colour) + (a.enrolled ? '<br><span class="govuk-hint" style="margin:0">Statement: ' + esc(a.statement) + '; ' + plural(openIssues(a).length, 'open issue') + '</span>' : ''),
        link('#/standards/' + s.serviceId, c.Compliant + ' / ' + c.Partial + ' / ' + c.Overdue) + '<br><span class="govuk-hint" style="margin:0">of ' + c.total + (c['Not assessed'] ? ', ' + c['Not assessed'] + ' not assessed' : '') + '</span>',
        m ? link('#/assessments/' + m.id, assessmentText(s)) : esc(assessmentText(s)),
        plural(fcount, 'finding') + ', ' + plural(rk, 'risk or issue'),
        flagTags(f)];
    });
    var attention = svcs().filter(function (s) { return flags(s).length; }).length;
    return UI.pageHead('Assurance overview', 'Accessibility, standards and service assessment position for each service. ' + UI.intKind('manual') + ' AISS, SHCA PowerApp and SAS are manual handoffs; this prototype records references and evidence only.') +
      UI.callout(attention ? 'warn' : 'ok', plural(attention, 'service') + ' need attention.', 'Flags are calculated from the shared service record and the assurance data below.') +
      UI.table(['Service', 'Accessibility (AISS)', 'Standards: compliant / partial / overdue', 'Assessment', 'Open findings and RAID', 'Attention'], rows);
  }, 'overview');

  /* ---------- Accessibility ---------- */
  UI.route('/accessibility', function () {
    ext();
    var rows = svcs().map(function (s) {
      var a = aiss(s.serviceId), st = aissStatus(s), od = a.issues.filter(issueOverdue).length;
      return [link('#/accessibility/' + s.serviceId, s.name), tag(st.text, st.colour), a.enrolled ? esc(a.ref) : '\u2013',
        tag(a.statement, a.statement === 'Published' ? 'green' : a.statement === 'Draft' ? 'yellow' : 'red'),
        a.reviewDue ? fmt(a.reviewDue) + (isPast(a.reviewDue) ? ' ' + tag('Overdue', 'red') : '') : '\u2013',
        openIssues(a).length + (od ? ' (' + od + ' overdue)' : '')];
    });
    return UI.pageHead('Accessibility', UI.intKind('manual') + ' Enrolment and statements are managed in AISS. Record the outcome here so it is visible next to the other assurance.') +
      UI.table(['Service', 'AISS enrolment', 'AISS reference', 'Statement', 'Review due', 'Open issues'], rows);
  }, 'accessibility');

  UI.route('/accessibility/:id', function (p) {
    ext(); var s = svc(p.id); if (!s) return UI.pageHead('Service not found');
    var a = aiss(p.id), st = aissStatus(s), r = ECO.evaluate(s).aiss, act = ECO.openAction(p.id, 'aiss');
    var issues = UI.table(['Issue', 'Severity', 'Owner', 'Fix by', 'Status', 'Update'], a.issues.map(function (i) {
      return [esc(i.title), tag(i.severity), esc(i.owner), fmt(i.fixBy) + (issueOverdue(i) ? ' ' + tag('Overdue', 'red') : ''), tag(i.status, i.status === 'Resolved' ? 'green' : i.status === 'In progress' ? 'blue' : 'red'),
        '<form data-form="issue-status" data-svc="' + esc(p.id) + '" data-issue="' + esc(i.id) + '" class="page-actions"><label class="govuk-visually-hidden" for="is-' + esc(i.id) + '">Status for ' + esc(i.title) + '</label><select class="govuk-select" id="is-' + esc(i.id) + '" name="status">' +
        ['Open', 'In progress', 'Resolved'].map(function (x) { return '<option' + (x === i.status ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select><button class="govuk-button govuk-button--secondary" data-module="govuk-button">Save</button></form>'];
    }));
    var enrol = a.enrolled ?
      '<dl class="kv"><dt>Status</dt><dd>' + tag('Enrolled', 'green') + '</dd><dt>AISS reference</dt><dd>' + esc(a.ref) + '</dd></dl>' :
      '<p class="govuk-body">' + tag(st.text, st.colour) + ' ' + (r.outcome === 'required' ? 'Required by ' + UI.ruleChip(r.ruleId, r.ruleVersion) + '. ' + esc(r.reason) : 'Not currently required by the rules.') + '</p>' +
      UI.button('Enrol in AISS', 'data-enrol="' + esc(p.id) + '"') + (act ? ' <span class="govuk-hint">Completing enrolment also completes action ' + esc(act.id) + '.</span>' : '');
    var stmt = a.enrolled ? '<form data-form="statement" data-svc="' + esc(p.id) + '">' + UI.select('st-status', 'Accessibility statement status', ['Missing', 'Draft', 'Published'], a.statement) + UI.input('st-review', 'Next review due', dateVal(a.reviewDue), { type: 'date' }) + '<button class="govuk-button govuk-button--secondary" data-module="govuk-button">Save statement</button></form>' :
      '<p class="govuk-body">Statement status is available once the service is enrolled in AISS.</p>';
    var addIssue = a.enrolled ? '<details class="govuk-details"><summary class="govuk-details__summary"><span class="govuk-details__summary-text">Record an issue found by AISS</span></summary><div class="govuk-details__text"><form data-form="issue-add" data-svc="' + esc(p.id) + '">' +
      UI.input('ia-title', 'Issue') + UI.select('ia-sev', 'Severity', ['High', 'Medium', 'Low'], 'Medium') + UI.input('ia-owner', 'Owner', s.owner) + UI.input('ia-fix', 'Fix by', dateVal(ECO.ahead(30)), { type: 'date' }) +
      '<button class="govuk-button" data-module="govuk-button">Add issue</button></form></div></details>' : '';
    var ev = ext().evidence.filter(function (e) { return e.serviceId === p.id && e.kind === 'aiss'; });
    return backTo('#/accessibility', 'All accessibility') + UI.pageHead(s.name + ': accessibility') + serviceHeader(s) +
      UI.panel('AISS enrolment ' + UI.intKind('manual'), enrol) + UI.panel('Statement', stmt) + UI.panel('Issues', issues + addIssue) +
      UI.panel('Evidence', ev.length ? UI.table(['Reference', 'Evidence', 'Recorded'], ev.map(function (e) { return [esc(e.id), esc(e.text) + (e.link ? ' ' + link(e.link, 'Link') : ''), fmt(e.at)]; })) : '<p class="govuk-body">No evidence recorded.</p>');
  }, 'accessibility');

  UI.on('click', '[data-enrol]', function (e, el) {
    var s = svc(el.getAttribute('data-enrol'));
    UI.modal('Enrol ' + s.name + ' in AISS', manualBox('aiss') + '<ol class="govuk-list govuk-list--number"><li>Open AISS and start a new enrolment.</li><li>Use these details from the service record.</li><li>Return here and record the AISS reference as evidence.</li></ol>' +
      '<dl class="kv" style="margin-bottom:14px"><dt>Service name</dt><dd>' + esc(s.name) + '</dd><dt>URL</dt><dd>' + esc((s.urls || [])[0] || 'None recorded') + '</dd><dt>Owner</dt><dd>' + esc(s.owner) + '</dd></dl>' +
      '<form data-form="enrol" data-svc="' + esc(s.serviceId) + '">' + UI.input('enrol-ref', 'AISS reference', '', { hint: 'For example AISS-2400' }) + UI.input('enrol-link', 'Link to AISS record (optional)', '') + '<button class="govuk-button" data-module="govuk-button">Record enrolment</button></form>');
  });
  UI.on('submit', '[data-form="enrol"]', function (e, f) {
    e.preventDefault(); var sid = f.getAttribute('data-svc'), d = UI.formData(f), s = svc(sid);
    if (!d['enrol-ref'].trim()) { if (!f.querySelector('.govuk-error-summary')) f.insertAdjacentHTML('afterbegin', errs([{ id: 'enrol-ref', msg: 'Enter the AISS reference' }])); return; }
    var a = aissEntry(sid); a.enrolled = true; a.ref = d['enrol-ref'].trim(); if (a.statement === 'Missing') a.statement = 'Draft'; if (!a.reviewDue) a.reviewDue = ECO.ahead(180);
    var ev = addEvidence(sid, 'aiss', 'AISS enrolment', 'AISS reference ' + a.ref, d['enrol-link'].trim(), null), act = ECO.openAction(sid, 'aiss');
    if (act) ECO.completeAction(act.id, 'AISS reference ' + a.ref, d['enrol-link'].trim(), s.owner);
    ECO.event('aiss.enrolled', s, { sourceSystem: 'AISS (manual)', enablingServiceId: 'aiss', status: 'enrolled', detail: 'Manual enrolment recorded: ' + a.ref, recordUrl: '../assurance/#/accessibility/' + sid });
    ECO.audit(ACTOR, 'Recorded AISS enrolment', sid + ' ' + a.ref); ECO.save(); UI.closeModal();
    UI.go('#/accessibility/' + sid); UI.flash('Enrolment recorded as evidence ' + esc(ev.id) + '.' + (act ? ' Action ' + esc(act.id) + ' marked complete.' : ''), 'ok');
  });
  UI.on('submit', '[data-form="statement"]', function (e, f) {
    e.preventDefault(); var sid = f.getAttribute('data-svc'), d = UI.formData(f), a = aissEntry(sid);
    a.statement = d['st-status']; a.reviewDue = toIso(d['st-review']);
    ECO.event('aiss.statement.updated', svc(sid), { sourceSystem: 'AISS (manual)', enablingServiceId: 'aiss', status: a.statement, detail: 'Statement ' + a.statement.toLowerCase(), recordUrl: '../assurance/#/accessibility/' + sid });
    ECO.save(); UI.go('#/accessibility/' + sid); UI.flash('Statement status saved.', 'ok');
  });
  UI.on('submit', '[data-form="issue-status"]', function (e, f) {
    e.preventDefault(); var sid = f.getAttribute('data-svc'), a = aissEntry(sid), i = a.issues.filter(function (x) { return x.id === f.getAttribute('data-issue'); })[0];
    i.status = UI.formData(f).status; ECO.event('aiss.issue.updated', svc(sid), { sourceSystem: 'AISS (manual)', enablingServiceId: 'aiss', status: i.status, detail: i.title, recordUrl: '../assurance/#/accessibility/' + sid });
    ECO.save(); UI.go('#/accessibility/' + sid); UI.flash('Issue marked ' + esc(i.status.toLowerCase()) + '.', 'ok');
  });
  UI.on('submit', '[data-form="issue-add"]', function (e, f) {
    e.preventDefault(); var sid = f.getAttribute('data-svc'), d = UI.formData(f), a = aissEntry(sid);
    if (!d['ia-title'].trim()) { UI.go('#/accessibility/' + sid); UI.flash('Enter an issue title.', 'warn'); return; }
    var n = (S().seq.AISSI || 0) + 1; S().seq.AISSI = n;
    a.issues.push({ id: 'AI-' + (100 + n), title: d['ia-title'].trim(), severity: d['ia-sev'], owner: d['ia-owner'] || svc(sid).owner, fixBy: toIso(d['ia-fix']), status: 'Open' });
    ECO.save(); UI.go('#/accessibility/' + sid); UI.flash('Issue added.', 'ok');
  });

  /* ---------- Standards ---------- */
  function setStandard(sid, stdId, status) {
    var s = svc(sid), std = ECO.STANDARDS.filter(function (x) { return x.id === stdId; })[0];
    if (!S().compliance[sid]) S().compliance[sid] = {};
    S().compliance[sid][stdId] = status;
    var ref = 'standards:' + sid + ':' + stdId, risks = S().risks, ex = risks.filter(function (r) { return r.ref === ref; })[0], out = '';
    if (status === 'Overdue') {
      if (!ex || ex.status === 'Closed') {
        if (ex) { ex.status = 'Open'; }
        else {
          var max = risks.reduce(function (n, r) { return Math.max(n, parseInt(String(r.id).replace(/\D/g, ''), 10) || 0); }, 0);
          risks.push({ id: 'RSK-' + String(max + 1).padStart(3, '0'), serviceId: sid, workId: s.workId, type: 'risk', title: 'Overdue compliance: ' + std.name, severity: 'High', status: 'Open', source: 'standards', owner: s.owner, ref: ref });
        }
        out = 'risk';
      }
      ECO.event('standards.overdue', s, { sourceSystem: 'SHCA PowerApp (manual)', enablingServiceId: 'standards', status: 'Overdue', detail: std.name + ' is overdue', recordUrl: '../assurance/#/standards/' + sid });
    } else {
      if (ex && ex.status !== 'Closed') { ex.status = 'Closed'; out = 'closed'; }
      ECO.event('standards.updated', s, { sourceSystem: 'SHCA PowerApp (manual)', enablingServiceId: 'standards', status: status, detail: std.name + ': ' + status, recordUrl: '../assurance/#/standards/' + sid });
    }
    return out;
  }

  UI.route('/standards', function () {
    ext();
    var rows = svcs().map(function (s) {
      var c = stdCounts(s); return [link('#/standards/' + s.serviceId, s.name), c.total, c.Compliant, c.Partial, c.Overdue ? tag(c.Overdue + ' overdue', 'red') : '0', c['Not assessed']];
    });
    return UI.pageHead('Standards compliance', UI.intKind('manual') + ' Compliance returns are made in the SHCA PowerApp. Record the status and evidence here.') + manualBox('standards') +
      UI.table(['Service', 'Applicable standards', 'Compliant', 'Partial', 'Overdue', 'Not assessed'], rows);
  }, 'standards');

  UI.route('/standards/:id', function (p) {
    ext(); var s = svc(p.id); if (!s) return UI.pageHead('Service not found');
    var rows = stdRows(s).map(function (x) {
      var ev = ext().evidence.filter(function (e) { return e.serviceId === p.id && e.kind === 'standard' && e.refId === x.id; });
      return [esc(x.name) + '<br><span class="govuk-hint" style="margin:0">' + esc(x.source) + '</span>', esc(x.why), tag(x.status),
        ev.length ? ev.map(function (e) { return '<div>' + esc(e.id) + ': ' + esc(e.text) + (e.link ? ' ' + link(e.link, 'Link') : '') + (e.reusedFrom ? ' <span class="govuk-hint" style="margin:0">(reused from ' + esc(e.reusedFrom) + ')</span>' : '') + '</div>'; }).join('') : '\u2013',
        UI.button('Update', 'data-std-edit="' + esc(p.id + '|' + x.id) + '"', 'govuk-button--secondary')];
    });
    var open = S().risks.filter(function (r) { return r.serviceId === p.id && r.source === 'standards' && r.status !== 'Closed'; });
    return backTo('#/standards', 'All standards') + UI.pageHead(s.name + ': standards') + serviceHeader(s) + manualBox('standards') +
      (open.length ? UI.callout('warn', 'Linked risks.', open.map(function (r) { return esc(r.id) + ' ' + esc(r.title); }).join('; ') + '. ' + link('#/risks', 'See risks and issues')) : '') +
      UI.table(['Standard and source', 'Why it applies', 'Status', 'Evidence', ''], rows);
  }, 'standards');

  UI.on('click', '[data-std-edit]', function (e, el) {
    var parts = el.getAttribute('data-std-edit').split('|'), sid = parts[0], stdId = parts[1], s = svc(sid), cur = (S().compliance[sid] || {})[stdId] || 'Not assessed',
      std = ECO.STANDARDS.filter(function (x) { return x.id === stdId; })[0], pool = ext().evidence.filter(function (x) { return x.serviceId === sid && !(x.kind === 'standard' && x.refId === stdId); });
    UI.modal(std.name + ': ' + s.name, '<form data-form="std" data-svc="' + esc(sid) + '" data-std="' + esc(stdId) + '">' +
      UI.select('std-status', 'Status', ['Compliant', 'Partial', 'Overdue', 'Not assessed'], cur, { hint: 'Setting Overdue raises a risk in the RAID list.' }) +
      UI.textarea('std-evidence', 'Evidence', '', { hint: 'For example the SHCA submission reference and what it covers.', rows: 3 }) + UI.input('std-link', 'Evidence link (optional)', '') +
      UI.select('std-reuse', 'Or reuse existing evidence', [{ value: '', label: 'Do not reuse' }].concat(pool.map(function (x) { return { value: x.id, label: x.id + ': ' + x.text }; })), '', { hint: 'Evidence collected for another standard or enabling service for this service can be linked here instead of collecting it again.' }) +
      '<button class="govuk-button" data-module="govuk-button">Save</button></form>');
  });
  UI.on('submit', '[data-form="std"]', function (e, f) {
    e.preventDefault(); var sid = f.getAttribute('data-svc'), stdId = f.getAttribute('data-std'), d = UI.formData(f), msg = [];
    var reuse = d['std-reuse'] ? evById(d['std-reuse']) : null, text = d['std-evidence'].trim();
    if (d['std-status'] === 'Compliant' && !text && !reuse) { UI.flash('Add or reuse evidence before marking a standard compliant.', 'warn'); return; }
    if (reuse) { addEvidence(sid, 'standard', stdId, reuse.text, reuse.link, reuse.id); msg.push('Evidence ' + reuse.id + ' reused'); }
    if (text) { addEvidence(sid, 'standard', stdId, text, d['std-link'].trim(), null); msg.push('evidence recorded'); }
    var out = setStandard(sid, stdId, d['std-status']);
    if (out === 'risk') msg.push('risk raised in RAID'); if (out === 'closed') msg.push('linked risk closed');
    ECO.save(); UI.closeModal(); UI.go('#/standards/' + sid); UI.flash('Status saved' + (msg.length ? '; ' + msg.join('; ') : '') + '.', 'ok');
  });

  /* ---------- Assessments ---------- */
  function mAssessment(id) { return S().assessments.filter(function (m) { return m.id === id; })[0]; }
  UI.route('/assessments', function () {
    ext();
    var rows = S().assessments.map(function (m) {
      var s = svc(m.serviceId); return [link('#/assessments/' + m.id, m.id), esc(s.name), esc(m.type), tag(m.status), (m.status === 'Completed' ? 'Held ' : 'Due ') + fmt(m.due) + (m.status !== 'Completed' && isPast(m.due) ? ' ' + tag('Overdue', 'red') : ''), m.result ? tag(m.result, m.result === 'Met' ? 'green' : m.result === 'Not met' ? 'red' : 'yellow') : '\u2013', openFindings(m).length];
    });
    var need = svcs().filter(function (s) { var en = ECO.enrolment(s.serviceId, 'sas'); return en && en.status === 'action-required' && !assessmentsFor(s.serviceId).filter(function (m) { return m.status !== 'Completed'; }).length; });
    var form = '<form data-form="asm-add">' + UI.select('aa-svc', 'Service', svcs().map(function (s) { return { value: s.serviceId, label: s.name }; }), need.length ? need[0].serviceId : svcs()[0].serviceId) +
      UI.select('aa-type', 'Assessment type', ['Alpha assessment', 'Beta assessment', 'Live assessment'], 'Beta assessment') + UI.input('aa-due', 'Needed by', dateVal(ECO.ahead(28)), { type: 'date' }) + '<button class="govuk-button" data-module="govuk-button">Add assessment requirement</button></form>';
    return UI.pageHead('Service assessments', UI.intKind('manual') + ' Slots are booked in SAS. Record the booking reference, then the result, here.') + manualBox('sas') +
      (need.length ? UI.callout('warn', 'Required by the rules but not yet logged:', need.map(function (s) { return esc(s.name); }).join(', ') + '.') : '') +
      UI.table(['Reference', 'Service', 'Type', 'Status', 'Date', 'Result', 'Open findings'], rows) +
      '<details class="govuk-details"><summary class="govuk-details__summary"><span class="govuk-details__summary-text">Log a new assessment requirement</span></summary><div class="govuk-details__text">' + form + '</div></details>';
  }, 'assessments');

  UI.on('submit', '[data-form="asm-add"]', function (e, f) {
    e.preventDefault(); var d = UI.formData(f), s = svc(d['aa-svc']), n = S().assessments.length + 1;
    var m = { id: 'ASM-' + String(n).padStart(3, '0'), serviceId: s.serviceId, type: d['aa-type'], status: 'Required', due: toIso(d['aa-due']) || ECO.ahead(28), result: null, findings: [], bookingRef: '' };
    S().assessments.push(m); ECO.event('assessment.required', s, { enablingServiceId: 'sas', status: 'Required', detail: m.type, recordUrl: '../assurance/#/assessments/' + m.id });
    ECO.save(); UI.go('#/assessments/' + m.id); UI.flash('Assessment requirement logged.', 'ok');
  });

  UI.route('/assessments/:id', function (p) {
    ext(); var m = mAssessment(p.id); if (!m) return UI.pageHead('Assessment not found');
    var s = svc(m.serviceId), act = ECO.openAction(m.serviceId, 'sas'), booking = '', result = '';
    booking = m.bookingRef ? '<dl class="kv"><dt>SAS booking reference</dt><dd>' + esc(m.bookingRef) + '</dd><dt>Date</dt><dd>' + fmt(m.due) + '</dd></dl>' :
      '<form data-form="asm-book" data-id="' + esc(m.id) + '">' + UI.input('bk-ref', 'SAS booking reference') + UI.input('bk-date', 'Assessment date', dateVal(m.due), { type: 'date' }) + '<button class="govuk-button" data-module="govuk-button">Record booking</button></form>';
    if (m.status !== 'Required') {
      result = '<form data-form="asm-result" data-id="' + esc(m.id) + '">' + UI.radios('rs-result', 'Result', ['Met', 'Met with recommendations', 'Not met'], m.result || '') + UI.input('rs-date', 'Date of result', today(), { type: 'date' }) +
        UI.textarea('rs-find', 'Findings or recommendations (one per line)', '', { rows: 3, hint: 'Each line becomes a finding that can be turned into an action.' }) + '<button class="govuk-button" data-module="govuk-button">Record result</button></form>';
    } else result = '<p class="govuk-body">Record the booking first. The result can be recorded once the assessment is booked.</p>';
    var finds = UI.table(['Finding', 'Owner', 'Status', 'Action'], m.findings.map(function (f) {
      return [esc(f.text), esc(f.owner), tag(f.status, f.status === 'Closed' ? 'green' : 'red'),
        f.actionId ? esc(f.actionId) + ' ' + link('../rules-engine/#/actions', 'View in COMPASS actions') : UI.button('Create action', 'data-find-act="' + esc(m.id + '|' + f.id) + '"', 'govuk-button--secondary') + ' ' + UI.button('Close', 'data-find-close="' + esc(m.id + '|' + f.id) + '"', 'govuk-button--secondary')];
    }));
    return backTo('#/assessments', 'All assessments') + UI.pageHead(m.id + ': ' + m.type) + serviceHeader(s) + manualBox('sas') +
      '<dl class="kv" style="margin-bottom:14px"><dt>Status</dt><dd>' + tag(m.status) + '</dd><dt>Result</dt><dd>' + (m.result ? tag(m.result, m.result === 'Met' ? 'green' : m.result === 'Not met' ? 'red' : 'yellow') : 'Not recorded') + '</dd>' + (act ? '<dt>Linked action</dt><dd>' + esc(act.id) + ' ' + link('../rules-engine/#/actions', 'View in COMPASS actions') + '</dd>' : '') + '</dl>' +
      UI.panel('Booking (SAS handoff)', booking) + UI.panel('Result', result) + UI.panel('Findings', finds);
  }, 'assessments');

  UI.on('submit', '[data-form="asm-book"]', function (e, f) {
    e.preventDefault(); var m = mAssessment(f.getAttribute('data-id')), d = UI.formData(f), s = svc(m.serviceId);
    if (!d['bk-ref'].trim()) { UI.flash('Enter the SAS booking reference.', 'warn'); return; }
    m.bookingRef = d['bk-ref'].trim(); m.due = toIso(d['bk-date']) || m.due; m.status = 'Booked';
    addEvidence(m.serviceId, 'assessment', m.id, 'SAS booking reference ' + m.bookingRef + ' for ' + fmt(m.due), '', null);
    var act = ECO.openAction(m.serviceId, 'sas'); if (act && act.status === 'Not started') { act.status = 'In progress'; act.updates.push({ at: new Date().toISOString(), type: 'note', text: 'Booked in SAS: ' + m.bookingRef }); }
    ECO.event('assessment.booked', s, { sourceSystem: 'SAS (manual)', enablingServiceId: 'sas', status: 'Booked', detail: m.bookingRef, recordUrl: '../assurance/#/assessments/' + m.id });
    ECO.save(); UI.go('#/assessments/' + m.id); UI.flash('Booking recorded.', 'ok');
  });
  UI.on('submit', '[data-form="asm-result"]', function (e, f) {
    e.preventDefault(); var m = mAssessment(f.getAttribute('data-id')), d = UI.formData(f), s = svc(m.serviceId);
    if (!d['rs-result']) { UI.flash('Select a result.', 'warn'); return; }
    m.result = d['rs-result']; m.status = 'Completed'; m.due = toIso(d['rs-date']) || m.due;
    d['rs-find'].split('\n').map(function (x) { return x.trim(); }).filter(Boolean).forEach(function (t) {
      var n = m.findings.length + 1; m.findings.push({ id: 'F-' + n, text: t, status: 'Open', owner: s.owner, actionId: null });
    });
    var act = ECO.openAction(m.serviceId, 'sas'); if (act) ECO.completeAction(act.id, 'Assessment ' + m.id + ' result: ' + m.result, '', s.owner);
    ECO.event('assessment.completed', s, { sourceSystem: 'SAS (manual)', enablingServiceId: 'sas', status: m.result, detail: m.type + ': ' + m.result, recordUrl: '../assurance/#/assessments/' + m.id });
    ECO.audit(ACTOR, 'Recorded assessment result', m.id + ' ' + m.result); ECO.save(); UI.go('#/assessments/' + m.id); UI.flash('Result recorded: ' + esc(m.result) + '.', 'ok');
  });
  UI.on('click', '[data-find-act]', function (e, el) {
    var k = el.getAttribute('data-find-act').split('|'), m = mAssessment(k[0]), f = m.findings.filter(function (x) { return x.id === k[1]; })[0], s = svc(m.serviceId);
    if (f.actionId) return;
    var a = { id: ECO.uid('ACT'), serviceId: s.serviceId, workId: s.workId, enablingId: 'sas', ruleId: null, type: 'action', source: 'assessment', title: 'Address assessment finding: ' + f.text, description: 'Finding ' + f.id + ' from ' + m.id + ' (' + m.type + ').',
      owner: f.owner || s.owner, due: ECO.ahead(30), status: 'Not started', created: new Date().toISOString(), evidence: [], updates: [{ at: new Date().toISOString(), type: 'system', text: 'Created from assessment ' + m.id + ' finding ' + f.id + '.' }], manual: false };
    S().actions.push(a); f.actionId = a.id;
    ECO.event('action.created', s, { enablingServiceId: 'sas', detail: a.title, recordUrl: '../rules-engine/#/actions' });
    ECO.save(); UI.go('#/assessments/' + m.id); UI.flash('Action ' + esc(a.id) + ' created. ' + link('../rules-engine/#/actions', 'View in COMPASS actions'), 'ok');
  });
  UI.on('click', '[data-find-close]', function (e, el) {
    var k = el.getAttribute('data-find-close').split('|'), m = mAssessment(k[0]); m.findings.filter(function (x) { return x.id === k[1]; })[0].status = 'Closed';
    ECO.save(); UI.go('#/assessments/' + m.id); UI.flash('Finding closed.', 'ok');
  });

  /* ---------- Risks ---------- */
  UI.route('/risks', function () {
    ext(); var st = S();
    var items = st.risks.map(function (r) { return { id: r.id, svc: r.serviceId, type: r.type, title: r.title, severity: r.severity, status: r.status, source: r.source, owner: r.owner, href: '' }; })
      .concat(st.actions.filter(function (a) { return a.type === 'risk' || a.type === 'issue'; }).map(function (a) { return { id: a.id, svc: a.serviceId, type: a.type, title: a.title, severity: a.severity || 'Medium', status: a.status, source: a.source, owner: a.owner, href: '../rules-engine/#/actions' }; }));
    var rows = items.map(function (r) {
      var s = svc(r.svc);
      return [esc(r.id), esc(s ? s.name : r.svc), esc(r.type.charAt(0).toUpperCase() + r.type.slice(1)), esc(r.title) + (r.href ? ' ' + link(r.href, 'Open') : ''), tag(r.severity), esc(r.source), esc(r.owner || ''), tag(r.status, r.status === 'Closed' || r.status === 'Complete' ? 'green' : r.status === 'Open' ? 'red' : 'blue')];
    });
    return UI.pageHead('Risks and issues', 'RAID items from the shared COMPASS record, including those raised automatically when a standard becomes overdue. Manage the full record in ' + link('../rules-engine/#/actions', 'COMPASS actions') + '.') +
      UI.table(['Reference', 'Service', 'Type', 'Title', 'Severity', 'Source', 'Owner', 'Status'], rows);
  }, 'risks');

  /* ---------- Material change ---------- */
  var OB = ['sas', 'aiss', 'standards'];
  UI.route('/material-change', function () { return mcPage(null); }, 'material-change');
  UI.route('/material-change/:id', function (p) { return mcPage(p.id); }, 'material-change');
  function mcPage(id) {
    ext(); var s = id ? svc(id) : null, body = '';
    var pick = '<form data-form="mc-pick">' + UI.select('mc-svc', 'Service', [{ value: '', label: 'Choose a service' }].concat(svcs().map(function (x) { return { value: x.serviceId, label: x.name }; })), id || '') + '<button class="govuk-button govuk-button--secondary" data-module="govuk-button">Select</button></form>';
    if (s) {
      body = UI.panel('Change classification', serviceHeader(s) + '<form data-form="mc" data-svc="' + esc(s.serviceId) + '">' + UI.select('mc-stage', 'Stage', ECO.STAGES, s.stage) + UI.select('mc-type', 'Type', ECO.TYPES, s.type) +
        UI.input('mc-tx', 'Estimated transactions per year', s.estTransactions == null ? '' : s.estTransactions, { type: 'number', cls: 'govuk-input--width-10' }) + UI.select('mc-risk', 'Risk', ECO.LEVELS, s.risk) +
        '<button class="govuk-button" data-module="govuk-button">Apply change and re-evaluate</button></form>');
      if (lastChange && lastChange.id === id) {
        var c = lastChange, rows = OB.map(function (o) {
          var b = c.before[o], a = c.after[o], ch = c.changes.filter(function (x) { return x.enablingId === o; })[0];
          return [esc(ECO.catalogue(o).name) + ' ' + UI.intKind(ECO.catalogue(o).integration), UI.outcomeTag(b.outcome) + ' ' + (b.ruleId ? esc(b.ruleId) : ''), UI.outcomeTag(a.outcome) + ' ' + (a.ruleId ? esc(a.ruleId) : ''),
            ch ? UI.enrolTag(ch.from) + ' \u2192 ' + UI.enrolTag(ch.to) : (b.outcome === a.outcome ? 'No change' : 'Outcome changed, enrolment status unchanged')];
        });
        var added = c.stdAfter.filter(function (x) { return c.stdBefore.indexOf(x) < 0; }), removed = c.stdBefore.filter(function (x) { return c.stdAfter.indexOf(x) < 0; });
        function sn(l) { return l.map(function (i) { return esc(ECO.STANDARDS.filter(function (x) { return x.id === i; })[0].name); }).join(', ') || 'None'; }
        body += UI.panel('What changed: ' + c.diff.map(function (d) { return esc(d.field) + ' ' + esc(d.from) + ' to ' + esc(d.to); }).join(', '), (c.diff.length ? '' : '<p class="govuk-body">No classification values changed.</p>') +
          UI.table(['Assurance obligation', 'Before', 'After', 'Enrolment'], rows) + '<dl class="kv" style="margin:12px 0"><dt>Standards now applying</dt><dd>' + sn(added) + '</dd><dt>Standards no longer applying</dt><dd>' + sn(removed) + '</dd></dl>' +
          '<h3 class="govuk-heading-s">New actions</h3>' + UI.table(['Action', 'Title', 'Due', 'Source'], c.newActions.map(function (a) { return [esc(a.id), esc(a.title), fmt(a.due), esc(a.source)]; })) + '<p class="govuk-body">' + link('../rules-engine/#/actions', 'View in COMPASS actions') + '</p>');
      }
    }
    return UI.pageHead('Material change', 'Reclassify a service and see which assurance obligations change and which new actions the rules create.') + UI.panel('Service', pick) + body;
  }
  UI.on('submit', '[data-form="mc-pick"]', function (e, f) { e.preventDefault(); var v = UI.formData(f)['mc-svc']; UI.go(v ? '#/material-change/' + v : '#/material-change'); });
  UI.on('submit', '[data-form="mc"]', function (e, f) {
    e.preventDefault(); var id = f.getAttribute('data-svc'), d = UI.formData(f), s = svc(id), ids = S().actions.map(function (a) { return a.id; }), stdBefore = ECO.applicableStandards(s).map(function (x) { return x.id; });
    var r = ECO.setAttrs(id, { stage: d['mc-stage'], type: d['mc-type'], estTransactions: d['mc-tx'] === '' ? null : Number(d['mc-tx']), risk: d['mc-risk'] }, 'Service owner');
    lastChange = { id: id, diff: r.diff, changes: r.changes, before: r.before, after: r.after, stdBefore: stdBefore, stdAfter: ECO.applicableStandards(svc(id)).map(function (x) { return x.id; }),
      newActions: S().actions.filter(function (a) { return ids.indexOf(a.id) < 0; }) };
    ECO.save(); UI.go('#/material-change/' + id);
  });

  UI.on('change', '#mc-svc', function (e, el) { UI.go(el.value ? '#/material-change/' + el.value : '#/material-change'); });

  UI.start();
})(window.UI);
