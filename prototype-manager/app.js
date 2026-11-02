/* Prototype Manager: screens, persona switching and event handling. All data and rules live in pm-data.js (window.PM).
   Everything shown here is a simulation: no GitHub or Azure call is ever made. */
(function () {
  'use strict';
  var h = UI.esc;
  var filters = { q: '', team: '', status: '', tpl: '', sort: 'updated', scope: 'mine' }, adminF = { q: '', team: '', status: '', tpl: '', flag: '' }, FE = null, auditQ = '';
  var STATUSES = ['Draft', 'Provisioning', 'Active', 'Suspended', 'Archived', 'Decommissioned', 'Failed'];
  var STATUS_COLOUR = { Draft: 'grey', Provisioning: 'blue', Active: 'green', Suspended: 'orange', Archived: 'purple', Decommissioned: 'grey', Failed: 'red' };
  var WIZ_TITLES = ['Choose a template', 'Prototype details', 'Link to a service', 'Team and people', 'Environment and access', 'Features and integrations (optional)', 'Review and create'];
  var FEAT = {
    productType: [['guidance', 'Guidance or information product'], ['transactional', 'Transactional service']],
    auth: [['onelogin', 'GOV.UK One Login'], ['dfesignin', 'DfE Sign-in'], ['dfeidentity', 'DfE Identity'], ['entra', 'DfE SSO (Entra ID)']],
    patterns: [['start', 'Start page'], ['cya', 'Check your answers'], ['tasklist', 'Task list'], ['completion', 'Completion page']],
    integrations: [['notify-text', 'GOV.UK Notify: text messages'], ['notify-email', 'GOV.UK Notify: email'], ['notify-letters', 'GOV.UK Notify: letters'], ['pay', 'GOV.UK Pay'], ['feedback', 'Feedback (per page)'], ['satisfaction', 'User satisfaction (transactional services only, on the completion page)']],
    publisher: [['collection', 'Collection'], ['manual', 'Manual'], ['guide', 'Detailed guide'], ['policy', 'Policy publication'], ['announcement', 'Announcement']],
    branding: [['govuk', 'GOV.UK on all pages'], ['dfe', 'DfE on all pages'], ['both', 'GOV.UK and DfE, set per page in the prototype']]
  };
  function planLabel(pl) { return pl === 'F1' ? 'Free hosting plan (F1)' : pl; }
  function featLabels(k, vals) { return (vals || []).map(function (v) { var m = FEAT[k].filter(function (x) { return x[0] === v; })[0]; return m ? m[1] : v; }); }
  function featSummary(f) { f = f || {}; var rows = [], one = function (k, v) { var m = FEAT[k].filter(function (x) { return x[0] === v; })[0]; return m ? m[1] : ''; };
    if (f.productType) rows.push(['Product type', h(one('productType', f.productType))]);
    [['auth', 'Authentication'], ['patterns', 'Patterns'], ['integrations', 'Integrations'], ['publisher', 'GOV Publisher features']].forEach(function (x) { if ((f[x[0]] || []).length) rows.push([x[1], h(featLabels(x[0], f[x[0]]).join(', '))]); });
    if (f.branding) rows.push(['Branding', h(one('branding', f.branding))]); return rows; }
  var WIZ_FIELDS = { 1: ['templateId'], 2: ['name', 'slug', 'purpose'], 3: ['linkMode', 'serviceId', 'justification'], 4: ['team', 'ownerId', 'contributors'], 5: ['profile', 'region', 'accessMode', 'org', 'endDate', 'tags'], 6: ['productType', 'auth', 'patterns', 'integrations', 'publisher', 'branding'] };

  function S() { return PM.get(); }
  function me() { return S().persona; }
  function U() { return PM.person(me()); }
  function isAdmin() { return PM.isAdmin(me()); }
  function canCreate() { return ['owner', 'designops', 'platform'].indexOf(U().role) > -1; }
  document.documentElement.classList.add('pm-app');
  function head(title, sub, actions) { return '<div class="page-head"><div><h1 class="govuk-heading-l">' + h(title) + '</h1>' + (sub ? '<p class="page-sub">' + sub + '</p>' : '') + '</div>' + (actions ? '<div class="page-actions">' + actions + '</div>' : '') + '</div>'; }
  function sha(s) { return s ? '<span class="sha">' + h(s) + '</span>' : '\u2013'; }
  function scroll(x) { return '<div class="scroll">' + x + '</div>'; }
  function kv(pairs) { return '<dl class="kv">' + pairs.map(function (p) { return '<dt>' + h(p[0]) + '</dt><dd>' + p[1] + '</dd>'; }).join('') + '</dl>'; }
  function btn(text, attrs, cls) { return '<button type="button" class="govuk-button ' + (cls === undefined ? 'govuk-button--secondary' : cls) + ' govuk-!-margin-bottom-0" data-module="govuk-button" ' + attrs + '>' + h(text) + '</button>'; }
  function chip(text, attrs) { return '<button type="button" class="chip" ' + attrs + '>' + h(text) + '</button>'; }
  function t(iso) { return iso ? UI.fmtTime(iso) : '\u2013'; }
  function statusTag(p) { return UI.tag(PM.statusLabel(p), STATUS_COLOUR[p.status]); }
  function healthTag(v) { return UI.tag(v, { Healthy: 'green', Unhealthy: 'red', Unknown: 'grey', 'Not applicable': 'grey' }[v] || 'grey'); }
  function depTag(v) { return UI.tag(v, { Healthy: 'green', Failed: 'red', Building: 'blue', Deploying: 'blue', Queued: 'grey', Cancelled: 'grey', Passed: 'green', Running: 'blue', Checking: 'blue', 'Not started': 'grey', 'Not checked': 'grey' }[v] || 'grey'); }
  function svc(p) { return p.serviceId ? PM.ServiceLookup.get(p.serviceId) : null; }
  function svcName(p) { var s = svc(p); return s ? s.name : 'Standalone (no linked service)'; }
  function svcLink(p) { var s = svc(p); return s ? '<a class="govuk-link" href="../enabling-services/#/services/' + h(s.serviceId) + '">' + h(s.name) + '</a>' : '<span class="muted">Standalone</span>'; }
  function ownerName(p) { return p.ownerId ? h(PM.person(p.ownerId).name) : UI.tag('No owner', 'red'); }
  function tpl(id) { return S().templates.filter(function (x) { return x.id === id; })[0]; }
  function vsLink(p) { return 'vscode://vscode.git/clone?url=' + encodeURIComponent(p.repo.cloneUrl); }
  function cloneCmd(p) { return 'git clone ' + p.repo.cloneUrl; }
  function demoLabel() { return '<div class="demo-bar" role="note"><strong>Demo</strong>Demo: simulated GitHub and Azure, nothing is real</div>'; }
  function openProto(p) { return p.status === 'Active' ? '<a class="govuk-link" href="hosted.html?id=' + encodeURIComponent(p.id) + '" target="_blank" rel="noopener noreferrer">Open prototype<span class="govuk-visually-hidden"> (opens in new tab)</span></a>' : ''; }
  function fe(form) { return FE && FE.form === form ? FE : null; }
  function feMsg(form, id) { var f = fe(form); if (!f) return ''; var m = (f.errors || []).filter(function (e) { return e.id === id; })[0]; return m ? m.msg : ''; }
  function feVal(form, name, dflt) { var f = fe(form); return f && f.values && name in f.values ? f.values[name] : dflt; }
  function fsum(form) { var f = fe(form); return f ? UI.errorSummary(f.errors) : ''; }
  function back(href, text) { return '<p class="govuk-body-s"><a class="govuk-link" href="' + href + '">' + h(text) + '</a></p>'; }
  function wrapTitle(html, title) { return { html: html, title: title }; }

  /* ---------- Navigation, persona bar, access ---------- */
  var NAVS = {
    owner: [['mine', 'My prototypes', '#/'], ['create', 'Create prototype', '#/create']],
    contributor: [['mine', 'My prototypes', '#/']],
    lead: [['mine', 'Team prototypes', '#/']],
    researcher: [['mine', 'Shared with me', '#/']],
    designops: [['mine', 'Prototypes', '#/'], ['create', 'Create prototype', '#/create'], ['admin', 'Administration', '#/admin']]
  };
  var ADMIN_TABS = [['admin', 'Estate', '#/admin'], ['templates', 'Templates', '#/admin/templates'], ['policies', 'Policies', '#/admin/policies'], ['lifecycle', 'Lifecycle', '#/admin/lifecycle'], ['audit', 'Audit', '#/admin/audit'], ['api', 'Reporting feed', '#/api']];
  function adminTabs(cur) {
    return '<nav class="moj-sub-navigation" aria-label="Administration sections"><ul class="moj-sub-navigation__list">' + ADMIN_TABS.map(function (x) { return '<li class="moj-sub-navigation__item"><a class="moj-sub-navigation__link" href="' + x[2] + '"' + (x[0] === cur ? ' aria-current="page"' : '') + '>' + x[1] + '</a></li>'; }).join('') + '</ul></nav>';
  }
  NAVS.platform = NAVS.designops;
  function applyNav() {
    var ul = document.getElementById('navigation'); if (!ul) return;
    ul.innerHTML = NAVS[U().role].map(function (n) { return '<li class="govuk-service-navigation__item" data-nav="' + n[0] + '"><a class="govuk-service-navigation__link" href="' + n[2] + '">' + h(n[1]) + '</a></li>'; }).join('') + demoMenu();
  }
  function demoMenu() {
    var u = U(), unread = PM.notificationsFor(me()).filter(function (n) { return !n.read; }).length;
    return '<li class="govuk-service-navigation__item demo-nav"><details class="ctx demo-nav__d"><summary class="demo-nav__btn"><span class="demo-nav__tag">Demo</span> ' + h(u.name) + (unread ? ' <span class="ctxbar__badge">' + unread + '</span>' : '') + ' <span aria-hidden="true">\u25be</span></summary><div class="demo-nav__menu">' +
      '<p class="govuk-body-s muted govuk-!-margin-bottom-2">Simulated GitHub and Azure. Fictional data.</p>' +
      '<form data-form="persona" aria-label="Switch demo persona"><label class="govuk-label govuk-!-font-weight-bold" for="persona">Viewing as</label><select class="govuk-select" id="persona" name="persona" title="Permissions are enforced in the data layer, so switching persona changes what you can see and do.">' +
      S().personas.map(function (id) { var p = PM.person(id); return '<option value="' + id + '"' + (id === u.id ? ' selected' : '') + '>' + h(p.name + ' (' + PM.ROLE_LABEL[p.role].toLowerCase() + ')') + '</option>'; }).join('') + '</select><p class="govuk-body-s muted govuk-!-margin-top-1 govuk-!-margin-bottom-0">' + h(u.team) + '</p></form>' +
      '<a class="govuk-link demo-nav__n" href="#/about">About this demo</a><a class="govuk-link demo-nav__n" href="#/notifications">Notifications' + (unread ? ' <span class="ctxbar__badge">' + unread + '</span>' : '') + '</a></div></details></li>';
  }
  function personaBar() { return ''; }
  function deniedSwitch() {
    var m = /#\/(?:p|provisioning|view)\/([^\/?]+)/.exec(location.hash), id = m && m[1]; if (!id) return '';
    var ok = S().personas.filter(function (pid) { var r = PM.getPrototype(pid, id, 'view'); return r.ok; });
    return ok.length ? '<p class="govuk-body">View as: ' + ok.map(function (pid) { var p = PM.person(pid); return '<button type="button" class="chip" data-act="as" data-person="' + pid + '">' + h(p.name + ' (' + PM.ROLE_LABEL[p.role].toLowerCase() + ')') + '</button>'; }).join(' ') + '</p>' : '';
  }
  function deniedPage(why) {
    return wrapTitle(head('You do not have access') + UI.callout('bad', 'You do not have access to this page.', h(why || 'Your role or team does not allow it. Ask the prototype owner or a DesignOps administrator.')) +
      '<p class="govuk-body">Signed in as ' + h(U().name) + ' (' + h(PM.ROLE_LABEL[U().role].toLowerCase()) + '). This page is only available to the prototype owner, their team lead and administrators. Switch persona from the Demo menu in the navigation, or use a shortcut below.</p>' + deniedSwitch() + '<p class="govuk-body"><a class="govuk-link" href="#/">Go to ' + (U().role === 'researcher' ? 'prototypes shared with me' : 'my prototypes') + '</a></p>', 'You do not have access');
  }
  function notFound() { return wrapTitle(head('Prototype not found') + '<p class="govuk-body"><a class="govuk-link" href="#/">Go to my prototypes</a></p>', 'Prototype not found'); }
  function R(pattern, nav, fn) {
    var isAdm = ADMIN_TABS.some(function (x) { return x[0] === nav; });
    UI.route(pattern, function (params) { applyNav(); var out = fn(params); var o = typeof out === 'string' ? { html: out } : out; FE = null; return { html: (isAdm && isAdmin() ? adminTabs(nav) : '') + o.html, title: o.title }; }, isAdm ? 'admin' : nav);
  }
  function adminOnly(fn) { return function (p) { if (!isAdmin()) return deniedPage('This area is for DesignOps and platform administrators.'); return fn(p); }; }

  /* ---------- My prototypes ---------- */
  function flagOf(p, f) { return { failed: PM.deploymentFailed(p), expiring: PM.isExpiring(p), expired: PM.isExpired(p), noowner: PM.ownershipGap(p), inactive: PM.isInactive(p) }[f]; }
  function match(p, f) {
    if (f.q && (p.name + ' ' + p.slug + ' ' + p.id + ' ' + svcName(p) + ' ' + p.tags.join(' ')).toLowerCase().indexOf(f.q.toLowerCase()) < 0) return false;
    if (f.team && p.team !== f.team) return false; if (f.status && p.status !== f.status) return false; if (f.tpl && p.templateId !== f.tpl) return false; if (f.flag && !flagOf(p, f.flag)) return false; return true;
  }
  function srcCell(p) {
    if (!p.repo.created) return '<span class="muted">Repository not created</span>';
    var l = PM.latestCommit(p), d = PM.deployedCommit(p), ld = PM.latestDeployment(p);
    if (!d) return 'Latest ' + sha(l) + '<br>Deployed: none';
    if (l === d) return 'Latest ' + sha(l) + '<br>Deployed ' + sha(d) + ' ' + UI.tag('Same', 'green');
    var why = ld && ld.status === 'Failed' ? 'latest commit failed to deploy' : ld && ld.commitSha === l ? 'deployment ' + ld.status.toLowerCase() : 'not deployed';
    return 'Latest ' + sha(l) + '<br>Deployed ' + sha(d) + '<br>' + UI.tag('Differs', 'yellow') + ' <span class="muted">' + h(why) + '</span>';
  }
  function actionItems(p) {
    var items = [], l = PM.level;
    if (PM.can(me(), 'view', p)) {
      if (p.status === 'Active') items.push(openProto(p));
      if (p.repo.created) { items.push('<a class="govuk-link" href="' + h(p.repo.url) + '" rel="noopener">Open repository</a>'); items.push('<a class="govuk-link" href="' + h(vsLink(p)) + '">Open in VS Code</a> ' + chip('Copy clone command', 'data-act="copy" data-id="' + p.id + '"')); }
      if (p.job && p.status !== 'Active' && ['Draft', 'Provisioning', 'Failed'].indexOf(p.status) > -1) items.push('<a class="govuk-link" href="#/provisioning/' + p.id + '">' + (p.status === 'Draft' ? 'Continue to provisioning' : 'View provisioning') + '</a>');
      else if (p.status === 'Draft') items.push('<a class="govuk-link" href="#/provisioning/' + p.id + '">Continue to provisioning</a>');
      if (p.deployments.length) items.push('<a class="govuk-link" href="#/p/' + p.id + '/deployments">View deployments</a>');
      if (canRollback(p)) items.push('<button type="button" class="linkbtn" data-act="rollback-row" data-id="' + p.id + '">Roll back to ' + h(p.lastKnownGood) + '</button>');
      if (PM.can(me(), 'accessView', p)) items.push('<a class="govuk-link" href="#/p/' + p.id + '/settings">Manage</a>');
    } else items.push('<a class="govuk-link" href="#/view/' + p.id + '">Open viewer page</a>');
    return items.filter(Boolean);
  }
  function actionsCell(p) {
    return '<ul class="govuk-list govuk-!-margin-bottom-0">' + actionItems(p).map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</ul>';
  }
  function actionMenu(p) {
    var items = actionItems(p);
    return '<details class="ctx"><summary class="ctx__btn" aria-label="Actions for ' + h(p.name) + '"><span aria-hidden="true">\u22ef</span><span class="ctx__txt">Actions</span></summary><ul class="ctx__menu">' +
      items.map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</ul></details>';
  }
  function expiryCell(p) { var d = PM.daysTo(p.reviewAt); return UI.fmtDate(p.reviewAt) + (['Archived', 'Decommissioned'].indexOf(p.status) > -1 ? '' : d < 0 ? '<br>' + UI.tag('Review overdue', 'red') : d <= 14 ? '<br>' + UI.tag('Due in ' + d + ' days', 'yellow') : ''); }
  function sharingCell(p) { var n = p.accessGrants.filter(PM.grantActive).length; return h(p.sharing) + (n ? '<br><span class="muted">' + n + ' active access grant' + (n > 1 ? 's' : '') + '</span>' : ''); }
  function listTable(rows) {
    return scroll(UI.table(['Prototype', 'Owner and team', 'Status and health', 'Source commit and deployed commit', 'Last update', 'Review by', 'Sharing', 'Actions'], rows.map(function (p) {
      var ld = PM.latestDeployment(p);
      return ['<a class="govuk-link" href="#/p/' + p.id + '"><strong>' + h(p.name) + '</strong></a><br><span class="muted">' + h(p.id) + ' · ' + svcLink(p) + '</span><br><span class="muted">' + h(tpl(p.templateId).name) + '</span>',
        ownerName(p) + '<br><span class="muted">' + h(p.team) + '</span>',
        statusTag(p) + '<br>' + (p.status === 'Active' || p.status === 'Suspended' ? healthTag(p.env.health) : '') + (ld && p.status === 'Active' ? '<br><span class="muted">Latest deployment</span> ' + depTag(ld.status) : ''),
        srcCell(p), t(p.lastActivityAt), expiryCell(p), sharingCell(p), actionsCell(p)];
    }), 'compact'));
  }
  function when(iso) { var d = new Date(iso); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ' at ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
  function depStamp(d) {
    if (!d) return '<span class="muted">Not deployed yet</span>';
    var verb = d.status === 'Healthy' ? 'Deployed' : d.status === 'Failed' ? 'Deployment failed' : d.status === 'Cancelled' ? 'Cancelled' : 'Deployment ' + d.status.toLowerCase();
    return verb + ' by <strong>' + h(d.actor || 'Prototype Manager') + '</strong> on ' + when(d.finishedAt || d.queuedAt);
  }
  function canRollback(p) { return p.status === 'Active' && !!p.lastKnownGood && PM.can(me(), 'manage', p) && (PM.deploymentFailed(p) || p.lastKnownGood !== p.env.deployedCommit); }
  function depLine(p) {
    var d = PM.latestDeployment(p);
    if (!d) return '<span class="muted">Not deployed yet</span>';
    return depTag(d.status) + ' ' + depStamp(d) + ' <span class="sha">' + h(d.commitSha) + '</span> <a class="govuk-link" href="#/p/' + p.id + '/deployments/' + d.id + '">View deployment</a>' +
      (canRollback(p) ? ' <button type="button" class="linkbtn" data-act="rollback-row" data-id="' + p.id + '">Roll back to ' + h(p.lastKnownGood) + '</button>' : '');
  }
  function listRows(rows) {
    return '<ul class="elist plist">' + rows.map(function (p) {
      var flags = [], lvl = PM.levelFor(me(), p), viewable = PM.can(me(), 'view', p);
      var sub = '<span class="muted">' + h(p.id) + '</span><span>' + svcLink(p) + '</span><span>' + ownerName(p) + (filters.scope === 'mine' ? '' : ', ' + h(p.team)) + '</span>';
      if (!viewable) return '<li class="elist__row plist__lim"><div class="elist__main"><div class="elist__title"><strong>' + h(p.name) + '</strong> ' + statusTag(p) + ' ' + UI.tag('View only', 'grey') + '</div><div class="elist__meta">' + sub + '<span class="muted">Updated ' + t(p.lastActivityAt) + '</span></div></div></li>';
      if (PM.ownershipGap(p)) flags.push(UI.tag('No owner', 'red'));
      else if (PM.isExpired(p)) flags.push(UI.tag('Review overdue', 'red'));
      else if (PM.isExpiring(p)) flags.push(UI.tag('Review due in ' + PM.daysTo(p.reviewAt) + ' days', 'yellow'));
      flags = flags.slice(0, 1);
      var live = p.status === 'Active' || p.status === 'Suspended', ld0 = PM.latestDeployment(p);
      var stTag = live ? healthTag(p.env.health) : statusTag(p);
      var third = live ? (ld0 ? depStamp(ld0) + ' <span class="muted">\u00b7</span> <a class="govuk-link" href="#/p/' + p.id + '/deployments/' + ld0.id + '">View</a>' : '<span class="muted">Not deployed yet</span>') : p.status === 'Draft' || p.status === 'Failed' || p.status === 'Provisioning' ? '<a class="govuk-link" href="#/provisioning/' + p.id + '">' + (p.status === 'Draft' ? 'Continue to provisioning' : 'View provisioning') + '</a>' : '<span class="muted">Updated ' + t(p.lastActivityAt) + '</span>';
      return '<li class="elist__row"><div class="elist__main"><div class="elist__title"><a class="govuk-link" href="#/p/' + p.id + '"><strong>' + h(p.name) + '</strong></a> ' + stTag + ' ' + flags.join(' ') + '</div>' +
        '<div class="elist__meta">' + sub + '</div><div class="elist__meta plist__dep">' + third + '</div></div>' +
        '<div class="elist__act plist__act">' + actionMenu(p) + '</div></li>';
    }).join('') + '</ul>';
  }
  function summaryStrip(all) {
    var n = function (fn) { return all.filter(fn).length; };
    var cells = [['Prototypes', all.length], ['Active', n(function (p) { return p.status === 'Active'; })], ['Draft or provisioning', n(function (p) { return ['Draft', 'Provisioning', 'Failed'].indexOf(p.status) > -1; })],
      ['Needs attention', n(function (p) { return PM.deploymentFailed(p) || PM.isExpiring(p) || PM.isExpired(p) || PM.ownershipGap(p); })]];
    return '<dl class="sumstrip">' + cells.map(function (c) { return '<div><dt>' + c[0] + '</dt><dd class="sumstrip__big">' + c[1] + '</dd></div>'; }).join('') + '</dl>';
  }
  function emptyState() {
    return UI.panel('You do not have any prototypes yet', '<p class="govuk-body">Prototype Manager sets up a GitHub repository and Azure hosting for you, so you can build in VS Code and see your prototype running.</p>' +
      '<ol class="govuk-list govuk-list--number"><li>Choose an approved template.</li><li>Prototype Manager creates the repository, deployment workflow and hosting (simulated here).</li><li>Select <strong>Open in VS Code</strong> and edit your pages.</li><li>Push your changes. The dashboard shows the build, deployment and health.</li></ol>' +
      (canCreate() ? '<a class="govuk-button" href="#/create" data-module="govuk-button">Create prototype</a>' : '<p class="govuk-body">Ask a designer to add you as a collaborator on a prototype.</p>') + (isAdmin() ? '<p class="govuk-body">Administrators can see every prototype in the <a class="govuk-link" href="#/admin">estate dashboard</a>.</p>' : ''));
  }
  function scopeSets() {
    var u = U(), me_ = me(), dir = PM.directory(me_), team = dir.filter(function (p) { return p.team === u.team; });
    var mineSet = PM.mine(me_).filter(function (p) { return p.ownerId === me_ || p.contributors.indexOf(me_) > -1; });
    return { mine: mineSet, team: team, all: dir };
  }
  var SORTS = [['updated', 'Recently updated'], ['name', 'Name A to Z'], ['review', 'Review date'], ['attention', 'Needs attention first']];
  function attn(p) { return (PM.deploymentFailed(p) ? 4 : 0) + (PM.isExpired(p) ? 3 : 0) + (PM.ownershipGap(p) ? 2 : 0) + (PM.isExpiring(p) ? 1 : 0); }
  function sortRows(rows) {
    var k = filters.sort, r = rows.slice();
    r.sort(function (a, b) {
      if (k === 'name') return a.name.localeCompare(b.name);
      if (k === 'review') return a.reviewAt < b.reviewAt ? -1 : a.reviewAt > b.reviewAt ? 1 : 0;
      if (k === 'attention') return attn(b) - attn(a) || (a.lastActivityAt < b.lastActivityAt ? 1 : -1);
      return a.lastActivityAt < b.lastActivityAt ? 1 : a.lastActivityAt > b.lastActivityAt ? -1 : 0;
    });
    return r;
  }
  function plist() {
    var all = scopeSets()[filters.scope] || [];
    if (!all.length) return filters.scope === 'mine' ? emptyState() : UI.callout('', 'No prototypes here yet.', filters.scope === 'team' ? 'Nobody in your team has a prototype yet.' : 'There are no prototypes to show.');
    var rows = sortRows(all.filter(function (p) { return match(p, filters); }));
    return '<p class="plist__count">Showing ' + rows.length + ' of ' + all.length + '</p>' + (rows.length ? listRows(rows) : UI.callout('', 'No prototypes match.', 'Clear the search or filters to see all ' + all.length + ' prototypes.'));
  }
  function notifPanel() {
    var ns = PM.notificationsFor(me()), unread = ns.filter(function (n) { return !n.read; }).length;
    return UI.panel('Notifications' + (unread ? ' (' + unread + ' unread)' : ''), ns.length ? '<ul class="govuk-list">' + ns.slice(0, 8).map(function (n) { return '<li class="' + (n.read ? '' : 'notif-unread') + '"><strong>' + h(n.type) + '</strong> <span class="muted">' + t(n.at) + '</span><br>' + h(n.text) + (n.prototypeId && PM.proto(n.prototypeId) && PM.can(me(), 'view', PM.proto(n.prototypeId)) ? ' <a class="govuk-link" href="#/p/' + n.prototypeId + '">Open</a>' : '') + '</li>'; }).join('') + '</ul>' + (unread ? btn('Mark all as read', 'data-act="readall"') : '') : '<p class="govuk-body">No notifications.</p>');
  }
  function feedPanel() {
    var f = PM.feedFor(me());
    return UI.panel('Your activity', f.length ? '<ul class="govuk-list">' + f.slice(0, 6).map(function (a) { return '<li><span class="muted">' + t(a.at) + '</span> <a class="govuk-link" href="#/p/' + a.id + '/activity">' + h(a.prototype) + '</a>: ' + h(a.text) + '</li>'; }).join('') + '</ul>' : '<p class="govuk-body">No recent activity.</p>');
  }
  function approvalsPanel() {
    if (U().role !== 'lead') return '';
    var rows = S().prototypes.filter(function (p) { return p.team === U().team && p.transferRequest; });
    return UI.panel('Ownership transfers to approve', rows.length ? UI.table(['Prototype', 'Requested by', 'New owner', 'Action'], rows.map(function (p) { return [h(p.name), h(p.transferRequest.by), h(PM.person(p.transferRequest.to).name), btn('Approve transfer', 'data-act="approve-transfer" data-id="' + p.id + '"')]; })) : '<p class="govuk-body">No transfers waiting for your approval.</p>');
  }
  function sharedList() {
    var rows = PM.mine(me());
    return wrapTitle(head('Shared with me', 'Prototypes you have been given permission to view. You can open the hosted prototype only; source code and infrastructure are not shown.') +
      (rows.length ? UI.table(['Prototype', 'Purpose', 'Your access ends', 'Viewer page'], rows.map(function (p) { var g = p.accessGrants.filter(function (x) { return x.recipientId === me() && PM.grantActive(x); })[0]; return [h(p.name), h(p.purpose), UI.fmtDate(g.expiresAt), '<a class="govuk-link" href="#/view/' + p.id + '">Open viewer page</a>']; })) : UI.callout('', 'Nothing is shared with you at the moment.', 'Ask the prototype owner to create research access for you.')) + notifPanel(), 'Shared with me');
  }
  R('/', 'mine', function () {
    if (U().role === 'researcher') return sharedList();
    var u = U(), sets = scopeSets(), cur = sets[filters.scope] || [], teams = {}; sets.all.forEach(function (p) { teams[p.team] = 1; });
    var opts = function (list, val, any) { return '<option value="">' + any + '</option>' + list.map(function (x) { return '<option value="' + h(x[0]) + '"' + (x[0] === val ? ' selected' : '') + '>' + h(x[1]) + '</option>'; }).join(''); };
    var scopes = [{ id: 'mine', label: 'My prototypes (' + sets.mine.length + ')' }, { id: 'team', label: u.team + ' (' + sets.team.length + ')' }, { id: 'all', label: 'All prototypes (' + sets.all.length + ')' }];
    var filt = '<div class="toolbar toolbar--one"><div class="row"><label class="govuk-visually-hidden" for="pf-q">Search</label><input class="govuk-input govuk-input--width-20" id="pf-q" type="search" value="' + h(filters.q) + '" placeholder="Search name, service or tag">' +
      (filters.scope === 'all' ? '<label class="govuk-visually-hidden" for="pf-team">Team</label><select class="govuk-select" id="pf-team">' + opts(Object.keys(teams).sort().map(function (x) { return [x, x]; }), filters.team, 'All teams') + '</select>' : '') +
      '<label class="govuk-visually-hidden" for="pf-status">Status</label><select class="govuk-select" id="pf-status">' + opts(STATUSES.map(function (x) { return [x, x === 'Failed' ? 'Failed provisioning' : x]; }), filters.status, 'All statuses') + '</select>' +
      '<label class="govuk-visually-hidden" for="pf-tpl">Template</label><select class="govuk-select" id="pf-tpl">' + opts(S().templates.map(function (x) { return [x.id, x.name]; }), filters.tpl, 'All templates') + '</select>' +
      '<label class="govuk-visually-hidden" for="pf-sort">Sort by</label><select class="govuk-select plist__sort" id="pf-sort">' + SORTS.map(function (x) { return '<option value="' + x[0] + '"' + (filters.sort === x[0] ? ' selected' : '') + '>Sort: ' + x[1] + '</option>'; }).join('') + '</select></div></div>';
    var sub = filters.scope === 'mine' ? 'Prototypes you own or contribute to.' : filters.scope === 'team' ? 'Everything built by ' + h(u.team) + '. You can open the ones you have access to.' : 'Every prototype in the organisation. Only prototypes you have access to can be opened.';
    return wrapTitle(head('Prototypes', sub, canCreate() ? '<a class="govuk-button" href="#/create" data-module="govuk-button">Create prototype</a>' : '') +
      '<div class="scopebar">' + UI.seg(scopes, filters.scope, 'scope') + '</div>' +
      filt + '<div id="plist">' + plist() + '</div>', 'Prototypes');
  });

  R('/notifications', 'notif', function () {
    var ns = PM.notificationsFor(me()), unread = ns.filter(function (n) { return !n.read; }).length, f = PM.feedFor(me());
    var list = ns.length ? '<ul class="elist">' + ns.map(function (n) {
      var open = n.prototypeId && PM.proto(n.prototypeId) && PM.can(me(), 'view', PM.proto(n.prototypeId)) ? '<a class="govuk-link" href="#/p/' + n.prototypeId + '">Open prototype</a>' : '';
      return '<li class="elist__row' + (n.read ? '' : ' is-unread') + '"><div class="elist__main"><div class="elist__title">' + (n.read ? '' : '<span class="dotnew" aria-label="Unread"></span>') + '<strong>' + h(n.type) + '</strong> <span class="muted">' + when(n.at) + '</span></div><div class="elist__meta">' + h(n.text) + '</div></div><div class="elist__act">' + open + '</div></li>';
    }).join('') + '</ul>' : '<p class="govuk-body">No notifications.</p>';
    var feed = f.length ? '<ul class="elist">' + f.slice(0, 12).map(function (a) { return '<li class="elist__row"><div class="elist__main"><div class="elist__title"><a class="govuk-link" href="#/p/' + a.id + '/activity">' + h(a.prototype) + '</a></div><div class="elist__meta">' + h(a.text) + ' <span class="muted">' + t(a.at) + '</span></div></div></li>'; }).join('') + '</ul>' : '<p class="govuk-body">No recent activity.</p>';
    return wrapTitle(head('Notifications', unread ? unread + ' unread' : 'You are up to date.', unread ? btn('Mark all as read', 'data-act="readall"') : '') + approvalsPanel() +
      '<div class="detail-grid"><div class="detail-main">' + list + '</div><aside class="detail-side"><h2 class="govuk-heading-s">Your activity</h2>' + feed + '</aside></div>', 'Notifications');
  });

  /* ---------- Create wizard ---------- */
  function wiz() {
    var s = S(), u = U();
    if (!s.wizard) {
      var days = s.policy.expiry.defaultDays, end = new Date(Date.parse(PM.today() + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10);
      s.wizard = { step: 1, errors: [], data: { templateId: '', name: '', slug: '', slugManual: false, purpose: '', linkMode: '', serviceId: '', justification: '', team: u.role === 'owner' ? u.team : '', ownerId: u.role === 'owner' ? u.id : '', contributors: [], profile: s.policy.profiles[0].id, region: s.policy.defaultRegion, accessMode: 'internal', org: s.policy.approvedOrgs[0], endDate: end, tags: '', productType: '', auth: [], patterns: [], integrations: [], publisher: [], branding: 'govuk' } };
      PM.save();
    }
    return s.wizard;
  }
  function wizErr(id) { var m = (wiz().errors || []).filter(function (e) { return e.id === id; })[0]; return m ? m.msg : ''; }
  function teamList() { var o = {}; S().people.forEach(function (p) { if (['owner', 'lead', 'contributor'].indexOf(p.role) > -1) o[p.team] = 1; }); PM.ServiceLookup.all().forEach(function (s) { o[s.team] = 1; }); return Object.keys(o).sort(); }
  function svcDetail(id) { var s = PM.ServiceLookup.get(id); return s ? 'Service ' + h(s.serviceId) + ', product ' + h(s.productId) + ', work item ' + h(s.workId) + '. Service team: ' + h(s.team) + '. ' + h(s.description) : 'Select a service to see its product and work references.'; }
  function svcOptions(q, val) { return '<option value="">Select a service</option>' + PM.ServiceLookup.search(q).map(function (s) { return '<option value="' + h(s.serviceId) + '"' + (s.serviceId === val ? ' selected' : '') + '>' + h(s.name + ' (' + s.serviceId + ')') + '</option>'; }).join(''); }
  function wizBody(w) {
    var d = w.data, pol = S().policy, n = w.step;
    if (n === 1) {
      return '<div class="govuk-form-group' + (wizErr('templateId-0') ? ' govuk-form-group--error' : '') + '"><fieldset class="govuk-fieldset"><legend class="govuk-fieldset__legend govuk-fieldset__legend--s">Template</legend>' +
        '<div class="govuk-hint">Only approved templates can be selected. The GOV.UK Prototype Kit is a server-rendered Node.js application, so it is hosted on Azure App Service, not on static hosting.</div>' +
        (wizErr('templateId-0') ? '<p class="govuk-error-message"><span class="govuk-visually-hidden">Error:</span> ' + h(wizErr('templateId-0')) + '</p>' : '') + '<div class="govuk-radios govuk-radios--small">' +
        S().templates.map(function (x, i) { return '<div class="tpl-choice' + (x.enabled ? '' : ' is-disabled') + '"><div class="govuk-radios__item"><input class="govuk-radios__input" id="templateId-' + i + '" name="templateId" type="radio" value="' + x.id + '"' + (d.templateId === x.id ? ' checked' : '') + (x.enabled ? '' : ' disabled') + '><label class="govuk-label govuk-radios__label" for="templateId-' + i + '"><strong>' + h(x.name) + '</strong> version ' + h(x.pinned) + ' ' + (x.enabled ? UI.tag('Approved', 'green') : UI.tag('Not available: ' + x.status.toLowerCase(), 'grey')) + '</label><div class="govuk-hint govuk-radios__hint">' + h(x.note) + ' Runtime: ' + h(x.runtime) + '. Hosting: ' + h(x.hosting) + '.</div></div></div>'; }).join('') + '</div></fieldset></div>';
    }
    if (n === 2) return UI.input('name', 'Prototype name', d.name, { err: wizErr('name'), hint: 'For example, Apply for school transport' }) + UI.input('slug', 'Slug', d.slug || PM.slugify(d.name), { err: wizErr('slug'), hint: 'Used for the repository and web address. Generated from the name; you can change it. It must be unique.', cls: 'govuk-input--width-20' }) +
      UI.textarea('purpose', 'Purpose', d.purpose, { err: wizErr('purpose'), hint: 'What are you testing, and with whom? Use synthetic data only.' });
    if (n === 3) {
      var linkRadios = UI.radios('linkMode', 'Link to the service register', [{ value: 'service', label: 'Link to an existing service, product and work item' }, { value: 'standalone', label: 'Standalone prototype, not linked to a service' }], d.linkMode, { err: wizErr('linkMode-0'), hint: 'Prototypes should be linked to an existing record. Standalone prototypes need a justification.' });
      var more = d.linkMode === 'service' ? '<div class="govuk-form-group"><label class="govuk-label govuk-label--s" for="svcq">Search services</label><div class="govuk-hint">Search by name, service ID, work ID or team. Source: ' + h(PM.ServiceLookup.label) + '.</div><input class="govuk-input govuk-input--width-20" id="svcq" type="search" autocomplete="off"></div>' +
        UI.field('serviceId', 'Service', '<select class="govuk-select' + (wizErr('serviceId') ? ' govuk-select--error' : '') + '" id="serviceId" name="serviceId" style="max-width:100%">' + svcOptions('', d.serviceId) + '</select>', { err: wizErr('serviceId') }) + '<p class="govuk-body-s" id="svc-detail">' + svcDetail(d.serviceId) + '</p>'
        : d.linkMode === 'standalone' ? UI.textarea('justification', 'Justification for a standalone prototype', d.justification, { err: wizErr('justification'), hint: 'For example, an early concept before any work item exists.' }) : '';
      return linkRadios + more;
    }
    if (n === 4) {
      var owners = S().people.filter(function (p) { return d.team && p.team === d.team && ['owner', 'lead', 'contributor'].indexOf(p.role) > -1; });
      var contribs = S().people.filter(function (p) { return ['owner', 'lead', 'contributor'].indexOf(p.role) > -1 && p.id !== d.ownerId; });
      return UI.select('team', 'Owning team', [{ value: '', label: 'Select a team' }].concat(teamList()), d.team, { err: wizErr('team'), hint: 'Quota: ' + pol.quotas.perTeam + ' active prototypes per team.' }) +
        UI.select('ownerId', 'Owner', [{ value: '', label: owners.length ? 'Select an owner' : 'Select a team first' }].concat(owners.map(function (p) { return { value: p.id, label: p.name }; })), d.ownerId, { err: wizErr('ownerId'), hint: 'From organisational identity data. The owner is accountable for the prototype.' }) +
        '<div class="govuk-form-group"><fieldset class="govuk-fieldset"><legend class="govuk-fieldset__legend govuk-fieldset__legend--s">Contributors (optional)</legend><div class="govuk-hint">Contributors get repository access through GitHub. This does not give anyone access to the hosted prototype.</div><div class="govuk-checkboxes govuk-checkboxes--small">' +
        contribs.map(function (p, i) { return '<div class="govuk-checkboxes__item"><input class="govuk-checkboxes__input" id="contributors-' + i + '" name="contributors" type="checkbox" value="' + p.id + '"' + (d.contributors.indexOf(p.id) > -1 ? ' checked' : '') + '><label class="govuk-label govuk-checkboxes__label" for="contributors-' + i + '">' + h(p.name + ', ' + p.team) + '</label></div>'; }).join('') + '</div></fieldset></div>';
    }
    if (n === 5) {
      return UI.select('profile', 'Environment profile', pol.profiles.map(function (p) { return { value: p.id, label: p.label + ' (' + p.plan + ', ' + pol.defaultRegion + ')' }; }), d.profile, { err: wizErr('profile'), hint: 'Cost categories are indicative only. They are not prices.' }) +
        UI.select('region', 'Azure region', pol.regions, d.region, { err: wizErr('region'), hint: 'Regions allowed by administrator policy.' }) +
        UI.radios('accessMode', 'Access mode', [{ value: 'internal', label: 'Internal only (default)' }, { value: 'research', label: 'Controlled research sharing (time-limited access grants)' }], d.accessMode, { err: wizErr('accessMode-0'), hint: 'The hosted prototype is always password protected. A hidden address is never the only protection.' }) +
        UI.select('org', 'GitHub organisation', pol.approvedOrgs, d.org, { err: wizErr('org'), hint: 'Approved organisations only. The repository is named after the slug.' }) +
        UI.input('endDate', 'End or review date', d.endDate, { err: wizErr('endDate'), hint: 'Use YYYY-MM-DD, within ' + pol.expiry.maxDays + ' days. Default is ' + pol.expiry.defaultDays + ' days.', cls: 'govuk-input--width-10' }) + UI.input('tags', 'Tags (optional)', d.tags, { hint: 'Separate with commas' });
    }
    if (n === 6) {
      var chk = function (k, legend, hint) { var cur = d[k] || []; return '<div class="govuk-form-group"><fieldset class="govuk-fieldset"><legend class="govuk-fieldset__legend govuk-fieldset__legend--s">' + legend + '</legend>' + (hint ? '<div class="govuk-hint">' + hint + '</div>' : '') + '<div class="govuk-checkboxes govuk-checkboxes--small">' + FEAT[k].map(function (o, i) { return '<div class="govuk-checkboxes__item"><input class="govuk-checkboxes__input" id="' + k + '-' + i + '" name="' + k + '" type="checkbox" value="' + o[0] + '"' + (cur.indexOf(o[0]) > -1 ? ' checked' : '') + '><label class="govuk-label govuk-checkboxes__label" for="' + k + '-' + i + '">' + h(o[1]) + '</label></div>'; }).join('') + '</div></fieldset></div>'; };
      return '<p class="govuk-body">Choose what to include in the starting prototype. You can skip this step and add features later.</p>' +
        UI.radios('productType', 'Product type', FEAT.productType.map(function (o) { return { value: o[0], label: o[1] }; }), d.productType || '', {}) +
        chk('auth', 'Authentication') + chk('patterns', 'Patterns') + chk('integrations', 'Integrations', wizErr('integrations') ? '<span class="govuk-error-message">' + h(wizErr('integrations')) + '</span>' : '') + chk('publisher', 'GOV Publisher features') +
        UI.radios('branding', 'Branding', FEAT.branding.map(function (o) { return { value: o[0], label: o[1] }; }), d.branding || 'govuk', {});
    }
    var plan = PM.plan(d), tp = tpl(d.templateId), sv = d.linkMode === 'service' ? PM.ServiceLookup.get(d.serviceId) : null, prof = pol.profiles.filter(function (x) { return x.id === d.profile; })[0];
    return UI.panel('Settings', kv([['Template', h(tp ? tp.name + ' ' + tp.pinned : '')], ['Name and slug', h(d.name + ' (' + (d.slug || PM.slugify(d.name)) + ')')], ['Purpose', h(d.purpose)], ['Linked record', sv ? h(sv.name + ', ' + sv.serviceId + ', ' + sv.productId + ', ' + sv.workId) : 'Standalone: ' + h(d.justification)],
      ['Team and owner', h(d.team + ', ' + (PM.person(d.ownerId) ? PM.person(d.ownerId).name : ''))], ['Contributors', d.contributors.length ? h(d.contributors.map(function (c) { return PM.person(c).name; }).join(', ')) : 'None'], ['Access mode', d.accessMode === 'research' ? 'Controlled research sharing' : 'Internal only'], ['End or review date', h(d.endDate)]].concat(featSummary(d.productType || d.auth.length || d.patterns.length || d.integrations.length || d.publisher.length ? d : { branding: d.branding })))) +
      UI.panel('Resources that will be created (simulated)', UI.table(['Resource', 'Name', 'Detail'], plan.map(function (r) { return [h(r[0]), '<span class="sha">' + h(r[1]) + '</span>', h(r[2])]; }), 'compact') +
        '<p class="govuk-body">Indicative cost category: ' + UI.tag(prof ? prof.category : 'Low', 'green') + ' <span class="muted">This is a category based on plan size, not a price. Billing data is not connected, and Azure and GitHub resources are not assumed to be free.</span></p>');
  }
  R('/create', 'create', function () {
    if (!canCreate()) return deniedPage('Only designers and administrators can create prototypes. Contributors, team leads and researchers cannot.');
    var w = wiz(), n = w.step;
    var errs = w.errors || [];
    var intro = '<p class="govuk-body-s">Step ' + n + ' of 7: ' + h(WIZ_TITLES[n - 1]) + '</p>' + UI.bar(n * 100 / 7, 'Step ' + n + ' of 7');
    return wrapTitle(head('Create prototype', 'Nothing is created until you select Create prototype on the review step. Everything created is simulated.') + back('#/', 'Back to my prototypes') + UI.errorSummary(errs) + intro +
      '<form id="wiz" data-form="wiz" novalidate><h2 class="govuk-heading-m">' + h(WIZ_TITLES[n - 1]) + '</h2>' + wizBody(w) + '<div class="row">' + (n > 1 ? btn('Back', 'data-act="wiz-back"') : '') +
      '<button type="submit" class="govuk-button govuk-!-margin-bottom-0" data-module="govuk-button">' + (n === 7 ? 'Create prototype' : 'Continue') + '</button>' + btn('Start again', 'data-act="wiz-reset"') + '</div></form>', 'Create prototype');
  });
  function wizMerge(form) {
    var w = wiz(), fd = UI.formData(form), d = w.data;
    (WIZ_FIELDS[w.step] || []).forEach(function (k) { if (k in fd) d[k] = fd[k]; });
    if (w.step === 2) { d.slugManual = !!(fd.slug && fd.slug !== PM.slugify(fd.name)); if (!fd.slug) d.slug = PM.slugify(fd.name); }
    if (w.step === 4 && d.ownerId && PM.person(d.ownerId) && PM.person(d.ownerId).team !== d.team) d.ownerId = '';
    return w;
  }

  /* ---------- Provisioning ---------- */
  var AUTO = null, autoTimer = null, barTimer = null, stepStart = 0, stepDur = 0;
  var STEP_MS = { workflow: 12000, azure: 8000, deploy: 37000, health: 8000 };
  function stopAuto() { AUTO = null; stepStart = 0; if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; } if (barTimer) { clearInterval(barTimer); barTimer = null; } }
  function stepPct() { return stepStart && stepDur ? Math.min(100, Math.round(100 * (Date.now() - stepStart) / stepDur)) : 0; }
  function stepEta() { return Math.max(0, Math.ceil((stepDur - (Date.now() - stepStart)) / 1000)); }
  function startAuto(id, delay) {
    stopAuto(); AUTO = id;
    barTimer = setInterval(function () {
      var f = document.querySelector('.prov__fill'); if (!f) return;
      var pc = stepPct(); f.style.width = pc + '%'; var bar = f.parentNode; bar.setAttribute('aria-valuenow', pc);
      var e = document.querySelector('.prov__eta'); if (e) e.textContent = pc + '% \u00b7 about ' + stepEta() + ' seconds left';
    }, 250);
    (function tick() {
      var cp = PM.proto(id), ns = cp && PM.nextStep(cp); stepDur = ns && STEP_MS[ns.id] ? STEP_MS[ns.id] : 0; stepStart = Date.now();
      autoTimer = setTimeout(function () {
        if (AUTO !== id || location.hash.indexOf('#/provisioning/' + id) !== 0) { stopAuto(); return; }
        var r = PM.runNext(me(), id), p = PM.proto(id);
        if (!r.ok || !p || !PM.nextStep(p)) { stopAuto(); UI.render(); return; }
        tick(); UI.render();
      }, stepDur || delay || 1100);
    })();
  }
  R('/provisioning/:id', 'mine', function (a) {
    var r = PM.getPrototype(me(), a.id, 'view'); if (!r.ok) return r.notFound ? notFound() : deniedPage(); var p = r.proto, mg = PM.can(me(), 'manage', p), j = p.job, c = PM.counts(p), nxt = PM.nextStep(p);
    var body = head('Setting up ' + p.name, statusTag(p) + ' ' + UI.tag('Demo: simulated', 'orange') + ' <span class="muted">' + h(p.id) + ' \u00b7 No real GitHub repository or Azure resource is created.</span>', p.status === 'Active' ? '<a class="govuk-button" href="#/p/' + p.id + '" data-module="govuk-button">Go to prototype</a>' : '') + back('#/', 'Back to my prototypes');
    if (p.status === 'Draft') return wrapTitle(body + UI.panel('This prototype is a draft', '<p class="govuk-body">Nothing has been created yet. Submit it to start provisioning.</p>' + (mg ? btn('Submit and start provisioning', 'data-act="start-prov" data-id="' + p.id + '"', '') : '<p class="muted">Only the owner can submit this draft.</p>')), 'Provisioning');
    var done = j.steps.filter(function (s) { return s.status === 'Succeeded'; }).length, total = j.steps.length, pct = Math.round(100 * done / total), running = AUTO === p.id && nxt && nxt.status !== 'Failed';
    var steps = '<ol class="prov">' + j.steps.map(function (s) {
      var live = running && nxt && s.id === nxt.id, st = live ? 'Running' : s.status, cls = { Succeeded: 'is-done', Failed: 'is-failed', Running: 'is-running' }[st] || '';
      return '<li class="prov__step ' + cls + '"><span class="prov__dot" aria-hidden="true">' + (st === 'Succeeded' ? '\u2713' : st === 'Failed' ? '!' : '') + '</span><div class="prov__body"><div class="prov__title">' + h(PM.stepLabel(s.id)) + (s.attempts > 1 ? ' <span class="muted">(' + s.attempts + ' attempts)</span>' : '') + '</div>' +
        (live && stepDur ? '<div class="prov__bar" role="progressbar" aria-label="' + h(PM.stepLabel(s.id)) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + stepPct() + '"><span class="prov__fill" style="width:' + stepPct() + '%"></span></div><div class="prov__eta muted">' + stepPct() + '% \u00b7 about ' + stepEta() + ' seconds left</div>' : '') +
        (s.note ? '<div class="muted">' + h(s.note) + '</div>' : '') +
        (s.error ? '<div class="govuk-error-message govuk-!-margin-bottom-0">' + h(s.error) + '</div><div class="muted">Correlation ID ' + h(j.correlationId) + '. Escalate to platform support if retrying does not help.</div>' : '') + '</div>' +
        '<div class="prov__state">' + UI.tag(live ? 'In progress' : s.status, { Succeeded: 'green', Failed: 'red', Running: 'blue', Pending: 'grey' }[st]) + '</div><div class="prov__time muted">' + (s.at && !live ? t(s.at) : '') + '</div></li>';
    }).join('') + '</ol>';
    var failed = nxt && nxt.status === 'Failed', pend = j.steps.filter(function (s) { return s.status === 'Pending' && s.id !== 'validate'; });
    var banner = !nxt ? '<div class="govuk-notification-banner govuk-notification-banner--success" role="alert" aria-labelledby="prov-ok" data-module="govuk-notification-banner"><div class="govuk-notification-banner__header"><h2 class="govuk-notification-banner__title" id="prov-ok">Success</h2></div><div class="govuk-notification-banner__content"><p class="govuk-notification-banner__heading">Your prototype is up and running.</p><p class="govuk-body"><a class="govuk-notification-banner__link" href="hosted.html?id=' + encodeURIComponent(p.id) + '" target="_blank" rel="noopener noreferrer">View your prototype<span class="govuk-visually-hidden"> (opens in new tab)</span></a> or <a class="govuk-notification-banner__link" href="#/p/' + p.id + '">go to the prototype overview</a>.</p><p class="govuk-body-s">Simulated: nothing was created in GitHub or Azure.</p></div></div>' : failed ? UI.callout('bad', 'Provisioning failed.', 'Retrying is safe and will not create duplicates.') + (mg ? '<p>' + btn('Retry failed step', 'data-act="retry-run" data-id="' + p.id + '"', '') + '</p>' : '') : '';
    var prog = '<div class="prov__prog"><div class="prov__label"><strong>' + (!nxt ? 'Complete' : failed ? 'Stopped at ' + h(PM.stepLabel(nxt.id)) : running ? 'Provisioning\u2026' : 'Ready to start') + '</strong><span class="muted">' + done + ' of ' + total + ' steps</span></div>' + UI.bar(pct, pct + '% complete') + '</div>';
    if (mg && p.status === 'Provisioning' && !AUTO && nxt && nxt.status !== 'Failed') setTimeout(function () { if (!AUTO && location.hash.indexOf('#/provisioning/' + p.id) === 0) { startAuto(p.id, 1000); UI.render(); } }, 0);
    return wrapTitle(body + banner + prog + steps + '<details class="fold"><summary>Technical details</summary>' + kv([['GitHub repositories', '<strong>' + c.repos + '</strong>'], ['Azure resources', '<strong>' + c.resources + '</strong>'], ['Repository create calls', j.repoCalls], ['Azure create calls', j.resourceCalls], ['Attempt', j.attempt], ['Correlation ID', '<span class="sha">' + h(j.correlationId) + '</span>']]) +
      '<p class="govuk-hint">A retry makes another create call, but the counts stay at 1.</p></details>', 'Provisioning');
  });

  /* ---------- Prototype workspace ---------- */
  var TABS = [['', 'Overview', 'view'], ['source', 'Source', 'source'], ['deployments', 'Deployments', 'view'], ['environments', 'Environments', 'view'], ['access', 'Access', 'accessView'], ['settings', 'Settings', 'accessView'], ['activity', 'Activity', 'view']];
  function tabs(p, cur) { return '<nav class="moj-sub-navigation" aria-label="Prototype sections"><ul class="moj-sub-navigation__list">' + TABS.filter(function (x) { return PM.can(me(), x[2], p); }).map(function (x) { return '<li class="moj-sub-navigation__item"><a class="moj-sub-navigation__link" href="#/p/' + p.id + (x[0] ? '/' + x[0] : '') + '"' + (x[0] === cur ? ' aria-current="page"' : '') + '>' + x[1] + '</a></li>'; }).join('') + '</ul></nav>'; }
  function protoHead(p, cur) {
    var acts = [];
    if (p.status === 'Active') acts.push('<a class="govuk-button govuk-!-margin-bottom-0" data-module="govuk-button" href="hosted.html?id=' + encodeURIComponent(p.id) + '" target="_blank" rel="noopener noreferrer">Open prototype<span class="govuk-visually-hidden"> (opens in new tab)</span></a>');
    if (p.repo.created && PM.can(me(), 'source', p)) acts.push(menu('Clone or open', [menuBtn('Clone repo (copy command)', 'copy', p.id), '<a class="govuk-link" href="' + h(vsLink(p)) + '">Open in VS Code</a>']));
    return head(p.name, statusTag(p) + ' ' + (p.status === 'Active' ? healthTag(p.env.health) + ' ' : '') + UI.tag('Demo', 'orange') + ' <span class="muted">' + h(p.id) + ' · ' + h(tpl(p.templateId).name) + '</span>', '<div class="row">' + acts.join('') + '</div>') + back('#/', 'Back to my prototypes') + tabs(p, cur);
  }
  function protoRoute(a) {
    var tab = a.tab || '', cap = (TABS.filter(function (x) { return x[0] === tab; })[0] || ['', '', 'view'])[2];
    if (!TABS.some(function (x) { return x[0] === tab; })) return notFound();
    var r = PM.getPrototype(me(), a.id, cap); if (!r.ok) return r.notFound ? notFound() : deniedPage(U().role === 'researcher' ? 'Researchers can open shared prototypes from the viewer page only. Source code and infrastructure are not available to you.' : 'This prototype belongs to another team or your role does not include this section.');
    var p = r.proto, body = { '': ovTab, source: srcTab, deployments: depTab, environments: envTab, access: accTab, settings: setTab, activity: actTab }[tab](p);
    return wrapTitle(protoHead(p, tab) + body, p.name);
  }
  UI.route('/p/:id', function (a) { applyNav(); var o = protoRoute(a); FE = null; return { html: personaBar() + o.html, title: o.title }; }, 'mine');
  UI.route('/p/:id/deployments/:dep', function (a) {
    applyNav(); var r = PM.getPrototype(me(), a.id, 'view'); FE = null;
    var o = r.ok ? depDetail(r.proto, a.dep) : (r.notFound ? notFound() : deniedPage());
    return { html: personaBar() + o.html, title: o.title };
  }, 'mine');
  UI.route('/p/:id/:tab', function (a) { applyNav(); var o = protoRoute(a); FE = null; return { html: personaBar() + o.html, title: o.title }; }, 'mine');

  function ovTab(p) {
    var l = PM.latestCommit(p), d = PM.deployedCommit(p), ld = PM.latestDeployment(p), lc = p.repo.commits[0], lkg = p.lastKnownGood, mg = PM.can(me(), 'manage', p), s = svc(p), notes = '';
    if (p.status === 'Failed') notes += UI.callout('bad', 'Provisioning failed.', '<a class="govuk-link" href="#/provisioning/' + p.id + '">Open the provisioning page</a> to retry.');
    if (p.status === 'Draft' || p.status === 'Provisioning') notes += UI.callout('', p.status + '.', '<a class="govuk-link" href="#/provisioning/' + p.id + '">Open the provisioning page</a>.');
    if (PM.deploymentFailed(p)) notes += UI.callout('bad', 'The latest deployment failed.', 'The live prototype is still running ' + sha(d) + ' (last known good). Latest source commit ' + sha(l) + ' is not live. ' + h(ld.errorSummary));
    else if (l && d && l !== d && PM.inFlight(p).length) notes += UI.callout('warn', 'Latest source commit is not deployed yet.', 'A deployment of ' + sha(l) + ' is ' + ld.status.toLowerCase() + '.');
    if (p.status === 'Suspended') notes += UI.callout('warn', 'Suspended.', 'Deployments and access are paused. An administrator can restore it.');
    if (p.status === 'Archived' || p.status === 'Decommissioned') notes += UI.callout('', p.status + '.', 'Hosting resources have been removed. Source is ' + (p.repo.state === 'Deleted' ? 'deleted' : 'preserved read-only') + '.');
    if (PM.ownershipGap(p)) notes += UI.callout('warn', 'This prototype has no owner.', 'DesignOps should transfer ownership.');
    var live = p.env.created && p.env.state !== 'Removed', hosted = p.status === 'Active' || p.status === 'Suspended';
    var strip = '<dl class="sumstrip"><div><dt>Status</dt><dd>' + statusTag(p) + '</dd></div><div><dt>Health</dt><dd>' + healthTag(hosted ? p.env.health : 'Not applicable') + '</dd></div><div><dt>Deployed commit</dt><dd>' + (d ? sha(d) + (l === d ? '' : ' ' + UI.tag('Behind', 'yellow')) : '<span class="muted">None</span>') + '</dd></div><div><dt>Review by</dt><dd>' + expiryCell(p) + '</dd></div><div><dt>Sharing</dt><dd>' + h(p.sharing) + '</dd></div></dl>';
    var grp = function (title, pairs) { return '<h3 class="govuk-heading-s govuk-!-margin-top-6">' + h(title) + '</h3>' + kv(pairs); };
    return notes + strip + '<div class="detail-grid"><div class="detail-main"><h2 class="govuk-heading-m">About this prototype</h2><p class="govuk-body">' + h(p.purpose) + '</p>' +
      grp('Source and deployment', [['Repository', p.repo.created ? '<a class="govuk-link" href="' + h(p.repo.url) + '" rel="noopener">' + h(p.repo.org + '/' + p.repo.name) + '</a> ' + h(p.repo.state) : 'Not created yet'],
        ['Latest commit', l ? sha(l) + ' ' + h(lc.message) + ' <span class="muted">' + t(lc.at) + ', ' + h(lc.author) + '</span>' : '\u2013'], ['Deployed commit', d ? sha(d) + (l === d ? ' ' + UI.tag('Matches latest', 'green') : ' ' + UI.tag('Differs from latest', 'yellow')) : '<span class="muted">Nothing deployed</span>'],
        ['Last known good', lkg ? sha(lkg) : '\u2013'], ['Latest deployment', ld ? '<a class="govuk-link" href="#/p/' + p.id + '/deployments/' + ld.id + '">' + h(ld.id) + '</a> ' + depTag(ld.status) + ' <span class="muted">' + t(ld.queuedAt) + '</span>' : '\u2013']]) +
      grp('Ownership and links', [['Owner', ownerName(p)], ['Team', h(p.team)], ['Service', svcLink(p)], ['Product', s ? h(s.productId) : '\u2013'], ['Work item', s ? h(s.workId) : '\u2013']].concat(p.serviceId ? [] : [['Standalone reason', h(p.standaloneReason)]])) +
      grp('Technology', [['Template', h(tpl(p.templateId).name + ' ' + p.templateVersion)], ['Runtime', h(p.env.runtime)], ['Hosting', 'Azure App Service, ' + h(p.env.region)], ['Plan', h(planLabel(p.env.plan)) + ' ' + UI.tag('No hosting charge', 'green')]]) +
      (featSummary(p.features).length ? grp('Features and integrations', featSummary(p.features)) : '') + '</div>' +
      '<div class="detail-side"><h2 class="govuk-heading-s">Live address</h2><p class="govuk-body-s">' + (live ? '<span class="sha">' + h(p.env.url) + '</span>' : '<span class="muted">Not available</span>') + '</p>' +
      '<h2 class="govuk-heading-s">Links</h2><ul class="govuk-list govuk-body-s"><li><a class="govuk-link" href="#/p/' + p.id + '/deployments">Deployments</a></li><li><a class="govuk-link" href="#/p/' + p.id + '/environments">Environment</a></li><li><a class="govuk-link" href="#/p/' + p.id + '/activity">Activity</a></li></ul></div></div>';
  }

  function menu(label, items) {
    return '<span class="plist__act"><details class="ctx"><summary class="ctx__btn"><span aria-hidden="true">\u22ef</span><span class="ctx__txt">' + h(label) + '</span></summary><ul class="ctx__menu">' + items.filter(Boolean).map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</ul></details></span>';
  }
  function menuBtn(text, act, id, extra) { return '<button type="button" class="linkbtn" data-act="' + act + '" data-id="' + id + '"' + (extra || '') + '>' + h(text) + '</button>'; }

  function srcTab(p) {
    var mg = PM.can(me(), 'push', p), r = p.repo, sim = mg && p.status === 'Active';
    if (!r.created) return UI.callout('', 'The repository has not been created yet.', 'It is created at the Create GitHub repository step of provisioning.');
    var latest = PM.latestCommit(p), openPrs = r.prs.filter(function (x) { return /open/i.test(x.state); }).length;
    var strip = '<dl class="sumstrip"><div><dt>Repository</dt><dd><a class="govuk-link" href="' + h(r.url) + '" rel="noopener">' + h(r.org + '/' + r.name) + '</a></dd></div><div><dt>Default branch</dt><dd>' + h(r.defaultBranch) + ' <span class="muted">' + h(r.visibility) + '</span></dd></div><div><dt>Latest commit</dt><dd>' + sha(latest) + '</dd></div><div><dt>Deployed commit</dt><dd>' + sha(p.env.deployedCommit) + (latest && p.env.deployedCommit && latest !== p.env.deployedCommit ? ' ' + UI.tag('Behind', 'yellow') : '') + '</dd></div><div><dt>Open pull requests</dt><dd>' + openPrs + '</dd></div></dl>';
    var tools = '<div class="row"><a class="govuk-button govuk-!-margin-bottom-0" data-module="govuk-button" href="' + h(vsLink(p)) + '">Open in VS Code</a><a class="govuk-button govuk-button--secondary govuk-!-margin-bottom-0" data-module="govuk-button" href="' + h(r.url) + '" rel="noopener">Open repository</a>' +
      menu('More', [menuBtn('Copy clone command', 'copy', p.id), menuBtn('Download example .env', 'dl-env', p.id)]) +
      (sim ? menu('Simulate', [menuBtn('Simulate push', 'push', p.id), menuBtn('Duplicate webhook delivery', 'redeliver', p.id), menuBtn('Push with missed webhook', 'push-missed', p.id), menuBtn('Reconcile with GitHub', 'reconcile', p.id)]) : '') + '</div>';
    var commits = '<ul class="elist">' + r.commits.map(function (c, i) {
      var d = PM.deploymentFor(p, c.sha);
      return '<li class="elist__row"><div class="elist__main"><div class="elist__title">' + h(c.message) + '</div><div class="elist__meta plist__dep">' + sha(c.sha) + (i === 0 ? ' ' + UI.tag('Latest', 'blue') : '') + (c.sha === p.env.deployedCommit ? ' ' + UI.tag('Deployed', 'green') : '') + ' <span class="muted">\u00b7 ' + h(c.author) + ' on ' + h(c.branch || r.defaultBranch) + ' \u00b7 ' + t(c.at) + '</span></div></div><div class="elist__act">' + (d ? depTag(d.status) + ' <a class="govuk-link" href="#/p/' + p.id + '/deployments/' + d.id + '">' + h(d.id) + '</a>' : '<span class="muted">Not deployed</span>') + '</div></li>';
    }).join('') + '</ul>';
    var branches = '<ul class="govuk-list">' + r.branches.map(function (b) { return '<li>' + h(b.name) + (b.name === r.defaultBranch ? ' ' + UI.tag('Default', 'blue') : '') + (b.protected ? ' ' + UI.tag('Protected', 'grey') : '') + ' ' + sha(b.sha) + '</li>'; }).join('') + '</ul>';
    var prs = r.prs.length ? '<ul class="govuk-list">' + r.prs.map(function (x) { return '<li>#' + h(x.id) + ' ' + h(x.title) + '<br><span class="muted">' + h(x.branch) + ' \u00b7 ' + h(x.author) + '</span> ' + UI.tag(x.state, 'blue') + '</li>'; }).join('') + '</ul>' : '<p class="govuk-body-s muted">No pull requests.</p>';
    var setup = '<ol class="govuk-list govuk-list--number govuk-body-s"><li>Install Git, Node.js 20 LTS and Visual Studio Code, and sign in to GitHub.</li><li>Clone the repository with Open in VS Code or the command above.</li><li>Run <code>npm install</code> then <code>npm run dev</code> and open http://localhost:3000.</li><li>Commit and push to <code>' + h(r.defaultBranch) + '</code> or open a pull request.</li></ol>';
    if (p.templateId === 'tpl-aspnet') setup = '<ol class="govuk-list govuk-list--number govuk-body-s"><li>Install Git, the .NET 10 SDK and Visual Studio Code, and sign in to GitHub.</li><li>Clone the repository with Open in VS Code or the command above.</li><li>Run <code>dotnet restore</code> then <code>dotnet watch run</code> and open https://localhost:5001.</li><li>Commit and push to <code>' + h(r.defaultBranch) + '</code> or open a pull request.</li></ol>';
    var events = p.repoEvents.length ? scroll(UI.table(['Delivery ID', 'Event', 'Actor', 'Commit', 'Received', 'Result', 'Duplicates'], p.repoEvents.map(function (e) { return ['<span class="sha">' + h(e.deliveryId) + '</span>', h(e.type), h(e.actor), sha(e.commitSha), t(e.receivedAt), h(e.outcome), e.duplicates]; }), 'compact')) + '<p class="govuk-hint">Deliveries are deduplicated by delivery ID. If a webhook is missed, reconciliation finds the commit from GitHub.</p>' : '<p class="govuk-body-s muted">No webhook events yet.</p>';
    return strip + tools + '<p class="govuk-hint govuk-!-margin-top-2">Prototype Manager only sees what you have pushed to GitHub, not unsaved or uncommitted work in VS Code.</p>' +
      '<div class="detail-grid"><div class="detail-main"><h2 class="govuk-heading-m">Commits</h2>' + commits + '</div><div class="detail-side">' +
      '<h2 class="govuk-heading-s">Clone</h2><pre class="code">' + h(cloneCmd(p)) + '</pre>' +
      '<h2 class="govuk-heading-s">Branches</h2>' + branches + '<h2 class="govuk-heading-s">Pull requests</h2>' + prs +
      '<details class="fold"><summary>Setup steps</summary>' + setup + '</details>' +
      '<details class="fold"><summary>Webhook events (' + p.repoEvents.length + ')</summary>' + events + '</details></div></div>';
  }

  function stageBox(label, state, detail) { var txt = { pending: 'Waiting', running: 'In progress', done: 'Done', failed: 'Failed', skipped: 'Skipped' }[state]; return '<div class="is-' + state + '"><b>' + h(label) + '</b>' + UI.tag(txt, { pending: 'grey', running: 'blue', done: 'green', failed: 'red' }[state]) + '<br><span class="muted">' + detail + '</span></div>'; }
  function depTab(p) {
    var mg = PM.can(me(), 'manage', p), sim = PM.can(me(), 'simulate', p), act = PM.inFlight(p), cur = act.length ? act[act.length - 1] : PM.latestDeployment(p), l = PM.latestCommit(p), d = PM.deployedCommit(p), lkg = p.lastKnownGood;
    var live = p.status === 'Active', lat = PM.latestDeployment(p);
    var pipe = cur ? '<p class="govuk-body"><strong>' + (act.length ? 'In progress' : 'Most recent') + ':</strong> ' + h(cur.id) + ' for commit ' + sha(cur.commitSha) + ' on ' + h(cur.branch) + ', ' + h(cur.trigger.toLowerCase()) + ' ' + depTag(cur.status) + '</p><div class="pipeline">' +
      stageBox('GitHub event', 'done', cur.trigger.indexOf('Push') === 0 || cur.trigger === 'Reconciliation' ? 'Received ' + t(cur.queuedAt) : 'Manual trigger ' + t(cur.queuedAt)) + stageBox('Build and test', cur.stages.build, 'CI result: ' + cur.ciResult) + stageBox('Azure deployment', cur.stages.deploy, cur.stages.deploy === 'done' ? 'Commit is on the App Service' : 'Not on the App Service yet') + stageBox('Health check', cur.stages.health, 'Hosted health: ' + cur.health) + '</div>' + (cur.errorSummary ? '<p class="govuk-error-message">' + h(cur.errorSummary) + '</p>' : '') : '<p class="govuk-body">No deployments yet.</p>';
    var ctl = '<div class="row">' + (sim ? btn('Simulate next stage', 'data-act="next-stage" data-id="' + p.id + '"' + (act.length && live ? '' : ' disabled aria-disabled="true"'), act.length && live ? '' : 'govuk-button--secondary') + btn('Simulate failure', 'data-act="fail-stage" data-id="' + p.id + '"' + (act.length && live ? '' : ' disabled aria-disabled="true"')) : '') +
      (mg ? btn('Retry', 'data-act="retry-dep" data-id="' + p.id + '"' + (live && lat && lat.status === 'Failed' ? '' : ' disabled aria-disabled="true"')) + btn('Roll back to last known good' + (lkg ? ' (' + lkg + ')' : ''), 'data-act="rollback" data-id="' + p.id + '"' + (live && lkg ? '' : ' disabled aria-disabled="true"')) : '') + '</div>' + (!live ? '<p class="govuk-hint">Deployment actions are only available while the prototype is active.</p>' : '');
    var lkgDep = p.deployments.filter(function (x) { return x.commitSha === lkg && x.status === 'Healthy'; })[0];
    var hist = p.deployments.length ? '<ul class="elist">' + p.deployments.map(function (x) {
      return '<li class="elist__row"><div class="elist__main"><div class="elist__title"><a class="govuk-link" href="#/p/' + p.id + '/deployments/' + x.id + '"><strong>' + h(x.id) + '</strong></a> ' + depTag(x.status) + (lkgDep && lkgDep.id === x.id ? ' ' + UI.tag('Last known good', 'green') : '') + ' <span class="sha">' + h(x.commitSha) + '</span> <span class="muted">' + h(x.branch) + '</span></div>' +
        '<div class="elist__meta plist__dep">' + depStamp(x) + ' <span class="muted">\u00b7 ' + h(x.trigger) + '</span></div>' + (x.errorSummary ? '<div class="elist__meta"><span class="govuk-error-message govuk-!-margin-0">' + h(x.errorSummary) + '</span></div>' : '') + '</div>' +
        '<div class="elist__act"><a class="govuk-link" href="#/p/' + p.id + '/deployments/' + x.id + '">View deployment</a></div></li>';
    }).join('') + '</ul>' : '<p class="govuk-body">No deployments yet.</p>';
    return '<h2 class="govuk-heading-m">Current pipeline</h2>' + pipe + ctl + '<p class="govuk-hint">Demo: stages move only when you select Simulate next stage. A passing build is not the same as a healthy prototype.</p>' +
      '<dl class="sumstrip"><div><dt>Latest source commit</dt><dd>' + sha(l) + '</dd></div><div><dt>Deployed commit</dt><dd>' + (d ? sha(d) : 'None') + ' ' + (l === d ? UI.tag('Same', 'green') : UI.tag('Differs', 'yellow')) + '</dd></div><div><dt>Last known good</dt><dd>' + (lkg ? sha(lkg) : '\u2013') + '</dd></div></dl>' +
      '<h2 class="govuk-heading-m">Deployment history</h2>' + hist;
  }
  function depDetail(p, id) {
    var x = p.deployments.filter(function (d) { return d.id === id; })[0];
    if (!x) return notFound();
    var mg = PM.can(me(), 'manage', p), c = p.repo.commits.filter(function (k) { return k.sha === x.commitSha; })[0];
    var stages = '<div class="pipeline">' + stageBox('GitHub event', 'done', 'Received ' + t(x.queuedAt)) + stageBox('Build and test', x.stages.build, 'CI result: ' + x.ciResult) + stageBox('Azure deployment', x.stages.deploy, x.stages.deploy === 'done' ? 'Commit is on the App Service' : 'Not on the App Service yet') + stageBox('Health check', x.stages.health, 'Hosted health: ' + x.health) + '</div>';
    var acts = (mg && x.status === 'Failed' && p.deployments[0] === x ? btn('Retry deployment', 'data-act="retry-dep" data-id="' + p.id + '"', '') : '') + (canRollback(p) ? btn('Roll back to ' + p.lastKnownGood, 'data-act="rollback-row" data-id="' + p.id + '"') : '');
    return wrapTitle(head(x.id, depTag(x.status) + ' ' + depStamp(x), acts) + back('#/p/' + p.id + '/deployments', 'Back to deployments') + tabs(p, 'deployments') + (x.errorSummary ? UI.callout('bad', 'This deployment failed.', h(x.errorSummary)) : '') + stages +
      '<div class="detail-grid"><div class="detail-main"><h2 class="govuk-heading-s">Commit</h2>' + kv([['SHA', sha(x.commitSha)], ['Message', c ? h(c.message) : '\u2013'], ['Author', c ? h(c.author) : '\u2013'], ['Branch', h(x.branch)]]) + '</div>' +
      '<aside class="detail-side"><h2 class="govuk-heading-s">Run</h2>' + kv([['Triggered by', h(x.actor || 'Prototype Manager')], ['Trigger', h(x.trigger)], ['Queued', when(x.queuedAt)], ['Finished', x.finishedAt ? when(x.finishedAt) : 'Not finished'], ['Run ID', '<span class="sha">' + h(x.runId) + '</span>']]) + '</aside></div>', x.id);
  }

  function envTab(p) {
    var e = p.env, mg = PM.can(me(), 'manage', p), live = p.status === 'Active' && e.state !== 'Removed', has = e.created && e.state !== 'Removed';
    var strip = '<dl class="sumstrip"><div><dt>State</dt><dd>' + h(e.state) + '</dd></div><div><dt>Health</dt><dd>' + healthTag(e.health) + '</dd></div><div><dt>Region</dt><dd>' + h(e.region) + '</dd></div><div><dt>Plan</dt><dd>' + h(planLabel(e.plan)) + '</dd></div><div><dt>Deployed commit</dt><dd>' + sha(e.deployedCommit) + '</dd></div></dl>';
    var acts = '<div class="row">' + (live ? openProto(p) : '') + (mg ? menu('Manage', [menuBtn('Restart', 'restart', p.id, live ? '' : ' disabled'), menuBtn('Redeploy current commit', 'redeploy', p.id, live && e.deployedCommit ? '' : ' disabled')]) : '') + '</div>' + (mg ? '' : '<p class="govuk-hint">Restart and redeploy need owner access.</p>');
    var grp = function (title, pairs) { return '<h3 class="govuk-heading-s govuk-!-margin-top-6">' + h(title) + '</h3>' + kv(pairs); };
    return strip + '<div class="detail-grid"><div class="detail-main"><h2 class="govuk-heading-m">' + h(e.name) + '</h2>' +
      (has ? '' : '<p class="govuk-body">' + (e.state === 'Removed' ? 'Hosting resources were removed.' : 'Not created yet.') + '</p>') +
      grp('Hosting', [['Azure resource', has ? '<span class="sha">' + h(e.appName) + '</span>' : '\u2013'], ['Resource group', h(e.resourceGroup)], ['Region', h(e.region)], ['Plan', h(planLabel(e.plan))], ['Resource ID', e.resourceId ? '<span class="sha">' + h(e.resourceId) + '</span>' : '\u2013']]) +
      grp('Runtime', [['Runtime', h(e.runtime)], ['Address', '<span class="sha">' + h(e.url) + '</span>'], ['Deployed commit', sha(e.deployedCommit)]]) +
      grp('Security', [['Access protection', h(e.accessPolicy)], ['Password', p.password ? 'Set on ' + UI.fmtDate(p.password.setAt) : 'Not set'], ['Sharing', h(p.sharing)]]) + '</div>' +
      '<div class="detail-side"><h2 class="govuk-heading-s">Actions</h2>' + acts +
      '<h2 class="govuk-heading-s govuk-!-margin-top-6">Preview environments</h2><p class="govuk-body-s">' + h(e.optionalPreviews) + '. A later extension, which would need the same access protection.</p>' +
      '<h2 class="govuk-heading-s">Cost profile</h2><p class="govuk-body-s"><strong>' + h(planLabel(e.plan)) + '</strong> in ' + h(e.region) + '. The free plan has shared compute and daily usage quotas, so it suits prototypes only. Billing is not connected in this demo.</p></div></div>';
  }

  function accTab(p) {
    var mg = PM.can(me(), 'manage', p), owner = p.ownerId ? PM.person(p.ownerId) : null, active = p.status === 'Active';
    var rows = (owner ? [{ n: owner.name, role: 'Owner', perm: 'Admin on the repository', via: 'Prototype Manager owner' }] : []).concat(p.contributors.map(function (c) { return { n: PM.person(c).name, role: 'Contributor', perm: ((p.collabRoles || {})[c] || 'Write') + ' on the repository', via: 'Collaborator', id: c }; }));
    var mgmt = '<ul class="elist">' + rows.map(function (r) { return '<li class="elist__row"><div class="elist__main"><div class="elist__title">' + h(r.n) + ' ' + UI.tag(r.role, r.role === 'Owner' ? 'blue' : 'grey') + '</div><div class="elist__meta">' + h(r.perm) + ' \u00b7 ' + h(r.via) + '</div></div><div class="elist__act">' + (r.id && mg ? chip('Remove', 'data-act="remove-collab" data-id="' + p.id + '" data-person="' + r.id + '"') : '') + '</div></li>'; }).join('') + '</ul>';
    var grants = p.accessGrants.length ? '<ul class="elist">' + p.accessGrants.map(function (g) {
      var on = PM.grantActive(g), st = g.revokedAt ? UI.tag('Revoked ' + UI.fmtDate(g.revokedAt), 'grey') : on ? UI.tag('Active', 'green') : UI.tag('Expired', 'grey');
      return '<li class="elist__row"><div class="elist__main"><div class="elist__title">' + h(g.recipientLabel) + ' ' + st + '</div><div class="elist__meta">' + h(g.role) + ' \u00b7 ' + h(g.purpose) + ' \u00b7 granted by ' + h(g.grantedBy) + ' \u00b7 expires ' + UI.fmtDate(g.expiresAt) + '</div></div><div class="elist__act">' + (on && mg ? chip('Revoke early', 'data-act="revoke" data-id="' + p.id + '" data-grant="' + g.id + '"') : '') + '</div></li>';
    }).join('') + '</ul>' : '<p class="govuk-body muted">No individual viewer access has been granted.</p>';
    var pw = p.password;
    var pwRow = '<div class="elist__row"><div class="elist__main"><div class="elist__title">Prototype password ' + (pw ? UI.tag('Set', 'green') : UI.tag('Not set', 'grey')) + '</div><div class="elist__meta">' + (pw ? 'Set by ' + h(pw.setBy) + ' on ' + UI.fmtDate(pw.setAt) + (pw.expiresAt ? ' \u00b7 expires ' + UI.fmtDate(pw.expiresAt) : ' \u00b7 no expiry') + ' \u00b7 the password is never shown' : 'Anyone with the password can open the hosted prototype.') + '</div></div><div class="elist__act">' + (mg && active ? btn(pw ? 'Change password' : 'Set prototype password', 'data-act="open-pw" data-id="' + p.id + '"') : '') + '</div></div>';
    var aud = S().audit.filter(function (a) { return a.entityId === p.id; }).slice(0, 8);
    var audit = aud.length ? '<ul class="elist">' + aud.map(function (a) { return '<li class="elist__row"><div class="elist__main"><div class="elist__title">' + h(a.action) + '</div><div class="elist__meta">' + h(a.actorName) + ' \u00b7 ' + t(a.at) + (a.detail ? ' \u00b7 ' + h(a.detail) : '') + '</div></div></li>'; }).join('') + '</ul>' : '<p class="govuk-body muted">No access changes recorded.</p>';
    return '<p class="govuk-body">Management access controls who can change the prototype. Viewer access controls who can open it. Repository access does not give viewer access, and viewer access gives no source access.</p>' +
      '<div class="sect"><div class="sect__head"><h2 class="govuk-heading-m">Management access</h2>' + (mg ? btn('Add collaborator', 'data-act="open-collab" data-id="' + p.id + '"') : '') + '</div>' + mgmt + (PM.levelFor(me(), p) === 'lead' ? '<p class="govuk-hint">You can view access as a team lead but not change it.</p>' : '') + '</div>' +
      '<div class="sect"><div class="sect__head"><h2 class="govuk-heading-m">Viewer access</h2>' + (mg && active ? btn('Add research access', 'data-act="open-research" data-id="' + p.id + '"') : '') + '</div><p class="govuk-hint">Sharing: ' + h(p.sharing) + '. Protection: ' + h(p.env.accessPolicy) + '. Access codes are never shown.</p><ul class="elist">' + pwRow.replace(/^<div class="elist__row">/, '<li class="elist__row">').replace(/<\/div>$/, '</li>') + '</ul>' + grants + '</div>' +
      '<div class="sect"><h2 class="govuk-heading-m">Access audit</h2>' + audit + '</div>';
  }

  function accModal(kind, p) {
    var people = S().people.filter(function (x) { return x.role !== 'researcher' && x.id !== p.ownerId && p.contributors.indexOf(x.id) < 0 && x.role !== 'designops' && x.role !== 'platform'; });
    var researchers = S().people.filter(function (x) { return x.role === 'researcher'; }), v = function (n, d) { return feVal(kind, n, d); }, f = '<form data-form="' + kind + '" data-id="' + p.id + '" novalidate>' + fsum(kind), pol = S().policy;
    if (kind === 'collab') return UI.modal('Add collaborator', f + UI.select('person', 'Person', people.map(function (x) { return { value: x.id, label: x.name + ', ' + x.team }; }), v('person', ''), {}) + UI.select('role', 'Repository permission', [{ value: 'Write', label: 'Write' }, { value: 'Read', label: 'Read' }], v('role', 'Write'), { hint: 'Gives repository access only, not access to the hosted prototype.' }) + '<button class="govuk-button" data-module="govuk-button">Add collaborator</button></form>');
    if (kind === 'pw') return UI.modal(p.password ? 'Change prototype password' : 'Set prototype password', f + '<p class="govuk-hint">Anyone with this password can open the hosted prototype. It is stored hashed and never shown again.</p>' + UI.input('password', 'Password', '', { type: 'password', err: feMsg(kind, 'password'), hint: 'At least 8 characters' }) + UI.input('confirm', 'Confirm password', '', { type: 'password', err: feMsg(kind, 'confirm') }) + UI.input('expiresAt', 'Expires on (optional)', v('expiresAt', ''), { err: feMsg(kind, 'expiresAt'), hint: 'YYYY-MM-DD', cls: 'govuk-input--width-10' }) + '<button class="govuk-button" data-module="govuk-button">Save password</button></form>');
    return UI.modal('Add research access', f + UI.select('recipient', 'Who is it for?', [{ value: '', label: 'Enter a group label below' }].concat(researchers.map(function (x) { return { value: x.id, label: x.name + ' (researcher)' }; })), v('recipient', ''), { err: feMsg(kind, 'recipient'), hint: 'Avoid storing participant identities.' }) + UI.input('label', 'Or a group label', v('label', '')) + UI.input('purpose', 'Purpose', v('purpose', ''), { err: feMsg(kind, 'purpose') }) + UI.input('expiresAt', 'Expires on', v('expiresAt', ''), { err: feMsg(kind, 'expiresAt'), hint: 'YYYY-MM-DD, at most ' + pol.expiry.researchMaxDays + ' days from today', cls: 'govuk-input--width-10' }) + '<button class="govuk-button" data-module="govuk-button">Create research access</button></form>');
  }

  function setTab(p) {
    var mg = PM.can(me(), 'manage', p), lead = PM.levelFor(me(), p) === 'lead', v = function (n, d) { return feVal('meta', n, d); };
    var meta = mg ? fsum('meta') + '<form data-form="meta" data-id="' + p.id + '" novalidate>' + UI.input('name', 'Name', v('name', p.name), { err: feMsg('meta', 'name') }) + UI.textarea('purpose', 'Purpose', v('purpose', p.purpose), { err: feMsg('meta', 'purpose') }) + UI.input('reviewAt', 'Review date', v('reviewAt', p.reviewAt), { err: feMsg('meta', 'reviewAt'), hint: 'YYYY-MM-DD', cls: 'govuk-input--width-10' }) + UI.input('tags', 'Tags', v('tags', p.tags.join(', '))) + '<button class="govuk-button" data-module="govuk-button">Save settings</button></form>'
      : kv([['Name', h(p.name)], ['Purpose', h(p.purpose)], ['Review date', UI.fmtDate(p.reviewAt)], ['Tags', h(p.tags.join(', '))]]);
    var cands = S().people.filter(function (x) { return x.role !== 'researcher' && x.id !== p.ownerId; });
    var tr = p.transferRequest ? UI.callout('warn', 'Transfer pending.', 'Requested by ' + h(p.transferRequest.by) + ' to ' + h(PM.person(p.transferRequest.to).name) + '. A team lead or administrator must approve it.' + (lead || PM.isAdmin(me()) ? ' ' + btn('Approve transfer', 'data-act="approve-transfer" data-id="' + p.id + '"') : '')) : '';
    var xfer = tr + (mg && !p.transferRequest ? '<form class="row" data-form="transfer" data-id="' + p.id + '"><label class="govuk-label govuk-!-margin-0" for="xfer-to">New owner</label><select class="govuk-select" id="xfer-to" name="to">' + cands.map(function (x) { return '<option value="' + x.id + '">' + h(x.name + ', ' + x.team) + '</option>'; }).join('') + '</select><button class="govuk-button govuk-button--secondary govuk-!-margin-bottom-0" data-module="govuk-button">Request transfer</button></form>' : '');
    var arch = p.archiveRequest ? UI.callout('warn', 'Archive requested.', 'By ' + h(p.archiveRequest.by) + ' on ' + t(p.archiveRequest.at) + '. A DesignOps administrator will review it in Lifecycle.') : (mg && ['Active', 'Suspended'].indexOf(p.status) > -1 ? '<p class="govuk-body">Archiving keeps your source and metadata, and removes the Azure hosting. Only an administrator can complete it.</p>' + btn('Request archive', 'data-act="request-archive" data-id="' + p.id + '"') : '<p class="govuk-body muted">Archive cannot be requested in the current state.</p>');
    return (lead ? UI.callout('', 'Read-only for team leads.', 'You can approve ownership transfers for your team.') : '') + UI.panel('Metadata', meta) + UI.panel('Policy', kv([['Region', h(p.env.region) + ' (policy: ' + h(S().policy.regions.join(', ')) + ')'], ['Maximum review period', S().policy.expiry.maxDays + ' days'], ['Repository organisation', h(p.repo.org)], ['Retention', 'Source and metadata are kept on archive']])) + UI.panel('Transfer ownership', xfer || '<p class="muted">Only the owner can request a transfer.</p>') + UI.panel('Archive', arch) +
      '<p class="govuk-body">Decommissioning is an administrator action. <a class="govuk-link" href="#/about">About this demo</a></p>';
  }
  function actTab(p) {
    var f = filters.act || 'all', kinds = { repo: ['GitHub', 'purple'], workflow: ['Workflow', 'blue'], user: ['User', 'grey'], platform: ['Platform', 'turquoise'] };
    var items = p.activity.filter(function (a) { return f === 'all' || (f === 'people' ? a.kind === 'user' : a.kind !== 'user'); });
    var days = [], by = {};
    items.forEach(function (a) { var d = String(a.at).slice(0, 10); if (!by[d]) { by[d] = []; days.push(d); } by[d].push(a); });
    var body = days.length ? days.map(function (d) {
      return '<h3 class="govuk-heading-s govuk-!-margin-top-5 govuk-!-margin-bottom-1">' + UI.fmtDate(d) + '</h3><ul class="elist">' + by[d].map(function (a) {
        var k = kinds[a.kind] || [a.kind, 'grey'];
        return '<li class="elist__row' + (/failed/i.test(a.text) ? ' is-warn' : '') + '"><div class="elist__main"><div class="elist__title">' + h(a.text) + '</div><div class="elist__meta">' + h(a.actor) + ' \u00b7 ' + UI.fmtTime(a.at).replace(/^.*(?: at |, )/, '') + '</div></div><div class="elist__act">' + UI.tag(k[0], k[1]) + '</div></li>';
      }).join('') + '</ul>';
    }).join('') : '<p class="govuk-body muted">No activity to show.</p>';
    return '<div class="toolbar toolbar--one">' + UI.seg([{ id: 'all', label: 'All' }, { id: 'people', label: 'People' }, { id: 'system', label: 'System' }], f, 'actf') + '<span class="muted">' + items.length + ' event' + (items.length === 1 ? '' : 's') + '</span></div>' + body;
  }

  /* ---------- Researcher viewer page ---------- */
  R('/view/:id', 'mine', function (a) {
    var r = PM.getPrototype(me(), a.id, 'viewer'); if (!r.ok) return r.notFound ? notFound() : deniedPage('You have not been given access to this prototype, or your access has ended.');
    var p = r.proto, g = p.accessGrants.filter(function (x) { return x.recipientId === me() && PM.grantActive(x); })[0];
    return wrapTitle(head(p.name, 'Shared for research. This is a prototype, not a real government service.') + back('#/', 'Back') + UI.callout('warn', 'Prototype for research only.', 'Do not enter real personal data. Use the test details your researcher gave you.') +
      UI.panel('Viewer access', kv([['Purpose', h(p.purpose)], ['Your access ends', g ? UI.fmtDate(g.expiresAt) : 'Not applicable (team access)'], ['Access code', '<span class="mask">\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022</span> <span class="muted">Supplied separately by the research team, never shown here</span>'], ['Prototype', p.status === 'Active' ? openProto(p) : 'Not available']]) +
        '<p class="govuk-hint">Viewer access lets you open the hosted prototype only. Source code and infrastructure are not available.</p>'), 'Shared prototype');
  });

  /* ---------- Admin ---------- */
  function adminTable(rows) {
    return scroll(UI.table(['Prototype', 'Team and owner', 'Status', 'Latest deployment', 'Review by', 'Last activity', 'Flags', 'Inspect'], rows.map(function (p) {
      var fl = []; if (PM.deploymentFailed(p)) fl.push(UI.tag('Failed deployment', 'red')); if (PM.isExpired(p)) fl.push(UI.tag('Review expired', 'red')); else if (PM.isExpiring(p)) fl.push(UI.tag('Expiring', 'yellow')); if (PM.ownershipGap(p)) fl.push(UI.tag('No owner', 'red')); if (PM.isInactive(p)) fl.push(UI.tag('Inactive repository', 'grey'));
      var ld = PM.latestDeployment(p);
      return ['<strong>' + h(p.name) + '</strong><br><span class="muted">' + h(p.id) + ' · ' + h(tpl(p.templateId).name) + '</span>', h(p.team) + '<br>' + ownerName(p), statusTag(p), ld ? depTag(ld.status) + '<br>' + sha(ld.commitSha) : '\u2013', UI.fmtDate(p.reviewAt), t(p.lastActivityAt), fl.join(' ') || '<span class="muted">None</span>', '<a class="govuk-link" href="#/p/' + p.id + '">Inspect</a><br><a class="govuk-link" href="#/admin/lifecycle">Lifecycle</a>'];
    }), 'compact'));
  }
  function group(list, keyFn) { var o = {}; list.forEach(function (p) { var k = keyFn(p); o[k] = (o[k] || []).concat([p]); }); return o; }
  R('/admin', 'admin', adminOnly(function () {
    var all = PM.all(me()), cnt = function (st) { return all.filter(function (p) { return p.status === st; }).length; };
    var rows = all.filter(function (p) { return match(p, adminF); }), hosted = all.filter(function (p) { return p.env.created && p.env.state !== 'Removed'; });
    var deps = [].concat.apply([], all.map(function (p) { return p.deployments; })), ok = deps.filter(function (d) { return d.status === 'Healthy'; }).length, bad = deps.filter(function (d) { return d.status === 'Failed'; }).length;
    var by = function (fn, label) { var g = group(all, fn); return UI.table([label, 'Prototypes', 'Active', 'Failed deployment'], Object.keys(g).sort().map(function (k) { return [h(k), g[k].length, g[k].filter(function (p) { return p.status === 'Active'; }).length, g[k].filter(PM.deploymentFailed).length]; }), 'compact'); };
    var opt = function (list, val, any) { return '<option value="">' + any + '</option>' + list.map(function (x) { return '<option value="' + h(x[0]) + '"' + (x[0] === val ? ' selected' : '') + '>' + h(x[1]) + '</option>'; }).join(''); };
    var teams = Object.keys(group(all, function (p) { return p.team; })).sort();
    return wrapTitle(head('Estate dashboard', 'Portfolio oversight across all teams. ' + UI.tag('Demo data', 'orange')) +
      '<dl class="sumstrip">' + [['Total', all.length], ['Active', cnt('Active')], ['Provisioning', cnt('Provisioning')], ['Failed provisioning', cnt('Failed')], ['Suspended', cnt('Suspended')], ['Archived', cnt('Archived')]].map(function (x) { return '<div><dt>' + x[0] + '</dt><dd class="sumstrip__big">' + x[1] + '</dd></div>'; }).join('') + '</dl>' +
      '<h2 class="govuk-heading-s govuk-!-margin-top-4">Needs attention</h2><dl class="sumstrip">' + [['Failed latest deployment', all.filter(PM.deploymentFailed).length], ['Review expiring in 14 days', all.filter(PM.isExpiring).length], ['Review expired', all.filter(PM.isExpired).length], ['No owner', all.filter(PM.ownershipGap).length], ['Inactive for 60 days', all.filter(PM.isInactive).length]].map(function (x) { return '<div><dt>' + x[0] + '</dt><dd class="sumstrip__big' + (x[1] ? ' is-warn' : '') + '">' + x[1] + '</dd></div>'; }).join('') + '</dl>' +
      '<div class="grid-2">' + UI.panel('By team', by(function (p) { return p.team; }, 'Team')) + UI.panel('By template', by(function (p) { return tpl(p.templateId).name; }, 'Template')) + '</div><div class="grid-2">' +
      UI.panel('Deployments', kv([['Total recorded', deps.length], ['Healthy', ok], ['Failed', bad], ['Success rate', deps.length ? Math.round(100 * ok / (ok + bad || 1)) + '% of finished deployments' : '\u2013']]) + '<p class="govuk-hint">Counts come from the simulated deployment history.</p>') +
      UI.panel('Hosting cost category summary', UI.table(['Cost category', 'Hosted environments'], ['Free'].map(function (c) { return [c, hosted.filter(function (p) { return p.env.costCategory === c; }).length]; }), 'compact') + '<p class="govuk-hint">Limitation: categories are indicative, based on plan size only. They are not prices. Azure billing data is not connected in this demo, and no resource is assumed to be free.</p>') + '</div>' +
      UI.panel('Portfolio', '<div class="toolbar"><div class="row"><label class="govuk-label govuk-!-margin-0" for="af-q">Search</label><input class="govuk-input govuk-input--width-20" id="af-q" type="search" value="' + h(adminF.q) + '">' +
        '<select class="govuk-select" id="af-team" aria-label="Team">' + opt(teams.map(function (x) { return [x, x]; }), adminF.team, 'All teams') + '</select><select class="govuk-select" id="af-status" aria-label="Status">' + opt(STATUSES.map(function (x) { return [x, x === 'Failed' ? 'Failed provisioning' : x]; }), adminF.status, 'All statuses') + '</select>' +
        '<select class="govuk-select" id="af-tpl" aria-label="Template">' + opt(S().templates.map(function (x) { return [x.id, x.name]; }), adminF.tpl, 'All templates') + '</select><select class="govuk-select" id="af-flag" aria-label="Attention">' + opt([['failed', 'Failed deployment'], ['expiring', 'Review expiring'], ['expired', 'Review expired'], ['noowner', 'No owner'], ['inactive', 'Inactive repository']], adminF.flag, 'Any attention flag') + '</select></div></div><div id="alist">' + (rows.length ? adminTable(rows) : UI.callout('', 'No prototypes match.', 'Change the filters.')) + '</div>'), 'Estate dashboard');
  }));

  R('/admin/templates', 'templates', adminOnly(function () {
    var v = function (n) { return feVal('tplAdd', n, ''); };
    var rows = S().templates.map(function (x) {
      var used = S().prototypes.filter(function (p) { return p.templateId === x.id; }).length;
      return ['<strong>' + h(x.name) + '</strong><br><span class="muted">' + h(x.id) + '</span>', h(x.framework) + '<br>' + h(x.runtime), '<form class="row" data-form="pin" data-id="' + x.id + '"><label class="govuk-visually-hidden" for="pin-' + x.id + '">Pinned version</label><select class="govuk-select" id="pin-' + x.id + '" name="v">' + x.versions.map(function (ver) { return '<option' + (ver === x.pinned ? ' selected' : '') + '>' + h(ver) + '</option>'; }).join('') + '</select><button class="chip">Pin</button></form>',
        UI.tag(x.status, x.status === 'Approved' ? 'green' : 'yellow') + ' ' + UI.tag(x.enabled ? 'Enabled' : 'Disabled', x.enabled ? 'green' : 'grey'), '<code>' + h(x.buildCommand) + '</code><br><code>' + h(x.startCommand) + '</code><br>Health ' + h(x.healthCheck) + '<br>Licence ' + h(x.licence), h(x.hosting), used,
        (x.status === 'Draft' ? chip('Approve', 'data-act="tpl-approve" data-id="' + x.id + '"') + ' ' : '') + chip(x.enabled ? 'Disable' : 'Enable', 'data-act="tpl-toggle" data-id="' + x.id + '" data-on="' + (x.enabled ? '' : '1') + '"')];
    });
    return wrapTitle(head('Templates', 'Approved starter kits. Pinning a version changes new prototypes only; existing prototypes are not upgraded automatically.') + UI.callout('', 'Hosting note.', 'The standard GOV.UK Prototype Kit is server-rendered and needs a Node.js-capable host. Static-only hosting would not run it unchanged.') +
      scroll(UI.table(['Template', 'Framework and runtime', 'Pinned version', 'Status', 'Commands and checks', 'Hosting', 'Prototypes', 'Actions'], rows, 'compact')) +
      UI.panel('Add a template', fsum('tplAdd') + '<form data-form="tplAdd" novalidate>' + UI.input('tname', 'Template name', v('tname'), { err: feMsg('tplAdd', 'tname') }) + UI.input('tframework', 'Framework', v('tframework'), { err: feMsg('tplAdd', 'tframework'), hint: 'For example, Node.js' }) + UI.input('tversion', 'Version', v('tversion'), { err: feMsg('tplAdd', 'tversion'), hint: 'For example, 1.0.0', cls: 'govuk-input--width-10' }) +
        UI.input('tbuild', 'Build command', v('tbuild')) + UI.input('tstart', 'Start command', v('tstart'), { err: feMsg('tplAdd', 'tstart') }) + '<p class="govuk-hint">New templates are added as drafts and disabled until approved.</p><button class="govuk-button" data-module="govuk-button">Add draft template</button></form>'), 'Templates');
  }));

  function connRow(c) { return [h(c.name), UI.tag(c.status, c.status === 'Connected' ? 'green' : 'yellow') + ' ' + UI.tag('Demo', 'orange'), h(c.detail), t(c.lastCheck)]; }
  R('/admin/policies', 'policies', adminOnly(function () {
    var pol = S().policy, u = U(), v = function (n, d) { return feVal('expiry', n, d); }, plat = u.role === 'platform';
    var avail = pol.regionOptions.filter(function (r) { return pol.regions.indexOf(r) < 0; });
    return wrapTitle(head('Policies and connections', 'Defaults that apply to new prototypes. Changes are audited.') +
      '<div class="grid-2">' + UI.panel('Allowed regions', '<ul class="govuk-list">' + pol.regions.map(function (r) { return '<li>' + h(r) + (r === pol.defaultRegion ? ' ' + UI.tag('Default', 'blue') : ' ' + chip('Remove', 'data-act="region-remove" data-region="' + h(r) + '"')) + '</li>'; }).join('') + '</ul>' +
        (avail.length ? '<form class="row" data-form="region"><label class="govuk-label govuk-!-margin-0" for="region-add">Add region</label><select class="govuk-select" id="region-add" name="region">' + avail.map(function (r) { return '<option>' + h(r) + '</option>'; }).join('') + '</select><button class="govuk-button govuk-button--secondary govuk-!-margin-bottom-0" data-module="govuk-button">Add</button></form>' : '')) +
      UI.panel('Approved GitHub organisations', '<ul class="govuk-list">' + pol.approvedOrgs.map(function (o) { return '<li><span class="sha">' + h(o) + '</span> ' + chip('Remove', 'data-act="org-remove" data-org="' + h(o) + '"') + '</li>'; }).join('') + '</ul>' + fsum('org') +
        '<form data-form="org" novalidate>' + UI.input('org', 'Add organisation', v2('org', ''), { err: feMsg('org', 'org'), hint: 'The GitHub App must already be installed on it. Try example-dfe-research (installed) or acme-labs (not installed).', cls: 'govuk-input--width-20' }) + '<button class="govuk-button govuk-button--secondary" data-module="govuk-button">Validate and add</button></form>') + '</div>' +
      UI.panel('Expiry, review and quotas', fsum('expiry') + '<form data-form="expiry" novalidate><div class="row">' + UI.input('defaultDays', 'Default expiry (days)', v('defaultDays', pol.expiry.defaultDays), { err: feMsg('expiry', 'defaultDays'), cls: 'govuk-input--width-5' }) + UI.input('maxDays', 'Maximum expiry (days)', v('maxDays', pol.expiry.maxDays), { err: feMsg('expiry', 'maxDays'), cls: 'govuk-input--width-5' }) +
        UI.input('researchMaxDays', 'Research access limit (days)', v('researchMaxDays', pol.expiry.researchMaxDays), { err: feMsg('expiry', 'researchMaxDays'), cls: 'govuk-input--width-5' }) + UI.input('perTeam', 'Active prototypes per team', v('perTeam', pol.quotas.perTeam), { err: feMsg('expiry', 'perTeam'), cls: 'govuk-input--width-5' }) + '</div><button class="govuk-button govuk-button--secondary" data-module="govuk-button">Save policy</button></form>') +
      UI.panel('Environment profiles', UI.table(['Profile', 'Plan', 'Cost category'], pol.profiles.map(function (x) { return [h(x.label), h(x.plan + ' \u00b7 ' + pol.defaultRegion), h(x.category) + ' <span class="muted">(indicative, not a price)</span>']; }), 'compact')) +
      UI.panel('Connection health (simulated)', UI.table(['Connection', 'Status', 'Detail', 'Last check'], [connRow(PM.GitHubProvider.checkConnection()), connRow(PM.AzureProvider.checkConnection())], 'compact') +
        (plat ? '<div class="row">' + btn('Run health check', 'data-act="conn-check"') + btn('Toggle simulated GitHub degradation', 'data-act="conn-toggle" data-which="github"') + btn('Toggle simulated Azure degradation', 'data-act="conn-toggle" data-which="azure"') + '</div>' : '<p class="govuk-hint">Only platform administrators can run connection checks.</p>')), 'Policies');
    function v2(n, d) { return feVal('org', n, d); }
  }));

  var LIFE_TEXT = { suspend: 'Pauses the hosted prototype. Source, metadata and access grants are kept.', restore: 'Returns the prototype to active. A restore from archive re-creates hosting (simulated) and queues a deployment of the latest commit.', transfer: 'Changes the owner and owning team.', archive: 'Preserves source and metadata, and removes the Azure hosting resources in the record to reduce cost.', decommission: 'Removes access, deletes hosting resources and records a repository decision. This is audited and cannot be undone here.' };
  function lifePage(a) {
    var pending = S().prototypes.filter(function (p) { return p.archiveRequest || p.transferRequest; });
    var all = PM.all(me()).filter(function (p) { return p.status !== 'Decommissioned'; });
    var list = UI.panel('Prototypes', scroll(UI.table(['Prototype', 'Status', 'Owner', 'Actions'], all.map(function (p) {
      return [h(p.name) + '<br><span class="muted">' + h(p.id) + '</span>', statusTag(p), ownerName(p), ['suspend', 'restore', 'transfer', 'archive', 'decommission'].filter(function (o) { return PM.OPS[o].indexOf(p.status) > -1; }).map(function (o) { return '<a class="govuk-link" href="#/admin/lifecycle/' + p.id + '/' + o + '">' + o.charAt(0).toUpperCase() + o.slice(1) + '</a>'; }).join(' · ')];
    }), 'compact')));
    var reqs = UI.panel('Requests waiting', pending.length ? UI.table(['Prototype', 'Request', 'By'], pending.map(function (p) { return [h(p.name), p.archiveRequest ? 'Archive: <a class="govuk-link" href="#/admin/lifecycle/' + p.id + '/archive">review</a>' : 'Transfer to ' + h(PM.person(p.transferRequest.to).name) + ' ' + btn('Approve', 'data-act="approve-transfer" data-id="' + p.id + '"'), h((p.archiveRequest || p.transferRequest).by)]; }), 'compact') : '<p class="govuk-body">No requests waiting.</p>');
    var form = '';
    if (a && a.id) {
      var p = PM.proto(a.id), op = a.op;
      if (!p || !PM.OPS[op]) form = UI.callout('bad', 'Unknown prototype or action.', '');
      else if (PM.OPS[op].indexOf(p.status) < 0) form = UI.callout('bad', 'Not available.', 'You cannot ' + op + ' a prototype that is ' + h(PM.statusLabel(p).toLowerCase()) + '.');
      else {
        var im = PM.impact(p), v = function (n, d) { return feVal('life', n, d); };
        form = UI.panel(op.charAt(0).toUpperCase() + op.slice(1) + ': ' + h(p.name), '<p class="govuk-body">' + LIFE_TEXT[op] + '</p>' + '<h3 class="govuk-heading-s">Impact check</h3>' + kv([['Hosting resource', im.hosting ? h(im.hosting) : 'None'], ['Active access grants', im.activeGrants], ['Open pull requests', im.openPrs], ['Deployments in progress', im.inFlight], ['Contributors with repository access', im.contributors], ['Linked service and work item', h((im.service || 'None') + ' / ' + (im.work || 'None'))], ['Owner', ownerName(p)]]) +
          (im.activeGrants || im.openPrs || im.inFlight ? UI.callout('warn', 'Check these before continuing.', 'There are active grants, open pull requests or deployments in progress.') : '') + fsum('life') +
          '<form data-form="life" data-id="' + p.id + '" data-op="' + op + '" novalidate>' + (op === 'transfer' ? UI.select('toId', 'New owner', [{ value: '', label: 'Select a person' }].concat(S().people.filter(function (x) { return x.role !== 'researcher' && x.id !== p.ownerId; }).map(function (x) { return { value: x.id, label: x.name + ', ' + x.team }; })), v('toId', ''), { err: feMsg('life', 'toId') }) : '') +
          (op === 'decommission' ? UI.radios('repoDecision', 'Repository decision', [{ value: 'archive', label: 'Archive the repository (read-only, source preserved)' }, { value: 'delete', label: 'Delete the repository' }], v('repoDecision', 'archive')) : '') + UI.textarea('reason', 'Reason (recorded in the audit)', v('reason', ''), { err: feMsg('life', 'reason') }) +
          '<div class="govuk-form-group' + (feMsg('life', 'confirm') ? ' govuk-form-group--error' : '') + '">' + (feMsg('life', 'confirm') ? '<p class="govuk-error-message"><span class="govuk-visually-hidden">Error:</span> ' + h(feMsg('life', 'confirm')) + '</p>' : '') + '<div class="govuk-checkboxes govuk-checkboxes--small"><div class="govuk-checkboxes__item"><input class="govuk-checkboxes__input" id="confirm" name="confirm" type="checkbox" value="yes"><label class="govuk-label govuk-checkboxes__label" for="confirm">I have checked the impact and I authorise this action as ' + h(U().name) + '</label></div></div></div>' +
          '<button class="govuk-button' + (op === 'decommission' ? ' govuk-button--warning' : '') + '" data-module="govuk-button">' + op.charAt(0).toUpperCase() + op.slice(1) + '</button> <a class="govuk-link" href="#/admin/lifecycle">Cancel</a></form>');
      }
    }
    return wrapTitle(head('Lifecycle', 'Controlled actions with an impact check, confirmation and an audit record of who authorised them.') + form + reqs + list, 'Lifecycle');
  }
  R('/admin/lifecycle', 'lifecycle', adminOnly(function () { return lifePage(null); }));
  R('/admin/lifecycle/:id/:op', 'lifecycle', adminOnly(function (a) { return lifePage(a); }));

  R('/admin/audit', 'audit', adminOnly(function () {
    var rows = S().audit.filter(function (x) { return !auditQ || (x.actorName + ' ' + x.action + ' ' + x.entityId + ' ' + x.detail + ' ' + x.result).toLowerCase().indexOf(auditQ.toLowerCase()) > -1; });
    return wrapTitle(head('Audit', 'Every administrative and sensitive action, including denied attempts.') + '<div class="toolbar"><div class="row"><label class="govuk-label govuk-!-margin-0" for="audit-q">Filter</label><input class="govuk-input govuk-input--width-20" id="audit-q" type="search" value="' + h(auditQ) + '"></div></div>' +
      '<div id="audit-list">' + auditTable(rows) + '</div>', 'Audit');
  }));
  function auditTable(rows) { return scroll(UI.table(['When', 'Who', 'Action', 'Entity', 'Result', 'Detail'], rows.slice(0, 150).map(function (x) { return [t(x.at), h(x.actorName), '<code>' + h(x.action) + '</code>', h(x.entityId), UI.tag(x.result, x.result === 'Success' ? 'green' : x.result === 'Denied' ? 'red' : 'orange'), h(x.detail)]; }), 'compact')); }

  R('/api', 'api', adminOnly(function () {
    var ev = PM.integrationEvents(me()).filter(function (e) { return e.type === 'prototype.status.changed'; });
    return wrapTitle(head('Reporting feed', 'A read-only preview of what the central service register or work platform could consume. It contains no secrets or access codes.') +
      UI.callout('', 'Demo.', 'Nothing is sent anywhere. In a real service this would be an authenticated read-only API and an event stream for approved reporting consumers.') + UI.panel('GET /api/prototypes (preview)', '<pre class="code" tabindex="0">' + h(JSON.stringify(PM.feed(), null, 2)) + '</pre>') +
      UI.panel('Events: prototype.status.changed', scroll(UI.table(['Event', 'Prototype', 'From', 'To', 'Service', 'Work item', 'When'], ev.map(function (e) { return [h(e.type), h(e.prototypeId), h(e.from || '\u2013'), h(e.to), h(e.serviceId || '\u2013'), h(e.workId || '\u2013'), t(e.at)]; }), 'compact'))), 'Reporting feed');
  }));

  R('/about', 'about', function () {
    var rows = [['That pushing a commit guarantees a successful deployment', 'A push only queues a deployment. Build, deployment and health check can each fail, and the dashboard shows each result.'], ['That local uncommitted VS Code edits are visible to the platform', 'Only pushed commits are visible. A local integration would need explicit installation and authorisation.'],
      ['That a browser link can bypass installation, Git authentication or local setup', 'Open in VS Code needs VS Code, Git and a GitHub sign-in on your own computer.'], ['That static-only hosting runs the standard GOV.UK Prototype Kit unchanged', 'The kit is a server-rendered Node.js application. It is hosted on Azure App Service.'],
      ['That repository membership automatically gives Azure or preview access', 'Management access and viewer access are separate models, granted separately.'], ['That Azure App Service, GitHub Actions or related resources are always free', 'Only indicative cost categories are shown. Billing is not connected.'], ['That prototypes can contain live user data or are production-ready services', 'Use synthetic data only. Prototypes are for testing ideas and are clearly labelled.']];
    var roles = [['Designer (owner)', 'Creates and manages own prototypes, invites collaborators, shares for research, requests archive'], ['Contributor', 'Views permitted prototypes and builds, pushes code'], ['Researcher', 'Opens shared prototypes only. No source or infrastructure'], ['Team lead', 'Views the team portfolio and approves ownership transfers'], ['DesignOps administrator', 'Templates, policies, estate, lifecycle, audit'], ['Platform administrator', 'As DesignOps, plus connection checks to GitHub and Azure']];
    var prov = ['GitHubProvider', 'AzureProvider', 'ServiceLookup'].map(function (n) { var chk = PM.checkProvider(n), impl = PM[n]; return [n, h(impl.label), chk.map(function (c) { return '<code>' + h(c.method) + '</code>' + (c.implemented ? '' : ' (missing)'); }).join(', ')]; });
    return wrapTitle(head('About this demo', 'Prototype Manager is a demonstration of a self-service way to create, develop, deploy, share and retire service prototypes.') +
      UI.callout('warn', 'Demo: simulated GitHub and Azure, nothing is real.', 'No GitHub or Azure API is called, no money is spent and no repository exists. All data is fictional and stored in your browser. Use Reset demo data in the footer to start again.') +
      UI.panel('What this prototype does not imply', '<ul class="govuk-list govuk-list--bullet">' + rows.map(function (r) { return '<li><strong>' + h(r[0]) + '.</strong> ' + h(r[1]) + '</li>'; }).join('') + '</ul>') +
      UI.panel('Who owns what', '<ul class="govuk-list govuk-list--bullet"><li>Prototype Manager owns prototype metadata and operations.</li><li>GitHub owns source and source history.</li><li>Azure owns hosting state.</li><li>The service register owns service and product identity.</li><li>Work management owns work records.</li></ul>') +
      UI.panel('Personas', UI.table(['Role', 'Rights in this demo'], roles.map(function (r) { return [h(r[0]), h(r[1])]; }), 'compact')) +
      UI.panel('Mock providers (replaceable interfaces)', UI.table(['Interface', 'Demo implementation', 'Methods'], prov, 'compact') + '<p class="govuk-hint">Each provider can be swapped for an authenticated GitHub App client, Azure resource-management client or the service register API without changing the screens.</p>'), 'About this demo');
  });

  /* ---------- Events ---------- */
  function flashRes(r, ok) { UI.render(); if (r.ok) UI.flash(ok, 'ok'); else UI.flash(h(r.error || 'Something went wrong.'), r.denied ? 'bad' : 'warn'); }
  function partial(sel, html) { var el = document.querySelector(sel); if (el) el.innerHTML = html; }
  function envText(p) {
    var e = p.env, slug = String(p.repo.name || p.id).toLowerCase();
    return ['# Example environment file for ' + p.name + ' (' + p.id + ')',
      '# Demo values only. Copy to .env, then replace anything marked CHANGE_ME. Never commit .env.', '',
      'NODE_ENV=development', 'PORT=3000', 'APP_NAME=' + e.appName, 'PROTOTYPE_ID=' + p.id, 'PROTOTYPE_NAME="' + p.name + '"', 'BASE_URL=http://localhost:3000', '',
      '# Access protection (password is supplied by the research team)', 'USE_AUTH=true', 'PASSWORD=CHANGE_ME', 'SESSION_SECRET=CHANGE_ME', '',
      '# Analytics and logging', 'LOG_LEVEL=debug', 'ANALYTICS_ENABLED=false', '',
      '# Hosting (set by deployment, not needed locally)', '# AZURE_REGION=' + e.region, '# AZURE_RESOURCE_GROUP=' + e.resourceGroup, '# GITHUB_REPOSITORY=' + p.repo.org + '/' + slug, ''].join('\n');
  }
  function downloadEnv(p) {
    var a = document.createElement('a'), url = URL.createObjectURL(new Blob([envText(p)], { type: 'text/plain' }));
    a.href = url; a.download = p.id.toLowerCase() + '.env.example'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    UI.flash('Downloaded <code>' + h(a.download) + '</code>. Rename it to <code>.env</code> in the project root.', 'ok');
  }
  function copy(p) {
    var cmd = cloneCmd(p);
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(cmd).then(function () { UI.flash('Copied: <code>' + h(cmd) + '</code>', 'ok'); }, function () { UI.flash('Copy this command: <code>' + h(cmd) + '</code>', 'warn'); });
    else UI.flash('Copy this command: <code>' + h(cmd) + '</code>', 'ok');
  }

  UI.on('click', '[data-act]', function (e, el) {
    var a = el.getAttribute('data-act'), id = el.getAttribute('data-id'), m = me(), r;
    if (el.disabled) return;
    switch (a) {
      case 'copy': copy(PM.proto(id)); break;
      case 'dl-env': downloadEnv(PM.proto(id)); break;
      case 'readall': PM.markRead(m); UI.render(); break;
      case 'wiz-back': { var w = wiz(); w.errors = []; if (w.step > 1) w.step--; PM.save(); UI.render(); break; }
      case 'wiz-reset': S().wizard = null; PM.save(); UI.render(); break;
      case 'start-prov': r = PM.startProvisioning(m, id); flashRes(r, 'Submitted for provisioning (simulated).'); if (r.ok) { startAuto(id, 1000); UI.render(); } break;
      case 'run-next': stopAuto(); r = PM.runNext(m, id); flashRes(r, 'Step completed (simulated).'); break;
      case 'run-all': startAuto(id); UI.render(); break;
      case 'retry-run': r = PM.retry(m, id); if (r.ok) { startAuto(id, 700); UI.render(); } else flashRes(r, ''); break;
      case 'retry': flashRes(PM.retry(m, id), 'Retry started. Select Run next step or Run all.'); break;
      case 'push': r = PM.simulatePush(m, id); flashRes(r, 'Simulated push of ' + (r.sha || '') + ': webhook received, deployment ' + (r.deployment || '') + ' queued. Latest commit now differs from deployed commit.'); break;
      case 'push-missed': r = PM.simulatePush(m, id, { missedWebhook: true }); flashRes(r, 'Simulated push of ' + (r.sha || '') + ' with no webhook delivered. Use Reconcile with GitHub to find it.'); break;
      case 'redeliver': r = PM.redeliver(m, id); flashRes(r, 'Duplicate delivery ' + (r.deliveryId || '') + ' was recognised and ignored. No second deployment was created.'); break;
      case 'reconcile': r = PM.reconcile(m, id); flashRes(r, r.found ? 'Reconciliation found ' + r.found + ' commit(s) the webhook missed and queued deployments.' : 'Reconciliation found nothing missing.'); break;
      case 'next-stage': r = PM.nextStage(m, id); flashRes(r, 'Deployment is now ' + String(r.status).toLowerCase() + '.'); break;
      case 'fail-stage': r = PM.failStage(m, id); flashRes(r, 'Simulated failure. The last known good deployment is unchanged.'); break;
      case 'retry-dep': flashRes(PM.retryDeployment(m, id), 'Retry queued as a new deployment.'); break;
      case 'rollback-row': if (!window.confirm('Roll back to the last known good deployment (' + (PM.proto(id).lastKnownGood || '') + ')? A new deployment is queued.')) break; r = PM.rollback(m, id); flashRes(r, 'Rollback to ' + (r.sha || '') + ' queued. Open the deployment to move it along.'); break;
      case 'rollback': r = PM.rollback(m, id); flashRes(r, 'Rollback to ' + (r.sha || '') + ' queued. Simulate the stages to complete it.'); break;
      case 'restart': flashRes(PM.restartEnvironment(m, id), 'Restart requested (simulated).'); break;
      case 'redeploy': flashRes(PM.redeployCurrent(m, id), 'Redeploy queued.'); break;
      case 'remove-collab': flashRes(PM.removeCollaborator(m, id, el.getAttribute('data-person')), 'Collaborator removed.'); break;
      case 'as': PM.setPersona(el.getAttribute('data-person')); UI.render(); break;
      case 'open-collab': case 'open-pw': case 'open-research': { var q = PM.getPrototype(m, id, 'view'); if (q.ok) accModal({ 'open-collab': 'collab', 'open-pw': 'pw', 'open-research': 'research' }[a], q.proto); break; }
      case 'revoke': flashRes(PM.revokeGrant(m, id, el.getAttribute('data-grant')), 'Access revoked. It stops working immediately without any code change.'); break;
      case 'approve-transfer': flashRes(PM.approveTransfer(m, id), 'Ownership transferred.'); break;
      case 'request-archive': flashRes(PM.requestArchive(m, id), 'Archive requested. An administrator will review it.'); break;
      case 'tpl-toggle': flashRes(PM.setTemplateEnabled(m, id, !!el.getAttribute('data-on')), 'Template updated.'); break;
      case 'tpl-approve': flashRes(PM.approveTemplate(m, id), 'Template approved. It is still disabled until you enable it.'); break;
      case 'region-remove': flashRes(PM.removeRegion(m, el.getAttribute('data-region')), 'Region removed.'); break;
      case 'org-remove': flashRes(PM.removeOrg(m, el.getAttribute('data-org')), 'Organisation removed.'); break;
      case 'conn-check': flashRes(PM.checkConnections(m), 'Connection check complete (simulated).'); break;
      case 'conn-toggle': flashRes(PM.checkConnections(m, el.getAttribute('data-which')), 'Simulated state changed and checked.'); break;
    }
  });
  document.addEventListener('click', function (e) {
    Array.prototype.forEach.call(document.querySelectorAll('details.ctx[open]'), function (d) { if (!d.contains(e.target) || (e.target.closest && e.target.closest('.ctx__menu a, .ctx__menu [data-act]'))) d.removeAttribute('open'); });
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') Array.prototype.forEach.call(document.querySelectorAll('details.ctx[open]'), function (d) { d.removeAttribute('open'); }); });
  UI.on('click', '.govuk-error-summary__list a', function (e, el) { e.preventDefault(); var t2 = document.getElementById(el.getAttribute('href').slice(1)); if (t2) t2.focus(); });
  UI.on('click', '[data-demo]', function (e) { e.preventDefault(); });
  // Capture phase so the prototype's own store is reset before the shared shell reloads the page.
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('[data-shell="reset"]')) PM.reset(); }, true);

  UI.on('change', '#persona', function (e, el) { PM.setPersona(el.value); UI.go('#/'); UI.render(); });
  UI.on('click', '[data-actf]', function (e, el) { filters.act = el.getAttribute('data-actf'); UI.render(); });
  UI.on('click', '[data-scope]', function (e, el) { filters.scope = el.getAttribute('data-scope'); filters.team = ''; UI.render(); });
  UI.on('change', '#pf-sort', function (e, el) { filters.sort = el.value; partial('#plist', plist()); });
  UI.on('input', '#pf-q', function (e, el) { filters.q = el.value; partial('#plist', plist()); });
  [['team', 'pf-team'], ['status', 'pf-status'], ['tpl', 'pf-tpl']].forEach(function (x) { UI.on('change', '#' + x[1], function (e, el) { filters[x[0]] = el.value; partial('#plist', plist()); }); });
  function adminRefresh() { var rows = PM.all(me()).filter(function (p) { return match(p, adminF); }); partial('#alist', rows.length ? adminTable(rows) : UI.callout('', 'No prototypes match.', 'Change the filters.')); }
  UI.on('input', '#af-q', function (e, el) { adminF.q = el.value; adminRefresh(); });
  [['team', 'af-team'], ['status', 'af-status'], ['tpl', 'af-tpl'], ['flag', 'af-flag']].forEach(function (x) { UI.on('change', '#' + x[1], function (e, el) { adminF[x[0]] = el.value; adminRefresh(); }); });
  UI.on('input', '#audit-q', function (e, el) { auditQ = el.value; var q = auditQ.toLowerCase(); partial('#audit-list', auditTable(S().audit.filter(function (x) { return !q || (x.actorName + ' ' + x.action + ' ' + x.entityId + ' ' + x.detail + ' ' + x.result).toLowerCase().indexOf(q) > -1; }))); });
  UI.on('input', '#name', function (e, el) { var s = document.getElementById('slug'); if (s && el.form && el.form.id === 'wiz' && s.getAttribute('data-manual') !== '1') s.value = PM.slugify(el.value); });
  UI.on('input', '#slug', function (e, el) { el.setAttribute('data-manual', '1'); });
  UI.on('input', '#svcq', function (e, el) { var sel = document.getElementById('serviceId'); sel.innerHTML = svcOptions(el.value, sel.value); });
  UI.on('change', '#serviceId', function (e, el) { partial('#svc-detail', svcDetail(el.value)); });
  UI.on('change', '#wiz input[name=linkMode], #wiz #team', function (e, el) { var w = wizMerge(el.form); w.errors = []; PM.save(); UI.render(); });

  UI.on('submit', 'form[data-form]', function (e, f) {
    e.preventDefault(); var kind = f.getAttribute('data-form'), id = f.getAttribute('data-id'), m = me(), fd = UI.formData(f), r;
    var fail = function (res) { FE = { form: kind, errors: res.errors, values: fd }; UI.render(); if (/^(collab|pw|research)$/.test(kind)) { var q = PM.getPrototype(m, id, 'view'); if (q.ok) { FE = { form: kind, errors: res.errors, values: fd }; accModal(kind, q.proto); FE = null; } } };
    switch (kind) {
      case 'persona': break;
      case 'wiz': {
        var w = wizMerge(f), d = w.data, errs = PM.validateCreate(d);
        var here = errs.filter(function (x) { return x.step === w.step; });
        if (w.step < 7) { if (here.length) { w.errors = here; PM.save(); UI.render(); return; } w.errors = []; w.step++; PM.save(); UI.render(); return; }
        if (errs.length) { w.errors = errs; w.step = Math.min.apply(null, errs.map(function (x) { return x.step; })); PM.save(); UI.render(); return; }
        r = PM.create(m, d); if (!r.ok) { w.errors = r.errors || []; PM.save(); UI.render(); return; }
        UI.go('#/provisioning/' + r.id); startAuto(r.id, 1200); break;
      }
      case 'inject': r = PM.injectFailure(m, id, fd.step); flashRes(r, 'A failure will be injected when that step runs.'); break;
      case 'pw': r = PM.setPassword(m, id, fd); if (r.errors) return fail(r); UI.closeModal(); flashRes(r, 'Prototype password saved. It is not shown here.'); break;
      case 'collab': UI.closeModal(); flashRes(PM.addCollaborator(m, id, fd.person, fd.role), 'Collaborator added. This gives repository access only, not access to the hosted prototype.'); break;
      case 'research': r = PM.createResearchAccess(m, id, { recipientId: fd.recipient, recipientLabel: fd.label, purpose: fd.purpose, expiresAt: fd.expiresAt }); if (r.errors) return fail(r); UI.closeModal(); flashRes(r, 'Research access created. The access code is not shown here.'); break;
      case 'meta': r = PM.updateMetadata(m, id, fd); if (r.errors) return fail(r); flashRes(r, 'Settings saved.'); break;
      case 'transfer': flashRes(PM.requestTransfer(m, id, fd.to), 'Transfer requested. A team lead or administrator must approve it.'); break;
      case 'life': r = PM.lifecycle(m, id, f.getAttribute('data-op'), { confirm: (fd.confirm || []).length > 0, reason: fd.reason, toId: fd.toId, repoDecision: fd.repoDecision }); if (r.errors) return fail(r);
        if (r.ok) { UI.go('#/admin/lifecycle'); UI.flash('Done. The action has been recorded in the audit with you as the authoriser.', 'ok'); } else flashRes(r, ''); break;
      case 'pin': flashRes(PM.setTemplateVersion(m, id, fd.v), 'Version pinned for new prototypes.'); break;
      case 'tplAdd': r = PM.addTemplate(m, { name: fd.tname, framework: fd.tframework, version: fd.tversion, buildCommand: fd.tbuild, startCommand: fd.tstart }); if (r.errors) return fail(r); flashRes(r, 'Draft template added. Approve and enable it before use.'); break;
      case 'region': flashRes(PM.addRegion(m, fd.region), 'Region added.'); break;
      case 'org': r = PM.addOrg(m, fd.org); if (r.errors) return fail(r); flashRes(r, 'Organisation validated and approved.'); break;
      case 'expiry': r = PM.setExpiry(m, fd); if (r.errors) return fail(r); flashRes(r, 'Policy saved.'); break;
    }
  });

  UI.start();
})();
