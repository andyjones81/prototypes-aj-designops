# CBP, skills and learning and development — enabling services prototype specification

**Status:** Concept / prototype specification  
**Version:** 0.1  
**Audience:** Product, design, engineering, profession leads, assessors, managers and learning and development teams  
**Purpose:** Provide a standalone specification to build and test three connected people-capability enablers using GitHub Copilot.

## 1. Product vision

Create a joined-up capability development experience in which a member of staff can understand the skills expected for their profession and role, assess and evidence their current capability, receive constructive assessment feedback, and follow a meaningful development plan. Profession leads and administrators can maintain frameworks, run fair and auditable Capability-Based Pay (CBP) assessment processes, identify aggregated capability gaps, and target learning and development (L&D) investment.

The three enablers should be able to operate independently but share a common identity, profession, role, skill and evidence model:

1. **CBP assessment management:** manage formal assessment cycles, assessor scoring, moderation, outcomes and feedback.
2. **Skills and capability management:** manage skills frameworks, proficiency expectations, self-assessments, evidence, capability gaps and profession-level insight.
3. **Learning and development management:** connect identified development needs to learning opportunities, development plans and progress reviews.

**Design principle:** These are people services, not surveillance products. Personal assessment information is permission-controlled; profession-level reporting is aggregated and non-identifying. The specification is for prototypes rather than an implementation of pay policy or a replacement for HR/payroll systems.

## 2. Core users and permissions

| User | Primary needs | Typical access |
|---|---|---|
| Staff member / candidate | Understand expectations, complete assessments, provide evidence, review feedback, manage development | Own record and published framework |
| Assessor | Review evidence, score against criteria, write evidence-based comments | Assigned candidate submissions; no unrelated records |
| Joint assessor / moderator | Compare independent scores, agree final assessment and record rationale | Assigned moderation cases and scoring history |
| Line manager | Support development, review agreed plans and progress | Staff development plans where permitted; no automatic access to confidential CBP deliberations |
| Head of profession / capability lead | Maintain profession expectations, review aggregate strengths and gaps, plan interventions | Framework management and appropriately aggregated reporting |
| L&D administrator | Curate learning, manage availability, track enrolments and effectiveness | Learning catalogue, enrolment and permitted progress data |
| CBP administrator | Configure assessment rounds, invite candidates, allocate assessors, monitor workflow, publish outcomes | Operational administration, with controlled access to assessment content |
| Platform administrator | Manage roles, audit settings, retention and integrations | Technical configuration; privileged access separately controlled |

### Cross-cutting access requirements

- Role-based access control and organisation/profession scoping.
- Explicit separation between draft, submitted, assessed, moderated and published records.
- Access logs for sensitive assessment material and administrator actions.
- Candidate evidence visible only to approved assessors during formal assessment.
- Aggregated profession reporting with suppression where groups are small or identifiable.
- Avoid using candidate quotations, identifiable examples or exact small-group counts in profession-level narrative summaries.
- Accessible user interfaces meeting WCAG 2.2 AA; plain language and keyboard-friendly workflows.

## 3. Enabler A — CBP assessment management

### 3.1 Candidate features

- View available assessment rounds, eligibility guidance, deadlines, assigned profession/role and expected assessment criteria.
- Start or resume an application with autosaved draft responses.
- See each skill, description, target level and evidence guidance, with character limits if configured.
- Submit evidence against each skill; support structured examples, supporting documents and links, with clear privacy warnings.
- Validate completeness before submission, and issue a versioned submission receipt.
- Track assessment status: not started, draft, submitted, under review, moderation, outcome ready, published.
- Receive final per-skill scores and constructive written feedback when formally released.
- Optionally turn feedback into a personal development plan without automatically exposing confidential assessor notes.

### 3.2 Assessor features

- Assignment queue showing candidates, deadlines, skills and review status.
- Read the candidate's submission alongside the relevant framework definitions and scoring descriptors.
- Score each skill independently and record a supporting rationale and development feedback.
- Preserve each assessor's initial scores and notes as immutable versions after submission.
- Indicate insufficient or ambiguous evidence and request clarification through a controlled workflow if permitted by policy.
- Submit scores without seeing the other assessor's scores until the agreed moderation stage.
- Identify incomplete assessments and assessment deadlines.

### 3.3 Joint moderation features

- Side-by-side comparison of assessor 1 and assessor 2 scores and rationales.
- Highlight differences without automatically choosing a final score.
- Record a jointly agreed final score and rationale for each skill.
- Retain original assessor submissions alongside the moderated decision and decision metadata.
- Support an overall assessment outcome derived from *configurable* programme rules.
- Publish only approved candidate-facing feedback, with clear separation from internal moderation notes.
- Support controlled re-assessment and re-submission as a new attempt linked to the earlier outcome.

### 3.4 CBP administrator features

- Create assessment cycles with opening and closing dates, eligibility rules and capacity.
- Select a versioned skills framework and role profile for the cycle.
- Manage candidate applications, invitations and assessment status.
- Allocate assessors and moderators; identify potential conflicts of interest.
- Set task deadlines and monitor overdue assessments.
- Configure allowable final scoring categories and outcome bands without hard-coding pay policy.
- Review audit history, publication approvals and candidate notifications.
- Export authorised results for an HR/pay process **only through an approved interface**; no payroll changes in the prototype.
- Archive closed cycles according to retention and access policies.

### 3.5 Assessment model and scoring

For a representative DfE service design prototype, demonstrate these skills:

- Design communication
- Designing for everyone
- Designing strategically
- Designing together
- Evidence-based design
- Iterative design
- Leading design

Demonstrate a configurable **four-point final scoring model: 0, 1, 2, 3**. Assessment descriptors must be managed as framework data, not embedded in code. If moderation uses intermediate or half-step indicators for discussion, they must be clearly distinguished from the permitted final scores and must never be exported as final results. Overall assessment and allowance-band calculations are configurable and should be labelled *illustrative* until an approved policy is supplied.

## 4. Enabler B — skills and capability management

### 4.1 Staff features

- Personal capability profile, populated from existing organisation identity, profession and role data where authorised.
- Browse the skills framework for current role, profession and grade, including expected proficiency.
- Record self-assessed proficiency and confidence with supporting evidence.
- Link relevant evidence from work, projects, research, design decisions or professional activity; permissions remain with the source record.
- Compare current and target proficiency with explanatory gap indicators, not simplistic ranking of people.
- Record skill aspirations, specialisms and goals beyond the current role.
- Review changes over time, with timestamps and framework-version context.
- Choose whether and how voluntary skills data is shared with managers or profession leads.

### 4.2 Manager and profession-lead features

- Maintain role-specific expected skills, including grade or level requirements.
- Review appropriately shared individual development needs with the staff member.
- View aggregated capability coverage across professions, skills, teams and levels, subject to privacy thresholds.
- Identify gaps, strengths, emerging requirements and potential development priorities.
- Compare capability demand with the skills needed for planned work, without using unsupported performance inferences.
- Build capability development interventions: communities of practice, mentoring, coaching and formal learning.
- Track whether interventions correlate with improved skills evidence over time.

### 4.3 Framework administration

- Create and edit professions, role profiles, grades, skills, groups and proficiency descriptors.
- Version frameworks with effective dates and change logs; preserve the version used in each historical assessment.
- Map one skill to several professions or roles while allowing profession-specific expectations.
- Define prerequisite skills, related skills and skill categories.
- Import and export framework structures using CSV or JSON.
- Review and approve framework changes before publication.
- Mark obsolete skills as retired rather than deleting referenced historical records.

### 4.4 Gap analysis

- Calculate a gap only where an expected level and sufficiently reliable observed or assessed level exist.
- Distinguish self-assessment, peer feedback, formal assessment and verified evidence; do not treat them as interchangeable.
- Present both coverage and uncertainty, including missing or stale assessment data.
- Make aggregation explainable: what evidence, cohort, framework version and time period was used?
- Provide anonymised qualitative summaries for small communities rather than exposing identifiable submissions.

## 5. Enabler C — learning and development management

### 5.1 Staff features

- Search and filter a learning catalogue by skill, role, proficiency level, learning format, time commitment and availability.
- View recommended learning based on selected goals, assessed gaps and stated preferences.
- Add resources, courses, mentoring, shadowing, practice opportunities or community sessions to a development plan.
- Record planned, in-progress and completed activities, reflections and evidence of applied learning.
- Set development goals, target dates and review checkpoints.
- Request manager support, learning time or approval where required.
- Review what has been learned and whether it has been applied to real work.

### 5.2 Line manager and profession features

- Agree development objectives with staff and provide feedback or coaching notes.
- Review progress against agreed goals, with consent and appropriate permissions.
- Recommend development opportunities mapped to role expectations and capability gaps.
- Manage mentoring and peer-learning opportunities where participants opt in.
- Identify common development needs for profession-wide learning plans.
- Evaluate learning effectiveness through applied evidence rather than completion rates alone.

### 5.3 L&D administrator features

- Create catalogue items: courses, guides, workshops, communities, coaching, mentoring and practical assignments.
- Map each learning item to the skills and proficiency levels it supports.
- Configure cohorts, session dates, capacity, approval steps and waiting lists.
- Manage invitations, registrations, cancellations, attendance and completion.
- Track content owners, review dates, accessibility information and resource links.
- Archive outdated resources while retaining historical participation records.
- Produce aggregated reports on participation, demand, accessibility, coverage and development impact.

### 5.4 Recommendation logic

Prototype transparent recommendations such as:

> A staff member has a development goal in *Designing strategically*, and a published learning resource is tagged to that skill and intended proficiency. Recommend the resource and explain the match.

The prototype must show why a recommendation was made, allow users to dismiss it and avoid interpreting CBP scores as complete representations of individual ability.

## 6. Shared entity and data model

Use a configurable, versioned model with clear ownership and stable identifiers. Suggested entities:

| Entity | Example attributes | Key relationships |
|---|---|---|
| Person | Person ID, display name, employment status, organisation reference | Holds role(s), assessments, plans |
| Organisation / business area / team | ID, parent, name | Contains people and roles |
| Profession | ID, name, profession lead | Owns frameworks and role profiles |
| Role profile | ID, profession, grade, effective dates | Expects skills |
| Skill | ID, name, definition, category | Appears in frameworks and learning items |
| Proficiency descriptor | Skill, scale, level, definition | Defines expectation and assessment criteria |
| Framework version | ID, version, status, effective dates | Groups skills and descriptors |
| Capability evidence | ID, author, source, date, visibility | Supports claims, assessments and goals |
| Assessment cycle | ID, dates, framework version, status | Contains candidate attempts |
| Assessment attempt | ID, person, cycle, status, version | Contains submission and review records |
| Assessor review | ID, assessor, attempt, submitted timestamp | Contains skill scores and comments |
| Moderated outcome | ID, attempt, final skill scores, approval | References original reviews |
| Self-assessment | Person, skill, level, date, framework version | Supports capability profile |
| Development goal | ID, person, skill, target, review date | Links to learning and evidence |
| Learning item | ID, title, provider, format, skill mapping | Used by enrolment / learning plan |
| Learning enrolment | ID, person, item, status, attendance | Supports learning progress |
| Learning reflection | ID, person, goal, evidence, date | Records application of learning |
| Action / task | ID, owner, due date, status, source entity | Supports assessment and L&D workflow |
| Notification | ID, recipient, trigger, delivery status | References relevant task or record |
| Audit event | Actor, operation, entity, timestamp, before/after ref | Provides traceability |

**Do not merge distinct concepts:** formal CBP assessment, self-assessed skills, development progress and training completion are separate evidence types with different confidence and permissions.

## 7. Core end-to-end journeys

### Journey A — CBP assessment to development

1. Administrator publishes an assessment round using an approved framework version.
2. Candidate completes and submits evidence for each required skill.
3. Two assessors independently review and submit their original scores.
4. Moderators compare the assessments and agree final scores and written feedback.
5. Authorised administrator approves publication; candidate receives the outcome.
6. Candidate can opt to create a development goal from a feedback theme.
7. Learning service recommends mapped resources and tracks progress.
8. Profession reporting uses anonymised trends without exposing candidate-level assessment content.

### Journey B — continuous skills development

1. Person signs in and sees role-appropriate framework expectations.
2. Person records a self-assessment, evidence and aspirations.
3. The system shows gaps with confidence and data-source labels.
4. Person and manager agree development goals and suitable activities.
5. Person completes learning and records applied practice evidence.
6. Person reviews progress and updates the skills profile.

### Journey C — profession-level capability planning

1. Profession lead selects an authorised reporting cohort and framework version.
2. Dashboard shows aggregated capability coverage and evidence completeness.
3. Lead identifies areas for support without naming or exposing individual candidates.
4. Lead creates a profession learning intervention and maps it to target skills.
5. L&D administrator schedules the intervention and tracks participation.
6. Lead reviews outcomes, participant feedback and indications of improved capability.

## 8. Cross-service interfaces and integration

### Existing-data-first onboarding

- Sign in through an identity provider (prototype with mocked Entra ID / OIDC).
- Read permitted person, team, role, profession and grade attributes from a configurable HR or directory adapter.
- Match records by stable identifiers, not name alone.
- Clearly flag stale, missing or conflicting source data; allow authorised correction at the source or local exception where needed.
- Use seeded data initially, with adapters that can later be replaced by real APIs.

### Shared events / APIs

Provide illustrative, documented API contracts and events for:

- `framework.published`
- `assessment.round.opened`
- `assessment.submitted`
- `assessor.review.submitted`
- `assessment.moderated`
- `assessment.outcome.published`
- `development.goal.created`
- `learning.enrolment.created`
- `learning.completed`
- `skill.evidence.updated`

Events should include an event ID, entity ID, schema version, timestamp, originating system and correlation ID. Do **not** publish confidential assessment notes or candidate evidence on general reporting event streams.

### Reporting integration

- Export approved **aggregated** profession capability data to central reporting, for example through a COMPASS-compatible reporting API or data pipeline.
- Distinguish operational assessment-cycle statistics from capability gaps and L&D effectiveness.
- Separate identifiable operational views from privacy-safe department-wide dashboards.
- Support configurable minimum reporting cohorts, suppression and disclosure review.
- Record dataset provenance, aggregation time, source version and definitions of measures.
- Example metrics: assessment workflow timeliness; framework coverage; skills evidence currency; learning demand and participation; development-goal completion; indicative capability-gap trends.
- Avoid using individual CBP scores to generate employee rankings or automated employment decisions.

## 9. Prototype information architecture

| Area | Screens / components |
|---|---|
| Personal home | My role, my skills, outstanding tasks, upcoming learning, recent feedback |
| My capability | Skill profile, expectations, self-assessment, supporting evidence, history |
| My CBP | Assessment cycles, application form, submission status, published outcome and feedback |
| My development | Goals, plan, recommended learning, reflections, progress |
| Assessor workspace | Assigned queue, candidate submission, scoring form, review submission |
| Moderation workspace | Side-by-side reviews, discrepancy view, final outcome, approval flow |
| Profession workspace | Frameworks, role profiles, aggregated capability insight, planned interventions |
| L&D workspace | Catalogue, sessions, enrolments, content review and impact |
| Administration | Assessment rounds, permissions, assessor assignments, notification templates, audit |
| Reporting | Role-specific dashboards, cohort filters, data quality and export preview |
| Integrations | Connection status, field mappings, event log and API simulation |

Use a consistent shell but permit each service to have its own workflow and permissions. The prototype should make it obvious when the user is working in CBP, skills management or L&D.

## 10. Admin capabilities common to all three enablers

- Manage configurable forms, fields, descriptions and guidance without code changes.
- Configure professions, roles, grades, frameworks and framework versions.
- Establish workflow states, approvals, assignments, queues, deadlines and notifications.
- Define retention, access, consent and data-sharing rules.
- Review errors, missing source data, API integrations and event failures.
- Manage templates, published content and change history.
- Configure reporting definitions and privacy thresholds.
- Export data using authorised and logged operations.
- View audit trails for administrative and sensitive assessment actions.

## 11. Suggested prototype architecture

This is an **illustrative build approach**, not a mandatory target technology choice.

- **Frontend:** React and TypeScript; accessible component library and responsive layout.
- **Backend:** Lightweight REST API, e.g. ASP.NET Core or Node.js, with separated modules for CBP, skills and learning.
- **Data:** SQLite or PostgreSQL using seeded demo records, with migrations and stable IDs.
- **Authentication:** Fake-login persona switcher for demo; OIDC adapter boundary for future integration.
- **Business rules:** Configurable framework/proficiency/workflow definitions, not hard-coded into page components.
- **Integration layer:** Mock HR/directory source, event outbox, API adapters and mock central reporting endpoint.
- **Observability:** Audit log, integration status and error states.
- **Privacy:** Test accounts and invented submissions only; no real staff assessment data in demos.

### Minimum API endpoints (illustrative)

```http
GET    /api/me
GET    /api/frameworks?profession=service-design&role=senior
GET    /api/skills/profile/{personId}
POST   /api/skills/self-assessments
GET    /api/cbp/cycles
POST   /api/cbp/attempts
POST   /api/cbp/attempts/{id}/submit
POST   /api/cbp/reviews/{id}/submit
POST   /api/cbp/attempts/{id}/moderate
POST   /api/cbp/attempts/{id}/publish
GET    /api/learning/catalogue
POST   /api/learning/enrolments
POST   /api/development/goals
GET    /api/reports/profession-capability
GET    /api/admin/audit
```

All routes must enforce permissions in the backend, not merely hide controls in the frontend.

## 12. Prototype delivery sequence

### Phase 1 — Demonstrate the connected model

Build role-based demo navigation, seeded staff and profession records, framework administration, a personal skills profile and a small L&D catalogue. Demonstrate the same skill appearing consistently across all three services.

### Phase 2 — CBP workflow

Build cycle setup, candidate application, two independent assessor reviews, joint moderation, audit history and outcome publication. Include a second attempt / re-submission example.

### Phase 3 — Development journey

Convert authorised feedback themes into user-controlled development goals; recommend mapped learning and show activity completion and reflected learning.

### Phase 4 — Profession insight and integration

Add aggregated profession dashboards, reporting suppression, mock identity import, mock reporting API, integration monitor and event log.

## 13. Prototype acceptance scenarios

1. **Candidate submission:** A candidate can complete all required skills and submit a versioned assessment, and cannot edit the submitted version.
2. **Independent scoring:** Assessor A and B can independently score the same candidate without seeing each other's unsubmitted ratings.
3. **Moderation history:** A moderator can see both original assessments and save a separate agreed final score using an allowed final value.
4. **Feedback publication:** A candidate sees only the approved, published outcome and feedback.
5. **Framework versioning:** Publishing a new version does not change the criteria attached to an earlier assessment.
6. **Skills gap:** A person can see their expected skills and a clearly sourced comparison with current evidence.
7. **Learning recommendation:** A learning resource is suggested because it maps to a selected skill goal, with the reason visible.
8. **Admin workflow:** An administrator can assign assessors and identify overdue cases.
9. **Reporting privacy:** Small-group or potentially identifying profession results are suppressed or generalised.
10. **Central reporting:** An API preview shows anonymised capability, CBP process and L&D summary data, not personal evidence or confidential assessor comments.
11. **Data provenance:** An imported role change is visible with a source and timestamp and does not overwrite historical assessments.
12. **Accessibility:** The main journeys work using a keyboard and screen reader, with validation errors expressed accessibly.

## 14. Out of scope for the initial prototypes

- Setting or changing CBP pay rules, allowance awards or payroll records.
- Making automated employment, promotion or formal performance-management decisions.
- Ingesting actual confidential staff submissions without approved safeguards.
- AI-generated scoring or moderation decisions.
- Enterprise-wide workforce planning and financial forecasting.
- Full HR, learning management system or departmental data migration.

## 15. Copy-ready GitHub Copilot implementation brief

> Build a functional, accessible prototype for three connected internal enabling services: (1) Capability-Based Pay (CBP) assessment management, (2) skills and capability management, and (3) learning and development management. Use this specification as the source of requirements. Implement a consistent interface with role-based demo personas (staff member, assessor, moderator, line manager, head of profession, L&D administrator, CBP administrator). Start with seeded fictional records, a versioned profession skills framework, a 0–3 final-score CBP workflow with independently submitted assessor reviews and joint moderation, a personal skills profile, and learning items mapped to skills. Keep CBP records, self-assessments and learning achievements distinct in the domain model. Build admin screens for frameworks, cycles, assignments and catalogue management. Add an audited event log and a mock API exposing privacy-safe aggregated data for central reporting. Make all workflows navigable with realistic empty, error, pending, submitted and completed states. Do not hard-code pay policy, use real staff data or automate assessment decisions. Provide a README, seed/reset command, API contracts and a clearly documented route through the main demo scenarios.

---

**Open policy and product decisions for a later iteration:** authoritative role and grade data sources; approved CBP eligibility and outcome rules; who may access which assessment records; formal moderation and appeal procedures; permitted candidate-to-manager sharing; retention schedules; reporting disclosure thresholds; and whether any existing learning catalogue or booking platform should remain the system of record.
