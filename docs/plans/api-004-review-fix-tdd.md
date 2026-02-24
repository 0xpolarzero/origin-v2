# API-004 review fix TDD log

This log records red-green verification for API-004 review fixes after `fd33629`.

## 1) Reject timezone-less timestamps in route date fields

Test-first change:
- Updated `route handlers reject timezone-less ISO timestamps in payload date fields` in
  `tests/unit/api/workflows/routes.test.ts`.

Red run before fix:
- `bun test tests/unit/api/workflows/routes.test.ts --test-name-pattern "route handlers reject timezone-less ISO timestamps in payload date fields"`
- Failure included `expect(received).toBeUndefined()` because `job.listHistory` accepted `beforeAt: "2026-02-23T10:00:00"`.

Green run after fix in `src/api/workflows/routes.ts`:
- Required timezone suffix in the ISO-8601 validator.
- `bun test tests/unit/api/workflows/routes.test.ts --test-name-pattern "route handlers reject timezone-less ISO timestamps in payload date fields"`
- Result: test passed.

## 2) Reject blank checkpoint snapshot entity references

Test-first change:
- Added `checkpoint.create rejects blank snapshotEntityRefs entityId` in
  `tests/unit/api/workflows/routes.test.ts`.

Red run before fix:
- `bun test tests/unit/api/workflows/routes.test.ts --test-name-pattern "checkpoint.create rejects blank snapshotEntityRefs entityId"`
- Failure included `Expected: true, Received: false` for `Either.isLeft(result)`.

Green run after fix in `src/api/workflows/routes.ts`:
- Enforced non-empty `snapshotEntityRefs[*].entityId`.
- `bun test tests/unit/api/workflows/routes.test.ts --test-name-pattern "checkpoint.create rejects blank snapshotEntityRefs entityId"`
- Result: test passed.
