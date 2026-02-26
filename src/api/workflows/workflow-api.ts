import { Effect } from "effect";

import { CorePlatform } from "../../core/app/core-platform";
import {
  ListActivityRequest,
  ListJobsRequest,
  CompleteTaskRequest,
  DeferTaskRequest,
  InspectWorkflowCheckpointRequest,
  InspectJobRunRequest,
  ListJobRunHistoryRequest,
  KeepCheckpointRequest,
  RecoverCheckpointRequest,
  RequestEventSyncRequest,
  RequestOutboundDraftExecutionRequest,
  RescheduleTaskRequest,
  RetryJobRequest,
  TriageSignalRequest,
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
