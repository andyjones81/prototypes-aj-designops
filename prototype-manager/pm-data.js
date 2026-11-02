/* Prototype Manager demo data and mock providers: window.PM.
   Everything is simulated and stored only in this browser (localStorage 'prototype-manager-v1'). No GitHub or Azure call is ever made.
   Providers are explicit interfaces (GitHubProvider, AzureProvider, ServiceLookup) with deterministic mock implementations,
   so they can later be replaced with a GitHub App client, Azure resource-management client and service register API. */
(function () {
  'use strict';
  var KEY = 'prototype-manager-v1', BASE = Date.parse('2026-11-02T13:00:00.000Z'), S = null;
  var ORG = 'example-dfe-prototypes';
  var STEPS = [
    { id: 'validate', label: 'Validate request' }, { id: 'record', label: 'Create prototype record' }, { id: 'repo', label: 'Create GitHub repository' },
    { id: 'seed', label: 'Seed template' }, { id: 'workflow', label: 'Configure deployment workflow' }, { id: 'azure', label: 'Provision Azure hosting' },
    { id: 'deploy', label: 'Deploy' }, { id: 'health', label: 'Run health check' }, { id: 'ready', label: 'Ready' }];
  var ROLE_LABEL = { owner: 'Designer (owner)', contributor: 'Contributor', researcher: 'Researcher', lead: 'Team lead', designops: 'DesignOps administrator', platform: 'Platform administrator' };

  function iso(ms) { return new Date(ms).toISOString(); }
  function ago(min) { return iso(BASE - min * 60000); }
  function dateAhead(days) { return iso(BASE + days * 86400000).slice(0, 10); }
  function pad(n, w) { return ('0000' + n).slice(-w); }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function sha(seed) { return (('00000000' + hash(seed).toString(16)).slice(-8) + ('00000000' + hash(seed + '#').toString(16)).slice(-8)).slice(0, 7); }
  function stamp() { S.clock += 60000; return iso(S.clock); }
  function today() { return iso(S.clock).slice(0, 10); }
  function nid(kind) { S.seq[kind] = (S.seq[kind] || 0) + 1; return kind + '-' + pad(S.seq[kind], 4); }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable */ } }
  function fail(msg, extra) { var r = { ok: false, error: msg }; if (extra) for (var k in extra) r[k] = extra[k]; return r; }
  function resPath(rg, app) { return '/subscriptions/demo-0000/resourceGroups/' + rg + '/providers/Microsoft.Web/sites/' + app; }

  /* ---------- Mock providers (explicit interfaces) ---------- */
  var INTERFACES = {
    GitHubProvider: ['createRepository', 'seedTemplate', 'configureWorkflow', 'pushCommit', 'cloneUrl', 'verifyOrganisation', 'checkConnection'],
    AzureProvider: ['ensureAppService', 'deploy', 'healthCheck', 'removeResources', 'checkConnection'],
    ServiceLookup: ['search', 'get']
  };
  var GitHubProvider = {
    label: 'Demo: simulated GitHub', live: false,
    knownOrganisations: ['example-dfe-prototypes', 'example-dfe-sandbox', 'example-dfe-research'],
    createRepository: function (o) { // idempotent by organisation/name
      var key = o.org + '/' + o.name, hit = S.ledger.repos[key];
      if (hit) return hit.protoId === o.protoId ? { ok: true, created: false, repoId: hit.id, key: key } : { ok: false, error: 'A repository named ' + key + ' already exists for another prototype.' };
      S.ledger.repos[key] = { id: 'repo-' + sha(key), protoId: o.protoId, createdAt: S.clock };
      return { ok: true, created: true, repoId: S.ledger.repos[key].id, key: key };
    },
    seedTemplate: function () { return { ok: true }; },
    configureWorkflow: function () { return { ok: true }; },
    pushCommit: function (o) { return { sha: sha(o.protoId + ':' + (++S.counters.commit)) }; },
    cloneUrl: function (r) { return 'https://github.example/' + r.org + '/' + r.name + '.git'; },
    verifyOrganisation: function (org) { return this.knownOrganisations.indexOf(org) > -1 ? { ok: true } : { ok: false, error: 'The GitHub App is not installed on "' + org + '".' }; },
    checkConnection: function () { var c = S.connections.github; return { name: 'GitHub App (example-prototype-manager)', status: c.degraded ? 'Degraded' : 'Connected', detail: c.degraded ? 'Webhook deliveries are delayed (simulated).' : 'Installed on 3 organisations with contents, actions and metadata permissions only.', lastCheck: c.lastCheck }; }
  };
  var AzureProvider = {
    label: 'Demo: simulated Azure', live: false,
    ensureAppService: function (o) { // idempotent by app name
      var hit = S.ledger.resources[o.name];
      if (hit) return hit.protoId === o.protoId ? { ok: true, created: false, resourceId: hit.id } : { ok: false, error: 'App name ' + o.name + ' is already used.' };
      S.ledger.resources[o.name] = { id: resPath(o.rg, o.name), protoId: o.protoId, createdAt: S.clock };
      return { ok: true, created: true, resourceId: S.ledger.resources[o.name].id };
    },
    deploy: function () { return { ok: true }; },
    healthCheck: function () { return { ok: true, status: 200 }; },
    removeResources: function (name) { if (S.ledger.resources[name]) S.ledger.resources[name].removed = true; return { ok: true }; },
    checkConnection: function () { var c = S.connections.azure; return { name: 'Azure subscription (demo-prototypes, UK South)', status: c.degraded ? 'Degraded' : 'Connected', detail: c.degraded ? 'Resource manager latency is high (simulated).' : 'Federated identity (OIDC) available. Quota available in UK South.', lastCheck: c.lastCheck }; }
  };
  var ServiceLookup = {
    label: 'Demo: read-only copy of the shared service register',
    all: function () { return (window.ECO && ECO.get().services) || []; },
    search: function (q) { q = String(q || '').toLowerCase(); return this.all().filter(function (s) { return !q || (s.name + ' ' + s.serviceId + ' ' + s.workId + ' ' + s.team).toLowerCase().indexOf(q) > -1; }); },
    get: function (id) { return this.all().filter(function (s) { return s.serviceId === id; })[0] || null; }
  };

  /* ---------- Seed ---------- */
  var STAGES = {
    ok: ['done', 'done', 'done'], build: ['running', 'pending', 'pending'], queued: ['pending', 'pending', 'pending'], deploying: ['done', 'running', 'pending'],
    failbuild: ['failed', 'pending', 'pending'], faildeploy: ['done', 'failed', 'pending'], failhealth: ['done', 'done', 'failed']
  };
  var ERRORS = {
    failbuild: 'Build failed: 2 automated tests failed in the eligibility route (npm test exited with code 1). Nothing was deployed.',
    faildeploy: 'Azure deployment failed: the zip package could not be unpacked on the App Service (simulated). The live prototype was not changed.',
    failhealth: 'Health check failed: /healthcheck returned HTTP 500 after deployment (simulated).'
  };
  function derive(d) {
    var b = d.stages.build, dp = d.stages.deploy, h = d.stages.health;
    if (d.status === 'Cancelled') { d.ciResult = 'Not started'; d.health = 'Not checked'; return d; }
    d.status = (b === 'failed' || dp === 'failed' || h === 'failed') ? 'Failed' : h === 'done' ? 'Healthy' : b === 'running' ? 'Building' : (b === 'done') ? 'Deploying' : 'Queued';
    d.ciResult = b === 'failed' ? 'Failed' : b === 'done' ? 'Passed' : b === 'running' ? 'Running' : 'Not started';
    d.health = h === 'done' ? 'Passed' : h === 'failed' ? 'Failed' : h === 'running' ? 'Checking' : 'Not checked';
    return d;
  }
  function mkDep(protoId, sh, branch, trigger, kind, minsAgo, actor) {
    var d = { id: nid('DEP'), prototypeId: protoId, commitSha: sh, branch: branch, trigger: trigger, actor: actor || '', stages: { build: STAGES[kind][0], deploy: STAGES[kind][1], health: STAGES[kind][2] },
      queuedAt: ago(minsAgo), startedAt: kind === 'queued' ? null : ago(minsAgo - 1), finishedAt: null, errorSummary: ERRORS[kind] || '', runId: 'run-' + sha(protoId + sh + minsAgo) };
    derive(d); if (d.status === 'Healthy' || d.status === 'Failed') d.finishedAt = ago(Math.max(0, minsAgo - 4)); return d;
  }
  function buildJob(doneUpTo, failIdx, finishedMin) {
    var steps = STEPS.map(function (s, i) { var st = i < doneUpTo ? 'Succeeded' : (i === failIdx ? 'Failed' : 'Pending'); return { id: s.id, status: st, attempts: i < doneUpTo || i === failIdx ? 1 : 0, at: st === 'Pending' ? null : ago(finishedMin - i), error: '' }; });
    if (failIdx != null) steps[failIdx].error = 'AZ-TIMEOUT: Azure did not confirm the App Service in time. The resource may already exist.';
    return { id: nid('JOB'), correlationId: 'corr-' + sha('job' + finishedMin + doneUpTo), steps: steps, attempt: 1, failAt: null, repoCalls: doneUpTo > 2 ? 1 : 0, resourceCalls: doneUpTo > 5 || failIdx === 5 ? 1 : 0 };
  }

  function seedProto(o) {
    var id = 'PRT-' + pad(o.n, 4), svc = o.svc ? ServiceLookup.get(o.svc) : null;
    var repoName = o.slug, org = ORG, appName = 'app-proto-' + o.slug;
    var repoMade = o.status !== 'Draft';
    var commits = (o.commits || []).map(function (c, i) { return { sha: c[3] || sha(id + i + c[0]), message: c[0], author: c[1], at: ago(c[2]), branch: 'main' }; });
    var p = {
      id: id, name: o.name, slug: o.slug, purpose: o.purpose, status: o.status, templateId: o.tpl, templateVersion: o.tpl === 'tpl-dfe-kit' ? '3.2.0' : '13.1.0', ownerId: o.owner || null, previousOwnerId: o.prevOwner || null,
      team: o.team, contributors: o.contrib || [], serviceId: o.svc || null, productId: svc ? svc.productId : null, workId: svc ? svc.workId : null, standaloneReason: o.standalone || '',
      createdAt: o.created, updatedAt: o.updated, lastActivityAt: o.updated, reviewAt: o.review, tags: o.tags || [], sharing: o.sharing || 'Internal only', accessMode: o.sharing ? 'research' : 'internal',
      repo: { org: org, name: repoName, url: 'https://github.example/' + org + '/' + repoName, cloneUrl: 'https://github.example/' + org + '/' + repoName + '.git', defaultBranch: 'main', visibility: 'Private (internal)', created: repoMade, state: o.repoState || (repoMade ? 'Active' : 'Not created'),
        commits: commits, branches: repoMade ? [{ name: 'main', protected: true, sha: commits[0] ? commits[0].sha : '' }].concat(o.branches || []) : [], prs: o.prs || [] },
      env: { name: 'Live research environment', appName: appName, resourceGroup: 'rg-proto-' + o.slug, region: 'UK South', plan: 'F1', costCategory: 'Free', runtime: 'Node.js 20 LTS (Linux)', url: 'https://' + appName + '.azurewebsites.example', created: o.status !== 'Draft',
        state: o.envState || 'Running', health: o.health || 'Healthy', deployedCommit: null, resourceId: null, accessPolicy: 'Password protection on, production mode on', optionalPreviews: 'Not enabled' },
      deployments: [], lastKnownGood: null, accessGrants: [], repoEvents: [], job: null, activity: [], archiveRequest: null, transferRequest: null, profileId: 'dev-low', password: o.status === 'Active' ? { setBy: 'Prototype Manager', setAt: ago(60 * 24 * 20), expiresAt: null, hash: sha('demo-password'), demo: true } : null
    };
    (o.deps || []).forEach(function (d) { var c = commits[d[0]]; p.deployments.push(mkDep(id, c.sha, 'main', d[3] || 'Push to main', d[1], d[2], c.author)); });
    p.deployments.forEach(function (d) { if (!p.env.deployedCommit && d.stages.deploy === 'done') p.env.deployedCommit = d.commitSha; if (!p.lastKnownGood && d.status === 'Healthy') p.lastKnownGood = d.commitSha; });
    if (p.env.created) {
      var removed = o.envState === 'Removed';
      S.ledger.resources[appName] = { id: resPath(p.env.resourceGroup, appName), protoId: id, createdAt: BASE, removed: removed };
      if (removed) p.env.health = 'Not applicable'; else p.env.resourceId = S.ledger.resources[appName].id;
    }
    if (repoMade) S.ledger.repos[org + '/' + repoName] = { id: 'repo-' + sha(org + '/' + repoName), protoId: id, createdAt: BASE };
    if (o.job) p.job = o.job;
    p.activity = (o.activity || []).map(function (a) { return { at: ago(a[0]), actor: a[1], kind: a[2], text: a[3] }; });
    (o.grants || []).forEach(function (g) { p.accessGrants.push({ id: nid('GRT'), kind: g[0], recipientId: g[1] || null, recipientLabel: g[2], purpose: g[3], role: 'Research viewer', grantedBy: g[4], grantedAt: ago(g[5]), expiresAt: g[6], revokedAt: g[7] ? ago(g[7]) : null }); });
    (o.events || []).forEach(function (e) { var c = commits[e[0]]; p.repoEvents.push({ id: nid('EVT'), deliveryId: 'dlv-' + sha(id + c.sha), type: e[1], actor: e[2], commitSha: c.sha, receivedAt: ago(e[3]), processedAt: ago(e[3] - 1), outcome: 'Processed', duplicates: 0 }); });
    return p;
  }

  function seed() {
    S = { v: 1, clock: BASE, persona: 'u-amelia', seq: { PRT: 8 }, counters: { commit: 100 }, ledger: { repos: {}, resources: {} }, audit: [], integrationEvents: [], notifications: [], wizard: null,
      connections: { github: { lastCheck: ago(35), degraded: false }, azure: { lastCheck: ago(35), degraded: false } } };
    S.people = [
      { id: 'u-amelia', name: 'Amelia Hart', role: 'owner', team: 'Schools Digital' }, { id: 'u-ben', name: 'Ben Clarke', role: 'contributor', team: 'Schools Digital' },
      { id: 'u-rosa', name: 'Rosa Mendes', role: 'researcher', team: 'User research' }, { id: 'u-tariq', name: 'Tariq Khan', role: 'lead', team: 'Schools Digital' },
      { id: 'u-nadia', name: 'Nadia Okoye', role: 'designops', team: 'DesignOps' }, { id: 'u-owen', name: 'Owen Price', role: 'platform', team: 'Platform engineering' },
      { id: 'u-dev', name: 'Dev Patel', role: 'owner', team: 'Teaching Workforce' }, { id: 'u-ines', name: 'Ines Walker', role: 'owner', team: 'Early Years Digital' },
      { id: 'u-kofi', name: 'Kofi Mensah', role: 'researcher', team: 'User research' }];
    S.personas = ['u-amelia', 'u-ben', 'u-rosa', 'u-tariq', 'u-nadia', 'u-owen'];
    S.templates = [
      { id: 'tpl-govuk-kit', name: 'GOV.UK Prototype Kit', framework: 'Node.js', versions: ['13.1.0', '13.0.2', '12.4.0'], pinned: '13.1.0', runtime: 'Node.js 20 LTS', buildCommand: 'npm ci && npm test', startCommand: 'npm start', hosting: 'Azure App Service (Linux)', healthCheck: '/healthcheck', licence: 'MIT', enabled: true, status: 'Approved', note: 'Server-rendered Node.js application. Needs a Node.js-capable host.' },
      { id: 'tpl-dfe-kit', name: 'GOV.UK Prototype Kit with DfE branding', framework: 'Node.js', versions: ['3.2.0', '3.1.1'], pinned: '3.2.0', runtime: 'Node.js 20 LTS', buildCommand: 'npm ci && npm test', startCommand: 'npm start', hosting: 'Azure App Service (Linux)', healthCheck: '/healthcheck', licence: 'MIT', enabled: true, status: 'Approved', note: 'Approved DfE theme, components and example pages.' },
      { id: 'tpl-aspnet', name: 'ASP.NET Core', framework: '.NET', versions: ['1.0.0'], pinned: '1.0.0', runtime: '.NET 10', buildCommand: 'dotnet build && dotnet test', startCommand: 'dotnet run', hosting: 'Azure App Service (Linux)', healthCheck: '/health', licence: 'MIT', enabled: true, status: 'Approved', note: 'GOV.UK Frontend for ASP.NET Core (Razor) on .NET 10, with DfE components.' }];
    S.policy = {
      regions: ['UK South'], regionOptions: ['UK South', 'UK West', 'North Europe'], defaultRegion: 'UK South',
      profiles: [{ id: 'dev-low', label: 'Free hosting plan', plan: 'F1', category: 'Free' }],
      expiry: { defaultDays: 90, maxDays: 180, researchMaxDays: 28 }, quotas: { perTeam: 5, estate: 40 }, approvedOrgs: ['example-dfe-prototypes', 'example-dfe-sandbox'], allowResearchSharing: true };

    S.prototypes = [
      seedProto({ n: 1, name: 'School trip booking journey', slug: 'school-trip-booking', purpose: 'Test the parent booking flow for school trips with parents.', status: 'Active', tpl: 'tpl-dfe-kit', owner: 'u-amelia', team: 'Schools Digital', svc: 'SVC-001', contrib: ['u-ben'],
        created: ago(60 * 24 * 40), updated: ago(190), review: '2027-01-15', tags: ['booking', 'research'], sharing: 'Controlled research sharing',
        commits: [['Update confirmation page content', 'Amelia Hart', 190, 'a13d9f2'], ['Add payment summary page', 'Ben Clarke', 60 * 26], ['Fix back links on trip details', 'Amelia Hart', 60 * 50], ['Initial commit from template', 'Prototype Manager', 60 * 24 * 40]],
        deps: [[0, 'ok', 185], [1, 'ok', 60 * 26], [2, 'ok', 60 * 50]], branches: [{ name: 'content/confirmation-wording', protected: false, sha: sha('b1') }],
        events: [[0, 'push', 'Amelia Hart', 190], [1, 'push', 'Ben Clarke', 60 * 26]],
        grants: [['research', 'u-rosa', 'Rosa Mendes (user research)', 'Round 3 usability sessions', 'Amelia Hart', 60 * 24 * 3, '2026-11-20', 0], ['research', null, 'Participant group B', 'Round 2 sessions', 'Amelia Hart', 60 * 24 * 20, '2026-11-30', 60 * 24 * 12]],
        activity: [[190, 'Amelia Hart', 'repo', 'Pushed a13d9f2 to main'], [185, 'GitHub Actions', 'workflow', 'Deployment of a13d9f2 healthy'], [60 * 24 * 3, 'Amelia Hart', 'user', 'Created research access for Rosa Mendes, expires 20 Nov 2026'], [60 * 24 * 12, 'Amelia Hart', 'user', 'Revoked research access for Participant group B']],
        job: buildJob(9, null, 60 * 24 * 40) }),
      seedProto({ n: 2, name: 'Trip payment and consent', slug: 'trip-payment-consent', purpose: 'Explore payment and consent patterns for school trips.', status: 'Active', tpl: 'tpl-govuk-kit', owner: 'u-amelia', team: 'Schools Digital', svc: 'SVC-001', contrib: [],
        created: ago(60 * 24 * 21), updated: ago(4), review: '2026-11-10', tags: ['payment'],
        commits: [['Add consent checkbox variant', 'Amelia Hart', 5], ['Rework payment error messages', 'Amelia Hart', 60 * 30], ['Initial commit from template', 'Prototype Manager', 60 * 24 * 21]],
        deps: [[0, 'build', 4], [1, 'ok', 60 * 30]], events: [[0, 'push', 'Amelia Hart', 5]],
        activity: [[5, 'Amelia Hart', 'repo', 'Pushed to main'], [4, 'GitHub Actions', 'workflow', 'Build started'], [60 * 30, 'GitHub Actions', 'workflow', 'Deployment healthy']], job: buildJob(9, null, 60 * 24 * 21) }),
      seedProto({ n: 3, name: 'Teacher training course comparison', slug: 'teacher-training-comparison', purpose: 'Compare course listing layouts for applicants.', status: 'Active', tpl: 'tpl-dfe-kit', owner: 'u-dev', team: 'Teaching Workforce', svc: 'SVC-002', contrib: [],
        created: ago(60 * 24 * 70), updated: ago(60 * 5), review: '2026-10-20', tags: ['search'],
        commits: [['Add provider filter', 'Dev Patel', 60 * 5], ['Add sort by distance', 'Dev Patel', 60 * 24 * 3], ['Initial commit from template', 'Prototype Manager', 60 * 24 * 70]],
        deps: [[0, 'failbuild', 60 * 5], [1, 'ok', 60 * 24 * 3]], prs: [{ id: 14, title: 'Provider filter experiment', branch: 'feature/provider-filter', author: 'Dev Patel', state: 'open', at: ago(60 * 5) }],
        events: [[0, 'push', 'Dev Patel', 60 * 5]],
        activity: [[60 * 5, 'GitHub Actions', 'workflow', 'Build failed for Add provider filter'], [60 * 5 + 2, 'Dev Patel', 'repo', 'Pushed to main']], job: buildJob(9, null, 60 * 24 * 70) }),
      seedProto({ n: 4, name: 'Early years funding claim', slug: 'early-years-funding-claim', purpose: 'Claim flow concept for early years providers.', status: 'Suspended', tpl: 'tpl-govuk-kit', owner: null, prevOwner: 'u-ines', team: 'Early Years Digital', svc: 'SVC-003', envState: 'Stopped', health: 'Unknown',
        created: ago(60 * 24 * 120), updated: ago(60 * 24 * 79), review: '2026-12-01', tags: ['claims'],
        commits: [['Tidy claim summary', 'Ines Walker', 60 * 24 * 80], ['Initial commit from template', 'Prototype Manager', 60 * 24 * 120]], deps: [[0, 'ok', 60 * 24 * 80]],
        activity: [[60 * 24 * 79, 'Nadia Okoye', 'platform', 'Suspended: previous owner left the team, no owner assigned']], job: buildJob(9, null, 60 * 24 * 120) }),
      seedProto({ n: 5, name: 'Schools data explorer', slug: 'schools-data-explorer', purpose: 'Early concept for browsing school reference data.', status: 'Archived', tpl: 'tpl-govuk-kit', owner: 'u-ines', team: 'Digital insight', svc: 'SVC-004', envState: 'Removed', repoState: 'Archived (read-only)',
        created: ago(60 * 24 * 200), updated: ago(60 * 24 * 45), review: '2026-09-01', tags: ['data'],
        commits: [['Add school search results', 'Ines Walker', 60 * 24 * 60], ['Initial commit from template', 'Prototype Manager', 60 * 24 * 200]], deps: [[0, 'ok', 60 * 24 * 60]],
        activity: [[60 * 24 * 45, 'Nadia Okoye', 'platform', 'Archived: source and metadata preserved, Azure hosting removed']], job: buildJob(9, null, 60 * 24 * 200) }),
      seedProto({ n: 6, name: 'Back to school campaign pages', slug: 'back-to-school-campaign', purpose: 'Campaign page concepts to encourage attendance.', status: 'Decommissioned', tpl: 'tpl-govuk-kit', owner: 'u-dev', team: 'Portfolio office', svc: 'SVC-005', envState: 'Removed', repoState: 'Archived (read-only)',
        created: ago(60 * 24 * 260), updated: ago(60 * 24 * 100), review: '2026-06-30', tags: ['campaign'],
        commits: [['Final copy edits', 'Dev Patel', 60 * 24 * 110], ['Initial commit from template', 'Prototype Manager', 60 * 24 * 260]], deps: [[0, 'ok', 60 * 24 * 110]],
        activity: [[60 * 24 * 100, 'Owen Price', 'platform', 'Decommissioned: hosting deleted, access removed, repository archived']], job: buildJob(9, null, 60 * 24 * 260) }),
      seedProto({ n: 7, name: 'Attendance dashboard concept', slug: 'attendance-dashboard-concept', purpose: 'Sketch a dashboard idea before any service work is raised.', status: 'Draft', tpl: 'tpl-dfe-kit', owner: 'u-amelia', team: 'Schools Digital', svc: null,
        standalone: 'Early concept for a possible future service. No work item exists yet.', created: ago(60 * 20), updated: ago(60 * 20), review: dateAhead(60), tags: ['concept'],
        activity: [[60 * 20, 'Amelia Hart', 'user', 'Saved as draft. Provisioning has not started.']] }),
      seedProto({ n: 8, name: 'Early years eligibility checker', slug: 'early-years-eligibility-checker', purpose: 'Test an eligibility checker for early years entitlements.', status: 'Failed', tpl: 'tpl-govuk-kit', owner: 'u-amelia', team: 'Schools Digital', svc: 'SVC-006', envState: 'Provisioning failed', health: 'Unknown',
        created: ago(60 * 3), updated: ago(60 * 2), review: dateAhead(90), tags: ['eligibility'], commits: [['Initial commit from template', 'Prototype Manager', 60 * 3 - 4]],
        activity: [[60 * 2, 'Prototype Manager', 'platform', 'Provisioning failed at Provision Azure hosting']], job: buildJob(5, 5, 60 * 3) })
    ];
    var ad = function (actor, action, id, result, detail, minsAgo) { S.audit.push({ id: nid('AUD'), at: ago(minsAgo), actorId: actor.id, actorName: actor.name, action: action, entityType: 'prototype', entityId: id, result: result, detail: detail || '' }); };
    var P = function (id) { return S.people.filter(function (x) { return x.id === id; })[0]; };
    ad(P('u-amelia'), 'prototype.created', 'PRT-0001', 'Success', 'Created from DfE-branded kit', 60 * 24 * 40);
    ad(P('u-amelia'), 'access.research.created', 'PRT-0001', 'Success', 'Research access for Rosa Mendes, expires 2026-11-20', 60 * 24 * 3);
    ad(P('u-nadia'), 'prototype.suspended', 'PRT-0004', 'Success', 'Authorised by Nadia Okoye: owner left the team', 60 * 24 * 79);
    ad(P('u-nadia'), 'prototype.archived', 'PRT-0005', 'Success', 'Authorised by Nadia Okoye: source preserved, hosting removed', 60 * 24 * 45);
    ad(P('u-owen'), 'prototype.decommissioned', 'PRT-0006', 'Success', 'Authorised by Owen Price: impact check passed, repository archived', 60 * 24 * 100);
    ad(P('u-amelia'), 'prototype.provisioning.failed', 'PRT-0008', 'Failure', 'Failed at Provision Azure hosting (AZ-TIMEOUT)', 60 * 2);
    S.audit.sort(function (a, b) { return a.at < b.at ? 1 : -1; });
    var ev = function (p, from, to, min, svc, work) { S.integrationEvents.push({ id: nid('EVT'), type: 'prototype.status.changed', at: ago(min), prototypeId: p, from: from, to: to, serviceId: svc, workId: work }); };
    ev('PRT-0004', 'Active', 'Suspended', 60 * 24 * 79, 'SVC-003', null); ev('PRT-0005', 'Active', 'Archived', 60 * 24 * 45, 'SVC-004', null); ev('PRT-0006', 'Archived', 'Decommissioned', 60 * 24 * 100, 'SVC-005', null); ev('PRT-0008', 'Provisioning', 'Failed', 60 * 2, 'SVC-006', null);
    S.integrationEvents.sort(function (a, b) { return a.at < b.at ? 1 : -1; });
    var nt = function (who, min, type, text, pid) { S.notifications.push({ id: nid('NTF'), personId: who, at: ago(min), type: type, text: text, prototypeId: pid, read: false }); };
    nt('u-amelia', 2 * 60, 'Provisioning failed', 'Provisioning failed for Early years eligibility checker. Retry from the provisioning page.', 'PRT-0008');
    nt('u-amelia', 4, 'Deployment started', 'A deployment of Trip payment and consent is building.', 'PRT-0002');
    nt('u-amelia', 60 * 24, 'Access expiry', 'Research access for Rosa Mendes on School trip booking journey expires on 20 Nov 2026.', 'PRT-0001');
    nt('u-amelia', 60 * 24 * 2, 'Retirement review', 'Trip payment and consent is due for review on 10 Nov 2026.', 'PRT-0002');
    nt('u-dev', 5 * 60, 'Deployment failed', 'Deployment failed for Teacher training course comparison. The live prototype still runs the last known good commit.', 'PRT-0003');
    nt('u-dev', 60 * 24 * 13, 'Retirement review', 'Teacher training course comparison is past its review date.', 'PRT-0003');
    nt('u-rosa', 60 * 24, 'Access expiry', 'Your access to School trip booking journey ends on 20 Nov 2026.', 'PRT-0001');
    nt('u-tariq', 60 * 3, 'Provisioning failed', 'Early years eligibility checker (Schools Digital) failed provisioning.', 'PRT-0008');
    save();
  }

  /* ---------- Identity and permissions (enforced here, not just in the UI) ---------- */
  function person(id) { return S.people.filter(function (x) { return x.id === id; })[0] || null; }
  function proto(id) { return S.prototypes.filter(function (x) { return x.id === id; })[0] || null; }
  function grantActive(g) { return !g.revokedAt && g.expiresAt >= today(); }
  function hasViewerGrant(p, pid) { return p.accessGrants.some(function (g) { return g.recipientId === pid && grantActive(g); }); }
  function levelFor(pid, p) {
    var u = person(pid); if (!u || !p) return 'none';
    if (u.role === 'designops' || u.role === 'platform') return 'admin';
    if (u.role === 'researcher') return hasViewerGrant(p, pid) ? 'viewer' : 'none';
    if (p.ownerId === pid) return 'owner';
    if (u.role === 'lead' && u.team === p.team) return 'lead';
    if (p.contributors.indexOf(pid) > -1) return 'contributor';
    return hasViewerGrant(p, pid) ? 'viewer' : 'none';
  }
  var CAPS = { view: ['admin', 'owner', 'lead', 'contributor'], source: ['admin', 'owner', 'lead', 'contributor'], push: ['owner', 'contributor'], simulate: ['owner', 'contributor', 'admin'], manage: ['owner', 'admin'], accessView: ['owner', 'admin', 'lead'], viewer: ['admin', 'owner', 'lead', 'contributor', 'viewer'] };
  function can(pid, cap, p) { return !!p && !!CAPS[cap] && CAPS[cap].indexOf(levelFor(pid, p)) > -1; }
  function isAdmin(pid) { var u = person(pid); return !!u && (u.role === 'designops' || u.role === 'platform'); }
  function audit(actorId, action, entityId, result, detail, entityType) {
    var u = person(actorId) || { id: actorId || 'system', name: actorId || 'System' };
    S.audit.unshift({ id: nid('AUD'), at: stamp(), actorId: u.id, actorName: u.name, action: action, entityType: entityType || 'prototype', entityId: entityId || '', result: result || 'Success', detail: detail || '' });
  }
  function activity(p, actor, kind, text) { var t = stamp(); p.activity.unshift({ at: t, actor: actor, kind: kind, text: text }); p.lastActivityAt = t; p.updatedAt = t; }
  function setStatus(p, to) { var from = p.status; if (from === to) return; p.status = to; S.integrationEvents.unshift({ id: nid('EVT'), type: 'prototype.status.changed', at: stamp(), prototypeId: p.id, from: from, to: to, serviceId: p.serviceId, workId: p.workId }); }
  function notify(personId, type, text, pid) { if (personId) S.notifications.unshift({ id: nid('NTF'), personId: personId, at: stamp(), type: type, text: text, prototypeId: pid, read: false }); }
  function denied(actorId, action, id) { audit(actorId, 'access.denied', id, 'Denied', 'Attempted: ' + action); save(); return fail('You do not have access to do this.', { denied: true }); }
  function act(actorId, id, cap, fn) {
    var p = proto(id); if (!p) return fail('Prototype not found.');
    if (!can(actorId, cap, p)) return denied(actorId, cap + ' on ' + id, id);
    var r = fn(p, person(actorId)); save(); return r;
  }

  /* ---------- Derived values ---------- */
  function latestCommit(p) { return p.repo.commits[0] ? p.repo.commits[0].sha : null; }
  function deployedCommit(p) { return p.env.deployedCommit; }
  function latestDeployment(p) { return p.deployments[0] || null; }
  function inFlight(p) { return p.deployments.filter(function (d) { return d.status === 'Queued' || d.status === 'Building' || d.status === 'Deploying'; }); }
  function daysTo(dateStr) { return Math.round((Date.parse(dateStr + 'T00:00:00Z') - Date.parse(today() + 'T00:00:00Z')) / 86400000); }
  function isExpired(p) { return ['Archived', 'Decommissioned'].indexOf(p.status) < 0 && daysTo(p.reviewAt) < 0; }
  function isExpiring(p) { var d = daysTo(p.reviewAt); return ['Archived', 'Decommissioned'].indexOf(p.status) < 0 && d >= 0 && d <= 14; }
  function ownershipGap(p) { return !p.ownerId && ['Archived', 'Decommissioned'].indexOf(p.status) < 0; }
  function isInactive(p) { return ['Archived', 'Decommissioned', 'Draft'].indexOf(p.status) < 0 && (S.clock - Date.parse(p.lastActivityAt)) / 86400000 > 60; }
  function deploymentFailed(p) { var d = latestDeployment(p); return p.status === 'Active' && !!d && d.status === 'Failed'; }
  function deploymentFor(p, sh) { return p.deployments.filter(function (d) { return d.commitSha === sh; })[0] || null; }
  function statusLabel(p) { return p.status === 'Failed' ? 'Failed provisioning' : p.status; }
  function counts(p) {
    var repos = 0, res = 0; Object.keys(S.ledger.repos).forEach(function (k) { if (S.ledger.repos[k].protoId === p.id) repos++; });
    Object.keys(S.ledger.resources).forEach(function (k) { var r = S.ledger.resources[k]; if (r.protoId === p.id && !r.removed) res++; });
    return { repos: repos, resources: res };
  }

  /* ---------- Listing ---------- */
  function mine(pid) {
    var u = person(pid); if (!u) return [];
    return S.prototypes.filter(function (p) {
      if (u.role === 'researcher') return hasViewerGrant(p, pid) && p.status === 'Active';
      if (u.role === 'lead') return p.team === u.team || p.ownerId === pid;
      if (u.role === 'designops' || u.role === 'platform') return p.ownerId === pid;
      return p.ownerId === pid || p.contributors.indexOf(pid) > -1;
    });
  }
  function directory(pid) { var u = person(pid); return !u || u.role === 'researcher' ? [] : S.prototypes.filter(function (p) { return p.status !== 'Draft' || can(pid, 'view', p); }); }
  function all(pid) { return isAdmin(pid) ? S.prototypes : []; }
  function getPrototype(pid, id, cap) { var p = proto(id); if (!p) return { ok: false, notFound: true }; if (!can(pid, cap || 'view', p)) { denied(pid, 'open ' + (cap || 'view') + ' on ' + id, id); return { ok: false, denied: true }; } return { ok: true, proto: p }; }

  /* ---------- Creation wizard ---------- */
  function slugify(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40); }
  var STEP_OF = { templateId: 1, name: 2, slug: 2, purpose: 2, linkMode: 3, serviceId: 3, justification: 3, team: 4, ownerId: 4, contributors: 4, profile: 5, region: 5, accessMode: 5, org: 5, endDate: 5, integrations: 6 };
  function teamActiveCount(team) { return S.prototypes.filter(function (p) { return p.team === team && ['Archived', 'Decommissioned'].indexOf(p.status) < 0; }).length; }
  function slugTaken(slug, exceptId) {
    return S.prototypes.some(function (p) { return p.slug === slug && p.id !== exceptId; }) || Object.keys(S.ledger.repos).some(function (k) { return k.split('/')[1] === slug && S.ledger.repos[k].protoId !== exceptId; });
  }
  function validateCreate(d, opts) {
    opts = opts || {};
    var e = [], add = function (id, msg) { e.push({ id: id, msg: msg, step: STEP_OF[id.replace(/-\d+$/, '')] || 1 }); }, pol = S.policy;
    var tpl = S.templates.filter(function (t) { return t.id === d.templateId; })[0];
    if (!tpl) add('templateId-0', 'Select a template'); else if (!tpl.enabled) add('templateId-0', 'Select an approved template. ' + tpl.name + ' is not enabled');
    if (!String(d.name || '').trim()) add('name', 'Enter a prototype name'); else if (d.name.trim().length > 60) add('name', 'Prototype name must be 60 characters or fewer');
    var slug = d.slug || slugify(d.name);
    if (!slug) add('slug', 'Enter a slug'); else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length < 3 || slug.length > 40) add('slug', 'Slug must be 3 to 40 characters, using lower case letters, numbers and single hyphens');
    else if (!opts.skipSlug && slugTaken(slug, opts.selfId)) add('slug', 'The slug "' + slug + '" is already used by another repository. Choose a different slug');
    if (!String(d.purpose || '').trim()) add('purpose', 'Enter the purpose of the prototype');
    if (d.linkMode !== 'service' && d.linkMode !== 'standalone') add('linkMode-0', 'Choose whether this prototype links to a service or is standalone');
    else if (d.linkMode === 'service' && !ServiceLookup.get(d.serviceId)) add('serviceId', 'Select a service from the register');
    else if (d.linkMode === 'standalone' && String(d.justification || '').trim().length < 10) add('justification', 'Explain why this prototype is not linked to a service (at least 10 characters)');
    if (!d.team) add('team', 'Select the owning team');
    var owner = person(d.ownerId);
    if (!owner || owner.role === 'researcher') add('ownerId', 'Select an owner'); else if (d.team && owner.team !== d.team) add('ownerId', 'The owner must belong to the owning team');
    if (d.team && !opts.skipQuota && teamActiveCount(d.team) >= pol.quotas.perTeam) add('team', d.team + ' has reached its quota of ' + pol.quotas.perTeam + ' active prototypes. Archive one first or ask DesignOps for an exception');
    if (!pol.profiles.some(function (x) { return x.id === d.profile; })) add('profile', 'Select an environment profile');
    if (pol.regions.indexOf(d.region) < 0) add('region', 'Select a region allowed by policy');
    if (d.accessMode !== 'internal' && d.accessMode !== 'research') add('accessMode-0', 'Select an access mode'); else if (d.accessMode === 'research' && !pol.allowResearchSharing) add('accessMode-0', 'Research sharing is not approved by policy');
    if (pol.approvedOrgs.indexOf(d.org) < 0) add('org', 'Select an approved GitHub organisation');
    if (d.productType !== 'transactional' && (d.integrations || []).indexOf('satisfaction') > -1) add('integrations', 'User satisfaction is only available for transactional services. Remove it or change the product type');
    if (!opts.skipDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d.endDate || '')) add('endDate', 'Enter an end or review date as YYYY-MM-DD');
      else if (daysTo(d.endDate) <= 0) add('endDate', 'End or review date must be in the future');
      else if (daysTo(d.endDate) > pol.expiry.maxDays) add('endDate', 'End or review date must be within ' + pol.expiry.maxDays + ' days of today');
    }
    return e;
  }
  function plan(d) {
    var slug = d.slug || slugify(d.name), prof = S.policy.profiles.filter(function (x) { return x.id === d.profile; })[0] || S.policy.profiles[0];
    return [
      ['Prototype record', 'Prototype Manager', 'Metadata, ownership and review date'],
      ['GitHub repository', d.org + '/' + slug, 'Private to the organisation, seeded from the template'],
      ['GitHub Actions workflow', 'deploy.yml in ' + slug, 'Build, test, deploy and health check using federated identity'],
      ['Azure resource group', 'rg-proto-' + slug, d.region],
      ['App Service plan and web app', 'app-proto-' + slug, 'Free hosting plan (' + prof.plan + '), ' + d.region + ', ' + (S.templates.filter(function (t) { return t.id === d.templateId; })[0] || { runtime: 'Node.js' }).runtime + ' runtime, password protection on, production mode on'],
      ['Monitoring', 'Application Insights', 'Health check and diagnostics']
    ];
  }
  function newJob() { return { id: nid('JOB'), correlationId: 'corr-' + sha('job' + S.seq.JOB + S.clock), steps: STEPS.map(function (s) { return { id: s.id, status: 'Pending', attempts: 0, at: null, error: '' }; }), attempt: 1, failAt: null, repoCalls: 0, resourceCalls: 0 }; }
  function create(actorId, d) {
    var u = person(actorId); if (!u || ['owner', 'designops', 'platform'].indexOf(u.role) < 0) return denied(actorId, 'create prototype', '');
    var errs = validateCreate(d); if (errs.length) return fail('Fix the errors.', { errors: errs });
    var svc = d.linkMode === 'service' ? ServiceLookup.get(d.serviceId) : null, slug = d.slug || slugify(d.name), prof = S.policy.profiles.filter(function (x) { return x.id === d.profile; })[0], tpl = S.templates.filter(function (t) { return t.id === d.templateId; })[0];
    var id = nid('PRT'), t = stamp();
    var p = { id: id, name: d.name.trim(), slug: slug, purpose: d.purpose.trim(), status: 'Provisioning', templateId: tpl.id, templateVersion: tpl.pinned, ownerId: d.ownerId, previousOwnerId: null, team: d.team,
      contributors: (d.contributors || []).filter(function (c) { return c !== d.ownerId; }), serviceId: svc ? svc.serviceId : null, productId: svc ? svc.productId : null, workId: svc ? svc.workId : null,
      standaloneReason: svc ? '' : d.justification.trim(), createdAt: t, updatedAt: t, lastActivityAt: t, reviewAt: d.endDate, tags: String(d.tags || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean),
      sharing: d.accessMode === 'research' ? 'Controlled research sharing' : 'Internal only', accessMode: d.accessMode, profileId: prof.id,
      repo: { org: d.org, name: slug, url: 'https://github.example/' + d.org + '/' + slug, cloneUrl: 'https://github.example/' + d.org + '/' + slug + '.git', defaultBranch: 'main', visibility: 'Private (internal)', created: false, state: 'Not created', commits: [], branches: [], prs: [] },
      env: { name: 'Live research environment', appName: 'app-proto-' + slug, resourceGroup: 'rg-proto-' + slug, region: d.region, plan: prof.plan, costCategory: prof.category, runtime: tpl.runtime + ' (Linux)', url: 'https://app-proto-' + slug + '.azurewebsites.example', created: false, state: 'Not created', health: 'Unknown', deployedCommit: null, resourceId: null, accessPolicy: 'Password protection on, production mode on', optionalPreviews: 'Not enabled' },
      features: { productType: d.productType || '', auth: d.auth || [], patterns: d.patterns || [], integrations: d.integrations || [], publisher: d.publisher || [], branding: d.branding || 'govuk' },
      deployments: [], lastKnownGood: null, accessGrants: [], repoEvents: [], archiveRequest: null, transferRequest: null, activity: [], job: null };
    p.job = newJob(); S.prototypes.unshift(p);
    activity(p, u.name, 'user', 'Created prototype from ' + tpl.name + '. Provisioning job queued.');
    audit(actorId, 'prototype.created', id, 'Success', 'From ' + tpl.name + ' ' + tpl.pinned + '; ' + (svc ? 'linked to ' + svc.serviceId : 'standalone'));
    S.integrationEvents.unshift({ id: nid('EVT'), type: 'prototype.status.changed', at: stamp(), prototypeId: id, from: null, to: 'Provisioning', serviceId: p.serviceId, workId: p.workId });
    S.wizard = null; save(); return { ok: true, id: id };
  }

  /* ---------- Provisioning (retryable and idempotent) ---------- */
  function nextStep(p) { return p.job ? p.job.steps.filter(function (s) { return s.status !== 'Succeeded'; })[0] || null : null; }
  function stepLabel(id) { return STEPS.filter(function (s) { return s.id === id; })[0].label; }
  function draftErrors(p) {
    return validateCreate({ templateId: p.templateId, name: p.name, slug: p.slug, purpose: p.purpose, linkMode: p.serviceId ? 'service' : 'standalone', serviceId: p.serviceId, justification: p.standaloneReason, team: p.team, ownerId: p.ownerId,
      profile: p.profileId || 'dev-low', region: p.env.region, accessMode: p.accessMode || 'internal', org: p.repo.org, endDate: p.reviewAt }, { selfId: p.id, skipQuota: true, skipDate: true });
  }
  function execStep(p, step) {
    var j = p.job, inj = j.failAt === step.id, r, sh;
    var boom = function (code, msg) { return { ok: false, code: code, msg: msg }; };
    if (inj && ['repo', 'azure'].indexOf(step.id) < 0) return boom('INJECTED', 'Simulated failure injected at this step.');
    switch (step.id) {
      case 'validate': { var errs = draftErrors(p); if (errs.length) return boom('VALIDATION', errs[0].msg); break; }
      case 'record': break;
      case 'repo': j.repoCalls++; r = GitHubProvider.createRepository({ org: p.repo.org, name: p.repo.name, protoId: p.id }); if (!r.ok) return boom('GH-CONFLICT', r.error);
        p.repo.created = true; p.repo.state = 'Active'; step.note = r.created ? 'Created repository ' + r.key : 'Repository ' + r.key + ' already existed from the earlier attempt and was reused. No duplicate was created.';
        if (inj) return boom('GH-TIMEOUT', 'GitHub did not respond in time. The repository may already have been created.'); break;
      case 'seed': GitHubProvider.seedTemplate(); if (!p.repo.commits.length) { sh = GitHubProvider.pushCommit({ protoId: p.id }).sha; p.repo.commits.unshift({ sha: sh, message: 'Initial commit from template', author: 'Prototype Manager', at: stamp(), branch: 'main' }); p.repo.branches = [{ name: 'main', protected: true, sha: sh }]; } break;
      case 'workflow': GitHubProvider.configureWorkflow(); break;
      case 'azure': j.resourceCalls++; r = AzureProvider.ensureAppService({ name: p.env.appName, rg: p.env.resourceGroup, region: p.env.region, plan: p.env.plan, protoId: p.id }); if (!r.ok) return boom('AZ-CONFLICT', r.error);
        p.env.created = true; p.env.resourceId = r.resourceId; p.env.state = 'Provisioned'; step.note = r.created ? 'Created ' + p.env.appName : p.env.appName + ' already existed from the earlier attempt and was reused. No duplicate was created.';
        if (inj) return boom('AZ-TIMEOUT', 'Azure did not confirm the App Service in time. The resource may already exist.'); break;
      case 'deploy': { var c = p.repo.commits[0]; AzureProvider.deploy(); var d = mkDep(p.id, c.sha, 'main', 'Initial provisioning', 'deploying', 0, 'Prototype Manager'); d.queuedAt = stamp(); d.startedAt = d.queuedAt; d.stages.deploy = 'done'; derive(d); p.deployments.unshift(d); p.env.deployedCommit = c.sha; p.env.state = 'Running'; break; }
      case 'health': { AzureProvider.healthCheck(); var dd = p.deployments[0]; dd.stages.health = 'done'; derive(dd); dd.finishedAt = stamp(); p.env.health = 'Healthy'; p.lastKnownGood = dd.commitSha; break; }
      case 'ready': setStatus(p, 'Active'); notify(p.ownerId, 'Provisioning complete', p.name + ' is ready (simulated).', p.id); break;
    }
    return { ok: true };
  }
  function runNext(actorId, id) {
    return act(actorId, id, 'manage', function (p) {
      if (!p.job || p.status === 'Draft') return fail('Provisioning has not started.');
      var step = nextStep(p); if (!step) return fail('Provisioning is already complete.');
      if (step.status === 'Failed') return fail('Retry the failed step first.');
      step.status = 'Running'; step.attempts++; var r = execStep(p, step);
      if (r.ok) { step.status = 'Succeeded'; step.at = stamp(); step.error = ''; activity(p, 'Prototype Manager', 'platform', stepLabel(step.id) + ' succeeded (simulated)'); return { ok: true, step: step.id }; }
      step.status = 'Failed'; step.at = stamp(); step.error = r.code + ': ' + r.msg; p.job.failAt = null; setStatus(p, 'Failed');
      activity(p, 'Prototype Manager', 'platform', 'Provisioning failed at ' + stepLabel(step.id));
      audit(actorId, 'prototype.provisioning.failed', p.id, 'Failure', step.id + ' ' + r.code); notify(p.ownerId, 'Provisioning failed', 'Provisioning failed for ' + p.name + '. Retry from the provisioning page.', p.id);
      return { ok: false, error: step.error, failed: step.id };
    });
  }
  function runAll(actorId, id) {
    var r = { ok: true }, guard = 0;
    while (guard++ < 12) { var p = proto(id); if (!p || !p.job || !nextStep(p) || nextStep(p).status === 'Failed') break; r = runNext(actorId, id); if (!r.ok) break; }
    return r;
  }
  function retry(actorId, id) {
    return act(actorId, id, 'manage', function (p) {
      var step = nextStep(p); if (!step || step.status !== 'Failed') return fail('There is no failed step to retry.');
      step.status = 'Pending'; step.error = ''; p.job.attempt++; setStatus(p, 'Provisioning');
      activity(p, person(actorId).name, 'user', 'Retried provisioning (attempt ' + p.job.attempt + ')'); audit(actorId, 'prototype.provisioning.retried', p.id, 'Success', 'Attempt ' + p.job.attempt); return { ok: true };
    });
  }
  function injectFailure(actorId, id, stepId) {
    return act(actorId, id, 'manage', function (p) {
      var s = p.job && p.job.steps.filter(function (x) { return x.id === stepId; })[0]; if (!s || s.status === 'Succeeded') return fail('Choose a step that has not run yet.');
      p.job.failAt = stepId; return { ok: true };
    });
  }
  function startProvisioning(actorId, id) {
    return act(actorId, id, 'manage', function (p, u) {
      if (p.status !== 'Draft') return fail('Only a draft can be submitted.');
      var errs = draftErrors(p); if (errs.length) return fail(errs[0].msg);
      p.job = newJob(); setStatus(p, 'Provisioning'); activity(p, u.name, 'user', 'Submitted draft for provisioning'); audit(actorId, 'prototype.provisioning.started', id, 'Success', ''); return { ok: true };
    });
  }

  /* ---------- Source and deployments ---------- */
  var MESSAGES = ['Update start page wording', 'Add check answers page', 'Fix error summary links', 'Add new question page', 'Change button label', 'Tidy page layout'];
  function queueDeployment(p, commitSha, trigger, actor, branch) { var d = { id: nid('DEP'), prototypeId: p.id, commitSha: commitSha, branch: branch || 'main', trigger: trigger, actor: actor, stages: { build: 'pending', deploy: 'pending', health: 'pending' }, queuedAt: stamp(), startedAt: null, finishedAt: null, errorSummary: '', runId: 'run-' + sha(p.id + commitSha + S.clock) }; derive(d); p.deployments.unshift(d); return d; }
  function activeRepo(p) { return p.status === 'Active' && p.repo.created; }
  function simulatePush(actorId, id, o) {
    o = o || {};
    return act(actorId, id, 'push', function (p, u) {
      if (!activeRepo(p)) return fail('Pushes are only simulated for active prototypes (this one is ' + statusLabel(p).toLowerCase() + ').');
      var n = ++S.counters.commit, sh = sha(p.id + ':commit:' + n), msg = MESSAGES[n % MESSAGES.length];
      p.repo.commits.unshift({ sha: sh, message: msg, author: u.name, at: stamp(), branch: 'main' }); p.repo.branches[0].sha = sh;
      if (o.missedWebhook) { activity(p, u.name, 'repo', 'Pushed ' + sh + ' to main (webhook not delivered, simulated)'); return { ok: true, sha: sh, missed: true }; }
      var ev = { id: nid('EVT'), deliveryId: 'dlv-' + sha(p.id + 'dlv' + n), type: 'push', actor: u.name, commitSha: sh, receivedAt: stamp(), processedAt: stamp(), outcome: 'Processed', duplicates: 0 };
      p.repoEvents.unshift(ev); var d = queueDeployment(p, sh, 'Push to main', u.name);
      activity(p, u.name, 'repo', 'Pushed ' + sh + ' to main'); activity(p, 'GitHub Actions', 'workflow', 'Deployment ' + d.id + ' queued for ' + sh); return { ok: true, sha: sh, deployment: d.id, deliveryId: ev.deliveryId };
    });
  }
  function redeliver(actorId, id) {
    return act(actorId, id, 'push', function (p) {
      var ev = p.repoEvents[0]; if (!ev) return fail('There is no delivery to redeliver yet. Simulate a push first.');
      var seen = p.repoEvents.filter(function (e) { return e.deliveryId === ev.deliveryId; })[0];
      seen.duplicates++; activity(p, 'Prototype Manager', 'platform', 'Duplicate webhook delivery ' + ev.deliveryId + ' ignored'); audit(actorId, 'webhook.duplicate.ignored', id, 'Success', ev.deliveryId); return { ok: true, duplicate: true, deliveryId: ev.deliveryId };
    });
  }
  function reconcile(actorId, id) {
    return act(actorId, id, 'push', function (p) {
      var known = {}; p.repoEvents.forEach(function (e) { known[e.commitSha] = 1; }); var made = 0;
      p.repo.commits.slice().reverse().forEach(function (c) {
        if (known[c.sha] || c.author === 'Prototype Manager') return; known[c.sha] = 1; made++;
        p.repoEvents.unshift({ id: nid('EVT'), deliveryId: 'rec-' + sha(p.id + c.sha), type: 'push (found by reconciliation)', actor: c.author, commitSha: c.sha, receivedAt: stamp(), processedAt: stamp(), outcome: 'Processed', duplicates: 0 });
        if (!deploymentFor(p, c.sha)) queueDeployment(p, c.sha, 'Reconciliation', c.author);
      });
      if (made) activity(p, 'Prototype Manager', 'platform', 'Reconciliation found ' + made + ' commit(s) with no webhook and queued deployments'); return { ok: true, found: made };
    });
  }
  function oldestActive(p) { var a = inFlight(p); return a[a.length - 1] || null; }
  function nextStage(actorId, id) {
    return act(actorId, id, 'simulate', function (p) {
      if (p.status !== 'Active') return fail('Deployments are not available while the prototype is ' + statusLabel(p).toLowerCase() + '.');
      var d = oldestActive(p); if (!d) return fail('There is no deployment in progress. Simulate a push or retry a failed deployment.');
      var s = d.stages;
      if (s.build === 'pending') { s.build = 'running'; d.startedAt = stamp(); }
      else if (s.build === 'running') { s.build = 'done'; s.deploy = 'running'; }
      else if (s.deploy === 'running') { s.deploy = 'done'; p.env.deployedCommit = d.commitSha; p.env.health = 'Unknown'; s.health = 'running'; AzureProvider.deploy(); }
      else if (s.health === 'running') { s.health = 'done'; }
      derive(d);
      if (d.status === 'Healthy') { p.env.health = 'Healthy'; p.env.deployedCommit = d.commitSha; p.lastKnownGood = d.commitSha; d.finishedAt = stamp(); notify(p.ownerId, 'Deployment healthy', 'Deployment of ' + p.name + ' (' + d.commitSha + ') is healthy.', p.id); }
      activity(p, 'GitHub Actions', 'workflow', 'Deployment ' + d.id + ' is now ' + d.status.toLowerCase() + (d.status === 'Healthy' ? ' (' + d.commitSha + ')' : '')); return { ok: true, status: d.status };
    });
  }
  function failStage(actorId, id) {
    return act(actorId, id, 'simulate', function (p) {
      if (p.status !== 'Active') return fail('Deployments are not available while the prototype is ' + statusLabel(p).toLowerCase() + '.');
      var d = oldestActive(p); if (!d) return fail('There is no deployment in progress to fail.');
      var s = d.stages, kind = s.deploy === 'running' ? 'faildeploy' : s.health === 'running' ? 'failhealth' : 'failbuild';
      if (kind === 'failbuild') s.build = 'failed'; else if (kind === 'faildeploy') s.deploy = 'failed'; else { s.health = 'failed'; p.env.health = 'Unhealthy'; }
      d.errorSummary = ERRORS[kind]; d.finishedAt = stamp(); derive(d);
      activity(p, 'GitHub Actions', 'workflow', 'Deployment ' + d.id + ' failed. ' + (kind === 'failhealth' ? 'The deployed commit is not healthy; roll back to the last known good commit.' : 'Last known good ' + p.lastKnownGood + ' is unchanged.'));
      notify(p.ownerId, 'Deployment failed', 'Deployment of ' + p.name + ' failed (' + d.commitSha + '). ' + d.errorSummary, p.id); audit(actorId, 'deployment.failed.simulated', p.id, 'Success', d.id + ' ' + kind); return { ok: true, status: d.status, kind: kind };
    });
  }
  function retryDeployment(actorId, id) {
    return act(actorId, id, 'manage', function (p, u) {
      if (p.status !== 'Active') return fail('Deployments are not available while the prototype is ' + statusLabel(p).toLowerCase() + '.');
      var d = latestDeployment(p); if (!d || d.status !== 'Failed') return fail('The latest deployment has not failed.');
      var n = queueDeployment(p, d.commitSha, 'Manual retry', u.name); activity(p, u.name, 'user', 'Retried deployment of ' + d.commitSha + ' as ' + n.id); return { ok: true, deployment: n.id };
    });
  }
  function redeployCurrent(actorId, id) {
    return act(actorId, id, 'manage', function (p, u) {
      if (p.status !== 'Active') return fail('The environment is not running.'); if (!p.env.deployedCommit) return fail('Nothing has been deployed yet.');
      var n = queueDeployment(p, p.env.deployedCommit, 'Manual redeploy', u.name); activity(p, u.name, 'user', 'Redeploy of ' + p.env.deployedCommit + ' queued'); return { ok: true, deployment: n.id };
    });
  }
  function rollback(actorId, id) {
    return act(actorId, id, 'manage', function (p, u) {
      if (p.status !== 'Active') return fail('Deployments are not available while the prototype is ' + statusLabel(p).toLowerCase() + '.');
      if (!p.lastKnownGood) return fail('There is no last known good deployment.');
      var n = queueDeployment(p, p.lastKnownGood, 'Rollback to last known good', u.name); activity(p, u.name, 'user', 'Rollback to ' + p.lastKnownGood + ' queued as ' + n.id); audit(actorId, 'deployment.rollback', p.id, 'Success', 'To ' + p.lastKnownGood); return { ok: true, deployment: n.id, sha: p.lastKnownGood };
    });
  }
  function restartEnvironment(actorId, id) {
    return act(actorId, id, 'manage', function (p, u) {
      if (p.status !== 'Active') return fail('The environment is not running.'); activity(p, u.name, 'user', 'Restarted the App Service (simulated)'); audit(actorId, 'environment.restarted', id, 'Success', p.env.appName); return { ok: true };
    });
  }

  /* ---------- Access ---------- */
  function addCollaborator(actorId, id, personId, role) {
    return act(actorId, id, 'manage', function (p, u) {
      var t = person(personId); if (!t || t.role === 'researcher') return fail('Select a colleague. Researchers receive viewer access, not repository access.');
      if (p.ownerId === personId || p.contributors.indexOf(personId) > -1) return fail(t.name + ' already has management access.');
      p.contributors.push(personId); (p.collabRoles = p.collabRoles || {})[personId] = role === 'Read' ? 'Read' : 'Write';
      activity(p, u.name, 'user', 'Added ' + t.name + ' as a collaborator (' + p.collabRoles[personId] + ' on the repository)'); audit(actorId, 'access.collaborator.added', id, 'Success', t.name + ' ' + p.collabRoles[personId]); return { ok: true };
    });
  }
  function setPassword(actorId, id, o) {
    return act(actorId, id, 'manage', function (p, u) {
      var errs = [], pw = String(o.password || '');
      if (p.status !== 'Active') return fail('A password can only be set for an active prototype.');
      if (pw.length < 8) errs.push({ id: 'password', msg: 'Password must be at least 8 characters' });
      if (pw !== String(o.confirm || '')) errs.push({ id: 'confirm', msg: 'The passwords do not match' });
      if (o.expiresAt) { if (!/^\d{4}-\d{2}-\d{2}$/.test(o.expiresAt)) errs.push({ id: 'expiresAt', msg: 'Enter an expiry date as YYYY-MM-DD' }); else if (daysTo(o.expiresAt) <= 0) errs.push({ id: 'expiresAt', msg: 'Expiry date must be in the future' }); }
      if (errs.length) return fail('Fix the errors.', { errors: errs });
      p.password = { setBy: u.name, setAt: stamp(), expiresAt: o.expiresAt || null, hash: sha(pw) };
      p.env.accessPolicy = 'Password protection on, production mode on';
      activity(p, u.name, 'user', 'Set the prototype password' + (o.expiresAt ? ', expires ' + o.expiresAt : '')); audit(actorId, 'access.password.set', id, 'Success', o.expiresAt ? 'Expires ' + o.expiresAt : 'No expiry');
      return { ok: true };
    });
  }
  function removeCollaborator(actorId, id, personId) {
    return act(actorId, id, 'manage', function (p, u) {
      p.contributors = p.contributors.filter(function (c) { return c !== personId; }); activity(p, u.name, 'user', 'Removed ' + (person(personId) || {}).name + ' as a collaborator'); audit(actorId, 'access.collaborator.removed', id, 'Success', personId); return { ok: true };
    });
  }
  function createResearchAccess(actorId, id, o) {
    return act(actorId, id, 'manage', function (p, u) {
      var errs = [], pol = S.policy;
      if (!pol.allowResearchSharing) return fail('Research sharing is not approved by policy.');
      if (p.status !== 'Active') return fail('Research access can only be created for an active prototype.');
      var rec = o.recipientId ? person(o.recipientId) : null, label = rec ? rec.name + ' (' + rec.team.toLowerCase() + ')' : String(o.recipientLabel || '').trim();
      if (!label) errs.push({ id: 'recipient', msg: 'Select or enter who the access is for' });
      if (!String(o.purpose || '').trim()) errs.push({ id: 'purpose', msg: 'Enter the purpose of the research access' });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(o.expiresAt || '')) errs.push({ id: 'expiresAt', msg: 'Enter an expiry date as YYYY-MM-DD' });
      else if (daysTo(o.expiresAt) <= 0) errs.push({ id: 'expiresAt', msg: 'Expiry date must be in the future' });
      else if (daysTo(o.expiresAt) > pol.expiry.researchMaxDays) errs.push({ id: 'expiresAt', msg: 'Research access can last at most ' + pol.expiry.researchMaxDays + ' days' });
      if (errs.length) return fail('Fix the errors.', { errors: errs });
      var g = { id: nid('GRT'), kind: 'research', recipientId: rec ? rec.id : null, recipientLabel: label, purpose: o.purpose.trim(), role: 'Research viewer', grantedBy: u.name, grantedAt: stamp(), expiresAt: o.expiresAt, revokedAt: null };
      p.accessGrants.unshift(g); p.sharing = 'Controlled research sharing';
      activity(p, u.name, 'user', 'Created research access for ' + label + ', expires ' + o.expiresAt); audit(actorId, 'access.research.created', id, 'Success', label + ' until ' + o.expiresAt); if (rec) notify(rec.id, 'Access granted', 'You can now view ' + p.name + ' until ' + o.expiresAt + '.', p.id);
      return { ok: true, grant: g.id };
    });
  }
  function revokeGrant(actorId, id, grantId) {
    return act(actorId, id, 'manage', function (p, u) {
      var g = p.accessGrants.filter(function (x) { return x.id === grantId; })[0]; if (!g) return fail('Grant not found.'); if (g.revokedAt) return fail('Already revoked.');
      g.revokedAt = stamp(); activity(p, u.name, 'user', 'Revoked access for ' + g.recipientLabel + ' before expiry'); audit(actorId, 'access.revoked', id, 'Success', g.recipientLabel); return { ok: true };
    });
  }

  /* ---------- Settings and ownership ---------- */
  function updateMetadata(actorId, id, o) {
    return act(actorId, id, 'manage', function (p, u) {
      var errs = [];
      if (!String(o.name || '').trim()) errs.push({ id: 'name', msg: 'Enter a prototype name' }); if (!String(o.purpose || '').trim()) errs.push({ id: 'purpose', msg: 'Enter the purpose of the prototype' });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(o.reviewAt || '') || daysTo(o.reviewAt) < 0 || daysTo(o.reviewAt) > S.policy.expiry.maxDays) errs.push({ id: 'reviewAt', msg: 'Enter a review date from today up to ' + S.policy.expiry.maxDays + ' days ahead, as YYYY-MM-DD' });
      if (errs.length) return fail('Fix the errors.', { errors: errs });
      p.name = o.name.trim(); p.purpose = o.purpose.trim(); p.reviewAt = o.reviewAt; p.tags = String(o.tags || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
      activity(p, u.name, 'user', 'Updated prototype settings'); audit(actorId, 'prototype.updated', id, 'Success', ''); return { ok: true };
    });
  }
  function requestTransfer(actorId, id, toId) {
    return act(actorId, id, 'manage', function (p, u) {
      var t = person(toId); if (!t || t.role === 'researcher') return fail('Select a new owner.'); if (t.id === p.ownerId) return fail('That person already owns this prototype.');
      p.transferRequest = { to: toId, by: u.name, at: stamp(), status: 'Pending' }; activity(p, u.name, 'user', 'Requested ownership transfer to ' + t.name); audit(actorId, 'prototype.transfer.requested', id, 'Success', t.name); return { ok: true };
    });
  }
  function doTransfer(p, toId, byName) { var t = person(toId); p.previousOwnerId = p.ownerId; p.ownerId = toId; p.team = t.team; p.transferRequest = null; p.contributors = p.contributors.filter(function (c) { return c !== toId; }); activity(p, byName, 'platform', 'Ownership transferred to ' + t.name + ' (' + t.team + ')'); notify(toId, 'Ownership', 'You are now the owner of ' + p.name + '.', p.id); }
  function approveTransfer(actorId, id) {
    var p = proto(id), u = person(actorId); if (!p || !p.transferRequest) return fail('There is no pending transfer.');
    var ok = isAdmin(actorId) || (u && u.role === 'lead' && u.team === p.team); if (!ok) return denied(actorId, 'approve transfer on ' + id, id);
    var to = p.transferRequest.to; doTransfer(p, to, u.name); audit(actorId, 'prototype.transferred', id, 'Success', 'To ' + person(to).name + '; approved by ' + u.name); save(); return { ok: true };
  }
  function requestArchive(actorId, id) {
    return act(actorId, id, 'manage', function (p, u) {
      if (['Active', 'Suspended'].indexOf(p.status) < 0) return fail('Only an active or suspended prototype can be archived.'); if (p.archiveRequest) return fail('An archive request is already pending.');
      p.archiveRequest = { by: u.name, at: stamp(), status: 'Pending' }; activity(p, u.name, 'user', 'Requested archive'); audit(actorId, 'prototype.archive.requested', id, 'Success', ''); return { ok: true };
    });
  }

  /* ---------- Lifecycle (administrators) ---------- */
  function impact(p) {
    return { activeGrants: p.accessGrants.filter(grantActive).length, openPrs: p.repo.prs.filter(function (x) { return x.state === 'open'; }).length, inFlight: inFlight(p).length, service: p.serviceId, work: p.workId,
      contributors: p.contributors.length, hosting: p.env.created && p.env.state !== 'Removed' ? p.env.appName : null, review: p.reviewAt };
  }
  var OPS = { suspend: ['Active'], restore: ['Suspended', 'Archived'], archive: ['Active', 'Suspended'], decommission: ['Active', 'Suspended', 'Archived'], transfer: ['Active', 'Suspended', 'Draft', 'Failed', 'Provisioning'] };
  var PAST = { suspend: 'suspended', restore: 'restored', archive: 'archived', decommission: 'decommissioned' };
  function lifecycle(actorId, id, op, o) {
    o = o || {}; var p = proto(id), u = person(actorId);
    if (!p) return fail('Prototype not found.'); if (!isAdmin(actorId)) return denied(actorId, 'lifecycle ' + op + ' on ' + id, id);
    if (!OPS[op]) return fail('Unknown action.'); if (OPS[op].indexOf(p.status) < 0) return fail('Cannot ' + op + ' a prototype that is ' + statusLabel(p).toLowerCase() + '.');
    var errs = [];
    if (op === 'transfer') { var t = person(o.toId); if (!t || t.role === 'researcher') errs.push({ id: 'toId', msg: 'Select a new owner' }); }
    if (!String(o.reason || '').trim()) errs.push({ id: 'reason', msg: 'Enter a reason for the audit record' });
    if (!o.confirm) errs.push({ id: 'confirm', msg: 'Confirm that you have checked the impact' });
    if (errs.length) return fail('Fix the errors.', { errors: errs });
    var by = 'authorised by ' + u.name + ': ' + o.reason.trim();
    if (op === 'transfer') { doTransfer(p, o.toId, u.name); audit(actorId, 'prototype.transferred', id, 'Success', 'To ' + person(o.toId).name + '; ' + by); save(); return { ok: true }; }
    if (op === 'suspend') { setStatus(p, 'Suspended'); p.env.state = 'Stopped'; p.env.health = 'Unknown'; }
    if (op === 'restore') {
      var wasArchived = p.status === 'Archived'; setStatus(p, 'Active');
      if (wasArchived) { AzureProvider.ensureAppService({ name: p.env.appName, rg: p.env.resourceGroup, region: p.env.region, plan: p.env.plan, protoId: p.id }); S.ledger.resources[p.env.appName].removed = false; p.env.resourceId = S.ledger.resources[p.env.appName].id; p.env.created = true; p.repo.state = 'Active'; p.env.health = 'Unknown'; p.env.deployedCommit = null; queueDeployment(p, latestCommit(p) || p.lastKnownGood, 'Restore from archive', u.name); }
      p.env.state = 'Running'; if (!wasArchived) p.env.health = 'Healthy';
    }
    if (op === 'archive') { AzureProvider.removeResources(p.env.appName); p.env.state = 'Removed'; p.env.resourceId = null; p.env.health = 'Not applicable'; p.repo.state = 'Archived (read-only)'; p.archiveRequest = null; setStatus(p, 'Archived'); }
    if (op === 'decommission') {
      var imp = impact(p); AzureProvider.removeResources(p.env.appName); p.env.state = 'Removed'; p.env.resourceId = null; p.env.health = 'Not applicable';
      p.accessGrants.forEach(function (g) { if (grantActive(g)) g.revokedAt = stamp(); }); p.contributors = [];
      p.repo.state = o.repoDecision === 'delete' ? 'Deleted' : 'Archived (read-only)'; p.archiveRequest = null; setStatus(p, 'Decommissioned');
      by += ' (repository ' + (o.repoDecision === 'delete' ? 'deleted' : 'archived') + '; ' + imp.activeGrants + ' access grant(s) removed)';
    }
    activity(p, u.name, 'platform', 'Lifecycle: ' + op + ', ' + by); audit(actorId, 'prototype.' + PAST[op], id, 'Success', by);
    notify(p.ownerId, 'Lifecycle', p.name + ' was ' + PAST[op] + ' by ' + u.name + '.', p.id); save(); return { ok: true };
  }

  /* ---------- Admin configuration ---------- */
  function adminAct(actorId, fn) { if (!isAdmin(actorId)) return denied(actorId, 'administration', ''); var r = fn(person(actorId)); save(); return r; }
  function tpl(id) { return S.templates.filter(function (x) { return x.id === id; })[0]; }
  function setTemplateEnabled(actorId, id, on) { return adminAct(actorId, function (u) { var t = tpl(id); if (!t) return fail('Template not found.'); if (on && t.status === 'Draft') return fail(t.name + ' is a draft. Approve it before enabling it.'); t.enabled = !!on; audit(u.id, on ? 'template.enabled' : 'template.disabled', id, 'Success', t.name, 'template'); return { ok: true }; }); }
  function approveTemplate(actorId, id) { return adminAct(actorId, function (u) { var t = tpl(id); if (!t) return fail('Template not found.'); t.status = 'Approved'; audit(u.id, 'template.approved', id, 'Success', t.name, 'template'); return { ok: true }; }); }
  function setTemplateVersion(actorId, id, v) { return adminAct(actorId, function (u) { var t = tpl(id); if (!t || t.versions.indexOf(v) < 0) return fail('Version not available.'); t.pinned = v; audit(u.id, 'template.version.pinned', id, 'Success', t.name + ' pinned to ' + v + '. Existing prototypes are unchanged.', 'template'); return { ok: true }; }); }
  function addTemplate(actorId, o) {
    return adminAct(actorId, function (u) {
      var errs = []; if (!String(o.name || '').trim()) errs.push({ id: 'tname', msg: 'Enter a template name' }); if (!String(o.framework || '').trim()) errs.push({ id: 'tframework', msg: 'Enter the framework' });
      if (!/^\d+\.\d+\.\d+(-[a-z0-9]+)?$/.test(o.version || '')) errs.push({ id: 'tversion', msg: 'Enter a version such as 1.0.0' });
      if (!String(o.startCommand || '').trim()) errs.push({ id: 'tstart', msg: 'Enter the start command' });
      if (errs.length) return fail('Fix the errors.', { errors: errs });
      var t = { id: 'tpl-' + slugify(o.name) + '-' + (S.templates.length + 1), name: o.name.trim(), framework: o.framework.trim(), versions: [o.version], pinned: o.version, runtime: o.runtime || o.framework, buildCommand: o.buildCommand || 'npm ci', startCommand: o.startCommand.trim(), hosting: 'Azure App Service (Linux)', healthCheck: '/healthcheck', licence: 'MIT', enabled: false, status: 'Draft', note: 'Added by ' + u.name + '. Needs approval before use.' };
      S.templates.push(t); audit(u.id, 'template.added', t.id, 'Success', t.name, 'template'); return { ok: true, id: t.id };
    });
  }
  function addRegion(actorId, region) { return adminAct(actorId, function (u) { if (S.policy.regionOptions.indexOf(region) < 0) return fail('Choose a region from the list.'); if (S.policy.regions.indexOf(region) > -1) return fail(region + ' is already allowed.'); S.policy.regions.push(region); audit(u.id, 'policy.region.added', 'policy', 'Success', region, 'policy'); return { ok: true }; }); }
  function removeRegion(actorId, region) { return adminAct(actorId, function (u) { if (S.policy.regions.length < 2) return fail('At least one region must stay allowed.'); if (region === S.policy.defaultRegion) return fail('Change the default region before removing it.'); S.policy.regions = S.policy.regions.filter(function (r) { return r !== region; }); audit(u.id, 'policy.region.removed', 'policy', 'Success', region, 'policy'); return { ok: true }; }); }
  function setExpiry(actorId, o) {
    return adminAct(actorId, function (u) {
      var d = parseInt(o.defaultDays, 10), m = parseInt(o.maxDays, 10), r = parseInt(o.researchMaxDays, 10), q = parseInt(o.perTeam, 10), errs = [];
      if (!(m >= 7 && m <= 365)) errs.push({ id: 'maxDays', msg: 'Maximum expiry must be 7 to 365 days' });
      if (!(d >= 7 && d <= 365)) errs.push({ id: 'defaultDays', msg: 'Default expiry must be 7 to 365 days' }); else if (d > m) errs.push({ id: 'defaultDays', msg: 'Default expiry cannot exceed the maximum' });
      if (!(r >= 1 && r <= 90)) errs.push({ id: 'researchMaxDays', msg: 'Research access limit must be 1 to 90 days' });
      if (!(q >= 1 && q <= 50)) errs.push({ id: 'perTeam', msg: 'Team quota must be 1 to 50' });
      if (errs.length) return fail('Fix the errors.', { errors: errs });
      S.policy.expiry = { defaultDays: d, maxDays: m, researchMaxDays: r }; S.policy.quotas.perTeam = q; audit(u.id, 'policy.expiry.updated', 'policy', 'Success', d + '/' + m + '/' + r + ' days; quota ' + q, 'policy'); return { ok: true };
    });
  }
  function addOrg(actorId, org) {
    return adminAct(actorId, function (u) {
      org = String(org || '').trim().toLowerCase();
      if (!org) return fail('Enter an organisation name.', { errors: [{ id: 'org', msg: 'Enter a GitHub organisation name' }] });
      if (!/^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/.test(org)) return fail('Invalid name.', { errors: [{ id: 'org', msg: 'Organisation names use lower case letters, numbers and hyphens, and cannot start or end with a hyphen' }] });
      if (S.policy.approvedOrgs.indexOf(org) > -1) return fail('Already approved.', { errors: [{ id: 'org', msg: org + ' is already approved' }] });
      var v = GitHubProvider.verifyOrganisation(org); if (!v.ok) return fail(v.error, { errors: [{ id: 'org', msg: v.error + ' Ask a platform administrator to install it first' }] });
      S.policy.approvedOrgs.push(org); audit(u.id, 'policy.org.approved', 'policy', 'Success', org, 'policy'); return { ok: true };
    });
  }
  function removeOrg(actorId, org) { return adminAct(actorId, function (u) { if (S.policy.approvedOrgs.length < 2) return fail('At least one organisation must stay approved.'); if (S.prototypes.some(function (p) { return p.repo.org === org && ['Archived', 'Decommissioned'].indexOf(p.status) < 0; })) return fail('Active prototypes still use ' + org + '.'); S.policy.approvedOrgs = S.policy.approvedOrgs.filter(function (o) { return o !== org; }); audit(u.id, 'policy.org.removed', 'policy', 'Success', org, 'policy'); return { ok: true }; }); }
  function checkConnections(actorId, toggle) {
    var u = person(actorId); if (!u || u.role !== 'platform') return denied(actorId, 'connection check', '');
    if (toggle) S.connections[toggle].degraded = !S.connections[toggle].degraded;
    S.connections.github.lastCheck = stamp(); S.connections.azure.lastCheck = iso(S.clock); audit(actorId, 'connections.checked', 'connections', 'Success', toggle ? 'Toggled simulated degradation for ' + toggle : 'Health check run', 'connection'); save(); return { ok: true };
  }

  /* ---------- Reporting ---------- */
  function feed() {
    return { generatedAt: iso(S.clock), mode: 'demo', source: 'Prototype Manager (simulated)', note: 'Read-only. No secrets, credentials or access codes are included.', prototypeCount: S.prototypes.length,
      prototypes: S.prototypes.map(function (p) { var d = latestDeployment(p); return { prototypeId: p.id, name: p.name, status: p.status, serviceId: p.serviceId, productId: p.productId, workId: p.workId, team: p.team, ownerId: p.ownerId, ownerName: p.ownerId ? person(p.ownerId).name : null,
        health: p.env.health, latestDeploymentStatus: d ? d.status : null, deployedCommit: p.env.deployedCommit, lastActivityAt: p.lastActivityAt, reviewAt: p.reviewAt, costCategory: p.env.created && p.env.state !== 'Removed' ? p.env.costCategory : null }; }) };
  }
  function integrationEvents(pid) { return isAdmin(pid) ? S.integrationEvents : []; }

  /* ---------- Notifications and personas ---------- */
  function notificationsFor(pid) { return S.notifications.filter(function (n) { return n.personId === pid; }); }
  function markRead(pid) { S.notifications.forEach(function (n) { if (n.personId === pid) n.read = true; }); save(); }
  function feedFor(pid) { var out = []; mine(pid).forEach(function (p) { if (p.ownerId === pid || levelFor(pid, p) === 'lead') p.activity.forEach(function (a) { out.push({ at: a.at, actor: a.actor, text: a.text, prototype: p.name, id: p.id, kind: a.kind }); }); }); return out.sort(function (a, b) { return a.at < b.at ? 1 : -1; }).slice(0, 12); }
  function setPersona(id) { if (S.personas.indexOf(id) > -1) { S.persona = id; save(); } }
  function checkProvider(name) { var impl = { GitHubProvider: GitHubProvider, AzureProvider: AzureProvider, ServiceLookup: ServiceLookup }[name]; return INTERFACES[name].map(function (m) { return { method: m, implemented: typeof impl[m] === 'function' }; }); }
  function reset() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } seed(); }

  try { var raw = localStorage.getItem(KEY); S = raw ? JSON.parse(raw) : null; if (!S || S.v !== 1) S = null; } catch (e) { S = null; }
  if (S) { S.policy.profiles = [{ id: 'dev-low', label: 'Free hosting plan', plan: 'F1', category: 'Free' }]; S.policy.regions = ['UK South'];
    S.prototypes.forEach(function (p) { p.profileId = 'dev-low'; if (p.env) { p.env.plan = 'F1'; p.env.costCategory = 'Free'; p.env.region = 'UK South'; } }); }
  if (S) (S.templates || []).forEach(function (t) { if (t.id === 'tpl-aspnet' && t.status === 'Draft') { t.runtime = '.NET 10'; t.versions = ['1.0.0']; t.pinned = '1.0.0'; t.enabled = true; t.status = 'Approved'; t.buildCommand = 'dotnet build && dotnet test'; t.note = 'GOV.UK Frontend for ASP.NET Core (Razor) on .NET 10, with DfE components.'; } });
  if (!S) seed();

  window.PM = { get: function () { return S; }, save: save, reset: reset, STEPS: STEPS, ROLE_LABEL: ROLE_LABEL, ORG: ORG, CAPS: CAPS, INTERFACES: INTERFACES, GitHubProvider: GitHubProvider, AzureProvider: AzureProvider, ServiceLookup: ServiceLookup,
    today: today, daysTo: daysTo, person: person, proto: proto, levelFor: levelFor, can: can, isAdmin: isAdmin, hash: sha, setPassword: setPassword, mine: mine, directory: directory, all: all, getPrototype: getPrototype, slugify: slugify, slugTaken: slugTaken,
    latestCommit: latestCommit, deployedCommit: deployedCommit, latestDeployment: latestDeployment, inFlight: inFlight, deploymentFor: deploymentFor, isExpired: isExpired, isExpiring: isExpiring, ownershipGap: ownershipGap, isInactive: isInactive,
    deploymentFailed: deploymentFailed, statusLabel: statusLabel, counts: counts, nextStep: nextStep, stepLabel: stepLabel, grantActive: grantActive, impact: impact, OPS: OPS, plan: plan, validateCreate: validateCreate, STEP_OF: STEP_OF,
    create: create, runNext: runNext, runAll: runAll, retry: retry, injectFailure: injectFailure, startProvisioning: startProvisioning,
    simulatePush: simulatePush, redeliver: redeliver, reconcile: reconcile, nextStage: nextStage, failStage: failStage, retryDeployment: retryDeployment, redeployCurrent: redeployCurrent, rollback: rollback, restartEnvironment: restartEnvironment,
    addCollaborator: addCollaborator, removeCollaborator: removeCollaborator, createResearchAccess: createResearchAccess, revokeGrant: revokeGrant,
    updateMetadata: updateMetadata, requestTransfer: requestTransfer, approveTransfer: approveTransfer, requestArchive: requestArchive, lifecycle: lifecycle,
    setTemplateEnabled: setTemplateEnabled, approveTemplate: approveTemplate, setTemplateVersion: setTemplateVersion, addTemplate: addTemplate, addRegion: addRegion, removeRegion: removeRegion, setExpiry: setExpiry, addOrg: addOrg, removeOrg: removeOrg, checkConnections: checkConnections,
    feed: feed, integrationEvents: integrationEvents, notificationsFor: notificationsFor, markRead: markRead, feedFor: feedFor, setPersona: setPersona, checkProvider: checkProvider };
})();
