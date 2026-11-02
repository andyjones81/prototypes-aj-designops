/* Skills and capability management (Enabler B). Uses window.PEO. Self-assessment, formal CBP assessment and learning stay separate evidence types. */
(function () {
  'use strict';
  var E = UI.esc, DAY = 86400000, S = PEO.get();

  /* Prototype-only state */
  function init() {
    S = PEO.get();
    var x = S.ext.skills;
    if (!x) {
      x = S.ext.skills = { sharing: { 'P-01': 'manager', 'P-02': 'manager' }, aspirations: {}, retired: {} };
      var fw2 = PEO.framework('FW-2'), fw3 = PEO.framework('FW-3');
      if (fw2 && fw3 && fw3.status === 'draft') {
        fw3.skills.forEach(function (s) { var o = PEO.skill('FW-2', s.id); if (o) s.descriptors = PEO.clone(o.descriptors); });
        var sk6 = PEO.skill('FW-3', 'SK-06');
        if (sk6) sk6.descriptors[3] = 'Is a role model for iterating from evidence, including testing AI-assisted design work, and coaches others.';
        fw3.changeLog = ['Draft: SK-06 level 3 descriptor now covers AI-assisted design practice (not yet approved)'];
      }
      PEO.save();
    }
  }
  init();

  var X = function () { return S.ext.skills; };
  var LABEL = PEO.SCORE_LABELS, ST = { errs: null, vals: null };
  var SHARE = { manager: 'Share with my line manager', hop: 'Share with my head of profession', nobody: 'Do not share (only I can see it)' };
  var SHARE_SHORT = { manager: 'Line manager', hop: 'Head of profession', nobody: 'Nobody' };
  var HAS_ROLE_NAV = ['staff', 'assessor', 'moderator', 'manager', 'hop'];

  function fd(iso) { return iso ? UI.fmtDate(iso) : '\u2013'; }
  function lvl(n) { return n == null ? '\u2013' : n + ' \u2013 ' + LABEL[n]; }
  function cur() { return PEO.currentFramework(); }
  function isRetired(id) { return !!X().retired[id]; }
  function activeSkillIds() { return cur().skills.filter(function (s) { return !isRetired(s.id); }).map(function (s) { return s.id; }); }
  function fwTag(f) { return UI.tag(f.status, { published: 'green', draft: 'blue', superseded: 'grey' }[f.status]); }
  function attemptFw(attemptId) { var a = PEO.byId(S.attempts, attemptId); return a ? PEO.framework(a.frameworkId) : null; }
  function staleOf(iso) { return iso && (Date.now() - Date.parse(iso)) > 365 * DAY; }
  function table(h, r) { return UI.table(h, r); }
  function pl(n, w) { return n + ' ' + w + (Math.abs(n) === 1 ? '' : 's'); }

  /* Gap indicators: plain explanation, never a rank or blended score */
  function gapCell(expected, level, source, stale) {
    if (expected == null) return UI.tag('No gap calculated', 'grey') + '<br><span class="muted">No expected level for this role profile.</span>';
    if (level == null) return UI.tag('No gap calculated', 'grey') + '<br><span class="muted">No ' + source + ' evidence yet, so no gap is shown.</span>';
    var d = expected - level, t = d > 0 ? UI.tag('Below expected', 'yellow') + '<br>' + E(source) + ' level is ' + pl(d, 'level') + ' below the expected level.' :
      d === 0 ? UI.tag('Meets expected', 'green') + '<br>' + E(source) + ' level matches the expected level.' : UI.tag('Above expected', 'blue') + '<br>' + E(source) + ' level is ' + pl(-d, 'level') + ' above the expected level.';
    return t + (stale ? '<br><span class="muted">Treat with care: this evidence is more than a year old.</span>' : '');
  }
  function selfCell(r) {
    if (r.self == null) return '<span class="muted">Not yet recorded</span>';
    var rec = PEO.latestSelf(r.pid, r.skillId);
    return '<strong>' + E(lvl(r.self)) + '</strong><br><span class="muted">Self-assessed, ' + fd(r.selfAt) + ', ' + E(String(r.confidence).toLowerCase()) + ' confidence, framework v' + (rec ? rec.frameworkVersion : '?') + '</span>' + (r.stale ? '<br>' + UI.tag('Stale', 'orange') : '');
  }
  function formalCell(pid, skillId) {
    var f = PEO.formalLevel(pid, skillId);
    if (!f) return '<span class="muted">No published CBP outcome</span>';
    var fw = attemptFw(f.attemptId);
    return '<strong>' + E(lvl(f.level)) + '</strong><br><span class="muted">Formal CBP final score, published ' + fd(f.at) + ', ' + E(f.attemptId) + ', framework v' + (fw ? fw.version : '?') + '</span>';
  }
  function gaps(pid) { return PEO.gap(pid).filter(function (r) { return !isRetired(r.skillId); }).map(function (r) { r.pid = pid; return r; }); }
  var SOURCE_NOTE = '<p class="govuk-hint">Data sources: expected levels come from your role profile in the published framework (v' + '%V' + '). Self-assessment is your own voluntary view. The formal CBP score is the moderated result from a published assessment. They are different evidence types and are not combined. Learning completion is not treated as skill evidence.</p>';
  function sourceNote() { return SOURCE_NOTE.replace('%V', cur().version); }

  /* Persona and navigation */
  function allowed(nav, me) {
    var p = me.persona;
    switch (nav) {
      case 'home': case 'framework': return true;
      case 'profile': case 'assess': case 'history': return !!me.role && HAS_ROLE_NAV.indexOf(p) > -1;
      case 'team': return p === 'manager';
      case 'insight': return p === 'hop';
      case 'fwadmin': return p === 'hop' || p === 'platform';
    }
    return false;
  }
  function applyNav(me) {
    document.querySelectorAll('[data-nav]').forEach(function (li) { li.hidden = !allowed(li.getAttribute('data-nav'), me); });
  }
  function personaBar(me) {
    var rp = me.role && PEO.roleProfile(me.role);
    return '<div class="toolbar persona-bar" style="margin-bottom:15px"><label class="govuk-label govuk-!-margin-bottom-0" for="persona"><strong>Viewing as</strong></label> <select class="govuk-select" id="persona" name="persona">' +
      PEO.personas().map(function (p) { return '<option value="' + p.id + '"' + (p.id === me.id ? ' selected' : '') + '>' + E(p.name + ' \u2013 ' + PEO.ROLES[p.persona]) + '</option>'; }).join('') +
      '</select> <span class="muted">' + E(me.name) + (rp ? ', ' + E(rp.name) + ', ' + E(me.team) : ', ' + E(me.team)) + '</span></div>';
  }
  function view(pattern, nav, fn) {
    UI.route(pattern, function (p) {
      var me = PEO.me(); applyNav(me);
      var head = personaBar(me);
      if (!allowed(nav, me)) return head + UI.pageHead('Not available for this persona', 'This screen is not part of the ' + E(PEO.ROLES[me.persona].toLowerCase()) + ' journey. ' + UI.link('#/', 'Go to your home page') + '.');
      return head + fn(p, me);
    }, nav);
  }
  UI.on('change', '#persona', function (e, el) { PEO.setMe(el.value); UI.go(location.hash || '#/'); });

  /* Home */
  function outstanding(me) {
    var t = [], rp = me.role && PEO.roleProfile(me.role);
    if (rp && allowed('assess', me)) {
      var g = gaps(me.id), none = g.filter(function (r) { return r.self == null && r.expected != null; }), old = g.filter(function (r) { return r.stale; });
      if (none.length) t.push('Record a self-assessment for ' + pl(none.length, 'skill') + ' that ' + (none.length === 1 ? 'has' : 'have') + ' no evidence yet. ' + UI.link('#/self-assess', 'Self-assess'));
      if (old.length) t.push(pl(old.length, 'self-assessment') + ' ' + (old.length === 1 ? 'is' : 'are') + ' more than a year old. ' + UI.link('#/profile', 'Review my capability'));
      if (!X().sharing[me.id]) t.push('Choose who can see your self-assessments. ' + UI.link('#/self-assess', 'Set sharing'));
      S.goals.filter(function (x) { return x.personId === me.id && x.status === 'active' && Date.parse(x.reviewDate) - Date.now() < 30 * DAY; }).forEach(function (x) { t.push('Goal review due ' + fd(x.reviewDate) + ' for ' + E(skillName(x.skillId)) + '.'); });
    }
    if (me.persona === 'manager') {
      var team = S.people.filter(function (p) { return p.manager === me.id && p.role; }), shared = team.filter(function (p) { return X().sharing[p.id] === 'manager'; }).length;
      t.push(shared + ' of ' + team.length + ' team members have chosen to share with you. ' + UI.link('#/team', 'Open my team'));
    }
    if (me.persona === 'hop' || me.persona === 'platform') {
      var d = S.frameworks.filter(function (f) { return f.status === 'draft'; })[0];
      if (d) t.push('Framework v' + d.version + ' is a draft awaiting approval. ' + UI.link('#/framework/admin', 'Open framework admin'));
    }
    if (me.persona === 'hop') t.push('Review aggregated capability and plan interventions. ' + UI.link('#/insight', 'Open insight'));
    return t;
  }
  function skillName(id) { var s = PEO.skill(cur().id, id) || PEO.skill('FW-1', id); return s ? s.name : id; }
  view('/', 'home', function (p, me) {
    var rp = me.role && PEO.roleProfile(me.role), t = outstanding(me), h = '';
    h += UI.pageHead('Skills and capability', 'Signed in as ' + E(me.name) + '. Your role: ' + (rp ? E(rp.name) + ' (' + E(rp.grade) + '), ' + E(me.team) : 'no role profile; ' + E(PEO.ROLES[me.persona])) + '.');
    if (ST.flash) { h += UI.callout('ok', '', ST.flash); ST.flash = null; }
    h += UI.panel('Outstanding tasks', t.length ? '<ul class="govuk-list govuk-list--bullet">' + t.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>' : '<p class="govuk-body">Nothing outstanding.</p>');
    if (me.role) {
      var goals = S.goals.filter(function (x) { return x.personId === me.id; });
      h += UI.panel('My development goals', table(['Skill', 'Target level', 'Target date', 'Status', 'Source'], goals.map(function (x) {
        return [E(skillName(x.skillId)), E(lvl(x.targetLevel)), fd(x.targetDate), UI.tag(x.status, x.status === 'active' ? 'blue' : 'green'), E(x.source === 'self' ? 'Self-set' : x.source === 'cbp-feedback' ? 'From CBP feedback theme' : x.source)];
      })) + '<p class="govuk-hint">Learning to support these goals is managed in the ' + UI.link('../learning/', 'learning prototype') + '.</p>' + goalForm());
    } else if (me.persona === 'platform') {
      h += UI.panel('Recent audit entries', table(['When', 'Actor', 'Action', 'Entity'], S.audit.slice(0, 8).map(function (a) { return [UI.fmtTime(a.at), E(a.actor), E(a.action), E(a.entity)]; })));
      h += UI.panel('Recent events', table(['When', 'Event', 'Entity'], S.events.slice(0, 6).map(function (a) { return [UI.fmtTime(a.occurredAt), E(a.eventType), E(a.entityId)]; })));
    }
    return h;
  });
  function goalForm() {
    var v = ST.vals && ST.vals.form === 'goal' ? ST.vals : {}, errs = ST.errs && ST.vals && ST.vals.form === 'goal' ? ST.errs : [];
    function er(id) { var e = errs.filter(function (x) { return x.id === id; })[0]; return e ? { err: e.msg } : {}; }
    return '<details class="govuk-details"><summary class="govuk-details__summary"><span class="govuk-details__summary-text">Add a development goal</span></summary><div class="govuk-details__text"><form data-form="goal" novalidate>' + UI.errorSummary(errs) +
      UI.select('g-skill', 'Skill', activeSkillIds().map(function (id) { return { value: id, label: skillName(id) }; }), v['g-skill']) +
      UI.select('g-level', 'Target level', [1, 2, 3].map(function (n) { return { value: n, label: lvl(n) }; }), v['g-level'] || 2) +
      UI.input('g-date', 'Target date', v['g-date'] || '', Object.assign({ type: 'date' }, er('g-date'))) +
      '<button class="govuk-button" data-module="govuk-button">Add goal</button></form></div></details>';
  }
  UI.on('submit', 'form[data-form="goal"]', function (e, f) {
    e.preventDefault(); var d = UI.formData(f), errs = [], me = PEO.me();
    if (!d['g-date'] || Date.parse(d['g-date']) <= Date.now()) errs.push({ id: 'g-date', msg: 'Enter a target date in the future' });
    if (errs.length) { ST.errs = errs; ST.vals = Object.assign({ form: 'goal' }, d); return UI.go('#/'); }
    ST.errs = ST.vals = null; PEO.createGoal(me.id, d['g-skill'], d['g-level'], new Date(d['g-date']).toISOString(), 'self', ''); PEO.save(); ST.flash = 'Development goal added.'; UI.go('#/');
  });

  /* My capability */
  view('/profile', 'profile', function (p, me) {
    var rp = PEO.roleProfile(me.role), g = gaps(me.id), fw = cur();
    var sh = X().sharing[me.id], asp = X().aspirations[me.id], fl = ST.flash ? UI.callout('ok', '', ST.flash) : ''; ST.flash = null;
    return fl + UI.pageHead('My capability', 'Role profile: ' + E(rp.name) + ' (' + E(rp.grade) + '). Framework v' + fw.version + ' (' + E(fw.status) + ', effective ' + fd(fw.effective) + ').', UI.link('#/self-assess', 'Record a self-assessment')) +
      table(['Skill', 'Expected for my role profile', 'Self-assessed', 'Formal CBP final', 'Gap: self-assessed vs expected', 'Gap: formal vs expected'],
        g.map(function (r) {
          return ['<strong>' + E(r.name) + '</strong>', E(lvl(r.expected)) + '<br><span class="muted">Framework v' + r.frameworkVersion + '</span>', selfCell(r), formalCell(me.id, r.skillId), gapCell(r.expected, r.self, 'Self-assessed', r.stale), gapCell(r.expected, r.formal, 'Formal CBP', false)];
        })) + sourceNote() +
      UI.panel('Sharing and aspirations', '<dl class="kv"><dt>Who can see my self-assessments</dt><dd>' + (sh ? E(SHARE_SHORT[sh]) : 'Not chosen yet (treated as nobody)') + '</dd><dt>Aspirations</dt><dd>' + (asp && asp.aspirations ? E(asp.aspirations) : '\u2013') + '</dd><dt>Specialisms</dt><dd>' + (asp && asp.specialisms ? E(asp.specialisms) : '\u2013') + '</dd></dl>' + UI.link('#/self-assess', 'Change'));
  });

  /* Self-assess */
  function levelRadios(skillId, val, err) {
    var sk = PEO.skill(cur().id, skillId), opts = [0, 1, 2, 3].map(function (n) { return '<div class="govuk-radios__item"><input class="govuk-radios__input" id="level-' + n + '" name="level" type="radio" value="' + n + '"' + (String(val) === String(n) ? ' checked' : '') + '><label class="govuk-label govuk-radios__label" for="level-' + n + '"><strong>' + E(lvl(n)) + '</strong><br><span class="muted">' + E(sk ? sk.descriptors[n] : '') + '</span></label></div>'; }).join('');
    return '<div class="govuk-form-group' + (err ? ' govuk-form-group--error' : '') + '" id="level"><fieldset class="govuk-fieldset"><legend class="govuk-fieldset__legend govuk-fieldset__legend--s">Level (framework v' + cur().version + ' descriptors)</legend>' + (err ? '<p class="govuk-error-message">' + E(err) + '</p>' : '') + '<div class="govuk-radios govuk-radios--small">' + opts + '</div></fieldset></div>';
  }
  function selfPage(p, me) {
    var v = ST.vals && ST.vals.form === 'self' ? ST.vals : {}, errs = ST.errs && ST.vals && ST.vals.form === 'self' ? ST.errs : [], pv = ST.vals && ST.vals.form === 'prefs' ? ST.vals : null, perrs = pv ? ST.errs : [];
    function er(id) { var e = errs.filter(function (x) { return x.id === id; })[0]; return e ? { err: e.msg } : {}; }
    var skillId = p.skill || v.skill || activeSkillIds()[0], asp = X().aspirations[me.id] || {}, sh = pv ? pv.sharing : X().sharing[me.id];
    var latest = PEO.latestSelf(me.id, skillId), pe = function (id) { var e = (perrs || []).filter(function (x) { return x.id === id; })[0]; return e ? { err: e.msg } : {}; };
    return UI.pageHead('Self-assess', 'Record how you see your own level against framework v' + cur().version + '. This is self-assessed evidence: it is stored separately from any formal CBP result.') +
      '<form data-form="self" novalidate>' + UI.errorSummary(errs) +
      UI.select('skill', 'Skill', activeSkillIds().map(function (id) { return { value: id, label: skillName(id) }; }), skillId, er('skill')) +
      '<div id="current-self" class="govuk-hint">' + currentSelfHint(me.id, skillId) + '</div>' +
      levelRadios(skillId, v.level, er('level').err) +
      UI.select('confidence', 'How confident are you in this assessment?', [{ value: '', label: 'Choose' }, 'Low', 'Medium', 'High'], v.confidence || '', er('confidence')) +
      UI.textarea('evidence', 'Evidence or examples', v.evidence || '', Object.assign({ rows: 4, hint: 'Briefly describe work that supports your chosen level. Do not include personal or sensitive information.' }, er('evidence'))) +
      UI.input('link', 'Link to supporting evidence (optional)', v.link || '', Object.assign({ type: 'url' }, er('link'))) +
      '<button class="govuk-button" data-module="govuk-button">Save self-assessment</button></form>' + (latest ? '' : '') +
      '<h2 class="govuk-heading-m">Aspirations, specialisms and sharing</h2><form data-form="prefs" novalidate>' + UI.errorSummary(perrs || []) +
      UI.textarea('aspirations', 'Career aspirations (optional)', pv ? pv.aspirations : asp.aspirations || '', { rows: 2 }) +
      UI.input('specialisms', 'Specialisms (optional)', pv ? pv.specialisms : asp.specialisms || '') +
      UI.radios('sharing', 'Who can see my self-assessments and specialisms?', ['manager', 'hop', 'nobody'].map(function (k) { return { value: k, label: SHARE[k] }; }), sh || '', Object.assign({ hint: 'Aggregated, anonymised reporting does not show names. You can change this at any time.' }, pe('sharing'))) +
      '<button class="govuk-button govuk-button--secondary" data-module="govuk-button">Save preferences</button></form>';
  }
  function currentSelfHint(pid, skillId) { var l = PEO.latestSelf(pid, skillId); return l ? 'Your latest self-assessment for this skill: ' + E(lvl(l.level)) + ', ' + fd(l.at) + ', ' + E(l.confidence.toLowerCase()) + ' confidence.' : 'You have not self-assessed this skill yet.'; }
  view('/self-assess', 'assess', selfPage);
  view('/self-assess/:skill', 'assess', selfPage);
  UI.on('change', 'form[data-form="self"] #skill', function (e, el) {
    var f = el.form, cr = f.querySelector('input[name="level"]:checked'), box = document.getElementById('level');
    box.outerHTML = levelRadios(el.value, cr ? cr.value : '');
    document.getElementById('current-self').innerHTML = currentSelfHint(PEO.me().id, el.value);
  });
  UI.on('submit', 'form[data-form="self"]', function (e, f) {
    e.preventDefault(); var d = UI.formData(f), errs = [], me = PEO.me();
    if (!d.skill || activeSkillIds().indexOf(d.skill) < 0) errs.push({ id: 'skill', msg: 'Choose a skill' });
    if (['0', '1', '2', '3'].indexOf(d.level) < 0) errs.push({ id: 'level', msg: 'Choose a level from 0 to 3' });
    if (!d.confidence) errs.push({ id: 'confidence', msg: 'Choose your confidence' });
    if (!d.evidence || d.evidence.trim().length < 10) errs.push({ id: 'evidence', msg: 'Describe your evidence in at least 10 characters' });
    if (d.link && !/^https?:\/\/\S+$/i.test(d.link.trim())) errs.push({ id: 'link', msg: 'Enter a link starting with http:// or https://' });
    if (errs.length) { ST.errs = errs; ST.vals = Object.assign({ form: 'self' }, d); return UI.go(location.hash); }
    var before = gaps(me.id).filter(function (r) { return r.skillId === d.skill; })[0];
    var rec = PEO.recordSelf(me.id, d.skill, d.level, d.confidence, d.evidence.trim());
    if (d.link) rec.link = d.link.trim();
    PEO.save();
    var after = gaps(me.id).filter(function (r) { return r.skillId === d.skill; })[0];
    function gt(r) { return r.selfGap == null ? 'no gap calculated' : r.selfGap > 0 ? pl(r.selfGap, 'level') + ' below expected' : r.selfGap === 0 ? 'meets expected' : pl(-r.selfGap, 'level') + ' above expected'; }
    ST.errs = ST.vals = null; ST.flash = 'Self-assessment saved for ' + E(after.name) + '. Self-assessed gap before: ' + gt(before) + '. Now: ' + gt(after) + '.';
    UI.go('#/profile');
  });
  UI.on('submit', 'form[data-form="prefs"]', function (e, f) {
    e.preventDefault(); var d = UI.formData(f), errs = [], me = PEO.me();
    if (!SHARE[d.sharing]) errs.push({ id: 'sharing-0', msg: 'Choose who can see your self-assessments' });
    if ((d.aspirations || '').length > 500) errs.push({ id: 'aspirations', msg: 'Aspirations must be 500 characters or fewer' });
    if (errs.length) { ST.errs = errs; ST.vals = Object.assign({ form: 'prefs' }, d); return UI.go(location.hash); }
    X().sharing[me.id] = d.sharing; X().aspirations[me.id] = { aspirations: d.aspirations.trim(), specialisms: d.specialisms.trim(), at: new Date().toISOString() };
    PEO.audit(me.name, 'Changed skills sharing choice', me.id, SHARE_SHORT[d.sharing]); PEO.save();
    ST.errs = ST.vals = null; ST.flash = 'Preferences saved. Sharing: ' + E(SHARE_SHORT[d.sharing]) + '.'; UI.go('#/profile');
  });

  /* History */
  view('/history', 'history', function (p, me) {
    var all = S.selfAssessments.filter(function (s) { return s.personId === me.id; }).sort(function (a, b) { return Date.parse(a.at) - Date.parse(b.at); }), prev = {}, rows = [];
    all.forEach(function (s) { rows.push({ s: s, from: prev[s.skillId] == null ? null : prev[s.skillId] }); prev[s.skillId] = s.level; });
    rows.reverse();
    var formal = S.attempts.filter(function (a) { return a.personId === me.id && a.status === 'published'; });
    return UI.pageHead('History', 'How your recorded evidence has changed over time. Each entry keeps the framework version in force when it was recorded.') +
      UI.panel('Self-assessments', table(['Date', 'Skill', 'Level', 'Change', 'Confidence', 'Framework version', 'Evidence'], rows.map(function (r) {
        var s = r.s; return [fd(s.at), E(skillName(s.skillId)), E(lvl(s.level)), r.from == null ? 'First entry' : r.from === s.level ? 'No change' : 'From ' + r.from + ' to ' + s.level, E(s.confidence), 'v' + s.frameworkVersion + (staleOf(s.at) ? ' ' + UI.tag('Stale', 'orange') : ''), E(s.evidence || '\u2013') + (s.link ? '<br><a class="govuk-link" href="' + E(s.link) + '">Link</a>' : '')];
      }))) +
      UI.panel('Formal CBP outcomes (separate evidence type)', table(['Published', 'Attempt', 'Framework version', 'Final scores by skill'], formal.map(function (a) {
        var fw = PEO.framework(a.frameworkId);
        return [fd(a.publishedAt), E(a.id), 'v' + fw.version + ' (' + E(fw.status) + ')', Object.keys(a.moderation.finals).map(function (k) { return E(skillName(k)) + ': ' + a.moderation.finals[k].score; }).join('<br>')];
      })) + '<p class="govuk-hint">Formal scores are shown only to you here. Your line manager does not automatically see them.</p>');
  });

  /* Framework browse */
  function descTable(fw) {
    return table(['Skill', '0 Not yet evidenced', '1 Developing', '2 Secure', '3 Strong'], fw.skills.map(function (s) {
      return ['<strong>' + E(s.name) + '</strong><br><span class="muted">' + E(s.category) + '</span>' + (isRetired(s.id) ? '<br>' + UI.tag('Retired', 'grey') : ''), E(s.descriptors[0]), E(s.descriptors[1]), E(s.descriptors[2]), E(s.descriptors[3])];
    }));
  }
  view('/framework', 'framework', function (p, me) {
    var fws = S.frameworks.slice(), opts = fws.map(function (f) { return { value: f.id, label: 'v' + f.version + ' (' + f.status + ')' }; });
    var att = PEO.byId(S.attempts, 'ATT-001'), afw = att && PEO.framework(att.frameworkId), c = cur(), owner = att && att.personId === me.id, rows = [];
    if (att) afw.skills.forEach(function (s) {
      [0, 1, 2, 3].forEach(function (l) { var now = PEO.skill(c.id, s.id); if (now && now.descriptors[l] !== s.descriptors[l]) rows.push([E(s.name), l, E(s.descriptors[l]), E(now.descriptors[l])]); });
    });
    return UI.pageHead('Skills framework', 'Service design profession. Published versions are never overwritten: a new version supersedes the old one, and each assessment keeps the version it used.') +
      table(['Version', 'Status', 'Effective', 'Skills', 'Change log', ''], fws.map(function (f) {
        return ['v' + f.version + ' (' + E(f.id) + ')', fwTag(f), fd(f.effective), f.skills.length, '<ul class="govuk-list govuk-list--bullet">' + f.changeLog.map(function (x) { return '<li>' + E(x) + '</li>'; }).join('') + '</ul>', UI.link('#/framework/' + f.id, 'View')];
      })) +
      UI.panel('Compare versions', '<form data-form="diff"><div class="toolbar">' + UI.select('diff-a', 'From', opts, fws[0].id) + UI.select('diff-b', 'To', opts, c.id) + '<button class="govuk-button govuk-button--secondary" data-module="govuk-button">Show differences</button></div></form>') +
      UI.panel('Versioning check: ATT-001', att ? '<p class="govuk-body">Assessment attempt <strong>' + E(att.id) + '</strong> references <strong>' + E(afw.id) + '</strong> (v' + afw.version + ', ' + E(afw.status) + '). The descriptors it was assessed against are read from that stored version, not from the current published v' + c.version + '.' + (owner ? ' Your final scores for this attempt: ' + Object.keys(att.moderation.finals).map(function (k) { return E(k) + ' = ' + att.moderation.finals[k].score; }).join(', ') + '.' : '') + '</p>' +
        (rows.length ? table(['Skill', 'Level', 'Descriptor in ' + E(afw.id) + ' (used by ATT-001)', 'Descriptor in current published version'], rows) : '<p class="govuk-body">No descriptor has changed since ' + E(afw.id) + '.</p>') : '<p class="govuk-body">Attempt not found.</p>');
  });
  UI.on('submit', 'form[data-form="diff"]', function (e, f) { e.preventDefault(); var d = UI.formData(f); UI.go('#/framework/diff/' + d['diff-a'] + '/' + d['diff-b']); });

  view('/framework/diff/:a/:b', 'framework', function (p) {
    var A = PEO.framework(p.a), B = PEO.framework(p.b);
    if (!A || !B) return UI.pageHead('Versions not found') + UI.link('#/framework', 'Back to framework');
    var rows = [], ids = {};
    A.skills.concat(B.skills).forEach(function (s) { ids[s.id] = 1; });
    Object.keys(ids).forEach(function (id) {
      var a = PEO.skill(A.id, id), b = PEO.skill(B.id, id), nm = (b || a).name;
      if (!a || !b) return rows.push([E(nm), '\u2013', a ? 'Present in v' + A.version + ' only' : 'Not in v' + A.version, b ? 'Present in v' + B.version : 'Removed']);
      [0, 1, 2, 3].forEach(function (l) { if (a.descriptors[l] !== b.descriptors[l]) rows.push([E(nm), l, E(a.descriptors[l]), E(b.descriptors[l])]); });
    });
    return UI.pageHead('Compare v' + A.version + ' with v' + B.version, UI.link('#/framework', 'Back to framework')) +
      (rows.length ? table(['Skill', 'Level', 'v' + A.version + ' (' + E(A.status) + ')', 'v' + B.version + ' (' + E(B.status) + ')'], rows) : UI.callout('', '', 'No descriptor differences between these versions.')) +
      UI.panel('Change log, v' + B.version, '<ul class="govuk-list govuk-list--bullet">' + B.changeLog.map(function (x) { return '<li>' + E(x) + '</li>'; }).join('') + '</ul>');
  });

  /* Framework admin */
  function exportJson(fw) {
    return JSON.stringify({ id: fw.id, version: fw.version, status: fw.status, effective: fw.effective, profession: fw.profession, changeLog: fw.changeLog,
      skills: fw.skills.map(function (s) { return { id: s.id, name: s.name, category: s.category, definition: s.definition, retired: isRetired(s.id), descriptors: s.descriptors }; }),
      roleProfiles: S.roleProfiles.map(function (r) { return { id: r.id, name: r.name, grade: r.grade, expected: r.expected }; }) }, null, 2);
  }
  function csvQ(s) { return '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"'; }
  function exportCsv(fw) {
    var out = ['skill_id,skill_name,category,level,descriptor,status'];
    fw.skills.forEach(function (s) { [0, 1, 2, 3].forEach(function (l) { out.push([s.id, csvQ(s.name), csvQ(s.category), l, csvQ(s.descriptors[l]), isRetired(s.id) ? 'retired' : 'active'].join(',')); }); });
    return out.join('\n');
  }
  function parseCsv(text) {
    var rows = [], row = [], f = '', q = false, i, c;
    for (i = 0; i < text.length; i++) {
      c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); f = ''; if (row.length > 1 || row[0]) rows.push(row); row = []; }
      else f += c;
    }
    row.push(f); if (row.length > 1 || row[0]) rows.push(row); return rows;
  }
  function importItems(text) {
    var items = [], t = text.trim();
    if (!t) throw new Error('Paste some JSON or CSV first.');
    if (t[0] === '{' || t[0] === '[') {
      var j = JSON.parse(t), sk = Array.isArray(j) ? j : j.skills;
      if (!Array.isArray(sk)) throw new Error('JSON must contain a "skills" array.');
      sk.forEach(function (s) { Object.keys(s.descriptors || {}).forEach(function (l) { items.push({ skillId: s.id, level: l, text: s.descriptors[l] }); }); });
    } else {
      var rows = parseCsv(t), head = rows.shift().map(function (h) { return h.trim().toLowerCase(); }), ix = head.indexOf('skill_id'), il = head.indexOf('level'), id = head.indexOf('descriptor');
      if (ix < 0 || il < 0 || id < 0) throw new Error('CSV needs the columns skill_id, level and descriptor.');
      rows.forEach(function (r) { items.push({ skillId: r[ix], level: r[il], text: r[id] }); });
    }
    return items;
  }
  function draftFw() { return S.frameworks.filter(function (f) { return f.status === 'draft'; })[0]; }
  function adminPage(p, me) {
    var d = draftFw(), c = cur(), h = UI.pageHead('Framework admin', 'Edit the draft, approve it for publication, retire skills and exchange the framework as data. Published versions cannot be edited.');
    if (ST.flash) { h += UI.callout('ok', '', ST.flash); ST.flash = null; }
    var xv = ST.exp || c.id, xf = ST.fmt || 'json', xfw = PEO.framework(xv) || c;
    h += UI.panel(d ? 'Draft v' + d.version + ' (' + E(d.id) + ')' : 'No draft version', d ?
      '<p class="govuk-body">Effective date when published: today. Publishing supersedes v' + c.version + ' (' + E(c.id) + '). Existing assessment attempts keep the version they used.</p>' +
      '<ul class="govuk-list govuk-list--bullet">' + d.changeLog.map(function (x) { return '<li>' + E(x) + '</li>'; }).join('') + '</ul>' + UI.link('#/framework/diff/' + c.id + '/' + d.id, 'See differences from v' + c.version) +
      '<h3 class="govuk-heading-s govuk-!-margin-top-4">Edit a descriptor</h3><form data-form="desc" novalidate>' + (ST.errs && ST.vals && ST.vals.form === 'desc' ? UI.errorSummary(ST.errs) : '') +
      UI.select('d-skill', 'Skill', d.skills.map(function (s) { return { value: s.id, label: s.name }; }), 'SK-01') + UI.select('d-level', 'Level', [0, 1, 2, 3].map(function (n) { return { value: n, label: lvl(n) }; }), 0) +
      UI.textarea('d-text', 'Descriptor', d.skills[0].descriptors[0], { rows: 3 }) + '<button class="govuk-button govuk-button--secondary" data-module="govuk-button">Save draft descriptor</button></form>' +
      UI.button('Approve and publish v' + d.version, 'data-publish="' + d.id + '"') :
      '<p class="govuk-body">All versions are published or superseded.</p>' + UI.button('Create draft from v' + c.version, 'data-new-draft', 'govuk-button--secondary'));
    h += UI.panel('Skills in v' + c.version, table(['Skill', 'Status', ''], c.skills.map(function (s) {
      var r = X().retired[s.id];
      return [E(s.name), r ? UI.tag('Retired', 'grey') + '<br><span class="muted">' + fd(r.at) + ' by ' + E(r.by) + '. History is kept.</span>' : UI.tag('Active', 'green'),
        UI.button(r ? 'Restore ' + s.name : 'Retire ' + s.name, 'data-retire="' + s.id + '"', 'govuk-button--secondary')];
    })) + '<p class="govuk-hint">Retiring removes a skill from new self-assessments, gaps and insight. It is never deleted, so past evidence stays readable.</p>');
    h += UI.panel('Export preview', '<div class="toolbar">' + UI.select('x-ver', 'Version', S.frameworks.map(function (f) { return { value: f.id, label: 'v' + f.version + ' (' + f.status + ')' }; }), xv) + UI.select('x-fmt', 'Format', [{ value: 'json', label: 'JSON' }, { value: 'csv', label: 'CSV' }], xf) + '</div>' +
      '<label class="govuk-label govuk-label--s" for="x-out">Export content (preview only, no file is created)</label><textarea class="govuk-textarea" id="x-out" rows="10" readonly>' + E(xf === 'csv' ? exportCsv(xfw) : exportJson(xfw)) + '</textarea>');
    h += UI.panel('Import preview', '<form data-form="import" novalidate><label class="govuk-label govuk-label--s" for="i-in">Paste framework JSON or CSV</label><textarea class="govuk-textarea" id="i-in" name="i-in" rows="6">' + E(ST.imp || '') + '</textarea><button class="govuk-button govuk-button--secondary" data-module="govuk-button">Preview import</button></form><div id="i-out">' + (ST.impOut || '') + '</div><p class="govuk-hint">Preview only: nothing is changed in the draft.</p>');
    return h;
  }
  view('/framework/admin', 'fwadmin', adminPage);
  UI.on('change', '#d-skill, #d-level', function (e, el) {
    var d = draftFw(), f = el.form, s = d && d.skills.filter(function (x) { return x.id === f.elements['d-skill'].value; })[0]; if (s) f.elements['d-text'].value = s.descriptors[f.elements['d-level'].value];
  });
  UI.on('change', '#x-ver, #x-fmt', function () {
    ST.exp = document.getElementById('x-ver').value; ST.fmt = document.getElementById('x-fmt').value;
    var fw = PEO.framework(ST.exp); document.getElementById('x-out').value = ST.fmt === 'csv' ? exportCsv(fw) : exportJson(fw);
  });
  UI.on('submit', 'form[data-form="desc"]', function (e, f) {
    e.preventDefault(); var d = UI.formData(f), dr = draftFw(), me = PEO.me(), t = (d['d-text'] || '').trim();
    if (!dr) return;
    if (t.length < 10 || t.length > 300) { ST.errs = [{ id: 'd-text', msg: 'Descriptor must be 10 to 300 characters' }]; ST.vals = { form: 'desc' }; return UI.go(location.hash); }
    var s = dr.skills.filter(function (x) { return x.id === d['d-skill']; })[0], l = Number(d['d-level']);
    if (s.descriptors[l] !== t) {
      s.descriptors[l] = t; var line = 'Edited descriptor: ' + s.name + ', level ' + l;
      if (dr.changeLog.indexOf(line) < 0) dr.changeLog.push(line);
      PEO.audit(me.name, 'Edited draft descriptor', dr.id, s.id + ' level ' + l); PEO.save();
    }
    ST.errs = ST.vals = null; ST.flash = 'Draft descriptor saved.'; UI.go(location.hash);
  });
  UI.on('click', '[data-publish]', function (e, el) {
    var id = el.getAttribute('data-publish'), d = PEO.framework(id), c = cur();
    UI.modal('Approve and publish v' + d.version, '<p class="govuk-body">This publishes ' + E(d.id) + ' as v' + d.version + ' and supersedes v' + c.version + '. Existing CBP attempts keep the framework version they used. This action is audited.</p><button type="button" class="govuk-button" data-module="govuk-button" data-publish-confirm="' + E(id) + '">Confirm and publish</button>');
  });
  UI.on('click', '[data-publish-confirm]', function (e, el) {
    var id = el.getAttribute('data-publish-confirm'), d = PEO.framework(id), me = PEO.me();
    if (!d || d.status !== 'draft') return UI.closeModal();
    var prev = cur();
    prev.status = 'superseded'; d.status = 'published'; d.effective = new Date().toISOString().slice(0, 10);
    d.changeLog = d.changeLog.map(function (x) { return x.replace(/^Draft: /, '').replace(/ \(not yet approved\)$/, ''); }); d.changeLog.push('Approved and published by ' + me.name + ' on ' + fd(new Date().toISOString()));
    PEO.audit(me.name, 'Published framework', d.id, 'v' + d.version + ' supersedes v' + prev.version); PEO.event('framework.published', d.id); PEO.save();
    UI.closeModal(); ST.flash = 'Framework v' + d.version + ' is now published. v' + prev.version + ' is superseded.'; UI.go(location.hash);
  });
  UI.on('click', '[data-new-draft]', function () {
    var c = cur(), me = PEO.me(), n = PEO.clone(c), max = Math.max.apply(null, S.frameworks.map(function (f) { return f.version; })) + 1;
    n.id = 'FW-' + max; n.version = max; n.status = 'draft'; n.effective = null; n.changeLog = ['Draft: copied from v' + c.version];
    S.frameworks.push(n); PEO.audit(me.name, 'Created draft framework', n.id, 'From ' + c.id); PEO.save(); ST.flash = 'Draft v' + max + ' created.'; UI.go(location.hash);
  });
  UI.on('click', '[data-retire]', function (e, el) {
    var id = el.getAttribute('data-retire'), me = PEO.me();
    if (X().retired[id]) { delete X().retired[id]; PEO.audit(me.name, 'Restored skill', id); }
    else { X().retired[id] = { at: new Date().toISOString(), by: me.name, version: cur().version }; PEO.audit(me.name, 'Retired skill', id, 'Not deleted; history kept'); }
    PEO.save(); UI.go(location.hash);
  });
  UI.on('submit', 'form[data-form="import"]', function (e, f) {
    e.preventDefault(); var text = f.elements['i-in'].value, dr = draftFw(), out;
    ST.imp = text;
    try {
      var items = importItems(text), ch = 0, same = 0, errs = [], rows = [];
      items.forEach(function (it, i) {
        var s = dr && dr.skills.filter(function (x) { return x.id === it.skillId; })[0], l = Number(it.level);
        if (!s) return errs.push('Row ' + (i + 1) + ': unknown skill ' + (it.skillId || '(blank)') + '.');
        if ([0, 1, 2, 3].indexOf(l) < 0 || it.level === '' || it.level == null) return errs.push('Row ' + (i + 1) + ': level must be 0 to 3.');
        if (!it.text || !String(it.text).trim()) return errs.push('Row ' + (i + 1) + ': descriptor is blank.');
        if (s.descriptors[l] === it.text) same++; else { ch++; rows.push([E(s.name), l, E(s.descriptors[l]), E(it.text)]); }
      });
      out = (dr ? '' : UI.callout('warn', '', 'There is no draft version to compare with. Create a draft first.')) + '<p class="govuk-body">' + pl(items.length, 'row') + ' read: <strong>' + ch + ' would change</strong>, ' + same + ' unchanged, ' + pl(errs.length, 'error') + '.</p>' +
        (errs.length ? '<ul class="govuk-list govuk-list--bullet">' + errs.map(function (x) { return '<li>' + E(x) + '</li>'; }).join('') + '</ul>' : '') + (rows.length ? table(['Skill', 'Level', 'Current draft', 'Imported'], rows) : '');
    } catch (err) { out = UI.callout('bad', 'Cannot read this import.', E(err.message)); }
    ST.impOut = out; document.getElementById('i-out').innerHTML = out;
  });

  /* Framework detail */
  view('/framework/:id', 'framework', function (p, me) {
    var fw = PEO.framework(p.id); if (!fw) return UI.pageHead('Framework version not found') + UI.link('#/framework', 'Back');
    return UI.pageHead('Framework v' + fw.version + ' (' + fw.id + ')', fwTag(fw) + ' Effective ' + fd(fw.effective) + '. ' + UI.link('#/framework', 'All versions')) +
      (fw.status === 'draft' ? UI.callout('warn', 'Draft.', 'This version is not approved and is not used for gaps or assessments.') : '') +
      UI.panel('Skills and proficiency descriptors', descTable(fw)) +
      UI.panel('Role profile expectations', table(['Role profile'].concat(fw.skills.map(function (s) { return E(s.name); })), S.roleProfiles.map(function (r) { return [E(r.name) + '<br><span class="muted">' + E(r.grade) + '</span>'].concat(fw.skills.map(function (s) { return r.expected[s.id] == null ? '\u2013' : E(lvl(r.expected[s.id])); })); })) + '<p class="govuk-hint">Role profile expectations are held once for the profession and are shown against each version.</p>') +
      UI.panel('Change log', '<ul class="govuk-list govuk-list--bullet">' + fw.changeLog.map(function (x) { return '<li>' + E(x) + '</li>'; }).join('') + '</ul>' + (fw.id !== 'FW-1' ? UI.link('#/framework/diff/' + S.frameworks[Math.max(0, S.frameworks.indexOf(fw) - 1)].id + '/' + fw.id, 'Compare with the previous version') : ''));
  });

  /* Team (manager) */
  view('/team', 'team', function (p, me) {
    var team = S.people.filter(function (x) { return x.manager === me.id && x.role; }).sort(function (a, b) { return a.name < b.name ? -1 : 1; });
    var shared = team.filter(function (x) { return X().sharing[x.id] === 'manager'; });
    var h = UI.pageHead('My team', 'You can see capability only for people who chose to share it with their line manager. Formal CBP deliberations and scores are not shown here.');
    h += table(['Person', 'Role profile', 'Sharing', 'Self-assessed skills below expected', 'Latest self-assessment'], team.map(function (x) {
      var on = X().sharing[x.id] === 'manager', g = on ? gaps(x.id) : [], ev = g.filter(function (r) { return r.self != null; }), below = ev.filter(function (r) { return r.selfGap > 0; });
      var latest = ev.reduce(function (m, r) { return !m || Date.parse(r.selfAt) > Date.parse(m) ? r.selfAt : m; }, null);
      return [E(x.name), E(PEO.roleProfile(x.role).name), on ? UI.tag('Shared with me', 'green') : UI.tag('Not shared', 'grey'), on ? (ev.length ? below.length + ' of ' + ev.length + ' skills with evidence' : 'No evidence recorded yet') : 'Not shared', on ? fd(latest) : 'Not shared'];
    }));
    shared.forEach(function (x) {
      var g = gaps(x.id), a = X().aspirations[x.id];
      h += UI.panel(E(x.name) + ': self-assessed capability', (a && (a.aspirations || a.specialisms) ? '<p class="govuk-body">Aspirations: ' + E(a.aspirations || '\u2013') + '. Specialisms: ' + E(a.specialisms || '\u2013') + '.</p>' : '') +
        table(['Skill', 'Expected', 'Self-assessed', 'Gap'], g.map(function (r) { return [E(r.name), E(lvl(r.expected)), selfCell(r), gapCell(r.expected, r.self, 'Self-assessed', r.stale)]; })) +
        '<p class="govuk-hint">Source: self-assessment shared by the person. Expected levels from framework v' + cur().version + '.</p>');
    });
    return h;
  });

  /* Insight (head of profession) */
  function insightState() { return ST.ins || (ST.ins = { team: '', role: '' }); }
  function insightPage(p, me) {
    var f = insightState(), min = S.reporting.minCohort, agg = PEO.aggregate({ team: f.team || undefined, role: f.role || undefined }), ok = activeSkillIds();
    var rows = agg.rows.filter(function (r) { return ok.indexOf(r.skillId) > -1; }), supp = 'Suppressed (fewer than ' + min + ')', all = rows.every(function (r) { return r.suppressed; });
    var teams = S.people.filter(function (x) { return x.role; }).map(function (x) { return x.team; }).filter(function (t, i, a) { return a.indexOf(t) === i; }).sort();
    function cell(r, v, suffix) { return r.suppressed ? '<span class="muted">' + supp + '</span>' : E(v) + (suffix || ''); }
    var h = UI.pageHead('Capability insight', 'Aggregated and anonymised. No names or individual records are shown.');
    if (ST.flash) { h += UI.callout('ok', '', ST.flash); ST.flash = null; }
    h += '<form data-form="insight" class="toolbar">' + UI.select('f-cohort', 'Cohort', [{ value: 'profession', label: 'Service design profession (all staff with a role profile)' }], 'profession') +
      UI.select('f-team', 'Team', [{ value: '', label: 'All teams' }].concat(teams.map(function (t) { return { value: t, label: t }; })), f.team) +
      UI.select('f-role', 'Role profile', [{ value: '', label: 'All role profiles' }].concat(S.roleProfiles.map(function (r) { return { value: r.id, label: r.name }; })), f.role) + '</form>';
    h += UI.panel('How to read this', '<dl class="kv"><dt>Cohort</dt><dd>' + (agg.cohortSize >= min ? pl(agg.cohortSize, 'person') + ' in the selected group' : 'Fewer than ' + min + ' people in the selected group') + '</dd><dt>Evidence type</dt><dd>' + E(agg.source) + '. Formal CBP outcomes and learning completion are not included.</dd><dt>Framework version</dt><dd>Expected levels from v' + agg.frameworkVersion + '. Older self-assessments may have been recorded against earlier versions.</dd><dt>Time period</dt><dd>Latest self-assessment per person and skill, up to ' + fd(agg.generatedAt) + '. Stale means more than a year old.</dd></dl>' +
      '<p class="govuk-hint">Small groups: a cell is suppressed when fewer than ' + min + ' people have self-assessed evidence for the skill, so individuals cannot be identified. Low coverage means the data is incomplete, not that capability is low.</p>');
    h += all ? UI.callout('warn', 'Small group.', 'Every cell is suppressed for this selection. Widen the team or role filter to see aggregated results.') : '';
    h += table(['Skill', 'People with evidence', 'Coverage of group', 'Mean self-assessed level', 'Mean gap to expected', 'At or above expected', 'Stale evidence'], rows.map(function (r) {
      return ['<strong>' + E(r.name) + '</strong>', cell(r, r.withEvidence), cell(r, r.coveragePct, '%'), cell(r, r.meanSelf), cell(r, r.meanGap, ' levels'), cell(r, r.atOrAbovePct, '%'), cell(r, r.stalePct, '%')];
    }));
    var pre = rows.filter(function (r) { return !r.suppressed && r.meanGap > 0; }).map(function (r) { return r.skillId; });
    h += UI.panel('Create intervention', '<form data-form="intervention" novalidate>' + (ST.errs && ST.vals && ST.vals.form === 'int' ? UI.errorSummary(ST.errs) : '') + UI.input('i-title', 'Intervention title', '') +
      '<div class="govuk-form-group" id="i-skills"><fieldset class="govuk-fieldset"><legend class="govuk-fieldset__legend govuk-fieldset__legend--s">Target skills</legend><div class="govuk-checkboxes govuk-checkboxes--small">' +
      rows.map(function (r, i) { return '<div class="govuk-checkboxes__item"><input class="govuk-checkboxes__input" id="i-skills-' + i + '" name="i-skills" type="checkbox" value="' + r.skillId + '"' + (pre.indexOf(r.skillId) > -1 ? ' checked' : '') + '><label class="govuk-label govuk-checkboxes__label" for="i-skills-' + i + '">' + E(r.name) + '</label></div>'; }).join('') + '</div></fieldset></div>' +
      UI.select('i-format', 'Format', ['Workshop series', 'Online course', 'Mentoring', 'Community session', 'Coaching']) + UI.input('i-start', 'Planned start (optional)', '', { type: 'date' }) +
      '<button class="govuk-button" data-module="govuk-button">Create intervention</button></form><p class="govuk-hint">Skills with a mean gap above zero are pre-selected. The intervention appears in the ' + UI.link('../learning/#/interventions', 'learning prototype') + '.</p>');
    h += UI.panel('Existing interventions', table(['Title', 'Mapped skills', 'Status', 'Owner'], S.interventions.map(function (i) { return [E(i.title), E((i.skills || []).map(skillName).join(', ')), E(i.status), E(i.owner)]; })));
    return h;
  }
  view('/insight', 'insight', insightPage);
  UI.on('change', 'form[data-form="insight"] select', function (e, el) { var f = insightState(); f.team = el.form.elements['f-team'].value; f.role = el.form.elements['f-role'].value; UI.go('#/insight'); });
  UI.on('submit', 'form[data-form="intervention"]', function (e, f) {
    e.preventDefault(); var d = UI.formData(f), errs = [], me = PEO.me(), fl = insightState(), min = S.reporting.minCohort;
    if (!d['i-title'].trim()) errs.push({ id: 'i-title', msg: 'Enter a title' });
    if (!d['i-skills'].length) errs.push({ id: 'i-skills', msg: 'Choose at least one skill' });
    if (errs.length) { ST.errs = errs; ST.vals = { form: 'int' }; return UI.go('#/insight'); }
    var agg = PEO.aggregate({ team: fl.team || undefined, role: fl.role || undefined }), small = agg.rows.every(function (r) { return r.suppressed; });
    var it = { id: PEO.uid('INT'), title: d['i-title'].trim(), owner: me.name, skills: d['i-skills'], format: d['i-format'], status: 'planned', start: d['i-start'] ? new Date(d['i-start']).toISOString() : null, learningItemId: null,
      rationale: small ? 'Planned from aggregated self-assessed capability (framework v' + agg.frameworkVersion + '); filtered group too small to report.' : 'Aggregated self-assessed gaps for the selected group (framework v' + agg.frameworkVersion + ', cells under ' + min + ' suppressed).', participants: 0 };
    S.interventions.push(it); PEO.audit(me.name, 'Created intervention', it.id, it.skills.join(', ')); PEO.event('intervention.created', it.id); PEO.save();
    ST.errs = ST.vals = null; ST.flash = 'Intervention ' + E(it.id) + ' created for ' + E(it.skills.map(skillName).join(', ')) + '. ' + UI.link('../learning/#/interventions', 'Open interventions in the learning prototype'); UI.go('#/insight');
  });

  UI.start();
})();
