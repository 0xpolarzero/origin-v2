import { Effect } from "effect";

import { createAuditTransition } from "../domain/audit-transition";
import { ActorRef } from "../domain/common";
import { createJob, CreateJobInput, Job } from "../domain/job";
import { CoreRepository } from "../repositories/core-repository";
import { makeFileCoreRepository } from "../repositories/file-core-repository";
import { makeInMemoryCoreRepository } from "../repositories/in-memory-core-repository";
import {
  approveOutboundAction,
  ApproveOutboundActionInput,
  OutboundActionPort,
} from "../services/approval-service";
import {
  createWorkflowCheckpoint,
  CreateWorkflowCheckpointInput,
  keepCheckpoint,
  recoverCheckpoint,
} from "../services/checkpoint-service";
import {
  acceptEntryAsTask,
  AcceptEntryAsTaskInput,
  captureEntry,
  CaptureEntryInput,
  editEntrySuggestion,
  EditEntrySuggestionInput,
  rejectEntrySuggestion,
  RejectEntrySuggestionInput,
  suggestEntryAsTask,
  SuggestEntryAsTaskInput,
} from "../services/entry-service";
import { requestEventSync } from "../services/event-service";
import {
  inspectJobRun,
  JobRunInspection,
  recordJobRun,
  RecordJobRunInput,
  retryJobRun,
} from "../services/job-service";
import { saveView, SaveViewInput } from "../services/view-service";
import { upsertMemory, UpsertMemoryInput } from "../services/memory-service";
import {
  convertSignal,
  ConvertSignalInput,
  triageSignal,
} from "../services/signal-service";
import {
  completeTask,
  deferTask,
  rescheduleTask,
} from "../services/task-service";

export interface BuildCorePlatformOptions {
  repository?: CoreRepository;
  snapshotPath?: string;
  loadSnapshotOnInit?: boolean;
  outboundActionPort?: OutboundActionPort;
}

export interface CreateJobInPlatformInput extends CreateJobInput {
  jobId?: string;
  actor?: ActorRef;
  at?: Date;
}

export interface CorePlatform {
  captureEntry: (input: CaptureEntryInput) => ReturnType<typeof captureEntry>;
  acceptEntryAsTask: (
    input: AcceptEntryAsTaskInput,
  ) => ReturnType<typeof acceptEntryAsTask>;
  suggestEntryAsTask: (
    input: SuggestEntryAsTaskInput,
  ) => ReturnType<typeof suggestEntryAsTask>;
  editEntrySuggestion: (
    input: EditEntrySuggestionInput,
  ) => ReturnType<typeof editEntrySuggestion>;
  rejectEntrySuggestion: (
    input: RejectEntrySuggestionInput,
  ) => ReturnType<typeof rejectEntrySuggestion>;
  completeTask: (
    taskId: string,
    actor: ActorRef,
    at?: Date,
  ) => ReturnType<typeof completeTask>;
  deferTask: (
    taskId: string,
    until: Date,
    actor: ActorRef,
    at?: Date,
  ) => ReturnType<typeof deferTask>;
  rescheduleTask: (
    taskId: string,
    nextAt: Date,
    actor: ActorRef,
    at?: Date,
  ) => ReturnType<typeof rescheduleTask>;
  triageSignal: (
    signalId: string,
    decision: string,
    actor: ActorRef,
    at?: Date,
  ) => ReturnType<typeof triageSignal>;
  convertSignal: (
    input: ConvertSignalInput,
  ) => ReturnType<typeof convertSignal>;
  requestEventSync: (
    eventId: string,
    actor: ActorRef,
    at?: Date,
  ) => ReturnType<typeof requestEventSync>;
  approveOutboundAction: (
    input: ApproveOutboundActionInput,
  ) => ReturnType<typeof approveOutboundAction>;
  createJob: (input: CreateJobInPlatformInput) => Effect.Effect<Job, Error>;
  recordJobRun: (input: RecordJobRunInput) => ReturnType<typeof recordJobRun>;
  inspectJobRun: (jobId: string) => Effect.Effect<JobRunInspection, Error>;
  retryJob: (
    jobId: string,
    actor: ActorRef,
    at?: Date,
  ) => ReturnType<typeof retryJobRun>;
  createWorkflowCheckpoint: (
    input: CreateWorkflowCheckpointInput,
  ) => ReturnType<typeof createWorkflowCheckpoint>;
  keepCheckpoint: (
    checkpointId: string,
    actor: ActorRef,
    at?: Date,
  ) => ReturnType<typeof keepCheckpoint>;
  recoverCheckpoint: (
    checkpointId: string,
    actor: ActorRef,
    at?: Date,
  ) => ReturnType<typeof recoverCheckpoint>;
  saveView: (input: SaveViewInput) => ReturnType<typeof saveView>;
  upsertMemory: (input: UpsertMemoryInput) => ReturnType<typeof upsertMemory>;
  getEntity: <T>(
    entityType: string,
    entityId: string,
  ) => ReturnType<CoreRepository["getEntity<T>"]>;
  listEntities: <T>(
    entityType: string,
  ) => ReturnType<CoreRepository["listEntities<T>"]>;
  listAuditTrail: (filter?: {
    entityType?: string;
    entityId?: string;
  }) => ReturnType<CoreRepository["listAuditTrail"]>;
  persistSnapshot: () => Effect.Effect<void, Error>;
  loadSnapshot: () => Effect.Effect<void, Error>;
}

export const buildCorePlatform = (
  options: BuildCorePlatformOptions = {},
): Effect.Effect<CorePlatform, Error> =>
  Effect.gen(function* () {
    const repository = yield* ((): Effect.Effect<CoreRepository, Error> => {
      if (options.repository) {
        return Effect.succeed(options.repository);
      }

      if (options.snapshotPath) {
        return makeFileCoreRepository(options.snapshotPath).pipe(
          Effect.mapError((error) => new Error(error.message)),
        );
      }

      return Effect.succeed(makeInMemoryCoreRepository());
    })();

    const outboundActionPort: OutboundActionPort =
      options.outboundActionPort ?? {
        execute: () =>
          Effect.succeed({
            executionId: `exec-${crypto.randomUUID()}`,
          }),
      };

    if (
      options.loadSnapshotOnInit &&
      options.snapshotPath &&
      repository.loadSnapshot
    ) {
      yield* repository
        .loadSnapshot(options.snapshotPath)
        .pipe(Effect.catchAll(() => Effect.void));
    }

    const createJobInPlatform = (
      input: CreateJobInPlatformInput,
    ): Effect.Effect<Job, Error> =>
      Effect.gen(function* () {
        const at = input.at ?? new Date();
        const actor = input.actor ?? {
          id: "system:core-platform",
          kind: "system",
        };

        const job = yield* createJob({
          ...input,
          id: input.jobId ?? input.id,
          createdAt: at,
          updatedAt: at,
        }).pipe(Effect.mapError((error) => new Error(error.message)));

        yield* repository.saveEntity("job", job.id, job);

        const transition = yield* createAuditTransition({
          entityType: "job",
          entityId: job.id,
          fromState: "none",
          toState: job.runState,
          actor,
          reason: "Job created",
          at,
        }).pipe(Effect.mapError((error) => new Error(error.message)));

        yield* repository.appendAuditTransition(transition);

        return job;
      });

    return {
      captureEntry: (input) => captureEntry(repository, input),
      acceptEntryAsTask: (input) => acceptEntryAsTask(repository, input),
      suggestEntryAsTask: (input) => suggestEntryAsTask(repository, input),
      editEntrySuggestion: (input) => editEntrySuggestion(repository, input),
      rejectEntrySuggestion: (input) =>
        rejectEntrySuggestion(repository, input),
      completeTask: (taskId, actor, at) =>
        completeTask(repository, taskId, actor, at),
      deferTask: (taskId, until, actor, at) =>
        deferTask(repository, taskId, until, actor, at),
      rescheduleTask: (taskId, nextAt, actor, at) =>
        rescheduleTask(repository, taskId, nextAt, actor, at),
      triageSignal: (signalId, decision, actor, at) =>
        triageSignal(repository, signalId, decision, actor, at),
      convertSignal: (input) => convertSignal(repository, input),
      requestEventSync: (eventId, actor, at) =>
        requestEventSync(repository, eventId, actor, at),
      approveOutboundAction: (input) =>
        approveOutboundAction(repository, outboundActionPort, input),
      createJob: createJobInPlatform,
      recordJobRun: (input) => recordJobRun(repository, input),
      inspectJobRun: (jobId) =>
        inspectJobRun(repository, jobId).pipe(
          Effect.mapError((error) => new Error(error.message)),
        ),
      retryJob: (jobId, actor, at) => retryJobRun(repository, jobId, actor, at),
      createWorkflowCheckpoint: (input) =>
        createWorkflowCheckpoint(repository, input),
      keepCheckpoint: (checkpointId, actor, at) =>
        keepCheckpoint(repository, checkpointId, actor, at),
      recoverCheckpoint: (checkpointId, actor, at) =>
        recoverCheckpoint(repository, checkpointId, actor, at),
      saveView: (input) => saveView(repository, input),
      upsertMemory: (input) => upsertMemory(repository, input),
      getEntity: (entityType, entityId) =>
        repository.getEntity(entityType, entityId),
      listEntities: (entityType) => repository.listEntities(entityType),
      listAuditTrail: (filter) => repository.listAuditTrail(filter),
      persistSnapshot: () => {
        if (repository.persistSnapshot && options.snapshotPath) {
          return repository.persistSnapshot(options.snapshotPath);
        }

        return Effect.void;
      },
      loadSnapshot: () => {
        if (repository.loadSnapshot && options.snapshotPath) {
          return repository.loadSnapshot(options.snapshotPath);
        }

        return Effect.void;
      },
    };
  });
