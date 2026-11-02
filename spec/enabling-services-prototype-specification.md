# Enabling services ecosystem — high-level prototype specification

**Status:** Concept / prototype brief  
**Audience:** Product, design, delivery, engineering and administrators  
**Purpose:** A high-level feature specification suitable for use with GitHub Copilot to develop interactive prototypes.

## 1. Vision

Create a connected ecosystem of reusable enabling services that support digital products throughout their lifecycle. Teams should not need to re-register products, repeatedly enter the same information, build bespoke feedback or measurement capabilities, or manually reconcile reports between systems.

A shared service and product record provides the context. A configurable rules engine determines applicability, requirements and enrolment actions. Teams activate and manage enabling services through a consistent interface. Administrators oversee the service portfolio, configurations, integrations and exceptions. Outputs flow into central reporting, assurance, insight and work management.

**Design principle:** Register and classify once; reuse information throughout the lifecycle; collect evidence through delivery; report centrally; trigger the next appropriate action.

## 2. Product ecosystem and boundaries

The prototype should be **solution-agnostic** in its underlying architecture. Existing products are examples of integrations rather than hard-coded dependencies.

| Capability | Existing or proposed product | Primary responsibility |
| --- | --- | --- |
| Service and product records | Service register / CMDB | Authoritative identifiers, ownership, type, channels and lifecycle context |
| Work and portfolio management | COMPASS | Work records, actions, RAID, performance and portfolio reporting |
| Applicability and automation | Proposed rules engine | Evaluate conditions and generate requirements, enrolments and actions |
| User feedback | Proposed feedback service | Per-page contextual feedback for all applicable digital services |
| User satisfaction | Proposed satisfaction service | Transaction and journey-end surveys, including email invitations |
| Analytics | Proposed centralised analytics capability | Aggregated product and service usage and performance |
| Accessibility | AISS | Accessibility issues and statements |
| Standards compliance | SHCA PowerApp initially; future central assurance product | Applicable standards, compliance returns, evidence and assurance |
| Service assessments | SAS | Assessment booking and management, with progressively deeper integration |
| Central reporting | COMPASS / reporting APIs | Combined performance, assurance, compliance, risks, actions and insight |

## 3. Core end-to-end experience

1. A team opens an existing **work, service or product** record using its persistent identifier.
2. The interface displays known data such as service type, lifecycle stage, owner, channels, technology, transaction characteristics and relevant journeys.
3. The rules engine evaluates applicability and displays required, recommended and not-applicable enabling services, with an explanation of each decision.
4. The team can activate eligible services or complete a generated action where human input is required.
5. Enabling services inherit the existing service and product identity instead of requiring duplicate registration.
6. Teams monitor setup, implementation, evidence, feedback, adoption and outstanding tasks in one place.
7. Administrators manage configuration, exceptions, service delivery and operating health.
8. Each enabling service exposes consistent data for central reporting and creates events when important conditions change.
9. Material changes, risks, issues and assurance outcomes can trigger additional work and bring a service back into the relevant delivery lifecycle activity.

### Shared service and product information

Use realistic seeded data for: `serviceId`, `productId`, `serviceOfferingId`, `workId`, name, description, owner, team, business area, service type (transactional, information, campaign, API), lifecycle stage, status, delivery channels, URLs, journeys, forms/form-builder use, personal-data characteristics, user groups, policy outcome, applicable standards and linked reporting identifiers.

Every integration should retain canonical IDs and show data provenance, last synchronised time and any mismatches. Do not assume that a product is always identical to an end-to-end service or service offering.

## 4. Prototype feature modules

### 4.1 User feedback service — all applicable services, per-page

**Purpose:** Reusable contextual feedback embedded in digital pages, without teams building their own collection and storage.

**Team-facing features**
- Enable feedback against an existing service/product record and associated domains or URLs.
- Preview a reusable component such as “Was this page useful?” with positive and negative options and optional qualitative feedback.
- Generate installation guidance for a script, component or SDK; demonstrate a simulated implementation.
- Automatically associate submissions with service ID, product ID, page URL/path, timestamp and journey where known.
- View an operational dashboard: responses, positive/negative trends, page breakdown, themes and feedback requiring investigation.
- Create a linked issue, insight or action from a feedback item, with clear ownership and status.
- Configure accessible copy and avoid collecting unnecessary personal information.

**Administrator features**
- Manage default questions, component versions, configuration templates and eligibility.
- Approve customisation and configure page exclusions, retention, moderation, spam controls and operational alerts.
- Monitor adoption across the portfolio, broken integrations, data quality and collection volumes.
- Manage users, permissions and audit logs.

**Reporting integration**
- Feedback volume, response distributions, trends, page-level hotspots, unresolved actions and thematic insight, grouped by service/product and reporting period.
- Report methodology and denominator limitations explicitly: feedback responses are not automatically representative of all users.

### 4.2 User satisfaction service — transactional services and journeys

**Purpose:** Consistent satisfaction measurement at the end of a transaction or journey, including email follow-up where appropriate.

**Team-facing features**
- Configure surveys for a named transactional service, journey or journey stage using existing records.
- Select an end-of-transaction screen, confirmation page, email invitation or other appropriate trigger.
- Preview an accessible survey with a standard scored question set and optional qualitative questions.
- Generate a completion-page embed or integration pattern for triggering an email invitation.
- Manage invitation status and avoid duplicate responses where feasible; support anonymous survey responses.
- See survey results by service, journey, channel and reporting period, with response volumes and trend charts.
- Create actions from significant deterioration in satisfaction or recurring issues.

**Administrator features**
- Centrally manage approved question banks, survey versions, scoring rules, language and accessibility requirements.
- Set retention, privacy, consent and anti-abuse configuration.
- Manage email templates, sending providers, throttling and delivery monitoring.
- Monitor coverage, collection quality and reporting comparability across services.

**Reporting integration**
- Satisfaction score, response count, response rate **where a reliable denominator exists**, channel, period, survey version and linked improvement actions.
- Preserve raw response history separately from calculated reporting aggregates.

### 4.3 Centralised analytics reporting

**Purpose:** Provide comparable, service-level performance information without manually gathering statistics from multiple analytics products.

**Team-facing features**
- Connect analytics sources to a service/product by confirming an existing property, stream or application identifier.
- View setup status, last successful data import and data gaps.
- Present service-level performance metrics relevant to service type: page views, unique users where meaningful, transactions, completion rate, average time to complete, uptime and engagement.
- Show trends and breakdowns by channel, journey and period where source data supports them.
- Annotate material changes, releases, incidents and known measurement limitations.

**Administrator features**
- Configure analytics connectors, authentication placeholders, metric mappings, validation and refresh schedules.
- Maintain canonical metric definitions, calculation rules, units and source provenance.
- Monitor connection failures, incomplete returns and inconsistent classification.
- Manage access to analytics data and aggregation controls.

**Reporting integration**
- Publish standardised performance aggregates to COMPASS/reporting APIs keyed to service/product IDs, period, metric identifier and source metadata.
- Never assume that distinct analytics sources produce directly comparable measures without documented definitions.

### 4.4 Accessibility — AISS enrolment and management

**Purpose:** Bring accessibility issue and statement management into the normal lifecycle of building and operating digital products.

**Team-facing features**
- Trigger an AISS enrolment requirement when a classified product enters the relevant build/pre-live activity.
- Reuse product name, URL, owner and classification from existing records.
- Display enrolment and accessibility statement status, issues, owners, planned fixes and review dates.
- Provide a linked action when enrolment requires manual completion rather than pretending the integration is automatic.
- Surface overdue reviews, unresolved issues and links to the relevant evidence.

**Administrator features**
- Configure applicability and enrolment rules, default reminders, escalation routes and exception handling.
- Monitor enrolment coverage, statement freshness and unresolved accessibility issues.

**Reporting integration**
- Enrolment status, statement status, issue counts/severity, overdue fixes and assurance indicators, with source-of-truth links to AISS.

### 4.5 DDT standards compliance and assurance

**Purpose:** Apply the right DDT standards to live services and products, avoiding locally reinvented applicability decisions.

**Team-facing features**
- Show which standards apply and **why**, based on product/service classification and effective rule versions.
- Display compliance status, required attestations, evidence and outstanding actions.
- Link to the existing SHCA PowerApp for current/interim compliance reporting.
- Show material changes that require reconsideration of applicability or compliance.

**Administrator features**
- Manage versioned applicability rules, exceptions, standards changes and classification quality.
- Monitor coverage, overdue returns and inconsistent assessments across the portfolio.
- In the future model, operate central product assurance with evidence management and review workflows.

**Reporting integration**
- Interim: extract or integrate SHCA results where supported.
- Future: a central product assurance capability exposes APIs for COMPASS compliance and assurance reporting.

### 4.6 Service assessments — SAS and assurance gates

**Purpose:** Trigger the right assessment requirement at the right point in delivery and track its completion.

**Team-facing features**
- Evaluate the assessment route from service characteristics, proposed work, lifecycle context and decision rules.
- **Now:** manually request/book assessments through SAS; may not be consistently connected to work tracking.
- **Interim:** create a visible “Book service assessment” action attached to the work record, with manual handoff to SAS and tracked completion.
- **Future:** manage integrated assessment workflows, scheduling, assessors, evidence requests, findings and actions, with data exchanged with relevant services.
- Reuse completed requirements and existing evidence to avoid collecting it twice.

**Administrator features**
- Configure routing policies, gates, exceptions, assessment types and lead-time guidance.
- Allocate assessors, coordinate availability and track assessments, outcomes and follow-up actions in the future-state prototype.

**Reporting integration**
- Assessment required/booked/completed status, due date, result, findings, outstanding actions and decision history.

### 4.7 Work, RAID, actions and project management — COMPASS

**Purpose:** Keep enabling-service requirements and outcomes within the same work context as planning, delivery and operational management.

**Team-facing features**
- Show generated actions in the work record alongside team-created tasks.
- Link actions to rules, requirements, risks, issues, assessments, products and services.
- Track action owner, due date, status, evidence, dependency and completion.
- Allow findings from feedback, analytics, accessibility, standards and assurance to create risks, issues or work items.
- Support lifecycle re-entry where a material change or emerging issue requires new activity.

**Administrator features**
- Configure standard action templates, escalation and overdue rules, reporting mappings and ownership defaults.
- Manage deduplication, retries, exception cases and cross-service linkage.

**Reporting integration**
- Cross-portfolio dashboards for work, risk, issue, action, decision, assurance and performance, with drill-through to source records.

## 5. Cross-cutting platform capabilities

### 5.1 Classification and applicability rules engine

- Use service/product attributes, work characteristics, lifecycle context and standards metadata as rule inputs.
- Support `required`, `recommended`, `not applicable`, and `needs review` outcomes.
- Explain each result: matched conditions, source policy/standard, rule version and effective date.
- Support rule draft, approval, publication, versioning, testing and rollback.
- Simulate a classification change and show which requirements, actions or enrolments are added, updated or withdrawn.
- Prevent duplicate enrolment actions; record when rules have previously been evaluated.
- Support exceptions with owner, justification, approver, expiry and review trigger.

### 5.2 Enrolment and implementation orchestration

- Present a single “Enable services” area within a service/product record.
- Distinguish: **not applicable**, **not enrolled**, **action required**, **pending**, **active**, **attention needed**, and **retired**.
- Offer one-click activation **only when a supported API integration exists**.
- Otherwise generate an owned task with clear manual instructions, expected evidence and a source-system link.
- Show configuration instructions, test connection, validation and activation history.
- Carry service IDs and ownership into the target enabling service.

### 5.3 Central administrative console

Provide an administrator experience with:
- Portfolio-wide list of services/products, classifications, owners and enrolment coverage.
- Configuration of enabling service catalogue entries, eligibility and required stages.
- Rules management, version control, approvals and simulated testing.
- Connector status, API integration logs, retry queues and failed synchronisations.
- User/role management (platform administrator, enabling-service administrator, service owner, team member, reader/assessor).
- Standard templates, permissions, retention policies and audit history.
- Operational dashboards covering adoption, exceptions, overdue actions and service health.

### 5.4 Central reporting and data integration

Design a **common reporting contract** for each enabling service rather than combining incompatible database schemas directly.

Minimum fields:

```json
{
  "eventId": "uuid",
  "eventType": "enabling-service.status.changed",
  "occurredAt": "2026-11-02T12:00:00Z",
  "sourceSystem": "feedback-service",
  "serviceId": "SVC-001",
  "productId": "PRD-001",
  "workId": "WRK-001",
  "enablingServiceId": "user-feedback",
  "status": "active",
  "ruleId": "RULE-001",
  "ruleVersion": 2,
  "recordUrl": "/services/SVC-001/enabling/user-feedback"
}
```

Illustrative event types: `service.classified`, `rule.evaluated`, `enrolment.required`, `enrolment.activated`, `action.created`, `assessment.required`, `assessment.completed`, `compliance.changed`, `accessibility.issue.overdue`, `feedback.trend.detected`, `satisfaction.score.changed`, `performance.threshold.breached`, `work.material-change.identified`.

Report views should cover:
- **Service overview:** enabling services, requirements, status and recent changes.
- **Portfolio overview:** coverage, compliance, risks, issues, outstanding actions and gaps.
- **Performance:** service metrics, trends and comparisons where definitions support them.
- **Assurance:** assessments, standards compliance, evidence quality and exceptions.
- **Signals and triggers:** relevant changes that have generated new actions or work.
- **Benefits and outcomes:** links from service performance and user experience back to intended policy/business outcomes where supported.

Expose source, measurement period, freshness and calculation method. Preserve historical records and snapshots for audit and trend analysis.

## 6. Worked prototype journeys

### Journey A — New transactional service moves into Build

1. Open an existing work record linked to a transactional service and product.
2. Show the classification, owner, relevant journey and current stage.
3. Evaluate rules: identify AISS enrolment and applicable pre-live assurance requirements.
4. Create a required AISS enrolment action or activate a simulated integration.
5. Display the service assessment route and assessment action at the applicable gate.
6. Show all generated actions, reasons, evidence requirements and dates in the work view.
7. As the service prepares for Run, show feedback and satisfaction setup and standards compliance enrolment as applicable.
8. Show the reporting feeds established for the service.

### Journey B — Existing live service changes classification

1. Select a live product and change a material attribute (for example, a new transactional journey or personal-data processing).
2. Re-evaluate applicability rules and show the difference between old and new obligations.
3. Create or revise actions and assurance requirements without duplicating existing records.
4. Flag any necessary reassessment or lifecycle activity.
5. Show the change in central assurance and reporting.

### Journey C — Falling satisfaction triggers improvement

1. Open a live transactional journey dashboard.
2. Simulate deteriorating satisfaction and increased negative feedback.
3. Generate a **signal** explaining the threshold or trend detected.
4. Let an authorised user confirm whether it warrants a risk, issue or improvement action.
5. Link the action to the service, journey, feedback evidence, work record and owner.
6. Show the item appearing in work/RAID management and reporting.
7. Demonstrate performance monitoring following the intervention.

### Journey D — Administrator oversees portfolio adoption

1. Open an administrator portfolio dashboard showing eligible and enrolled services.
2. Filter for services with missing feedback, AISS or standards reporting.
3. Inspect why a rule evaluated as it did and whether service data is incomplete.
4. Edit a draft rule, test it against sample products, approve and publish a new version.
5. Preview resulting new or changed actions.
6. View synchronisation failures and retry a simulated integration.
7. Review the updated coverage and compliance view.

## 7. Proposed prototype screens

| Screen | Primary users | What the prototype should demonstrate |
| --- | --- | --- |
| Enabling services portfolio | Administrators, portfolio leads | All services and products, eligibility, enrolment, adoption and alerts |
| Service/product overview | Service owners, delivery teams | Existing data, classification, lifecycle, work and enabling-service status |
| Enabling service catalogue | Delivery teams | Available, required and recommended services with reasons |
| Activation/configuration wizard | Delivery teams | Reuse existing records, configure, test and activate or create manual action |
| Feedback widget and results | End users and teams | Embedded per-page collection and contextual results |
| Satisfaction survey builder and results | Teams, administrators | Journey-end and email invitation configuration and reporting |
| Analytics dashboard | Teams, reporting users | Sources, key metrics, trends and data quality |
| Rules administration | Administrators | Conditions, versioning, simulation and approval |
| Actions and requirements | Teams, administrators | Triggered actions, evidence, owners, deadlines and progress |
| Central assurance overview | Assurers, service owners | Assessment, standards, accessibility and evidence position |
| Reporting and insight | Portfolio leads, governance | Joined-up indicators, alerts and drill-through |
| Integration monitoring | Administrators | Connector health, synchronisation history and errors |

## 8. Prototype design and interaction principles

- Use British English and sentence case throughout.
- Prefer the GOV.UK and DfE frontend design language and accessible interaction patterns.
- Demonstrate genuine interactive states: edit configuration, evaluate rules, create actions, enrol services and see dashboards update.
- Differentiate **real integrations**, **simulated integrations** and **manual handoffs** visibly.
- Give each decision an explanation and an authoritative source.
- Reuse service/product context across screens; do not force users to re-enter known data.
- Support multiple services, products and journeys with realistic differences in applicability.
- Make exceptions, missing data and failures first-class states, not hidden edge cases.
- Avoid overwhelming teams with unnecessary mandatory activity; use proportionate and contextual actions.
- Show how work can repeat, overlap, pause or return to earlier lifecycle stages rather than enforcing a waterfall.

## 9. Prototype data and architecture guidance

Build with local seeded data and mocked REST endpoints first; the prototypes must work without credentials for SAS, SHCA, AISS, COMPASS, analytics products or email providers.

Suggested domain objects:
`Organisation`, `Team`, `Person`, `Service`, `Product`, `ServiceOffering`, `Journey`, `Work`, `LifecycleState`, `Classification`, `Rule`, `RuleEvaluation`, `Requirement`, `RequirementApplication`, `EnablingService`, `Enrolment`, `Configuration`, `Action`, `Risk`, `Issue`, `Assessment`, `Evidence`, `ComplianceStatus`, `Metric`, `Measurement`, `Insight`, `Signal`, `Decision`, `Exception`, `Integration`, `IntegrationEvent`.

Suggested endpoints for the mock API:

```text
GET    /api/services
GET    /api/services/{serviceId}
GET    /api/services/{serviceId}/enabling-services
POST   /api/rules/evaluate
GET    /api/rules
POST   /api/rules/{ruleId}/simulate
POST   /api/enrolments
PATCH  /api/enrolments/{enrolmentId}
GET    /api/work/{workId}/actions
POST   /api/actions
GET    /api/feedback/summary?serviceId=...
GET    /api/satisfaction/summary?serviceId=...
GET    /api/analytics/summary?serviceId=...
GET    /api/reporting/portfolio
GET    /api/admin/integrations
GET    /api/events
```

For the prototype, store data in memory or local fixtures. Simulate event propagation and API connections with clear labels. Do not claim any live integration or automatically send emails or collect personal data.

## 10. Suggested build sequence for GitHub Copilot

**Prototype 1 — Connected service and enabling-service management**  
Build a seeded service/product register, service detail screen, enabling-service catalogue, classification and rule evaluation, activation states and generated actions.

**Prototype 2 — User feedback and satisfaction**  
Add working widget/survey previews, configuration screens, mocked responses, service-level reporting and administrator controls.

**Prototype 3 — Analytics and central reporting**  
Add mock analytics connectors, harmonised metrics, service and portfolio dashboards, filters and drill-through to source records.

**Prototype 4 — Assurance and lifecycle integration**  
Add AISS enrolment, standards compliance, SAS assessment actions, requirement/evidence reuse, risks/issues and material-change triggers.

**Prototype 5 — Administration and operating model**  
Add rule versioning, exceptions, connector monitoring, audit history, responsibilities and portfolio adoption views.

## 11. Copilot build prompt

> Build an interactive, accessible prototype of a connected DDT enabling services ecosystem using this Markdown specification as the product brief. Start with the shared domain model, seeded service/product records and reusable navigation. Create both delivery-team and administrator views. Demonstrate how a versioned rules engine evaluates service classification and lifecycle context to determine applicable enabling services, create actions, and support simulated enrolment. Include user feedback, user satisfaction, central analytics, AISS, SHCA/standards assurance, SAS assessment actions, and COMPASS work/RAID/reporting as connected capabilities. Preserve the same service, product and work identifiers throughout. Provide realistic mocked APIs, visible manual versus automatic integration states, persistent prototype interactions and an audit/event log. Use British English, sentence case and accessible GOV.UK/DfE-style UI patterns. Begin with Prototype 1 and organise the code so later modules can be implemented without reworking the shared data model.

---

**Important scope note:** This is a high-level prototype specification, not an approved target architecture or confirmation that the existing products expose the required APIs. The future integrations and automated enrolment capabilities should be treated as proposed behaviours and validated before production implementation.
