# API-DATA-004 Plan: Enforce integer invariant for checkpoint auditCursor (TDD First)

## Overview of the approach
This ticket should be delivered as a strict invariant slice across three seams: request validation (`checkpoint.create`), domain/service creation flow (`createWorkflowCheckpoint` -> `createCheckpoint`), and persisted schema enforcement (`checkpoint.audit_cursor`).

The TDD strategy is to add failing tests first at each seam, then implement the smallest changes to make those tests pass. The domain guard remains mandatory even with route validation, so non-route callers cannot bypass the integer requirement. Persistence guardrails are implemented with a new forward-only SQLite migration that aborts inserts/updates when `audit_cursor` is not stored as an integer.

## TDD step order (tests before implementation)

### Phase 1: RED (write failing tests first)
1. **Unit test (route validation: `checkpoint.create`)**
   Add `test("checkpoint.create rejects non-integer auditCursor")` in `tests/unit/api/workflows/routes.test.ts`.
   - payload: valid checkpoint create request with `auditCursor: 1.5`
   - assert route returns `WorkflowApiError` with `route: "checkpoint.create"`
   - assert message mentions `auditCursor` and `integer`

2. **Unit test (domain validation: `createCheckpoint`)**
   Add `test("createCheckpoint rejects fractional auditCursor")` in `tests/unit/core/domain/checkpoint.test.ts`.
   - input: valid checkpoint payload except `auditCursor: 12.25`
   - assert effect fails with validation message containing `auditCursor`

3. **Unit test (service mapping: `createWorkflowCheckpoint`)**
   Add `test("createWorkflowCheckpoint maps fractional auditCursor to invalid_request")` in `tests/unit/core/services/checkpoint-service.test.ts`.
   - input: valid create request except `auditCursor: 7.5`
   - assert rejection is `CheckpointServiceError`
   - assert `code === "invalid_request"`

4. **Unit test (sqlite schema guardrail: insert)**
   Add `test("checkpoint.audit_cursor rejects fractional values on insert")` in `tests/unit/core/repositories/sqlite-schema.test.ts`.
   - apply migrations to in-memory DB
   - attempt `INSERT INTO checkpoint (..., audit_cursor, ...) VALUES (..., 1.5, ...)`
   - assert SQLite abort with deterministic message fragment (for example `invalid checkpoint.audit_cursor`)

5. **Unit test (sqlite schema guardrail: update)**
   Add `test("checkpoint.audit_cursor rejects fractional values on update")` in `tests/unit/core/repositories/sqlite-schema.test.ts`.
   - insert valid checkpoint row with integer cursor
   - attempt `UPDATE checkpoint SET audit_cursor = 1.25 ...`
   - assert SQLite abort with same message fragment

6. **Unit test (migration manifest ordering)**
   Update `tests/unit/core/repositories/sqlite-migrations.test.ts` expected IDs to include the new migration id:
   - `"006_checkpoint_audit_cursor_integer"`
   - keep sorted/idempotent assertions unchanged

7. **Integration test (database-backed behavior)**
   Add `test("database backend cannot persist fractional checkpoint audit_cursor")` in `tests/integration/database-core-platform.integration.test.ts`.
   - create sqlite-backed repository/platform
   - call `createWorkflowCheckpoint` with `auditCursor: 1.5`
   - assert operation fails (service invalid_request path or sqlite abort, depending on where enforcement trips first)
   - assert no persisted checkpoint row for that id

8. **Integration test (contract-doc parity)**
   Update `tests/integration/api-contract-docs.integration.test.ts` expectations only through doc + migration updates (no new test block required) so the existing schema parity test fails until docs are updated with new migration and trigger names.

### Phase 2: GREEN (minimal implementation after tests fail)
9. **Route-level implementation**
   Update `src/api/workflows/routes.ts` in `validateCreateWorkflowCheckpointRequest(...)`:
   - switch `auditCursor` parsing from `parseNumberField(...)` to integer-only validation (`parseIntegerField(...)` new helper or `parsePositiveIntegerField(...)` reuse, depending on scope decision)
   - ensure error text states integer requirement

10. **Domain-level implementation**
    Update `src/core/domain/checkpoint.ts`:
    - in `createCheckpoint(input: CreateCheckpointInput): Effect.Effect<Checkpoint, DomainValidationError>`
    - add integer check for `input.auditCursor` (`Number.isInteger` + finite)
    - fail with `DomainValidationError` on invalid values before constructing result

11. **Service-level implementation (mapping only)**
    Confirm `src/core/services/checkpoint-service.ts` keeps mapping domain validation failures from `createCheckpoint(...)` to:
    - `new CheckpointServiceError({ code: "invalid_request", ... })`
    - no new error class needed; only preserve explicit `invalid_request` behavior for new domain validation path

12. **Schema guardrail migration**
    Create `src/core/database/migrations/006_checkpoint_audit_cursor_integer.sql` with two triggers:
    - `checkpoint_audit_cursor_integer_check_insert`
    - `checkpoint_audit_cursor_integer_check_update`
    Each trigger aborts when `typeof(NEW.audit_cursor) != 'integer'`.

13. **Migration registry update**
    Update `src/core/repositories/sqlite/migrations.ts`:
    - append `defineMigration("006_checkpoint_audit_cursor_integer", ... , "../../database/migrations/006_checkpoint_audit_cursor_integer.sql")`

14. **Contract doc update for parity**
    Update `docs/contracts/workflow-api-schema-contract.md`:
    - route payload row for `checkpoint.create`: `auditCursor:integer` (instead of generic number)
    - persisted/trigger sections: include new trigger names and behavior line
    - migration id list: include `006_checkpoint_audit_cursor_integer`

### Phase 3: VERIFY
15. Run focused unit tests:
    - `bun test tests/unit/api/workflows/routes.test.ts`
    - `bun test tests/unit/core/domain/checkpoint.test.ts`
    - `bun test tests/unit/core/services/checkpoint-service.test.ts`
    - `bun test tests/unit/core/repositories/sqlite-schema.test.ts`
    - `bun test tests/unit/core/repositories/sqlite-migrations.test.ts`

16. Run focused integration tests:
    - `bun test tests/integration/database-core-platform.integration.test.ts`
    - `bun test tests/integration/api-contract-docs.integration.test.ts`

17. Run type safety gate:
    - `bun run typecheck`

## Files to create/modify (with specific function signatures)

### Create
- `docs/plans/API-DATA-004.md`
- `src/core/database/migrations/006_checkpoint_audit_cursor_integer.sql`

### Modify: API validation
- `src/api/workflows/routes.ts`
  - `const validateCreateWorkflowCheckpointRequest: RouteValidator<CreateWorkflowCheckpointRequest>`
  - `const parseNumberField(...)` (only if retained for other routes)
  - `const parsePositiveIntegerField(...)` (possible reuse)
  - `const parseIntegerField(route: WorkflowRouteKey, source: Record<string, unknown>, field: string): RouteValidation<number>` (if introduced)

### Modify: domain/service
- `src/core/domain/checkpoint.ts`
  - `export const createCheckpoint(input: CreateCheckpointInput): Effect.Effect<Checkpoint, DomainValidationError>`
- `src/core/services/checkpoint-service.ts`
  - `export const createWorkflowCheckpoint(repository: CoreRepository, input: CreateWorkflowCheckpointInput): Effect.Effect<Checkpoint, CheckpointServiceError>`

### Modify: migrations + contract
- `src/core/repositories/sqlite/migrations.ts`
  - `export const CORE_DB_MIGRATIONS: ReadonlyArray<SqliteMigration>`
- `docs/contracts/workflow-api-schema-contract.md`

### Modify: tests
- `tests/unit/api/workflows/routes.test.ts`
- `tests/unit/core/domain/checkpoint.test.ts`
- `tests/unit/core/services/checkpoint-service.test.ts`
- `tests/unit/core/repositories/sqlite-schema.test.ts`
- `tests/unit/core/repositories/sqlite-migrations.test.ts`
- `tests/integration/database-core-platform.integration.test.ts`
- `tests/integration/api-contract-docs.integration.test.ts` (expected parity through existing checks)

## Tests to write (unit + integration)

### Unit tests
- `checkpoint.create` rejects fractional `auditCursor` at route validation.
- `createCheckpoint` rejects fractional `auditCursor` with domain validation error.
- `createWorkflowCheckpoint` maps fractional cursor rejection to `CheckpointServiceError.code = "invalid_request"`.
- sqlite schema aborts fractional `audit_cursor` on checkpoint insert.
- sqlite schema aborts fractional `audit_cursor` on checkpoint update.
- migration manifest expected IDs include `006_checkpoint_audit_cursor_integer`.

### Integration tests
- sqlite-backed platform/repository cannot persist checkpoint with fractional `auditCursor`.
- contract-doc parity test passes with updated migration/trigger docs and route payload contract wording.

## Risks and mitigations
1. **Risk:** Route enforces integer but non-route callers still pass fractional values.
   **Mitigation:** Keep integer check in `createCheckpoint(...)` domain function, not only route parser.

2. **Risk:** SQLite affinity still allows fractional values despite `INTEGER` declaration.
   **Mitigation:** Add explicit INSERT and UPDATE triggers using `typeof(NEW.audit_cursor) = 'integer'`.

3. **Risk:** Trigger naming/message drift breaks contract-doc parity tests.
   **Mitigation:** Use deterministic trigger names/messages and update `workflow-api-schema-contract.md` in the same slice.

4. **Risk:** Ambiguity between `integer` and `positive integer` constraints could over-restrict valid values.
   **Mitigation:** Implement only ticket-required invariant (integer-ness), and avoid introducing positivity constraints unless explicitly required.

5. **Risk:** Existing data with fractional audit cursors could fail on future updates once triggers exist.
   **Mitigation:** Confirm current production/test datasets; if legacy fractional rows are possible, include one-time normalization migration before enabling update trigger.

## How to verify against acceptance criteria
Acceptance criteria requires rejecting non-integer `auditCursor` in create flow and preventing fractional persisted `audit_cursor` values.

Verification checklist:
1. Route unit test proves `checkpoint.create` rejects `auditCursor: 1.5`.
2. Domain/service unit tests prove non-integer values fail with `invalid_request` mapping.
3. Schema unit tests prove direct SQL insert/update with fractional `audit_cursor` aborts.
4. Migration manifest test includes and validates `006_checkpoint_audit_cursor_integer`.
5. Contract-doc integration test passes with updated migration/trigger/field contract rows.
6. Database integration test confirms no fractional checkpoint row can be persisted.
