/* CBP assessment prototype (Enabler A, Journey A). Simulated: fictional data, no live integrations, no pay policy.
   Permissions are enforced in the data-access functions (D.*), not just by hiding links. Prototype-only state: PEO.get().ext.cbp. */
(function () {
  'use strict';
  var h = UI.esc, LIMIT = 1500, SCORES = ['0', '1', '2', '3'];
  var notice = null, formState = null;

  function X() { var S = PEO.get(); S.ext = S.ext || {}; var x = S.ext.cbp = S.ext.cbp || {}; x.modDrafts = x.modDrafts || {}; x.auditSensitive = !!x.auditSensitive; return x; }
  function S() { return PEO.get(); }
  function now() { return Date.now(); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function nextId(prefix, list) { var n = 0; list.forEach(function (i) { var m = String(i.id).match(/-(\d+)$/); if (m) n = Math.max(n, Number(m[1])); }); return prefix + '-' + String(n + 1).padStart(3, '0'); }
  function nameOf(id) { var p = PEO.person(id); return p ? p.name : id; }
  function isOverdue(r) { return !r.submittedAt && Date.parse(r.due) < now(); }
  function cycle(id) { return PEO.byId(S().cycles, id); }
  function attempt(id) { return PEO.byId(S().attempts, id); }
  function link(href, text) { return '<a class="govuk-link" href="' + h(href) + '">' + h(text) + '</a>'; }
  function fwLabel(id) { var f = PEO.framework(id); return f ? id + ' (version ' + f.version + ')' : id; }
  function scoreText(n) { return n + ' \u2013 ' + PEO.SCORE_LABELS[n]; }
  function scroll(x) { return '<div style="overflow-x:auto">' + x + '</div>'; }
  function para(t) { return h(t).replace(/\n/g, '<br>'); }
  function words(t) { return (String(t).trim().match(/\S+/g) || []).length; }

  var style = document.createElement('style');
  style.textContent = '.cbp-persona{display:flex;flex-wrap:wrap;align-items:flex-end;gap:8px 12px}' +
    '.cbp-persona .govuk-label{margin:0 0 4px}.cbp-persona .govuk-select{min-width:260px}.cbp-persona .govuk-button{margin:0}' +
    '.cbp-steps{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:4px}.cbp-steps li{font-size:.8rem;padding:2px 6px;background:#f3f2f1;color:#505a5f;border:1px solid #b1b4b6}' +
    '.cbp-steps li.done{background:#cce2d8;color:#005a30;border-color:#00703c}.cbp-steps li.current{background:#1d70b8;color:#fff;border-color:#1d70b8;font-weight:700}' +
    '.cbp-diff td{border-left:0;box-shadow:inset 4px 0 0 #f47738}.cbp-skill{border-top:1px solid #b1b4b6;padding-top:12px;margin-top:12px}.cbp-pre{background:none;border:1px solid #b1b4b6;padding:10px;overflow:auto;font-size:.8rem}' +
    '.cbp-small td,.cbp-small th{font-size:.9rem}';
  document.head.appendChild(style);

  /* ---------- Permissions and data access ---------- */
  var NAV = {
    staff: ['home', 'my'], assessor: ['home', 'assessor'], moderator: ['home', 'moderation'], cbpadmin: ['home', 'cycles', 'moderation', 'audit'],
    platform: ['home', 'audit'], manager: ['home'], hop: ['home'], ld: ['home']
  };
  function me() { return PEO.me(); }
  function can(p, roles) { return roles.indexOf(p.persona) > -1; }
  function logAccess(p, action, entity) {
    var a = S().audit[0];
    if (a && a.actor === p.name && a.action === action && a.entity === entity && now() - Date.parse(a.at) < 60000) return;
    PEO.audit(p.name, action, entity, 'Access logged'); PEO.save();
  }
  var D = {
    myAttempt: function (p, id) { var a = attempt(id); return a && p.persona === 'staff' && a.personId === p.id ? a : null; },
    myAttempts: function (p) { return p.persona === 'staff' ? S().attempts.filter(function (a) { return a.personId === p.id; }) : []; },
    myReviews: function (p) { return p.persona === 'assessor' ? S().reviews.filter(function (r) { return r.assessorId === p.id; }) : []; },
    reviewFor: function (p, id) { var r = PEO.byId(S().reviews, id); return r && p.persona === 'assessor' && r.assessorId === p.id ? r : null; },
    // Assessors only ever read the candidate's locked submission for attempts they are assigned to.
    evidenceFor: function (p, a) {
      if (!a) return null;
      if (p.persona === 'assessor' && S().reviews.some(function (r) { return r.attemptId === a.id && r.assessorId === p.id; })) return a.lockedResponses || null;
      if (p.persona === 'moderator' && PEO.attemptReviews(a.id).filter(function (r) { return r.submittedAt; }).length >= 2) return a.lockedResponses || null;
      return null;
    },
    // Only moderators see both submitted reviews, and only once two are submitted.
    moderationReviews: function (p, attemptId) {
      if (p.persona !== 'moderator') return null;
      var rs = PEO.attemptReviews(attemptId).filter(function (r) { return r.submittedAt; });
      return rs.length >= 2 ? rs.map(function (r) { return { id: r.id, assessorId: r.assessorId, scores: clone(r.immutable.scores), rationale: clone(r.immutable.rationale), feedback: r.immutable.feedback, flags: clone(r.flags || {}) }; }) : null;
    },
    // Candidate-facing view: final scores and approved feedback only. No rationale, internal note or assessor detail.
    outcomeFor: function (p, id) {
      var a = D.myAttempt(p, id);
      if (!a || a.status !== 'published' || !a.moderation || !a.moderation.published) return null;
      var scores = {}; Object.keys(a.moderation.finals).forEach(function (k) { scores[k] = Number(a.moderation.finals[k].score); });
      return { id: a.id, frameworkId: a.frameworkId, cycleId: a.cycleId, scores: scores, feedback: a.moderation.candidateFeedback, overall: PEO.overall(a), publishedAt: a.publishedAt };
    },
    moderatable: function (p, id) { var a = attempt(id); return a && p.persona === 'moderator' && a.status === 'moderation' ? a : null; },
    publishable: function (p, id) { var a = attempt(id); return a && can(p, ['moderator', 'cbpadmin']) && a.moderation && (a.status === 'outcome ready' || a.status === 'published') ? a : null; },
    moderationList: function (p) { return can(p, ['moderator', 'cbpadmin']) ? S().attempts.filter(function (a) { return ['moderation', 'outcome ready', 'published'].indexOf(a.status) > -1; }) : []; },
    admin: function (p) { return p.persona === 'cbpadmin'; },
    auditView: function (p) { return can(p, ['cbpadmin', 'platform']) ? S().audit : null; }
  };

  function denied(why) {
    return UI.pageHead('You do not have access') + '<p class="govuk-body">' + h(why || 'Your current persona is not permitted to view this page.') + '</p><p class="govuk-body">Use the persona switcher above to change role, or ' + link('#/', 'go to the home page') + '.</p>';
  }

  /* ---------- Page wrapper ---------- */
  function syncNav(p) {
    var ul = document.getElementById('navigation'); if (!ul) return;
    var ids = NAV[p.persona] || ['home'];
    ul.innerHTML = window.PROTO.nav.filter(function (n) { return ids.indexOf(n.id) > -1; }).map(function (n) {
      return '<li class="govuk-service-navigation__item" data-nav="' + h(n.id) + '"><a class="govuk-service-navigation__link" href="' + h(n.href) + '">' + h(n.label) + '</a></li>';
    }).join('');
  }
  function personaBar(p) {
    return '<div class="cbp-persona"><div><label class="govuk-label govuk-label--s" for="persona">Viewing as (simulated persona)</label><select class="govuk-select" id="persona" name="persona">' +
      PEO.personas().map(function (x) { return '<option value="' + h(x.id) + '"' + (x.id === p.id ? ' selected' : '') + '>' + h(x.name + ' \u2013 ' + (PEO.ROLES[x.persona] || x.persona)) + '</option>'; }).join('') + '</select></div>' +
      '<button type="button" class="govuk-button govuk-button--secondary" data-module="govuk-button" data-act="switch">Switch persona</button>' +
      '<strong class="govuk-tag govuk-tag--grey">Simulated</strong></div>';
  }
  var routeFn = function (nav, fn) {
    return function (params) {
      var p = me(); syncNav(p);
      if (formState && formState.hash !== location.hash) formState = null;
      var n = notice ? '<div class="govuk-notification-banner govuk-notification-banner--' + (notice.kind === 'error' ? '' : 'success') + '" role="alert"><div class="govuk-notification-banner__content"><p class="govuk-notification-banner__heading">' + notice.html + '</p></div></div>' : '';
      notice = null;
      var body; try { body = fn(params, p); } catch (e) { body = '<h1 class="govuk-heading-l">Something went wrong</h1><p class="govuk-body">' + h(e.message) + '</p>'; if (window.console) console.error(e); }
      return { html: personaBar(p) + n + '<div id="cbp-body">' + body + '</div>', title: null };
    };
  };
  function R(pattern, nav, fn) { UI.route(pattern, routeFn(nav, fn), nav); }

  /* ---------- Shared renderers ---------- */
  function steps(status) {
    var cur = PEO.ATTEMPT_STATUS.indexOf(status);
    return '<ol class="cbp-steps" aria-label="Assessment status">' + PEO.ATTEMPT_STATUS.map(function (s, i) {
      return '<li class="' + (i < cur ? 'done' : i === cur ? 'current' : '') + '"' + (i === cur ? ' aria-current="step"' : '') + '>' + h(s[0].toUpperCase() + s.slice(1)) + '</li>';
    }).join('') + '</ol>';
  }
  function descTable(fwId, skillId) {
    var sk = PEO.skill(fwId, skillId);
    return '<table class="govuk-table cbp-small"><caption class="govuk-table__caption govuk-table__caption--s">Scoring descriptors from framework ' + h(fwLabel(fwId)) + '</caption><thead class="govuk-table__head"><tr class="govuk-table__row"><th class="govuk-table__header" scope="col">Score</th><th class="govuk-table__header" scope="col">Descriptor</th></tr></thead><tbody class="govuk-table__body">' +
      [0, 1, 2, 3].map(function (l) { return '<tr class="govuk-table__row"><td class="govuk-table__cell">' + scoreText(l) + '</td><td class="govuk-table__cell">' + h(sk.descriptors[l]) + '</td></tr>'; }).join('') + '</tbody></table>';
  }
  function errs(list) { return UI.errorSummary(list); }
  function fe(list, id) { var e = (list || []).filter(function (x) { return x.id === id; })[0]; return e ? e.msg : null; }
  function back(href, text) { return '<p class="govuk-body-s"><a class="govuk-link" href="' + href + '">' + h(text) + '</a></p>'; }
  function taskTable(rows) {
    return rows.length ? scroll(UI.table(['Task', 'Detail', 'Due', 'Action'], rows)) : '<p class="govuk-body">You have no tasks.</p>';
  }
  function reviewState(r) { return r.submittedAt ? UI.tag('Submitted', 'green') : (Object.keys(r.scores || {}).length || r.feedback) ? UI.tag('Draft saved', 'blue') : UI.tag('Not started', 'grey'); }

  /* ---------- Home ---------- */
  function home(_, p) {
    var rows = [], x;
    if (p.persona === 'staff') {
      D.myAttempts(p).forEach(function (a) {
        if (a.status === 'draft') rows.push(['Complete your CBP evidence', h(a.id + ' in ' + a.cycleId), '\u2013', link('#/attempt/' + a.id, 'Continue draft')]);
        else if (a.status === 'published') rows.push(['View your published outcome', h(a.id), UI.fmtDate(a.publishedAt), link('#/outcome/' + a.id, 'View outcome')]);
        else rows.push(['Track your submission', h(a.id + ': ' + a.status), '\u2013', link('#/attempt/' + a.id, 'View status')]);
      });
      openCycles(p).forEach(function (c) { rows.push(['Start an application', h(c.name), UI.fmtDate(c.closes), link('#/my-cbp', 'See cycles')]); });
    } else if (p.persona === 'assessor') {
      D.myReviews(p).filter(function (r) { return !r.submittedAt; }).forEach(function (r) {
        rows.push(['Review a candidate submission', h(r.attemptId + ' ' + nameOf(attempt(r.attemptId).personId)) + (isOverdue(r) ? ' ' + UI.tag('Overdue', 'red') : ''), UI.fmtDate(r.due), link('#/review/' + r.id, 'Open review')]);
      });
    } else if (p.persona === 'moderator' || p.persona === 'cbpadmin') {
      D.moderationList(p).forEach(function (a) {
        if (a.status === 'moderation' && p.persona === 'moderator') rows.push(['Moderate scores', h(a.id + ' ' + nameOf(a.personId)), '\u2013', link('#/moderate/' + a.id, 'Moderate')]);
        if (a.status === 'outcome ready') rows.push(['Approve publication', h(a.id + ' ' + nameOf(a.personId)), '\u2013', link('#/publish/' + a.id, 'Review and publish')]);
      });
      if (p.persona === 'cbpadmin') {
        S().reviews.filter(isOverdue).forEach(function (r) { rows.push(['Chase overdue review', h(r.id + ' for ' + r.attemptId + ', ' + nameOf(r.assessorId)) + ' ' + UI.tag('Overdue', 'red'), UI.fmtDate(r.due), link('#/admin/cycle/' + attempt(r.attemptId).cycleId, 'Open cycle')]); });
        S().attempts.filter(function (a) { return a.status === 'submitted' && PEO.attemptReviews(a.id).length < 2; }).forEach(function (a) { rows.push(['Allocate assessors', h(a.id + ' ' + nameOf(a.personId)), '\u2013', link('#/admin/cycle/' + a.cycleId, 'Allocate')]); });
      }
    }
    var intro = {
      staff: 'Complete your evidence, track your assessment and see your published outcome.',
      assessor: 'Review only the submissions assigned to you. You will not see another assessor\u2019s scores.',
      moderator: 'Compare independent assessments, agree final scores and approve publication.',
      cbpadmin: 'Run assessment cycles, allocate assessors, monitor overdue work and approve publication.',
      platform: 'You can view the audit log. Candidate evidence and scores are not available to this role.'
    }[p.persona] || 'This role has no CBP assessment tasks. Candidate evidence and deliberations are not available to this role.';
    var extra = '';
    if (!(NAV[p.persona] && NAV[p.persona].length > 1)) extra = '<p class="govuk-body">Related prototypes: ' + link('../learning/#/', 'Learning and development') + '.</p>';
    return UI.pageHead('CBP assessment', 'Simulated. ' + h(intro)) + '<h2 class="govuk-heading-m">Your tasks</h2>' + taskTable(rows) + extra +
      '<div class="govuk-inset-text">Scoring uses final scores 0, 1, 2 or 3 only. Overall outcome bands are illustrative until an approved policy is supplied. This prototype contains no pay policy.</div>';
  }

  /* ---------- Candidate ---------- */
  function eligible(p, c) {
    if (c.status !== 'open for applications' || Date.parse(c.closes) < now()) return false;
    if (c.roleProfileIds.indexOf(p.role) < 0) return false;
    if (/previously published/i.test(c.eligibility)) return false;
    return !S().attempts.some(function (a) { return a.personId === p.id && a.cycleId === c.id; });
  }
  function openCycles(p) { return S().cycles.filter(function (c) { return eligible(p, c); }); }
  function myCbp(_, p) {
    if (p.persona !== 'staff') return denied('My CBP is for candidates (staff members).');
    var cyc = scroll(UI.table(['Cycle', 'Framework version', 'Opens', 'Closes', 'Status', 'Eligibility', 'Action'], S().cycles.map(function (c) {
      var mine = S().attempts.filter(function (a) { return a.personId === p.id && a.cycleId === c.id; })[0];
      return [h(c.id + ' ' + c.name), h(fwLabel(c.frameworkId)), UI.fmtDate(c.opens), UI.fmtDate(c.closes), UI.tag(c.status, 'blue'), h(c.eligibility),
        mine ? link('#/attempt/' + mine.id, 'View my attempt') : eligible(p, c) ? '<button type="button" class="govuk-button govuk-button--secondary" data-module="govuk-button" data-act="start" data-cycle="' + h(c.id) + '">Start application</button>' : '<span class="govuk-hint">Not available to you</span>'];
    })));
    var atts = D.myAttempts(p), tbl = atts.length ? scroll(UI.table(['Attempt', 'Cycle', 'Framework', 'Status', 'Receipt', 'Action'], atts.map(function (a) {
      return [h(a.id) + (a.previousAttemptId ? '<br><span class="govuk-hint">Re-submission of ' + h(a.previousAttemptId) + '</span>' : ''), h(a.cycleId), h(fwLabel(a.frameworkId)), steps(a.status), h(a.receipt || '\u2013'),
        a.status === 'published' ? link('#/outcome/' + a.id, 'View outcome') : link('#/attempt/' + a.id, a.status === 'draft' ? 'Continue draft' : 'View')];
    }))) : '<p class="govuk-body">You have no attempts yet.</p>';
    return UI.pageHead('My CBP', 'Assessment cycles and your attempts. Simulated.') + '<h2 class="govuk-heading-m">Assessment cycles</h2>' + cyc + '<h2 class="govuk-heading-m">My attempts</h2>' + tbl;
  }
  function startAttempt(p, cyc, prevId) {
    var c = cycle(cyc), fw = PEO.framework(c.frameworkId), a = { id: nextId('ATT', S().attempts), personId: p.id, cycleId: c.id, frameworkId: c.frameworkId, status: 'draft', responses: {}, submissionVersion: 0, submittedAt: null, receipt: '', moderation: null, previousAttemptId: prevId || null, created: new Date().toISOString() };
    fw.skills.forEach(function (s) { a.responses[s.id] = { example: '', link: '', words: 0 }; });
    S().attempts.push(a); PEO.audit(p.name, 'Started CBP attempt', a.id, prevId ? 'Re-submission of ' + prevId : c.id); PEO.save(); return a;
  }
  function attemptPage(params, p) {
    var a = D.myAttempt(p, params.id); if (!a) return denied('This attempt belongs to another person or your persona cannot view it.');
    var fw = PEO.framework(a.frameworkId), cur = PEO.currentFramework(), rp = PEO.roleProfile(p.role), fs = formState && formState.kind === 'attempt' ? formState : null;
    var head = UI.pageHead('CBP evidence: ' + a.id, h(cycle(a.cycleId).name)) + steps(a.status) +
      '<p class="govuk-body govuk-!-margin-top-3">Criteria locked to framework ' + h(fwLabel(a.frameworkId)) + '.' + (cur.id !== a.frameworkId ? ' The current published framework is ' + h(fwLabel(cur.id)) + '; changes to it do not alter the criteria for this attempt.' : '') + '</p>' +
      (a.previousAttemptId ? '<p class="govuk-body">This is a re-submission linked to ' + link('#/outcome/' + a.previousAttemptId, a.previousAttemptId) + '.</p>' : '');
    if (a.status !== 'draft') {
      var L = a.lockedResponses || a.responses;
      return head + '<div class="govuk-panel govuk-panel--confirmation" style="padding:15px"><h2 class="govuk-panel__title" style="font-size:1.5rem">Submitted</h2><div class="govuk-panel__body" style="font-size:1.2rem">Receipt <strong>' + h(a.receipt) + '</strong><br>Version ' + a.submissionVersion + ', ' + UI.fmtTime(a.submittedAt) + '</div></div>' +
        '<p class="govuk-body">This version is locked and read-only. ' + (a.status === 'published' ? link('#/outcome/' + a.id, 'View your published outcome') : 'Your outcome will appear here once it has been moderated and published.') + '</p>' +
        '<h2 class="govuk-heading-m">Submitted evidence</h2>' + scroll(UI.table(['Skill', 'Example', 'Link'], fw.skills.map(function (s) { var r = L[s.id] || {}; return [h(s.name), para(r.example || ''), r.link ? h(r.link) : '\u2013']; })));
    }
    var body = fw.skills.map(function (s) {
      var r = a.responses[s.id] || { example: '', link: '' }, exp = rp && rp.expected[s.id];
      return '<div class="cbp-skill"><h2 class="govuk-heading-m">' + h(s.name) + '</h2><p class="govuk-body">' + h(s.definition) + (exp != null ? ' Expected for your role: level ' + exp + '.' : '') + '</p>' +
        '<details class="govuk-details"><summary class="govuk-details__summary"><span class="govuk-details__summary-text">Scoring descriptors for ' + h(s.name) + '</span></summary><div class="govuk-details__text">' + descTable(a.frameworkId, s.id) + '</div></details>' +
        UI.field('ex-' + s.id, 'Example of your evidence for ' + s.name, '<textarea class="govuk-textarea' + (fe(fs && fs.errs, 'ex-' + s.id) ? ' govuk-textarea--error' : '') + '" id="ex-' + s.id + '" name="ex-' + s.id + '" rows="6" data-skill="' + s.id + '">' + h(r.example) + '</textarea><div class="govuk-hint" id="cc-' + s.id + '" aria-live="polite">' + (r.example || '').length + ' of ' + LIMIT + ' characters</div>',
          { hint: 'Describe the situation, what you did and the result. For example, a service you improved. Maximum ' + LIMIT + ' characters.', err: fe(fs && fs.errs, 'ex-' + s.id) }) +
        UI.input('link-' + s.id, 'Supporting link (optional)', r.link || '', { hint: 'A link to a document you are allowed to share, for example https://intranet.example.gov.uk/my-work', err: fe(fs && fs.errs, 'link-' + s.id) }) + '</div>';
    }).join('');
    return head + (fs ? errs(fs.errs) : '') + '<div class="govuk-warning-text"><span class="govuk-warning-text__icon" aria-hidden="true">!</span><strong class="govuk-warning-text__text"><span class="govuk-visually-hidden">Warning</span>Do not include names, personal data or sensitive information about service users or colleagues. Assessors and moderators will read your evidence.</strong></div>' +
      '<form id="attempt-form" data-attempt="' + h(a.id) + '" novalidate>' + body + '<p class="govuk-hint" id="saved" role="status">Draft autosaves as you type.</p>' +
      '<div class="govuk-button-group"><button type="button" class="govuk-button" data-module="govuk-button" data-act="submit-attempt">Submit evidence</button></div></form>' +
      '<p class="govuk-body"><strong>Once submitted, this version is locked.</strong></p>';
  }
  function readDraft(form, a) {
    PEO.framework(a.frameworkId).skills.forEach(function (s) {
      var ex = form.querySelector('[name="ex-' + s.id + '"]'), lk = form.querySelector('[name="link-' + s.id + '"]');
      a.responses[s.id] = { example: ex ? ex.value : '', link: lk ? lk.value.trim() : '', words: ex ? words(ex.value) : 0 };
    });
  }
  function validateAttempt(a) {
    var list = [];
    PEO.framework(a.frameworkId).skills.forEach(function (s) {
      var r = a.responses[s.id];
      if (!r.example.trim()) list.push({ id: 'ex-' + s.id, msg: 'Enter an example for ' + s.name });
      else if (r.example.length > LIMIT) list.push({ id: 'ex-' + s.id, msg: 'Example for ' + s.name + ' must be ' + LIMIT + ' characters or fewer' });
      if (r.link && !/^https?:\/\/\S+$/i.test(r.link)) list.push({ id: 'link-' + s.id, msg: 'Link for ' + s.name + ' must start with http:// or https://' });
    });
    return list;
  }

  function outcomePage(params, p) {
    var o = D.outcomeFor(p, params.id);
    if (!o) { var a = D.myAttempt(p, params.id); return denied(a ? 'Your outcome has not been published yet.' : 'This outcome belongs to another person or your persona cannot view it.'); }
    var fw = PEO.framework(o.frameworkId), fs = formState && formState.kind === 'goal' ? formState : null, a2 = attempt(o.id);
    var lowest = fw.skills.slice().sort(function (x, y) { return o.scores[x.id] - o.scores[y.id]; })[0];
    var tbl = scroll(UI.table(['Skill', 'Final score', 'What this score means (' + h(o.frameworkId) + ')'], fw.skills.map(function (s) { return [h(s.name), '<strong>' + scoreText(o.scores[s.id]) + '</strong>', h(s.descriptors[o.scores[s.id]])]; })));
    var existing = S().attempts.filter(function (x) { return x.previousAttemptId === o.id; })[0], c2 = S().cycles.filter(function (c) { return c.status === 'open for applications' && c.frameworkId !== o.frameworkId && c.roleProfileIds.indexOf(p.role) > -1 && /previously published/i.test(c.eligibility); })[0];
    var resub = existing ? '<p class="govuk-body">You have a re-submission: ' + link('#/attempt/' + existing.id, existing.id + ' (' + existing.status + ')') + '.</p>' : c2 ? '<button type="button" class="govuk-button govuk-button--secondary" data-module="govuk-button" data-act="resubmit" data-attempt="' + h(o.id) + '" data-cycle="' + h(c2.id) + '">Start re-submission</button><p class="govuk-hint">Creates a new draft attempt in ' + h(c2.name) + ', linked to this outcome. This outcome stays unchanged.</p>' : '<p class="govuk-hint">No re-submission window is currently open to you.</p>';
    var goalForm = '<form id="goal-form" novalidate>' + errs(fs && fs.errs) +
      UI.select('g-skill', 'Skill', fw.skills.map(function (s) { return { value: s.id, label: s.name }; }), fs ? fs.vals.skill : lowest.id) +
      UI.select('g-level', 'Target level', [1, 2, 3].map(function (n) { return { value: n, label: scoreText(n) }; }), fs ? fs.vals.level : Math.min(3, o.scores[lowest.id] + 1)) +
      UI.input('g-date', 'Target date', fs ? fs.vals.date : '', { type: 'date', err: fe(fs && fs.errs, 'g-date') }) +
      UI.textarea('g-note', 'Note (optional)', fs ? fs.vals.note : 'Based on my published CBP feedback.', { rows: 2 }) +
      '<button type="button" class="govuk-button" data-module="govuk-button" data-act="create-goal" data-attempt="' + h(o.id) + '">Create development goal from feedback</button></form>';
    return UI.pageHead('Your CBP outcome', h(cycle(o.cycleId).name) + ', published ' + UI.fmtDate(o.publishedAt)) + back('#/my-cbp', 'Back to My CBP') +
      '<h2 class="govuk-heading-m">Final scores</h2>' + tbl +
      '<p class="govuk-body">Overall outcome: <strong>' + h(o.overall ? o.overall.band : 'Not banded') + '</strong> (total ' + (o.overall ? o.overall.total + ' of ' + o.overall.max : '\u2013') + '). ' + UI.tag('Illustrative', 'grey') + ' Bands are configurable and not an approved pay policy.</p>' +
      '<h2 class="govuk-heading-m">Feedback</h2><div class="govuk-inset-text">' + para(o.feedback) + '</div>' +
      '<h2 class="govuk-heading-m">Next steps</h2><h3 class="govuk-heading-s">Turn feedback into a development goal</h3>' + goalForm + '<p class="govuk-body">' + link('../learning/#/goals', 'See your development goals in Learning and development') + '</p>' +
      '<h3 class="govuk-heading-s">Re-submission</h3>' + resub;
  }

  /* ---------- Assessor ---------- */
  function assessorQueue(_, p) {
    if (p.persona !== 'assessor') return denied('The review queue is only for assessors.');
    var rs = D.myReviews(p);
    return UI.pageHead('My reviews', 'Submissions assigned to you. You only see your own reviews.') +
      (rs.length ? scroll(UI.table(['Review', 'Candidate submission', 'Cycle', 'Skills', 'Due', 'Status', 'Action'], rs.map(function (r) {
        var a = attempt(r.attemptId);
        return [h(r.id), h(a.id + ' ' + nameOf(a.personId)), h(a.cycleId), PEO.framework(a.frameworkId).skills.length, UI.fmtDate(r.due) + (isOverdue(r) ? ' ' + UI.tag('Overdue', 'red') : ''), reviewState(r), link('#/review/' + r.id, r.submittedAt ? 'View submitted review' : 'Open review')];
      }))) : '<p class="govuk-body">No reviews are assigned to you.</p>');
  }
  function reviewPage(params, p) {
    var r = D.reviewFor(p, params.id); if (!r) return denied('This review is not assigned to you.');
    var a = attempt(r.attemptId), ev = D.evidenceFor(p, a), fw = PEO.framework(a.frameworkId), fs = formState && formState.kind === 'review' ? formState : null;
    if (!ev) return denied('The candidate evidence is not available.');
    logAccess(p, 'Viewed candidate evidence', a.id);
    var done = !!r.submittedAt, src = done ? r.immutable : r, flags = r.flags || {};
    var intro = UI.pageHead('Review ' + r.id, 'Candidate submission ' + h(a.id) + ' (' + h(nameOf(a.personId)) + '), due ' + UI.fmtDate(r.due)) + back('#/assessor', 'Back to my reviews') +
      '<p class="govuk-body">Scoring against framework ' + h(fwLabel(a.frameworkId)) + '. Final scores are 0\u20133 only. ' + (done ? UI.tag('Submitted', 'green') + ' This review is immutable. Submitted ' + UI.fmtTime(r.submittedAt) + '.' : 'You cannot see any other assessor\u2019s scores.') + '</p>';
    var blocks = fw.skills.map(function (s) {
      var e = ev[s.id] || {}, sc = src.scores[s.id], head = '<div class="cbp-skill"><h2 class="govuk-heading-m">' + h(s.name) + '</h2><p class="govuk-body">' + h(s.definition) + '</p>' +
        '<h3 class="govuk-heading-s">Candidate evidence</h3><div class="govuk-inset-text">' + para(e.example || 'No example provided.') + (e.link ? '<br>Link: ' + h(e.link) : '') + '</div>' +
        '<details class="govuk-details"><summary class="govuk-details__summary"><span class="govuk-details__summary-text">Scoring descriptors</span></summary><div class="govuk-details__text">' + descTable(a.frameworkId, s.id) + '</div></details>';
      if (done) return head + '<p class="govuk-body"><strong>Score:</strong> ' + (sc == null ? '\u2013' : scoreText(sc)) + (flags[s.id] ? ' ' + UI.tag('Insufficient evidence', 'orange') : '') + '</p><p class="govuk-body"><strong>Rationale:</strong> ' + para(src.rationale[s.id] || '') + '</p></div>';
      return head + UI.radios('score-' + s.id, 'Score for ' + s.name, [0, 1, 2, 3].map(function (n) { return { value: n, label: scoreText(n) }; }), sc, { err: fe(fs && fs.errs, 'score-' + s.id + '-0') }) +
        UI.textarea('rat-' + s.id, 'Rationale for your score', src.rationale[s.id] || '', { rows: 3, err: fe(fs && fs.errs, 'rat-' + s.id), hint: 'Required. Refer to the candidate\u2019s evidence and the descriptors.' }) +
        '<div class="govuk-form-group"><div class="govuk-checkboxes govuk-checkboxes--small"><div class="govuk-checkboxes__item"><input class="govuk-checkboxes__input" type="checkbox" id="flag-' + s.id + '" name="flag-' + s.id + '" value="y"' + (flags[s.id] ? ' checked' : '') + '><label class="govuk-label govuk-checkboxes__label" for="flag-' + s.id + '">Evidence is insufficient or ambiguous</label></div></div></div></div>';
    }).join('');
    var fb = done ? '<h2 class="govuk-heading-m">Development feedback</h2><p class="govuk-body">' + para(src.feedback || '') + '</p>' : UI.textarea('rev-feedback', 'Development feedback for the candidate (draft for moderation)', src.feedback || '', { rows: 4, err: fe(fs && fs.errs, 'rev-feedback') });
    if (done) return intro + blocks + fb;
    return intro + errs(fs && fs.errs) + '<form id="review-form" data-review="' + h(r.id) + '" novalidate>' + blocks + fb + '<p class="govuk-hint" id="saved" role="status">Changes are saved to your draft as you go.</p>' +
      '<div class="govuk-button-group"><button type="button" class="govuk-button govuk-button--secondary" data-module="govuk-button" data-act="save-review">Save draft</button><button type="button" class="govuk-button" data-module="govuk-button" data-act="submit-review">Submit review</button></div></form>' +
      '<p class="govuk-body"><strong>Once submitted, your scores and notes cannot be changed.</strong></p>';
  }
  function readReview(form, r, fw) {
    r.scores = r.scores || {}; r.rationale = r.rationale || {}; r.flags = {};
    fw.skills.forEach(function (s) {
      var c = form.querySelector('[name="score-' + s.id + '"]:checked'); if (c) r.scores[s.id] = Number(c.value); else delete r.scores[s.id];
      var t = form.querySelector('[name="rat-' + s.id + '"]'); r.rationale[s.id] = t ? t.value : '';
      var f = form.querySelector('[name="flag-' + s.id + '"]'); if (f && f.checked) r.flags[s.id] = true;
    });
    var fb = form.querySelector('[name="rev-feedback"]'); r.feedback = fb ? fb.value : '';
    r.flag = Object.keys(r.flags).length ? true : null;
  }

  /* ---------- Moderation and publication ---------- */
  function moderationList(_, p) {
    if (!can(p, ['moderator', 'cbpadmin'])) return denied('Moderation is for moderators and CBP administrators.');
    var list = D.moderationList(p);
    var act = function (a) {
      if (a.status === 'moderation') return p.persona === 'moderator' ? link('#/moderate/' + a.id, 'Moderate') : '<span class="govuk-hint">Awaiting moderator</span>';
      return link('#/publish/' + a.id, a.status === 'outcome ready' ? 'Approve publication' : 'View');
    };
    return UI.pageHead('Moderation and publication', 'Cases with two submitted reviews, and outcomes awaiting or completed publication.') +
      (list.length ? scroll(UI.table(['Attempt', 'Candidate', 'Cycle', 'Status', 'Reviews submitted', 'Action'], list.map(function (a) {
        return [h(a.id), h(nameOf(a.personId)), h(a.cycleId), steps(a.status), PEO.attemptReviews(a.id).filter(function (r) { return r.submittedAt; }).length + ' of 2', act(a)];
      }))) : '<p class="govuk-body">No cases.</p>');
  }
  function validFinal(v) { return SCORES.indexOf(String(v)) > -1; }
  function moderatePage(params, p) {
    var a = attempt(params.attemptId);
    if (p.persona !== 'moderator') return denied('Only moderators can compare assessor scores and agree final scores.');
    var rv = a && D.moderationReviews(p, a.id);
    if (!a || !rv) return denied('This case is not ready for moderation: two submitted reviews are needed.');
    if (a.status !== 'moderation') return UI.pageHead('Moderation: ' + a.id) + back('#/moderation', 'Back to moderation') + '<p class="govuk-body">Final scores have been recorded. ' + link('#/publish/' + a.id, 'Go to publication') + '</p>';
    logAccess(p, 'Viewed moderation evidence', a.id);
    var fw = PEO.framework(a.frameworkId), ev = D.evidenceFor(p, a), dr = X().modDrafts[a.id] || { finals: {}, note: '' }, fs = formState && formState.kind === 'mod' ? formState : null;
    var rows = fw.skills.map(function (s) {
      var s1 = rv[0].scores[s.id], s2 = rv[1].scores[s.id], diff = Math.abs(s1 - s2), fin = dr.finals[s.id] || {}, e = (ev && ev[s.id]) || {};
      var cellOf = function (r) { return scoreText(r.scores[s.id]) + (r.flags[s.id] ? '<br>' + UI.tag('Insufficient evidence', 'orange') : '') + '<br><span class="govuk-hint">' + h(r.rationale[s.id] || '') + '</span>'; };
      return '<tr class="govuk-table__row' + (diff ? ' cbp-diff' : '') + '"><td class="govuk-table__cell"><strong>' + h(s.name) + '</strong><br><span class="govuk-hint">' + h(e.example ? e.example.slice(0, 120) : '') + '</span></td><td class="govuk-table__cell">' + cellOf(rv[0]) + '</td><td class="govuk-table__cell">' + cellOf(rv[1]) + '</td><td class="govuk-table__cell">' + (diff ? UI.tag('Differs by ' + diff, 'orange') : UI.tag('Agree', 'green')) + '</td>' +
        '<td class="govuk-table__cell">' + UI.radios('final-' + s.id, 'Final score for ' + s.name, [0, 1, 2, 3].map(function (n) { return { value: n, label: scoreText(n) }; }), fin.score, { err: fe(fs && fs.errs, 'final-' + s.id + '-0') }) + UI.textarea('frat-' + s.id, 'Final rationale', fin.rationale || '', { rows: 2, err: fe(fs && fs.errs, 'frat-' + s.id) }) + '</td></tr>';
    }).join('');
    return UI.pageHead('Moderate ' + a.id, h(nameOf(a.personId)) + ', framework ' + h(fwLabel(a.frameworkId))) + back('#/moderation', 'Back to moderation') + errs(fs && fs.errs) +
      '<p class="govuk-body">Assessor 1: ' + h(nameOf(rv[0].assessorId)) + '. Assessor 2: ' + h(nameOf(rv[1].assessorId)) + '. Differences are highlighted; no final score is chosen for you. Allowed final scores: 0, 1, 2, 3 only.</p>' +
      '<form id="mod-form" data-attempt="' + h(a.id) + '" novalidate>' + scroll('<table class="govuk-table cbp-small"><thead class="govuk-table__head"><tr class="govuk-table__row"><th class="govuk-table__header" scope="col">Skill</th><th class="govuk-table__header" scope="col">Assessor 1</th><th class="govuk-table__header" scope="col">Assessor 2</th><th class="govuk-table__header" scope="col">Difference</th><th class="govuk-table__header" scope="col">Agreed final</th></tr></thead><tbody class="govuk-table__body">' + rows + '</tbody></table>') +
      UI.textarea('mod-note', 'Internal moderation note (never shown to the candidate)', dr.note || '', { rows: 3, hint: 'Kept separate from candidate feedback.' }) +
      '<p class="govuk-hint" id="saved" role="status"></p><div class="govuk-button-group"><button type="button" class="govuk-button govuk-button--secondary" data-module="govuk-button" data-act="save-mod-draft">Save draft</button><button type="button" class="govuk-button" data-module="govuk-button" data-act="save-mod">Save moderated scores</button></div></form>';
  }
  function readMod(form, a) {
    var finals = {};
    PEO.framework(a.frameworkId).skills.forEach(function (s) {
      var c = form.querySelector('[name="final-' + s.id + '"]:checked'), t = form.querySelector('[name="frat-' + s.id + '"]');
      finals[s.id] = { score: c ? c.value : '', rationale: t ? t.value : '' };
    });
    return { finals: finals, note: form.querySelector('[name="mod-note"]').value };
  }
  function publishPage(params, p) {
    var a = D.publishable(p, params.id); if (!a) return denied('Only moderators and CBP administrators can approve publication of a moderated outcome.');
    var fw = PEO.framework(a.frameworkId), fs = formState && formState.kind === 'pub' ? formState : null, ov = PEO.overall(a), pub = a.status === 'published';
    var tbl = scroll(UI.table(['Skill', 'Final score', 'Moderation rationale (internal)'], fw.skills.map(function (s) { var f = a.moderation.finals[s.id]; return [h(s.name), scoreText(Number(f.score)), h(f.rationale)]; })));
    return UI.pageHead('Publish outcome: ' + a.id, h(nameOf(a.personId))) + back('#/moderation', 'Back to moderation') + errs(fs && fs.errs) +
      '<h2 class="govuk-heading-m">Agreed final scores</h2>' + tbl + '<p class="govuk-body">Overall: <strong>' + h(ov ? ov.band : '') + '</strong> ' + UI.tag('Illustrative', 'grey') + '</p>' +
      '<h2 class="govuk-heading-m">Internal moderation note</h2><div class="govuk-inset-text">' + para(a.moderation.internalNote || 'None.') + '<br><span class="govuk-hint">Never shown to the candidate.</span></div>' +
      (pub ? '<h2 class="govuk-heading-m">Published candidate feedback</h2><div class="govuk-inset-text">' + para(a.moderation.candidateFeedback) + '</div><p class="govuk-body">Published ' + UI.fmtTime(a.publishedAt) + '.</p>' :
        '<form id="pub-form" data-attempt="' + h(a.id) + '" novalidate>' + UI.textarea('pub-feedback', 'Candidate feedback', fs ? fs.vals.feedback : (a.moderation.candidateFeedback || ''), { rows: 6, hint: 'Constructive and evidence-based. Do not copy internal notes or assessor rationale. This is the only text the candidate will see.', err: fe(fs && fs.errs, 'pub-feedback') }) +
        '<button type="button" class="govuk-button" data-module="govuk-button" data-act="publish" data-attempt="' + h(a.id) + '">Approve and publish outcome</button></form>');
  }

  /* ---------- Admin ---------- */
  function cyclesPage(_, p) {
    if (!D.admin(p)) return denied('Assessment cycles are managed by CBP administrators.');
    var fs = formState && formState.kind === 'cycle' ? formState : null, v = fs ? fs.vals : { name: '', fw: PEO.currentFramework().id, rp: [], opens: '', closes: '', capacity: '', eligibility: '' };
    var list = scroll(UI.table(['Cycle', 'Framework', 'Opens', 'Closes', 'Status', 'Capacity', 'Attempts'], S().cycles.map(function (c) {
      return [link('#/admin/cycle/' + c.id, c.id + ' ' + c.name), h(fwLabel(c.frameworkId)), UI.fmtDate(c.opens), UI.fmtDate(c.closes), UI.tag(c.status, 'blue'), c.capacity, S().attempts.filter(function (a) { return a.cycleId === c.id; }).length];
    })));
    var fws = S().frameworks.filter(function (f) { return f.status === 'published'; });
    var form = '<form id="cycle-form" novalidate>' + errs(fs && fs.errs) + UI.input('c-name', 'Cycle name', v.name, { err: fe(fs && fs.errs, 'c-name') }) +
      UI.select('c-fw', 'Framework version', fws.map(function (f) { return { value: f.id, label: f.id + ' (version ' + f.version + ', published)' }; }), v.fw, { hint: 'Only published versions can be used. Draft versions are not available.' }) +
      '<div class="govuk-form-group' + (fe(fs && fs.errs, 'c-rp-0') ? ' govuk-form-group--error' : '') + '"><fieldset class="govuk-fieldset"><legend class="govuk-fieldset__legend govuk-fieldset__legend--s">Role profiles</legend>' + (fe(fs && fs.errs, 'c-rp-0') ? '<p class="govuk-error-message">' + h(fe(fs.errs, 'c-rp-0')) + '</p>' : '') + '<div class="govuk-checkboxes govuk-checkboxes--small">' + S().roleProfiles.map(function (r, i) {
        return '<div class="govuk-checkboxes__item"><input class="govuk-checkboxes__input" id="c-rp-' + i + '" name="c-rp" type="checkbox" value="' + h(r.id) + '"' + (v.rp.indexOf(r.id) > -1 ? ' checked' : '') + '><label class="govuk-label govuk-checkboxes__label" for="c-rp-' + i + '">' + h(r.name + ' (' + r.grade + ')') + '</label></div>'; }).join('') + '</div></fieldset></div>' +
      UI.input('c-opens', 'Opens', v.opens, { type: 'date', err: fe(fs && fs.errs, 'c-opens') }) + UI.input('c-closes', 'Closes', v.closes, { type: 'date', err: fe(fs && fs.errs, 'c-closes') }) +
      UI.input('c-cap', 'Capacity (number of candidates)', v.capacity, { cls: 'govuk-input--width-5', err: fe(fs && fs.errs, 'c-cap') }) + UI.textarea('c-elig', 'Eligibility guidance', v.eligibility, { rows: 2, err: fe(fs && fs.errs, 'c-elig') }) +
      '<button type="button" class="govuk-button" data-module="govuk-button" data-act="create-cycle">Create cycle</button></form>';
    return UI.pageHead('Assessment cycles', 'Create and monitor cycles. Simulated.') + list + '<h2 class="govuk-heading-m">Create a cycle</h2>' + form;
  }
  function conflict(assessor, cand) {
    if (assessor.team === cand.team) return 'they are in the same team (' + cand.team + ')';
    if (cand.manager === assessor.id) return 'they are the candidate\u2019s line manager';
    if (assessor.manager === cand.id) return 'the candidate is their line manager';
    return null;
  }
  function allocate(attemptId, assessorId, due) {
    var a = attempt(attemptId), as = PEO.person(assessorId), c = PEO.person(a.personId), rs = PEO.attemptReviews(a.id), con = conflict(as, c);
    if (con) return { ok: false, msg: 'Conflict of interest: ' + as.name + ' cannot review ' + a.id + ' because ' + con + '. Allocation blocked.' };
    if (rs.some(function (r) { return r.assessorId === as.id; })) return { ok: false, msg: as.name + ' is already assigned to ' + a.id + '.' };
    if (rs.length >= 2) return { ok: false, msg: a.id + ' already has two assessors.' };
    S().reviews.push({ id: PEO.uid('REV'), attemptId: a.id, assessorId: as.id, scores: {}, rationale: {}, feedback: '', submittedAt: null, due: new Date(due + 'T17:00:00').toISOString(), flag: null });
    PEO.recomputeStatus(a); PEO.audit(me().name, 'Allocated assessor', a.id, as.name); PEO.save();
    return { ok: true, msg: as.name + ' allocated to ' + a.id + '.' };
  }
  function cyclePage(params, p) {
    if (!D.admin(p)) return denied('Assessment cycles are managed by CBP administrators.');
    var c = cycle(params.id); if (!c) return UI.pageHead('Cycle not found');
    var atts = S().attempts.filter(function (a) { return a.cycleId === c.id; }), fs = formState && formState.kind === 'alloc' ? formState : null;
    var table = atts.length ? scroll(UI.table(['Attempt', 'Candidate', 'Team', 'Status', 'Assessors', 'Receipt'], atts.map(function (a) {
      var rs = PEO.attemptReviews(a.id);
      return [h(a.id) + (a.previousAttemptId ? '<br><span class="govuk-hint">Re-submission of ' + h(a.previousAttemptId) + '</span>' : ''), h(nameOf(a.personId)), h(PEO.person(a.personId).team), steps(a.status),
        rs.length ? rs.map(function (r) { return h(nameOf(r.assessorId)) + ': ' + (r.submittedAt ? 'submitted' : isOverdue(r) ? '<strong class="govuk-tag govuk-tag--red">Overdue</strong> due ' + UI.fmtDate(r.due) : 'due ' + UI.fmtDate(r.due)); }).join('<br>') : 'None allocated', h(a.receipt || '\u2013')];
    }))) : '<p class="govuk-body">No attempts in this cycle.</p>';
    var overdue = S().reviews.filter(function (r) { return isOverdue(r) && attempt(r.attemptId).cycleId === c.id; });
    var needs = atts.filter(function (a) { return ['submitted', 'under review'].indexOf(a.status) > -1 && PEO.attemptReviews(a.id).length < 2; });
    var assessors = S().people.filter(function (x) { return x.persona === 'assessor'; });
    var dueDef = new Date(now() + 14 * PEO.DAY).toISOString().slice(0, 10);
    var alloc = needs.length ? '<form id="alloc-form" novalidate>' + (fs ? '<div class="govuk-warning-text"><span class="govuk-warning-text__icon" aria-hidden="true">!</span><strong class="govuk-warning-text__text"><span class="govuk-visually-hidden">Warning</span>' + h(fs.msg) + '</strong></div>' : '') +
      UI.select('a-attempt', 'Attempt', needs.map(function (a) { return { value: a.id, label: a.id + ' ' + nameOf(a.personId) + ' (' + PEO.attemptReviews(a.id).length + ' of 2 allocated)' }; }), fs ? fs.vals.attempt : '') +
      UI.select('a-assessor', 'Assessor', assessors.map(function (x) { return { value: x.id, label: x.name + ', ' + x.team }; }), fs ? fs.vals.assessor : '') + UI.input('a-due', 'Review due date', fs ? fs.vals.due : dueDef, { type: 'date' }) +
      '<button type="button" class="govuk-button" data-module="govuk-button" data-act="allocate">Allocate assessor</button></form>' : '<p class="govuk-body">No attempts need assessors.</p>';
    var pubRows = atts.filter(function (a) { return a.status === 'published'; }).map(function (a) { var o = PEO.overall(a), f = {}; Object.keys(a.moderation.finals).forEach(function (k) { f[k] = Number(a.moderation.finals[k].score); }); return { attemptRef: a.id, cycle: c.id, frameworkVersion: PEO.framework(a.frameworkId).version, finalScores: f, overallBand: o.band, illustrative: true }; });
    return UI.pageHead(c.id + ' ' + c.name, h(c.eligibility)) + back('#/admin/cycles', 'Back to cycles') +
      '<p class="govuk-body">Framework ' + h(fwLabel(c.frameworkId)) + ' \u00b7 ' + UI.fmtDate(c.opens) + ' to ' + UI.fmtDate(c.closes) + ' \u00b7 capacity ' + c.capacity + ' \u00b7 ' + UI.tag(c.status, 'blue') + '</p>' +
      '<h2 class="govuk-heading-m">Attempts</h2>' + table + '<h2 class="govuk-heading-m">Overdue reviews</h2>' +
      (overdue.length ? scroll(UI.table(['Review', 'Attempt', 'Assessor', 'Due'], overdue.map(function (r) { return [h(r.id), h(r.attemptId), h(nameOf(r.assessorId)), UI.fmtDate(r.due) + ' ' + UI.tag('Overdue', 'red')]; }))) : '<p class="govuk-body">None.</p>') +
      '<h2 class="govuk-heading-m">Allocate assessors</h2><p class="govuk-body">Assessors in the same team, or who manage or are managed by the candidate, are blocked.</p>' + alloc +
      '<h2 class="govuk-heading-m">Results export preview ' + UI.tag('Approved interface only', 'grey') + '</h2><p class="govuk-body">Preview only. Nothing is sent or downloaded. Final scores are 0\u20133, bands are illustrative, and no pay information is included.</p><pre class="cbp-pre">' + h(JSON.stringify(pubRows, null, 2)) + '</pre>';
  }
  function auditPage(_, p) {
    var rows = D.auditView(p); if (!rows) return denied('The audit log is available to CBP administrators and platform administrators.');
    var only = X().auditSensitive, list = rows.filter(function (a) { return !only || a.sensitive; });
    return UI.pageHead('Audit', 'Administrator actions and access to sensitive assessment material.') +
      '<div class="govuk-form-group"><div class="govuk-checkboxes govuk-checkboxes--small"><div class="govuk-checkboxes__item"><input class="govuk-checkboxes__input" type="checkbox" id="audit-sens" name="audit-sens"' + (only ? ' checked' : '') + '><label class="govuk-label govuk-checkboxes__label" for="audit-sens">Show sensitive entries only</label></div></div></div>' +
      scroll(UI.table(['When', 'Actor', 'Action', 'Entity', 'Detail', 'Sensitivity'], list.slice(0, 100).map(function (a) { return [UI.fmtTime(a.at), h(a.actor), h(a.action), h(a.entity), h(a.detail), a.sensitive ? UI.tag('Sensitive', 'orange') : '\u2013']; })));
  }

  /* ---------- Routes ---------- */
  R('/', 'home', home);
  R('/my-cbp', 'my', myCbp);
  R('/attempt/:id', 'my', attemptPage);
  R('/outcome/:id', 'my', outcomePage);
  R('/assessor', 'assessor', assessorQueue);
  R('/review/:id', 'assessor', reviewPage);
  R('/moderation', 'moderation', moderationList);
  R('/moderate/:attemptId', 'moderation', moderatePage);
  R('/publish/:id', 'moderation', publishPage);
  R('/admin/cycles', 'cycles', cyclesPage);
  R('/admin/cycle/:id', 'cycles', cyclePage);
  R('/admin/audit', 'audit', auditPage);

  /* ---------- Events ---------- */
  function say(msg) { var el = document.getElementById('saved'); if (el) el.textContent = msg; }
  function stamp() { return 'Draft saved at ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + '.'; }
  function fail(kind, list, vals) { formState = { kind: kind, errs: list, vals: vals || {}, hash: location.hash }; UI.render(); var s = document.querySelector('.govuk-error-summary'); if (s && s.focus) s.focus(); }

  UI.on('click', '[data-act="switch"]', function () {
    var sel = document.getElementById('persona'); PEO.setMe(sel.value); formState = null; var p = me();
    notice = { html: 'Now viewing as ' + h(p.name) + ' (simulated).' }; UI.go('#/');
  });
  UI.on('click', '[data-act="start"]', function (e, el) { var p = me(), c = cycle(el.getAttribute('data-cycle')); if (!c || !eligible(p, c)) return; var a = startAttempt(p, c.id); UI.go('#/attempt/' + a.id); });
  UI.on('click', '[data-act="resubmit"]', function (e, el) {
    var p = me(), o = D.outcomeFor(p, el.getAttribute('data-attempt')), c = cycle(el.getAttribute('data-cycle')); if (!o || !c) return;
    if (S().attempts.some(function (x) { return x.previousAttemptId === o.id; })) return;
    var a = startAttempt(p, c.id, o.id); notice = { html: 'New draft attempt ' + h(a.id) + ' started, linked to ' + h(o.id) + '.' }; UI.go('#/attempt/' + a.id);
  });
  UI.on('input', '#attempt-form', function (e, form) {
    var p = me(), a = D.myAttempt(p, form.getAttribute('data-attempt')); if (!a || a.status !== 'draft') return;
    readDraft(form, a); PEO.save(); var t = e.target;
    if (t && t.getAttribute && t.getAttribute('data-skill')) { var c = document.getElementById('cc-' + t.getAttribute('data-skill')); if (c) c.textContent = t.value.length + ' of ' + LIMIT + ' characters' + (t.value.length > LIMIT ? ' (' + (t.value.length - LIMIT) + ' too many)' : ''); }
    say(stamp());
  });
  UI.on('click', '[data-act="submit-attempt"]', function (e, el) {
    var p = me(), form = el.closest('form'), a = D.myAttempt(p, form.getAttribute('data-attempt')); if (!a || a.status !== 'draft') return;
    readDraft(form, a); PEO.save(); var list = validateAttempt(a); if (list.length) return fail('attempt', list);
    PEO.submitAttempt(a.id, p.name); PEO.save(); formState = null; notice = { html: 'Evidence submitted. Receipt ' + h(a.receipt) + '.' }; UI.render();
  });
  UI.on('click', '[data-act="create-goal"]', function (e, el) {
    var p = me(), o = D.outcomeFor(p, el.getAttribute('data-attempt')); if (!o) return;
    var vals = { skill: document.getElementById('g-skill').value, level: document.getElementById('g-level').value, date: document.getElementById('g-date').value, note: document.getElementById('g-note').value }, list = [];
    if (!vals.date || isNaN(Date.parse(vals.date)) || Date.parse(vals.date) <= now()) list.push({ id: 'g-date', msg: 'Enter a target date in the future' });
    if (list.length) return fail('goal', list, vals);
    PEO.createGoal(p.id, vals.skill, vals.level, vals.date, 'cbp-feedback', vals.note); PEO.save(); formState = null;
    notice = { html: 'Development goal created from your feedback. <a class="govuk-notification-banner__link" href="../learning/#/goals">See your goals in Learning and development</a>.' }; UI.render();
  });
  UI.on('input', '#review-form', function (e, form) { var r = D.reviewFor(me(), form.getAttribute('data-review')); if (!r || r.submittedAt) return; readReview(form, r, PEO.framework(attempt(r.attemptId).frameworkId)); PEO.save(); say(stamp()); });
  UI.on('change', '#review-form', function (e, form) { var r = D.reviewFor(me(), form.getAttribute('data-review')); if (!r || r.submittedAt) return; readReview(form, r, PEO.framework(attempt(r.attemptId).frameworkId)); PEO.save(); say(stamp()); });
  UI.on('click', '[data-act="save-review"]', function (e, el) {
    var form = el.closest('form'), r = D.reviewFor(me(), form.getAttribute('data-review')); if (!r || r.submittedAt) return;
    readReview(form, r, PEO.framework(attempt(r.attemptId).frameworkId)); PEO.save(); say(stamp());
  });
  UI.on('click', '[data-act="submit-review"]', function (e, el) {
    var p = me(), form = el.closest('form'), r = D.reviewFor(p, form.getAttribute('data-review')); if (!r || r.submittedAt) return;
    var fw = PEO.framework(attempt(r.attemptId).frameworkId); readReview(form, r, fw); PEO.save(); var list = [];
    fw.skills.forEach(function (s) {
      if (!validFinal(r.scores[s.id])) list.push({ id: 'score-' + s.id + '-0', msg: 'Select a score from 0 to 3 for ' + s.name });
      if (!String(r.rationale[s.id] || '').trim()) list.push({ id: 'rat-' + s.id, msg: 'Enter a rationale for ' + s.name });
    });
    if (list.length) return fail('review', list);
    PEO.submitReview(r.id, p.name); r.immutable.flags = clone(r.flags || {}); PEO.save(); formState = null; notice = { html: 'Review submitted. It is now locked.' }; UI.go('#/assessor');
  });
  function modDraft(form, a) { var d = readMod(form, a); X().modDrafts[a.id] = { finals: d.finals, note: d.note }; PEO.save(); return d; }
  UI.on('click', '[data-act="save-mod-draft"]', function (e, el) { var form = el.closest('form'), a = D.moderatable(me(), form.getAttribute('data-attempt')); if (!a) return; modDraft(form, a); say(stamp()); });
  UI.on('click', '[data-act="save-mod"]', function (e, el) {
    var p = me(), form = el.closest('form'), a = D.moderatable(p, form.getAttribute('data-attempt')); if (!a) return;
    var d = modDraft(form, a), list = [];
    PEO.framework(a.frameworkId).skills.forEach(function (s) {
      if (!validFinal(d.finals[s.id].score)) list.push({ id: 'final-' + s.id + '-0', msg: 'Select a final score of 0, 1, 2 or 3 for ' + s.name });
      if (!d.finals[s.id].rationale.trim()) list.push({ id: 'frat-' + s.id, msg: 'Enter a final rationale for ' + s.name });
    });
    if (list.length) return fail('mod', list);
    var finals = {}; Object.keys(d.finals).forEach(function (k) { finals[k] = { score: Number(d.finals[k].score), rationale: d.finals[k].rationale }; });
    if (!PEO.moderate(a.id, finals, d.note, p.name)) return fail('mod', [{ id: 'final-' + Object.keys(finals)[0] + '-0', msg: 'Final scores must be 0, 1, 2 or 3' }]);
    delete X().modDrafts[a.id]; PEO.save(); formState = null; notice = { html: 'Moderated scores saved. Now approve publication.' }; UI.go('#/publish/' + a.id);
  });
  UI.on('click', '[data-act="publish"]', function (e, el) {
    var p = me(), a = D.publishable(p, el.getAttribute('data-attempt')); if (!a || a.status === 'published') return;
    var fb = document.getElementById('pub-feedback').value; if (!fb.trim()) return fail('pub', [{ id: 'pub-feedback', msg: 'Enter candidate feedback before publishing' }], { feedback: fb });
    PEO.publishOutcome(a.id, fb.trim(), p.name); S().notifications.push({ id: PEO.uid('NOT'), recipient: a.personId, trigger: 'assessment.outcome.published', status: 'delivered (simulated)', at: new Date().toISOString() }); PEO.save();
    formState = null; notice = { html: 'Outcome published. The candidate can now see their scores and feedback.' }; UI.render();
  });
  UI.on('click', '[data-act="create-cycle"]', function () {
    var p = me(); if (!D.admin(p)) return;
    var g = function (id) { return document.getElementById(id).value; }, rp = Array.prototype.map.call(document.querySelectorAll('[name="c-rp"]:checked'), function (x) { return x.value; });
    var vals = { name: g('c-name').trim(), fw: g('c-fw'), rp: rp, opens: g('c-opens'), closes: g('c-closes'), capacity: g('c-cap').trim(), eligibility: g('c-elig').trim() }, list = [];
    if (!vals.name) list.push({ id: 'c-name', msg: 'Enter a cycle name' });
    if (!vals.rp.length) list.push({ id: 'c-rp-0', msg: 'Select at least one role profile' });
    if (!vals.opens) list.push({ id: 'c-opens', msg: 'Enter an opening date' });
    if (!vals.closes) list.push({ id: 'c-closes', msg: 'Enter a closing date' });
    else if (vals.opens && Date.parse(vals.closes) <= Date.parse(vals.opens)) list.push({ id: 'c-closes', msg: 'Closing date must be after the opening date' });
    if (!/^[1-9]\d*$/.test(vals.capacity)) list.push({ id: 'c-cap', msg: 'Capacity must be a whole number greater than 0' });
    if (!vals.eligibility) list.push({ id: 'c-elig', msg: 'Enter eligibility guidance' });
    var f = PEO.framework(vals.fw); if (!f || f.status !== 'published') list.push({ id: 'c-fw', msg: 'Select a published framework version' });
    if (list.length) return fail('cycle', list, vals);
    var c = { id: nextId('CYC', S().cycles), name: vals.name, frameworkId: vals.fw, roleProfileIds: vals.rp, opens: new Date(vals.opens).toISOString(), closes: new Date(vals.closes).toISOString(), status: Date.parse(vals.opens) > now() ? 'scheduled' : 'open for applications', capacity: Number(vals.capacity), eligibility: vals.eligibility };
    S().cycles.push(c); PEO.audit(p.name, 'Opened assessment round', c.id, 'Framework ' + vals.fw); PEO.event('assessment.round.opened', c.id); PEO.save();
    formState = null; notice = { html: 'Cycle ' + h(c.id) + ' created.' }; UI.render();
  });
  UI.on('click', '[data-act="allocate"]', function () {
    var p = me(); if (!D.admin(p)) return;
    var vals = { attempt: document.getElementById('a-attempt').value, assessor: document.getElementById('a-assessor').value, due: document.getElementById('a-due').value };
    if (!vals.due) { formState = { kind: 'alloc', msg: 'Enter a review due date.', vals: vals, hash: location.hash, errs: [] }; return UI.render(); }
    var res = allocate(vals.attempt, vals.assessor, vals.due);
    if (!res.ok) { formState = { kind: 'alloc', msg: res.msg, vals: vals, hash: location.hash, errs: [] }; return UI.render(); }
    formState = null; notice = { html: h(res.msg) }; UI.render();
  });
  UI.on('change', '#audit-sens', function (e, el) { X().auditSensitive = el.checked; PEO.save(); UI.render(); });

  UI.start();
})();
