# WF-AUDIT-009 Research Context

## Ticket
- ID: `WF-AUDIT-009`
- Title: `Document authoritative workflow API and schema contract`
- Category: `spec-compliance`
- Description: `Add a concrete workflow API + DB contract document in docs/ so future audits can verify exact route and schema conformance rather than inferred behavior.`

## Relevant Files Field
- Workflow ticket metadata search:
  - `rg -n "WF-AUDIT-009"`
  - `rg -n -i "wf-audit-009"`
- Result: no in-repo ticket record found; no `relevantFiles` field is defined for this ticket.
- Effective relevant files were derived from workflow contract docs and their implementation/test surfaces listed below.

## Paths Reviewed

| Path | Summary | Relevance to WF-AUDIT-009 |
| --- | --- | --- |
| `.super-ralph/generated/PROMPT.md` | Generated build prompt emphasizing source-of-truth docs, core-first implementation, Effect-oriented design, and jj checkpointing. | Establishes process constraints for producing authoritative contract docs. |
| `README.md` | Project entrypoint that points directly to canonical spec docs and contract docs. | Confirms current contract documentation locations and required reading. |
| `docs/design.spec.md` | Product/behavior spec including workflow families and auditability requirements. | Defines why explicit workflow API/schema contracts are required for audits. |
| `docs/engineering.choices.md` | Engineering constraints: core-first, deterministic services, side effects at boundaries, tests/typecheck gates. | Sets documentation and implementation quality bar for this ticket. |
| `docs/references.md` | Canonical reference repositories and local submodule paths. | Identifies external sources (notably Super Ralph/Smithers) for workflow contract alignment. |
| `docs/super-ralph.prompt.md` | Local Super Ralph prompt guidance reinforcing guardrails and workflow expectations. | Additional source-of-truth for workflow behavior constraints. |
| `docs/contracts/workflow-api-routes.md` | Existing route-level workflow API contract (paths, validation rules, error mapping, dispatcher behavior). | Primary input for the API half of the authoritative contract. |
| `docs/contracts/persisted-schema.md` | Existing persisted schema contract (migration ledger, tables, triggers, indexes). | Primary input for the DB schema half of the authoritative contract. |
| `docs/context/API-001.md` | Prior research context for workflow API implementation and tests. | Useful precedent for traceability mapping from docs to code/tests. |
| `docs/context/WF-AUDIT-001.md` | Prior research context for workflow audit/persistence slice. | Useful precedent for audit-focused schema traceability and validation evidence. |
| `src/api/workflows/contracts.ts` | Authoritative TypeScript contract definitions for workflow operations and payload shapes. | Code-level source to verify docs route coverage and payload conformance. |
| `src/api/workflows/routes.ts` | Route registry and validators for workflow endpoints. | Verifies documented request validation rules are actually enforced. |
| `src/api/workflows/http-dispatch.ts` | HTTP dispatch behavior for routing, method checks, and error normalization. | Verifies documented 404/405/error envelope behavior. |
| `src/api/workflows/workflow-api.ts` | Workflow API implementation bridging to CorePlatform with error mapping. | Verifies behavior-level contract for each route handler. |
| `src/core/database/migrations/001_core_schema.sql` | Initial persisted workflow schema. | Verifies baseline schema objects in contract ledger. |
| `src/core/database/migrations/002_core_constraints_indexes.sql` | Constraints and indexes. | Verifies contract-level invariants and performance-critical indexes. |
| `src/core/database/migrations/003_relation_integrity.sql` | Referential/integrity triggers and supporting indexes. | Verifies cross-entity invariants documented in schema contract. |
| `src/core/database/migrations/004_audit_entity_versions.sql` | Audit entity versioning schema/trigger additions. | Verifies auditability-specific contract entries. |
| `src/core/database/migrations/005_job_run_history.sql` | Job run history schema, triggers, and backfill logic. | Verifies operational/audit history schema contract entries. |
| `src/core/repositories/sqlite/migrations.ts` | Migration manifest (`CORE_DB_MIGRATIONS`) and checksum inputs. | Verifies ledger ordering and migration identity in docs. |
| `src/core/repositories/sqlite/migration-runner.ts` | Schema migration ledger enforcement (`schema_migrations`). | Verifies migration contract execution behavior. |
| `src/core/repositories/sqlite/sqlite-core-repository.ts` | SQLite repository mapping to persisted schema tables. | Verifies runtime usage alignment with documented schema. |
| `tests/integration/workflow-api.integration.test.ts` | End-to-end API behavior coverage across workflow families. | Evidence for documented route behavior and state transitions. |
| `tests/integration/workflow-api-http.integration.test.ts` | HTTP-level routing/validation/error behavior tests. | Evidence for dispatcher and envelope contract behavior. |
| `tests/unit/api/workflows/workflow-api.test.ts` | Unit coverage for workflow API method delegation and error mapping. | Evidence for per-route handler semantics. |
| `tests/unit/core/repositories/sqlite-schema.test.ts` | Schema/trigger/index enforcement tests. | Evidence that persisted-schema contract remains accurate. |
| `tests/unit/core/repositories/sqlite-migrations.test.ts` | Migration ordering/ledger/checksum tests. | Evidence for migration contract integrity. |
| `tests/integration/api-contract-docs.integration.test.ts` | Contract-doc parity test against live schema. | Direct safeguard for schema-doc drift. |
| `tests/unit/tooling/contract-doc-policy.test.ts` | Contract documentation policy/structure checks. | Indicates existing governance mechanism for contract docs. |

## Spec Requirements Extracted

### Workflow/API contract expectations
- A concrete list of supported workflow routes and route-specific request payload constraints must be documented and auditable.
- Validation invariants must be explicit (ISO dates, non-empty strings, positive integers, actor/entity identifiers).
- Error behavior must be explicit and normalized (validation/forbidden/not-found/conflict/internal) with clear dispatcher outcomes for unknown path/method.

### Persisted schema contract expectations
- A concrete migration ledger must be documented in order with stable IDs.
- A complete table/column contract for workflow entities and audit-related entities must be documented.
- Referential and lifecycle invariants must be represented through documented constraints/triggers/indexes.

### Program-level guardrails impacting this ticket
- Core-first and deterministic behavior are mandatory before/alongside transport/UI integration.
- Auditability and reversibility are non-negotiable for AI-driven and workflow transitions.
- Docs should be structured so future audits can verify code/schema conformance from explicit contracts, not inferred behavior.

## Current Coverage Snapshot

### API contract coverage
- Existing contract doc: `docs/contracts/workflow-api-routes.md`.
- Concrete code surfaces: `src/api/workflows/{contracts,routes,http-dispatch,workflow-api}.ts`.
- Verification evidence: `tests/unit/api/workflows/workflow-api.test.ts`, `tests/integration/workflow-api.integration.test.ts`, `tests/integration/workflow-api-http.integration.test.ts`.

### Schema contract coverage
- Existing contract doc: `docs/contracts/persisted-schema.md`.
- Concrete schema surfaces: `src/core/database/migrations/001..005_*.sql`, `src/core/repositories/sqlite/{migrations,migration-runner,sqlite-core-repository}.ts`.
- Verification evidence: `tests/unit/core/repositories/sqlite-{migrations,schema}.test.ts`, `tests/integration/api-contract-docs.integration.test.ts`.

## Gaps / Clarifications for WF-AUDIT-009
- No unified, single document currently combines workflow API and persisted schema into one audit-oriented contract narrative.
- Ticket metadata with `relevantFiles` was not found in-repo; traceability must be carried directly in this context file and the implementation ticket doc.
- Existing HTTP integration coverage strongly validates route behavior, but there is no dedicated regression case explicitly asserting dispatcher `404` (unknown path) and `405` (unsupported method) branches.

## Proposed File Focus for Implementation Ticket
- Author a new canonical document under `docs/` that unifies:
  - Workflow API routes/validation/error contract.
  - Persisted schema migration/table/trigger/index contract.
  - A traceability matrix mapping each contract section to implementation files and tests.
  - Audit checklist commands to verify conformance after changes.
- Cross-link this new document to both existing contract docs (or consolidate those docs if directed), then update README contract references if paths change.

## Validation Commands for This Slice
- `bunx tsc --noEmit -p tsconfig.typecheck.json`
- `bun test tests/unit/api/workflows/workflow-api.test.ts`
- `bun test tests/integration/workflow-api.integration.test.ts`
- `bun test tests/integration/workflow-api-http.integration.test.ts`
- `bun test tests/unit/core/repositories/sqlite-migrations.test.ts`
- `bun test tests/unit/core/repositories/sqlite-schema.test.ts`
- `bun test tests/integration/api-contract-docs.integration.test.ts`
- `bun test tests/unit/tooling/contract-doc-policy.test.ts`
