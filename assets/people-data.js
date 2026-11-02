/* Shared fictional data and logic for the people capability suite (CBP, skills, learning). window.PEO.
   Separate store from ECO. Keeps CBP assessment, self-assessment and learning records as distinct evidence types.
   Pay policy is NOT modelled: outcome bands are illustrative configuration only. */
(function () {
  'use strict';
  var KEY = 'people-capability-suite-v1', DAY = 86400000;
  function iso(ms) { return new Date(ms).toISOString(); }
  function ago(d) { return iso(Date.now() - d * DAY); }
  function ahead(d) { return iso(Date.now() + d * DAY); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function rng(seed) { var a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  var FINAL_SCORES = [0, 1, 2, 3];
  var SCORE_LABELS = { 0: 'Not yet evidenced', 1: 'Developing', 2: 'Secure', 3: 'Strong' };
  var ROLES = { staff: 'Staff member', assessor: 'Assessor', moderator: 'Moderator', manager: 'Line manager', hop: 'Head of profession', ld: 'L&D administrator', cbpadmin: 'CBP administrator', platform: 'Platform administrator' };
  var ATTEMPT_STATUS = ['draft', 'submitted', 'under review', 'moderation', 'outcome ready', 'published'];

  var SKILLS = [
    { id: 'SK-01', name: 'Design communication', category: 'Communicating', definition: 'Explains design thinking and decisions clearly to different audiences.', phrase: 'communicates design decisions' },
    { id: 'SK-02', name: 'Designing for everyone', category: 'Inclusion', definition: 'Designs services that work for all users, including those with access needs.', phrase: 'designs for users with different needs' },
    { id: 'SK-03', name: 'Designing strategically', category: 'Strategy', definition: 'Connects design work to policy outcomes and the wider service.', phrase: 'links design to strategy and outcomes' },
    { id: 'SK-04', name: 'Designing together', category: 'Collaboration', definition: 'Works with multidisciplinary colleagues and stakeholders.', phrase: 'collaborates across disciplines' },
    { id: 'SK-05', name: 'Evidence-based design', category: 'Research', definition: 'Uses user research and data to shape decisions.', phrase: 'bases decisions on evidence' },
    { id: 'SK-06', name: 'Iterative design', category: 'Delivery', definition: 'Improves services through frequent testing and change.', phrase: 'iterates based on testing' },
    { id: 'SK-07', name: 'Leading design', category: 'Leadership', definition: 'Sets direction and develops others in the design community.', phrase: 'leads and develops others' }
  ];
  var LEVEL_STEM = { 0: 'No clear evidence that the person', 1: 'Sometimes', 2: 'Consistently', 3: 'Role-model standard: shapes how others' };
  function descriptors(sk) { var d = {}; [0, 1, 2, 3].forEach(function (l) { d[l] = l === 0 ? 'No clear evidence yet that the person ' + sk.phrase + '.' : l === 1 ? 'Sometimes ' + sk.phrase + ', with support.' : l === 2 ? 'Consistently ' + sk.phrase + ' on their own work.' : 'Is a role model: shapes how others ' + sk.phrase.replace(/^(\w+)s /, '$1 ') + '.'; }); return d; }

  function frameworkVersion(id, version, status, effective, changes, tweak) {
    var skills = clone(SKILLS).map(function (s) { s.descriptors = descriptors(s); delete s.phrase; return s; });
    if (tweak) tweak(skills);
    return { id: id, version: version, status: status, effective: effective, profession: 'service-design', changeLog: changes, skills: skills };
  }
  var PROFESSION = { id: 'service-design', name: 'Service design', lead: 'Raj Mehta' };
  var ROLE_PROFILES = [
    { id: 'RP-1', name: 'Service designer', grade: 'Grade 7', expected: { 'SK-01': 2, 'SK-02': 2, 'SK-03': 1, 'SK-04': 2, 'SK-05': 2, 'SK-06': 2, 'SK-07': 1 } },
    { id: 'RP-2', name: 'Senior service designer', grade: 'Grade 6', expected: { 'SK-01': 2, 'SK-02': 2, 'SK-03': 2, 'SK-04': 2, 'SK-05': 2, 'SK-06': 2, 'SK-07': 2 } },
    { id: 'RP-3', name: 'Lead service designer', grade: 'Senior', expected: { 'SK-01': 3, 'SK-02': 3, 'SK-03': 3, 'SK-04': 2, 'SK-05': 2, 'SK-06': 2, 'SK-07': 3 } }
  ];

  var PEOPLE = [
    { id: 'P-01', name: 'Maya Singh', persona: 'staff', role: 'RP-2', team: 'Schools Digital', manager: 'P-07', email: 'maya.singh@example.gov.uk' },
    { id: 'P-02', name: 'Leo Carter', persona: 'staff', role: 'RP-1', team: 'Early Years Digital', manager: 'P-07' },
    { id: 'P-03', name: 'Ife Adeyemi', persona: 'assessor', role: 'RP-3', team: 'Teaching Workforce', manager: 'P-05' },
    { id: 'P-04', name: 'Hannah Brooks', persona: 'assessor', role: 'RP-3', team: 'Data and Insight', manager: 'P-05' },
    { id: 'P-05', name: 'Raj Mehta', persona: 'hop', role: 'RP-3', team: 'Service Design Profession', manager: null },
    { id: 'P-06', name: 'Grace Lin', persona: 'moderator', role: 'RP-3', team: 'Service Design Profession', manager: 'P-05' },
    { id: 'P-07', name: 'Owen Davies', persona: 'manager', role: 'RP-3', team: 'Schools Digital', manager: 'P-05' },
    { id: 'P-08', name: 'Tara Nguyen', persona: 'ld', role: null, team: 'Learning and Development', manager: null },
    { id: 'P-09', name: 'Colin Reed', persona: 'cbpadmin', role: null, team: 'Capability Operations', manager: null },
    { id: 'P-10', name: 'Zoe Hart', persona: 'platform', role: null, team: 'Platform', manager: null }
  ];
  var CANDIDATE_NAMES = ['Aisha Khan', 'Ben Taylor', 'Chloe Evans', 'Dev Patel', 'Ella Moore', 'Femi Ojo', 'Gus Hall', 'Holly Wood', 'Imran Ali', 'Jade Cole', 'Kai Lewis', 'Lena Roy', 'Mo Bell', 'Nina Cruz'];
  var TEAMS = ['Schools Digital', 'Early Years Digital', 'Teaching Workforce', 'Data and Insight', 'Casework'];

  var LEARNING = [
    { id: 'LRN-01', title: 'Writing for design decisions', format: 'Workshop', provider: 'Government Digital Academy', hours: 3, skills: [{ skillId: 'SK-01', level: 2 }], capacity: 16, owner: 'Tara Nguyen', reviewDue: ahead(120), accessibility: 'Step-free venue; captions available', link: 'https://learning.example.gov.uk/wdd' },
    { id: 'LRN-02', title: 'Inclusive design essentials', format: 'Online course', provider: 'Accessibility team', hours: 4, skills: [{ skillId: 'SK-02', level: 2 }], capacity: null, owner: 'Tara Nguyen', reviewDue: ahead(200), accessibility: 'Screen reader tested', link: 'https://learning.example.gov.uk/ide' },
    { id: 'LRN-03', title: 'Designing strategically masterclass', format: 'Workshop', provider: 'Service Design Profession', hours: 6, skills: [{ skillId: 'SK-03', level: 2 }, { skillId: 'SK-07', level: 2 }], capacity: 20, owner: 'Tara Nguyen', reviewDue: ahead(90), accessibility: 'Hybrid; captions available', link: 'https://learning.example.gov.uk/dsm' },
    { id: 'LRN-04', title: 'Strategy and policy for designers', format: 'Guide', provider: 'Policy profession', hours: 2, skills: [{ skillId: 'SK-03', level: 1 }], capacity: null, owner: 'Tara Nguyen', reviewDue: ahead(60), accessibility: 'Plain HTML', link: 'https://learning.example.gov.uk/spd' },
    { id: 'LRN-05', title: 'Co-design in practice', format: 'Workshop', provider: 'Service Design Profession', hours: 6, skills: [{ skillId: 'SK-04', level: 2 }], capacity: 14, owner: 'Tara Nguyen', reviewDue: ahead(150), accessibility: 'Step-free venue', link: 'https://learning.example.gov.uk/cdp' },
    { id: 'LRN-06', title: 'Research synthesis lab', format: 'Practical assignment', provider: 'User research profession', hours: 8, skills: [{ skillId: 'SK-05', level: 2 }], capacity: 12, owner: 'Tara Nguyen', reviewDue: ahead(100), accessibility: 'Remote option', link: 'https://learning.example.gov.uk/rsl' },
    { id: 'LRN-07', title: 'Rapid prototyping and testing', format: 'Online course', provider: 'Government Digital Academy', hours: 5, skills: [{ skillId: 'SK-06', level: 2 }, { skillId: 'SK-05', level: 1 }], capacity: null, owner: 'Tara Nguyen', reviewDue: ahead(180), accessibility: 'Captions and transcripts', link: 'https://learning.example.gov.uk/rpt' },
    { id: 'LRN-08', title: 'Leading a design team', format: 'Coaching', provider: 'Leadership development', hours: 10, skills: [{ skillId: 'SK-07', level: 3 }], capacity: 8, owner: 'Tara Nguyen', reviewDue: ahead(75), accessibility: 'Flexible scheduling', link: 'https://learning.example.gov.uk/ldt' },
    { id: 'LRN-09', title: 'Service design mentoring circle', format: 'Mentoring', provider: 'Service Design Profession', hours: 12, skills: [{ skillId: 'SK-03', level: 3 }, { skillId: 'SK-07', level: 2 }], capacity: 10, owner: 'Raj Mehta', reviewDue: ahead(110), accessibility: 'Remote', link: '' },
    { id: 'LRN-10', title: 'Presenting design work', format: 'Community session', provider: 'Design community of practice', hours: 1.5, skills: [{ skillId: 'SK-01', level: 1 }], capacity: 40, owner: 'Tara Nguyen', reviewDue: ahead(30), accessibility: 'Captions available', link: '' },
    { id: 'LRN-11', title: 'Shadow a live service assessment', format: 'Shadowing', provider: 'Service assessment team', hours: 4, skills: [{ skillId: 'SK-03', level: 2 }, { skillId: 'SK-05', level: 2 }], capacity: 6, owner: 'Tara Nguyen', reviewDue: ahead(50), accessibility: 'Remote or in person', link: '' },
    { id: 'LRN-12', title: 'Legacy intranet design guide', format: 'Guide', provider: 'Retired', hours: 1, skills: [{ skillId: 'SK-01', level: 1 }], capacity: null, owner: 'Tara Nguyen', reviewDue: ago(60), accessibility: 'Unknown', link: '', archived: true }
  ];

  var S = null;
  function uid(p) { S.seq[p] = (S.seq[p] || 0) + 1; return p + '-' + String(S.seq[p]).padStart(3, '0'); }
  function person(id) { return S.people.filter(function (p) { return p.id === id; })[0]; }
  function byId(list, id) { return list.filter(function (x) { return x.id === id; })[0]; }
  function fw(id) { return byId(S.frameworks, id); }
  function roleProfile(id) { return byId(S.roleProfiles, id); }

  /* Audit and events. Events never carry candidate evidence or assessor notes. */
  function audit(actor, action, entity, detail) { S.audit.unshift({ id: 'AUD-' + String(++S.seq.AUD).padStart(5, '0'), at: iso(Date.now()), actor: actor || 'System', action: action, entity: entity || '', detail: detail || '', sensitive: /review|moderat|score|evidence|publish/i.test(action) }); if (S.audit.length > 400) S.audit.length = 400; }
  function event(type, entityId, correlationId) {
    var e = { eventId: 'EVT-' + String(++S.seq.EVT).padStart(5, '0'), eventType: type, entityId: entityId, schemaVersion: '1.0', occurredAt: iso(Date.now()), sourceSystem: 'people-capability-suite', correlationId: correlationId || entityId };
    S.events.unshift(e); if (S.events.length > 400) S.events.length = 400; return e;
  }

  /* CBP workflow. Reviews are immutable once submitted; assessors cannot see each other's unsubmitted scores. */
  function attemptReviews(attemptId) { return S.reviews.filter(function (r) { return r.attemptId === attemptId; }); }
  function recomputeStatus(a) {
    if (a.status === 'draft' || a.status === 'published') return;
    var subm = attemptReviews(a.id).filter(function (r) { return r.submittedAt; });
    if (a.moderation && a.moderation.approvedAt) a.status = 'outcome ready';
    else if (subm.length >= 2) a.status = 'moderation';
    else a.status = a.submittedAt ? (subm.length ? 'under review' : 'submitted') : a.status;
    if (a.status === 'submitted' && attemptReviews(a.id).length) a.status = 'under review';
  }
  function submitAttempt(attemptId, actor) {
    var a = byId(S.attempts, attemptId); if (!a || a.status !== 'draft') return null;
    a.submissionVersion = (a.submissionVersion || 0) + 1; a.submittedAt = iso(Date.now()); a.status = 'submitted';
    a.receipt = 'RCPT-' + a.id + '-v' + a.submissionVersion; a.lockedResponses = clone(a.responses);
    audit(actor, 'Submitted CBP evidence', a.id, 'Receipt ' + a.receipt); event('assessment.submitted', a.id); return a;
  }
  function submitReview(reviewId, actor) {
    var r = byId(S.reviews, reviewId); if (!r || r.submittedAt) return null;
    var a = byId(S.attempts, r.attemptId), fwv = fw(a.frameworkId);
    r.submittedAt = iso(Date.now()); r.immutable = clone({ scores: r.scores, rationale: r.rationale, feedback: r.feedback });
    recomputeStatus(a); audit(actor, 'Submitted assessor review', r.id, a.id); event('assessor.review.submitted', r.id, a.id); return r;
  }
  function moderate(attemptId, finals, overallNote, actor) {
    var a = byId(S.attempts, attemptId), bad = Object.keys(finals).some(function (k) { return FINAL_SCORES.indexOf(Number(finals[k].score)) < 0; });
    if (!a || bad) return null;
    a.moderation = { finals: finals, internalNote: overallNote || '', approvedAt: iso(Date.now()), approvedBy: actor || 'Moderator', candidateFeedback: '', published: false };
    recomputeStatus(a); audit(actor, 'Recorded moderated scores', a.id); event('assessment.moderated', a.id); return a.moderation;
  }
  function publishOutcome(attemptId, candidateFeedback, actor) {
    var a = byId(S.attempts, attemptId); if (!a || !a.moderation) return null;
    a.moderation.candidateFeedback = candidateFeedback || ''; a.moderation.published = true; a.status = 'published'; a.publishedAt = iso(Date.now());
    a.outcome = overall(a); audit(actor, 'Published outcome', a.id); event('assessment.outcome.published', a.id); return a;
  }
  // Illustrative only: total of final scores mapped to configurable bands. Not pay policy.
  function overall(a) {
    var f = a.moderation && a.moderation.finals; if (!f) return null;
    var total = Object.keys(f).reduce(function (n, k) { return n + Number(f[k].score); }, 0), max = Object.keys(f).length * 3, pct = max ? total / max : 0, band = null;
    S.bands.forEach(function (b) { if (pct >= b.min) band = b; });
    return { total: total, max: max, band: band ? band.label : 'Not banded', illustrative: true };
  }

  /* Skills, gaps, recommendations */
  function latestSelf(personId, skillId) { var l = S.selfAssessments.filter(function (s) { return s.personId === personId && s.skillId === skillId; }); l.sort(function (a, b) { return Date.parse(b.at) - Date.parse(a.at); }); return l[0] || null; }
  function formalLevel(personId, skillId) {
    var best = null; S.attempts.forEach(function (a) { if (a.personId === personId && a.status === 'published' && a.moderation && a.moderation.finals[skillId]) { if (!best || Date.parse(a.publishedAt) > Date.parse(best.at)) best = { level: Number(a.moderation.finals[skillId].score), at: a.publishedAt, attemptId: a.id }; } });
    return best;
  }
  // Gap only where expected and at least one source exist. Sources stay separate; no blended score.
  function gap(personId) {
    var p = person(personId), rp = p && roleProfile(p.role); if (!rp) return [];
    var current = S.frameworks.filter(function (f) { return f.status === 'published'; }).sort(function (a, b) { return b.version - a.version; })[0];
    return current.skills.map(function (sk) {
      var exp = rp.expected[sk.id], self = latestSelf(personId, sk.id), formal = formalLevel(personId, sk.id), stale = self && (Date.now() - Date.parse(self.at)) > 365 * DAY;
      var row = { skillId: sk.id, name: sk.name, expected: exp, self: self ? self.level : null, selfAt: self ? self.at : null, confidence: self ? self.confidence : null, formal: formal ? formal.level : null, formalAt: formal ? formal.at : null, stale: !!stale, frameworkVersion: current.version };
      row.selfGap = self && exp != null ? exp - self.level : null; row.formalGap = formal && exp != null ? exp - formal.level : null;
      row.note = !self && !formal ? 'No evidence recorded yet, so no gap is calculated.' : (stale ? 'Self-assessment is more than a year old.' : '');
      return row;
    });
  }
  function recommend(personId) {
    var out = [], goals = S.goals.filter(function (g) { return g.personId === personId && g.status !== 'complete'; }), dis = (S.dismissed[personId] || []);
    goals.forEach(function (g) {
      var sk = fw(S.frameworks[S.frameworks.length - 1].id).skills.filter(function (s) { return s.id === g.skillId; })[0];
      S.learning.filter(function (l) { return !l.archived; }).forEach(function (l) {
        var m = l.skills.filter(function (x) { return x.skillId === g.skillId && x.level >= (g.targetLevel || 1); })[0];
        if (m && dis.indexOf(l.id + ':' + g.id) < 0 && !S.enrolments.some(function (e) { return e.personId === personId && e.itemId === l.id; }))
          out.push({ itemId: l.id, goalId: g.id, reason: 'You have a goal in "' + (sk ? sk.name : g.skillId) + '" (target level ' + (g.targetLevel || 1) + '). "' + l.title + '" is tagged to that skill at level ' + m.level + '.' });
      });
    });
    return out;
  }
  function dismiss(personId, itemId, goalId) { (S.dismissed[personId] = S.dismissed[personId] || []).push(itemId + ':' + goalId); audit(person(personId).name, 'Dismissed recommendation', itemId); }
  function createGoal(personId, skillId, targetLevel, targetDate, source, note) {
    var g = { id: uid('GOAL'), personId: personId, skillId: skillId, targetLevel: Number(targetLevel), targetDate: targetDate, status: 'active', source: source || 'self', note: note || '', created: iso(Date.now()), reviewDate: targetDate, managerShared: false };
    S.goals.push(g); audit(person(personId).name, 'Created development goal', g.id); event('development.goal.created', g.id); return g;
  }
  function enrol(personId, itemId, status) {
    var l = byId(S.learning, itemId), e = { id: uid('ENR'), personId: personId, itemId: itemId, status: status || 'planned', at: iso(Date.now()), attended: null, completedAt: null };
    S.enrolments.push(e); event('learning.enrolment.created', e.id); audit(person(personId).name, 'Added to development plan', l.title); return e;
  }
  function completeLearning(enrolId, reflection) {
    var e = byId(S.enrolments, enrolId); if (!e) return; e.status = 'completed'; e.completedAt = iso(Date.now()); e.attended = true;
    if (reflection) S.reflections.push({ id: uid('REF'), personId: e.personId, enrolmentId: e.id, itemId: e.itemId, text: reflection, applied: true, at: iso(Date.now()) });
    event('learning.completed', e.id);
  }
  function recordSelf(personId, skillId, level, confidence, evidenceText) {
    var f = S.frameworks.filter(function (x) { return x.status === 'published'; }).sort(function (a, b) { return b.version - a.version; })[0];
    var s = { id: uid('SELF'), personId: personId, skillId: skillId, level: Number(level), confidence: confidence, at: iso(Date.now()), frameworkVersion: f.version, evidence: evidenceText || '' };
    S.selfAssessments.push(s); event('skill.evidence.updated', s.id); audit(person(personId).name, 'Recorded self-assessment', skillId); return s;
  }

  /* Privacy-safe aggregation. Suppresses any cell with fewer than minCohort people. */
  function aggregate(filter) {
    filter = filter || {}; var min = S.reporting.minCohort, ids = S.people.filter(function (p) { return p.role && (!filter.team || p.team === filter.team) && (!filter.role || p.role === filter.role); }).map(function (p) { return p.id; });
    var cur = S.frameworks.filter(function (f) { return f.status === 'published'; }).sort(function (a, b) { return b.version - a.version; })[0];
    var rows = cur.skills.map(function (sk) {
      var levels = [], gaps = [], stale = 0;
      ids.forEach(function (id) { var s = latestSelf(id, sk.id); if (s) { levels.push(s.level); var rp = roleProfile(person(id).role); if (rp) gaps.push(rp.expected[sk.id] - s.level); if (Date.now() - Date.parse(s.at) > 365 * DAY) stale++; } });
      var n = levels.length, suppressed = n < min;
      return { skillId: sk.id, name: sk.name, cohort: ids.length, withEvidence: suppressed ? null : n, coveragePct: suppressed ? null : Math.round(n / Math.max(ids.length, 1) * 100), meanSelf: suppressed ? null : Math.round(levels.reduce(function (a, b) { return a + b; }, 0) / n * 10) / 10,
        meanGap: suppressed ? null : Math.round(gaps.reduce(function (a, b) { return a + b; }, 0) / n * 10) / 10, atOrAbovePct: suppressed ? null : Math.round(gaps.filter(function (g) { return g <= 0; }).length / n * 100), stalePct: suppressed ? null : Math.round(stale / n * 100), suppressed: suppressed, reason: suppressed ? 'Fewer than ' + min + ' people with self-assessed evidence' : '' };
    });
    return { cohortSize: ids.length, minCohort: min, frameworkVersion: cur.version, source: 'Self-assessment (voluntary)', generatedAt: iso(Date.now()), rows: rows };
  }
  function reportPreview() {
    var agg = aggregate(), att = S.attempts, pub = att.filter(function (a) { return a.status === 'published'; }).length, min = S.reporting.minCohort;
    return {
      schemaVersion: '1.0', generatedAt: iso(Date.now()), provenance: { sourceSystem: 'people-capability-suite', frameworkVersion: agg.frameworkVersion, aggregation: 'Counts and means only; cells under ' + min + ' suppressed', definitionsUrl: '#/definitions' },
      cbpProcess: { cycle: S.cycles[0].name, attempts: att.length >= min ? att.length : 'suppressed', published: pub >= min ? pub : 'suppressed', overdueReviews: S.reviews.filter(function (r) { return !r.submittedAt && Date.parse(r.due) < Date.now(); }).length },
      capability: agg.rows.map(function (r) { return { skill: r.name, coveragePct: r.coveragePct, meanGap: r.meanGap, suppressed: r.suppressed }; }),
      learning: { items: S.learning.filter(function (l) { return !l.archived; }).length, enrolments: S.enrolments.length >= min ? S.enrolments.length : 'suppressed', completed: S.enrolments.filter(function (e) { return e.status === 'completed'; }).length >= min ? S.enrolments.filter(function (e) { return e.status === 'completed'; }).length : 'suppressed' },
      excluded: ['Candidate evidence', 'Assessor comments and scores', 'Individual self-assessments', 'Names or identifiers']
    };
  }

  /* Seed */
  function seed() {
    var r = rng(77), i;
    S = { seq: { AUD: 0, EVT: 0 }, people: clone(PEOPLE), roleProfiles: clone(ROLE_PROFILES), profession: clone(PROFESSION), frameworks: [], cycles: [], attempts: [], reviews: [], selfAssessments: [], goals: [], learning: clone(LEARNING), sessions: [], enrolments: [], reflections: [],
      interventions: [], notifications: [], audit: [], events: [], dismissed: {}, tasks: [], imports: [], integrations: [], bands: [{ min: 0, label: 'Band A (illustrative)' }, { min: 0.4, label: 'Band B (illustrative)' }, { min: 0.65, label: 'Band C (illustrative)' }, { min: 0.85, label: 'Band D (illustrative)' }],
      reporting: { minCohort: 5 }, ext: {}, createdAt: iso(Date.now()), version: 1 };
    S.frameworks.push(frameworkVersion('FW-1', 1, 'superseded', '2025-04-01', ['Initial published framework']));
    S.frameworks.push(frameworkVersion('FW-2', 2, 'published', '2026-04-01', ['Sharpened descriptors for Designing strategically', 'Added accessibility examples to Designing for everyone'], function (sk) { sk[2].descriptors[2] = 'Consistently connects design work to policy outcomes and the wider service, and explains trade-offs.'; sk[1].descriptors[3] = 'Is a role model for accessible design and coaches others on access needs.'; }));
    S.frameworks.push(frameworkVersion('FW-3', 3, 'draft', '2027-04-01', ['Draft: add AI-assisted design practice (not yet approved)']));

    for (i = 0; i < CANDIDATE_NAMES.length; i++) S.people.push({ id: 'P-' + (11 + i), name: CANDIDATE_NAMES[i], persona: 'staff', role: ['RP-1', 'RP-2', 'RP-2', 'RP-1'][i % 4], team: TEAMS[i % TEAMS.length], manager: 'P-07' });

    S.cycles = [
      { id: 'CYC-001', name: 'Service design CBP round 2026', frameworkId: 'FW-1', roleProfileIds: ['RP-1', 'RP-2'], opens: ago(60), closes: ago(14), status: 'open for assessment', capacity: 30, eligibility: 'Service designers and senior service designers with 12 months in role' },
      { id: 'CYC-002', name: 'Service design resubmission window', frameworkId: 'FW-2', roleProfileIds: ['RP-1', 'RP-2'], opens: ago(5), closes: ahead(25), status: 'open for applications', capacity: 10, eligibility: 'Candidates with a previously published outcome' }
    ];

    var skillIds = SKILLS.map(function (s) { return s.id; });
    function resp(personName, strong) { var o = {}; skillIds.forEach(function (id) { o[id] = { example: 'Invented example for ' + id + ' from ' + personName + ': described the situation, my actions and the result in a short narrative.', link: '', words: 90 }; }); return o; }
    function attempt(id, pid, status, cyc, extra) { var a = { id: id, personId: pid, cycleId: cyc || 'CYC-001', frameworkId: cyc === 'CYC-002' ? 'FW-2' : 'FW-1', status: status, responses: resp(person(pid).name), submissionVersion: 0, submittedAt: null, receipt: '', moderation: null, previousAttemptId: null, created: ago(40) }; Object.keys(extra || {}).forEach(function (k) { a[k] = extra[k]; }); S.attempts.push(a); return a; }
    function review(attemptId, assessor, submitted, base, due) {
      var sc = {}, ra = {}; skillIds.forEach(function (id) { sc[id] = Math.max(0, Math.min(3, Math.round(base + (r() - 0.5) * 1.6))); ra[id] = 'Invented rationale: evidence shows ' + SCORE_LABELS[sc[id]].toLowerCase() + ' practice.'; });
      var rv = { id: uid('REV'), attemptId: attemptId, assessorId: assessor, scores: sc, rationale: ra, feedback: submitted ? 'Invented feedback: strong collaboration; add more detail on measuring impact.' : '', submittedAt: submitted ? ago(r() * 8) : null, due: due || ahead(10), flag: null }; if (submitted) rv.immutable = clone({ scores: sc, rationale: ra, feedback: rv.feedback }); S.reviews.push(rv); return rv;
    }
    function finalsFrom(a, base) { var f = {}; skillIds.forEach(function (id) { var v = Math.max(0, Math.min(3, Math.round(base + (r() - 0.5) * 1.2))); f[id] = { score: v, rationale: 'Agreed after discussion of both reviews.' }; }); return f; }
    function submit(a) { a.submissionVersion = 1; a.submittedAt = ago(20); a.receipt = 'RCPT-' + a.id + '-v1'; a.lockedResponses = clone(a.responses); }

    var a1 = attempt('ATT-001', 'P-01', 'published', 'CYC-001'); submit(a1); review(a1.id, 'P-03', true, 2); review(a1.id, 'P-04', true, 2.2);
    a1.moderation = { finals: finalsFrom(a1, 2), internalNote: 'Internal: agreed quickly; minor difference on SK-03.', approvedAt: ago(9), approvedBy: 'Grace Lin', candidateFeedback: 'Invented feedback: clear strengths in collaboration and evidence. Develop strategic framing of your work.', published: true }; a1.publishedAt = ago(6); a1.outcome = overall(a1);
    attempt('ATT-002', 'P-02', 'draft', 'CYC-001'); S.attempts[1].responses['SK-03'].example = '';
    var a3 = attempt('ATT-003', 'P-11', 'submitted', 'CYC-001'); submit(a3);
    var a4 = attempt('ATT-004', 'P-12', 'under review', 'CYC-001'); submit(a4); review(a4.id, 'P-03', true, 1.8); review(a4.id, 'P-04', false, 0, ahead(3));
    var a5 = attempt('ATT-005', 'P-13', 'moderation', 'CYC-001'); submit(a5); review(a5.id, 'P-03', true, 1.5); review(a5.id, 'P-04', true, 2.3);
    var a6 = attempt('ATT-006', 'P-14', 'outcome ready', 'CYC-001'); submit(a6); review(a6.id, 'P-03', true, 2.4); review(a6.id, 'P-04', true, 2.2); a6.moderation = { finals: finalsFrom(a6, 2.4), internalNote: 'Internal: strong across the board.', approvedAt: ago(2), approvedBy: 'Grace Lin', candidateFeedback: '', published: false };
    var a7 = attempt('ATT-007', 'P-15', 'published', 'CYC-001'); submit(a7); review(a7.id, 'P-03', true, 1); review(a7.id, 'P-04', true, 1.2); a7.moderation = { finals: finalsFrom(a7, 1), internalNote: 'Internal: insufficient evidence on strategy and leadership.', approvedAt: ago(30), approvedBy: 'Grace Lin', candidateFeedback: 'Invented feedback: provide more evidence of strategic thinking and leading others.', published: true }; a7.publishedAt = ago(25); a7.outcome = overall(a7);
    attempt('ATT-008', 'P-15', 'draft', 'CYC-002', { previousAttemptId: 'ATT-007', created: ago(3) });
    var a9 = attempt('ATT-009', 'P-16', 'submitted', 'CYC-001'); submit(a9); review(a9.id, 'P-03', false, 0, ago(2)); review(a9.id, 'P-04', false, 0, ahead(5));

    // Self-assessments for most people (aggregation relies on >=5 per skill)
    S.people.filter(function (p) { return p.role; }).forEach(function (p, idx) {
      if (p.id === 'P-02') return;
      var rp = roleProfile(p.role);
      SKILLS.forEach(function (sk) {
        if (r() < 0.12 && p.id !== 'P-01') return;
        var weak = (sk.id === 'SK-03' || sk.id === 'SK-07') ? 1 : 0, lvl = Math.max(0, Math.min(3, rp.expected[sk.id] - (r() < 0.4 + weak * 0.3 ? 1 : 0) + (r() < 0.12 ? 1 : 0)));
        S.selfAssessments.push({ id: uid('SELF'), personId: p.id, skillId: sk.id, level: lvl, confidence: ['Low', 'Medium', 'High'][Math.floor(r() * 3)], at: ago(r() < 0.15 ? 400 + r() * 60 : r() * 200), frameworkVersion: 2, evidence: 'Invented evidence note.' });
      });
    });
    S.goals.push({ id: uid('GOAL'), personId: 'P-01', skillId: 'SK-03', targetLevel: 2, targetDate: ahead(120), status: 'active', source: 'cbp-feedback', note: 'From published CBP feedback theme.', created: ago(5), reviewDate: ahead(120), managerShared: true });
    S.goals.push({ id: uid('GOAL'), personId: 'P-02', skillId: 'SK-02', targetLevel: 2, targetDate: ahead(90), status: 'active', source: 'self', note: '', created: ago(10), reviewDate: ahead(90), managerShared: false });
    S.goals.push({ id: uid('GOAL'), personId: 'P-15', skillId: 'SK-07', targetLevel: 2, targetDate: ahead(150), status: 'active', source: 'cbp-feedback', note: '', created: ago(20), reviewDate: ahead(150), managerShared: true });
    S.sessions = [
      { id: 'SES-01', itemId: 'LRN-03', date: ahead(18), capacity: 20, booked: 14, waiting: 0, status: 'open' }, { id: 'SES-02', itemId: 'LRN-05', date: ahead(25), capacity: 14, booked: 14, waiting: 3, status: 'full' },
      { id: 'SES-03', itemId: 'LRN-01', date: ahead(9), capacity: 16, booked: 9, waiting: 0, status: 'open' }, { id: 'SES-04', itemId: 'LRN-08', date: ahead(40), capacity: 8, booked: 5, waiting: 0, status: 'open' }
    ];
    var e1 = enrol('P-01', 'LRN-04', 'in progress'); var e2 = enrol('P-01', 'LRN-10', 'completed'); completeLearning(e2.id, 'Presented my service map to the team; stakeholders asked for a follow-up.');
    enrol('P-02', 'LRN-02', 'planned'); var e3 = enrol('P-15', 'LRN-08', 'planned');
    for (i = 11; i < 20; i++) { var en = enrol('P-' + i, ['LRN-03', 'LRN-09', 'LRN-06', 'LRN-07'][i % 4], i % 3 === 0 ? 'completed' : 'planned'); if (i % 3 === 0) { en.completedAt = ago(10); } }
    S.interventions = [{ id: 'INT-01', title: 'Strategic design series', owner: 'Raj Mehta', skills: ['SK-03', 'SK-07'], format: 'Workshop series', status: 'planned', start: ahead(30), learningItemId: 'LRN-03', rationale: 'Aggregated gaps show Designing strategically and Leading design below expectation.', participants: 0 }];
    S.imports = [
      { id: 'IMP-01', personId: 'P-14', field: 'Role', from: 'Service designer', to: 'Senior service designer', source: 'HR directory (mock)', at: ago(12), effective: ago(12), note: 'Existing assessment attempts keep the role and framework version used at the time.' },
      { id: 'IMP-02', personId: 'P-12', field: 'Team', from: 'Casework', to: 'Data and Insight', source: 'HR directory (mock)', at: ago(4), effective: ago(4), note: '' },
      { id: 'IMP-03', personId: 'P-17', field: 'Grade', from: '(missing)', to: 'Grade 7', source: 'HR directory (mock)', at: ago(1), effective: ago(1), note: 'Source value was missing; local exception applied.', conflict: true }
    ];
    S.integrations = [
      { id: 'IG-1', name: 'Identity provider (Entra ID, mocked)', kind: 'simulated', status: 'healthy', lastSync: ago(0.02), note: 'Demo persona switcher stands in for sign in' },
      { id: 'IG-2', name: 'HR directory adapter (mock)', kind: 'simulated', status: 'degraded', lastSync: ago(1.2), note: '1 record with missing grade' },
      { id: 'IG-3', name: 'Central reporting API (mock)', kind: 'simulated', status: 'healthy', lastSync: ago(0.5), note: 'Receives aggregated data only' },
      { id: 'IG-4', name: 'Learning platform (system of record TBC)', kind: 'manual', status: 'healthy', lastSync: ago(7), note: 'Catalogue maintained here for the prototype' }
    ];
    S.notifications = [{ id: 'NOT-1', recipient: 'P-01', trigger: 'assessment.outcome.published', status: 'delivered (simulated)', at: ago(6) }, { id: 'NOT-2', recipient: 'P-04', trigger: 'review.assigned', status: 'delivered (simulated)', at: ago(8) }];
    audit('Colin Reed', 'Opened assessment round', 'CYC-001'); audit('Raj Mehta', 'Published framework', 'FW-2'); audit('Grace Lin', 'Published outcome', 'ATT-007'); audit('Zoe Hart', 'Changed reporting threshold', 'minCohort=5');
    event('framework.published', 'FW-2'); event('assessment.round.opened', 'CYC-001'); event('assessment.outcome.published', 'ATT-001');
    localStorage.setItem(KEY, JSON.stringify(S)); return S;
  }
  function load() { try { var d = JSON.parse(localStorage.getItem(KEY)); if (d && d.version === 1 && d.people) { S = d; return S; } } catch (e) { /* reseed */ } return seed(); }
  function save() { localStorage.setItem(KEY, JSON.stringify(S)); }
  load();

  var CURRENT_KEY = 'people-capability-persona';
  window.PEO = {
    get: function () { return S; }, save: save, reset: function () { localStorage.removeItem(KEY); localStorage.removeItem(CURRENT_KEY); seed(); }, uid: uid, clone: clone,
    FINAL_SCORES: FINAL_SCORES, SCORE_LABELS: SCORE_LABELS, ROLES: ROLES, ATTEMPT_STATUS: ATTEMPT_STATUS, SKILLS: SKILLS,
    person: person, roleProfile: roleProfile, framework: fw, byId: byId,
    currentFramework: function () { return S.frameworks.filter(function (f) { return f.status === 'published'; }).sort(function (a, b) { return b.version - a.version; })[0]; },
    skill: function (frameworkId, skillId) { return fw(frameworkId).skills.filter(function (s) { return s.id === skillId; })[0]; },
    // Persona switcher: defaults to a staff persona per prototype entry.
    me: function () { var id = localStorage.getItem(CURRENT_KEY) || 'P-01'; return person(id) || person('P-01'); },
    setMe: function (id) { localStorage.setItem(CURRENT_KEY, id); },
    personas: function () { return S.people.filter(function (p) { return p.id <= 'P-10' || p.id === 'P-11'; }); },
    attemptReviews: attemptReviews, recomputeStatus: recomputeStatus, submitAttempt: submitAttempt, submitReview: submitReview, moderate: moderate, publishOutcome: publishOutcome, overall: overall,
    latestSelf: latestSelf, formalLevel: formalLevel, gap: gap, recommend: recommend, dismiss: dismiss, createGoal: createGoal, enrol: enrol, completeLearning: completeLearning, recordSelf: recordSelf,
    aggregate: aggregate, reportPreview: reportPreview, audit: audit, event: event, ago: ago, ahead: ahead, DAY: DAY
  };
})();
