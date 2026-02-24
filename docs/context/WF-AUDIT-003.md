# WF-AUDIT-003 Research Context

## Ticket
- ID: `WF-AUDIT-003`
- Title: `Implement required Jobs and Activity workflow surfaces`
- Category: `spec-compliance`
- Priority: `high`
- Description: Add user-facing Jobs and Activity views with automation run inspection, retry/fix, and AI-change keep/recover flows required by the design spec.

## Relevant Files Field
- No explicit `relevantFiles` payload is present for `WF-AUDIT-003` in repository ticket metadata.
- Evidence:
  - `.super-ralph/workflow.db` (`category_review.suggested_tickets`) contains `WF-AUDIT-003` with `id/title/description/category/priority`.
  - `json_type(ticket, '$.relevantFiles')` resolves to null/empty for `WF-AUDIT-003`.
  - No existing `WF-AUDIT-003` artifacts were found in `.super-ralph/workflow.db` `research`, `plan`, or `report` tables.

## Paths Reviewed

| Path | Summary | Relevance to WF-AUDIT-003 |
| --- | --- | --- |
| `.super-ralph/generated/PROMPT.md` | Generated autonomous prompt with core-first/test/jj constraints and acceptance criteria requiring all spec views/workflows. | Governs implementation and quality expectations for Jobs/Activity surfaces. |
| `.super-ralph/generated/workflow.tsx` | Generated workflow wiring with `referenceFiles` set to generated prompt, `README.md`, and `docs`. | Confirms research input scope and Super Ralph run context. |
| `.super-ralph/workflow.db` | Source of truth for ticket metadata (`category_review.suggested_tickets`). | Confirms `WF-AUDIT-003` details and missing `relevantFiles`. |
| `README.md` | Repo overview; canonical pointers to design, engineering, references, and prompt docs. | Baseline orientation and source-of-truth entrypoint. |
| `AGENTS.md` | Repo-specific agent guardrails: core-first, Effect preference, jj commits, low-prescription decisions. | Implementation constraints for this ticket. |
| `docs/design.spec.md` | Defines required user-facing views (`Jobs`, `Activity`) and required workflows (`automation run -> inspect -> retry/fix`, `AI-applied update -> inspect -> keep/recover`). | Primary product requirements for this ticket. |
| `docs/engineering.choices.md` | Normative guardrails on stack and delivery discipline; core-first before UI integration. | Enforces sequence: core/test readiness before user-facing surfaces. |
| `docs/references.md` | Lists required external reference repos expected under `docs/references/*`. | Reference policy baseline for implementation decisions. |
| `docs/super-ralph.prompt.md` | Canonical non-generated prompt; mirrors generated constraints. | Reinforces delivery constraints and acceptance bar. |
| `docs/test-suite-findings.md` | Historical gap report for workflow category before core implementation landed. | Background on why audit/workflow tickets were generated. |
| `docs/context/WF-AUDIT-001.md` | Prior research for core workflow primitives (job/checkpoint) and persistence. | Upstream dependency context for Jobs/Activity surfaces. |
| `docs/context/WF-AUDIT-002.md` | Prior research for explicit workflow API routes + schema/migration compliance. | API/data prerequisites for Jobs/Activity inspection flows. |
| `docs/plans/WF-AUDIT-001.md` | TDD plan for initial job/checkpoint primitives and platform wiring. | Historical implementation pattern for automation/recovery flows. |
| `docs/plans/WF-AUDIT-002.md` | TDD plan for route/schema hardening including `job.listHistory`. | Historical route/schema pattern for run inspection flows. |
| `src/core/app/core-platform.ts` | Core facade exposing `inspectJobRun`, `listJobRunHistory`, `retryJob`, `create/keep/recoverCheckpoint`, and `listAuditTrail`. | Main backend surface candidates for Jobs/Activity UI wiring. |
| `src/core/services/job-service.ts` | Job run recording, inspection snapshot, retry transition, and history listing. | Core logic behind Jobs run inspection + retry/fix controls. |
| `src/core/services/checkpoint-service.ts` | Checkpoint create/keep/recover with transaction boundaries and audit transitions. | Core logic behind AI-change keep/recover flows. |
| `src/core/services/view-service.ts` | Saves named query/filter views (`view` entity) with audit transitions. | Existing primitive that can back user-facing view/filter persistence. |
| `src/core/domain/job.ts` | Job state model (`idle/running/succeeded/failed/retrying`) + retry metadata. | Canonical state model displayed in Jobs surface. |
| `src/core/domain/checkpoint.ts` | Checkpoint model with snapshot refs/entities and status lifecycle (`created/kept/recovered`). | Canonical state model displayed in AI recovery flows. |
| `src/core/domain/audit-transition.ts` | Audit transition object model and metadata support. | Base structure for Activity log entries. |
| `src/core/domain/view.ts` | Saved view/query/filter model for persisted user filters. | Potential storage model for Jobs/Activity surface filters. |
| `src/core/repositories/core-repository.ts` | Repository contract includes `listJobRunHistory?` and `listAuditTrail(...)`. | Interface-level read surfaces needed for Jobs/Activity lists. |
| `src/core/repositories/in-memory-core-repository.ts` | In-memory implementation of history and audit listing semantics. | Deterministic test backend for surface behavior. |
| `src/core/repositories/sqlite/sqlite-core-repository.ts` | SQLite implementation of `listJobRunHistory`, audit storage/listing, and transactions. | Durable backend behavior for Jobs/Activity views. |
| `src/core/database/migrations/001_core_schema.sql` | Base schema includes `job`, `checkpoint`, `view`, and `audit_transitions`. | Storage baseline for Jobs and Activity data. |
| `src/core/database/migrations/004_audit_entity_versions.sql` | Adds `entity_versions` and trigger from audit transitions. | Supports auditable, versioned activity over entity changes. |
| `src/core/database/migrations/005_job_run_history.sql` | Adds `job_run_history` table, constraints, indexes, and backfill. | Explicit run-history storage for Jobs status/history surface. |
| `src/api/workflows/contracts.ts` | Workflow route keys include `job.inspectRun`, `job.listHistory`, `job.retry`, checkpoint routes. | Existing API contracts for Jobs/AI recovery actions. |
| `src/api/workflows/routes.ts` | Route validators and path map for job/checkpoint operations with ISO timestamp coercion. | Existing API boundary used by UI/transport adapters. |
| `src/api/workflows/workflow-api.ts` | Adapter from routes to `CorePlatform`, including list history and recovery operations. | Existing bridge for route-level surface wiring. |
| `src/api/workflows/http-dispatch.ts` | Transport-agnostic HTTP dispatcher with sanitized error responses. | Current request/response boundary for user-facing integrations. |
| `src/api/workflows/errors.ts` | Error mapping (`validation`, `not_found`, `conflict`, `forbidden`) to status codes. | Determines UX-facing error handling semantics for Jobs/Activity actions. |
| `tests/integration/workflow-automation.integration.test.ts` | Integration coverage for job inspect/retry and checkpoint keep/recover behavior. | Behavioral proof for required workflows behind Jobs/Activity surfaces. |
| `tests/integration/workflow-api.integration.test.ts` | Integration coverage for `job run -> inspect -> retry -> listHistory` and checkpoint create/keep/recover via API handlers. | API-level proof for required workflows. |
| `tests/integration/workflow-api-http.integration.test.ts` | HTTP dispatcher integration with ISO-string payloads and sanitized errors. | Transport behavior relevant to user-facing surfaces. |
| `tests/integration/database-core-platform.integration.test.ts` | SQLite durability tests for `job_run_history`, checkpoint keep/recover, rollback safety, and audit consistency. | Persistence and reliability proof for Jobs/Activity data. |
| `tests/integration/core-platform.integration.test.ts` | Core platform integration smoke tests and transaction-boundary checks. | Confirms mutation boundary behavior for surface-triggered actions. |
| `tests/unit/core/services/job-service.test.ts` | Unit coverage for run outcomes, retry transitions, deterministic inspection, and history filtering. | Semantic contract for Jobs panel interactions. |
| `tests/unit/core/services/checkpoint-service.test.ts` | Unit coverage for create/keep/recover transitions, transaction usage, and failure behavior. | Semantic contract for AI keep/recover interactions. |
| `tests/unit/api/workflows/routes.test.ts` | Route-key manifest + validation tests including `job.listHistory` and ISO date coercion. | Route stability and payload contract for surface calls. |
| `tests/unit/core/repositories/sqlite-schema.test.ts` | Schema-level assertions for `job_run_history`, constraints, and audit/version tables. | Confirms data model used by Jobs/Activity surfaces. |
| `tests/unit/core/repositories/sqlite-core-repository.test.ts` | Repository-level tests for `job_run_history` persistence and ordered filtered queries. | Query semantics for Jobs history lists. |
| `package.json` | Test/typecheck scripts for core/api/workflow/db slices. | Verification command source for ticket delivery. |
| `docs/references/` | Directory not present locally in this workspace. | External reference repos listed by policy are unavailable in-repo for this ticket. |

## Spec Requirements Extracted for WF-AUDIT-003

### Direct requirements from `docs/design.spec.md`
- Required user-facing view: `Jobs` with automation status/history/run controls.
- Required user-facing view: `Activity` as auditable log of AI changes and actions.
- Required workflow: `Automation run -> inspect -> retry/fix`.
- Required workflow: `AI-applied update -> inspect -> keep/recover`.

### Scope boundaries and delivery constraints
- AI-applied writes must be auditable and reversible.
- Core-first is mandatory before UI integration (`docs/engineering.choices.md`, `AGENTS.md`).
- Acceptance bar requires required views/workflows to exist and be usable.

## Current Implementation Snapshot (Pre-WF-AUDIT-003)

| Requirement area | Current status | Evidence |
| --- | --- | --- |
| Job lifecycle core logic (`inspect`, `retry`, run history) | Implemented | `src/core/services/job-service.ts`, `src/core/app/core-platform.ts`, related unit/integration tests |
| AI keep/recover core logic | Implemented | `src/core/services/checkpoint-service.ts`, `src/core/app/core-platform.ts`, related unit/integration tests |
| Persisted job history | Implemented (`job_run_history`) | `src/core/database/migrations/005_job_run_history.sql`, sqlite repository + schema tests |
| Auditable transition log | Implemented (`audit_transitions`, `entity_versions`) | migrations `001` + `004`, repository `listAuditTrail`, DB tests |
| API routes for job/checkpoint workflows | Implemented | `src/api/workflows/contracts.ts`, `src/api/workflows/routes.ts`, `src/api/workflows/workflow-api.ts` |
| User-facing Jobs view | Not implemented in current repo | No UI/app surface files exist under `src` for rendering view-level workflows |
| User-facing Activity view | Not implemented in current repo | No UI/activity list rendering or dedicated activity API route layer |

## Key Gaps to Address in WF-AUDIT-003
1. No present UI shell/components to expose Jobs and Activity as user-facing views.
2. No dedicated API route for a generalized Activity feed despite `listAuditTrail` existing in `CorePlatform`.
3. Jobs controls/actions exist at core/API workflow route level, but there is no user-facing orchestration layer for inspect/retry/fix flows.
4. Keep/recover flows exist at checkpoint APIs, but there is no user-facing Activity context joining AI changes with recovery actions.
5. Existing `view`/`saveView` primitives are not yet wired to Jobs/Activity surface-level saved filters.

## Derived File Focus for WF-AUDIT-003 Implementation
(derived because ticket metadata has no `relevantFiles`)

### Primary implementation targets
- `src/core/app/core-platform.ts`
- `src/core/services/job-service.ts`
- `src/core/services/checkpoint-service.ts`
- `src/core/services/view-service.ts`
- `src/api/workflows/contracts.ts`
- `src/api/workflows/routes.ts`
- `src/api/workflows/workflow-api.ts`
- `src/api/workflows/http-dispatch.ts`

### Persistence/query support (for Jobs + Activity data)
- `src/core/repositories/core-repository.ts`
- `src/core/repositories/in-memory-core-repository.ts`
- `src/core/repositories/sqlite/sqlite-core-repository.ts`
- `src/core/database/migrations/004_audit_entity_versions.sql`
- `src/core/database/migrations/005_job_run_history.sql`

### Likely new UI/app surface area (currently absent)
- `src/ui/**` or equivalent app-layer directory (not yet present in repository)
- Routing/state wiring for `Jobs` and `Activity` views
- UI adapters calling existing workflow API routes for inspect/retry/keep/recover

### Regression and new tests to anchor
- `tests/integration/workflow-automation.integration.test.ts`
- `tests/integration/workflow-api.integration.test.ts`
- `tests/integration/workflow-api-http.integration.test.ts`
- `tests/integration/database-core-platform.integration.test.ts`
- `tests/unit/core/services/job-service.test.ts`
- `tests/unit/core/services/checkpoint-service.test.ts`
- `tests/unit/api/workflows/routes.test.ts`

## Implementation Ambiguities To Resolve During Planning
1. Activity scope: whether feed should include all `audit_transitions` or only AI-authored/AI-related changes.
2. Jobs "run controls": whether view should allow only `retry` and inspect/history, or also manual `create`/`recordRun` operations.
3. Recovery UX linkage: whether keep/recover actions should be initiated from Jobs failures, Activity entries, or both.
4. Surface architecture: no existing frontend structure is present; need to choose and bootstrap minimal app/UI boundaries while preserving core-first.

## Suggested Verification Commands (for changed slices)
- `bun run typecheck`
- `bun run test:integration:workflow`
- `bun run test:integration:api`
- `bun run test:integration:db`
- `bun test tests/unit/core/services/job-service.test.ts`
- `bun test tests/unit/core/services/checkpoint-service.test.ts`
- `bun test tests/unit/api/workflows/routes.test.ts`
