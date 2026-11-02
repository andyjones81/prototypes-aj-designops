/* Shared UI helpers: window.UI. Pure string builders plus a hash router and delegated events. */
(function () {
  'use strict';
  var TAGS = { green: 'govuk-tag--green', red: 'govuk-tag--red', amber: 'govuk-tag--yellow', yellow: 'govuk-tag--yellow', blue: 'govuk-tag--blue', grey: 'govuk-tag--grey', orange: 'govuk-tag--orange', purple: 'govuk-tag--purple', turquoise: 'govuk-tag--turquoise' };
  var STATUS_COLOUR = { 'Not started': 'grey', 'In progress': 'blue', Complete: 'green', Exception: 'orange', 'No longer required': 'purple', Compliant: 'green', Partial: 'yellow', Overdue: 'red', 'Not assessed': 'grey',
    healthy: 'green', degraded: 'yellow', failing: 'red', Open: 'red', Closed: 'green', High: 'red', Medium: 'yellow', Low: 'grey', Live: 'green', 'In delivery': 'blue', open: 'red', confirmed: 'green', dismissed: 'grey',
    Required: 'orange', Booked: 'blue', Completed: 'green', required: 'orange', recommended: 'blue', 'needs-review': 'yellow', 'not-applicable': 'grey' };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function tag(text, colour) { var c = TAGS[colour || STATUS_COLOUR[text]] || ''; return '<strong class="govuk-tag ' + c + '">' + esc(text) + '</strong>'; }
  function enrolTag(status) { return '<strong class="govuk-tag ' + ECO.ENROL_TAG[status] + '">' + esc(ECO.ENROL_STATUS[status]) + '</strong>'; }
  function outcomeTag(o) { return tag(ECO.OUTCOMES[o] || o, STATUS_COLOUR[o]); }
  function intKind(kind) { return '<span class="int int--' + kind + '">' + esc(ECO.INTEGRATION_KINDS[kind]) + '</span>'; }
  function fmtDate(iso) { if (!iso) return '\u2013'; return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  function fmtTime(iso) { return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  function num(n) { return n == null ? '\u2013' : Number(n).toLocaleString('en-GB'); }
  function link(href, text) { return '<a class="govuk-link" href="' + esc(href) + '">' + esc(text) + '</a>'; }
  function table(head, rows, cls) {
    return '<table class="govuk-table ' + (cls || '') + '"><thead class="govuk-table__head"><tr class="govuk-table__row">' + head.map(function (h) { return '<th scope="col" class="govuk-table__header">' + h + '</th>'; }).join('') +
      '</tr></thead><tbody class="govuk-table__body">' + (rows.length ? rows.map(function (r) { return '<tr class="govuk-table__row">' + r.map(function (c) { return '<td class="govuk-table__cell">' + c + '</td>'; }).join('') + '</tr>'; }).join('') : '<tr class="govuk-table__row"><td class="govuk-table__cell" colspan="' + head.length + '">Nothing to show.</td></tr>') + '</tbody></table>';
  }
  function pageHead(title, lead, actions) { return '<div class="page-head"><div><h1 class="govuk-heading-l">' + esc(title) + '</h1>' + (lead ? '<p class="govuk-body">' + lead + '</p>' : '') + '</div>' + (actions ? '<div class="page-head__actions">' + actions + '</div>' : '') + '</div>'; }
  function stat(label, value, note) { return '<div class="stat"><div class="stat__value">' + value + '</div><div class="stat__label">' + esc(label) + '</div>' + (note ? '<div class="stat__note">' + note + '</div>' : '') + '</div>'; }
  function panel(title, body, extra) { return '<section class="panel ' + (extra || '') + '">' + (title ? '<h2 class="govuk-heading-s">' + title + '</h2>' : '') + body + '</section>'; }
  function callout(kind, title, body) { return '<div class="callout callout--' + kind + '">' + (title ? '<strong>' + title + '</strong> ' : '') + body + '</div>'; }
  function bar(pct, label) { pct = Math.max(0, Math.min(100, pct || 0)); return '<div class="bar" role="img" aria-label="' + esc(label || pct + '%') + '"><span style="width:' + pct + '%"></span></div>'; }
  function seg(items, current, attr) { return '<div class="seg" role="group">' + items.map(function (i) { return '<button type="button" class="seg__btn' + (i.id === current ? ' is-on' : '') + '" data-' + (attr || 'seg') + '="' + esc(i.id) + '" aria-pressed="' + (i.id === current) + '">' + esc(i.label) + '</button>'; }).join('') + '</div>'; }

  // SVG line chart. series: [{name, values:[n|null], colour}], labels: x labels.
  function lineChart(series, labels, opts) {
    opts = opts || {}; var w = opts.w || 560, h = opts.h || 180, p = { l: 38, r: 10, t: 10, b: 22 }, all = [];
    series.forEach(function (s) { s.values.forEach(function (v) { if (v != null) all.push(v); }); });
    var min = opts.min != null ? opts.min : 0, max = opts.max != null ? opts.max : (Math.max.apply(null, all.concat([1])) * 1.1);
    var cols = ['#1d70b8', '#d4351c', '#00703c', '#f47738'], n = labels.length;
    function x(i) { return p.l + (n > 1 ? i * (w - p.l - p.r) / (n - 1) : 0); }
    function y(v) { return p.t + (h - p.t - p.b) * (1 - (v - min) / ((max - min) || 1)); }
    var g = '';
    for (var t = 0; t <= 4; t++) { var v = min + (max - min) * t / 4; g += '<line x1="' + p.l + '" x2="' + (w - p.r) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="#b1b4b6" stroke-width="0.5"/><text x="' + (p.l - 4) + '" y="' + (y(v) + 3) + '" text-anchor="end" font-size="9" fill="#505a5f">' + (max > 100 ? Math.round(v).toLocaleString('en-GB') : v.toFixed(max < 10 ? 1 : 0)) + '</text>'; }
    labels.forEach(function (l, i) { if (i % Math.ceil(n / 6) === 0) g += '<text x="' + x(i) + '" y="' + (h - 6) + '" text-anchor="middle" font-size="9" fill="#505a5f">' + esc(l) + '</text>'; });
    series.forEach(function (s, si) {
      var d = '', pen = false, c = s.colour || cols[si % cols.length];
      s.values.forEach(function (val, i) { if (val == null) { pen = false; return; } d += (pen ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(val).toFixed(1) + ' '; pen = true; });
      g += '<path d="' + d + '" fill="none" stroke="' + c + '" stroke-width="2"/>';
      s.values.forEach(function (val, i) { if (val != null) g += '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(val).toFixed(1) + '" r="2.5" fill="' + c + '"/>'; else g += '<text x="' + x(i) + '" y="' + (h - 28) + '" text-anchor="middle" font-size="9" fill="#d4351c">gap</text>'; });
    });
    var legend = series.length > 1 ? '<div class="chart__legend">' + series.map(function (s, i) { return '<span><i style="background:' + (s.colour || cols[i % cols.length]) + '"></i>' + esc(s.name) + '</span>'; }).join('') + '</div>' : '';
    return '<div class="chart"><svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + esc(opts.title || 'Chart') + '">' + g + '</svg>' + legend + '</div>';
  }
  function sparkline(values, colour) {
    var v = values.filter(function (x) { return x != null; }); if (!v.length) return '';
    var min = Math.min.apply(null, v), max = Math.max.apply(null, v), w = 90, h = 24, d = values.map(function (x, i) { return x == null ? '' : (i ? 'L' : 'M') + (i * w / (values.length - 1)).toFixed(1) + ' ' + (h - 2 - (h - 4) * (x - min) / ((max - min) || 1)).toFixed(1); }).join(' ');
    return '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" aria-hidden="true"><path d="' + d + '" fill="none" stroke="' + (colour || '#1d70b8') + '" stroke-width="1.5"/></svg>';
  }

  /* Form helpers (GOV.UK Design System patterns). err = message string or falsy. */
  function field(id, label, control, o) {
    o = o || {}; return '<div class="govuk-form-group' + (o.err ? ' govuk-form-group--error' : '') + '"><label class="govuk-label govuk-label--s" for="' + id + '">' + esc(label) + '</label>' + (o.hint ? '<div id="' + id + '-hint" class="govuk-hint">' + o.hint + '</div>' : '') +
      (o.err ? '<p id="' + id + '-error" class="govuk-error-message"><span class="govuk-visually-hidden">Error:</span> ' + esc(o.err) + '</p>' : '') + control + '</div>';
  }
  function input(id, label, val, o) { o = o || {}; return field(id, label, '<input class="govuk-input' + (o.err ? ' govuk-input--error' : '') + (o.cls ? ' ' + o.cls : '') + '" id="' + id + '" name="' + id + '" type="' + (o.type || 'text') + '" value="' + esc(val) + '">', o); }
  function textarea(id, label, val, o) { o = o || {}; return field(id, label, '<textarea class="govuk-textarea' + (o.err ? ' govuk-textarea--error' : '') + '" id="' + id + '" name="' + id + '" rows="' + (o.rows || 3) + '">' + esc(val) + '</textarea>', o); }
  function select(id, label, opts, val, o) {
    o = o || {}; return field(id, label, '<select class="govuk-select' + (o.err ? ' govuk-select--error' : '') + '" id="' + id + '" name="' + id + '">' + opts.map(function (x) { var v = typeof x === 'object' ? x.value : x, t = typeof x === 'object' ? x.label : x; return '<option value="' + esc(v) + '"' + (String(v) === String(val) ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select>', o);
  }
  function radios(name, legend, opts, val, o) {
    o = o || {}; return '<div class="govuk-form-group' + (o.err ? ' govuk-form-group--error' : '') + '"><fieldset class="govuk-fieldset"><legend class="govuk-fieldset__legend govuk-fieldset__legend--s">' + esc(legend) + '</legend>' + (o.hint ? '<div class="govuk-hint">' + o.hint + '</div>' : '') +
      (o.err ? '<p class="govuk-error-message"><span class="govuk-visually-hidden">Error:</span> ' + esc(o.err) + '</p>' : '') + '<div class="govuk-radios govuk-radios--small" data-module="govuk-radios">' + opts.map(function (x, i) { var v = typeof x === 'object' ? x.value : x, t = typeof x === 'object' ? x.label : x;
        return '<div class="govuk-radios__item"><input class="govuk-radios__input" id="' + name + '-' + i + '" name="' + name + '" type="radio" value="' + esc(v) + '"' + (String(v) === String(val) ? ' checked' : '') + '><label class="govuk-label govuk-radios__label" for="' + name + '-' + i + '">' + esc(t) + '</label></div>'; }).join('') + '</div></fieldset></div>';
  }
  function checkboxes(name, legend, opts, vals, o) {
    o = o || {}; vals = vals || []; return '<div class="govuk-form-group"><fieldset class="govuk-fieldset"><legend class="govuk-fieldset__legend govuk-fieldset__legend--s">' + esc(legend) + '</legend><div class="govuk-checkboxes govuk-checkboxes--small" data-module="govuk-checkboxes">' + opts.map(function (x, i) {
      return '<div class="govuk-checkboxes__item"><input class="govuk-checkboxes__input" id="' + name + '-' + i + '" name="' + name + '" type="checkbox" value="' + esc(x) + '"' + (vals.indexOf(x) > -1 ? ' checked' : '') + '><label class="govuk-label govuk-checkboxes__label" for="' + name + '-' + i + '">' + esc(x) + '</label></div>'; }).join('') + '</div></fieldset></div>';
  }
  function errorSummary(errs) {
    if (!errs || !errs.length) return '';
    return '<div class="govuk-error-summary" data-module="govuk-error-summary"><div role="alert"><h2 class="govuk-error-summary__title">There is a problem</h2><div class="govuk-error-summary__body"><ul class="govuk-list govuk-error-summary__list">' + errs.map(function (e) { return '<li><a href="#' + e.id + '">' + esc(e.msg) + '</a></li>'; }).join('') + '</ul></div></div></div>';
  }
  function button(text, attrs, cls) { return '<button type="button" class="govuk-button ' + (cls || '') + '" data-module="govuk-button" ' + (attrs || '') + '>' + esc(text) + '</button>'; }
  function formData(form) {
    var o = {}; Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name) return;
      if (el.type === 'checkbox') { (o[el.name] = o[el.name] || []); if (el.checked) o[el.name].push(el.value); }
      else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; else if (!(el.name in o)) o[el.name] = ''; }
      else o[el.name] = el.value;
    }); return o;
  }

  function flash(msg, kind) {
    var el = document.getElementById('flash'); if (!el) { el = document.createElement('div'); el.id = 'flash'; el.setAttribute('role', 'status'); var m = document.getElementById('main-content'); m.insertBefore(el, m.firstChild); }
    el.className = 'callout callout--' + (kind || 'success'); el.innerHTML = msg; clearTimeout(flash.t); flash.t = setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 6000);
  }
  function modal(title, html) {
    var d = document.getElementById('modal'); if (!d) return; document.getElementById('modal-title').textContent = title; document.getElementById('modal-body').innerHTML = html;
    if (d.showModal) { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
  }
  function closeModal() { var d = document.getElementById('modal'); if (d && d.close) d.close(); }
  // Rule explanation modal used wherever a rule ID appears.
  function ruleModal(id) {
    var r = ECO.rule(id); if (!r) return;
    modal(r.id + ' ' + r.name, '<dl class="kv"><dt>Enabling service</dt><dd>' + esc(ECO.catalogue(r.enablingId).name) + '</dd><dt>Outcome</dt><dd>' + outcomeTag(r.outcome) + '</dd><dt>Source</dt><dd>' + esc(r.source) + '</dd><dt>Version</dt><dd>v' + r.version + ' (' + esc(r.status) + ', effective ' + fmtDate(r.effective) + ')</dd></dl>' +
      '<h3 class="govuk-heading-s">Applies when</h3>' + (r.conditions.length ? '<ul class="govuk-list govuk-list--bullet">' + r.conditions.map(function (c) { return '<li>' + esc(ECO.condText(c)) + '</li>'; }).join('') + '</ul>' : '<p class="govuk-body">All work.</p>'));
  }
  function ruleChip(id, v) { return id ? '<button type="button" class="chip" data-rule="' + esc(id) + '">' + esc(id) + (v ? ' v' + v : '') + '</button>' : '\u2013'; }

  /* Router: routes = { 'path/:param': fn(params) -> html }. Returns { start }. */
  var routes = [], cfg = {};
  function route(pattern, fn, nav) { routes.push({ re: new RegExp('^' + pattern.replace(/:[a-z]+/gi, '([^/]+)') + '$'), names: (pattern.match(/:[a-z]+/gi) || []).map(function (s) { return s.slice(1); }), fn: fn, nav: nav, title: null }); }
  function render() {
    var path = (location.hash || '#/').slice(1) || '/', main = document.getElementById('app'), hit = null, params = {};
    routes.forEach(function (r) { if (hit) return; var m = path.match(r.re); if (m) { hit = r; r.names.forEach(function (n, i) { params[n] = decodeURIComponent(m[i + 1]); }); } });
    if (!hit) { main.innerHTML = pageHead('Page not found') + '<p class="govuk-body">' + link('#/', 'Go to the start page') + '</p>'; return; }
    var out = hit.fn(params); main.innerHTML = typeof out === 'string' ? out : out.html;
    var title = (out && out.title) || (main.querySelector('h1') ? main.querySelector('h1').textContent : ''); document.title = (title ? title + ' - ' : '') + (window.PROTO.name || 'Prototype');
    if (window.Shell) Shell.setActive(hit.nav || params.nav); if (window.govukInit) window.govukInit(main); window.scrollTo(0, 0);
  }
  function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
  var handlers = { click: [], submit: [], change: [], input: [] };
  function on(type, sel, fn) { handlers[type].push({ sel: sel, fn: fn }); }
  function start(root) {
    root = root || document;
    var mn = document.getElementById('main-content'); if (!document.getElementById('app')) mn.innerHTML = '<div id="app"></div>';
    var dg = document.getElementById('modal'); if (dg && !document.getElementById('modal-body')) dg.innerHTML = '<div class="rule-dialog__head"><h2 class="govuk-heading-m" id="modal-title"></h2><button type="button" class="govuk-button govuk-button--secondary" data-close-modal>Close</button></div><div id="modal-body"></div>';
    ['click', 'submit', 'change', 'input'].forEach(function (t) {
      root.addEventListener(t, function (e) { handlers[t].forEach(function (h) { var el = e.target.closest ? e.target.closest(h.sel) : null; if (el) h.fn(e, el); }); });
    });
    on('click', '[data-rule]', function (e, el) { e.preventDefault(); ruleModal(el.getAttribute('data-rule')); });
    on('click', '[data-close-modal]', function () { closeModal(); });
    window.addEventListener('hashchange', render); render();
  }

  window.UI = { esc: esc, tag: tag, enrolTag: enrolTag, outcomeTag: outcomeTag, intKind: intKind, fmtDate: fmtDate, fmtTime: fmtTime, num: num, link: link, table: table, pageHead: pageHead, stat: stat, panel: panel, callout: callout, bar: bar, seg: seg,
    lineChart: lineChart, sparkline: sparkline, field: field, input: input, textarea: textarea, select: select, radios: radios, checkboxes: checkboxes, errorSummary: errorSummary, button: button, formData: formData,
    flash: flash, modal: modal, closeModal: closeModal, ruleModal: ruleModal, ruleChip: ruleChip, route: route, render: render, go: go, on: on, start: start, STATUS_COLOUR: STATUS_COLOUR };
})();
