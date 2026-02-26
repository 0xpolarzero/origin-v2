# CORE-REV-TEST-001 Plan: Snapshot Import Skip Regression on Non-Empty Repository (TDD First)

## Overview of the approach
This ticket is a regression-safety slice for the `buildCorePlatform` legacy snapshot import path. The goal is to lock behavior that already exists in `src/core/app/core-platform.ts`: when the repository is not empty, snapshot import must be skipped.

Approach:
1. Add a focused unit test around the import guard path to prove no import writes are attempted once pre-existing data is detected.
2. Add the required SQLite integration regression test in `database-core-platform.integration.test.ts` to prove existing rows remain unchanged and snapshot rows are not imported.
3. Keep production changes minimal and conditional. If tests pass without code changes, ship test-only coverage.

## Provenance note (behavior pre-exists this ticket)
- Existing implementation reference: commit `665c234` dated `2026-02-24` already contained the non-empty-repository import guard.
- The guarded import behavior already existed before this ticket (not introduced in CORE-REV-TEST-001).
- This ticket delivers regression coverage for that existing behavior; it does not claim original implementation provenance.
- TDD here is enforced for the ticket slice itself: write failing tests for regression expectations first, then only change production code if those tests expose a bug.

## TDD step order (tests before implementation)
1. **Unit test (RED):** create `tests/unit/core/app/core-platform.snapshot-import.test.ts` with:
   - test: `skips legacy snapshot import when repository is already non-empty`
   - setup: repository wrapper with write counters and pre-existing row exposure (`listEntities` and/or `listAuditTrail` non-empty)
   - assertion: `saveEntity` and `appendAuditTransition` counters remain `0` after `buildCorePlatform({ repository, snapshotPath, importSnapshotIntoDatabase: true })`
   **Implementation (GREEN):** no intended behavior change; only update `src/core/app/core-platform.ts` if this test reveals guard regression.

2. **Integration test (RED):** modify `tests/integration/database-core-platform.integration.test.ts` and add:
   - test: `legacy snapshot import skips non-empty database and preserves existing rows`
   - setup phase A (seed DB): start `buildCorePlatform({ databasePath })`, capture an entry, close platform
   - setup phase B (legacy snapshot): write snapshot containing:
     - same entry id as seeded row, but conflicting payload/content
     - snapshot-only entry id that must not appear
     - snapshot audit reason marker (for negative assertion)
   - execution: start `buildCorePlatform({ databasePath, snapshotPath, importSnapshotIntoDatabase: true })`
   - assertions:
     - seeded entry fields remain unchanged (especially `content`)
     - snapshot-only entry is absent
     - seeded entry audit trail length is unchanged
     - seeded entry audit reasons do not include snapshot marker
   **Implementation (GREEN):** no intended production change; if failing, fix `isRepositoryEmpty` / import guard behavior in `src/core/app/core-platform.ts`.

3. **Refactor (still GREEN):** keep fixtures deterministic and local to the test file:
   - extract snapshot writer helper to remove duplication and keep payload shape stable.

4. **Verification:** run targeted tests first, then changed-slice commands.

## Files to create/modify (with specific function signatures)

### Create
- `tests/unit/core/app/core-platform.snapshot-import.test.ts`
  - `const createTempSnapshotPath = (): { tempDir: string; snapshotPath: string }`
  - `const writeLegacySnapshot = (snapshotPath: string, payload: { version: 1; entities: Record<string, ReadonlyArray<Record<string, unknown>>>; auditTrail: ReadonlyArray<Record<string, unknown>> }) => void`
  - `const createTrackedRepository = (): CoreRepository & { counters: { saveEntity: number; appendAuditTransition: number; withTransaction: number } }`

### Modify
- `tests/integration/database-core-platform.integration.test.ts`
  - add/extend helper:
    - `const writeLegacySnapshot = (snapshotPath: string, payload: { version: 1; entities: Record<string, ReadonlyArray<Record<string, unknown>>>; auditTrail: ReadonlyArray<Record<string, unknown>> }) => void`
  - add new integration case:
    - `test("legacy snapshot import skips non-empty database and preserves existing rows", async () => { ... })`

### Conditional modify (only if tests expose a bug)
- `src/core/app/core-platform.ts`
  - `const isRepositoryEmpty = (repository: CoreRepository): Effect.Effect<boolean>`
  - `const importLegacySnapshotIntoEmptyRepository = (repository: CoreRepository, snapshotPath: string): Effect.Effect<void, Error>`

## Tests to write (unit + integration)

### Unit tests
- `tests/unit/core/app/core-platform.snapshot-import.test.ts`
  - `skips legacy snapshot import when repository is already non-empty`
  - optional follow-up (if needed for branch precision): `treats non-empty audit trail as non-empty repository for import guard`

### Integration tests
- `tests/integration/database-core-platform.integration.test.ts`
  - `legacy snapshot import skips non-empty database and preserves existing rows`
  - keep existing test `legacy snapshot import hydrates an empty database once when enabled` unchanged as complementary coverage.

## Risks and mitigations
1. **Risk:** false-positive regression test if seed data is accidentally created from snapshot instead of normal workflow writes.
   **Mitigation:** seed DB only through `captureEntry` before import attempt.

2. **Risk:** assertions miss overwrite because SQLite upsert can preserve row count while mutating row content.
   **Mitigation:** assert specific seeded-field values (`content`, optional timestamps/status) remain identical pre/post import attempt.

3. **Risk:** audit assertions become flaky if checks are too broad.
   **Mitigation:** use entity-scoped audit filtering (`entityType`, `entityId`) and snapshot-unique reason markers.

4. **Risk:** resource leakage from unclosed SQLite handles causes cross-test interference.
   **Mitigation:** always call `platform.close()` and `rmSync(tempDir, { recursive: true, force: true })` in `finally`.

5. **Risk:** unit test repository stub drifts from `CoreRepository` contract.
   **Mitigation:** build from `makeInMemoryCoreRepository()` and wrap only methods needed for counters.

## How to verify against acceptance criteria
1. **Run new focused unit guard test**
   - `bun test tests/unit/core/app/core-platform.snapshot-import.test.ts`

2. **Run target integration suite with new regression**
   - `bun test tests/integration/database-core-platform.integration.test.ts`
   - `bun run test:integration:db`

3. **Run changed-slice type safety**
   - `bun run typecheck`

4. **Acceptance mapping**
   - Import is skipped on non-empty repository: proven by no snapshot-only rows and unchanged seeded row fields.
   - Existing rows remain unchanged: proven by direct field equality and unchanged per-entity audit trail shape/count.
