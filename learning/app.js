/* Learning and development prototype (Enabler C): catalogue, goals, plan, recommendations, manager view, L&D administration and profession interventions.
   The learning platform (system of record TBC) is a manual/simulated boundary. Prototype-only state lives in PEO.get().ext.learning. */
(function () {
  'use strict';
  var h = UI.esc, MIN_COHORT = 5;
  var F = {}, completing = null, flashNext = null;

  var NAVS = {
    staff: ['home', 'catalogue', 'goals', 'recs', 'plan'],
    manager: ['home', 'catalogue', 'goals', 'recs', 'plan', 'manager'],
    hop: ['home', 'catalogue', 'goals', 'recs', 'plan', 'interventions'],
    ld: ['home', 'catalogue', 'ld', 'sessions', 'enrolments', 'reviews', 'impact', 'interventions']
  };
  var PERSONAL = ['staff', 'manager', 'hop'];
  var STATUSES = ['planned', 'in progress', 'completed'];
  var IV_STATUSES = ['planned', 'scheduled', 'in delivery', 'completed', 'cancelled'];
  var LEVELS = [1, 2, 3];

  /* ---------- State and helpers ---------- */
  function S() { return PEO.get(); }
  function L() {
    var s = S(); s.ext = s.ext || {};
    var l = s.ext.learning = s.ext.learning || {};
    l.requests = l.requests || []; l.notes = l.notes || []; l.cat = l.cat || { q: '', skill: '', level: '', format: '', hours: '', avail: '' };
    return l;
  }
  function me() { return PEO.me(); }
  function persona() { return me().persona; }
  function today() { return new Date().toISOString().slice(0, 10); }
  function skills() { return PEO.currentFramework().skills; }
  function skillName(id) { var s = skills().filter(function (x) { return x.id === id; })[0]; return s ? s.name : id; }
  function levelText(l) { return 'Level ' + l + ' (' + (PEO.SCORE_LABELS[l] || '').toLowerCase() + ')'; }
  function item(id) { return PEO.byId(S().learning, id); }
  function itemTitle(id) { var i = item(id); return i ? i.title : id; }
  function itemLink(id) { return '<a class="govuk-link" href="#/item/' + h(id) + '">' + h(itemTitle(id)) + '</a>'; }
  function sessionsFor(id) { return S().sessions.filter(function (s) { return s.itemId === id; }); }
  function session(id) { return PEO.byId(S().sessions, id); }
  function sessionStatus(s) { return s.booked >= s.capacity ? 'full' : 'open'; }
  function availability(i) {
    if (i.archived) return 'archived';
    var ss = sessionsFor(i.id); if (!ss.length) return 'open';
    return ss.some(function (s) { return sessionStatus(s) === 'open' && Date.parse(s.date) > Date.now(); }) ? 'open' : 'full';
  }
  function availTag(a) { return UI.tag(a === 'open' ? 'Open' : a === 'full' ? 'Full' : 'Archived', a === 'open' ? 'green' : a === 'full' ? 'orange' : 'grey'); }
  function statusTag(st) { return UI.tag(st, st === 'completed' ? 'green' : st === 'in progress' ? 'blue' : 'grey'); }
  function myEnrol(personId, itemId) { return S().enrolments.filter(function (e) { return e.personId === personId && e.itemId === itemId; })[0]; }
  function pname(id) { var p = PEO.person(id); return p ? p.name : id; }
  function scroll(html) { return '<div style="overflow-x:auto">' + html + '</div>'; }
  function overdue(i) { return Date.parse(i.reviewDue) < Date.now(); }
  function reflectionFor(enrId) { return S().reflections.filter(function (r) { return r.enrolmentId === enrId; })[0]; }
  function isValidDate(v) { return /^\d{4}-\d{2}-\d{2}$/.test(v || '') && !isNaN(Date.parse(v)); }
  function notice(msg) { flashNext = msg; }
  function skillOptions(blank) { var o = skills().map(function (s) { return { value: s.id, label: s.name }; }); if (blank) o.unshift({ value: '', label: blank }); return o; }
  function levelOptions(blank) { var o = LEVELS.map(function (l) { return { value: l, label: levelText(l) }; }); if (blank) o.unshift({ value: '', label: blank }); return o; }
  function back(href, text) { return '<p class="govuk-body-s"><a class="govuk-link" href="' + href + '">' + h(text) + '</a></p>'; }

  function bookSession(e, sessionId) {
    var s = session(sessionId); if (!s) return;
    e.sessionId = s.id;
    if (s.booked >= s.capacity) { s.waiting++; e.waitlisted = true; } else { s.booked++; e.waitlisted = false; }
    s.status = sessionStatus(s);
  }
  function addToPlan(itemId, sessionId) {
    var e = PEO.enrol(me().id, itemId, 'planned');
    if (sessionId) bookSession(e, sessionId);
    PEO.save(); return e;
  }

  /* Progress against a goal uses learning activity mapped to the skill, not a CBP score. */
  function goalProgress(g) {
    var ids = S().learning.filter(function (i) { return i.skills.some(function (m) { return m.skillId === g.skillId && m.level >= g.targetLevel; }); }).map(function (i) { return i.id; });
    var en = S().enrolments.filter(function (e) { return e.personId === g.personId && ids.indexOf(e.itemId) > -1; });
    var done = en.filter(function (e) { return e.status === 'completed'; }).length;
    var refl = en.filter(function (e) { return e.status === 'completed' && reflectionFor(e.id) && reflectionFor(e.id).applied; }).length;
    return { total: en.length, done: done, applied: refl, inProgress: en.filter(function (e) { return e.status === 'in progress'; }).length };
  }
  function progressText(p) { return p.total ? p.done + ' of ' + p.total + ' planned activities completed; ' + p.applied + ' with an applied-practice reflection' : 'No learning activity planned yet'; }

  /* ---------- Layout ---------- */
  function personaBar() {
    var m = me(), opts = PEO.personas().filter(function (p) { return PERSONAL.concat(['ld']).indexOf(p.persona) > -1; });
    return '<div class="persona-bar"><label class="govuk-label govuk-label--s" for="persona" style="margin:0">Viewing as</label><select class="govuk-select" id="persona" name="persona">' +
      opts.map(function (p) { return '<option value="' + h(p.id) + '"' + (p.id === m.id ? ' selected' : '') + '>' + h(p.name + ' (' + PEO.ROLES[p.persona].toLowerCase() + ')') + '</option>'; }).join('') + '</select>' +
      '<span class="muted" style="margin-left:10px">Demonstration persona switcher; no real sign in.</span></div>';
  }
  function applyNav() {
    var show = NAVS[persona()] || NAVS.staff;
    document.querySelectorAll('[data-nav]').forEach(function (li) { li.hidden = show.indexOf(li.dataset.nav) < 0; });
    var hl = document.querySelector('[data-nav="home"] a, [data-nav="home"] strong');
    if (hl) hl.textContent = persona() === 'ld' ? 'Overview' : 'My development';
  }
  function platformNote() { return '<p class="govuk-body-s muted">Integration: the learning platform (system of record to be confirmed) is a manual or simulated boundary. This catalogue is maintained here for the prototype.</p>'; }
  function R(pattern, fn, nav, roles) {
    UI.route(pattern, function (p) {
      var pr = persona(), body;
      if (roles && roles.indexOf(pr) < 0) body = UI.pageHead('Not available for this persona', 'This screen is for ' + roles.map(function (r) { return PEO.ROLES[r].toLowerCase() + 's'; }).join(' and ') + '. Use the persona switcher to change view.');
      else body = fn(p);
      var title = typeof body === 'object' ? body.title : null, html = typeof body === 'object' ? body.html : body;
      var fl = flashNext ? '<div id="flash" role="status" class="callout callout--ok">' + flashNext + '</div>' : ''; flashNext = null;
      setTimeout(applyNav, 0); applyNav();
      return { html: personaBar() + fl + html + platformNote(), title: title };
    }, nav);
  }

  /* ---------- Staff screens ---------- */
  function recsFor(id) { return PEO.recommend(id); }
  function goalsTable(list, actions) {
    return UI.table(['Skill', 'Target', 'Target date', 'Progress', 'Shared with manager'].concat(actions ? ['Actions'] : []), list.map(function (g) {
      var p = goalProgress(g);
      return [h(skillName(g.skillId)) + (g.status === 'complete' ? ' ' + UI.tag('Complete', 'green') : ''), h(levelText(g.targetLevel)), UI.fmtDate(g.targetDate), h(progressText(p)), g.managerShared ? 'Yes' : 'No'].concat(actions ? [actions(g)] : []);
    }));
  }

  R('/', function () {
    var m = me(), pr = persona();
    if (pr === 'ld') {
      var open = S().sessions.filter(function (s) { return sessionStatus(s) === 'open'; }).length, due = S().learning.filter(function (i) { return !i.archived && overdue(i); }).length;
      return UI.pageHead('Learning and development overview', 'Manage the catalogue, sessions and impact evidence for ' + h(PEO.get().profession.name.toLowerCase()) + '.') +
        '<ul class="govuk-list govuk-list--bullet"><li>' + UI.link('#/ld', 'Manage catalogue') + ': ' + S().learning.filter(function (i) { return !i.archived; }).length + ' live items</li><li>' + UI.link('#/ld/sessions', 'Sessions') + ': ' + open + ' open</li><li>' +
        UI.link('#/ld/reviews', 'Content review') + ': ' + due + ' overdue</li><li>' + UI.link('#/ld/impact', 'Impact') + ': applied-practice reflections by item</li><li>' + UI.link('#/interventions', 'Interventions') + ': profession-level learning from skills insight</li></ul>';
    }
    var goals = S().goals.filter(function (g) { return g.personId === m.id; }), en = S().enrolments.filter(function (e) { return e.personId === m.id; });
    var upcoming = en.filter(function (e) { var s = e.sessionId && session(e.sessionId); return s && Date.parse(s.date) > Date.now() && e.status !== 'completed'; });
    var recs = recsFor(m.id), reqs = L().requests.filter(function (r) { return r.managerId === m.id && r.status === 'requested'; });
    return UI.pageHead('My development', 'Goals, plan and upcoming sessions for ' + h(m.name) + '. Suggestions here support your choices; they are not requirements.') +
      (reqs.length ? UI.callout('warn', 'Requests waiting:', 'You have ' + reqs.length + ' support or approval request' + (reqs.length > 1 ? 's' : '') + ' from your team. ' + UI.link('#/manager', 'Review them')) : '') +
      '<h2 class="govuk-heading-m">My goals</h2>' + (goals.length ? goalsTable(goals) : '<p class="govuk-body">You have no goals yet. ' + UI.link('#/goals', 'Add a goal') + '.</p>') +
      '<h2 class="govuk-heading-m">My plan</h2>' + UI.table(['Learning', 'Status', 'Session'], en.map(function (e) { var s = e.sessionId && session(e.sessionId); return [itemLink(e.itemId), statusTag(e.status), s ? UI.fmtDate(s.date) + (e.waitlisted ? ' (waiting list)' : '') : '\u2013']; })) +
      '<p class="govuk-body">' + UI.link('#/plan', 'Manage my plan') + '</p>' +
      '<h2 class="govuk-heading-m">Upcoming sessions</h2>' + UI.table(['Session', 'Date', 'Booking'], upcoming.map(function (e) { var s = session(e.sessionId); return [itemLink(e.itemId), UI.fmtDate(s.date), e.waitlisted ? 'On waiting list' : 'Booked']; })) +
      '<h2 class="govuk-heading-m">Recommendations</h2>' + (recs.length ? '<ul class="govuk-list">' + recs.slice(0, 3).map(function (r) { return '<li>' + itemLink(r.itemId) + '<br><span class="govuk-body-s">' + h(r.reason) + '</span></li>'; }).join('') + '</ul><p class="govuk-body">' + UI.link('#/recommendations', 'See all recommendations') + '</p>' : '<p class="govuk-body">No recommendations at the moment.</p>');
  }, 'home');

  /* Catalogue */
  function matches(i, c) {
    var a = availability(i);
    if (c.avail ? a !== c.avail : a === 'archived') return false;
    if (c.q && (i.title + ' ' + i.provider + ' ' + i.format + ' ' + i.skills.map(function (m) { return skillName(m.skillId); }).join(' ')).toLowerCase().indexOf(c.q.toLowerCase()) < 0) return false;
    if (c.skill && !i.skills.some(function (m) { return m.skillId === c.skill; })) return false;
    if (c.level && !i.skills.some(function (m) { return String(m.level) === String(c.level) && (!c.skill || m.skillId === c.skill); })) return false;
    if (c.format && i.format !== c.format) return false;
    if (c.hours) { var hr = i.hours; if (c.hours === '2' && hr > 2) return false; if (c.hours === '4' && hr > 4) return false; if (c.hours === '8' && hr > 8) return false; if (c.hours === 'more' && hr <= 8) return false; }
    return true;
  }
  function mapText(i) { return i.skills.map(function (m) { return h(skillName(m.skillId)) + ', ' + h(levelText(m.level)); }).join('<br>'); }
  R('/catalogue', function () {
    var c = L().cat, formats = S().learning.map(function (i) { return i.format; }).filter(function (v, k, a) { return a.indexOf(v) === k; }).sort(), list = S().learning.filter(function (i) { return matches(i, c); });
    var form = '<form data-form="catalogue" novalidate><div class="toolbar" style="align-items:flex-end;flex-wrap:wrap;gap:10px">' + UI.input('f-q', 'Search', c.q) + UI.select('f-skill', 'Skill', skillOptions('Any skill'), c.skill) + UI.select('f-level', 'Level', levelOptions('Any level'), c.level) +
      UI.select('f-format', 'Format', [{ value: '', label: 'Any format' }].concat(formats), c.format) + UI.select('f-hours', 'Time commitment', [{ value: '', label: 'Any' }, { value: '2', label: 'Up to 2 hours' }, { value: '4', label: 'Up to 4 hours' }, { value: '8', label: 'Up to 8 hours' }, { value: 'more', label: 'More than 8 hours' }], c.hours) +
      UI.select('f-avail', 'Availability', [{ value: '', label: 'Open and full' }, { value: 'open', label: 'Open only' }, { value: 'full', label: 'Full only' }, { value: 'archived', label: 'Archived' }], c.avail) +
      '<div class="govuk-form-group"><button class="govuk-button govuk-button--secondary" data-module="govuk-button">Apply filters</button> <button type="button" class="govuk-button govuk-button--secondary" data-act="clear-filters">Clear</button></div></div></form>';
    return UI.pageHead('Learning catalogue', 'Archived items are hidden unless you choose to show them. Skill levels show what an item is mapped to, not what a person can do.') + form +
      '<p class="govuk-body" role="status">' + list.length + ' item' + (list.length === 1 ? '' : 's') + ' shown.</p>' +
      scroll(UI.table(['Title', 'Format', 'Hours', 'Skills and levels', 'Availability'], list.map(function (i) { return ['<a class="govuk-link" href="#/item/' + h(i.id) + '">' + h(i.title) + '</a>', h(i.format), String(i.hours), mapText(i), availTag(availability(i))]; })));
  }, 'catalogue');

  R('/item/:id', function (p) {
    var i = item(p.id); if (!i) return UI.pageHead('Item not found') + back('#/catalogue', 'Back to catalogue');
    var m = me(), en = myEnrol(m.id, i.id), ss = sessionsFor(i.id), canPlan = PERSONAL.indexOf(persona()) > -1 && !i.archived;
    var open = ss.filter(function (s) { return Date.parse(s.date) > Date.now(); });
    var opts = [{ value: '', label: 'No session yet' }].concat(open.map(function (s) { return { value: s.id, label: UI.fmtDate(s.date) + (sessionStatus(s) === 'full' ? ' (full, join waiting list)' : ' (' + (s.capacity - s.booked) + ' places left)') }; }));
    var action = '';
    if (canPlan && !en) action = '<form data-form="add-plan" data-item="' + h(i.id) + '" novalidate>' + (open.length ? UI.select('plan-session', 'Session (optional)', opts, '') : '') + '<button class="govuk-button" data-module="govuk-button">Add to my plan</button></form>';
    else if (en) action = '<p class="govuk-body">In your plan: ' + statusTag(en.status) + (en.sessionId ? ' Session on ' + UI.fmtDate(session(en.sessionId).date) + (en.waitlisted ? ' (waiting list)' : '') : '') + ' ' + UI.link('#/plan', 'Go to my plan') + '</p>' +
      (!en.sessionId && open.length ? '<form data-form="book" data-enrol="' + h(en.id) + '" novalidate>' + UI.select('book-session', 'Book a session', opts.slice(1), '') + '<button class="govuk-button govuk-button--secondary" data-module="govuk-button">Book session</button></form>' : '');
    else if (i.archived) action = UI.callout('warn', 'Archived:', 'This item is no longer offered. Participation history is kept.');
    return { title: i.title, html: back('#/catalogue', 'Back to catalogue') + UI.pageHead(i.title, h(i.format) + ' from ' + h(i.provider)) +
      '<dl class="kv"><dt>Availability</dt><dd>' + availTag(availability(i)) + '</dd><dt>Time commitment</dt><dd>' + i.hours + ' hours</dd><dt>Skills and levels mapped</dt><dd>' + mapText(i) + '</dd><dt>Accessibility</dt><dd>' + h(i.accessibility) + '</dd><dt>Owner</dt><dd>' + h(i.owner) + '</dd><dt>Review due</dt><dd>' + UI.fmtDate(i.reviewDue) + (overdue(i) ? ' ' + UI.tag('Overdue', 'red') : '') + '</dd><dt>Learning platform link</dt><dd>' + (i.link ? h(i.link) + ' <span class="muted">(simulated, not followed)</span>' : 'None') + '</dd></dl>' +
      '<h2 class="govuk-heading-m">Sessions</h2>' + UI.table(['Date', 'Places', 'Waiting list', 'Status'], ss.map(function (s) { return [UI.fmtDate(s.date), s.booked + ' of ' + s.capacity + ' booked', String(s.waiting), availTag(sessionStatus(s))]; })) + action };
  }, 'catalogue');

  /* Goals */
  R('/goals', function () {
    var m = me(), goals = S().goals.filter(function (g) { return g.personId === m.id; }), f = F.goal || { vals: {}, errs: {} }, v = f.vals, e = f.errs, summary = Object.keys(e).map(function (k) { return { id: k, msg: e[k] }; });
    var mgr = m.manager ? pname(m.manager) : 'your manager';
    var rows = UI.table(['Skill', 'Target', 'Target date', 'Progress', 'Share with manager', 'Manager support', 'Actions'], goals.map(function (g) {
      var req = L().requests.filter(function (r) { return r.goalId === g.id; }).pop(), notes = L().notes.filter(function (n) { return n.goalId === g.id; });
      return [h(skillName(g.skillId)) + (g.status === 'complete' ? '<br>' + UI.tag('Complete', 'green') : ''), h(levelText(g.targetLevel)), UI.fmtDate(g.targetDate), h(progressText(goalProgress(g))),
        '<label class="govuk-body-s"><input type="checkbox" data-act="share" data-id="' + h(g.id) + '"' + (g.managerShared ? ' checked' : '') + '> Share</label>',
        (req ? UI.tag(req.type + ' ' + req.status, req.status === 'requested' ? 'yellow' : 'green') : 'None') + notes.map(function (n) { return '<br><span class="govuk-body-s">Coaching note from ' + h(n.byName) + ': ' + h(n.text) + '</span>'; }).join(''),
        (g.status !== 'complete' ? '<button type="button" class="govuk-link" style="background:none;border:0;cursor:pointer;padding:0" data-act="complete-goal" data-id="' + h(g.id) + '">Mark complete</button><br>' : '') +
        (g.status !== 'complete' ? '<button type="button" class="govuk-link" style="background:none;border:0;cursor:pointer;padding:0" data-act="request" data-type="support" data-id="' + h(g.id) + '">Request support</button><br><button type="button" class="govuk-link" style="background:none;border:0;cursor:pointer;padding:0" data-act="request" data-type="approval" data-id="' + h(g.id) + '">Request approval</button>' : '')];
    }));
    var form = '<form data-form="goal" novalidate>' + UI.errorSummary(summary) + UI.select('g-skill', 'Skill', skillOptions('Choose a skill'), v['g-skill'], { err: e['g-skill'] }) +
      UI.select('g-level', 'Target level', levelOptions('Choose a level'), v['g-level'], { err: e['g-level'], hint: 'Levels describe expected practice in the framework; they are not a complete measure of ability.' }) +
      UI.input('g-date', 'Target date', v['g-date'] || '', { type: 'date', err: e['g-date'] }) + '<button class="govuk-button" data-module="govuk-button">Add goal</button></form>';
    return UI.pageHead('My goals', 'Goals are yours. They are only visible to ' + h(mgr) + ' if you choose to share them.') + (F.goalMsg ? '' : '') + scroll(rows) + '<h2 class="govuk-heading-m">Add a goal</h2>' + form;
  }, 'goals', PERSONAL);

  /* Recommendations */
  R('/recommendations', function () {
    var recs = recsFor(me().id);
    return UI.pageHead('Recommendations', 'Recommendations are suggestions only. They come from your own goals and do not affect assessment outcomes. CBP outcomes are one source of evidence and are not a complete measure of ability.') +
      scroll(UI.table(['Learning', 'Why you are seeing this', 'Hours', 'Actions'], recs.map(function (r) {
        var i = item(r.itemId);
        return [itemLink(r.itemId), h(r.reason), String(i.hours), '<button type="button" class="govuk-button govuk-button--secondary" data-module="govuk-button" data-act="rec-add" data-item="' + h(r.itemId) + '">Add to plan</button> <button type="button" class="govuk-button govuk-button--secondary" data-module="govuk-button" data-act="rec-dismiss" data-item="' + h(r.itemId) + '" data-goal="' + h(r.goalId) + '">Dismiss</button>'];
      })));
  }, 'recs', PERSONAL);

  /* Plan */
  R('/plan', function () {
    var m = me(), en = S().enrolments.filter(function (e) { return e.personId === m.id; }), refl = S().reflections.filter(function (r) { return r.personId === m.id; }), form = '';
    if (completing) {
      var ce = PEO.byId(S().enrolments, completing), f = F.complete || { vals: {}, errs: {} };
      if (ce) form = '<h2 class="govuk-heading-m">Complete: ' + h(itemTitle(ce.itemId)) + '</h2><form data-form="complete" data-enrol="' + h(ce.id) + '" novalidate>' + UI.errorSummary(Object.keys(f.errs).map(function (k) { return { id: k, msg: f.errs[k] }; })) +
        UI.textarea('c-text', 'How have you used this in your real work?', f.vals['c-text'] || '', { err: f.errs['c-text'], hint: 'Reflections on applying learning show effectiveness better than completion alone.' }) +
        UI.radios('c-applied', 'Have you applied it to real work yet?', [{ value: 'yes', label: 'Yes, applied to real work' }, { value: 'no', label: 'Not yet' }], f.vals['c-applied'] || 'yes', { err: f.errs['c-applied'] }) +
        '<button class="govuk-button" data-module="govuk-button">Save and mark complete</button> <button type="button" class="govuk-button govuk-button--secondary" data-act="cancel-complete">Cancel</button></form>';
    }
    return UI.pageHead('My plan', 'Your learning activity and status.') + scroll(UI.table(['Learning', 'Hours', 'Session', 'Status', 'Change status'], en.map(function (e) {
      var s = e.sessionId && session(e.sessionId), i = item(e.itemId);
      return [itemLink(e.itemId), String(i.hours), s ? UI.fmtDate(s.date) + (e.waitlisted ? ' (waiting list)' : '') : '\u2013', statusTag(e.status),
        e.status === 'completed' ? 'Completed' : '<select class="govuk-select" data-act="status" data-id="' + h(e.id) + '" aria-label="Change status for ' + h(i.title) + '">' + STATUSES.map(function (st) { return '<option' + (st === e.status ? ' selected' : '') + '>' + st + '</option>'; }).join('') + '</select>'];
    }))) + form +
      '<h2 class="govuk-heading-m">Applied to real work</h2>' + UI.table(['Learning', 'Reflection', 'Applied to real work', 'Date'], refl.map(function (r) { return [itemLink(r.itemId), h(r.text), r.applied ? UI.tag('Applied', 'green') : UI.tag('Not yet applied', 'grey'), UI.fmtDate(r.at)]; }));
  }, 'plan', PERSONAL);

  /* ---------- Manager ---------- */
  R('/manager', function () {
    var m = me(), team = S().people.filter(function (p) { return p.manager === m.id; }).map(function (p) { return p.id; });
    var goals = S().goals.filter(function (g) { return team.indexOf(g.personId) > -1 && g.managerShared === true; }), reqs = L().requests.filter(function (r) { return r.managerId === m.id; });
    var f = F.note || { vals: {}, errs: {} };
    return UI.pageHead('Team goals', 'You only see goals that colleagues have chosen to share with you. Progress is learning activity and applied-practice reflections; it is not an assessment of ability.') +
      scroll(UI.table(['Person', 'Skill', 'Target', 'Target date', 'Progress', 'Coaching notes', 'Add coaching note'], goals.map(function (g) {
        var notes = L().notes.filter(function (n) { return n.goalId === g.id; });
        return [h(pname(g.personId)), h(skillName(g.skillId)) + (g.status === 'complete' ? ' ' + UI.tag('Complete', 'green') : ''), h(levelText(g.targetLevel)), UI.fmtDate(g.targetDate), h(progressText(goalProgress(g))), notes.map(function (n) { return h(n.text) + ' <span class="muted">(' + UI.fmtDate(n.at) + ')</span>'; }).join('<br>') || '\u2013',
          '<form data-form="note" data-goal="' + h(g.id) + '" novalidate><label class="govuk-visually-hidden" for="n-' + h(g.id) + '">Coaching note</label><input class="govuk-input' + (f.errs[g.id] ? ' govuk-input--error' : '') + '" id="n-' + h(g.id) + '" name="note" value="">' + (f.errs[g.id] ? '<p class="govuk-error-message">' + h(f.errs[g.id]) + '</p>' : '') + '<button class="govuk-button govuk-button--secondary" data-module="govuk-button">Add note</button></form>'];
      }))) + (goals.length ? '' : '<p class="govuk-body">No colleagues have shared goals with you.</p>') +
      '<h2 class="govuk-heading-m">Support and approval requests</h2>' + UI.table(['Person', 'Goal', 'Request', 'Status', 'Action'], reqs.map(function (r) {
        var g = PEO.byId(S().goals, r.goalId);
        return [h(pname(r.personId)), g ? h(skillName(g.skillId)) : '', h(r.type), UI.tag(r.status, r.status === 'requested' ? 'yellow' : 'green'), r.status === 'requested' ? '<button type="button" class="govuk-button govuk-button--secondary" data-module="govuk-button" data-act="resolve-request" data-id="' + h(r.id) + '">Mark as ' + (r.type === 'approval' ? 'approved' : 'supported') + '</button>' : '\u2013'];
      }));
  }, 'manager', ['manager']);

  /* ---------- L&D ---------- */
  function itemFormHtml(f, id) {
    var v = f.vals, e = f.errs;
    return '<form data-form="item" data-id="' + h(id || '') + '" novalidate>' + UI.errorSummary(Object.keys(e).map(function (k) { return { id: k, msg: e[k] }; })) +
      UI.input('i-title', 'Title', v['i-title'], { err: e['i-title'] }) + UI.select('i-format', 'Format', ['Workshop', 'Online course', 'Guide', 'Coaching', 'Mentoring', 'Shadowing', 'Community session', 'Practical assignment'], v['i-format']) +
      UI.input('i-provider', 'Provider', v['i-provider'], { err: e['i-provider'] }) + UI.input('i-hours', 'Time commitment (hours)', v['i-hours'], { err: e['i-hours'], cls: 'govuk-input--width-5' }) +
      UI.select('i-skill1', 'Skill mapped', skillOptions('Choose a skill'), v['i-skill1'], { err: e['i-skill1'] }) + UI.select('i-level1', 'Level for that skill', levelOptions('Choose a level'), v['i-level1'], { err: e['i-level1'] }) +
      UI.select('i-skill2', 'Second skill (optional)', skillOptions('None'), v['i-skill2'], { err: e['i-skill2'] }) + UI.select('i-level2', 'Level for second skill', levelOptions('None'), v['i-level2'], { err: e['i-level2'] }) +
      UI.input('i-owner', 'Owner', v['i-owner'], { err: e['i-owner'] }) + UI.input('i-review', 'Review due date', v['i-review'], { type: 'date', err: e['i-review'] }) +
      UI.textarea('i-access', 'Accessibility information', v['i-access'], { err: e['i-access'], rows: 2 }) + UI.input('i-link', 'Learning platform link (optional)', v['i-link']) +
      '<button class="govuk-button" data-module="govuk-button">Save item</button> <a class="govuk-button govuk-button--secondary" href="#/ld">Cancel</a></form>';
  }
  function itemVals(i) {
    return { 'i-title': i.title, 'i-format': i.format, 'i-provider': i.provider, 'i-hours': String(i.hours), 'i-skill1': i.skills[0].skillId, 'i-level1': String(i.skills[0].level), 'i-skill2': i.skills[1] ? i.skills[1].skillId : '', 'i-level2': i.skills[1] ? String(i.skills[1].level) : '',
      'i-owner': i.owner, 'i-review': String(i.reviewDue).slice(0, 10), 'i-access': i.accessibility, 'i-link': i.link || '' };
  }
  R('/ld', function () {
    var list = S().learning.slice().sort(function (a, b) { return (a.archived ? 1 : 0) - (b.archived ? 1 : 0); });
    return UI.pageHead('Manage catalogue', 'Archiving removes an item from the catalogue but keeps its participation history.', '<a class="govuk-button" href="#/ld/new">Create item</a>') +
      scroll(UI.table(['Item', 'Format', 'Hours', 'Skills and levels', 'Status', 'Actions'], list.map(function (i) {
        return [h(i.title), h(i.format), String(i.hours), mapText(i), availTag(availability(i)),
          '<a class="govuk-link" href="#/ld/edit/' + h(i.id) + '">Edit</a> ' + (i.archived ? '<button type="button" class="govuk-link" style="background:none;border:0;cursor:pointer" data-act="unarchive" data-id="' + h(i.id) + '">Restore</button>' : '<button type="button" class="govuk-link" style="background:none;border:0;cursor:pointer" data-act="archive" data-id="' + h(i.id) + '">Archive</button>')];
      })));
  }, 'ld', ['ld']);
  R('/ld/new', function () {
    var f = F.item && !F.item.id ? F.item : { vals: { 'i-format': 'Workshop', 'i-owner': me().name }, errs: {} };
    return UI.pageHead('Create learning item') + itemFormHtml(f, '');
  }, 'ld', ['ld']);
  R('/ld/edit/:id', function (p) {
    var i = item(p.id); if (!i) return UI.pageHead('Item not found');
    var f = F.item && F.item.id === p.id ? F.item : { vals: itemVals(i), errs: {} };
    return UI.pageHead('Edit learning item', h(i.title)) + itemFormHtml(f, p.id);
  }, 'ld', ['ld']);

  R('/ld/sessions', function () {
    var f = F.session || { vals: {}, errs: {} }, v = f.vals, e = f.errs;
    var live = S().learning.filter(function (i) { return !i.archived; }).map(function (i) { return { value: i.id, label: i.title }; });
    return UI.pageHead('Sessions', 'Places are managed here for the prototype; the learning platform is a manual boundary.') +
      scroll(UI.table(['Item', 'Date', 'Capacity', 'Booked', 'Waiting list', 'Status'], S().sessions.map(function (s) { return [itemLink(s.itemId), UI.fmtDate(s.date), String(s.capacity), String(s.booked), String(s.waiting), availTag(sessionStatus(s))]; }))) +
      '<h2 class="govuk-heading-m">Add a session</h2><form data-form="session" novalidate>' + UI.errorSummary(Object.keys(e).map(function (k) { return { id: k, msg: e[k] }; })) + UI.select('s-item', 'Learning item', live, v['s-item']) +
      UI.input('s-date', 'Date', v['s-date'] || '', { type: 'date', err: e['s-date'] }) + UI.input('s-cap', 'Capacity', v['s-cap'] || '', { err: e['s-cap'], cls: 'govuk-input--width-5' }) + '<button class="govuk-button" data-module="govuk-button">Add session</button></form>';
  }, 'sessions', ['ld']);

  R('/ld/enrolments', function () {
    return UI.pageHead('Enrolments by item', 'Counts only. Individual names are shown here for administration and are not used in impact reporting.') +
      scroll(UI.table(['Item', 'Planned', 'In progress', 'Completed', 'Waiting list', 'Participants'], S().learning.map(function (i) {
        var en = S().enrolments.filter(function (e) { return e.itemId === i.id; }), c = function (st) { return en.filter(function (e) { return e.status === st; }).length; };
        return [h(i.title) + (i.archived ? ' ' + UI.tag('Archived', 'grey') : ''), String(c('planned')), String(c('in progress')), String(c('completed')), String(en.filter(function (e) { return e.waitlisted; }).length),
          en.length ? en.map(function (e) { return h(pname(e.personId)); }).join(', ') : '\u2013'];
      })));
  }, 'enrolments', ['ld']);

  R('/ld/reviews', function () {
    var list = S().learning.slice().sort(function (a, b) { return Date.parse(a.reviewDue) - Date.parse(b.reviewDue); });
    return UI.pageHead('Content review', 'Each item needs a review date so mappings and accessibility information stay current.') +
      scroll(UI.table(['Item', 'Owner', 'Review due', 'Flag', 'Action'], list.map(function (i) {
        return [h(i.title) + (i.archived ? ' ' + UI.tag('Archived', 'grey') : ''), h(i.owner), UI.fmtDate(i.reviewDue), overdue(i) ? UI.tag('Overdue', 'red') : Date.parse(i.reviewDue) - Date.now() < 60 * PEO.DAY ? UI.tag('Due soon', 'yellow') : UI.tag('In date', 'green'),
          i.archived ? '\u2013' : '<button type="button" class="govuk-button govuk-button--secondary" data-module="govuk-button" data-act="reviewed" data-id="' + h(i.id) + '">Mark reviewed</button>'];
      })));
  }, 'reviews', ['ld']);

  R('/ld/impact', function () {
    var rows = S().learning.map(function (i) {
      var en = S().enrolments.filter(function (e) { return e.itemId === i.id; }), done = en.filter(function (e) { return e.status === 'completed'; }), applied = done.filter(function (e) { var r = reflectionFor(e.id); return r && r.applied; }).length;
      if (en.length < MIN_COHORT) return [h(i.title), '<span class="muted">Suppressed (fewer than ' + MIN_COHORT + ' participants)</span>', '\u2013', '\u2013'];
      return [h(i.title), String(en.length), String(done.length), done.length ? applied + ' of ' + done.length + ' (' + Math.round(applied / done.length * 100) + '%)' : '0 completions'];
    });
    return UI.pageHead('Impact', 'Effectiveness is measured by reflections on applying learning to real work, not just completion. Results with fewer than ' + MIN_COHORT + ' participants are suppressed.') +
      scroll(UI.table(['Item', 'Participants', 'Completed', 'Completions with applied reflection'], rows));
  }, 'impact', ['ld']);

  /* ---------- Interventions ---------- */
  function ivParticipants(iv) { return iv.participants || 0; }
  R('/interventions', function () {
    var list = S().interventions;
    return UI.pageHead('Profession interventions', 'Interventions come from skills insight. Participation is shown as counts only.') +
      scroll(UI.table(['Intervention', 'Skills', 'Status', 'Learning item', 'Session', 'Participation', 'Action'], list.map(function (iv) {
        var s = iv.sessionId && session(iv.sessionId);
        return ['<a class="govuk-link" href="#/interventions/' + h(iv.id) + '">' + h(iv.title) + '</a>', iv.skills.map(function (k) { return h(skillName(k)); }).join(', '), UI.tag(iv.status, iv.status === 'completed' ? 'green' : iv.status === 'scheduled' || iv.status === 'in delivery' ? 'blue' : 'grey'),
          iv.learningItemId ? itemLink(iv.learningItemId) : 'Not scheduled', s ? UI.fmtDate(s.date) : '\u2013', String(ivParticipants(iv)), '<a class="govuk-link" href="#/interventions/' + h(iv.id) + '">Manage</a>'];
      })));
  }, 'interventions', ['hop', 'ld']);

  R('/interventions/:id', function (p) {
    var iv = PEO.byId(S().interventions, p.id); if (!iv) return UI.pageHead('Intervention not found');
    var f = F.sched || { errs: {} }, ff = F.feedback || { errs: {} }, opts = [{ value: '', label: 'Choose an item and session' }];
    S().learning.filter(function (i) { return !i.archived; }).forEach(function (i) {
      var ss = sessionsFor(i.id); if (!ss.length) opts.push({ value: i.id + '|', label: i.title + ' (self-paced, no session)' });
      ss.forEach(function (s) { opts.push({ value: i.id + '|' + s.id, label: i.title + ': ' + UI.fmtDate(s.date) + ' (' + s.booked + ' of ' + s.capacity + ' booked)' }); });
    });
    var cur = iv.learningItemId ? iv.learningItemId + '|' + (iv.sessionId || '') : '', s = iv.sessionId && session(iv.sessionId), canEdit = true;
    return { title: iv.title, html: back('#/interventions', 'Back to interventions') + UI.pageHead(iv.title, h(iv.rationale)) +
      '<dl class="kv"><dt>Owner</dt><dd>' + h(iv.owner) + '</dd><dt>Skills</dt><dd>' + iv.skills.map(function (k) { return h(skillName(k)); }).join(', ') + '</dd><dt>Format</dt><dd>' + h(iv.format) + '</dd><dt>Status</dt><dd>' + UI.tag(iv.status) + '</dd><dt>Learning item</dt><dd>' + (iv.learningItemId ? itemLink(iv.learningItemId) : 'Not scheduled') + '</dd><dt>Session</dt><dd>' + (s ? UI.fmtDate(s.date) + ' (' + s.booked + ' of ' + s.capacity + ' booked)' : 'None') + '</dd><dt>Participation count</dt><dd>' + ivParticipants(iv) + '</dd></dl>' +
      '<h2 class="govuk-heading-m">Schedule against a learning item and session</h2><form data-form="schedule" data-id="' + h(iv.id) + '" novalidate>' + UI.errorSummary(Object.keys(f.errs).map(function (k) { return { id: k, msg: f.errs[k] }; })) + UI.select('sc-target', 'Learning item and session', opts, cur, { err: f.errs['sc-target'] }) + '<button class="govuk-button" data-module="govuk-button">Schedule</button></form>' +
      '<h2 class="govuk-heading-m">Status and participation</h2><form data-form="iv-status" data-id="' + h(iv.id) + '" novalidate>' + UI.select('iv-status', 'Status', IV_STATUSES, iv.status) + UI.input('iv-count', 'Participants recorded', String(ivParticipants(iv)), { cls: 'govuk-input--width-5', err: (F.status || {}).err }) + '<button class="govuk-button govuk-button--secondary" data-module="govuk-button">Update</button></form>' +
      '<h2 class="govuk-heading-m">Feedback</h2>' + UI.table(['Date', 'Entered by', 'Feedback'], (iv.feedback || []).map(function (x) { return [UI.fmtDate(x.at), h(x.by), h(x.text)]; })) +
      '<form data-form="feedback" data-id="' + h(iv.id) + '" novalidate>' + UI.errorSummary(Object.keys(ff.errs).map(function (k) { return { id: k, msg: ff.errs[k] }; })) + UI.textarea('fb-text', 'Add feedback', '', { err: ff.errs['fb-text'], hint: 'Summarise themes. Do not include names or personal data.' }) + '<button class="govuk-button govuk-button--secondary" data-module="govuk-button">Save feedback</button></form>' };
  }, 'interventions', ['hop', 'ld']);

  /* ---------- Events ---------- */
  function fd(el) { return UI.formData(el); }
  function rerender() { PEO.save(); UI.render(); }

  UI.on('change', '#persona', function (e, el) { PEO.setMe(el.value); completing = null; F = {}; if (location.hash === '#/') UI.render(); else UI.go('#/'); });
  UI.on('change', '#f-skill, #f-level, #f-format, #f-hours, #f-avail', function (e, el) { var form = el.closest('form'); if (form) { var d = fd(form), c = L().cat; c.q = d['f-q'] || ''; c.skill = d['f-skill']; c.level = d['f-level']; c.format = d['f-format']; c.hours = d['f-hours']; c.avail = d['f-avail']; rerender(); } });
  UI.on('change', '[data-act="status"]', function (e, el) {
    var en = PEO.byId(S().enrolments, el.getAttribute('data-id')); if (!en) return;
    if (el.value === 'completed') { completing = en.id; F.complete = null; UI.render(); return; }
    en.status = el.value; PEO.audit(me().name, 'Changed learning status', en.id); notice('Status changed to ' + h(el.value) + '.'); rerender();
  });
  UI.on('change', '[data-act="share"]', function (e, el) {
    var g = PEO.byId(S().goals, el.getAttribute('data-id')); if (!g) return; g.managerShared = el.checked; PEO.audit(me().name, g.managerShared ? 'Shared goal with manager' : 'Stopped sharing goal', g.id);
    notice(g.managerShared ? 'Goal shared with your manager.' : 'Goal is no longer shared with your manager.'); rerender();
  });
  UI.on('click', '[data-act]', function (e, el) {
    var a = el.getAttribute('data-act'), id = el.getAttribute('data-id');
    if (a === 'clear-filters') { L().cat = { q: '', skill: '', level: '', format: '', hours: '', avail: '' }; rerender(); }
    else if (a === 'cancel-complete') { completing = null; UI.render(); }
    else if (a === 'complete-goal') { var g = PEO.byId(S().goals, id); g.status = 'complete'; g.completedAt = new Date().toISOString(); PEO.audit(me().name, 'Completed development goal', g.id); notice('Goal marked complete.'); rerender(); }
    else if (a === 'request') {
      var g2 = PEO.byId(S().goals, id), m = me(), type = el.getAttribute('data-type');
      if (!g2.managerShared) { notice('Share this goal with your manager before requesting ' + type + '.'); UI.render(); return; }
      if (!m.manager) { notice('No line manager is recorded for you.'); UI.render(); return; }
      L().requests.push({ id: PEO.uid('REQ'), goalId: g2.id, personId: m.id, managerId: m.manager, type: type, status: 'requested', at: new Date().toISOString() });
      PEO.audit(m.name, 'Requested manager ' + type, g2.id); notice('Request for ' + type + ' sent to ' + h(pname(m.manager)) + ' (simulated notification).'); rerender();
    }
    else if (a === 'resolve-request') { var r = PEO.byId(L().requests, id); r.status = r.type === 'approval' ? 'approved' : 'supported'; r.resolvedAt = new Date().toISOString(); PEO.audit(me().name, 'Resolved ' + r.type + ' request', r.id); notice('Request updated.'); rerender(); }
    else if (a === 'rec-add') { addToPlan(el.getAttribute('data-item'), ''); notice('Added to your plan.'); UI.render(); }
    else if (a === 'rec-dismiss') { PEO.dismiss(me().id, el.getAttribute('data-item'), el.getAttribute('data-goal')); notice('Recommendation dismissed.'); rerender(); }
    else if (a === 'archive' || a === 'unarchive') { var i = item(id); i.archived = a === 'archive'; if (i.archived) i.archivedAt = new Date().toISOString(); PEO.audit(me().name, (i.archived ? 'Archived' : 'Restored') + ' learning item', i.id); PEO.event(i.archived ? 'learning.item.archived' : 'learning.item.restored', i.id); notice(h(i.title) + (i.archived ? ' archived. Participation history is kept.' : ' restored.')); rerender(); }
    else if (a === 'reviewed') { var it = item(id); it.reviewDue = PEO.ahead(180); PEO.audit(me().name, 'Reviewed learning item', it.id); notice('Review recorded. Next review in 180 days.'); rerender(); }
  });

  UI.on('submit', 'form[data-form]', function (e, form) {
    e.preventDefault(); var kind = form.getAttribute('data-form'), d = fd(form), errs = {}, m = me();
    if (kind === 'catalogue') { var c = L().cat; c.q = d['f-q'] || ''; c.skill = d['f-skill']; c.level = d['f-level']; c.format = d['f-format']; c.hours = d['f-hours']; c.avail = d['f-avail']; rerender(); }
    else if (kind === 'add-plan') { addToPlan(form.getAttribute('data-item'), d['plan-session']); notice('Added to your plan.'); UI.render(); }
    else if (kind === 'book') { var en = PEO.byId(S().enrolments, form.getAttribute('data-enrol')); if (d['book-session']) { bookSession(en, d['book-session']); notice(en.waitlisted ? 'Session is full. You are on the waiting list.' : 'Session booked.'); } rerender(); }
    else if (kind === 'goal') {
      if (!d['g-skill']) errs['g-skill'] = 'Select a skill';
      if (!d['g-level']) errs['g-level'] = 'Select a target level';
      if (!isValidDate(d['g-date'])) errs['g-date'] = 'Enter a valid target date';
      else if (d['g-date'] <= today()) errs['g-date'] = 'Target date must be in the future';
      else if (Date.parse(d['g-date']) > Date.now() + 3 * 365 * PEO.DAY) errs['g-date'] = 'Target date must be within three years';
      if (Object.keys(errs).length) { F.goal = { vals: d, errs: errs }; UI.render(); return; }
      PEO.createGoal(m.id, d['g-skill'], d['g-level'], d['g-date'], 'self', ''); F.goal = null; notice('Goal added.'); rerender();
    }
    else if (kind === 'complete') {
      var text = (d['c-text'] || '').trim(); if (text.length < 10) errs['c-text'] = 'Describe how you have used this, in at least 10 characters';
      if (Object.keys(errs).length) { F.complete = { vals: d, errs: errs }; UI.render(); return; }
      var eid = form.getAttribute('data-enrol'); PEO.completeLearning(eid, text);
      var rf = reflectionFor(eid); if (rf) rf.applied = d['c-applied'] !== 'no';
      completing = null; F.complete = null; notice('Marked complete and reflection saved.'); rerender();
    }
    else if (kind === 'note') {
      var gid = form.getAttribute('data-goal'), t = (d.note || '').trim();
      if (!t) { F.note = { vals: {}, errs: {} }; F.note.errs[gid] = 'Enter a coaching note'; UI.render(); return; }
      L().notes.push({ id: PEO.uid('NOTE'), goalId: gid, managerId: m.id, byName: m.name, text: t, at: new Date().toISOString() }); F.note = null; PEO.audit(m.name, 'Added coaching note', gid); notice('Coaching note added.'); rerender();
    }
    else if (kind === 'item') {
      var title = (d['i-title'] || '').trim(), hrs = Number(d['i-hours']), id = form.getAttribute('data-id');
      if (title.length < 3) errs['i-title'] = 'Enter a title of at least 3 characters';
      if (!(d['i-provider'] || '').trim()) errs['i-provider'] = 'Enter the provider';
      if (!d['i-hours'] || isNaN(hrs) || hrs <= 0 || hrs > 200) errs['i-hours'] = 'Enter hours between 0.5 and 200';
      if (!d['i-skill1']) errs['i-skill1'] = 'Map the item to at least one skill';
      if (d['i-skill1'] && !d['i-level1']) errs['i-level1'] = 'Choose the level for this skill';
      if (d['i-skill2'] && d['i-skill2'] === d['i-skill1']) errs['i-skill2'] = 'Choose a different skill from the first';
      if (d['i-skill2'] && !d['i-level2']) errs['i-level2'] = 'Choose the level for the second skill';
      if (!(d['i-owner'] || '').trim()) errs['i-owner'] = 'Enter an owner';
      if (!isValidDate(d['i-review'])) errs['i-review'] = 'Enter a valid review due date';
      if (!(d['i-access'] || '').trim()) errs['i-access'] = 'Enter accessibility information';
      if (Object.keys(errs).length) { F.item = { id: id, vals: d, errs: errs }; UI.render(); return; }
      var maps = [{ skillId: d['i-skill1'], level: Number(d['i-level1']) }]; if (d['i-skill2']) maps.push({ skillId: d['i-skill2'], level: Number(d['i-level2']) });
      var vals = { title: title, format: d['i-format'], provider: d['i-provider'].trim(), hours: hrs, skills: maps, owner: d['i-owner'].trim(), reviewDue: new Date(d['i-review']).toISOString(), accessibility: d['i-access'].trim(), link: (d['i-link'] || '').trim() };
      if (id) { Object.keys(vals).forEach(function (k) { item(id)[k] = vals[k]; }); PEO.audit(m.name, 'Edited learning item', id); notice('Item updated.'); }
      else { var n = S().learning.reduce(function (mx, i) { return Math.max(mx, parseInt(i.id.slice(4), 10) || 0); }, 0) + 1; vals.id = 'LRN-' + String(n).padStart(2, '0'); vals.capacity = null; S().learning.push(vals); PEO.audit(m.name, 'Created learning item', vals.id); PEO.event('learning.item.created', vals.id); notice('Item created.'); }
      F.item = null; PEO.save(); UI.go('#/ld');
    }
    else if (kind === 'session') {
      var cap = Number(d['s-cap']);
      if (!isValidDate(d['s-date'])) errs['s-date'] = 'Enter a valid date'; else if (d['s-date'] <= today()) errs['s-date'] = 'Session date must be in the future';
      if (!d['s-cap'] || !/^\d+$/.test(d['s-cap']) || cap < 1 || cap > 500) errs['s-cap'] = 'Enter a whole number of places between 1 and 500';
      if (Object.keys(errs).length) { F.session = { vals: d, errs: errs }; UI.render(); return; }
      var ses = { id: PEO.uid('SES'), itemId: d['s-item'], date: new Date(d['s-date']).toISOString(), capacity: cap, booked: 0, waiting: 0, status: 'open' }; S().sessions.push(ses); PEO.audit(m.name, 'Added session', ses.id); F.session = null; notice('Session added.'); rerender();
    }
    else if (kind === 'schedule') {
      var iv = PEO.byId(S().interventions, form.getAttribute('data-id'));
      if (!d['sc-target']) { F.sched = { errs: { 'sc-target': 'Choose a learning item and session' } }; UI.render(); return; }
      var parts = d['sc-target'].split('|'); iv.learningItemId = parts[0]; iv.sessionId = parts[1] || null; iv.status = 'scheduled'; iv.scheduledOn = new Date().toISOString();
      PEO.audit(m.name, 'Scheduled intervention', iv.id + ' to ' + parts[0]); PEO.event('profession.intervention.scheduled', iv.id); F.sched = null; notice('Intervention scheduled against ' + h(itemTitle(parts[0])) + '.'); rerender();
    }
    else if (kind === 'iv-status') {
      var iv2 = PEO.byId(S().interventions, form.getAttribute('data-id')), cnt = Number(d['iv-count']);
      if (d['iv-count'] === '' || !/^\d+$/.test(d['iv-count'])) { F.status = { err: 'Enter a whole number' }; UI.render(); return; }
      if (d['iv-status'] === 'scheduled' && !iv2.learningItemId) { F.status = { err: 'Schedule against a learning item first' }; UI.render(); return; }
      iv2.status = d['iv-status']; iv2.participants = cnt; F.status = null; PEO.audit(m.name, 'Updated intervention', iv2.id); notice('Intervention updated.'); rerender();
    }
    else if (kind === 'feedback') {
      var iv3 = PEO.byId(S().interventions, form.getAttribute('data-id')), ft = (d['fb-text'] || '').trim();
      if (!ft) { F.feedback = { errs: { 'fb-text': 'Enter feedback' } }; UI.render(); return; }
      (iv3.feedback = iv3.feedback || []).push({ at: new Date().toISOString(), by: m.name, text: ft }); F.feedback = null; PEO.audit(m.name, 'Recorded intervention feedback', iv3.id); notice('Feedback saved.'); rerender();
    }
  });

  UI.start();
})();
