# WF-REV-004 Research Context

## Ticket
- ID: `WF-REV-004`
- Title: `Add atomic rollback failure tests for signal/outbound approval workflow chain`
- Category: `workflow`
- Priority: `medium`
- Description: `Extend tests/integration/database-core-platform.integration.test.ts with forced-write-failure scenarios covering signal ingest/triage/convert and outbound approval execution to prove multi-entity atomicity under injected repository failures.`

## Relevant Files Field
Ticket metadata source: `.super-ralph/workflow.db` (`category_review.suggested_tickets`).

`relevantFiles` is not present for `WF-REV-004` (`json_type` / `json_extract` are null).

Query used:

```sql
SELECT
  category_id,
  json_extract(value, '$.id') AS id,
  json_extract(value, '$.title') AS title,
  json_extract(value, '$.description') AS description,
  json_extract(value, '$.category') AS category,
  json_extract(value, '$.priority') AS priority,
  json_type(value, '$.relevantFiles') AS relevant_type,
  json_extract(value, '$.relevantFiles') AS relevant_files
FROM category_review, json_each(category_review.suggested_tickets)
WHERE json_extract(value, '$.id') = 'WF-REV-004';
```

## Paths Reviewed

| Path | Summary | Relevance to WF-REV-004 |
| --- | --- | --- |
| `.super-ralph/generated/PROMPT.md` | Generated build constraints (core-first, Effect preference, explicit approval, tests/typecheck, jj checkpoints). Ticket input listed this path twice. | Governs process/quality constraints for this test-only slice. |
| `README.md` | Canonical repo map and source-of-truth docs list. | Confirms where workflow, contract, and testing guidance live. |
| `docs/design.spec.md` | Requires reliable workflows and explicit outbound approvals, with auditable/reversible behavior. | Product-level justification for rollback atomicity assertions. |
| `docs/engineering.choices.md` | Normative quality bar: deterministic behavior, side-effects at boundaries, relevant tests per slice. | Supports deterministic failure-injection test design. |
| `docs/references.md` | External references policy. | Background only; no direct implementation delta. |
| `docs/super-ralph.prompt.md` | Same operational constraints as generated prompt. | Reinforces expected workflow for this ticket. |
| `docs/test-suite-findings.md` | Current integration suite status and gaps/ticket suggestions. | Confirms integration scope is the right layer for DB rollback proof. |
| `docs/plans/API-004.md` | Prior plan that added forced sqlite rollback tests (`recordJobRun`, `recoverCheckpoint`). | Direct precedent for failure injection patterns in target file. |
| `docs/context/global-command-capture-entry-pipeline.md` | Documents existing rollback pattern reuse and cites DB forced-failure tests as model. | Additional precedent for injected repository failure strategy. |
| `tests/integration/database-core-platform.integration.test.ts` | Existing sqlite integration coverage including two forced-write-failure rollback tests. | Primary file to extend for WF-REV-004. |
| `src/core/app/core-platform.ts` | Wraps all mutating platform methods with `withMutationBoundary` -> `repository.withTransaction`. | Explains why each workflow call should rollback atomically on injected write errors. |
| `src/core/repositories/core-repository.ts` | Repository contract seam (`saveEntity`, `appendAuditTransition`, `withTransaction`). | Defines injectable mutation seams used by existing forced-failure tests. |
| `src/core/repositories/sqlite/sqlite-core-repository.ts` | Transaction/savepoint implementation (`BEGIN IMMEDIATE`, `ROLLBACK`, nested savepoints). | Confirms sqlite backend enforces transaction rollback for failures. |
| `src/core/services/signal-service.ts` | Ingest/triage/convert write sequencing across signal + target entities + audit transitions. | Defines multi-entity write chain to test for atomic rollback. |
| `src/core/services/approval-service.ts` | Outbound approval execution flow (`pending_approval -> executing -> executed`) with staged writes/audits and rollback helper. | Defines outbound approval write chain to test under forced repository failures. |
| `src/core/services/outbound-draft-service.ts` | Request-approval path and rollback style for multi-write operations. | Secondary pattern reference for rollback assertions and messaging. |
| `tests/unit/core/services/signal-service.test.ts` | Core behavior coverage for ingest/triage/convert happy path + precondition errors. | Shows service-level expectations to preserve when DB failure tests are added. |
| `tests/unit/core/services/approval-service.test.ts` | Extensive approval failure/rollback edge coverage at unit level. | Confirms failure semantics already exercised in-memory; WF-REV-004 adds sqlite transaction proof. |

## Existing Forced-Failure Integration Pattern (Target File)
`tests/integration/database-core-platform.integration.test.ts` already includes two deterministic rollback tests:
- `forced recordJobRun write failure rolls back partial sqlite mutations`
- `forced recoverCheckpoint write failure rolls back partial sqlite restore`

Pattern used:
1. Create real sqlite repository via `makeSqliteCoreRepository({ databasePath })`.
2. Wrap repository methods with a toggle-based failure injector (`let force... = false`).
3. Inject a single targeted write failure in `saveEntity` or `appendAuditTransition`.
4. Build platform with injected repository (`buildCorePlatform({ repository: repository as never })`).
5. Execute workflow and assert:
- effect fails with injected error message,
- previously persisted state is unchanged,
- no partial audit/history artifacts exist.

This is the exact pattern to reuse for WF-REV-004.

## Transaction and Atomicity Boundaries
- `core-platform` wraps mutating APIs (`ingestSignal`, `triageSignal`, `convertSignal`, `approveOutboundAction`) in `withMutationBoundary`, which delegates to `repository.withTransaction(...)`.
- SQLite repository `withTransaction` uses explicit transaction control and rolls back failed effects.
- Therefore, each platform workflow call should be all-or-nothing under write failure.

Note: ingest/triage/convert are separate platform calls, each its own transaction. Atomicity guarantees are per call; multi-step chain integrity must be proven by staged assertions after each failing call.

## Signal/Outbound Write Sequences To Target

### `ingestSignal`
Writes in order:
1. `saveEntity("signal", ...)`
2. `appendAuditTransition("Signal ingested")`

Failure candidate:
- Inject failure on signal ingest audit append.

Atomicity assertion:
- No `signal` row persisted for the attempted ingest.
- No `signal` audit transition row exists.

### `triageSignal`
Writes in order:
1. `saveEntity("signal", triageState="triaged")`
2. `appendAuditTransition("Signal triaged: ...")`

Failure candidate:
- Inject failure on triage audit append.

Atomicity assertion:
- Signal remains in prior state (`untriaged` with no triage decision).
- No triage transition appended.

### `convertSignal`
Writes in order:
1. `saveEntity(targetType, targetId, ...)` (task/event/note/project/outbound_draft)
2. `saveEntity("signal", triageState="converted", convertedEntityType/Id)`
3. `appendAuditTransition(target created from conversion)`
4. `appendAuditTransition(signal converted)`

Failure candidates (pick one deterministic seam):
- Fail on `saveEntity("signal", ...)` when setting converted fields.
- Or fail on final signal conversion audit append.

Atomicity assertions:
- No converted target entity persisted.
- Signal remains `triaged` and not linked to converted entity.
- No conversion audit transitions remain.

### `approveOutboundAction` (`outbound_draft` branch)
Expected pre-state: draft is `pending_approval`.

Writes in order:
1. `saveEntity("outbound_draft", status="executing")`
2. `appendAuditTransition(pending_approval -> executing)`
3. execute outbound port
4. `saveEntity("outbound_draft", status="executed", executionId)`
5. `appendAuditTransition(executing -> executed)`

Failure candidate:
- Inject failure on step 4 or 5 to force partial-write risk after staging.

Atomicity assertions:
- Draft remains `pending_approval` with no `executionId` persisted.
- No staged/executed audit transitions remain after failed call.
- Outbound execution mock call count should match failure point expectation (usually `1` if failure is post-execute).

## Concrete Test Targets for WF-REV-004
Primary file to modify:
- `tests/integration/database-core-platform.integration.test.ts`

Suggested additions (names can vary):
1. `forced ingestSignal audit write failure rolls back signal insert`
2. `forced triageSignal audit write failure rolls back signal triage update`
3. `forced convertSignal write failure rolls back target+signal conversion mutations`
4. `forced outbound_draft approval execution write failure rolls back staged execution mutations`

Each should follow the existing toggle-based repository wrapper approach already used in this file.

## Validation Scope for Implementation Phase
Most direct command for this ticket slice:
- `bun test tests/integration/database-core-platform.integration.test.ts`

Optional broader regression checks if needed:
- `bun run test:integration:db`
- `bun run test:integration:api`

## Research Summary
- WF-REV-004 has no ticket-provided `relevantFiles`; scope is derived from ticket description and existing rollback integration precedents.
- The target integration file already demonstrates the exact failure-injection pattern required.
- `signal-service` and `approval-service` contain multi-entity write sequences with clear injectable seams.
- `core-platform` transaction boundaries and sqlite transaction implementation provide the mechanism being proven by the new tests.
