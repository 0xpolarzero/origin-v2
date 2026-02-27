# WF-REV-003 Research Context

## Ticket
- ID: `WF-REV-003`
- Title: `Unify transaction ownership for mutating workflow operations`
- Category: `workflow`
- Priority: `medium`
- Description: `Refactor transaction boundaries so either CorePlatform or individual services own withTransaction, but not both. Validate with workflow/api/db integration suites to ensure rollback semantics remain unchanged.`

## Relevant Files Field
- Ticket metadata source: `.super-ralph/workflow.db` (`category_review.suggested_tickets`).
- `relevantFiles` is absent for `WF-REV-003` (`json_type`/`json_extract` are null/empty).

Query used:

```sql
SELECT
  category_id,
  json_extract(value,'$.id') AS id,
  json_extract(value,'$.title') AS title,
  json_extract(value,'$.description') AS description,
  json_extract(value,'$.category') AS category,
  json_extract(value,'$.priority') AS priority,
  json_type(value,'$.relevantFiles') AS relevant_type,
  json_extract(value,'$.relevantFiles') AS relevant_files
FROM category_review, json_each(category_review.suggested_tickets)
WHERE json_extract(value,'$.id')='WF-REV-003';
```

## Paths Reviewed

| Path | Summary | Relevance to WF-REV-003 |
| --- | --- | --- |
| `.super-ralph/generated/PROMPT.md` | Generated autonomous prompt constraints (core-first, tests/typecheck, jj checkpoints). | Governs delivery/verification expectations for this refactor. |
| `README.md` | Repo map and canonical contract pointers. | Confirms authoritative docs + contract location. |
| `docs/design.spec.md` | Requires reliable workflow execution and auditable/recoverable AI writes. | Transaction refactor must preserve reliability/recovery semantics. |
| `docs/engineering.choices.md` | Deterministic core logic and side effects at boundaries. | Supports making a single clear transaction boundary owner. |
| `docs/references.md` | External references policy. | Confirms expected reference repos; `docs/references/` is currently absent in this workspace. |
| `docs/super-ralph.prompt.md` | Same build constraints as generated prompt. | Reinforces implementation + validation discipline. |
| `docs/contracts/workflow-api-schema-contract.md` | Canonical route + persisted-schema contract. | Mutating route behavior must stay unchanged after boundary refactor. |
| `src/core/repositories/core-repository.ts` | Defines repository contract including `withTransaction`. | Contract surface where transaction ownership is expressed. |
| `src/core/repositories/in-memory-core-repository.ts` | In-memory `withTransaction` is passthrough. | Explains why nested ownership can be invisible in memory-only tests. |
| `src/core/repositories/sqlite/sqlite-core-repository.ts` | Real transaction implementation (`BEGIN IMMEDIATE`, nested savepoints, rollback/commit). | Concrete runtime impact of nested transaction ownership. |
| `src/core/app/core-platform.ts` | Platform-level `withMutationBoundary` wraps most mutating operations; legacy import also uses transaction. | Primary overlap source with service-level transactions. |
| `src/core/services/entry-service.ts` | `suggestEntryAsTask` performs AI/title resolution then wraps persistence in `repository.withTransaction`. | Nested with platform if platform also owns boundary for this route. |
| `src/core/services/job-service.ts` | `recordJobRun` and `retryJobRun` each open `repository.withTransaction`. | Nested with platform wrappers for job mutating methods. |
| `src/core/services/checkpoint-service.ts` | `createWorkflowCheckpoint`, `keepCheckpoint`, `recoverCheckpoint` each open `repository.withTransaction`. | Nested with platform wrappers for checkpoint mutations. |
| `src/api/workflows/workflow-api.ts` | Delegates to `CorePlatform`; does not own transaction boundaries. | Confirms transaction decision point is platform/services, not API adapter. |
| `tests/integration/core-platform.integration.test.ts` | Asserts platform wraps mutating operations in `withTransaction`. | Will need update if ownership shifts away from platform. |
| `tests/unit/core/app/core-platform.ai-transaction-boundary.test.ts` | Ensures AI runtime calls happen outside transaction scope. | Critical invariant for `capture.suggest` and `job.retry` sequencing. |
| `tests/unit/core/services/checkpoint-service.test.ts` | Asserts checkpoint service methods execute inside transaction boundary. | Will need update if ownership shifts away from services. |
| `tests/unit/core/services/job-service.test.ts` | Asserts `recordJobRun` + `retryJobRun` call `withTransaction`. | Will need update if ownership shifts away from services. |
| `tests/unit/core/repositories/sqlite-core-repository.test.ts` | Verifies rollback, nested scopes, overlapping root-transaction isolation. | Baseline DB semantics that refactor must preserve. |
| `tests/integration/database-core-platform.integration.test.ts` | Includes forced-failure rollback tests for `recordJobRun` and `recoverCheckpoint`. | Primary regression suite for unchanged rollback semantics. |
| `tests/integration/workflow-api.integration.test.ts` | Workflow API integration over in-memory platform. | Ensures end-to-end API behavior remains stable post-refactor. |
| `tests/integration/workflow-api-http.integration.test.ts` | HTTP dispatcher integration over workflow API. | Ensures route-level behavior/status mapping remains stable. |
| `package.json` | Defines validation suites (`test:integration:workflow`, `test:integration:api`, `test:integration:db`). | Matches ticket validation requirement for workflow/api/db integration suites. |

## Current Transaction Ownership Map

### Platform-level ownership (`src/core/app/core-platform.ts`)
`withMutationBoundary` wraps mutating platform methods including:
- capture/edit/reject/accept entry
- task complete/defer/reschedule
- signal ingest/triage/convert
- approval/event sync and outbound execution
- job create/record
- checkpoint create/keep/recover
- view save and memory upsert

Special cases:
- `suggestEntryAsTask` is not platform-wrapped today (service owns transaction around persistence after AI resolution).
- `retryJob` is not platform-wrapped today (service owns transaction around persistence after optional AI fix summary).

### Service-level ownership (overlap)
- `src/core/services/entry-service.ts`
  - `suggestEntryAsTask` uses `repository.withTransaction(...)`.
- `src/core/services/job-service.ts`
  - `recordJobRun` uses `repository.withTransaction(...)`.
  - `retryJobRun` uses `repository.withTransaction(...)`.
- `src/core/services/checkpoint-service.ts`
  - `createWorkflowCheckpoint`, `keepCheckpoint`, `recoverCheckpoint` use `repository.withTransaction(...)`.

### Net effect today
- For several mutating workflows, transaction ownership is split across `CorePlatform` and services.
- On SQLite, this creates nested transaction/savepoint flows (supported, but higher complexity and lock/savepoint surface area).

## Behavioral Invariants To Preserve
- Rollback behavior for partial failures must remain unchanged:
  - `tests/integration/database-core-platform.integration.test.ts`
    - `forced recordJobRun write failure rolls back partial sqlite mutations`
    - `forced recoverCheckpoint write failure rolls back partial sqlite restore`
- Repository transaction guarantees must remain intact:
  - `tests/unit/core/repositories/sqlite-core-repository.test.ts`
    - rollback on failure
    - nested scopes
    - overlapping root transaction isolation
- AI calls must stay outside open transaction scope:
  - `tests/unit/core/app/core-platform.ai-transaction-boundary.test.ts`

## Likely Refactor Axes (for implementation phase)
1. Platform-owned transactions (single owner in `core-platform.ts`):
   - remove `withTransaction` from service methods that are only invoked via platform mutating routes.
   - preserve AI-outside-transaction sequencing by keeping pre-transaction AI resolution where needed (`capture.suggest`, `job.retry`).
2. Service-owned transactions (single owner in services):
   - remove platform `withMutationBoundary` wrappers and ensure every mutating method (including currently platform-only wrapped services like task/signal/approval/view/memory) opens explicit service-level transactions.

Based on current shape, option 1 is lower-churn because platform already centrally wraps most mutation routes.

## Validation Suites Required by Ticket
Run after implementation:
- `bun run test:integration:workflow`
- `bun run test:integration:api`
- `bun run test:integration:db`
- `bun run typecheck`

Targeted fast regression checks during development:
- `bun test tests/integration/core-platform.integration.test.ts`
- `bun test tests/unit/core/services/job-service.test.ts tests/unit/core/services/checkpoint-service.test.ts tests/unit/core/app/core-platform.ai-transaction-boundary.test.ts`
- `bun test tests/unit/core/repositories/sqlite-core-repository.test.ts`

## Proposed Implementation File Focus (derived, since `relevantFiles` is absent)
- `src/core/app/core-platform.ts`
- `src/core/services/entry-service.ts`
- `src/core/services/job-service.ts`
- `src/core/services/checkpoint-service.ts`
- `src/core/repositories/core-repository.ts` (only if contract-level clarifications become necessary)
- `tests/integration/core-platform.integration.test.ts`
- `tests/integration/workflow-api.integration.test.ts`
- `tests/integration/workflow-api-http.integration.test.ts`
- `tests/integration/database-core-platform.integration.test.ts`
- `tests/unit/core/services/job-service.test.ts`
- `tests/unit/core/services/checkpoint-service.test.ts`
- `tests/unit/core/app/core-platform.ai-transaction-boundary.test.ts`
- `tests/unit/core/repositories/sqlite-core-repository.test.ts`

## Research Summary
- WF-REV-003 has no ticket-provided `relevantFiles`; scope is derived from platform/service/repository transaction seams and workflow/api/db integration suites.
- The concrete overlap is real: `CorePlatform` wraps mutating calls while `entry`, `job`, and `checkpoint` services also use `withTransaction`.
- Existing tests encode both current ownership assumptions and rollback invariants; implementation should preserve rollback/AI-boundary semantics while converging to a single transaction owner.
