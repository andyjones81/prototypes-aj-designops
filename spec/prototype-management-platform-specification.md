# Prototype management platform — prototype specification

**Status:** Proposed prototype specification  
**Version:** 0.1  
**Date:** 2 November 2026  
**Audience:** DesignOps, interaction designers, service designers, content designers, user researchers, developers, platform administrators, and GitHub Copilot  
**Scope:** A self-service prototype management product for UK government teams, initially supporting GOV.UK Prototype Kit and DfE-branded prototypes, GitHub source control and deployment to Microsoft Azure.

---

## 1. Vision

Provide one place to create, manage, develop, deploy, share, monitor and retire service prototypes. A designer should not need to understand GitHub organisation administration, Azure subscriptions, resource groups, CI/CD secrets or hosting configuration to get a working prototype.

**Core promise:** Create a prototype once; automatically establish its source repository, deployment environment, security configuration, lifecycle record and management dashboard. Continue working in VS Code and GitHub while the platform keeps deployment and activity information current.

The platform **orchestrates** existing tools. It does not replace GitHub, VS Code or Azure, and should not introduce an alternative code editor or source-control system.

### Intended outcomes

- Reduce time and specialist assistance needed to publish a prototype.
- Maintain secure, discoverable, reusable prototypes with clear ownership.
- Make the deployment state and history understandable to designers.
- Support research and collaboration through safe sharing and access management.
- Provide administrators with portfolio-wide oversight, costs, hygiene and retirement workflows.
- Connect prototypes to the organisation's existing work, service, product and reporting records.

## 2. Core user journeys

### Journey A — Create and publish a prototype

1. Designer signs in via organisational single sign-on.
2. Selects **Create prototype**.
3. Chooses an approved template: GOV.UK Prototype Kit, GOV.UK Prototype Kit with DfE branding, or another administrator-approved template.
4. Enters name, purpose, owning team, service/product, work reference, repository visibility and authorised collaborators. Existing service, product and team data should be searchable and pre-populated where possible.
5. Reviews automatically suggested settings: region, deployment profile, access policy, environment size, expiry/review date and default branch.
6. Selects **Create** and sees an understandable provisioning checklist: validate → create record → create GitHub repository → seed template → configure deployment workflow → provision Azure hosting → deploy → run health check → ready.
7. Arrives at the prototype detail page containing the working URL, GitHub repository, deployment status, setup guidance and a **Open in VS Code** action.
8. Can share the prototype with authorised researchers or stakeholders without having to manage Azure directly.

**Required behaviour:** Provisioning must be retryable, display failures per step and avoid leaving duplicate repositories/resources after a retry.

### Journey B — Develop locally in VS Code

1. Designer opens the prototype from the dashboard.
2. Selects **Open in VS Code** or **Copy clone command**.
3. Platform provides GitHub URL and short setup instructions, including local prerequisites, clone, dependency installation and local run command.
4. Designer edits pages, components and routes in VS Code, optionally assisted by GitHub Copilot.
5. Designer commits and pushes changes to GitHub, or opens a pull request.
6. The platform detects the GitHub event, shows the commit/branch and watches the corresponding build and deployment workflow.
7. Once deployed, the prototype dashboard displays the new deployed version, URL, deployment timestamp and result.
8. On failure, the designer sees a plain-language error summary and a link to the underlying GitHub Actions run.

**Important:** The platform can observe remote repository changes, but **cannot know about uncommitted local VS Code edits** unless an explicitly installed, authorised local integration is built. The prototype must not pretend to monitor unsaved files.

### Journey C — Collaborate, test and share

1. Prototype owner invites colleagues to collaborate on code or share a protected preview for research.
2. Access is granted based on roles, policy and supported hosting mechanisms.
3. Collaborators can view the appropriate environment; contributors can open GitHub and submit changes according to repository permissions.
4. Owner can create a temporary research access route with an expiry date and revoke it early.
5. Platform records the sharing change and provides a public-facing research URL only where permitted by policy.

### Journey D — Administrator manages the estate

1. Administrator views the prototype portfolio with filters for ownership, business area, status, framework, activity, expiry, hosting and deployment failures.
2. Can inspect individual provisioning and deployment histories, GitHub links, Azure resource mapping, access posture and policy exceptions.
3. Can configure approved templates, organisation defaults, cost limits, allowed environments, retention, repository policy and deployment controls.
4. Can identify abandoned, failing, unsecured or unowned prototypes.
5. Can suspend, archive, transfer ownership, restore or decommission prototypes through controlled actions.

---

## 3. Prototype product areas

### 3.1 Designer dashboard — *My prototypes*

**Features**

- Cards and table views: prototype name, service/product, owner, last update, latest deployment, health, expiry and sharing status.
- Search and filter by team, service, status, technology and template.
- Primary actions: **Create**, **Open prototype**, **Open repository**, **Open in VS Code**, **View deployments**, **Manage access**.
- Notifications for provisioning complete, deployment failed, access expiry and retirement review.
- Clear distinction between **source changed**, **build running**, **deploying**, **deployed** and **failed**.
- A personal activity feed summarising changes across owned prototypes.

**Empty state:** An inviting introduction with a create action and an example of the resulting workflow.

### 3.2 Creation wizard

**Fields and behaviours**

- Prototype name, slug, purpose and description.
- Template and version, chosen from an approved catalogue.
- Link to existing service/product and work item; allow an explicitly marked standalone/unlinked prototype with justification.
- Team, owner and contributors from organisational identity data.
- Repository organisation and naming convention, selected according to policy.
- Environment profile (for example, low-cost development/research); Azure region and resource choices derived from admin policy.
- Access mode: internal-only by default; controlled research sharing where approved.
- Intended end date, review date, estimated usage and optional tags.
- Preview summary of the resources and settings that will be created, including indicative cost category rather than invented monetary estimates.
- Creation progress and recoverable errors.

**Template catalogue**

- GOV.UK Prototype Kit (Node.js server application).
- DfE-branded GOV.UK Prototype Kit (approved theme/components and example pages).
- Extensible template definitions for future Node.js, ASP.NET Core and other frameworks.
- Admin-managed version pinning, documentation, licences, health checks, required files, startup commands and deployment recipes.

### 3.3 Prototype detail workspace

Tabs or clear sections:

**Overview:** live URL, current state, owner/team, linked service/product/work, technology, last deployed commit, most recent deployment and expiry.

**Source:** repository URL, default branch, last commit, commit author, open pull requests, workflow and VS Code setup.

**Deployments:** current and historical builds, branch, commit SHA, triggering event, start/end time, status, environment, deployment URL, health outcome and errors.

**Environments:** live research environment, optional previews, configuration summary, cost profile, restart/redeploy actions and environment status.

**Access:** collaborators, sharing method, expiry, revoked access and audit trail; never display secrets in clear text.

**Settings:** metadata, team, policies, retention, ownership transfer and decommission.

**Activity:** timeline of user actions, repository events, workflows and platform operations.

### 3.4 GitHub connection and source management

- Connect a centrally authorised GitHub organisation, preferably through a GitHub App with scoped permissions.
- Create repositories from approved templates and configure standard README, `.gitignore`, licensing and documentation.
- Seed a reusable GitHub Actions workflow and add relevant environment configuration.
- Assign teams or repository collaborators according to organisational policy.
- Show default branch, commits, pull requests, branch protections and workflow links.
- Receive GitHub webhooks for push, pull request and relevant workflow/deployment events; use API reconciliation if events are missed.
- Make event delivery idempotent, signed and auditable; securely store tokens and use least-privilege permissions.
- Offer **Open on GitHub**, **Clone repository** and **Open in VS Code** actions.
- Optional later capability: create an issue, branch or pull request from a designer-facing UI without duplicating GitHub functionality.

**Status model:** Created → Repository ready → Provisioning environment → Deploying → Ready; subsequent deployments: Queued → Building → Deploying → Healthy / Failed / Cancelled. Distinguish application health from CI/CD result.

### 3.5 Azure environment provisioning

- Administrators connect pre-approved subscriptions/resource groups and configure provisioning policy.
- Creation provisions a supported hosting environment, environment variables, identity configuration, deployment credentials and monitoring.
- Use infrastructure-as-code for repeatability and drift detection.
- Support environment-specific settings and private secrets stored in appropriate secret management, not application database plaintext.
- Display resource names, region, plan, URL, runtime, deployment state and health in read-only designer views.
- Show relevant provisioning and hosting errors with administrator escalation links.
- Restrict destructive or high-cost operations to approved roles.

**Recommended initial hosting target:** Azure App Service for the standard, server-rendered GOV.UK Prototype Kit, deployed using GitHub Actions with Azure federated identity/OIDC where supported. The GOV.UK Prototype Kit requires a Node.js-capable host; do not assume purely static hosting is suitable. The platform may introduce Azure Static Web Apps for genuinely static templates in a later iteration.

### 3.6 Continuous deployment and monitoring

- Configurable deployment trigger: push to approved branch, merge to main, manual retry, or authorised manual deploy.
- Validate template, install dependencies, run build/test checks, deploy, then run an HTTP health check.
- Show a visual pipeline and event timeline with timestamps, commit and actor.
- Display deployment result using GitHub Actions/API evidence; never mark a deployment successful solely because a push event occurred.
- Notify owner of failure, recovery or expiry.
- Provide direct links to actionable GitHub Actions log and Azure diagnostics.
- Show last known good deployment and allow a controlled rollback strategy (for example, redeploy an earlier known-good commit), subject to template support.
- Poll/reconcile for state changes in addition to webhooks; handle duplicate, late and out-of-order events.
- Support preview deployments as an extension; ensure preview URLs have the same appropriate protection as the main environment.

### 3.7 Access and research sharing

- Default protected access for published prototypes.
- GOV.UK Prototype Kit environment configuration must include production mode and an approved password/access protection mechanism when published; do not rely on a hidden URL alone.
- Provide two distinct permissions models: **management access** to the platform/repository and **viewer access** to the hosted prototype.
- Support time-limited sharing where compatible with policy and implementation; revoke or rotate access without code changes.
- Avoid storing participant identities unnecessarily; use synthetic/test data by default.
- Optional future capability: one-click research session links, provided a suitable secure access mechanism is implemented.
- Prominent prototype banner and avoidance of real service branding confusion.

### 3.8 Administration console

**Estate dashboard**

- Total active, provisioning, failed, suspended, expiring and archived prototypes.
- Breakdown by team, directorate, linked service, template, GitHub organisation and Azure environment.
- Deployment success/failure trend; inactive repositories and environments; ownership gaps.
- Hosting resource/cost information where available, with transparent estimation and billing-data limitations.

**Management functions**

- Manage users, administrators, teams and delegated permissions.
- Configure template catalogue, supported versions, approved GitHub organisations, Azure tenants/subscriptions, regions and plans.
- Configure naming, tags, secure defaults, deployment branch strategy, expiry and review periods.
- Manage central GitHub App and Azure connections and connection health.
- Set quotas and approval thresholds for resource creation or exceptions.
- Reconcile orphaned repositories, failed provisioning jobs and Azure resources.
- Suspend deployments, transfer ownership, reset configuration and archive/restore/decommission prototypes.
- Track policy exceptions, changes and audit records.

### 3.9 Retirement and lifecycle management

- Scheduled review of prototypes that are unused, expired or no longer linked to active work.
- Owner notified before automatic actions; administrative oversight for exceptions.
- States: Draft, Provisioning, Active, Suspended, Archived, Decommissioned, Failed (implementation states may be modelled separately from lifecycle states).
- Archive preserves approved source/history and key metadata; remove hosting resources where authorised to reduce cost.
- Decommission workflow includes impact check, access removal, resource deletion, repository archive/delete decision and audit record.
- Maintain appropriate retention and evidence of who authorised destructive actions.

---

## 4. Integration with existing organisational records

A prototype should be connected to an existing record, not create a second competing service register.

**Suggested references**

- `service_id` / `product_id` — from the authoritative service and product register, where available.
- `work_id` — associated demand/work item in the delivery platform (such as COMPASS).
- `team_id`, `owner_id` — authoritative organisation and identity data.
- `prototype_id` — immutable identifier generated by the prototype manager.
- `repository_id` — GitHub repository identity and URL.
- `environment_id` — Azure resource mapping.

**Integration patterns**

- Search and select existing services/products, teams and work items during creation.
- Keep metadata in sync using APIs/events and explicit ownership of authoritative fields.
- Expose a read-only API/events feed for portfolio reporting (prototype count, ownership, deployment health, last activity, expiry, cost where available).
- Report product/service linkage back to the central service register or COMPASS without making these products mandatory dependencies for the prototype's own operation.
- Future rules-driven triggers: new delivery work suggests a prototype; material service change prompts prototype review; decommissioning work prompts archive/retirement review.

**Important boundary:** The prototype manager owns prototype metadata and operations; GitHub owns source and source history; Azure owns hosting state; the service register owns service/product identity; work management owns work records.

## 5. Conceptual data model

| Entity | Purpose | Representative fields |
| --- | --- | --- |
| Prototype | Canonical managed record | id, name, slug, description, status, template_id, owner_id, team_id, service_id, product_id, work_id, created_at, review_at |
| Prototype template | Approved starter/recipe | id, name, framework, version, repository_template, runtime, build_command, start_command, deployment_profile |
| Repository connection | Source control association | id, prototype_id, provider, organisation, repository_id, URL, default_branch, latest_commit_sha |
| Environment | Target hosting instance | id, prototype_id, provider, environment_type, azure_resource_id, region, URL, health_status, access_policy_id |
| Deployment | Attempt/result for a version | id, prototype_id, environment_id, commit_sha, branch, workflow_run_id, status, queued_at, started_at, finished_at, deployed_url, error_summary |
| Repository event | Received and normalised event | id, delivery_id, prototype_id, event_type, actor, commit_sha, received_at, processed_at |
| Provisioning job | Orchestration and recovery | id, prototype_id, step, status, attempt, error_code, correlation_id |
| Access grant | Authorised sharing | id, prototype_id, access_type, role, recipient_reference, expires_at, revoked_at |
| Team membership | Authorisation context | team_id, person_id, role, source |
| Configuration policy | Approved platform defaults | id, allowed_templates, regions, quotas, expiry_days, deployment_policy |
| Audit event | Traceable administrative activity | id, actor_id, action, entity_type, entity_id, occurred_at, result |
| Usage/cost snapshot | Optional operational insight | id, prototype_id, environment_id, collected_at, metric_type, value, source |

Every deployment should preserve the immutable **commit SHA** and link to the originating build/workflow; a displayed "latest commit" must not be confused with "currently deployed commit".

## 6. Logical architecture

```text
                      DESIGNER / ADMIN INTERFACE
                      (prototype manager web app)
                                |
               +----------------+----------------+
               |                                 |
        Prototype management API           Admin / policy API
               |                                 |
               +----------------+----------------+
                                |
                Orchestration and event service
                                |
                  +-------------+-------------+
                  |                           |
             GitHub App / API             Azure control APIs
                  |                           |
          Template repositories          Resource provisioning
          Git commits / PRs              Azure App Service
          GitHub Actions                 Hosting + diagnostics
                  |                           |
                  +---------- deployments ---+
                                |
                   Webhooks + reconciliation
                                |
                 Deployment / activity timeline
                                |
                Central reporting and integration
                 (service register / COMPASS)
```

**Recommended prototype implementation (illustrative, not mandatory):**

- Frontend: ASP.NET Core Razor/Blazor or React, styled using GOV.UK Frontend/DfE Frontend.
- Backend: ASP.NET Core Web API or Node.js API.
- Data: SQLite for mock demo; PostgreSQL or Azure SQL for a hosted implementation.
- Authentication: Microsoft Entra ID for staff; local mocked identities in demo mode.
- Provisioning: asynchronous jobs and durable state, with infrastructure-as-code templates.
- GitHub: GitHub App and webhook receiver, with fine-grained permissions and signature verification.
- Azure: ARM/Bicep or Terraform-based provisioning and Azure management APIs.
- Deployment: GitHub Actions using federated identity to Azure where feasible.
- Observability: structured logs, correlation IDs, deployment event records and health checks.

**Prototype mode:** Integrations must be replaceable with deterministic mock adapters so GitHub Copilot can build a convincing demonstration without credentials, subscription access or accidental cloud spending. A simulated provisioning run must be visibly labelled **Demo** and not represented as a real successful deployment.

## 7. Principal UI screens to prototype

1. **My prototypes** — searchable list/cards, statuses and last activity.
2. **Create prototype** — template chooser, service/work lookup and configuration wizard.
3. **Creation progress** — end-to-end provisioning timeline, errors and retries.
4. **Prototype overview** — live URL, repo, environment, owner, actions and health.
5. **Source and VS Code** — clone/copy/open guidance, branches, commits and PRs.
6. **Deployment timeline** — GitHub event → build → Azure deployment → health check, with current deployment emphasised.
7. **Access and sharing** — viewer access, collaborators, temporary links and revocation.
8. **Admin portfolio** — filters, policy posture, inactivity, failed deployments, costs and expiry.
9. **Admin templates and policies** — approved starter kits, environment defaults, organisation connections and quotas.
10. **Archive / decommission** — impact, ownership, confirmation and audit.

### Example dashboard card

```text
Apply for transport assistance                ACTIVE / HEALTHY
Service: Transport support   Team: Transport digital
Template: DfE Prototype Kit  |  Owner: Designer A
Repository: github.com/organisation/transport-assistance-prototype
Live preview: transport-assistance.[host]
Latest GitHub commit: a13d9f2 — 10:42
Deployed version:      a13d9f2 — 10:45
Last action: Deployment successful

[Open prototype] [Open in VS Code] [View deployments] [Manage]
```

## 8. Permissions

| Role | Typical rights |
| --- | --- |
| Designer / owner | Create and manage owned prototypes, view deployments, invite permitted collaborators, request archive |
| Contributor | Read permitted prototype metadata, contribute code via GitHub permissions, view builds |
| Researcher / stakeholder | Open authorised prototype previews; no source or infrastructure access by default |
| Team lead | View team portfolio, approve ownership transfers or sharing exceptions if policy allows |
| DesignOps administrator | Templates, platform policies, portfolio, provisioning recovery, retirement and support |
| Platform administrator | GitHub/Azure connections, security, infrastructure, quotas, secrets and privileged operations |
| Reporting consumer | Read approved aggregate/metadata APIs only |

Use least privilege. Platform roles do not automatically grant GitHub repository write permissions or Azure subscription access; permission sync must be explicit.

## 9. Functional requirements and acceptance scenarios

**PM-001 — Create from template.** Given an authenticated designer and approved template, when a valid creation request is submitted, a prototype record and provisioning job are created with a unique identifier and visible progress.

**PM-002 — No manual infrastructure requirement.** The designer can reach the live prototype without manually creating a GitHub repo, configuring a workflow or accessing the Azure portal.

**PM-003 — GitHub traceability.** A prototype displays the correct repository, branch, last commit and direct source links, including cases where a commit is newer than the deployed version.

**PM-004 — VS Code workflow.** The detail page offers a working clone command and setup instructions; after a push to the configured branch, a webhook or reconciliation updates activity status.

**PM-005 — Deployment tracking.** The UI displays queued, build, deployment, success/failure and health states, with timestamps and links to genuine workflow runs when using live integrations.

**PM-006 — Failure handling.** A failed build is shown as failed, with an error summary; it must not incorrectly replace the last known good deployment.

**PM-007 — Access control.** Unauthorised staff cannot manage another team's prototype; sharing grants have clear owner, purpose and expiry.

**PM-008 — Administration.** An administrator can find prototypes with expired review dates, failed deployments, missing ownership or inactive repositories.

**PM-009 — Integration.** Prototype records link to existing service/product/work IDs and expose status changes to an integration consumer.

**PM-010 — Retirement.** Approved archive/decommission actions update the platform record, hosting resources and source preservation state with an audit trail.

**PM-011 — Idempotency.** Retried webhooks and provisioning steps do not create duplicate deployment records, repositories or Azure resources.

**PM-012 — Safe demonstration.** Mock mode cannot contact live GitHub or Azure, spend money or report simulated changes as live operations.

## 10. Suggested delivery slices

### Slice 1 — Interactive end-to-end demonstration

Build the full clickable journey with mock adapters and seeded data. Include My prototypes, creation wizard, progress, detail, repository, environment, deployment timeline and admin portfolio. Demonstrate a simulated VS Code push, GitHub Actions run, successful deploy and failure/retry, clearly labelled as simulations.

### Slice 2 — Real GitHub integration

Implement secure GitHub App authentication, repository creation from template, repository links, GitHub webhooks, commit/PR information and workflow status. Use a sandbox organisation and least-privilege app installation.

### Slice 3 — Real Azure deployments

Provision restricted non-production Azure hosting from approved templates; automate deployment via GitHub Actions; surface environment health, URLs, retries, access and operational information. Add cost guardrails and cloud resource cleanup.

### Slice 4 — Organisational scale

Add service/work integration, delegated team administration, portfolio reporting, expiry management, audits, quotas, approved template upgrades, collaboration and decommissioning.

## 11. Non-functional requirements

- **Accessibility:** WCAG 2.2 AA for the management interface; use GOV.UK/DfE components and plain-language error handling.
- **Security:** organisational SSO, least privilege, protected previews, webhook signature verification, non-public tokens, secret rotation and meaningful audit trails.
- **Privacy:** no production personal data in prototypes; guidance and controls for synthetic test data.
- **Reliability:** asynchronous retryable operations and accurate state reconciliation after missed webhooks or partial failures.
- **Performance:** responsive dashboard; provisioning should report real progress rather than show a blocking spinner.
- **Cost and sustainability:** low-cost default configurations, idle-resource review, quotas, expiry and administrator visibility; do not assert zero cost without checking Azure billing and relevant quotas.
- **Interoperability:** documented APIs, webhooks/events, template plugins, decoupled GitHub/Azure adapters and portable metadata.
- **Ownership:** each prototype must have a responsible team and owner; transfer and succession rules are required.
- **Supportability:** clear diagnostic correlation IDs, admin recovery tools and structured logs.

## 12. Things the prototype must not imply

- That pushing a commit guarantees a successful deployment.
- That local uncommitted VS Code edits are visible to the platform.
- That a browser link can safely bypass installation, Git authentication or local setup requirements.
- That a static-only hosting service will run the standard server-rendered GOV.UK Prototype Kit unchanged.
- That repository membership automatically provides Azure or preview access.
- That Azure App Service, GitHub Actions or related cloud resources will always be free.
- That prototypes can contain live user data or are production-ready services.

## 13. GitHub Copilot build brief

> Build a high-fidelity, responsive prototype management platform called **Prototype Manager**. It is a self-service product for government service designers to create GOV.UK/DfE prototypes, automatically set up GitHub repositories, configure Azure App Service deployment, work in VS Code and monitor commits, CI/CD and hosted prototype health from a single dashboard. Create realistic designer and administrator experiences. Use accessible GOV.UK/DfE design patterns, British English and sentence-case UI labels. Implement seeded mock data and interface-based mock providers for GitHub, Azure and service/work lookups. Include: My prototypes dashboard; create wizard; provisioning status; prototype overview; source/VS Code tab; deployment timeline; access and sharing; admin estate; templates/policies; and retirement. Demonstrate both a successful commit-to-deployment flow and a failed deployment. Ensure the UI distinguishes latest source commit from deployed commit, mock from live data, and platform management permissions from hosted-prototype access. Structure the app so the mock integrations can later be replaced with authenticated GitHub App, GitHub Actions, Azure resource-management and organisational-service APIs. Do not require live credentials for the prototype to run.

## 14. External implementation references

- GOV.UK Prototype Kit, publishing: https://prototype-kit.service.gov.uk/publishing/
- GOV.UK Prototype Kit, getting started: https://prototype-kit.service.gov.uk/install/getting-started/
- DfE prototyping guidance: https://design.education.gov.uk/design-system/prototyping
- Azure App Service, GitHub Actions deployment: https://learn.microsoft.com/en-gb/azure/app-service/deploy-github-actions
- GitHub Docs, deploying Node.js to Azure App Service: https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/nodejs-to-azure-app-service
- Azure Static Web Apps preview environments (for eligible static templates, not a default host for GOV.UK Prototype Kit): https://learn.microsoft.com/en-us/azure/static-web-apps/named-environments

---

**Prototype principle:** The designer manages the prototype, not the infrastructure. GitHub remains the source of truth for code; Azure runs the prototype; the management platform provides coordination, observability and control.
