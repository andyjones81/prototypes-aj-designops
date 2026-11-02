/* People capability administration: shared admin, privacy-safe reporting and integrations (simulated). */
(function () {
  'use strict';
  var esc = UI.esc, ALLOWED = ['platform', 'cbpadmin', 'ld', 'hop'];

  function S() { return PEO.get(); }
  function X() {
    var s = S(), x = s.ext['people-admin'];
    if (!x) {
      x = s.ext['people-admin'] = { failures: [], importStatus: {}, filter: { team: '', role: '' }, auditFilter: { q: '', sens: '' }, eventType: '' };
      s.attempts.forEach(function (a) { if (!a.roleAtSubmission) { var p = PEO.person(a.personId), rp = p && p.role ? PEO.roleProfile(p.role) : null; a.roleAtSubmission = rp ? rp.name : '(none)'; a.teamAtSubmission = p ? p.team : ''; } });
      if (s.events.length) x.failures.push({ id: 'FAIL-001', eventId: s.events[s.events.length - 1].eventId, eventType: s.events[s.events.length - 1].eventType, target: 'Central reporting API (mock)', failedAt: s.events[s.events.length - 1].occurredAt, attempts: 1, status: 'failed', error: '503 Service unavailable (simulated)' });
      PEO.save();
    }
    return x;
  }
  function fmt(iso) { return iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '\u2013'; }
  function intBadge(kind) { return '<span class="int int--' + kind + '">' + (kind === 'manual' ? 'Manual' : 'Simulated') + '</span>'; }
  function tbl(head, rows) { return UI.table(head, rows); }
  function can(role) { return PEO.me().persona === role; }
  function canOps() { var p = PEO.me().persona; return p === 'platform' || p === 'cbpadmin'; }
  function logSensitive(action, entity, detail) { PEO.audit(PEO.me().name, action, entity, detail); PEO.get().audit[0].sensitive = true; }
  function pre(text) { return '<pre style="white-space:pre-wrap;overflow:auto;max-height:60vh;border:1px solid #b1b4b6;padding:12px;font-size:.8rem;margin:0">' + esc(text) + '</pre>'; }

  function switcher() {
    var me = PEO.me();
    return '<form class="persona-bar" onsubmit="return false"><label class="govuk-label govuk-!-margin-bottom-0" for="persona"><strong>Viewing as</strong></label>' +
      '<select class="govuk-select" id="persona" name="persona" data-persona>' + PEO.personas().map(function (p) { return '<option value="' + p.id + '"' + (p.id === me.id ? ' selected' : '') + '>' + esc(p.name + ' (' + PEO.ROLES[p.persona] + ')') + '</option>'; }).join('') + '</select>' +
      '<span class="govuk-hint govuk-!-margin-bottom-0">Demo persona switcher. Fictional people only.</span></form>';
  }
  function guard(fn) {
    return function (params) {
      var me = PEO.me();
      if (ALLOWED.indexOf(me.persona) < 0) return switcher() + UI.pageHead('You do not have access') + '<p class="govuk-body">This area is for platform administrators, CBP administrators, L&amp;D administrators and the head of profession. You are viewing as ' + esc(me.name) + ' (' + esc(PEO.ROLES[me.persona]) + ').</p><p class="govuk-body">Use the persona switcher above to continue.</p>';
      return switcher() + fn(params, me);
    };
  }
  function stat(label, value, href, note) { return '<a class="stat" href="' + href + '"><span class="stat-n">' + value + '</span><span class="stat-l">' + esc(label) + '</span>' + (note ? '<span class="stat-d">' + note + '</span>' : '') + '</a>'; }

  /* ---------- Reporting data ---------- */
  function cohortIds(f) { return S().people.filter(function (p) { return p.role && (!f.team || p.team === f.team) && (!f.role || p.role === f.role); }).map(function (p) { return p.id; }); }
  function reportData(f) {
    var s = S(), min = s.reporting.minCohort, ids = cohortIds(f), inC = function (id) { return ids.indexOf(id) > -1; }, now = Date.now(), sup = 0;
    function cell(n) { if (n > 0 && n < min) { sup++; return null; } return n; }
    var agg = PEO.aggregate(f); agg.rows.forEach(function (r) { if (r.suppressed) sup++; });
    var status = PEO.ATTEMPT_STATUS.map(function (st) { return { status: st, n: cell(s.attempts.filter(function (a) { return a.status === st && inC(a.personId); }).length) }; });
    var revs = s.reviews.filter(function (r) { var a = PEO.byId(s.attempts, r.attemptId); return a && inC(a.personId); });
    var overdue = cell(revs.filter(function (r) { return !r.submittedAt && Date.parse(r.due) < now; }).length);
    var done = revs.filter(function (r) { return r.submittedAt; }), onTime = done.filter(function (r) { return Date.parse(r.submittedAt) <= Date.parse(r.due); }).length, timely = null;
    if (done.length >= min) timely = Math.round(onTime / done.length * 100); else sup++;
    var enr = s.enrolments.filter(function (e) { return inC(e.personId); }), byItem = {};
    enr.forEach(function (e) { byItem[e.itemId] = (byItem[e.itemId] || 0) + 1; });
    var demand = Object.keys(byItem).map(function (id) { var it = PEO.byId(s.learning, id); return { title: it ? it.title : id, n: cell(byItem[id]) }; });
    var completed = enr.filter(function (e) { return e.status === 'completed'; }).length, part = null;
    if (enr.length >= min) part = Math.round(completed / enr.length * 100); else if (enr.length) sup++;
    var goals = s.goals.filter(function (g) { return inC(g.personId); }), gdone = goals.filter(function (g) { return g.status === 'complete'; }).length, gpct = null;
    if (goals.length >= min) gpct = Math.round(gdone / goals.length * 100); else if (goals.length) sup++;
    return { min: min, agg: agg, status: status, overdue: overdue, timely: timely, demand: demand, participation: part, goalPct: gpct, suppressedCells: sup, at: new Date().toISOString(), fw: PEO.currentFramework().version, cohortOk: ids.length >= min, cohortSize: ids.length };
  }
  function overdueReviewsAll() { return S().reviews.filter(function (r) { return !r.submittedAt && Date.parse(r.due) < Date.now(); }).length; }
  function pendingImports() { var x = X(); return S().imports.filter(function (i) { return !x.importStatus[i.id]; }); }
  function failedDeliveries() { return X().failures.filter(function (f) { return f.status === 'failed'; }); }
  function integrationIssues() { return S().integrations.filter(function (i) { return i.status !== 'healthy'; }).length; }

  /* ---------- Overview ---------- */
  UI.route('/', guard(function () {
    var s = S(), rd = reportData({}), open = s.cycles.filter(function (c) { return /^open/.test(c.status); }).length;
    return UI.pageHead('People capability administration', 'Shared administration, privacy-safe reporting and integrations for the CBP, skills and learning and development enablers. All data is fictional and integrations are simulated or manual.') +
      '<div class="stats">' + stat('Open assessment rounds', open, '#/reports') + stat('Overdue assessor reviews', overdueReviewsAll(), '#/reports') + stat('Integration issues', integrationIssues(), '#/integrations', pendingImports().length + ' import record(s) awaiting a decision') + stat('Suppressed report cells', rd.suppressedCells, '#/reports', 'Minimum cohort ' + s.reporting.minCohort) + '</div>' +
      '<div class="grid-2"><section class="panel"><h2 class="govuk-heading-s">Go to</h2><ul class="govuk-list">' +
      '<li><a class="govuk-link" href="#/reports">Reports</a>: role-specific dashboards with suppression</li><li><a class="govuk-link" href="#/privacy">Privacy settings</a>: minimum cohort, retention and consent</li><li><a class="govuk-link" href="#/integrations">Integrations</a>: status, field mappings and identity import</li>' +
      '<li><a class="govuk-link" href="#/events">Events</a>: event log and failed deliveries (' + failedDeliveries().length + ' failed)</li><li><a class="govuk-link" href="#/api">API contracts</a>: illustrative endpoints and event payloads</li><li><a class="govuk-link" href="#/audit">Audit trail</a></li><li><a class="govuk-link" href="#/roles">Roles and access</a></li></ul></section>' +
      '<section class="panel"><h2 class="govuk-heading-s">Assessment rounds</h2>' + tbl(['Round', 'Status', 'Closes'], s.cycles.map(function (c) { return [esc(c.name), UI.tag(c.status, /^open/.test(c.status) ? 'green' : 'grey'), fmt(c.closes)]; })) + '</section></div>';
  }), 'overview');

  /* ---------- Roles ---------- */
  var MATRIX = {
    staff: ['Yes', 'No', 'No', 'No', 'No'], assessor: ['Yes', 'Assigned submissions only', 'No', 'No', 'No'], moderator: ['Yes', 'Assigned moderation cases', 'Yes, for assigned cases', 'No', 'No'],
    manager: ['Yes', 'No (shared development goals only)', 'No', 'Team aggregates above minimum cohort', 'No'], hop: ['Yes', 'No', 'No', 'Profession aggregates above minimum cohort', 'No'],
    ld: ['Yes', 'No', 'No', 'Learning demand and participation aggregates', 'Learning administration entries; sensitive detail redacted'], cbpadmin: ['Yes', 'Controlled access to assessment content', 'Monitors workflow; does not score', 'CBP process statistics', 'Administrative entries; sensitive detail redacted'],
    platform: ['Yes', 'No (technical access separately controlled)', 'No', 'All aggregates', 'Yes, including sensitive entries']
  };
  UI.route('/roles', guard(function (p, me) {
    var s = S();
    return UI.pageHead('Roles and access', 'Explanatory only. In a real service every route enforces these permissions in the back end, not just by hiding controls.') +
      '<h2 class="govuk-heading-m">Access matrix</h2>' + tbl(['Role', 'Own record', 'Assigned submissions', 'Moderation', 'Aggregates', 'Audit'], Object.keys(MATRIX).map(function (r) { return [(r === me.persona ? '<strong>' + esc(PEO.ROLES[r]) + ' (you)</strong>' : esc(PEO.ROLES[r]))].concat(MATRIX[r].map(esc)); })) +
      '<h2 class="govuk-heading-m">Demo personas</h2>' + tbl(['Person', 'Role', 'Team'], PEO.personas().map(function (p) { return [esc(p.name), esc(PEO.ROLES[p.persona]), esc(p.team)]; })) +
      '<p class="govuk-body">Staff in the directory: ' + s.people.filter(function (p) { return p.role; }).length + '. Candidate evidence is visible only to approved assessors during formal assessment.</p>';
  }), 'overview');

  /* ---------- Privacy ---------- */
  var EXCLUDED = ['Candidate evidence and example text', 'Assessor scores, rationale and feedback', 'Moderation notes and internal deliberations', 'Individual self-assessment levels', 'Names, email addresses and other personal identifiers', 'Free-text reflections and development goal notes'];
  UI.route('/privacy', guard(function (p, me) {
    var s = S(), editable = me.persona === 'platform', err = X().thresholdErr || '', val = X().thresholdVal != null ? X().thresholdVal : s.reporting.minCohort; X().thresholdErr = ''; X().thresholdVal = null;
    return UI.pageHead('Privacy settings', 'Configuration for reporting thresholds, retention, consent and what leaves the service.') +
      (err ? UI.errorSummary([{ id: 'minCohort', msg: err }]) : '') +
      UI.panel('Minimum cohort size', '<p class="govuk-body">Report cells covering fewer people than this are suppressed. Currently <strong>' + s.reporting.minCohort + '</strong>. ' + (editable ? '' : 'Only platform administrators can change this.') + '</p>' +
        '<form id="threshold-form" novalidate>' + UI.input('minCohort', 'Minimum cohort size', val, { type: 'number', cls: 'govuk-input--width-3', hint: 'A whole number from 3 to 20.', err: err }) +
        '<button class="govuk-button" data-module="govuk-button"' + (editable ? '' : ' disabled aria-disabled="true"') + '>Save threshold</button></form>') +
      UI.panel('Retention (configuration text, illustrative)', tbl(['Record', 'Proposed retention', 'Note'], [['CBP submissions and reviews', '2 years after outcome published', 'To be confirmed with the data protection officer'], ['Self-assessments', 'Until superseded plus 1 year', 'Voluntary; person can delete their own'], ['Development goals and learning records', 'Duration of employment plus 1 year', 'Shared with manager only with consent'], ['Audit trail', '7 years', 'Sensitive entries restricted to platform administrators'], ['Aggregated reports', '5 years', 'Cells under the minimum cohort are never stored']])) +
      UI.panel('Consent notes (configuration text)', '<ul class="govuk-list govuk-list--bullet"><li>Self-assessment is voluntary and is never used for automated employment decisions or ranking.</li><li>Sharing development goals with a line manager is opt-in and can be withdrawn.</li><li>CBP evidence is shared with assessors only for the assessment round the person entered.</li><li>Profession reporting uses aggregated data only, with suppression of small groups.</li></ul>') +
      UI.panel('Excluded from events and exports', '<ul class="govuk-list govuk-list--bullet">' + EXCLUDED.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul><p class="govuk-body">Events carry identifiers, type, schema version, time, source and correlation ID only.</p>');
  }), 'privacy');
  UI.on('submit', '#threshold-form', function (e, form) {
    e.preventDefault(); var me = PEO.me(), raw = String(UI.formData(form).minCohort).trim(), n = Number(raw), x = X(), old = S().reporting.minCohort;
    if (me.persona !== 'platform') { x.thresholdErr = 'Only platform administrators can change the minimum cohort size'; UI.render(); return; }
    if (raw === '' || !/^\d+$/.test(raw) || n < 3 || n > 20) { x.thresholdErr = 'Enter a whole number from 3 to 20'; x.thresholdVal = raw; UI.render(); return; }
    S().reporting.minCohort = n; logSensitive('Changed reporting threshold', 'minCohort=' + n, 'From ' + old + ' to ' + n); PEO.save(); UI.render(); UI.flash('Minimum cohort size changed from ' + old + ' to ' + n + '. Recorded in the audit trail.');
  });

  /* ---------- Reports ---------- */
  function meta(def, src, r) { return '<dl class="kv" style="margin-bottom:12px"><dt>Definition</dt><dd>' + esc(def) + '</dd><dt>Source</dt><dd>' + esc(src) + '</dd><dt>Framework version</dt><dd>v' + r.fw + '</dd><dt>Aggregated</dt><dd>' + fmt(r.at) + '</dd></dl>'; }
  function val(v, suffix) { return v == null ? UI.tag('Suppressed', 'grey') : esc(v) + (suffix || ''); }
  UI.route('/reports', guard(function (p, me) {
    var s = S(), f = X().filter, r = reportData(f), per = me.persona, show = { cap: per === 'platform' || per === 'hop' || per === 'ld', cbp: per === 'platform' || per === 'cbpadmin', lrn: per === 'platform' || per === 'ld' || per === 'hop' };
    var teams = []; s.people.forEach(function (x) { if (x.role && teams.indexOf(x.team) < 0) teams.push(x.team); });
    var html = UI.pageHead('Reports', 'Privacy-safe dashboard for ' + PEO.ROLES[per].toLowerCase() + '. Cells covering fewer than ' + r.min + ' people are suppressed.', '<button type="button" class="govuk-button govuk-button--secondary" data-act="export" data-module="govuk-button">Export preview</button>') +
      '<form class="panel" onsubmit="return false" style="display:flex;gap:16px;flex-wrap:wrap;align-items:end"><div>' + UI.select('f-team', 'Team', [{ value: '', label: 'All teams' }].concat(teams.map(function (t) { return { value: t, label: t }; })), f.team) + '</div><div>' +
      UI.select('f-role', 'Role', [{ value: '', label: 'All roles' }].concat(s.roleProfiles.map(function (rp) { return { value: rp.id, label: rp.name }; })), f.role) + '</div>' +
      '<p class="govuk-body">Cohort: ' + (r.cohortOk ? r.cohortSize + ' people' : 'fewer than ' + r.min + ' people (size withheld)') + '. Suppressed cells in this view: <strong>' + r.suppressedCells + '</strong>.</p></form>';
    if (show.cap) html += UI.panel('Capability coverage and gaps', meta('Self-assessed level against role expectation. Coverage is people with evidence as a share of the cohort. Mean gap is expected level minus self-assessed level (positive means below expectation). Currency is the share of evidence older than 12 months.', r.agg.source, r) +
      tbl(['Skill', 'Coverage', 'Mean gap', 'At or above expected', 'Evidence out of date'], r.agg.rows.map(function (x) { return x.suppressed ? [esc(x.name), UI.tag('Suppressed', 'grey') + ' <span class="govuk-hint" style="display:inline">' + esc(x.reason) + '</span>', '', '', '']
        : [esc(x.name), x.coveragePct + '%', x.meanGap, x.atOrAbovePct + '%', x.stalePct + '%']; })));
    if (show.cbp) html += UI.panel('CBP process statistics', meta('Operational counts of assessment attempts by workflow status, assessor reviews past their due date, and the share of submitted reviews completed by their due date. These are not capability gaps.', 'CBP workflow records (attempts and reviews)', r) +
      tbl(['Attempt status', 'Attempts'], r.status.map(function (x) { return [esc(x.status), val(x.n)]; })) + '<dl class="kv govuk-!-margin-top-3"><dt>Overdue reviews</dt><dd>' + val(r.overdue) + '</dd><dt>Review timeliness</dt><dd>' + val(r.timely, '% on time') + '</dd></dl>');
    if (show.lrn) html += UI.panel('Learning demand, participation and development goals', meta('Demand is enrolments per learning item. Participation is completed enrolments as a share of all enrolments. Goal completion is completed development goals as a share of all goals.', 'Learning enrolments and development goals', r) +
      tbl(['Learning item', 'Enrolments'], r.demand.map(function (x) { return [esc(x.title), val(x.n)]; })) + '<dl class="kv govuk-!-margin-top-3"><dt>Participation</dt><dd>' + val(r.participation, '% completed') + '</dd><dt>Development goal completion</dt><dd>' + val(r.goalPct, '% complete') + '</dd></dl>');
    html += UI.callout('warn', 'Disclosure review.', 'Before sharing, check that combining filters cannot reveal an individual by differencing (for example, all staff minus all-but-one team). Do not quote individual examples or exact small-group counts in narrative. Individual self-assessments and CBP scores are never used to rank people.');
    return html;
  }), 'reports');
  UI.on('change', '#f-team, #f-role', function (e, el) { var f = X().filter; f[el.id === 'f-team' ? 'team' : 'role'] = el.value; PEO.save(); UI.render(); });

  function exportPreview() {
    var s = S(), json = JSON.stringify(PEO.reportPreview(), null, 2), names = s.people.map(function (p) { return p.name; }), found = names.filter(function (n) { return json.indexOf(n) > -1; });
    var checks = [['No person names', !found.length], ['No person identifiers (P-nn)', !/\bP-\d{2}\b/.test(json)], ['No email addresses', !/@/.test(json)], ['No evidence or assessor comment text', !/Invented/i.test(json)], ['No individual scores or ratings fields', !/"(scores|rationale|feedback|evidence|internalNote)"\s*:/.test(json)]], ok = checks.every(function (c) { return c[1]; });
    logSensitive('Exported report preview', 'GET /api/reports/profession-capability', ok ? 'Disclosure checks passed' : 'Disclosure checks FAILED');
    PEO.save();
    UI.modal('Export preview', '<p>' + intBadge('simulated') + ' Mock central reporting API <code>GET /api/reports/profession-capability</code>. Nothing is sent.</p>' +
      '<h3 class="govuk-heading-s">Disclosure check: ' + (ok ? 'passed' : 'failed') + '</h3>' + tbl(['Check', 'Result'], checks.map(function (c) { return [esc(c[0]), UI.tag(c[1] ? 'Pass' : 'Fail', c[1] ? 'green' : 'red')]; })) +
      '<p class="govuk-body">Checked ' + names.length + ' known names against the JSON: ' + found.length + ' found.</p>' + pre(json));
  }

  /* ---------- Integrations ---------- */
  var MAPPINGS = [['employeeId', 'person.id', 'Stable match key (never match on name alone)', 'Required'], ['displayName', 'person.name', 'Display only', 'Required'], ['workEmail', 'person.email', 'Display only; never in reports', 'Optional'], ['jobTitle', 'person.role', 'Mapped to a role profile by title', 'Required'], ['department', 'person.team', 'Copied as is', 'Required'], ['grade', 'person.grade', 'Copied as is; missing values flagged', 'Required'], ['lineManagerId', 'person.manager', 'Resolved to a person ID', 'Optional']];
  function current(imp) { var p = PEO.person(imp.personId); if (!p) return '(unknown)'; if (imp.field === 'Role') { var rp = p.role && PEO.roleProfile(p.role); return rp ? rp.name : '(missing)'; } if (imp.field === 'Team') return p.team || '(missing)'; return p.grade || '(missing)'; }
  function conflictText(imp) { var cur = current(imp); if (cur === imp.from) return ''; return imp.from === '(missing)' ? 'Source value was missing' : 'Local value "' + cur + '" differs from the source "from" value "' + imp.from + '"'; }
  function setField(imp, value) {
    var p = PEO.person(imp.personId); if (imp.field === 'Role') { var rp = S().roleProfiles.filter(function (r) { return r.name === value; })[0]; if (!rp) return false; p.role = rp.id; } else if (imp.field === 'Team') p.team = value; else p.grade = value; return true;
  }
  UI.route('/integrations', guard(function (p, me) {
    var s = S(), x = X(), ops = canOps();
    var proofRows = [];
    s.imports.forEach(function (i) { var st = x.importStatus[i.id]; if (!st) return; s.attempts.filter(function (a) { return a.personId === i.personId; }).forEach(function (a) { var fw = PEO.framework(a.frameworkId), pp = PEO.person(i.personId), rp = pp.role && PEO.roleProfile(pp.role);
      proofRows.push([esc(i.id), esc(pp.name), esc(a.id), esc(a.status), 'Framework v' + fw.version, esc(a.roleAtSubmission) + ' (kept)', esc(a.teamAtSubmission), esc(rp ? rp.name : '(none)') + ' / ' + esc(pp.team) + (pp.grade ? ' / ' + esc(pp.grade) : '')]); }); });
    var conflicts = pendingImports().filter(function (i) { return i.conflict || conflictText(i); }).length;
    return UI.pageHead('Integrations', 'Every integration here is simulated or manual. No live HR, identity or reporting service is called.') +
      UI.panel('Integration status', tbl(['Integration', 'Type', 'Status', 'Last sync', 'Note', 'Actions'], s.integrations.map(function (i) {
        return [esc(i.name), intBadge(i.kind), UI.tag(i.status), fmt(i.lastSync), esc(i.note), ops ? '<button type="button" class="chip" data-act="int-test" data-id="' + i.id + '">Test</button> <button type="button" class="chip" data-act="int-retry" data-id="' + i.id + '">Retry</button> <button type="button" class="chip" data-act="int-fail" data-id="' + i.id + '">Simulate failure</button>' : 'Read only'];
      }))) +
      UI.panel('Field mappings: HR directory to local fields', tbl(['HR directory attribute', 'Local field', 'Rule', 'Presence'], MAPPINGS.map(function (m) { return [esc(m[0]), esc(m[1]), esc(m[2]), esc(m[3])]; }))) +
      '<h2 class="govuk-heading-m" id="imports">Mock identity import ' + intBadge('simulated') + '</h2><p class="govuk-body">' + conflicts + ' record(s) awaiting a decision. Records are matched by employee ID. Applying a change updates the person only; historical CBP attempts keep the role and framework version they were submitted under.</p>' +
      tbl(['Record', 'Person', 'Field', 'Source', 'Imported', 'From', 'To', 'Status', 'Actions'], s.imports.map(function (i) {
        var st = x.importStatus[i.id], pp = PEO.person(i.personId), cf = conflictText(i), flag = st ? UI.tag(st.type === 'exception' ? 'Local exception' : 'Applied', st.type === 'exception' ? 'orange' : 'green') : (i.conflict || cf ? UI.tag('Conflict', 'red') + '<br><span class="govuk-hint">' + esc(cf || 'Flagged by source') + '</span>' : UI.tag('Ready', 'blue'));
        var acts = st ? esc(st.reason || 'Applied by ' + st.by) : !ops ? 'Read only' : '<button type="button" class="chip" data-act="imp-apply" data-id="' + i.id + '">Apply</button>' + (i.conflict || cf ? ' <button type="button" class="chip" data-act="imp-exc" data-id="' + i.id + '">Local exception</button>' : '');
        return [esc(i.id), esc(pp ? pp.name : i.personId), esc(i.field), esc(i.source), fmt(i.at), esc(i.from), esc(i.to), flag, acts];
      })) +
      (proofRows.length ? '<h3 class="govuk-heading-s">Proof: historical attempts keep their original role and framework version</h3>' + tbl(['Import', 'Person', 'Attempt', 'Status', 'Framework', 'Role at submission', 'Team at submission', 'Current role / team / grade'], proofRows) : '<p class="govuk-hint">Apply an import to see how historical attempts are preserved.</p>');
  }), 'integrations');

  function intById(id) { return PEO.byId(S().integrations, id); }
  UI.on('click', '[data-act="int-test"]', function (e, el) { var i = intById(el.getAttribute('data-id')); i.lastSync = new Date().toISOString(); PEO.audit(PEO.me().name, 'Tested integration (simulated)', i.id, i.name + ': status ' + i.status); PEO.save(); UI.render(); UI.flash('Test of ' + esc(i.name) + ' completed (simulated). Status: ' + i.status + '.'); });
  UI.on('click', '[data-act="int-retry"]', function (e, el) {
    var i = intById(el.getAttribute('data-id')), pend = pendingImports().length; i.lastSync = new Date().toISOString();
    if (i.id === 'IG-2' && pend) { i.status = 'degraded'; i.note = pend + ' import record(s) need a decision'; } else { i.status = 'healthy'; if (i.id === 'IG-2') i.note = 'No outstanding import issues'; }
    PEO.audit(PEO.me().name, 'Retried integration (simulated)', i.id, i.name + ' now ' + i.status); PEO.save(); UI.render(); UI.flash('Retry of ' + esc(i.name) + ' completed (simulated). Status: ' + i.status + '.');
  });
  UI.on('click', '[data-act="int-fail"]', function (e, el) { var i = intById(el.getAttribute('data-id')); i.status = 'failing'; i.note = 'Simulated failure: connection timed out'; PEO.audit(PEO.me().name, 'Simulated integration failure', i.id, i.name); PEO.save(); UI.render(); });
  UI.on('click', '[data-act="imp-apply"]', function (e, el) {
    var i = PEO.byId(S().imports, el.getAttribute('data-id')), p = PEO.person(i.personId);
    S().attempts.forEach(function (a) { if (a.personId === p.id && !a.roleAtSubmission) { var rp = p.role && PEO.roleProfile(p.role); a.roleAtSubmission = rp ? rp.name : '(none)'; a.teamAtSubmission = p.team; } });
    if (!setField(i, i.to)) { UI.flash('The role "' + esc(i.to) + '" does not match a role profile.', 'warn'); return; }
    X().importStatus[i.id] = { type: 'applied', by: PEO.me().name, at: new Date().toISOString() };
    logSensitive('Applied identity import', i.id, i.field + ': ' + i.from + ' to ' + i.to + ' for ' + p.name); PEO.save(); UI.render(); UI.flash('Applied ' + esc(i.field.toLowerCase()) + ' change for ' + esc(p.name) + '. Historical attempts keep their original role and framework version.');
  });
  UI.on('click', '[data-act="imp-exc"]', function (e, el) {
    var i = PEO.byId(S().imports, el.getAttribute('data-id')), p = PEO.person(i.personId);
    UI.modal('Local exception: ' + p.name, '<form id="exception-form" data-id="' + i.id + '" novalidate><p class="govuk-body">' + esc(i.field) + ': source says "' + esc(i.to) + '" (was "' + esc(i.from) + '"). Record a local value and reason. The source is not changed.</p>' + UI.input('ex-value', 'Local value', i.to) + UI.textarea('ex-reason', 'Reason for exception', '', { rows: 2 }) + '<button class="govuk-button" data-module="govuk-button">Save local exception</button></form>');
  });
  UI.on('submit', '#exception-form', function (e, form) {
    e.preventDefault(); var d = UI.formData(form), i = PEO.byId(S().imports, form.getAttribute('data-id')), p = PEO.person(i.personId), v = String(d['ex-value']).trim(), reason = String(d['ex-reason']).trim();
    if (!v || !reason) { UI.flash('Enter a local value and a reason.', 'warn'); return; }
    S().attempts.forEach(function (a) { if (a.personId === p.id && !a.roleAtSubmission) { var rp = p.role && PEO.roleProfile(p.role); a.roleAtSubmission = rp ? rp.name : '(none)'; a.teamAtSubmission = p.team; } });
    if (!setField(i, v)) { UI.flash('The role "' + esc(v) + '" does not match a role profile.', 'warn'); return; }
    X().importStatus[i.id] = { type: 'exception', by: PEO.me().name, at: new Date().toISOString(), reason: 'Local exception: ' + reason };
    logSensitive('Recorded local exception for import', i.id, i.field + ' set to ' + v + ' for ' + p.name + '. Reason: ' + reason); PEO.save(); UI.closeModal(); UI.render(); UI.flash('Local exception recorded for ' + esc(p.name) + '. Historical attempts keep their original role and framework version.');
  });

  /* ---------- Events ---------- */
  var EVENT_TYPES = ['framework.published', 'assessment.round.opened', 'assessment.submitted', 'assessor.review.submitted', 'assessment.moderated', 'assessment.outcome.published', 'development.goal.created', 'learning.enrolment.created', 'learning.completed', 'skill.evidence.updated'];
  UI.route('/events', guard(function (p, me) {
    var s = S(), x = X(), t = x.eventType, list = s.events.filter(function (e) { return !t || e.eventType === t; }).slice(0, 50), plat = me.persona === 'platform';
    return UI.pageHead('Events', 'Event log from the outbox. Events carry identifiers only: no evidence, assessor notes or names.') +
      '<div class="panel">' + UI.select('f-etype', 'Filter by event type', [{ value: '', label: 'All event types' }].concat(EVENT_TYPES.map(function (e) { return { value: e, label: e }; })), t) + '</div>' +
      tbl(['Event ID', 'Type', 'Entity ID', 'Schema', 'Occurred', 'Source system', 'Correlation ID', ''], list.map(function (e) { return [esc(e.eventId), esc(e.eventType), esc(e.entityId), esc(e.schemaVersion), fmt(e.occurredAt), esc(e.sourceSystem), esc(e.correlationId), '<button type="button" class="chip" data-act="evt-json" data-id="' + esc(e.eventId) + '">View JSON</button>']; })) +
      '<h2 class="govuk-heading-m">Delivery failures ' + intBadge('simulated') + '</h2><p class="govuk-body">Simulate a failed delivery to the mock central reporting endpoint, then retry. The first retry fails; the second succeeds.</p>' +
      (plat ? '<form id="fail-form" class="panel" style="display:flex;gap:12px;align-items:end">' + UI.select('fail-type', 'Event type', EVENT_TYPES, EVENT_TYPES[0]) + '<button class="govuk-button" data-module="govuk-button">Simulate event failure</button></form>' : '<p class="govuk-hint">Only platform administrators can simulate or retry failures.</p>') +
      tbl(['Failure', 'Event', 'Type', 'Target', 'Failed at', 'Attempts', 'Status', 'Error', ''], x.failures.map(function (f) { return [esc(f.id), esc(f.eventId), esc(f.eventType), esc(f.target), fmt(f.failedAt), f.attempts, UI.tag(f.status === 'failed' ? 'Failed' : 'Delivered', f.status === 'failed' ? 'red' : 'green'), esc(f.error || ''), f.status === 'failed' && plat ? '<button type="button" class="chip" data-act="evt-retry" data-id="' + f.id + '">Retry</button>' : '']; }));
  }), 'events');
  UI.on('change', '#f-etype', function (e, el) { X().eventType = el.value; PEO.save(); UI.render(); });
  UI.on('click', '[data-act="evt-json"]', function (e, el) { var ev = PEO.byId(S().events.map(function (x) { return { id: x.eventId, e: x }; }), el.getAttribute('data-id')); UI.modal('Event ' + el.getAttribute('data-id'), '<p>Envelope only. No candidate evidence, scores or assessor notes.</p>' + pre(JSON.stringify(ev.e, null, 2))); });
  UI.on('submit', '#fail-form', function (e, form) {
    e.preventDefault(); if (!can('platform')) return; var type = UI.formData(form)['fail-type'], ev = PEO.event(type, 'SIM-' + Math.floor(Math.random() * 900 + 100)), x = X();
    x.failures.unshift({ id: 'FAIL-' + String(x.failures.length + 1).padStart(3, '0'), eventId: ev.eventId, eventType: type, target: 'Central reporting API (mock)', failedAt: ev.occurredAt, attempts: 1, status: 'failed', error: '503 Service unavailable (simulated)' });
    PEO.audit(PEO.me().name, 'Simulated event delivery failure', ev.eventId, type); PEO.save(); UI.render(); UI.flash('Event ' + esc(ev.eventId) + ' failed delivery (simulated).');
  });
  UI.on('click', '[data-act="evt-retry"]', function (e, el) {
    var f = PEO.byId(X().failures, el.getAttribute('data-id')); if (!can('platform')) return; f.attempts++;
    if (f.attempts >= 3) { f.status = 'delivered'; f.error = ''; } else f.error = '504 Gateway timeout (simulated)';
    PEO.audit(PEO.me().name, 'Retried event delivery (simulated)', f.eventId, f.status); PEO.save(); UI.render(); UI.flash(f.status === 'delivered' ? 'Event ' + esc(f.eventId) + ' delivered (simulated).' : 'Retry failed again (simulated). Try once more.', f.status === 'delivered' ? 'success' : 'warn');
  });

  /* ---------- API contracts ---------- */
  var API = [
    ['GET', '/api/me', 'Current user, role and scopes', 'Any signed-in user', '{ "id": "P-nn", "persona": "hop", "scopes": ["reports:read"] }'],
    ['GET', '/api/frameworks?profession=service-design&role=senior', 'Published framework version for a role', 'Any signed-in user', '{ "version": 2, "status": "published", "skills": [ { "id": "SK-01", "name": "Design communication" } ] }'],
    ['GET', '/api/skills/profile/{personId}', 'Skills profile and gap view', 'Owner; manager where shared', '{ "personId": "P-nn", "gaps": [ { "skillId": "SK-03", "expected": 2, "self": 1 } ] }'],
    ['POST', '/api/skills/self-assessments', 'Record a self-assessment', 'Owner', '{ "skillId": "SK-03", "level": 2, "confidence": "Medium" }'],
    ['GET', '/api/cbp/cycles', 'List assessment rounds', 'Signed-in staff; admin', '[ { "id": "CYC-001", "status": "open for assessment" } ]'],
    ['POST', '/api/cbp/attempts', 'Create a draft attempt', 'Candidate', '{ "cycleId": "CYC-001" }'],
    ['POST', '/api/cbp/attempts/{id}/submit', 'Submit and lock evidence, returns receipt', 'Candidate', '{ "receipt": "RCPT-ATT-001-v1" }'],
    ['POST', '/api/cbp/reviews/{id}/submit', 'Submit an immutable assessor review', 'Assigned assessor', '{ "reviewId": "REV-001", "submittedAt": "2026-11-02T09:00:00Z" }'],
    ['POST', '/api/cbp/attempts/{id}/moderate', 'Record agreed final scores', 'Moderator', '{ "finals": { "SK-01": { "score": 2 } } }'],
    ['POST', '/api/cbp/attempts/{id}/publish', 'Publish outcome to candidate', 'CBP administrator', '{ "status": "published" }'],
    ['GET', '/api/learning/catalogue', 'Learning catalogue', 'Signed-in staff', '[ { "id": "LRN-01", "title": "Writing for design decisions" } ]'],
    ['POST', '/api/learning/enrolments', 'Add to development plan or enrol', 'Staff member', '{ "itemId": "LRN-03", "status": "planned" }'],
    ['POST', '/api/development/goals', 'Create a development goal', 'Staff member', '{ "skillId": "SK-03", "targetLevel": 2, "targetDate": "2027-03-01" }'],
    ['GET', '/api/reports/profession-capability', 'Aggregated profession capability (mock central reporting)', 'Head of profession; administrators', '{ "schemaVersion": "1.0", "capability": [ { "skill": "Designing strategically", "coveragePct": 90, "suppressed": false } ] }'],
    ['GET', '/api/admin/audit', 'Audit trail, sensitive entries redacted unless platform administrator', 'Administrators', '[ { "id": "AUD-00001", "action": "Opened assessment round", "sensitive": false } ]']
  ];
  function sample(type) {
    var ent = { 'framework.published': 'FW-2', 'assessment.round.opened': 'CYC-001', 'assessment.submitted': 'ATT-003', 'assessor.review.submitted': 'REV-001', 'assessment.moderated': 'ATT-005', 'assessment.outcome.published': 'ATT-001', 'development.goal.created': 'GOAL-001', 'learning.enrolment.created': 'ENR-001', 'learning.completed': 'ENR-002', 'skill.evidence.updated': 'SELF-001' }[type];
    return JSON.stringify({ eventId: 'EVT-00001', eventType: type, entityId: ent, schemaVersion: '1.0', occurredAt: '2026-11-02T09:00:00Z', sourceSystem: 'people-capability-suite', correlationId: ent }, null, 2);
  }
  UI.route('/api', guard(function () {
    return UI.pageHead('API contracts', 'Illustrative and static. Permissions must be enforced in the back end for every route. ' + intBadge('simulated') + ' None of these endpoints is live.') +
      UI.panel('Endpoints', tbl(['Method', 'Path', 'Purpose', 'Access', 'Sample response or body'], API.map(function (a) { return [esc(a[0]), '<code>' + esc(a[1]) + '</code>', esc(a[2]), esc(a[3]), '<details class="govuk-details"><summary class="govuk-details__summary"><span class="govuk-details__summary-text">Sample</span></summary><div class="govuk-details__text">' + pre(a[4]) + '</div></details>']; }))) +
      UI.panel('Events', '<p class="govuk-body">Every event has an event ID, entity ID, schema version, timestamp, originating system and correlation ID. Confidential notes and candidate evidence are never published.</p>' +
        tbl(['Event type', 'Sample payload'], EVENT_TYPES.map(function (t) { return ['<code>' + esc(t) + '</code>', '<details class="govuk-details"><summary class="govuk-details__summary"><span class="govuk-details__summary-text">Sample</span></summary><div class="govuk-details__text">' + pre(sample(t)) + '</div></details>']; })));
  }), 'api');

  /* ---------- Audit ---------- */
  UI.route('/audit', guard(function (p, me) {
    var af = X().auditFilter, plat = me.persona === 'platform', q = (af.q || '').toLowerCase();
    var list = S().audit.filter(function (a) { return (!q || (a.actor + ' ' + a.action + ' ' + a.entity + ' ' + (plat || !a.sensitive ? a.detail : '')).toLowerCase().indexOf(q) > -1) && (!af.sens || (af.sens === 'sensitive' ? a.sensitive : !a.sensitive)); });
    return UI.pageHead('Audit trail', 'Administrative and sensitive actions. ' + (plat ? 'You can see sensitive detail.' : 'Detail of sensitive entries is redacted: only platform administrators can see it.')) +
      '<form id="audit-form" class="panel" style="display:flex;gap:16px;flex-wrap:wrap;align-items:end">' + UI.input('a-q', 'Search', af.q) + UI.select('a-sens', 'Sensitivity', [{ value: '', label: 'All entries' }, { value: 'sensitive', label: 'Sensitive only' }, { value: 'normal', label: 'Not sensitive' }], af.sens) + '<button class="govuk-button" data-module="govuk-button">Filter</button></form>' +
      '<p class="govuk-body">' + list.length + ' entries.</p>' +
      tbl(['When', 'Actor', 'Action', 'Entity', 'Detail', 'Sensitive'], list.slice(0, 100).map(function (a) { return [fmt(a.at), esc(a.actor), esc(a.action), esc(a.entity), a.sensitive && !plat ? '<em>Redacted (platform administrators only)</em>' : esc(a.detail), a.sensitive ? UI.tag('Sensitive', 'orange') : '']; }));
  }), 'audit');
  UI.on('submit', '#audit-form', function (e, form) { e.preventDefault(); var d = UI.formData(form); X().auditFilter = { q: d['a-q'], sens: d['a-sens'] }; PEO.save(); UI.render(); });

  /* ---------- Shared handlers ---------- */
  UI.on('change', '[data-persona]', function (e, el) { PEO.setMe(el.value); UI.render(); });
  UI.on('click', '[data-act="export"]', function () { exportPreview(); });

  X();
  UI.start();
})();
