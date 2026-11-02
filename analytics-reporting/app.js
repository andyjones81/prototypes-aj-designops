(function () {
  'use strict';
  var esc = UI.esc;
  var KEY = 'analytics-reporting';
  var NOTE = '<p class="govuk-body-s">All analytics connections in this prototype are simulated. No Google Analytics 4 or Matomo data is read.</p>';

  function st() { var d = ECO.get(); d.ext = d.ext || {}; return (d.ext[KEY] = d.ext[KEY] || { filters: { area: '', stage: '', type: '' }, evType: '', evSvc: '', tests: {} }); }
  function svcs() { return ECO.get().services; }
  function svcName(id) { var s = ECO.service(id); return s ? s.name : id; }
  function metrics() { return ECO.get().metrics || {}; }
  function sum(a) { return a.reduce(function (n, v) { return n + (v || 0); }, 0); }
  function avgOf(a) { var v = a.filter(function (x) { return x != null; }); return v.length ? v.reduce(function (n, x) { return n + x; }, 0) / v.length : null; }
  function pct(n) { return n == null ? '\u2013' : n.toFixed(1) + '%'; }
  function days(iso) { return (Date.now() - new Date(iso).getTime()) / ECO.DAY; }
  function ago(iso) { var d = days(iso); return d < 1 ? 'less than a day ago' : Math.floor(d) + ' day' + (Math.floor(d) === 1 ? '' : 's') + ' ago'; }
  function isGap(p) { return p.visits == null || p.completion == null || p.errorRate == null; }
  function gapWeeks(m) { return m.series.filter(isGap); }
  function statusTag(m) {
    if (!m || !m.connected) return UI.tag('Not connected', 'grey');
    if (m.status === 'failing') return UI.tag('Import failing', 'red');
    if (m.status === 'pending') return UI.tag('Awaiting first import', 'blue');
    if (days(m.lastImport) > 2) return UI.tag('Stale', 'amber');
    if (gapWeeks(m).length) return UI.tag('Data gaps', 'amber');
    return UI.tag('Healthy', 'green');
  }
  function issuesFor(s) {
    var m = metrics()[s.serviceId], out = [];
    if (!m || !m.connected) {
      var live = s.stage === 'Run' || s.status === 'Live';
      out.push({ s: s, check: 'Missing property', sev: live ? 'High' : 'Low', detail: live ? 'Live service with no analytics property connected.' : 'No analytics property connected yet. Connect one before the service goes live.', fix: '#/connectors' });
      return out;
    }
    if (m.status === 'failing') out.push({ s: s, check: 'Import failing', sev: 'High', detail: 'Last import failed. The authentication token for the ' + m.source + ' property may have expired.', fix: '#/connectors' });
    if (days(m.lastImport) > 2) out.push({ s: s, check: 'Stale import', sev: 'Medium', detail: 'No successful import for ' + ago(m.lastImport) + '. Figures are out of date.', fix: '#/connectors' });
    var g = gapWeeks(m);
    if (g.length) out.push({ s: s, check: 'Data gap', sev: 'Medium', detail: g.length + ' week' + (g.length === 1 ? '' : 's') + ' with missing values (week starting ' + UI.fmtDate(g[0].weekStart) + '). Trends are incomplete.', fix: '#/service/' + s.serviceId });
    if (m.series.length) out.push({ s: s, check: 'Consent mode', sev: 'Info', detail: 'Consent mode status cannot be checked in this prototype. Figures may exclude users who decline analytics cookies.', fix: '#/metrics' });
    return out;
  }
  function allIssues() { var o = []; svcs().forEach(function (s) { o = o.concat(issuesFor(s)); }); return o; }
  function sevTag(v) { return UI.tag(v, { High: 'red', Medium: 'amber', Low: 'blue', Info: 'grey' }[v]); }
  function last4(m) { return m ? m.series.slice(-4) : []; }
  function filterSel(id, text, list, cur) { return UI.select(id, text, [{ value: '', label: 'All' }].concat(list.map(function (x) { return { value: x, label: x }; })), cur); }
  function unique(f) { var o = []; svcs().forEach(function (s) { if (o.indexOf(s[f]) < 0) o.push(s[f]); }); return o.sort(); }
  function sub(t) { return '<br><span class="govuk-hint govuk-!-margin-0">' + esc(t) + '</span>'; }

  /* ---- Portfolio ---- */
  UI.route('/', function () {
    var f = st().filters, ms = metrics();
    var list = svcs().filter(function (s) { return (!f.area || s.area === f.area) && (!f.stage || s.stage === f.stage) && (!f.type || s.type === f.type); });
    var connected = list.filter(function (s) { return ms[s.serviceId] && ms[s.serviceId].connected; });
    var issues = allIssues().filter(function (i) { return i.sev !== 'Info' && list.indexOf(i.s) > -1; });
    var visits = sum(connected.map(function (s) { return sum(last4(ms[s.serviceId]).map(function (p) { return p.visits; })); }));
    var rows = list.map(function (s) {
      var m = ms[s.serviceId], c = m && m.connected && m.series.length, l4 = c ? last4(m) : [];
      return [UI.link('#/service/' + s.serviceId, s.name) + sub(s.serviceId + ' \u00b7 ' + s.area + ' \u00b7 ' + s.stage + ' \u00b7 ' + s.type),
        c ? UI.num(sum(l4.map(function (p) { return p.visits; }))) : '\u2013', c ? pct(avgOf(l4.map(function (p) { return p.completion; }))) : '\u2013', c ? pct(avgOf(l4.map(function (p) { return p.errorRate; }))) : '\u2013',
        c ? UI.sparkline(m.series.map(function (p) { return p.visits; })) : '', statusTag(m), m && m.connected ? UI.link('#/service/' + s.serviceId, 'View trends') : UI.link('#/connectors', 'Connect analytics')];
    });
    return UI.pageHead('Portfolio reporting', 'Service performance from connected analytics sources, harmonised to common metric definitions. ' + UI.intKind('simulated')) +
      '<form class="panel" id="pf-form" onsubmit="return false"><div style="display:flex;gap:16px;flex-wrap:wrap">' +
      filterSel('f-area', 'Area', unique('area'), f.area) + filterSel('f-stage', 'Stage', unique('stage'), f.stage) + filterSel('f-type', 'Type', unique('type'), f.type) + '</div></form>' +
      '<div class="stats">' + UI.stat('Services connected', connected.length + ' of ' + list.length) + UI.stat('Data quality issues', issues.length, UI.link('#/quality', 'View checks')) + UI.stat('Total visits, last 4 weeks', UI.num(visits)) + '</div>' +
      UI.table(['Service', 'Visits (4 weeks)', 'Completion', 'Error rate', 'Visits trend', 'Data status', 'Drill-through'], rows) + NOTE;
  }, 'portfolio');
  UI.on('change', '#pf-form select', function (e, el) { st().filters[el.id.replace('f-', '')] = el.value; ECO.save(); UI.render(); });

  /* ---- Service ---- */
  UI.route('/service/:id', function (p) {
    var s = ECO.service(p.id); if (!s) return UI.pageHead('Service not found') + '<p class="govuk-body">' + UI.link('#/', 'Back to portfolio') + '</p>';
    var m = metrics()[s.serviceId], h = UI.pageHead(s.name, esc(s.serviceId) + ' \u00b7 ' + esc(s.area) + ' \u00b7 ' + esc(s.stage), UI.link('../enabling-services/#/services/' + s.serviceId, 'Open in enabling services'));
    if (!m || !m.connected) return h + UI.callout('warning', 'No analytics connected.', 'There is nothing to report for this service. ' + UI.link('#/connectors', 'Connect analytics') + '.');
    var body = h + '<p class="govuk-body">' + statusTag(m) + ' ' + UI.intKind('simulated') + ' Source ' + esc(m.source) + ', property ' + esc(m.property) + ', last import ' + UI.fmtTime(m.lastImport) + '. ' + UI.link('#/connectors', 'Manage connector') + '</p>';
    if (m.status === 'failing') body += UI.callout('error', 'Import failing.', 'Figures are out of date; the last successful import was ' + ago(m.lastImport) + '.');
    if (!m.series.length) return body + UI.callout('info', 'Awaiting first import.', 'No data has been imported yet. ' + UI.link('#/connectors', 'Retry import') + '.');
    var labels = m.series.map(function (x) { return UI.fmtDate(x.weekStart).replace(/ 20\d\d$/, ''); });
    var cur = m.series.slice(-4), prev = m.series.slice(-8, -4);
    function vals(arr, k) { return arr.map(function (x) { return x[k]; }).filter(function (v) { return v != null; }); }
    function agg(arr, k, total) { var v = vals(arr, k); return v.length ? (total ? sum(v) : avgOf(v)) : null; }
    function kpi(label, k, o) {
      var c = agg(cur, k, o.total), pv = agg(prev, k, o.total), d = c != null && pv ? (c - pv) / pv * 100 : null, good = d == null || Math.abs(d) < 0.5 ? '' : ((d > 0) === !o.lowerBetter ? 'kpi--good' : 'kpi--bad');
      return '<div class="kpi ' + good + '"><dt>' + label + '</dt><dd class="kpi__v">' + (c == null ? '\u2013' : o.fmt(c)) + '</dd><dd class="kpi__d">' + (d == null ? 'No comparison' : (d > 0 ? '\u25b2 ' : d < 0 ? '\u25bc ' : '') + Math.abs(d).toFixed(1) + '% vs previous 4 weeks') + '</dd>' +
        '<dd>' + UI.sparkline(m.series.map(function (x) { return x[k]; })) + '</dd></div>';
    }
    var kpis = '<dl class="kpis">' + kpi('Visits, last 4 weeks', 'visits', { total: true, fmt: UI.num }) + kpi('Completion rate', 'completion', { fmt: pct }) + kpi('Error rate', 'errorRate', { fmt: pct, lowerBetter: true }) +
      kpi('Average time', 'avgSeconds', { fmt: function (v) { return Math.round(v) + 's'; }, lowerBetter: true }) + '</dl>';
    var gaps = gapWeeks(m);
    if (gaps.length) body += UI.callout('warning', 'Data gaps.', 'Missing values for week' + (gaps.length === 1 ? '' : 's') + ' starting ' + gaps.map(function (g) { return UI.fmtDate(g.weekStart); }).join(', ') + '. Gaps are shown as breaks in the lines and are not counted as zero.');
    function chart(title, key, extra) { return '<div class="chartbox"><h3 class="govuk-heading-s">' + title + '</h3>' + UI.lineChart([{ name: title, values: m.series.map(function (x) { return x[key]; }) }], labels, extra || { title: title, w: 360, h: 190 }) + '</div>'; }
    var charts = '<div class="chart-grid">' + chart('Visits per week', 'visits') + chart('Completion rate (%)', 'completion', { title: 'Completion rate', min: 0, max: 100, w: 360, h: 190 }) + chart('Error rate (%)', 'errorRate') + chart('Average time (seconds)', 'avgSeconds') + '</div>';
    var iss = issuesFor(s).filter(function (i) { return i.sev !== 'Info'; });
    var side = '<aside class="detail-side"><h2 class="govuk-heading-s">Data quality</h2>' + (iss.length ? '<ul class="timeline">' + iss.map(function (i) { return '<li>' + sevTag(i.sev) + ' <strong>' + esc(i.check) + '</strong><br><span class="muted">' + esc(i.detail) + '</span></li>'; }).join('') + '</ul>' : '<p class="govuk-body-s muted">No data quality issues found.</p>') +
      '<h2 class="govuk-heading-s govuk-!-margin-top-6">Annotations</h2>' + (m.annotations.length ? '<ul class="timeline">' + m.annotations.map(function (a) { return '<li><span class="muted">' + UI.fmtDate(a.at) + '</span><br>' + esc(a.text) + '</li>'; }).join('') + '</ul>' : '<p class="govuk-body-s muted">No annotations.</p>') +
      '<h2 class="govuk-heading-s govuk-!-margin-top-6">Source</h2><dl class="kv"><dt>System</dt><dd>' + esc(m.source) + '</dd><dt>Property</dt><dd>' + esc(m.property) + '</dd><dt>Last import</dt><dd>' + UI.fmtTime(m.lastImport) + '</dd></dl></aside>';
    body = h + '<p class="govuk-body-s">' + statusTag(m) + ' ' + UI.intKind('simulated') + ' ' + UI.link('#/connectors', 'Manage connector') + '</p>' + (m.status === 'failing' ? UI.callout('error', 'Import failing.', 'Figures are out of date; the last successful import was ' + ago(m.lastImport) + '.') : '') + kpis + gapsBox(gaps) +
      '<div class="detail-grid"><div class="detail-main">' + charts + '</div>' + side + '</div>' +
      '<h2 class="govuk-heading-m govuk-!-margin-top-6">Weekly values</h2>' + UI.table(['Week starting', 'Visits', 'Completion', 'Error rate', 'Average time (seconds)'], m.series.slice().reverse().map(function (x) {
        return [UI.fmtDate(x.weekStart), x.visits == null ? UI.tag('No data', 'red') : UI.num(x.visits), x.completion == null ? UI.tag('No data', 'red') : pct(x.completion), x.errorRate == null ? UI.tag('No data', 'red') : pct(x.errorRate), UI.num(x.avgSeconds)];
      }));
    function gapsBox(g) { return g.length ? UI.callout('warning', 'Data gaps.', 'Missing values for week' + (g.length === 1 ? '' : 's') + ' starting ' + g.map(function (x) { return UI.fmtDate(x.weekStart); }).join(', ') + '. Gaps are shown as breaks in the lines and are not counted as zero.') : ''; }
    return body + NOTE;
  }, 'portfolio');

  /* ---- Connectors ---- */
  function logInt(text, level, recompute) {
    var i = ECO.get().integrations.filter(function (x) { return x.name === 'Central analytics'; })[0]; if (!i) return;
    i.log = i.log || []; i.log.unshift({ at: new Date().toISOString(), level: level, text: text });
    if (recompute) {
      var anyFail = Object.keys(metrics()).some(function (k) { return metrics()[k].status === 'failing'; });
      i.status = anyFail ? 'failing' : 'healthy';
      if (!anyFail) { i.lastSync = new Date().toISOString(); i.queue = 0; i.note = 'All analytics properties importing'; }
    }
  }
  function simSeries() {
    var out = [], base = 4000 + Math.round(Math.random() * 2000);
    for (var w = 3; w >= 0; w--) out.push({ weekStart: ECO.ago(w * 7 + 6), visits: Math.round(base * (0.9 + Math.random() * 0.2)), completion: Math.round((65 + Math.random() * 15) * 10) / 10, errorRate: Math.round((0.5 + Math.random()) * 10) / 10, avgSeconds: Math.round(160 + Math.random() * 100) });
    return out;
  }
  function validProp(src, v) { return src === 'GA4' ? /^G-[A-Z0-9]{6,12}$/.test(v) : /^MTM-\d{1,6}$/.test(v); }
  function connectForm(vals, errs) {
    vals = vals || {}; errs = errs || {};
    var elig = svcs().filter(function (s) { var m = metrics()[s.serviceId]; return !(m && m.connected); });
    if (!elig.length) return '<section class="panel" id="connect-panel"><h2 class="govuk-heading-s">Connect analytics</h2><p class="govuk-body">Every service already has analytics connected.</p></section>';
    return '<section class="panel" id="connect-panel"><h2 class="govuk-heading-s">Connect analytics</h2>' + (errs.list ? UI.errorSummary(errs.list) : '') +
      '<p class="govuk-body-s">Confirm an existing property or stream identifier. Nothing is created in the analytics product. ' + UI.intKind('simulated') + '</p>' +
      '<form id="connect-form" novalidate>' + UI.select('c-service', 'Service', elig.map(function (s) { return { value: s.serviceId, label: s.serviceId + ' \u2013 ' + s.name }; }), vals['c-service']) +
      UI.select('c-source', 'Source', [{ value: 'GA4', label: 'Google Analytics 4' }, { value: 'Matomo', label: 'Matomo' }], vals['c-source']) +
      UI.input('c-property', 'Property ID', vals['c-property'] || '', { hint: 'For example G-ABC123XYZ9 (GA4) or MTM-77 (Matomo)', err: errs.prop, cls: 'govuk-input--width-10' }) +
      '<button type="submit" class="govuk-button" data-module="govuk-button">Connect analytics</button></form></section>';
  }
  UI.route('/connectors', function () {
    var ms = metrics(), rows = Object.keys(ms).filter(function (k) { return ms[k].connected; }).map(function (k) {
      var m = ms[k], t = st().tests[k];
      return [UI.link('#/service/' + k, svcName(k)) + sub(k), esc(m.property), esc(m.source), statusTag(m) + (t ? sub(t) : ''), UI.fmtTime(m.lastImport) + sub(ago(m.lastImport)),
        UI.button('Test connection', 'data-test="' + k + '"', 'govuk-button--secondary govuk-!-margin-bottom-1') + ' ' + UI.button('Retry import', 'data-retry="' + k + '"', 'govuk-button--secondary govuk-!-margin-bottom-1')];
    });
    return UI.pageHead('Connectors', 'Analytics connector setup per service. ' + UI.intKind('simulated') + ' Test and retry actions are simulated and write to the integration log and event feed.') +
      UI.table(['Service', 'Property ID', 'Source', 'Status', 'Last import', 'Actions'], rows) + connectForm();
  }, 'connectors');
  UI.on('click', '[data-test]', function (e, el) {
    var k = el.getAttribute('data-test'), m = metrics()[k], ok = m.status !== 'failing';
    st().tests[k] = (ok ? 'Test passed' : 'Test failed: authentication token expired') + ' at ' + UI.fmtTime(new Date().toISOString());
    logInt('Test connection for ' + k + ' (' + m.property + '): ' + (ok ? 'passed' : 'failed, authentication token expired'), ok ? 'info' : 'error');
    ECO.save(); UI.render(); UI.flash(ok ? 'Connection test passed for ' + esc(svcName(k)) + ' (simulated).' : 'Connection test failed for ' + esc(svcName(k)) + ': authentication token expired (simulated).', ok ? 'success' : 'error');
  });
  UI.on('click', '[data-retry]', function (e, el) {
    var k = el.getAttribute('data-retry'), m = metrics()[k], s = ECO.service(k), was = m.status;
    m.status = 'healthy'; m.lastImport = new Date().toISOString();
    if (!m.series.length) m.series = simSeries();
    delete st().tests[k];
    logInt('Retry import for ' + k + ' (' + m.property + '): succeeded' + (was === 'failing' ? ', connector recovered' : ''), 'info', true);
    ECO.event('connector.retry', s, { sourceSystem: 'central-analytics', enablingServiceId: 'analytics', status: 'healthy', detail: 'Import retry succeeded for ' + m.source + ' property ' + m.property + ' (simulated); previous status ' + was + '.' });
    ECO.audit('Service team', 'Retried analytics import', k); ECO.save(); UI.render(); UI.flash('Import retried for ' + esc(svcName(k)) + ': connector is now healthy (simulated).');
  });
  UI.on('submit', '#connect-form', function (e, form) {
    e.preventDefault(); var v = UI.formData(form), prop = (v['c-property'] || '').trim(), src = v['c-source'], errs = {};
    if (!prop) errs.prop = 'Enter a property ID'; else if (!validProp(src, prop)) errs.prop = src === 'GA4' ? 'Enter a GA4 measurement ID in the format G-ABC123XYZ9' : 'Enter a Matomo site ID in the format MTM-77';
    if (errs.prop) { errs.list = [{ id: 'c-property', msg: errs.prop }]; v['c-property'] = prop; document.getElementById('connect-panel').outerHTML = connectForm(v, errs); return; }
    var s = ECO.service(v['c-service']);
    metrics()[s.serviceId] = { connected: true, source: src, property: prop, lastImport: new Date().toISOString(), status: 'pending', series: [], annotations: [] };
    logInt('Connected ' + src + ' property ' + prop + ' to ' + s.serviceId + '; awaiting first import', 'info');
    ECO.event('connector.connected', s, { sourceSystem: 'central-analytics', enablingServiceId: 'analytics', status: 'pending', detail: src + ' property ' + prop + ' confirmed (simulated).' });
    ECO.save(); UI.render(); UI.flash('Analytics connected for ' + esc(s.name) + ' (simulated). Use Retry import to run the first import.');
  });

  /* ---- Quality ---- */
  UI.route('/quality', function () {
    var is = allIssues(), order = { High: 0, Medium: 1, Low: 2, Info: 3 };
    is.sort(function (a, b) { return order[a.sev] - order[b.sev]; });
    return UI.pageHead('Data quality', 'Checks on imports, completeness and measurement across all services.') +
      '<div class="stats">' + ['High', 'Medium', 'Low', 'Info'].map(function (s) { return UI.stat(s, is.filter(function (i) { return i.sev === s; }).length); }).join('') + '</div>' +
      UI.table(['Service', 'Check', 'Severity', 'Detail', 'Action'], is.map(function (i) { return [UI.link('#/service/' + i.s.serviceId, i.s.name), esc(i.check), sevTag(i.sev), esc(i.detail), UI.link(i.fix, 'Review')]; })) + NOTE;
  }, 'quality');

  /* ---- Events ---- */
  UI.route('/events', function () {
    var s = st(), evs = ECO.get().events, types = [], sv = [];
    evs.forEach(function (e) { if (types.indexOf(e.eventType) < 0) types.push(e.eventType); if (e.serviceId && sv.indexOf(e.serviceId) < 0) sv.push(e.serviceId); });
    var all = evs.filter(function (e) { return (!s.evType || e.eventType === s.evType) && (!s.evSvc || e.serviceId === s.evSvc); }), list = all.slice(0, 100);
    return UI.pageHead('Events', 'The common reporting contract event feed. Every enabling service publishes events in the same shape. ' + UI.intKind('simulated')) +
      '<form class="panel" id="ev-form" onsubmit="return false"><div style="display:flex;gap:16px;flex-wrap:wrap">' + UI.select('e-type', 'Event type', [{ value: '', label: 'All' }].concat(types.sort().map(function (t) { return { value: t, label: t }; })), s.evType) +
      UI.select('e-svc', 'Service', [{ value: '', label: 'All' }].concat(sv.sort().map(function (x) { return { value: x, label: x + ' \u2013 ' + svcName(x) }; })), s.evSvc) + '</div></form>' +
      '<p class="govuk-body-s">Showing ' + list.length + ' of ' + all.length + ' matching events (latest first).</p>' +
      UI.table(['Time', 'Event type', 'Service', 'Source system', 'Status', 'Detail', ''], list.map(function (e) {
        return [UI.fmtTime(e.occurredAt), '<code>' + esc(e.eventType) + '</code>', e.serviceId ? esc(e.serviceId) : '\u2013', esc(e.sourceSystem), esc(e.status || '\u2013'), esc(e.detail), UI.button('View JSON', 'data-json="' + esc(e.eventId) + '"', 'govuk-button--secondary govuk-!-margin-bottom-0')];
      }));
  }, 'events');
  UI.on('change', '#ev-form select', function (e, el) { st()[el.id === 'e-type' ? 'evType' : 'evSvc'] = el.value; ECO.save(); UI.render(); });
  UI.on('click', '[data-json]', function (e, el) {
    var ev = ECO.get().events.filter(function (x) { return x.eventId === el.getAttribute('data-json'); })[0]; if (!ev) return;
    var c = { eventId: ev.eventId, eventType: ev.eventType, occurredAt: ev.occurredAt, sourceSystem: ev.sourceSystem, serviceId: ev.serviceId, productId: ev.productId, workId: ev.workId, enablingServiceId: ev.enablingServiceId, status: ev.status, ruleId: ev.ruleId, ruleVersion: ev.ruleVersion, recordUrl: ev.recordUrl, detail: ev.detail };
    UI.modal('Event ' + ev.eventId, '<p class="govuk-body-s">Reporting contract fields for this event.</p><pre class="govuk-body-s" style="overflow:auto;background:#f3f2f1;padding:10px">' + esc(JSON.stringify(c, null, 2)) + '</pre>');
  });

  /* ---- Metric definitions ---- */
  var DEFS = [
    ['Visits', 'Count of sessions that started on a service page in the period, excluding known bots and internal traffic.', 'Sessions per week', 'GA4 counts sessions with engagement events; Matomo counts visits. Totals differ by a few per cent.'],
    ['Unique users', 'Distinct users with at least one session in the period.', 'Users per week', 'Only meaningful for services with sign-in. Cookie-based identifiers overstate users on shared devices.'],
    ['Completion rate', 'Completed transactions divided by started transactions, where a completion is a view of the confirmation page.', 'Percentage', 'Depends on each service defining its start and confirmation events consistently. Not comparable for information services.'],
    ['Error rate', 'Sessions that showed an error page or validation error divided by all sessions.', 'Percentage', 'GA4 and Matomo classify validation errors differently, so compare within a source where possible.'],
    ['Average time to complete', 'Mean time between the first start event and the confirmation event, for completed journeys only.', 'Seconds', 'Sessions that time out are excluded. GA4 caps session length at 30 minutes by default.'],
    ['Uptime', 'Proportion of minutes in the period when the service passed its availability check.', 'Percentage', 'Comes from monitoring, not analytics. Not part of the simulated import.'],
    ['Engagement', 'Share of sessions with more than one page view or an interaction event.', 'Percentage', 'GA4 engaged sessions and Matomo non-bounce visits use different thresholds.']
  ];
  UI.route('/metrics', function () {
    return UI.pageHead('Metric definitions', 'Canonical definitions used when figures from different analytics products are shown side by side.') +
      UI.callout('warning', 'Sources differ.', 'GA4 and Matomo measure in different ways, and consent mode affects both. Treat cross-service comparisons as indicative. The source on each connector records where a figure came from.') +
      UI.table(['Metric', 'Definition', 'Unit', 'Caveat'], DEFS.map(function (d) { return ['<strong>' + esc(d[0]) + '</strong>', esc(d[1]), esc(d[2]), esc(d[3])]; }));
  }, 'metrics');

  UI.start();
})();
