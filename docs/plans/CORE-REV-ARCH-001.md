# CORE-REV-ARCH-001 Plan: Remove API-layer dependency from core contract-doc tooling (TDD First)

## Overview of the approach
This ticket removes the remaining reverse dependency where core tooling imports API-layer route-key types.

Implementation strategy:
1. Introduce a neutral route-key contracts module under `src/contracts`.
2. Move `WorkflowRouteKey` ownership into that neutral module.
3. Update core tooling to consume the neutral module directly.
4. Keep API compatibility by aliasing/re-exporting `WorkflowRouteKey` from `src/api/workflows/contracts.ts` during this slice.
5. Add regression tests to prevent future core -> api coupling and to keep route-key parity across neutral contracts, runtime routes, and authoritative docs.

## TDD step order (tests before implementation)
1. **Unit test (RED):** create `tests/unit/contracts/workflow-route-keys.test.ts` with `test("WORKFLOW_ROUTE_KEYS defines the canonical key set without duplicates")`.
   **Implement (GREEN):** create `src/contracts/workflow-route-keys.ts`:
   - `export const WORKFLOW_ROUTE_KEYS = [...] as const`
   - `export type WorkflowRouteKey = (typeof WORKFLOW_ROUTE_KEYS)[number]`

2. **Unit test (RED):** in `tests/unit/contracts/workflow-route-keys.test.ts`, add `test("api workflow contracts source WorkflowRouteKey from neutral contracts module")` using source assertions on `src/api/workflows/contracts.ts` (contains neutral import/alias, does not inline-declare the union).
   **Implement (GREEN):** update `src/api/workflows/contracts.ts`:
   - remove inline `WorkflowRouteKey` union ownership
   - import type from `../../contracts/workflow-route-keys`
   - re-export alias for compatibility:
     - `export type WorkflowRouteKey = SharedWorkflowRouteKey`

3. **Unit test (RED):** extend `tests/unit/tooling/contract-doc-policy.test.ts` with `test("contract-doc-policy imports WorkflowRouteKey from neutral contracts, not api contracts")` using source assertions.
   **Implement (GREEN):** update `src/core/tooling/contract-doc-policy.ts` import to:
   - `import type { WorkflowRouteKey } from "../../contracts/workflow-route-keys";`

4. **Unit test (RED):** in `tests/unit/tooling/contract-doc-policy.test.ts`, switch route-key type imports to neutral module and add `test("route violation typing remains compatible with documented route fixtures")` to preserve current behavior after the type move.
   **Implement (GREEN):** adjust test typing/casts only as needed; no behavior changes in parser/violation logic.

5. **Integration test (RED):** extend `tests/integration/api-contract-docs.integration.test.ts` with `test("neutral route-key manifest matches runtime route paths and contract-doc route rows")`:
   - assert `WORKFLOW_ROUTE_KEYS` equals `Object.keys(WORKFLOW_ROUTE_PATHS).sort()`
   - assert authoritative doc route keys match the same canonical set.
   **Implement (GREEN):** update imports/assertions in the integration test to use `WORKFLOW_ROUTE_KEYS`.

6. **Verification slice:** run targeted tests and typecheck; fix only refactor fallout (no behavior drift).

## Files to create/modify (with specific function signatures)

### Create
- `src/contracts/workflow-route-keys.ts`
  - `export const WORKFLOW_ROUTE_KEYS: readonly string[]` (declared `as const` with literal keys)
  - `export type WorkflowRouteKey = (typeof WORKFLOW_ROUTE_KEYS)[number]`

- `tests/unit/contracts/workflow-route-keys.test.ts`
  - `const readSource = (relativePath: string): string => ...`
  - `test("WORKFLOW_ROUTE_KEYS defines the canonical key set without duplicates", ...)`
  - `test("api workflow contracts source WorkflowRouteKey from neutral contracts module", ...)`

### Modify
- `src/api/workflows/contracts.ts`
  - `export type WorkflowRouteKey = SharedWorkflowRouteKey`
  - existing signatures remain stable:
    - `export interface WorkflowRouteDefinition { key: WorkflowRouteKey; method: "POST"; path: string; handle: (input: unknown) => Effect.Effect<unknown, WorkflowApiError>; }`

- `src/core/tooling/contract-doc-policy.ts`
  - existing signatures remain stable, with neutral type import:
    - `export interface WorkflowRouteContractRow { key: WorkflowRouteKey; method: "POST"; path: string; }`
    - `export const findWorkflowRouteContractViolations: (params: { documented: ReadonlyArray<WorkflowRouteContractRow>; expectedPaths: Record<WorkflowRouteKey, string>; expectedMethodByKey?: Record<WorkflowRouteKey, "POST">; }) => ReadonlyArray<WorkflowRouteContractViolation>`

- `tests/unit/tooling/contract-doc-policy.test.ts`
  - route-key type import source moved to neutral module
  - add architectural import-boundary assertion test

- `tests/integration/api-contract-docs.integration.test.ts`
  - add canonical-route parity assertions with `WORKFLOW_ROUTE_KEYS`

## Tests to write (unit + integration)

### Unit tests
- `tests/unit/contracts/workflow-route-keys.test.ts`
  - canonical route-key constant has expected values and no duplicates
  - API contracts file imports/aliases route-key type from neutral module

- `tests/unit/tooling/contract-doc-policy.test.ts`
  - core tooling file imports route key from neutral module and not `src/api/workflows/contracts.ts`
  - existing violation/parser behavior remains unchanged under neutral typing

### Integration tests
- `tests/integration/api-contract-docs.integration.test.ts`
  - neutral route-key manifest, runtime route path registry, and authoritative route matrix stay in sync

- `tests/integration/api-contract-docs.cwd.integration.test.ts` (regression run)
  - ensures contract-doc integration suite still passes when invoked outside repo root

## Risks and mitigations
1. **Risk:** Route key list can drift between neutral constant and `WORKFLOW_ROUTE_PATHS`.
   **Mitigation:** Add integration parity assertion between `WORKFLOW_ROUTE_KEYS` and runtime route map keys.

2. **Risk:** Refactor may break broad call sites if `WorkflowRouteKey` import path changes everywhere at once.
   **Mitigation:** Keep API-layer re-export alias in this ticket; defer full import-path migration to a separate cleanup ticket.

3. **Risk:** Core/API boundary violation could regress later.
   **Mitigation:** Keep a unit source-assertion test that fails if `src/core/tooling/contract-doc-policy.ts` imports API contracts again.

4. **Risk:** Static source assertion tests may be brittle on formatting-only edits.
   **Mitigation:** Assert stable semantic markers (import path presence/absence), not exact formatting.

## How to verify against acceptance criteria
Acceptance criteria mapping:
1. **Core tooling no longer depends on API layer:**
   - `bun test tests/unit/tooling/contract-doc-policy.test.ts`
2. **Route-key type ownership moved to neutral module consumed by both layers:**
   - `bun test tests/unit/contracts/workflow-route-keys.test.ts`
   - `bun test tests/integration/api-contract-docs.integration.test.ts`
3. **No behavioral regression in contract-doc governance checks:**
   - `bun test tests/integration/api-contract-docs.integration.test.ts`
   - `bun test tests/integration/api-contract-docs.cwd.integration.test.ts`
4. **Changed-slice safety checks:**
   - `bun test tests/unit/api/workflows/routes.test.ts`
   - `bun test tests/unit/api/workflows/workflow-api.test.ts`
   - `bun test tests/integration/workflow-api-http.integration.test.ts`
   - `bun test tests/integration/workflow-surfaces.integration.test.ts`
   - `bun run typecheck`
