# CORE-REV-TEST-001 Research Context

## Ticket
- ID: `CORE-REV-TEST-001`
- Title: `Add regression test for snapshot import skip on non-empty repository`
- Category: `testing`
- Priority: `medium`
- Description: `Add integration coverage for buildCorePlatform legacy import path where repository already has data; assert snapshot import is skipped and existing rows remain unchanged.`

## Relevant Files Field
- `CORE-REV-TEST-001` exists in `.super-ralph/workflow.db` (`category_review.suggested_tickets`) with `id/title/description/category/priority`.
- `relevantFiles` is absent (`json_type(..., '$.relevantFiles')` is null/empty).
- `referenceFiles` is absent (`json_type(..., '$.referenceFiles')` is null/empty).
- Effective implementation scope is derived from the import path and current DB integration tests.

## Paths Reviewed

| Path | Summary | Relevance to CORE-REV-TEST-001 |
| --- | --- | --- |
| `.super-ralph/generated/PROMPT.md` | Generated run prompt; requires core-first development, tests for behavior, and jj checkpoints. | Confirms research/implementation process constraints for this testing ticket. |
| `README.md` | Repo map for canonical specs/contracts and test commands. | Confirms where core and DB integration coverage lives. |
| `docs/design.spec.md` | Requires local-first durability and auditable/reversible behavior. | Snapshot import behavior must not corrupt existing authored data/audit history. |
| `docs/engineering.choices.md` | Deterministic core logic + comprehensive tests before UI. | Justifies integration-level regression coverage for import guard behavior. |
| `docs/references.md` | Lists external reference repos expected under `docs/references/*`. | Confirms reference policy; local submodules are not present in this workspace. |
| `docs/super-ralph.prompt.md` | Canonical autonomous prompt mirrors generated constraints. | Reinforces test/typecheck/checkpoint expectations for this slice. |
| `docs/contracts/workflow-api-schema-contract.md` | Canonical persisted schema and trigger/index contract. | Shows DB-backed persistence invariants that import must not violate. |
| `docs/plans/CORE-REV-003.md` | Original TDD plan for SQLite backend and legacy snapshot import support. | Establishes intended behavior: import only for empty DB and avoid duplicate imports. |
| `docs/plans/WF-AUDIT-001.md` | Platform wiring plan includes optional snapshot load/import and DB durability coverage. | Confirms import path belongs in `buildCorePlatform` integration tests. |
| `docs/context/CORE-REV-003.md` | Prior research on migration/storage and snapshot compatibility path. | Historical context for why legacy import exists and where regressions are likely. |
| `docs/context/API-002.md` | Documents DB coverage and identifies `database-core-platform` as persistence regression surface. | Confirms this integration suite is the right place for this test ticket. |
| `.super-ralph/workflow.db` | Source-of-truth ticket metadata in `category_review.suggested_tickets`. | Evidence for ticket details and absent `relevantFiles`. |
| `src/core/app/core-platform.ts` | Implements `isRepositoryEmpty`, legacy import helper, and `buildCorePlatform` import option. | Primary logic under test for skip-on-non-empty behavior. |
| `src/core/repositories/core-repository.ts` | Repository contract used by import path (`listEntities`, `listAuditTrail`, `saveEntity`, `withTransaction`). | Defines the methods the guard relies on to determine emptiness and apply imports. |
| `src/core/repositories/sqlite/sqlite-core-repository.ts` | SQLite implementation; `saveEntity` is upsert (`ON CONFLICT DO UPDATE`) and transactions are explicit. | If guard fails, existing rows could be overwritten; regression test must catch this. |
| `src/core/repositories/file-core-repository.ts` | Snapshot parser/loader for `version: 1` legacy JSON shape. | Defines snapshot fixture shape consumed by import path. |
| `src/core/domain/common.ts` | Canonical `ENTITY_TYPES` list used by emptiness and import loops. | Clarifies which entity buckets are checked before import. |
| `tests/integration/database-core-platform.integration.test.ts` | Existing DB integration coverage, including `legacy snapshot import hydrates an empty database once when enabled`. | Direct file to extend with the new non-empty skip regression case. |
| `tests/unit/core/repositories/file-core-repository.test.ts` | Verifies snapshot loading/shape behavior. | Useful pattern for valid legacy snapshot fixture construction. |
| `package.json` | Defines `test:integration:db` command. | Verification command for this ticket's changed slice. |

## Reference Material Availability
- `docs/references/` directory is not present in this workspace (`docs/references.md` lists expected submodules only).

## Existing Implementation Findings (Import Guard)

### `buildCorePlatform` legacy import flow
- `buildCorePlatform` calls `importLegacySnapshotIntoEmptyRepository(...)` only when:
  - `options.importSnapshotIntoDatabase === true`
  - and `options.snapshotPath` is provided.
- Import helper flow:
  1. Creates a file repository from `snapshotPath`.
  2. Loads the snapshot (if present).
  3. Reads all `ENTITY_TYPES` + full snapshot audit trail.
  4. Runs DB writes inside `repository.withTransaction(...)`.
  5. Re-checks emptiness inside that transaction via `isRepositoryEmpty(...)`.
  6. Returns early (skip import) if repository is not empty.

### Non-empty detection details
- `isRepositoryEmpty(...)` returns `false` if either:
  - any audit transitions already exist, or
  - any entity list in `ENTITY_TYPES` is non-empty.
- This means a single pre-existing row should block import.

### Why this regression matters
- SQLite `saveEntity(...)` is an upsert (`ON CONFLICT(id) DO UPDATE`).
- If the empty-repo guard regresses, a snapshot entry with an existing ID can overwrite live DB state.
- Existing tests only cover:
  - empty DB import succeeds,
  - second startup does not duplicate import.
- Missing coverage: non-empty DB should skip import and preserve existing rows unchanged.

## Existing Test Anchor
- Current anchor test in `tests/integration/database-core-platform.integration.test.ts`:
  - `legacy snapshot import hydrates an empty database once when enabled`
- It verifies import for empty DB and no duplicate import after restart.
- It does not seed pre-existing DB rows before import attempt.

## Derived File Focus for Implementation
(derived because ticket metadata has no `relevantFiles`)

- `tests/integration/database-core-platform.integration.test.ts` (primary; add new regression test)
- `src/core/app/core-platform.ts` (read-only target to validate expected behavior; no change expected unless bug is found)
- Optional helper updates only if needed for deterministic assertions:
  - local test fixture construction inside same integration test file.

## Regression Test Blueprint

1. Create temp `databasePath` and `snapshotPath`.
2. Seed DB with existing data before import attempt:
   - start `buildCorePlatform({ databasePath })`,
   - write an `entry` row (and associated audit row) via platform APIs,
   - close platform.
3. Write a legacy snapshot file that contains:
   - conflicting `entry` with same ID but different content/timestamps/state, and/or
   - additional snapshot-only row(s),
   - snapshot audit transitions that would be visible if import ran.
4. Start `buildCorePlatform({ databasePath, snapshotPath, importSnapshotIntoDatabase: true })`.
5. Assert import is skipped:
   - existing row fields are unchanged from pre-import values,
   - snapshot-only entity IDs do not appear,
   - audit trail for target entity does not include snapshot transition reason/id,
   - audit count remains at expected pre-import level.
6. Close platform and clean temp directory.

## Verification Commands for Implementation Phase
- `bun test tests/integration/database-core-platform.integration.test.ts`
- `bun run test:integration:db`
- `bun run typecheck`

## Research Summary
- `CORE-REV-TEST-001` has no ticket-provided `relevantFiles`; scope is derived from `buildCorePlatform` import guard and DB integration tests.
- Current code intends to skip legacy snapshot import when repository has any data, but there is no direct regression test for the non-empty path.
- Highest-value implementation is a focused integration test in `database-core-platform.integration.test.ts` that seeds pre-existing DB rows, attempts import, and proves existing rows/audit trail remain unchanged.
