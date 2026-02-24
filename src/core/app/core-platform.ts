import { Effect } from "effect";

import { createAuditTransition } from "../domain/audit-transition";
import { Checkpoint } from "../domain/checkpoint";
import { ActorRef, ENTITY_TYPES } from "../domain/common";
import { createJob, CreateJobInput, Job } from "../domain/job";
import { CoreRepository } from "../repositories/core-repository";
import { makeFileCoreRepository } from "../repositories/file-core-repository";
import { makeInMemoryCoreRepository } from "../repositories/in-memory-core-repository";
import { makeSqliteCoreRepository } from "../repositories/sqlite/sqlite-core-repository";
import {
  approveOutboundAction,
  ApproveOutboundActionInput,
  OutboundActionPort,
} from "../services/approval-service";
import {
  ActivityFeedItem,
  listActivityFeed,
  ListActivityFeedInput,
} from "../services/activity-service";
import {
  createWorkflowCheckpoint,
  CreateWorkflowCheckpointInput,
  inspectWorkflowCheckpoint as inspectWorkflowCheckpointInService,
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
  JobListItem,
  JobRunHistoryRecord,
  JobRunInspection,
  listJobs,
  listJobRunHistory,
  recordJobRun,
  RecordJobRunInput,
  retryJobRun,
} from "../services/job-service";
import { saveView, SaveViewInput } from "../services/view-service";
import { upsertMemory, UpsertMemoryInput } from "../services/memory-service";
import { requestOutboundDraftExecution } from "../services/outbound-draft-service";
import {
  convertSignal,
  ConvertSignalInput,
  ingestSignal,
  IngestSignalInput,
  triageSignal,
} from "../services/signal-service";
import {
  completeTask,
  deferTask,
  rescheduleTask,
} from "../services/task-service";

export interface BuildCorePlatformOptions {
  repository?: CoreRepository;
  databasePath?: string;
  runMigrationsOnInit?: boolean;
  snapshotPath?: string;
  loadSnapshotOnInit?: boolean;
  importSnapshotIntoDatabase?: boolean;
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
  ingestSignal: (input: IngestSignalInput) => ReturnType<typeof ingestSignal>;
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
  requestOutboundDraftExecution: (
    draftId: string,
    actor: ActorRef,
    at?: Date,
  ) => ReturnType<typeof requestOutboundDraftExecution>;
  approveOutboundAction: (
    input: ApproveOutboundActionInput,
  ) => ReturnType<typeof approveOutboundAction>;
  createJob: (input: CreateJobInPlatformInput) => Effect.Effect<Job, Error>;
  recordJobRun: (input: RecordJobRunInput) => ReturnType<typeof recordJobRun>;
  inspectJobRun: (jobId: string) => Effect.Effect<JobRunInspection, Error>;
  listJobRunHistory: (
    jobId: string,
    options?: { limit?: number; beforeAt?: Date },
  ) => Effect.Effect<ReadonlyArray<JobRunHistoryRecord>, Error>;
  listJobs: (options?: {
    runState?: Job["runState"];
    limit?: number;
    beforeUpdatedAt?: Date;
  }) => Effect.Effect<ReadonlyArray<JobListItem>, Error>;
  retryJob: (
    jobId: string,
    actor: ActorRef,
    at?: Date,
    fixSummary?: string,
  ) => ReturnType<typeof retryJobRun>;
  inspectWorkflowCheckpoint: (
    checkpointId: string,
  ) => Effect.Effect<Checkpoint, Error>;
  listActivityFeed: (
    options?: ListActivityFeedInput,
  ) => Effect.Effect<ReadonlyArray<ActivityFeedItem>, Error>;
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
  ) => Effect.Effect<T | undefined>;
  listEntities: <T>(entityType: string) => Effect.Effect<ReadonlyArray<T>>;
  listAuditTrail: (filter?: {
    entityType?: string;
    entityId?: string;
  }) => ReturnType<CoreRepository["listAuditTrail"]>;
  persistSnapshot: () => Effect.Effect<void, Error>;
  loadSnapshot: () => Effect.Effect<void, Error>;
  close?: () => Effect.Effect<void, Error>;
}

const toNativeError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isRepositoryEmpty = (
  repository: CoreRepository,
): Effect.Effect<boolean> =>
  Effect.gen(function* () {
    const auditTrail = yield* repository.listAuditTrail();
    if (auditTrail.length > 0) {
      return false;
    }

    for (const entityType of ENTITY_TYPES) {
      const entities = yield* repository.listEntities(entityType);
      if (entities.length > 0) {
        return false;
      }
    }

    return true;
  });

const importLegacySnapshotIntoEmptyRepository = (
  repository: CoreRepository,
  snapshotPath: string,
): Effect.Effect<void, Error> =>
  Effect.gen(function* () {
    const shouldImport = yield* isRepositoryEmpty(repository);
    if (!shouldImport) {
      return;
    }

    const snapshotRepository = yield* makeFileCoreRepository(snapshotPath).pipe(
      Effect.mapError((error) => new Error(error.message)),
    );

    if (snapshotRepository.loadSnapshot) {
      yield* snapshotRepository.loadSnapshot(snapshotPath);
    }

    for (const entityType of ENTITY_TYPES) {
      const entities = yield* snapshotRepository.listEntities(entityType);
      for (const entity of entities) {
        if (!isRecord(entity)) {
          continue;
        }

        const entityId = entity.id;
        if (typeof entityId !== "string" || entityId.trim().length === 0) {
          continue;
        }

        yield* repository.saveEntity(entityType, entityId, entity);
      }
    }

    const auditTrail = yield* snapshotRepository.listAuditTrail();
    for (const transition of auditTrail) {
      yield* repository.appendAuditTransition(transition);
    }
  });

export const buildCorePlatform = (
  options: BuildCorePlatformOptions = {},
): Effect.Effect<CorePlatform, Error> =>
  Effect.gen(function* () {
    const repository = yield* ((): Effect.Effect<CoreRepository, Error> => {
      if (options.repository) {
        return Effect.succeed(options.repository);
      }

      if (options.databasePath) {
        return makeSqliteCoreRepository({
          databasePath: options.databasePath,
          runMigrationsOnInit: options.runMigrationsOnInit,
        }).pipe(Effect.mapError((error) => new Error(error.message)));
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

    if (options.importSnapshotIntoDatabase && options.snapshotPath) {
      yield* importLegacySnapshotIntoEmptyRepository(
        repository,
        options.snapshotPath,
      );
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

    const withMutationBoundary = <A, E>(
      effect: Effect.Effect<A, E>,
    ): Effect.Effect<A, E> => repository.withTransaction(effect);

    return {
      captureEntry: (input) =>
        withMutationBoundary(captureEntry(repository, input)),
      acceptEntryAsTask: (input) =>
        withMutationBoundary(acceptEntryAsTask(repository, input)),
      suggestEntryAsTask: (input) =>
        withMutationBoundary(suggestEntryAsTask(repository, input)),
      editEntrySuggestion: (input) =>
        withMutationBoundary(editEntrySuggestion(repository, input)),
      rejectEntrySuggestion: (input) =>
        withMutationBoundary(rejectEntrySuggestion(repository, input)),
      completeTask: (taskId, actor, at) =>
        withMutationBoundary(completeTask(repository, taskId, actor, at)),
      deferTask: (taskId, until, actor, at) =>
        withMutationBoundary(deferTask(repository, taskId, until, actor, at)),
      rescheduleTask: (taskId, nextAt, actor, at) =>
        withMutationBoundary(
          rescheduleTask(repository, taskId, nextAt, actor, at),
        ),
      ingestSignal: (input) =>
        withMutationBoundary(ingestSignal(repository, input)),
      triageSignal: (signalId, decision, actor, at) =>
        withMutationBoundary(
          triageSignal(repository, signalId, decision, actor, at),
        ),
      convertSignal: (input) =>
        withMutationBoundary(convertSignal(repository, input)),
      requestEventSync: (eventId, actor, at) =>
        withMutationBoundary(requestEventSync(repository, eventId, actor, at)),
      requestOutboundDraftExecution: (draftId, actor, at) =>
        withMutationBoundary(
          requestOutboundDraftExecution(repository, draftId, actor, at),
        ),
      approveOutboundAction: (input) =>
        withMutationBoundary(
          approveOutboundAction(repository, outboundActionPort, input),
        ),
      createJob: (input) => withMutationBoundary(createJobInPlatform(input)),
      recordJobRun: (input) =>
        withMutationBoundary(recordJobRun(repository, input)),
      inspectJobRun: (jobId) =>
        inspectJobRun(repository, jobId).pipe(
          Effect.mapError((error) => new Error(error.message)),
        ),
      listJobRunHistory: (jobId, options) =>
        listJobRunHistory(repository, {
          jobId,
          limit: options?.limit,
          beforeAt: options?.beforeAt,
        }).pipe(Effect.mapError((error) => new Error(error.message))),
      listJobs: (options) =>
        listJobs(repository, options).pipe(
          Effect.mapError((error) => new Error(error.message)),
        ),
      retryJob: (jobId, actor, at, fixSummary) =>
        withMutationBoundary(
          retryJobRun(repository, jobId, actor, at, fixSummary),
        ),
      inspectWorkflowCheckpoint: (checkpointId) =>
        inspectWorkflowCheckpointInService(repository, checkpointId).pipe(
          Effect.mapError((error) => new Error(error.message)),
        ),
      listActivityFeed: (options) =>
        listActivityFeed(repository, options).pipe(
          Effect.mapError((error) => new Error(error.message)),
        ),
      createWorkflowCheckpoint: (input) =>
        withMutationBoundary(createWorkflowCheckpoint(repository, input)),
      keepCheckpoint: (checkpointId, actor, at) =>
        withMutationBoundary(
          keepCheckpoint(repository, checkpointId, actor, at),
        ),
      recoverCheckpoint: (checkpointId, actor, at) =>
        withMutationBoundary(
          recoverCheckpoint(repository, checkpointId, actor, at),
        ),
      saveView: (input) => withMutationBoundary(saveView(repository, input)),
      upsertMemory: (input) =>
        withMutationBoundary(upsertMemory(repository, input)),
      getEntity: <T>(entityType: string, entityId: string) =>
        repository.getEntity<T>(entityType, entityId),
      listEntities: <T>(entityType: string) =>
        repository.listEntities<T>(entityType),
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
      close: repository.close
        ? () => repository.close!().pipe(Effect.mapError(toNativeError))
        : undefined,
    };
  });
