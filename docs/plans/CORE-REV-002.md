# CORE-REV-002 Plan: Build Required Core Workflow API Surfaces (TDD First)

## Overview
Close the remaining spec-compliance gaps for required core workflows by adding two missing API surfaces in the core layer:
1. A first-class signal ingestion workflow API (`ingestSignal`) that persists raw signals before triage.
2. A fully gated outbound-draft approval lifecycle (`draft -> pending_approval -> executed`) with explicit approval checks, persisted execution result, and audit transitions.

This plan keeps core-first ordering, uses Effect-based services, and extends existing workflow coverage without introducing UI work.

## TDD Step Order (tests first, then implementation)

1. **Test:** `tests/unit/core/domain/outbound-draft.test.ts` -> `createOutboundDraft sets status=draft and timestamps`.
   **Implement:** `src/core/domain/outbound-draft.ts` -> `createOutboundDraft(input: CreateOutboundDraftInput)`.
2. **Test:** `tests/unit/core/services/signal-service.test.ts` -> `ingestSignal persists untriaged signal and appends audit transition none->untriaged`.
   **Implement:** `src/core/services/signal-service.ts` -> `ingestSignal(repository, input: IngestSignalInput)`.
3. **Test:** `tests/integration/api-data.integration.test.ts` -> `platform.ingestSignal exposes signal ingestion route and persists signal before triage`.
   **Implement:** `src/core/app/core-platform.ts` -> add `ingestSignal(input: IngestSignalInput)` to `CorePlatform` and returned object wiring.
4. **Test:** `tests/unit/core/services/signal-service.test.ts` -> `convertSignal(... targetType=outbound_draft) creates typed outbound draft with status=draft`.
   **Implement:** `src/core/services/signal-service.ts` -> refactor outbound draft conversion branch to use `createOutboundDraft`.
5. **Test:** `tests/unit/core/services/outbound-draft-service.test.ts` -> `requestOutboundDraftExecution moves draft->pending_approval, creates approval notification, appends audit`.
   **Implement:** `src/core/services/outbound-draft-service.ts` -> `requestOutboundDraftExecution(repository, draftId, actor, at?)`.
6. **Test:** `tests/integration/api-data.integration.test.ts` -> `platform.requestOutboundDraftExecution exposes explicit outbound approval gate entrypoint`.
   **Implement:** `src/core/app/core-platform.ts` -> add `requestOutboundDraftExecution(draftId, actor, at?)` route wiring.
7. **Test:** `tests/unit/core/services/approval-service.test.ts` -> `approveOutboundAction rejects outbound_draft actions when entityType is not outbound_draft`.
   **Implement:** `src/core/services/approval-service.ts` -> add outbound-draft entity-type validation.
8. **Test:** `tests/unit/core/services/approval-service.test.ts` -> `approveOutboundAction rejects outbound_draft approval when draft is missing`.
   **Implement:** `src/core/services/approval-service.ts` -> add outbound draft existence lookup and error path.
9. **Test:** `tests/unit/core/services/approval-service.test.ts` -> `approveOutboundAction rejects outbound_draft unless status=pending_approval`.
   **Implement:** `src/core/services/approval-service.ts` -> add outbound draft state precondition check.
10. **Test:** `tests/unit/core/services/approval-service.test.ts` -> `approveOutboundAction executes outbound draft, persists status=executed, stores executionId, appends audit`.
    **Implement:** `src/core/services/approval-service.ts` -> implement outbound draft execution success path with persistence and transition append.
11. **Test:** `tests/integration/api-data.integration.test.ts` -> `signal ingestion -> triage -> convert outbound draft -> request approval -> explicit approve executes once`.
    **Implement:** minimal glue updates across `src/core/services/*.ts` signatures or transition metadata if integration test reveals mismatch.
12. **Test:** `tests/integration/api-data.integration.test.ts` -> `pending outbound draft state survives snapshot restart before approval (local-first)`.
    **Implement:** `src/core/repositories/file-core-repository.ts` compatibility update only if restart test exposes serialization gap.

## Files to Create/Modify (with function signatures)

### Create
- `src/core/domain/outbound-draft.ts`
  - `export type OutboundDraftStatus = "draft" | "pending_approval" | "executed"`
  - `export interface OutboundDraft { id: string; payload: string; sourceSignalId: string; status: OutboundDraftStatus; executionId?: string; createdAt: string; updatedAt: string }`
  - `export interface CreateOutboundDraftInput { id?: string; payload: string; sourceSignalId: string; createdAt?: Date; updatedAt?: Date }`
  - `export const createOutboundDraft(input: CreateOutboundDraftInput): Effect.Effect<OutboundDraft, DomainValidationError>`
- `src/core/services/outbound-draft-service.ts`
  - `export class OutboundDraftServiceError extends Data.TaggedError("OutboundDraftServiceError")<{ message: string }>`
  - `export const requestOutboundDraftExecution(repository: CoreRepository, draftId: string, actor: ActorRef, at?: Date): Effect.Effect<{ draft: OutboundDraft; notification: Notification }, OutboundDraftServiceError>`
- `tests/unit/core/domain/outbound-draft.test.ts`
- `tests/unit/core/services/outbound-draft-service.test.ts`

### Modify
- `src/core/services/signal-service.ts`
  - `export interface IngestSignalInput { signalId?: string; source: string; payload: string; actor: ActorRef; at?: Date }`
  - `export const ingestSignal(repository: CoreRepository, input: IngestSignalInput): Effect.Effect<Signal, SignalServiceError>`
  - update `convertSignal(...)` outbound-draft branch to call `createOutboundDraft(...)`
- `src/core/services/approval-service.ts`
  - extend `approveOutboundAction(...)` to enforce outbound-draft preconditions and persist `executed` transition + `executionId`
- `src/core/app/core-platform.ts`
  - add `ingestSignal(input: IngestSignalInput): ReturnType<typeof ingestSignal>`
  - add `requestOutboundDraftExecution(draftId: string, actor: ActorRef, at?: Date): ReturnType<typeof requestOutboundDraftExecution>`
- `tests/unit/core/services/signal-service.test.ts`
- `tests/unit/core/services/approval-service.test.ts`
- `tests/integration/api-data.integration.test.ts`
- `tests/integration/core-platform.integration.test.ts` (optional API surface assertion if needed)
- `src/core/repositories/file-core-repository.ts` (only if step 12 fails)

## Tests to Write

### Unit
- `tests/unit/core/domain/outbound-draft.test.ts`
  - validates domain constructor defaults and timestamp shape.
- `tests/unit/core/services/signal-service.test.ts`
  - `ingestSignal` persistence + audit.
  - outbound draft conversion branch returns typed lifecycle object.
- `tests/unit/core/services/outbound-draft-service.test.ts`
  - request path produces `pending_approval` + `approval_required` notification + audit transition.
- `tests/unit/core/services/approval-service.test.ts`
  - outbound draft validation, missing-entity rejection, pending-state requirement, execute success persistence and audit.

### Integration
- `tests/integration/api-data.integration.test.ts`
  - platform signal ingestion route persists local-first signal.
  - end-to-end outbound draft gate flow (reject without approval, reject before pending, execute after explicit approval).
  - restart test preserving pending outbound draft state across snapshot load.
- Existing regression suites to run unchanged:
  - `tests/integration/core-platform.integration.test.ts` (capture/approval baseline)
  - `tests/integration/workflow-automation.integration.test.ts` (planning loop baseline)

## Risks and Mitigations

1. **Risk:** New outbound draft lifecycle states conflict with previously persisted shape.
   **Mitigation:** Keep backward-compatible optional fields and add restart integration coverage before merging.
2. **Risk:** Approval logic divergence between `event_sync` and `outbound_draft` paths.
   **Mitigation:** Follow identical guard ordering: explicit approval -> entity type -> existence -> pending state -> execute -> persist -> audit.
3. **Risk:** Audit transition completeness gaps during multi-entity writes.
   **Mitigation:** Assert audit entries in every new unit test for each mutation path.
4. **Risk:** API surface drift between services and `CorePlatform` facade.
   **Mitigation:** Add integration tests that call new facade methods directly; keep signatures derived from service return types.
5. **Risk:** Over-scoping beyond ticket intent.
   **Mitigation:** Limit implementation to missing workflow surfaces (signal ingestion + outbound draft gate) and run existing capture/planning suites as regression checks.

## Verification Against Acceptance Criteria

1. **Required workflow APIs present and callable**
   - Verify `CorePlatform` exposes `captureEntry`, `triageSignal`, `completeTask/deferTask/rescheduleTask`, `approveOutboundAction`, plus new `ingestSignal` and `requestOutboundDraftExecution`.
2. **Explicit outbound approval gates enforced**
   - Unit + integration assertions prove outbound execution is blocked unless `approved=true` and lifecycle is in `pending_approval`.
3. **Core workflows remain complete and reliable**
   - Run regression and new tests:
     - `bun run test:unit:core`
     - `bun run test:integration:api`
     - `bun run test:integration:core`
     - `bun run test:integration:workflow`
4. **Local-first and auditable behavior preserved**
   - Restart integration test confirms pending outbound draft survives snapshot reload.
   - Audit assertions confirm state transitions for ingest/request/approve paths.
5. **Type safety for API surface updates**
   - `bun run typecheck`
