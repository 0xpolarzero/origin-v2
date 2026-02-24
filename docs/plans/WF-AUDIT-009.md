# WF-AUDIT-009 Plan: Document Authoritative Workflow API and Schema Contract (TDD First)

## Overview of the approach
This slice introduces one authoritative workflow contract document that combines API route behavior and persisted-schema guarantees in a single auditable reference.

The implementation keeps conformance machine-verifiable by wiring existing contract-parity tests to the new canonical doc and adding missing HTTP dispatcher coverage (`404` unknown path and `405` unsupported method) that the document already claims.

To avoid contract drift, legacy split docs will be downgraded to compatibility pointers (or clearly marked mirrors) and README links will prioritize the new canonical document.

## TDD step order (tests before implementation)
1. **Unit test (RED):** extend `tests/unit/tooling/contract-doc-policy.test.ts` with `test("parseAuthoritativeWorkflowContract extracts workflow routes and persisted schema from one markdown source")` using a fixture markdown containing both route and schema tables.
   **Implement (GREEN):** update `src/core/tooling/contract-doc-policy.ts` to add:
   - `export interface AuthoritativeWorkflowContract`
   - `export const parseAuthoritativeWorkflowContract = (markdown: string): AuthoritativeWorkflowContract`

2. **Unit test (RED):** in `tests/unit/tooling/contract-doc-policy.test.ts`, add `test("parseAuthoritativeWorkflowContract throws when required sections are missing")` for missing route matrix and missing migration ledger/table matrix.
   **Implement (GREEN):** in `contract-doc-policy.ts`, enforce fail-closed parsing with explicit section checks in:
   - `const assertRequiredContractSection = (section: string, count: number): void`

3. **Integration test (RED):** update `tests/integration/api-contract-docs.integration.test.ts` with `test("authoritative workflow contract route matrix matches runtime route registry")` that reads only the new canonical file path and uses `parseAuthoritativeWorkflowContract(...)` for route rows.
   **Implement (GREEN):** create `docs/contracts/workflow-api-schema-contract.md` with canonical `Route Matrix` table + API validation/error/dispatcher sections.

4. **Integration test (RED):** in `tests/integration/api-contract-docs.integration.test.ts`, add `test("authoritative workflow contract schema sections match migrated sqlite objects")` validating migration ledger, table matrix, trigger names, and index names from the same canonical markdown.
   **Implement (GREEN):** complete schema sections in `docs/contracts/workflow-api-schema-contract.md`:
   - `Migration Ledger`
   - `Table Column Matrix`
   - `Trigger Contract`
   - `Index Contract`

5. **Integration test (RED):** in `tests/integration/api-contract-docs.integration.test.ts`, add `test("authoritative workflow contract includes traceability + audit checklist sections")` asserting required headings and key file references.
   **Implement (GREEN):** add to `docs/contracts/workflow-api-schema-contract.md`:
   - `Traceability Matrix (Contract -> Implementation -> Tests)`
   - `Audit Verification Commands`

6. **Integration test (RED):** extend `tests/integration/workflow-api-http.integration.test.ts` with `test("dispatcher returns 404 for unknown route path and 405 for unsupported method")` to explicitly verify documented transport behavior.
   **Implement (GREEN):** if needed, adjust `src/api/workflows/http-dispatch.ts` behavior in `makeWorkflowHttpDispatcher(...)` to satisfy exact status/body contract; otherwise keep implementation unchanged and retain the new regression test.

7. **Integration test (RED):** update README contract-link assertion in `tests/integration/api-contract-docs.integration.test.ts` to require the canonical doc link and (if retained) legacy compatibility links.
   **Implement (GREEN):** modify:
   - `README.md` contract section
   - `docs/contracts/workflow-api-routes.md` and `docs/contracts/persisted-schema.md` to include canonical-doc pointer and no contradictory contract details.

8. **Verification pass:** run targeted unit/integration tests plus typecheck for touched tooling and API surfaces.

## Files to create/modify (with specific function signatures)

### Create
- `docs/contracts/workflow-api-schema-contract.md`
  - Canonical headings to include exact parser/test anchors:
    - `## Route Matrix`
    - `## Shared Validation Rules`
    - `## Service Error to API Status Mapping`
    - `## HTTP Dispatcher Contract`
    - `## Migration Ledger`
    - `## Table Column Matrix`
    - `## Trigger Contract`
    - `## Index Contract`
    - `## Traceability Matrix (Contract -> Implementation -> Tests)`
    - `## Audit Verification Commands`

### Modify
- `src/core/tooling/contract-doc-policy.ts`
  - `export interface AuthoritativeWorkflowContract { routes: ReadonlyArray<WorkflowRouteContractRow>; persistedSchema: PersistedSchemaContract }`
  - `export const parseAuthoritativeWorkflowContract = (markdown: string): AuthoritativeWorkflowContract`
  - `const assertRequiredContractSection = (section: string, count: number): void`

- `tests/unit/tooling/contract-doc-policy.test.ts`
  - `test("parseAuthoritativeWorkflowContract extracts workflow routes and persisted schema from one markdown source", ...)`
  - `test("parseAuthoritativeWorkflowContract throws when required sections are missing", ...)`

- `tests/integration/api-contract-docs.integration.test.ts`
  - `const AUTHORITATIVE_WORKFLOW_CONTRACT_DOC_PATH = "docs/contracts/workflow-api-schema-contract.md"`
  - `const readAuthoritativeWorkflowContract = (): string`

- `tests/integration/workflow-api-http.integration.test.ts`
  - `test("dispatcher returns 404 for unknown route path and 405 for unsupported method", ...)`

- `README.md`
  - Contracts section points to canonical workflow contract document.

- `docs/contracts/workflow-api-routes.md`
  - Compatibility pointer section to canonical doc (if file retained).

- `docs/contracts/persisted-schema.md`
  - Compatibility pointer section to canonical doc (if file retained).

## Tests to write (unit + integration)

### Unit tests
- `tests/unit/tooling/contract-doc-policy.test.ts`
  - parse combined workflow contract markdown into route + schema structures.
  - throw explicit errors when required sections are missing/empty.
  - preserve existing route/schema diff behavior after introducing combined parser.

### Integration tests
- `tests/integration/api-contract-docs.integration.test.ts`
  - route matrix in canonical doc matches `WORKFLOW_ROUTE_PATHS` + `makeWorkflowRoutes(...)` methods.
  - schema migration/table/trigger/index sections in canonical doc match migrated sqlite schema.
  - canonical doc includes validation rules, error mapping, dispatcher contract, traceability matrix, and audit command checklist.
  - README links canonical doc path.

- `tests/integration/workflow-api-http.integration.test.ts`
  - unknown path returns `404` contract response.
  - unsupported method on known path returns `405` contract response.

## Risks and mitigations
1. **Risk:** dual-doc drift if legacy split docs remain detailed.
   **Mitigation:** make canonical doc explicit and convert legacy docs to compatibility pointers or mirrored extracts with tests anchored to only canonical source.

2. **Risk:** parser changes could silently accept partially documented contracts.
   **Mitigation:** fail-closed parser checks (`assertRequiredContractSection`) and unit tests for missing sections.

3. **Risk:** HTTP dispatcher regression tests become brittle if asserting full response bodies.
   **Mitigation:** assert stable contract fields/status and avoid overfitting to incidental wording.

4. **Risk:** manual matrix maintenance cost for large schema tables/triggers/indexes.
   **Mitigation:** keep integration parity tests authoritative so drift is caught immediately in CI.

## How to verify against acceptance criteria
1. `bun test tests/unit/tooling/contract-doc-policy.test.ts`
   - verifies canonical combined-parser behavior and fail-closed section requirements.

2. `bun test tests/integration/api-contract-docs.integration.test.ts`
   - verifies canonical workflow contract doc exactly matches runtime API route registry and migrated persisted schema.

3. `bun test tests/integration/workflow-api-http.integration.test.ts`
   - verifies documented dispatcher `404` and `405` transport behavior with explicit regression coverage.

4. `bun run typecheck`
   - verifies type safety for any touched tooling/API modules.

5. `rg -n "workflow-api-schema-contract\.md" README.md docs/contracts/workflow-api-routes.md docs/contracts/persisted-schema.md`
   - confirms canonical contract link wiring and compatibility-pointer consistency.
