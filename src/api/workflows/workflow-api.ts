import { Effect } from "effect";

import { CorePlatform } from "../../core/app/core-platform";
import {
  AcknowledgeNotificationRequest,
  ListActivityRequest,
  ListJobsRequest,
  ListNotificationsRequest,
  ListNotesRequest,
  ListProjectsRequest,
  ListTasksRequest,
  SearchQueryRequest,
  CompleteTaskRequest,
  CreateEventRequest,
  CreateNoteRequest,
  CreateProjectRequest,
  CreateTaskRequest,
  DeferTaskRequest,
  DismissNotificationRequest,
  InspectWorkflowCheckpointRequest,
  InspectJobRunRequest,
  LinkNoteEntityRequest,
  ListEventConflictsRequest,
  ListEventsRequest,
  ListJobRunHistoryRequest,
  KeepCheckpointRequest,
  RecoverCheckpointRequest,
  RequestEventSyncRequest,
  RequestOutboundDraftExecutionRequest,
  RescheduleTaskRequest,
  RetryJobRequest,
  SetProjectLifecycleRequest,
  TriageSignalRequest,
  UnlinkNoteEntityRequest,
  UpdateEventRequest,
  UpdateNoteRequest,
  UpdateProjectRequest,
  UpdateTaskRequest,
  WorkflowApi,
  WorkflowRouteKey,
} from "./contracts";
import { toWorkflowApiError, WorkflowApiError } from "./errors";

export interface MakeWorkflowApiOptions {
  platform: CorePlatform;
}

export const wrapHandler =
  <Input, Output>(
    route: WorkflowRouteKey,
    handler: (input: Input) => Effect.Effect<Output, unknown>,
  ): ((input: Input) => Effect.Effect<Output, WorkflowApiError>) =>
  (input) =>
    Effect.try({
      try: () => handler(input),
      catch: (error) => toWorkflowApiError(route, error),
    }).pipe(
      Effect.flatMap((effect) => effect),
      Effect.mapError((error) => toWorkflowApiError(route, error)),
      Effect.catchAllDefect((defect) =>
        Effect.fail(toWorkflowApiError(route, defect)),
      ),
    );

export const makeWorkflowApi = (
  options: MakeWorkflowApiOptions,
): WorkflowApi => {
  const { platform } = options;

  return {
    captureEntry: wrapHandler("capture.entry", (input) =>
      platform.captureEntry(input),
    ),
    suggestEntryAsTask: wrapHandler("capture.suggest", (input) =>
      platform.suggestEntryAsTask(input),
    ),
    editEntrySuggestion: wrapHandler("capture.editSuggestion", (input) =>
      platform.editEntrySuggestion(input),
    ),
    rejectEntrySuggestion: wrapHandler("capture.rejectSuggestion", (input) =>
      platform.rejectEntrySuggestion(input),
    ),
    acceptEntryAsTask: wrapHandler("capture.acceptAsTask", (input) =>
      platform.acceptEntryAsTask(input),
    ),
    ingestSignal: wrapHandler("signal.ingest", (input) =>
      platform.ingestSignal(input),
    ),
    triageSignal: wrapHandler("signal.triage", (input: TriageSignalRequest) =>
      platform.triageSignal(
        input.signalId,
        input.decision,
        input.actor,
        input.at,
      ),
    ),
    convertSignal: wrapHandler("signal.convert", (input) =>
      platform.convertSignal(input),
    ),
    completeTask: wrapHandler(
      "planning.completeTask",
      (input: CompleteTaskRequest) =>
        platform.completeTask(input.taskId, input.actor, input.at),
    ),
    deferTask: wrapHandler("planning.deferTask", (input: DeferTaskRequest) =>
      platform.deferTask(input.taskId, input.until, input.actor, input.at),
    ),
    rescheduleTask: wrapHandler(
      "planning.rescheduleTask",
      (input: RescheduleTaskRequest) =>
        platform.rescheduleTask(
          input.taskId,
          input.nextAt,
          input.actor,
          input.at,
        ),
    ),
    createTask: wrapHandler("task.create", (input: CreateTaskRequest) =>
      platform.createTask(input),
    ),
    updateTask: wrapHandler("task.update", (input: UpdateTaskRequest) =>
      platform.updateTask(input),
    ),
    listTasks: wrapHandler("task.list", (input: ListTasksRequest) =>
      platform.listTasks({
        status: input.status,
        projectId: input.projectId,
        scheduledFrom: input.scheduledFrom,
        scheduledTo: input.scheduledTo,
      }),
    ),
    createEvent: wrapHandler("event.create", (input: CreateEventRequest) =>
      platform.createEvent(input),
    ),
    updateEvent: wrapHandler("event.update", (input: UpdateEventRequest) =>
      platform.updateEvent(input),
    ),
    listEvents: wrapHandler("event.list", (input: ListEventsRequest) =>
      platform.listEvents({
        from: input.from,
        to: input.to,
        syncState: input.syncState,
        sort: input.sort,
        limit: input.limit,
      }),
    ),
    listEventConflicts: wrapHandler(
      "event.listConflicts",
      (input: ListEventConflictsRequest) =>
        platform.listEventConflicts(input.eventId),
    ),
    createProject: wrapHandler(
      "project.create",
      (input: CreateProjectRequest) => platform.createProject(input),
    ),
    updateProject: wrapHandler(
      "project.update",
      (input: UpdateProjectRequest) => platform.updateProject(input),
    ),
    setProjectLifecycle: wrapHandler(
      "project.setLifecycle",
      (input: SetProjectLifecycleRequest) =>
        platform.setProjectLifecycle(
          input.projectId,
          input.lifecycle,
          input.actor,
          input.at,
        ),
    ),
    listProjects: wrapHandler("project.list", (input: ListProjectsRequest) =>
      platform.listProjects({
        lifecycle: input.lifecycle,
      }),
    ),
    createNote: wrapHandler("note.create", (input: CreateNoteRequest) =>
      platform.createNote(input),
    ),
    updateNote: wrapHandler("note.update", (input: UpdateNoteRequest) =>
      platform.updateNoteBody(input.noteId, input.body, input.actor, input.at),
    ),
    linkNoteEntity: wrapHandler(
      "note.linkEntity",
      (input: LinkNoteEntityRequest) =>
        platform.linkNoteEntity(
          input.noteId,
          input.entityRef,
          input.actor,
          input.at,
        ),
    ),
    unlinkNoteEntity: wrapHandler(
      "note.unlinkEntity",
      (input: UnlinkNoteEntityRequest) =>
        platform.unlinkNoteEntity(
          input.noteId,
          input.entityRef,
          input.actor,
          input.at,
        ),
    ),
    listNotes: wrapHandler("note.list", (input: ListNotesRequest) =>
      platform.listNotes({
        entityRef: input.entityRef,
      }),
    ),
    listNotifications: wrapHandler(
      "notification.list",
      (input: ListNotificationsRequest) =>
        platform.listNotifications({
          status: input.status,
          type: input.type,
          relatedEntity: input.relatedEntity,
          limit: input.limit,
        }),
    ),
    acknowledgeNotification: wrapHandler(
      "notification.acknowledge",
      (input: AcknowledgeNotificationRequest) =>
        platform.acknowledgeNotification(
          input.notificationId,
          input.actor,
          input.at,
        ),
    ),
    dismissNotification: wrapHandler(
      "notification.dismiss",
      (input: DismissNotificationRequest) =>
        platform.dismissNotification(input.notificationId, input.actor, input.at),
    ),
    searchQuery: wrapHandler("search.query", (input: SearchQueryRequest) =>
      platform.searchEntities({
        query: input.query,
        entityTypes: input.entityTypes,
        limit: input.limit,
      }),
    ),
    requestEventSync: wrapHandler(
      "approval.requestEventSync",
      (input: RequestEventSyncRequest) =>
        platform.requestEventSync(input.eventId, input.actor, input.at),
    ),
    requestOutboundDraftExecution: wrapHandler(
      "approval.requestOutboundDraftExecution",
      (input: RequestOutboundDraftExecutionRequest) =>
        platform.requestOutboundDraftExecution(
          input.draftId,
          input.actor,
          input.at,
        ),
    ),
    approveOutboundAction: wrapHandler(
      "approval.approveOutboundAction",
      (input) => platform.approveOutboundAction(input),
    ),
    createJob: wrapHandler("job.create", (input) => platform.createJob(input)),
    recordJobRun: wrapHandler("job.recordRun", (input) =>
      platform.recordJobRun(input),
    ),
    inspectJobRun: wrapHandler(
      "job.inspectRun",
      (input: InspectJobRunRequest) => platform.inspectJobRun(input.jobId),
    ),
    listJobs: wrapHandler("job.list", (input: ListJobsRequest) =>
      platform.listJobs({
        runState: input.runState,
        limit: input.limit,
        beforeUpdatedAt: input.beforeUpdatedAt,
      }),
    ),
    listJobRunHistory: wrapHandler(
      "job.listHistory",
      (input: ListJobRunHistoryRequest) =>
        platform.listJobRunHistory(input.jobId, {
          limit: input.limit,
          beforeAt: input.beforeAt,
        }),
    ),
    retryJob: wrapHandler("job.retry", (input: RetryJobRequest) =>
      platform.retryJob(input.jobId, input.actor, input.at, input.fixSummary),
    ),
    createWorkflowCheckpoint: wrapHandler("checkpoint.create", (input) =>
      platform.createWorkflowCheckpoint(input),
    ),
    inspectWorkflowCheckpoint: wrapHandler(
      "checkpoint.inspect",
      (input: InspectWorkflowCheckpointRequest) =>
        platform.inspectWorkflowCheckpoint(input.checkpointId),
    ),
    keepCheckpoint: wrapHandler(
      "checkpoint.keep",
      (input: KeepCheckpointRequest) =>
        platform.keepCheckpoint(input.checkpointId, input.actor, input.at),
    ),
    recoverCheckpoint: wrapHandler(
      "checkpoint.recover",
      (input: RecoverCheckpointRequest) =>
        platform.recoverCheckpoint(input.checkpointId, input.actor, input.at),
    ),
    listActivity: wrapHandler("activity.list", (input: ListActivityRequest) =>
      platform.listActivityFeed({
        entityType: input.entityType,
        entityId: input.entityId,
        actorKind: input.actorKind,
        aiOnly: input.aiOnly,
        limit: input.limit,
        beforeAt: input.beforeAt,
      }),
    ),
  };
};
