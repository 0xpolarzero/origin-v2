import { Effect } from "effect";

import { createAuditTransition } from "../domain/audit-transition";
import { Checkpoint } from "../domain/checkpoint";
import { ActorRef, ENTITY_TYPES } from "../domain/common";
import { createJob, CreateJobInput, Job } from "../domain/job";
import { View } from "../domain/view";
import { CoreRepository } from "../repositories/core-repository";
import { makeInMemoryCoreRepository } from "../repositories/in-memory-core-repository";
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
import {
  createEventInService,
  CreateEventInServiceInput,
  listEventConflicts,
  listEvents,
  requestEventSync,
  UpdateEventInServiceInput,
  updateEventInService,
} from "../services/event-service";
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
import {
  getActivityView as getActivityViewInService,
  getJobsView as getJobsViewInService,
  saveActivityView as saveActivityViewInService,
  saveJobsView as saveJobsViewInService,
  saveView,
  SaveScopedViewInput,
  SaveViewInput,
} from "../services/view-service";
import { upsertMemory, UpsertMemoryInput } from "../services/memory-service";
import {
  acknowledgeNotification,
  dismissNotification,
  ListNotificationsInput,
  listNotifications,
} from "../services/notification-service";
import {
  createNoteInService,
  CreateNoteInServiceInput,
  linkNoteEntity,
  ListNotesInput,
  listNotes,
  unlinkNoteEntity,
  updateNoteBody,
} from "../services/note-service";
import { requestOutboundDraftExecution } from "../services/outbound-draft-service";
import {
  createProjectInService,
  CreateProjectInServiceInput,
  ListProjectsInput,
  listProjects,
  setProjectLifecycle,
  UpdateProjectInServiceInput,
  updateProjectInService,
} from "../services/project-service";
import {
  searchEntities,
  SearchEntitiesInput,
} from "../services/search-service";
import {
  convertSignal,
  ConvertSignalInput,
  ingestSignal,
  IngestSignalInput,
  triageSignal,
} from "../services/signal-service";
import {
  createTaskFromInput,
  CreateTaskFromInput,
  completeTask,
  deferTask,
  ListTasksInput,
  listTasks,
  rescheduleTask,
  updateTaskDetails,
  UpdateTaskDetailsInput,
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
  createTask: (input: CreateTaskFromInput) => ReturnType<typeof createTaskFromInput>;
  updateTask: (
    input: UpdateTaskDetailsInput,
  ) => ReturnType<typeof updateTaskDetails>;
  listTasks: (input?: ListTasksInput) => ReturnType<typeof listTasks>;
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
  createEvent: (
    input: CreateEventInServiceInput,
  ) => ReturnType<typeof createEventInService>;
  updateEvent: (
    input: UpdateEventInServiceInput,
  ) => ReturnType<typeof updateEventInService>;
  listEvents: (input?: Parameters<typeof listEvents>[1]) => ReturnType<typeof listEvents>;
  listEventConflicts: (
    eventId?: string,
  ) => ReturnType<typeof listEventConflicts>;
  createProject: (
    input: CreateProjectInServiceInput,
  ) => ReturnType<typeof createProjectInService>;
  updateProject: (
    input: UpdateProjectInServiceInput,
  ) => ReturnType<typeof updateProjectInService>;
  setProjectLifecycle: (
    projectId: string,
    lifecycle: Parameters<typeof setProjectLifecycle>[2],
    actor: ActorRef,
    at?: Date,
  ) => ReturnType<typeof setProjectLifecycle>;
  listProjects: (input?: ListProjectsInput) => ReturnType<typeof listProjects>;
  createNote: (
    input: CreateNoteInServiceInput,
  ) => ReturnType<typeof createNoteInService>;
  updateNoteBody: (
    noteId: string,
    body: string,
    actor: ActorRef,
    at?: Date,
  ) => ReturnType<typeof updateNoteBody>;
  linkNoteEntity: (
    noteId: string,
    entityRef: string,
    actor: ActorRef,
    at?: Date,
  ) => ReturnType<typeof linkNoteEntity>;
  unlinkNoteEntity: (
    noteId: string,
    entityRef: string,
    actor: ActorRef,
    at?: Date,
  ) => ReturnType<typeof unlinkNoteEntity>;
  listNotes: (input?: ListNotesInput) => ReturnType<typeof listNotes>;
  listNotifications: (
    input?: ListNotificationsInput,
  ) => ReturnType<typeof listNotifications>;
  acknowledgeNotification: (
    notificationId: string,
    actor: ActorRef,
    at?: Date,
  ) => ReturnType<typeof acknowledgeNotification>;
  dismissNotification: (
    notificationId: string,
    actor: ActorRef,
    at?: Date,
  ) => ReturnType<typeof dismissNotification>;
  searchEntities: (
    input: SearchEntitiesInput,
  ) => ReturnType<typeof searchEntities>;
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
  saveJobsView: (
    input: SaveScopedViewInput,
  ) => ReturnType<typeof saveJobsViewInService>;
  getJobsView: () => Effect.Effect<View | undefined>;
  saveActivityView: (
    input: SaveScopedViewInput,
  ) => ReturnType<typeof saveActivityViewInService>;
  getActivityView: () => Effect.Effect<View | undefined>;
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

const FILE_REPOSITORY_MODULE_PATH = "../repositories/file-core-repository";
const SQLITE_REPOSITORY_MODULE_PATH =
  "../repositories/sqlite/sqlite-core-repository";
type FileRepositoryModule = typeof import("../repositories/file-core-repository");
type SqliteRepositoryModule = typeof import("../repositories/sqlite/sqlite-core-repository");

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
    const snapshotRepositoryFactory = yield* Effect.tryPromise({
      try: () =>
        import(
          /* @vite-ignore */
          FILE_REPOSITORY_MODULE_PATH
        ) as Promise<FileRepositoryModule>,
      catch: toNativeError,
    });
    const snapshotRepository = yield* snapshotRepositoryFactory
      .makeFileCoreRepository(snapshotPath)
      .pipe(Effect.mapError((error) => new Error(toNativeError(error).message)));

    if (snapshotRepository.loadSnapshot) {
      yield* snapshotRepository.loadSnapshot(snapshotPath);
    }

    const entitiesByType = new Map<string, ReadonlyArray<unknown>>();
    for (const entityType of ENTITY_TYPES) {
      const entities = yield* snapshotRepository.listEntities(entityType);
      entitiesByType.set(entityType, entities);
    }

    const auditTrail = yield* snapshotRepository.listAuditTrail();

    yield* repository.withTransaction(
      Effect.gen(function* () {
        const shouldImport = yield* isRepositoryEmpty(repository);
        if (!shouldImport) {
          return;
        }

        for (const entityType of ENTITY_TYPES) {
          const entities = entitiesByType.get(entityType) ?? [];
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

        for (const transition of auditTrail) {
          yield* repository.appendAuditTransition(transition);
        }
      }),
    );
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
        const databasePath = options.databasePath;
        return Effect.tryPromise({
          try: () =>
            import(
              /* @vite-ignore */
              SQLITE_REPOSITORY_MODULE_PATH
            ) as Promise<SqliteRepositoryModule>,
          catch: toNativeError,
        }).pipe(
          Effect.flatMap((sqliteRepositoryFactory) =>
            sqliteRepositoryFactory.makeSqliteCoreRepository({
              databasePath,
              runMigrationsOnInit: options.runMigrationsOnInit,
            }),
          ),
          Effect.mapError((error) => new Error(toNativeError(error).message)),
        );
      }

      if (options.snapshotPath) {
        const snapshotPath = options.snapshotPath;
        return Effect.tryPromise({
          try: () =>
            import(
              /* @vite-ignore */
              FILE_REPOSITORY_MODULE_PATH
            ) as Promise<FileRepositoryModule>,
          catch: toNativeError,
        }).pipe(
          Effect.flatMap((fileRepositoryFactory) =>
            fileRepositoryFactory.makeFileCoreRepository(snapshotPath),
          ),
          Effect.mapError((error) => new Error(toNativeError(error).message)),
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
      createTask: (input) =>
        withMutationBoundary(createTaskFromInput(repository, input)),
      updateTask: (input) =>
        withMutationBoundary(updateTaskDetails(repository, input)),
      listTasks: (input) => listTasks(repository, input),
      completeTask: (taskId, actor, at) =>
        withMutationBoundary(completeTask(repository, taskId, actor, at)),
      deferTask: (taskId, until, actor, at) =>
        withMutationBoundary(deferTask(repository, taskId, until, actor, at)),
      rescheduleTask: (taskId, nextAt, actor, at) =>
        withMutationBoundary(
          rescheduleTask(repository, taskId, nextAt, actor, at),
        ),
      createEvent: (input) =>
        withMutationBoundary(createEventInService(repository, input)),
      updateEvent: (input) =>
        withMutationBoundary(updateEventInService(repository, input)),
      listEvents: (input) => listEvents(repository, input),
      listEventConflicts: (eventId) => listEventConflicts(repository, eventId),
      ingestSignal: (input) =>
        withMutationBoundary(ingestSignal(repository, input)),
      triageSignal: (signalId, decision, actor, at) =>
        withMutationBoundary(
          triageSignal(repository, signalId, decision, actor, at),
        ),
      convertSignal: (input) =>
        withMutationBoundary(convertSignal(repository, input)),
      createProject: (input) =>
        withMutationBoundary(createProjectInService(repository, input)),
      updateProject: (input) =>
        withMutationBoundary(updateProjectInService(repository, input)),
      setProjectLifecycle: (projectId, lifecycle, actor, at) =>
        withMutationBoundary(
          setProjectLifecycle(repository, projectId, lifecycle, actor, at),
        ),
      listProjects: (input) => listProjects(repository, input),
      createNote: (input) =>
        withMutationBoundary(createNoteInService(repository, input)),
      updateNoteBody: (noteId, body, actor, at) =>
        withMutationBoundary(updateNoteBody(repository, noteId, body, actor, at)),
      linkNoteEntity: (noteId, entityRef, actor, at) =>
        withMutationBoundary(
          linkNoteEntity(repository, noteId, entityRef, actor, at),
        ),
      unlinkNoteEntity: (noteId, entityRef, actor, at) =>
        withMutationBoundary(
          unlinkNoteEntity(repository, noteId, entityRef, actor, at),
        ),
      listNotes: (input) => listNotes(repository, input),
      listNotifications: (input) => listNotifications(repository, input),
      acknowledgeNotification: (notificationId, actor, at) =>
        withMutationBoundary(
          acknowledgeNotification(repository, notificationId, actor, at),
        ),
      dismissNotification: (notificationId, actor, at) =>
        withMutationBoundary(
          dismissNotification(repository, notificationId, actor, at),
        ),
      searchEntities: (input) => searchEntities(repository, input),
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
      inspectJobRun: (jobId) => inspectJobRun(repository, jobId),
      listJobRunHistory: (jobId, options) =>
        listJobRunHistory(repository, {
          jobId,
          limit: options?.limit,
          beforeAt: options?.beforeAt,
        }),
      listJobs: (options) =>
        listJobs(repository, options).pipe(
          Effect.mapError((error) => new Error(error.message)),
        ),
      retryJob: (jobId, actor, at, fixSummary) =>
        withMutationBoundary(
          retryJobRun(repository, jobId, actor, at, fixSummary),
        ),
      inspectWorkflowCheckpoint: (checkpointId) =>
        inspectWorkflowCheckpointInService(repository, checkpointId),
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
      saveJobsView: (input) =>
        withMutationBoundary(saveJobsViewInService(repository, input)),
      getJobsView: () => getJobsViewInService(repository),
      saveActivityView: (input) =>
        withMutationBoundary(saveActivityViewInService(repository, input)),
      getActivityView: () => getActivityViewInService(repository),
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
