# CORE-REV-ARCH-001 Research Context

## Ticket
- ID: `CORE-REV-ARCH-001`
- Title: `Remove API-layer dependency from core contract-doc tooling`
- Category: `architecture`
- Priority: `high`
- Description: `Refactor src/core/tooling/contract-doc-policy.ts so it no longer imports WorkflowRouteKey from src/api/workflows/contracts.ts; move shared route-key type(s) into a neutral contracts module consumed by both layers.`

## Relevant Files Field
- Ticket metadata exists in `.super-ralph/workflow.db` under `category_review.suggested_tickets`.
- `relevantFiles` is absent for this ticket.
- Evidence query result for `CORE-REV-ARCH-001`:
  - `json_type(value,'$.relevantFiles')` -> null/empty
  - `json_extract(value,'$.relevantFiles')` -> null/empty

Example query used:

```sql
select
  json_extract(value,'$.id') as id,
  json_extract(value,'$.title') as title,
  json_extract(value,'$.description') as description,
  json_extract(value,'$.category') as category,
  json_extract(value,'$.priority') as priority,
  json_type(value,'$.relevantFiles') as relevant_type,
  json_extract(value,'$.relevantFiles') as relevant_files
from category_review, json_each(category_review.suggested_tickets)
where json_extract(value,'$.id')='CORE-REV-ARCH-001';
```

## Paths Reviewed

| Path | Summary | Relevance to CORE-REV-ARCH-001 |
| --- | --- | --- |
| `.super-ralph/generated/PROMPT.md` | Generated autonomous prompt enforcing core-first, tests/typecheck, and jj checkpoints. (Ticket input listed this path twice.) | Sets implementation process constraints for this refactor slice. |
| `README.md` | Repo overview and canonical docs list; contract docs listed under `docs/contracts/*`. | Confirms where contract-doc policy fits in project docs flow. |
| `AGENTS.md` | Source-of-truth rules: core-first, Effect where practical, atomic commits, jj checkpoints, tests/typecheck per slice. | Governs how this architecture change should be delivered. |
| `docs/design.spec.md` | Requires explicit user control and auditability/recovery for AI changes. | Contract-doc tooling is part of auditability guarantees. |
| `docs/engineering.choices.md` | Requires deterministic/testable core and boundary-oriented side effects. | Supports removing reverse layer coupling (core importing api). |
| `docs/references.md` | Lists required external references and expected `docs/references/*` paths. | Reference policy baseline; `docs/references/` directory is currently missing locally. |
| `docs/super-ralph.prompt.md` | Mirrors generated prompt constraints and acceptance bar. | Reinforces process/quality expectations for this change. |
| `docs/contracts/workflow-api-schema-contract.md` | Canonical contract doc with route matrix and traceability matrix pointing to `contracts.ts`, `routes.ts`, tooling tests. | Contract-doc policy parser consumes this shape; route-key type continuity matters here. |
| `docs/contracts/workflow-api-routes.md` | Compatibility pointer to canonical contract doc. | Confirms canonical-source pattern for contract docs. |
| `docs/contracts/persisted-schema.md` | Compatibility pointer to canonical contract doc. | Confirms split docs are non-authoritative and parser targets canonical doc. |
| `docs/contracts/api-006-tdd-audit.md` | TDD audit log for prior contract-doc policy fixes. | Historical quality evidence for this tooling area. |
| `docs/plans/API-006.md` | Original plan that introduced `contract-doc-policy.ts` and route/schema doc parity checks. | Shows why `WorkflowRouteKey` entered core tooling and current expected signatures. |
| `docs/plans/WF-AUDIT-009.md` | Plan for combined authoritative contract parser (`parseAuthoritativeWorkflowContract`). | Clarifies current required headings/sections and parser fail-closed behavior. |
| `docs/context/API-006.md` | Prior research context for contract docs and route/schema source-of-truth files. | Useful precedent for contract-tooling scope and validation anchors. |
| `docs/context/WF-AUDIT-009.md` | Prior research context for authoritative workflow contract consolidation. | Provides traceability patterns for contract-tooling changes. |
| `.super-ralph/workflow.db` | Category review output includes architecture issue calling out core -> api dependency and suggested ticket list. | Source-of-truth ticket metadata and rationale for this ticket. |
| `src/core/tooling/contract-doc-policy.ts` | Core contract-doc parser/violation detector; currently imports `WorkflowRouteKey` from api layer. | Primary file named in ticket and current architecture violation point. |
| `src/api/workflows/contracts.ts` | Defines `WorkflowRouteKey` union and API contract types. | Current owner of shared route-key type; must be split/re-homed. |
| `src/api/workflows/routes.ts` | Defines `WORKFLOW_ROUTE_PATHS: Record<WorkflowRouteKey, string>` and validators. | Downstream compile surface for any route-key type move. |
| `src/api/workflows/workflow-api.ts` | Uses `WorkflowRouteKey` in handler wrapping and route literals. | API runtime compile surface for route-key type move. |
| `src/api/workflows/errors.ts` | `WorkflowApiError.route` typed as `WorkflowRouteKey`. | API error contract surface impacted by type relocation. |
| `src/ui/workflows/workflow-surface-client.ts` | UI workflow client uses `WorkflowRouteKey` route parameters and errors. | UI compile surface if route-key import path changes. |
| `tests/unit/tooling/contract-doc-policy.test.ts` | Unit tests for parser/violation behavior; imports `WorkflowRouteKey` from api contracts. | Primary test surface to update with neutral type module. |
| `tests/integration/api-contract-docs.integration.test.ts` | Contract-doc parity test imports `WorkflowRouteKey` and validates route parity against docs. | Integration safety net for route contract behavior post-refactor. |
| `tests/unit/api/workflows/routes.test.ts` | Uses `WorkflowRouteKey` in required key list and route input fixtures. | High-signal compile/runtime regression surface for route-key changes. |
| `tests/unit/api/workflows/workflow-api.test.ts` | Uses `WorkflowRouteKey` in handler cases and error expectations. | Regression anchor for API wrapper route typing. |
| `tests/integration/workflow-api-http.integration.test.ts` | Uses `WorkflowRouteKey` for helper routing and assertions. | Integration compile/runtime regression anchor. |
| `tests/integration/workflow-surfaces.integration.test.ts` | Uses `WorkflowRouteKey` for dispatcher helper in UI integration flow. | Integration compile/runtime regression anchor. |

## Current Architecture Finding (Concrete)
- The only current core -> api source import is:
  - `src/core/tooling/contract-doc-policy.ts:1` importing `WorkflowRouteKey` from `../../api/workflows/contracts`.
- Query used:

```bash
rg -n "from \".*api/|from '.*api/" src/core -S
```

Result:

```text
src/core/tooling/contract-doc-policy.ts:1:import type { WorkflowRouteKey } from "../../api/workflows/contracts";
```

This confirms the ticket is a targeted reverse-dependency removal, not a broad core-layer leak.

## Workflow Route-Key Ownership Snapshot
- `WorkflowRouteKey` is currently declared only in `src/api/workflows/contracts.ts` as a string-literal union.
- It is used by:
  - API route registry/types (`routes.ts`, `workflow-api.ts`, `errors.ts`).
  - UI client route calls (`workflow-surface-client.ts`).
  - Contract-doc tooling in core (`contract-doc-policy.ts`) and related tests.
  - API/integration tests.

Search anchors:

```bash
rg -n "WorkflowRouteKey" src tests -S
rg -n "api/workflows/contracts" src tests -S
```

## Contract-Tooling Constraints to Preserve
- `contract-doc-policy.ts` public interfaces currently require `WorkflowRouteKey` in:
  - `WorkflowRouteContractRow.key`
  - `findWorkflowRouteContractViolations(... expectedPaths: Record<WorkflowRouteKey, string> ...)`
  - optional `expectedMethodByKey: Record<WorkflowRouteKey, "POST">`
- Integration tests rely on this typing and expect zero route-matrix violations against:
  - `WORKFLOW_ROUTE_PATHS`
  - `makeWorkflowRoutes(...)`
  - canonical markdown doc `docs/contracts/workflow-api-schema-contract.md`

## Derived Implementation File Focus
(derived because ticket metadata has no `relevantFiles`)

### Primary files
- `src/core/tooling/contract-doc-policy.ts`
- `src/api/workflows/contracts.ts`
- New neutral module for shared route-key type(s), likely one of:
  - `src/contracts/workflow-route-contract.ts`
  - `src/contracts/workflow-routes.ts`
  - `src/core/contracts/workflow-route-contract.ts`

### High-probability updates
- `tests/unit/tooling/contract-doc-policy.test.ts`
- `tests/integration/api-contract-docs.integration.test.ts`

### Likely compile-touch surfaces (depending on re-export strategy)
- `src/api/workflows/routes.ts`
- `src/api/workflows/workflow-api.ts`
- `src/api/workflows/errors.ts`
- `src/ui/workflows/workflow-surface-client.ts`
- `tests/unit/api/workflows/routes.test.ts`
- `tests/unit/api/workflows/workflow-api.test.ts`
- `tests/integration/workflow-api-http.integration.test.ts`
- `tests/integration/workflow-surfaces.integration.test.ts`

## Refactor Strategy Options (for implementation phase)
1. Minimal churn strategy:
- Add neutral module that exports `WorkflowRouteKey` (and optionally `WORKFLOW_ROUTE_KEYS`).
- Update `src/core/tooling/contract-doc-policy.ts` to import from neutral module.
- Update `src/api/workflows/contracts.ts` to import and re-export `WorkflowRouteKey` for backwards compatibility.
- Keep most existing imports stable; migrate call sites incrementally.

2. Full migration strategy:
- Move all `WorkflowRouteKey` imports across api/ui/tests directly to neutral module.
- Keep `api/workflows/contracts.ts` free of route-key ownership.
- Larger file touch count, but cleaner ownership semantics immediately.

## Open Decisions to Resolve During Implementation
1. Neutral module path and naming convention (`src/contracts/*` vs `src/core/contracts/*`).
2. Whether to expose only a type alias union or both:
- `WORKFLOW_ROUTE_KEYS` constant
- `WorkflowRouteKey = typeof WORKFLOW_ROUTE_KEYS[number]`
3. Backward compatibility policy:
- Re-export `WorkflowRouteKey` from `src/api/workflows/contracts.ts` temporarily, or force immediate import-path migration.
4. Whether to add a regression policy test preventing future `src/core/** -> src/api/**` imports.

## Verification Anchors for Implementation
- `bun test tests/unit/tooling/contract-doc-policy.test.ts`
- `bun test tests/integration/api-contract-docs.integration.test.ts`
- `bun test tests/unit/api/workflows/routes.test.ts`
- `bun test tests/unit/api/workflows/workflow-api.test.ts`
- `bun test tests/integration/workflow-api-http.integration.test.ts`
- `bun run typecheck`

## Research Summary
- Ticket metadata is present and explicitly calls out this architectural issue; `relevantFiles` is absent.
- The reverse dependency is currently isolated to a single import in `src/core/tooling/contract-doc-policy.ts`.
- Route-key typing is shared across core tooling, api routing/error layers, ui workflow client, and tests, so safe implementation should relocate ownership to a neutral module and preserve compile stability via deliberate import/re-export strategy.
