/* Feedback and satisfaction prototype (Journey C). Prototype-only state lives in ECO.get().ext['feedback-satisfaction']. */
(function () {
  'use strict';
  var U = window.UI, esc = U.esc, KEY = 'feedback-satisfaction', DAY = 86400000, WEEKS = 8;
  var ACTIONS_URL = '../rules-engine/#/actions';
  var f = { fbSvc: '', satSvc: '', satJny: '', widget: { svc: '', page: '', comment: '' }, survey: { svc: '', jny: '', comment: '' }, inv: { svc: '', jny: '' } };

  function db() { return ECO.get(); }
  function ext() { var e = db().ext; return e[KEY] || (e[KEY] = {}); }
  function svcName(id) { var s = ECO.service(id); return s ? s.name : id; }
  function jnyName(sid, jid) { var s = ECO.service(sid), j = s && s.journeys.filter(function (x) { return x.id === jid; })[0]; return j ? j.name : '\u2013'; }
  function transactional() { return db().services.filter(function (s) { return s.journeys.some(function (j) { return j.transactional; }); }); }
  function svcOptions(list, all) { var o = all ? [{ value: '', label: 'All services' }] : []; return o.concat(list.map(function (s) { return { value: s.serviceId, label: s.serviceId + ' ' + s.name }; })); }
  function tJourneys(sid) { var s = ECO.service(sid); return s ? s.journeys.filter(function (j) { return j.transactional; }) : []; }
  function pct(n, d) { return d ? Math.round(100 * n / d) : null; }
  function mean(list) { return list.length ? list.reduce(function (n, r) { return n + r.score; }, 0) / list.length : null; }
  function weekIdx(iso) { return Math.floor((Date.now() - Date.parse(iso)) / (7 * DAY)); }
  function weekLabels() { var l = []; for (var w = WEEKS - 1; w >= 0; w--) l.push(new Date(Date.now() - w * 7 * DAY).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })); return l; }
  function weekly(items, fn) { var out = []; for (var w = WEEKS - 1; w >= 0; w--) out.push(fn(items.filter(function (r) { return weekIdx(r.at) === w; }))); return out; }
  function statusTag(s) { return U.tag(s, { 'new': 'red', investigating: 'blue', closed: 'green' }[s]); }
  function sim() { return ' ' + U.intKind('simulated'); }
  function defaultSvc(cur, list) { return cur && list.some(function (s) { return s.serviceId === cur; }) ? cur : (list[0] ? list[0].serviceId : ''); }
  function showErrors(boxId, errs) {
    document.getElementById(boxId).innerHTML = U.errorSummary(errs);
    errs.forEach(function (x) {
      var el = document.getElementById(x.id), g = el && el.closest('.govuk-form-group');
      if (g) { g.classList.add('govuk-form-group--error'); if (!g.querySelector('.govuk-error-message')) g.insertAdjacentHTML('afterbegin', '<p class="govuk-error-message"><span class="govuk-visually-hidden">Error:</span> ' + esc(x.msg) + '</p>'); }
    });
  }

  function makeAction(o) {
    var svc = ECO.service(o.serviceId), now = new Date().toISOString(), a = {
      id: ECO.uid('ACT'), serviceId: svc.serviceId, workId: svc.workId, enablingId: o.enablingId, ruleId: null, type: 'action', source: o.source, feedbackId: o.feedbackId,
      title: o.title, description: o.description, owner: svc.owner, due: ECO.ahead(21), status: 'Not started', created: now, evidence: [],
      updates: [{ at: now, type: 'system', text: o.update }], manual: false
    };
    db().actions.push(a); ECO.event('action.created', svc, { enablingServiceId: a.enablingId, detail: a.title, recordUrl: ACTIONS_URL });
    return a;
  }

  /* ---------- Signals (start page) ---------- */
  function signalsPage() {
    var e = ext(), notice = e.notice || ''; e.notice = '';
    var sigs = db().signals, opts = [];
    transactional().forEach(function (s) { tJourneys(s.serviceId).forEach(function (j) { opts.push({ value: s.serviceId + '|' + j.id, label: s.serviceId + ' ' + s.name + ' \u2013 ' + j.name }); }); });
    var f = e.sigFilter || 'open';
    function count(st) { return sigs.filter(function (x) { return st === 'all' || (st === 'open' ? x.status === 'open' : x.status !== 'open'); }).length; }
    var shown = sigs.filter(function (x) { return f === 'all' || (f === 'open' ? x.status === 'open' : x.status !== 'open'); });
    var summary = '<dl class="sumstrip">' + [['Open signals', count('open')], ['Resolved', count('resolved')], ['All signals', count('all')]].map(function (r) { return '<div><dt>' + r[0] + '</dt><dd class="sumstrip__big">' + r[1] + '</dd></div>'; }).join('') + '</dl>';
    var tabs = '<div class="seg govuk-!-margin-bottom-3" role="group" aria-label="Filter signals">' + [['open', 'Open'], ['resolved', 'Resolved'], ['all', 'All']].map(function (t) {
      return '<button type="button" class="seg__btn' + (f === t[0] ? ' is-on' : '') + '" data-sigfilter="' + t[0] + '" aria-pressed="' + (f === t[0]) + '">' + t[1] + ' (' + count(t[0]) + ')</button>'; }).join('') + '</div>';
    var list = shown.length ? '<ul class="elist">' + shown.map(function (s) {
      var act = s.actionId ? db().actions.filter(function (a) { return a.id === s.actionId; })[0] : null;
      var ctl = s.status === 'open'
        ? ['risk', 'issue', 'improvement'].map(function (k) { return '<button type="button" class="govuk-button govuk-button--secondary govuk-button--small" data-confirm="' + s.id + '" data-kind="' + k + '">Confirm as ' + k + '</button>'; }).join('') +
          '<button type="button" class="govuk-button govuk-button--warning govuk-button--small" data-dismiss="' + s.id + '">Dismiss</button>'
        : (act ? '<span class="govuk-body-s">Action ' + U.link(ACTIONS_URL, act.id) + ' (' + esc(act.type) + ')</span>' : '');
      var jn = s.journeyId ? ' \u00b7 ' + esc(jnyName(s.serviceId, s.journeyId)) : '';
      return '<li class="elist__row sig"><div class="elist__main"><div class="elist__title"><strong>' + esc(svcName(s.serviceId)) + '</strong>' + jn + ' ' + U.tag(s.status) + ' ' + U.tag(s.kind === 'satisfaction' ? 'Satisfaction' : 'Page feedback', 'grey') + '</div>' +
        '<p class="sig__detail">' + esc(s.detail) + '</p><div class="elist__meta"><span class="muted">' + esc(s.id) + ' \u00b7 Raised ' + U.fmtDate(s.at) + '</span></div>' +
        (ctl ? '<div class="sig__actions">' + ctl + '</div>' : '') + '</div></li>';
    }).join('') + '</ul>' : '<p class="govuk-body-s muted">No ' + (f === 'all' ? '' : f + ' ') + 'signals.</p>';
    var steps = '<ol class="steps"><li><strong>Collect</strong> Page feedback and satisfaction scores' + sim() + '</li><li><strong>Compare</strong> The last 7 days against the previous 28</li><li><strong>Signal</strong> A drop raises a signal and sends an event to COMPASS' + sim() + '</li><li><strong>Confirm</strong> The owner confirms a risk, issue or improvement, creating a linked action</li></ol>';
    return U.pageHead('Signals', 'Signals are raised when satisfaction or page usefulness falls. A person confirms a signal before it becomes an action.') + notice + summary +
      '<div class="detail-grid"><div class="detail-main">' + tabs + list + '</div><aside class="detail-side">' +
      '<h2 class="govuk-heading-s">Simulate falling satisfaction</h2><form id="sim-form" novalidate><p class="govuk-body-s">Adds a burst of low scores and negative page feedback for fictional users, then runs signal detection.</p>' +
      U.select('sim-target', 'Service and journey', opts, e.simTarget || (opts[0] && opts[0].value)) +
      '<button type="submit" class="govuk-button" data-module="govuk-button">Simulate</button></form>' + (e.lastSim ? '<div class="callout callout--ok" role="status">' + e.lastSim + '</div>' : '') +
      '<h2 class="govuk-heading-s govuk-!-margin-top-6">How signals work</h2>' + steps + '</aside></div>';
  }
  U.on('click', '[data-sigfilter]', function (ev, el) { ext().sigFilter = el.getAttribute('data-sigfilter'); U.go('#/'); });
  U.on('submit', '#sim-form', function (ev, form) {
    ev.preventDefault();
    var e = ext(), v = U.formData(form)['sim-target'].split('|'), made = ECO.simulateDecline(v[0], v[1]);
    e.simTarget = v.join('|');
    e.lastSim = made.length ? '<strong>' + made.length + ' new signal' + (made.length > 1 ? 's' : '') + ' raised</strong> for ' + esc(svcName(v[0])) + ': ' + made.map(function (s) { return esc(s.id) + ' (' + esc(s.detail) + ')'; }).join(' ') : 'No new signal raised. An open signal may already exist for this service and journey.';
    ECO.save(); U.go('#/');
  });
  U.on('click', '[data-confirm]', function (ev, el) {
    var a = ECO.confirmSignal(el.getAttribute('data-confirm'), el.getAttribute('data-kind'), 'Priya Nair');
    if (a) ext().notice = '<div class="callout callout--ok" role="status"><strong>Signal confirmed.</strong> Created ' + esc(a.type) + ' ' + U.link(ACTIONS_URL, a.id) + ': ' + esc(a.title) + '. It is linked to the signal and appears in the work record' + sim() + '.</div>';
    ECO.save(); U.go('#/');
  });
  U.on('click', '[data-dismiss]', function (ev, el) {
    var s = db().signals.filter(function (x) { return x.id === el.getAttribute('data-dismiss'); })[0];
    if (s) { s.status = 'dismissed'; ext().notice = '<div class="callout" role="status">Signal ' + esc(s.id) + ' dismissed. No action was created.</div>'; }
    ECO.save(); U.go('#/');
  });

  /* ---------- Feedback dashboard ---------- */
  function feedbackPage() {
    var all = db().feedback.filter(function (r) { return !f.fbSvc || r.serviceId === f.fbSvc; });
    var useful = all.filter(function (r) { return r.useful; }).length;
    var trend = weekly(all, function (l) { return pct(l.filter(function (r) { return r.useful; }).length, l.length); });
    var themes = {};
    all.forEach(function (r) { var t = themes[r.theme || 'Other'] || (themes[r.theme || 'Other'] = { n: 0, bad: 0 }); t.n++; if (!r.useful) t.bad++; });
    var themeRows = Object.keys(themes).sort(function (a, b) { return themes[b].bad - themes[a].bad; }).map(function (k) { var p = pct(themes[k].bad, themes[k].n); return [esc(k), U.num(themes[k].n), U.num(themes[k].bad), U.bar(p, p + '% not useful') + p + '%']; });
    var recent = all.filter(function (r) { return r.comment; }).sort(function (a, b) { return Date.parse(b.at) - Date.parse(a.at); }).slice(0, 15);
    var btn = function (attrs, text) { return '<button type="button" class="govuk-button govuk-button--secondary govuk-button--small" ' + attrs + '>' + text + '</button>'; };
    var rrows = recent.map(function (r) {
      var act = r.actionId ? db().actions.filter(function (a) { return a.id === r.actionId; })[0] : null;
      return [U.fmtDate(r.at), esc(svcName(r.serviceId)) + '<br><span class="govuk-hint">' + esc(r.page) + '</span>', r.useful ? 'Yes' : 'No', esc(r.comment), statusTag(r.status),
        (act ? U.link(ACTIONS_URL, act.id) : btn('data-fb-action="' + r.id + '"', 'Create action')) +
          (r.status === 'new' ? ' ' + btn('data-fb-status="' + r.id + '" data-to="investigating"', 'Investigate') : r.status === 'investigating' ? ' ' + btn('data-fb-status="' + r.id + '" data-to="closed"', 'Close') : '')];
    });
    var n = ext().notice || ''; ext().notice = '';
    return U.pageHead('Page feedback', 'Answers to "Was this page useful?" across digital pages' + sim() + '.') + n +
      '<form class="toolbar" onsubmit="return false">' + U.select('fb-svc', 'Service', svcOptions(db().services, true), f.fbSvc) + '</form>' +
      '<div class="stats">' + U.stat('Responses', U.num(all.length)) + U.stat('Found page useful', (pct(useful, all.length) == null ? '\u2013' : pct(useful, all.length) + '%')) +
      U.stat('New comments', U.num(all.filter(function (r) { return r.comment && r.status === 'new'; }).length)) + U.stat('Weekly trend', U.sparkline(trend), 'Last ' + WEEKS + ' weeks') + '</div>' +
      '<div class="two-col"><div>' + U.panel('Useful responses by week (%)', U.lineChart([{ name: 'Useful %', values: trend }], weekLabels(), { min: 0, max: 100, title: 'Percentage of useful responses by week' })) +
      U.panel('Recent comments', U.table(['Date', 'Service and page', 'Useful', 'Comment', 'Status', 'Action'], rrows)) + '</div><div>' +
      U.panel('Themes', U.table(['Theme', 'Responses', 'Not useful', 'Share not useful'], themeRows)) + '</div></div>';
  }
  U.on('change', '#fb-svc', function (e, el) { f.fbSvc = el.value; U.go('#/feedback'); });
  U.on('click', '[data-fb-action]', function (e, el) {
    var r = db().feedback.filter(function (x) { return x.id === el.getAttribute('data-fb-action'); })[0]; if (!r) return;
    var a = makeAction({ serviceId: r.serviceId, enablingId: 'user-feedback', source: 'feedback', feedbackId: r.id, title: 'Respond to feedback: ' + (r.theme || 'page feedback') + ' on ' + r.page,
      description: 'User comment: "' + r.comment + '" (' + r.id + ')', update: 'Created from feedback ' + r.id + '.' });
    r.actionId = a.id; if (r.status === 'new') r.status = 'investigating';
    ext().notice = '<div class="callout callout--ok" role="status">Created action ' + U.link(ACTIONS_URL, a.id) + ' linked to feedback ' + esc(r.id) + '.</div>';
    ECO.save(); U.go('#/feedback');
  });
  U.on('click', '[data-fb-status]', function (e, el) {
    var r = db().feedback.filter(function (x) { return x.id === el.getAttribute('data-fb-status'); })[0]; if (r) r.status = el.getAttribute('data-to');
    ECO.save(); U.go('#/feedback');
  });

  /* ---------- Widget preview ---------- */
  function widgetPage() {
    var e = ext(), w = f.widget, svcs = db().services, done = e.widgetDone; e.widgetDone = false;
    w.svc = w.svc || svcs[0].serviceId;
    var body = done ? U.callout('ok', 'Thank you for your feedback.', 'Your response has been added to the dashboard. Nothing is sent outside this prototype.') + '<p class="govuk-body"><a class="govuk-link" href="#/feedback/widget" data-widget-reset>Give more feedback</a></p>'
      : '<div id="widget-errors"></div><form id="widget-form" novalidate>' +
        U.radios('useful', 'Was this page useful?', [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }], '') +
        U.textarea('comment', 'Tell us more (optional)', w.comment, { hint: 'Do not include personal or financial information, such as your National Insurance number or contact details. Maximum 500 characters.' }) +
        '<button type="submit" class="govuk-button" data-module="govuk-button">Send feedback</button></form>';
    return U.pageHead('Widget preview', 'A working preview of the "Was this page useful?" widget as embedded in a digital page' + sim() + '.') +
      '<div class="two-col"><div>' + U.panel('Preview', body) + '</div><div>' + U.panel('Preview settings',
        '<form onsubmit="return false">' + U.select('w-svc', 'Embedding service', svcOptions(svcs), w.svc) + U.input('w-page', 'Page path', w.page || '/start') + '</form>' +
        '<p class="govuk-body-s">Responses are stored in this browser and appear on the ' + U.link('#/feedback', 'feedback dashboard') + '. No personal data is collected.</p>') + '</div></div>';
  }
  U.on('change', '#w-svc', function (e, el) { f.widget.svc = el.value; });
  U.on('input', '#w-page', function (e, el) { f.widget.page = el.value; });
  U.on('click', '[data-widget-reset]', function (e) { e.preventDefault(); U.go('#/feedback/widget'); });
  U.on('submit', '#widget-form', function (ev, form) {
    ev.preventDefault();
    var v = U.formData(form), errs = [], comment = (v.comment || '').trim();
    if (!v.useful) errs.push({ id: 'useful-0', msg: 'Select yes or no' });
    if (comment.length > 500) errs.push({ id: 'comment', msg: 'Comment must be 500 characters or fewer' });
    if (errs.length) { f.widget.comment = v.comment; showErrors('widget-errors', errs); return; }
    var useful = v.useful === 'yes';
    db().feedback.push({ id: ECO.uid('FBK'), serviceId: f.widget.svc, page: f.widget.page || '/start', at: new Date().toISOString(), useful: useful, comment: comment, theme: useful && !comment ? 'Positive' : 'Other', status: useful ? 'closed' : 'new', actionId: null });
    f.widget.comment = ''; ext().widgetDone = true; ECO.save(); U.go('#/feedback/widget');
  });

  /* ---------- Satisfaction dashboard ---------- */
  function satisfactionPage() {
    var svcs = transactional();
    f.satSvc = f.satSvc && svcs.some(function (s) { return s.serviceId === f.satSvc; }) ? f.satSvc : '';
    var pairs = [];
    svcs.forEach(function (s) { if (f.satSvc && s.serviceId !== f.satSvc) return; tJourneys(s.serviceId).forEach(function (j) { if (!f.satJny || j.id === f.satJny) pairs.push({ s: s, j: j }); }); });
    var jopts = [{ value: '', label: 'All journeys' }];
    if (f.satSvc) tJourneys(f.satSvc).forEach(function (j) { jopts.push({ value: j.id, label: j.name }); });
    var all = [], per = pairs.map(function (p) { var rs = db().satisfaction.filter(function (r) { return r.serviceId === p.s.serviceId && r.journeyId === p.j.id; }); all = all.concat(rs); return rs; });
    var rows = pairs.map(function (p, i) {
      var rs = per[i];
      var dist = [5, 4, 3, 2, 1].map(function (n) { var c = rs.filter(function (r) { return r.score === n; }).length; return '<div class="row" style="gap:6px;align-items:center"><span class="govuk-body-s" style="margin:0;width:1.2em">' + n + '</span><div style="flex:1">' + U.bar(pct(c, rs.length), n + ' out of 5: ' + c + ' responses') + '</div><span class="govuk-body-s" style="margin:0;width:2.5em">' + c + '</span></div>'; }).join('');
      return [esc(p.s.name), esc(p.j.name), '<strong>' + (mean(rs) == null ? '\u2013' : mean(rs).toFixed(1)) + '</strong> / 5', U.num(rs.length), dist, U.sparkline(weekly(rs, mean), '#1d70b8')];
    });
    var series = pairs.length > 1 && pairs.length <= 4 ? pairs.map(function (p, i) { return { name: p.s.name + ' \u2013 ' + p.j.name, values: weekly(per[i], mean) }; }) : [{ name: 'Mean score', values: weekly(all, mean) }];
    var low = all.filter(function (r) { return r.score <= 2 && r.comment; }).sort(function (a, b) { return Date.parse(b.at) - Date.parse(a.at); }).slice(0, 12);
    var lrows = low.map(function (r) { return [U.fmtDate(r.at), esc(svcName(r.serviceId)) + '<br><span class="govuk-hint">' + esc(jnyName(r.serviceId, r.journeyId)) + '</span>', r.score + ' / 5', esc(r.channel), esc(r.comment)]; });
    return U.pageHead('Satisfaction', 'Scores from end-of-journey surveys for transactional services' + sim() + '.') +
      '<form class="toolbar" onsubmit="return false">' + U.select('sat-svc', 'Service', svcOptions(svcs, true), f.satSvc) + U.select('sat-jny', 'Journey', jopts, f.satJny) + '</form>' +
      '<div class="stats">' + U.stat('Mean score', mean(all) == null ? '\u2013' : mean(all).toFixed(1) + ' / 5') + U.stat('Responses', U.num(all.length)) + U.stat('Scored 1 or 2', U.num(all.filter(function (r) { return r.score <= 2; }).length)) + '</div>' +
      U.panel('Mean score by week', U.lineChart(series, weekLabels(), { min: 1, max: 5, title: 'Mean satisfaction score by week' })) +
      U.panel('By service and journey', U.table(['Service', 'Journey', 'Mean score', 'Responses', 'Distribution (score, count)', 'Trend'], rows)) +
      U.panel('Low-score comments', U.table(['Date', 'Service and journey', 'Score', 'Channel', 'Comment'], lrows));
  }
  U.on('change', '#sat-svc', function (e, el) { f.satSvc = el.value; f.satJny = ''; U.go('#/satisfaction'); });
  U.on('change', '#sat-jny', function (e, el) { f.satJny = el.value; U.go('#/satisfaction'); });

  /* ---------- Survey preview ---------- */
  function surveyPage() {
    var e = ext(), s = f.survey, svcs = transactional(), done = e.surveyDone; e.surveyDone = false;
    s.svc = defaultSvc(s.svc, svcs); var js = tJourneys(s.svc); s.jny = js.some(function (j) { return j.id === s.jny; }) ? s.jny : (js[0] ? js[0].id : '');
    var body = done ? U.callout('ok', 'Thank you for completing the survey.', 'Your response has been added to the satisfaction dashboard.') + '<p class="govuk-body"><a class="govuk-link" href="#/satisfaction/survey" data-survey-reset>Complete another survey</a></p>'
      : '<div id="survey-errors"></div><form id="survey-form" novalidate><h3 class="govuk-heading-s">' + esc(jnyName(s.svc, s.jny)) + ' \u2013 ' + esc(svcName(s.svc)) + '</h3>' +
        U.radios('score', 'Overall, how satisfied were you with this service?', [{ value: 5, label: '5 \u2013 Very satisfied' }, { value: 4, label: '4 \u2013 Satisfied' }, { value: 3, label: '3 \u2013 Neither satisfied nor dissatisfied' }, { value: 2, label: '2 \u2013 Dissatisfied' }, { value: 1, label: '1 \u2013 Very dissatisfied' }], '') +
        U.textarea('comment', 'How could we improve this service? (optional)', s.comment, { hint: 'Do not include personal or financial information. Maximum 500 characters.' }) +
        '<button type="submit" class="govuk-button" data-module="govuk-button">Submit survey</button></form>';
    return U.pageHead('Survey preview', 'A working preview of the end-of-journey satisfaction survey' + sim() + '.') +
      '<div class="two-col"><div>' + U.panel('Preview', body) + '</div><div>' + U.panel('Preview settings', '<form onsubmit="return false">' + U.select('s-svc', 'Service', svcOptions(svcs), s.svc) + U.select('s-jny', 'Journey', js.map(function (j) { return { value: j.id, label: j.name }; }), s.jny) + '</form>' +
        '<p class="govuk-body-s">Responses appear on the ' + U.link('#/satisfaction', 'satisfaction dashboard') + '. No personal data is collected.</p>') + '</div></div>';
  }
  U.on('change', '#s-svc', function (e, el) { f.survey.svc = el.value; f.survey.jny = ''; U.go('#/satisfaction/survey'); });
  U.on('change', '#s-jny', function (e, el) { f.survey.jny = el.value; U.go('#/satisfaction/survey'); });
  U.on('click', '[data-survey-reset]', function (e) { e.preventDefault(); U.go('#/satisfaction/survey'); });
  U.on('submit', '#survey-form', function (ev, form) {
    ev.preventDefault();
    var v = U.formData(form), errs = [], comment = (v.comment || '').trim();
    if (!v.score) errs.push({ id: 'score-0', msg: 'Select a score from 1 to 5' });
    if (comment.length > 500) errs.push({ id: 'comment', msg: 'Comment must be 500 characters or fewer' });
    if (errs.length) { f.survey.comment = v.comment; showErrors('survey-errors', errs); return; }
    db().satisfaction.push({ id: ECO.uid('SAT'), serviceId: f.survey.svc, journeyId: f.survey.jny, at: new Date().toISOString(), score: Number(v.score), channel: 'Online', comment: comment });
    f.survey.comment = ''; ext().surveyDone = true; ECO.save(); U.go('#/satisfaction/survey');
  });

  /* ---------- Invitations preview ---------- */
  function invitationsPage() {
    var svcs = transactional(), v = f.inv; v.svc = defaultSvc(v.svc, svcs); var js = tJourneys(v.svc); v.jny = js.some(function (j) { return j.id === v.jny; }) ? v.jny : (js[0] ? js[0].id : '');
    var sName = svcName(v.svc), jName = jnyName(v.svc, v.jny);
    var tpl = 'Subject: Tell us about your experience: ' + jName + '\n\nHello,\n\nYou recently used "' + sName + '" to ' + jName.toLowerCase() + '. Please take two minutes to tell us how it went.\n\nTake the survey: https://survey.example.gov.uk/s/' + v.jny.toLowerCase() + '\n\nWe do not ask for personal or financial information. You can ignore this email if you prefer not to take part.';
    return U.pageHead('Invitations', 'Preview of the email invitation to complete the satisfaction survey' + sim() + '.') +
      U.callout('warn', 'Preview only.', 'No email is sent and no email addresses are collected or stored. The recipient below is a placeholder.') +
      '<div class="two-col"><div>' + U.panel('Email preview', '<dl class="kv"><dt>To</dt><dd>[recipient email address]</dd><dt>From</dt><dd>Enabling services (no-reply address)</dd></dl><pre class="govuk-body-s" style="white-space:pre-wrap;margin-top:12px">' + esc(tpl) + '</pre>') + '</div><div>' +
      U.panel('Preview settings', '<form onsubmit="return false">' + U.select('i-svc', 'Service', svcOptions(svcs), v.svc) + U.select('i-jny', 'Journey', js.map(function (j) { return { value: j.id, label: j.name }; }), v.jny) + '</form>') +
      U.panel('Throttling', '<ul class="govuk-list govuk-list--bullet govuk-body-s"><li>At most one invitation per person every 90 days.</li><li>Invitations go to a sample of up to 10% of completed transactions.</li><li>No more than 500 invitations a day for each service.</li><li>Recipients are supplied by the service at send time and are not kept by this prototype.</li></ul>') + '</div></div>';
  }
  U.on('change', '#i-svc', function (e, el) { f.inv.svc = el.value; f.inv.jny = ''; U.go('#/satisfaction/invitations'); });
  U.on('change', '#i-jny', function (e, el) { f.inv.jny = el.value; U.go('#/satisfaction/invitations'); });

  U.route('/', signalsPage, 'signals');
  U.route('/signals', signalsPage, 'signals');
  U.route('/feedback', feedbackPage, 'feedback');
  U.route('/feedback/widget', widgetPage, 'widget');
  U.route('/satisfaction', satisfactionPage, 'satisfaction');
  U.route('/satisfaction/survey', surveyPage, 'survey');
  U.route('/satisfaction/invitations', invitationsPage, 'invitations');
  U.start();
})();
