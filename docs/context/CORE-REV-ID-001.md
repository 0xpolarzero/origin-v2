# CORE-REV-ID-001 Research Context

## Ticket
- ID: `CORE-REV-ID-001`
- Title: `Implement runtime pi-mono integration for AI workflows`
- Category: `identity`
- Priority: `medium`
- Description: Introduce concrete `@mariozechner/pi-ai` callsites in AI suggestion/automation paths and add unit/integration tests validating deterministic handling, error mapping, and audit traces.

## Relevant Files Field
- Ticket metadata is present in `.super-ralph/workflow.db` under `category_review(node_id='codebase-review:core')`.
- `relevantFiles` is absent/null for this ticket.
- Query result:
  - `CORE-REV-ID-001|Implement runtime pi-mono integration for AI workflows|identity|medium||`

## Required Source Paths Reviewed

| Path | Summary | Relevance to CORE-REV-ID-001 |
| --- | --- | --- |
| `.super-ralph/generated/PROMPT.md` | Build constraints: core-first, Effect-first where practical, pi-mono for AI integrations, jj checkpointing, test/typecheck gates. (Input listed this path twice; same file.) | Defines mandatory process and integration constraints for this ticket. |
| `README.md` | Points to canonical docs/contracts and current run/test entry points. | Confirms authoritative docs and current workflow/API contract locations. |
| `docs/design.spec.md` | Requires `capture -> persist -> AI suggestion -> user accept/edit/reject`, automation inspect/retry/fix, and auditable/reversible AI writes. | Primary product requirement source for AI workflow behavior and auditability. |
| `docs/engineering.choices.md` | Normative stack includes `Effect` and `pi-mono`; quality bar emphasizes deterministic core logic and boundary side effects. | Architectural acceptance criteria for runtime AI integration and test strategy. |
| `docs/references.md` | Declares required reference repos and expected `docs/references/*` paths. | Reference policy baseline; relevant because `docs/references/` is currently missing locally. |
| `docs/super-ralph.prompt.md` | Mirrors generated prompt constraints and acceptance bar. | Reinforces implementation and verification expectations. |
| `docs/contracts/workflow-api-schema-contract.md` | Canonical route/payload/schema contract; `capture.suggest` currently requires `suggestedTitle`. | Any route contract change for runtime suggestion generation must update this doc and tests. |
| `docs/contracts/workflow-api-routes.md` | Compatibility pointer to canonical contract. | Must remain in sync if canonical contract changes. |
| `docs/contracts/persisted-schema.md` | Compatibility pointer to canonical contract. | Must remain in sync if canonical contract changes. |
| `docs/test-suite-findings.md` | Current integration status summary across core/api/workflow suites. | Confirms existing coverage baseline and gaps to extend for this ticket. |

## Additional Reference Materials Reviewed (pi-ai)

| Path | Summary | Relevance |
| --- | --- | --- |
| `package.json` | `@mariozechner/pi-ai@0.54.2` is pinned in `dependencies`. | Confirms runtime package is available but not yet used in app logic. |
| `node_modules/@mariozechner/pi-ai/README.md` | Quick start with `getModel`, `stream`, `complete`; event stream model (`done`/`error`), usage/cost fields, tool-call validation pattern, context serialization. | Direct integration API and behavior reference for deterministic handling, error pathways, and trace metadata. |
| `node_modules/@mariozechner/pi-ai/dist/stream.d.ts` | Public runtime functions: `stream`, `complete`, `streamSimple`, `completeSimple`. | Concrete callsite signatures for core service integration. |
| `node_modules/@mariozechner/pi-ai/dist/types.d.ts` | `StreamOptions` (e.g., `temperature`, `maxTokens`, `signal`, `onPayload`, `metadata`), `StopReason`, `AssistantMessage` usage/cost, event types (`done`, `error`). | Key types for deterministic configuration and robust error/result mapping. |
| `node_modules/@mariozechner/pi-ai/dist/models.d.ts` | `getModel`, `getProviders`, `getModels`, cost helpers. | Model/provider selection entry points for runtime wiring. |
| `node_modules/@mariozechner/pi-ai/dist/utils/validation.d.ts` | `validateToolCall` / `validateToolArguments` APIs. | Relevant if AI workflows use tool-calling loops with validated arguments. |

## Existing Implementation Reviewed (Derived, Since `relevantFiles` is Absent)

### AI Suggestion Path (Capture Workflow)
- `src/api/workflows/routes.ts`: `capture.suggest` validator requires `entryId`, `suggestedTitle`, `actor`, optional `at`.
- `src/api/workflows/workflow-api.ts`: `suggestEntryAsTask` directly delegates to `platform.suggestEntryAsTask`.
- `src/core/app/core-platform.ts`: wraps `suggestEntryAsTask` in transaction boundary; no AI runtime dependency.
- `src/core/services/entry-service.ts`:
  - `suggestEntryAsTask` writes caller-provided `suggestedTitle` to entry.
  - Appends audit transition reason `"AI suggested entry conversion to task"`.
  - No `@mariozechner/pi-ai` callsite exists.
- Tests:
  - `tests/unit/core/services/entry-service.test.ts`
  - `tests/integration/api-data.integration.test.ts`
  - `tests/integration/workflow-api.integration.test.ts`
  - `tests/integration/workflow-api-http.integration.test.ts`

### Automation Path (Retry/Fix + Workflow Automation)
- `src/api/workflows/routes.ts`: `job.retry` accepts optional `fixSummary`.
- `src/api/workflows/workflow-api.ts`: `retryJob` delegates to `platform.retryJob`.
- `src/core/services/job-service.ts`:
  - `retryJobRun` transitions failed job to retrying state.
  - Stores optional `fixSummary` in audit metadata if provided.
  - No AI generation callsite for fix suggestions.
- Tests:
  - `tests/unit/core/services/job-service.test.ts` (retry conflicts, fix summary metadata, transaction boundaries).
  - `tests/integration/workflow-automation.integration.test.ts` (deterministic missing-job failure and side-effect-free assertions).
  - `tests/integration/workflow-automation-edge-cases.integration.test.ts` (duplicate retry stability and sanitized conflict behavior).

### Signal Triage/Conversion Path (AI-Adjacent Workflow)
- `src/core/services/signal-service.ts` triage and conversion are deterministic transforms from provided input/payload.
- No runtime AI callsite in `triageSignal` or `convertSignal`.
- Tests cover conversion targets, conflict handling, and audit linkage:
  - `tests/unit/core/services/signal-service.test.ts`
  - `tests/integration/workflow-api.integration.test.ts`
  - `tests/integration/api-data.integration.test.ts`

### Error Mapping + Sanitized HTTP Behavior
- `src/api/workflows/errors.ts` maps service `code` values:
  - `invalid_request -> validation (400)`
  - `forbidden -> 403`, `conflict -> 409`, `not_found -> 404`
  - fallback `unknown -> 400`
- `src/api/workflows/workflow-api.ts` wraps handler failures/throws/defects into `WorkflowApiError`.
- `src/api/workflows/http-dispatch.ts` returns sanitized client body `{ error, route, message }` and status mapping.
- Tests:
  - `tests/unit/api/workflows/errors.test.ts`
  - `tests/unit/api/workflows/workflow-api.test.ts`
  - `tests/unit/api/workflows/http-dispatch.test.ts`
  - `tests/integration/workflow-api-http.integration.test.ts`

### Audit Trace + Activity Feed Surfaces
- Domain + repository:
  - `src/core/domain/audit-transition.ts`
  - `src/core/repositories/core-repository.ts`
  - `src/core/repositories/in-memory-core-repository.ts`
  - `src/core/repositories/sqlite/sqlite-core-repository.ts`
  - `src/core/database/migrations/001_core_schema.sql` (`audit_transitions.metadata` TEXT JSON)
  - `src/core/database/migrations/004_audit_entity_versions.sql` (`entity_versions` sync trigger)
- Feed/query:
  - `src/core/services/activity-service.ts` (`aiOnly` and `actorKind` filters).
- Tests:
  - `tests/unit/core/services/activity-service.test.ts`
  - `tests/unit/core/repositories/sqlite-core-repository.test.ts` (`listActivityFeed` SQL filter/order/limit).
  - `tests/integration/database-core-platform.integration.test.ts` (audit-version sync and rollback failure coverage).

## Key Findings for This Ticket
1. Runtime pi-mono integration is currently missing.
   - No `@mariozechner/pi-ai` imports/calls in `src/` workflow paths.
   - Current references to pi-ai are dependency-policy metadata and package pinning only.
2. Existing AI-labeled behavior is input-driven, not model-driven.
   - `capture.suggest` requires caller-provided `suggestedTitle`.
   - `job.retry` optional `fixSummary` is caller-provided.
3. Strong baseline exists for required test categories.
   - Deterministic handling patterns: duplicate retry and missing-resource tests.
   - Error mapping patterns: unit + HTTP integration coverage for sanitized `400/403/404/409`.
   - Audit trace patterns: entry/signal/job/checkpoint + activity feed + sqlite entity version sync.
4. Contract sensitivity is high.
   - If runtime suggestion generation changes request shape (e.g., `suggestedTitle` optional/derived), update:
     - `src/api/workflows/contracts.ts`
     - `src/api/workflows/routes.ts`
     - `docs/contracts/workflow-api-schema-contract.md`
     - related route/API contract tests.

## Candidate File Focus for Implementation

### Likely new files
- `src/core/services/ai/` (or equivalent) wrapper around `@mariozechner/pi-ai` runtime calls.

### Likely modified files
- `src/core/services/entry-service.ts`
- `src/core/services/job-service.ts` (if automation fix-suggestion path is model-backed)
- `src/core/services/signal-service.ts` (if triage/convert assistance is model-backed)
- `src/core/app/core-platform.ts`
- `src/api/workflows/contracts.ts` (only if request/response shape changes)
- `src/api/workflows/routes.ts` (only if request validation changes)
- `src/api/workflows/workflow-api.ts`
- `src/api/workflows/errors.ts` (if AI-specific failure mapping is introduced)
- `src/core/domain/audit-transition.ts` (only if richer metadata schema is needed)
- `src/core/repositories/sqlite/sqlite-core-repository.ts` (if metadata/query handling needs extension)

### Likely modified tests
- `tests/unit/core/services/entry-service.test.ts`
- `tests/unit/core/services/job-service.test.ts`
- `tests/unit/core/services/signal-service.test.ts`
- `tests/unit/api/workflows/errors.test.ts`
- `tests/unit/api/workflows/workflow-api.test.ts`
- `tests/unit/api/workflows/routes.test.ts` (if payload contract changes)
- `tests/integration/api-data.integration.test.ts`
- `tests/integration/workflow-api.integration.test.ts`
- `tests/integration/workflow-api-http.integration.test.ts`
- `tests/integration/workflow-automation.integration.test.ts`
- `tests/integration/workflow-automation-edge-cases.integration.test.ts`
- `tests/integration/database-core-platform.integration.test.ts` (for sqlite-backed audit/rollback assertions)

## Open Decisions to Resolve During Implementation
1. Which exact workflows become model-backed in this ticket:
   - minimum likely: `capture.suggest`;
   - optional/clarify: retry fix suggestion and/or signal triage/convert assistance.
2. Determinism strategy:
   - provider/model selection + stable option defaults (e.g., low/zero temperature, bounded tokens);
   - unit tests should use deterministic stubs/mocks around ai client boundary.
3. Error taxonomy:
   - map pi-ai `stopReason`/runtime failures into existing API error codes without leaking provider internals.
4. Audit metadata shape:
   - include model/provider/usage/stopReason fields while keeping `metadata` string-serializable and compatible with sqlite/in-memory paths.

## Suggested Verification Commands for Implementation Slice
- `bun test tests/unit/core/services/entry-service.test.ts`
- `bun test tests/unit/core/services/job-service.test.ts`
- `bun test tests/unit/core/services/signal-service.test.ts`
- `bun test tests/unit/api/workflows/errors.test.ts`
- `bun test tests/unit/api/workflows/workflow-api.test.ts`
- `bun test tests/integration/workflow-api.integration.test.ts`
- `bun test tests/integration/workflow-api-http.integration.test.ts`
- `bun test tests/integration/workflow-automation.integration.test.ts tests/integration/workflow-automation-edge-cases.integration.test.ts`
- `bun test tests/integration/database-core-platform.integration.test.ts`
- `bun run typecheck`

