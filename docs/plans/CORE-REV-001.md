# CORE-REV-001 Plan: Core Domain Models/Services (TDD First)

## Overview
Implement a core-domain kernel that covers all spec-required objects (`Entry`, `Task`, `Event`, `Project`, `Note`, `Signal`, `Job`, `Notification`, `View`, `Memory`, `Checkpoint`) and enforces auditable, reversible state transitions. The implementation will stay core-first (no UI), use Effect services/layers for domain workflows, and keep side effects behind repository/outbound-adapter boundaries.

Primary approach:
1. Define shared domain primitives (IDs, timestamps, actor metadata, transition records).
2. Add one constructor or transition function per entity with explicit state machines where applicable.
3. Add Effect services for workflows (capture/triage/planning/approval/job/checkpoint).
4. Replace integration `todo` cases with executable assertions for core behaviors.

## TDD Step Order (tests first, then implementation)

Each step is atomic: one failing test, then one function/service method implementation.

1. **Test:** `tests/unit/core/domain/audit-transition.test.ts` -> `createAuditTransition records from/to state, actor, reason`.
   **Implement:** `src/core/domain/audit-transition.ts` -> `export const createAuditTransition(...)`.
2. **Test:** `tests/unit/core/domain/entry.test.ts` -> `createEntry sets captured defaults and audit metadata`.
   **Implement:** `src/core/domain/entry.ts` -> `export const createEntry(input: CreateEntryInput): Effect.Effect<Entry, DomainValidationError>`.
3. **Test:** `tests/unit/core/domain/task.test.ts` -> `createTask sets status=planned and schedule fields`.
   **Implement:** `src/core/domain/task.ts` -> `export const createTask(input: CreateTaskInput): Effect.Effect<Task, DomainValidationError>`.
4. **Test:** `tests/unit/core/domain/event.test.ts` -> `createEvent sets syncState=local_only`.
   **Implement:** `src/core/domain/event.ts` -> `export const createEvent(input: CreateEventInput): Effect.Effect<Event, DomainValidationError>`.
5. **Test:** `tests/unit/core/domain/project.test.ts` -> `createProject seeds lifecycle=active`.
   **Implement:** `src/core/domain/project.ts` -> `export const createProject(input: CreateProjectInput): Effect.Effect<Project, DomainValidationError>`.
6. **Test:** `tests/unit/core/domain/note.test.ts` -> `createNote links entity references deterministically`.
   **Implement:** `src/core/domain/note.ts` -> `export const createNote(input: CreateNoteInput): Effect.Effect<Note, DomainValidationError>`.
7. **Test:** `tests/unit/core/domain/signal.test.ts` -> `createSignal seeds triageState=untriaged`.
   **Implement:** `src/core/domain/signal.ts` -> `export const createSignal(input: CreateSignalInput): Effect.Effect<Signal, DomainValidationError>`.
8. **Test:** `tests/unit/core/domain/job.test.ts` -> `createJob seeds runState=idle and retry metadata`.
   **Implement:** `src/core/domain/job.ts` -> `export const createJob(input: CreateJobInput): Effect.Effect<Job, DomainValidationError>`.
9. **Test:** `tests/unit/core/domain/notification.test.ts` -> `createNotification seeds status=pending`.
   **Implement:** `src/core/domain/notification.ts` -> `export const createNotification(input: CreateNotificationInput): Effect.Effect<Notification, DomainValidationError>`.
10. **Test:** `tests/unit/core/domain/view.test.ts` -> `createView persists filter/query schema safely`.
    **Implement:** `src/core/domain/view.ts` -> `export const createView(input: CreateViewInput): Effect.Effect<View, DomainValidationError>`.
11. **Test:** `tests/unit/core/domain/memory.test.ts` -> `createMemory seeds source and confidence metadata`.
    **Implement:** `src/core/domain/memory.ts` -> `export const createMemory(input: CreateMemoryInput): Effect.Effect<Memory, DomainValidationError>`.
12. **Test:** `tests/unit/core/domain/checkpoint.test.ts` -> `createCheckpoint captures snapshot pointers and rollback target`.
    **Implement:** `src/core/domain/checkpoint.ts` -> `export const createCheckpoint(input: CreateCheckpointInput): Effect.Effect<Checkpoint, DomainValidationError>`.
13. **Test:** `tests/unit/core/repositories/in-memory-core-repository.test.ts` -> `save/get/list entity records by type and id`.
    **Implement:** `src/core/repositories/in-memory-core-repository.ts` -> `saveEntity`, `getEntity`, `listEntities`.
14. **Test:** `tests/unit/core/repositories/in-memory-core-repository.test.ts` -> `appendAuditTransition + listAuditTrail returns ordered immutable log`.
    **Implement:** `src/core/repositories/in-memory-core-repository.ts` -> `appendAuditTransition`, `listAuditTrail`.
15. **Test:** `tests/unit/core/services/entry-service.test.ts` -> `captureEntry persists Entry and writes audit transition`.
    **Implement:** `src/core/services/entry-service.ts` -> `captureEntry(input: CaptureEntryInput): Effect.Effect<Entry, EntryServiceError, CoreRepository>`.
16. **Test:** `tests/unit/core/services/entry-service.test.ts` -> `acceptEntryAsTask converts Entry -> Task and writes linked transitions`.
    **Implement:** `src/core/services/entry-service.ts` -> `acceptEntryAsTask(input: AcceptEntryAsTaskInput): Effect.Effect<Task, EntryServiceError, CoreRepository>`.
17. **Test:** `tests/unit/core/services/task-service.test.ts` -> `transitionTask supports complete`.
    **Implement:** `src/core/services/task-service.ts` -> `completeTask(taskId: TaskId, actor: ActorRef): Effect.Effect<Task, TaskTransitionError, CoreRepository>`.
18. **Test:** `tests/unit/core/services/task-service.test.ts` -> `transitionTask supports defer`.
    **Implement:** `src/core/services/task-service.ts` -> `deferTask(taskId: TaskId, until: Date, actor: ActorRef): Effect.Effect<Task, TaskTransitionError, CoreRepository>`.
19. **Test:** `tests/unit/core/services/task-service.test.ts` -> `transitionTask supports reschedule`.
    **Implement:** `src/core/services/task-service.ts` -> `rescheduleTask(taskId: TaskId, nextAt: Date, actor: ActorRef): Effect.Effect<Task, TaskTransitionError, CoreRepository>`.
20. **Test:** `tests/unit/core/services/signal-service.test.ts` -> `triageSignal updates triage state with audit record`.
    **Implement:** `src/core/services/signal-service.ts` -> `triageSignal(signalId: SignalId, decision: SignalTriageDecision, actor: ActorRef): Effect.Effect<Signal, SignalServiceError, CoreRepository>`.
21. **Test:** `tests/unit/core/services/signal-service.test.ts` -> `convertSignal creates target entity (Task/Event/Note/Project) and audit linkage`.
    **Implement:** `src/core/services/signal-service.ts` -> `convertSignal(input: ConvertSignalInput): Effect.Effect<ConvertedEntityRef, SignalServiceError, CoreRepository>`.
22. **Test:** `tests/unit/core/services/event-service.test.ts` -> `requestEventSync sets pending_approval and emits notification`.
    **Implement:** `src/core/services/event-service.ts` -> `requestEventSync(eventId: EventId, actor: ActorRef): Effect.Effect<{ event: Event; notification: Notification }, EventServiceError, CoreRepository>`.
23. **Test:** `tests/unit/core/services/approval-service.test.ts` -> `approveOutboundAction enforces explicit approval before execute`.
    **Implement:** `src/core/services/approval-service.ts` -> `approveOutboundAction(input: ApproveOutboundActionInput): Effect.Effect<ApprovalResult, ApprovalServiceError, CoreRepository | OutboundActionPort>`.
24. **Test:** `tests/unit/core/services/job-service.test.ts` -> `recordJobRun stores success/failure outcome and diagnostics`.
    **Implement:** `src/core/services/job-service.ts` -> `recordJobRun(input: RecordJobRunInput): Effect.Effect<Job, JobServiceError, CoreRepository>`.
25. **Test:** `tests/unit/core/services/job-service.test.ts` -> `retryJobRun increments retry count and links prior failure`.
    **Implement:** `src/core/services/job-service.ts` -> `retryJobRun(jobId: JobId, actor: ActorRef): Effect.Effect<Job, JobServiceError, CoreRepository>`.
26. **Test:** `tests/unit/core/services/checkpoint-service.test.ts` -> `createWorkflowCheckpoint snapshots entity refs and audit cursor`.
    **Implement:** `src/core/services/checkpoint-service.ts` -> `createWorkflowCheckpoint(input: CreateWorkflowCheckpointInput): Effect.Effect<Checkpoint, CheckpointServiceError, CoreRepository>`.
27. **Test:** `tests/unit/core/services/checkpoint-service.test.ts` -> `recoverCheckpoint restores prior state and appends recovery transition`.
    **Implement:** `src/core/services/checkpoint-service.ts` -> `recoverCheckpoint(checkpointId: CheckpointId, actor: ActorRef): Effect.Effect<RecoveryResult, CheckpointServiceError, CoreRepository>`.
28. **Test:** `tests/unit/core/services/view-service.test.ts` -> `saveView upserts saved query/filter`.
    **Implement:** `src/core/services/view-service.ts` -> `saveView(input: SaveViewInput): Effect.Effect<View, ViewServiceError, CoreRepository>`.
29. **Test:** `tests/unit/core/services/memory-service.test.ts` -> `upsertMemory merges fact value and provenance`.
    **Implement:** `src/core/services/memory-service.ts` -> `upsertMemory(input: UpsertMemoryInput): Effect.Effect<Memory, MemoryServiceError, CoreRepository>`.
30. **Integration test:** `tests/integration/core-platform.integration.test.ts` -> replace TODO `captures an Entry and promotes it into a triaged Task` with executable assertion.
    **Implement:** `src/core/app/core-platform.ts` -> `buildCorePlatform(deps?: Partial<CorePlatformDeps>): Effect.Effect<CorePlatform, never>` (wire services + in-memory repo for tests).
31. **Integration test:** `tests/integration/core-platform.integration.test.ts` -> replace TODO `moves a Task through project planning and checkpoint creation` with executable assertion.
    **Implement:** `src/core/app/core-platform.ts` -> `runPlanningTransition(input: PlanningTransitionInput)` and `checkpointCurrentPlan(...)` glue methods.
32. **Integration test:** `tests/integration/core-platform.integration.test.ts` -> replace TODO `persists and rehydrates core entities across app restarts` with executable assertion.
    **Implement:** `src/core/repositories/file-core-repository.ts` -> `loadSnapshot(path)`, `persistSnapshot(path)` and reuse in `buildCorePlatform`.
33. **Integration test:** `tests/integration/workflow-automation.integration.test.ts` -> replace TODO `runs planning loop updates and supports complete/defer/reschedule transitions`.
    **Implement:** complete wiring of `task-service` in `src/core/app/core-platform.ts` with deterministic clock/id providers.
34. **Integration test:** `tests/integration/workflow-automation.integration.test.ts` -> replace TODO `records automation run outcomes and supports inspect + retry/fix flow`.
    **Implement:** `src/core/app/core-platform.ts` -> `inspectJobRun(jobId)` and `retryJob(jobId)` façade methods.
35. **Integration test:** `tests/integration/workflow-automation.integration.test.ts` -> replace TODO `supports AI-applied update inspection and keep/recover audit workflow`.
    **Implement:** `src/core/services/checkpoint-service.ts` -> `keepCheckpoint(checkpointId)` + `recoverCheckpoint(checkpointId)` final wiring for auditability.

## Files To Create / Modify (with specific signatures)

### Create
- `src/core/domain/audit-transition.ts`
  - `createAuditTransition(input: CreateAuditTransitionInput): Effect.Effect<AuditTransition, DomainValidationError>`
- `src/core/domain/entry.ts`
  - `createEntry(input: CreateEntryInput): Effect.Effect<Entry, DomainValidationError>`
- `src/core/domain/task.ts`
  - `createTask(input: CreateTaskInput): Effect.Effect<Task, DomainValidationError>`
- `src/core/domain/event.ts`
  - `createEvent(input: CreateEventInput): Effect.Effect<Event, DomainValidationError>`
- `src/core/domain/project.ts`
  - `createProject(input: CreateProjectInput): Effect.Effect<Project, DomainValidationError>`
- `src/core/domain/note.ts`
  - `createNote(input: CreateNoteInput): Effect.Effect<Note, DomainValidationError>`
- `src/core/domain/signal.ts`
  - `createSignal(input: CreateSignalInput): Effect.Effect<Signal, DomainValidationError>`
- `src/core/domain/job.ts`
  - `createJob(input: CreateJobInput): Effect.Effect<Job, DomainValidationError>`
- `src/core/domain/notification.ts`
  - `createNotification(input: CreateNotificationInput): Effect.Effect<Notification, DomainValidationError>`
- `src/core/domain/view.ts`
  - `createView(input: CreateViewInput): Effect.Effect<View, DomainValidationError>`
- `src/core/domain/memory.ts`
  - `createMemory(input: CreateMemoryInput): Effect.Effect<Memory, DomainValidationError>`
- `src/core/domain/checkpoint.ts`
  - `createCheckpoint(input: CreateCheckpointInput): Effect.Effect<Checkpoint, DomainValidationError>`
- `src/core/repositories/core-repository.ts`
  - `interface CoreRepository { saveEntity; getEntity; listEntities; appendAuditTransition; listAuditTrail; persistSnapshot?; loadSnapshot? }`
- `src/core/repositories/in-memory-core-repository.ts`
  - `makeInMemoryCoreRepository(): CoreRepository`
- `src/core/repositories/file-core-repository.ts`
  - `makeFileCoreRepository(path: string): Effect.Effect<CoreRepository, FileRepositoryError>`
- `src/core/services/entry-service.ts`
  - `captureEntry(...)`, `acceptEntryAsTask(...)`
- `src/core/services/task-service.ts`
  - `completeTask(...)`, `deferTask(...)`, `rescheduleTask(...)`
- `src/core/services/signal-service.ts`
  - `triageSignal(...)`, `convertSignal(...)`
- `src/core/services/event-service.ts`
  - `requestEventSync(...)`
- `src/core/services/approval-service.ts`
  - `approveOutboundAction(...)`
- `src/core/services/job-service.ts`
  - `recordJobRun(...)`, `retryJobRun(...)`, `inspectJobRun(...)`
- `src/core/services/checkpoint-service.ts`
  - `createWorkflowCheckpoint(...)`, `keepCheckpoint(...)`, `recoverCheckpoint(...)`
- `src/core/services/view-service.ts`
  - `saveView(...)`
- `src/core/services/memory-service.ts`
  - `upsertMemory(...)`
- `src/core/app/core-platform.ts`
  - `buildCorePlatform(...)`

- `tests/unit/core/domain/*.test.ts` (entity + transition model tests)
- `tests/unit/core/repositories/in-memory-core-repository.test.ts`
- `tests/unit/core/services/*.test.ts`

### Modify
- `tests/integration/core-platform.integration.test.ts` (replace all `test.todo` with executable assertions)
- `tests/integration/workflow-automation.integration.test.ts` (replace core-domain-relevant `test.todo` with executable assertions)
- `package.json` (add granular scripts such as `test:unit:core`, `test:core`, `typecheck`)

## Tests To Write

### Unit tests
- Domain constructor tests for all 11 entities (required fields, default lifecycle state, deterministic metadata).
- State-transition tests:
  - task transitions (`planned -> completed/deferred/rescheduled`)
  - signal triage (`untriaged -> triaged/converted/rejected`)
  - event sync gate (`local_only -> pending_approval -> synced`)
  - job lifecycle (`idle -> running -> succeeded/failed -> retrying`)
  - checkpoint lifecycle (`created -> kept/recovered`)
- Audit tests: every mutating function appends an immutable `AuditTransition` with actor + reason + timestamp.
- Repository contract tests for entity storage, audit ordering, and snapshot load/save.
- Service tests for workflow methods with mocked repository/outbound ports and explicit error tags.

### Integration tests
- `core-platform.integration`: entry capture -> task promotion path (including audit chain).
- `core-platform.integration`: planning transition + checkpoint creation.
- `core-platform.integration`: persistence + rehydration across restart.
- `workflow-automation.integration`: planning loop transitions (`complete/defer/reschedule`).
- `workflow-automation.integration`: job inspect + retry/fix lifecycle.
- `workflow-automation.integration`: AI update keep/recover via checkpoints and audit log.

## Risks and Mitigations

1. **Risk:** Ticket scope is broad (11 entities + multiple workflows), causing long feedback cycles.
   **Mitigation:** Keep strict atomic TDD slices above; run targeted unit tests per step before moving on.
2. **Risk:** Inconsistent transition semantics across services.
   **Mitigation:** Centralize transition creation in `createAuditTransition` and enforce via shared helpers.
3. **Risk:** Hidden side effects leak into domain logic.
   **Mitigation:** Keep repositories/outbound execution behind interfaces; pure/domain functions remain deterministic.
4. **Risk:** Restart/rehydration tests become flaky due to non-deterministic IDs/time.
   **Mitigation:** Inject deterministic clock/id providers in test layers.
5. **Risk:** Approval gating is bypassed accidentally.
   **Mitigation:** Make `approveOutboundAction` the only path that can call `OutboundActionPort.execute` and test negative paths.

## Verification Against Acceptance Criteria

1. **All required domain objects exist:** verify unit tests for each entity constructor pass and types are exported by core platform index.
2. **Services exist for required workflows:** verify service unit tests pass for capture, triage/conversion, planning transitions, approval gating, job inspect/retry, and checkpoint keep/recover.
3. **Auditable state transitions are enforced:** verify audit unit tests and integration assertions confirm a transition record for each mutation.
4. **Core integration behavior works end-to-end:** run and pass:
   - `bun run test:integration:core`
   - `bun run test:integration:workflow`
5. **Core quality gate:** run and pass relevant slice checks:
   - `bun run test:unit:core`
   - `bun run typecheck`
