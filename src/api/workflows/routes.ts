import { Effect } from "effect";

import {
  CompleteTaskRequest,
  DeferTaskRequest,
  InspectJobRunRequest,
  KeepCheckpointRequest,
  RecoverCheckpointRequest,
  RequestEventSyncRequest,
  RequestOutboundDraftExecutionRequest,
  RescheduleTaskRequest,
  RetryJobRequest,
  TriageSignalRequest,
  WorkflowApi,
  WorkflowRouteDefinition,
  WorkflowRouteKey,
} from "./contracts";
import { WorkflowApiError } from "./errors";

export const WORKFLOW_ROUTE_PATHS: Record<WorkflowRouteKey, string> = {
  "capture.entry": "/api/workflows/capture/entry",
  "capture.suggest": "/api/workflows/capture/suggest",
  "capture.editSuggestion": "/api/workflows/capture/edit-suggestion",
  "capture.rejectSuggestion": "/api/workflows/capture/reject-suggestion",
  "capture.acceptAsTask": "/api/workflows/capture/accept-as-task",
  "signal.ingest": "/api/workflows/signal/ingest",
  "signal.triage": "/api/workflows/signal/triage",
  "signal.convert": "/api/workflows/signal/convert",
  "planning.completeTask": "/api/workflows/planning/complete-task",
  "planning.deferTask": "/api/workflows/planning/defer-task",
  "planning.rescheduleTask": "/api/workflows/planning/reschedule-task",
  "approval.requestEventSync": "/api/workflows/approval/request-event-sync",
  "approval.requestOutboundDraftExecution":
    "/api/workflows/approval/request-outbound-draft-execution",
  "approval.approveOutboundAction":
    "/api/workflows/approval/approve-outbound-action",
  "job.create": "/api/workflows/job/create",
  "job.recordRun": "/api/workflows/job/record-run",
  "job.inspectRun": "/api/workflows/job/inspect-run",
  "job.retry": "/api/workflows/job/retry",
  "checkpoint.create": "/api/workflows/checkpoint/create",
  "checkpoint.keep": "/api/workflows/checkpoint/keep",
  "checkpoint.recover": "/api/workflows/checkpoint/recover",
};

const toRouteHandler =
  <Input, Output>(
    handler: (input: Input) => Effect.Effect<Output, WorkflowApiError>,
  ): ((input: unknown) => Effect.Effect<unknown, WorkflowApiError>) =>
  (input) =>
    handler(input as Input);

export const makeWorkflowRoutes = (
  api: WorkflowApi,
): ReadonlyArray<WorkflowRouteDefinition> => [
  {
    key: "capture.entry",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["capture.entry"],
    handle: toRouteHandler(api.captureEntry),
  },
  {
    key: "capture.suggest",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["capture.suggest"],
    handle: toRouteHandler(api.suggestEntryAsTask),
  },
  {
    key: "capture.editSuggestion",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["capture.editSuggestion"],
    handle: toRouteHandler(api.editEntrySuggestion),
  },
  {
    key: "capture.rejectSuggestion",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["capture.rejectSuggestion"],
    handle: toRouteHandler(api.rejectEntrySuggestion),
  },
  {
    key: "capture.acceptAsTask",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["capture.acceptAsTask"],
    handle: toRouteHandler(api.acceptEntryAsTask),
  },
  {
    key: "signal.ingest",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["signal.ingest"],
    handle: toRouteHandler(api.ingestSignal),
  },
  {
    key: "signal.triage",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["signal.triage"],
    handle: toRouteHandler<TriageSignalRequest, unknown>(api.triageSignal),
  },
  {
    key: "signal.convert",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["signal.convert"],
    handle: toRouteHandler(api.convertSignal),
  },
  {
    key: "planning.completeTask",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["planning.completeTask"],
    handle: toRouteHandler<CompleteTaskRequest, unknown>(api.completeTask),
  },
  {
    key: "planning.deferTask",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["planning.deferTask"],
    handle: toRouteHandler<DeferTaskRequest, unknown>(api.deferTask),
  },
  {
    key: "planning.rescheduleTask",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["planning.rescheduleTask"],
    handle: toRouteHandler<RescheduleTaskRequest, unknown>(api.rescheduleTask),
  },
  {
    key: "approval.requestEventSync",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["approval.requestEventSync"],
    handle: toRouteHandler<RequestEventSyncRequest, unknown>(
      api.requestEventSync,
    ),
  },
  {
    key: "approval.requestOutboundDraftExecution",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["approval.requestOutboundDraftExecution"],
    handle: toRouteHandler<RequestOutboundDraftExecutionRequest, unknown>(
      api.requestOutboundDraftExecution,
    ),
  },
  {
    key: "approval.approveOutboundAction",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["approval.approveOutboundAction"],
    handle: toRouteHandler(api.approveOutboundAction),
  },
  {
    key: "job.create",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["job.create"],
    handle: toRouteHandler(api.createJob),
  },
  {
    key: "job.recordRun",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["job.recordRun"],
    handle: toRouteHandler(api.recordJobRun),
  },
  {
    key: "job.inspectRun",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["job.inspectRun"],
    handle: toRouteHandler<InspectJobRunRequest, unknown>(api.inspectJobRun),
  },
  {
    key: "job.retry",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["job.retry"],
    handle: toRouteHandler<RetryJobRequest, unknown>(api.retryJob),
  },
  {
    key: "checkpoint.create",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["checkpoint.create"],
    handle: toRouteHandler(api.createWorkflowCheckpoint),
  },
  {
    key: "checkpoint.keep",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["checkpoint.keep"],
    handle: toRouteHandler<KeepCheckpointRequest, unknown>(api.keepCheckpoint),
  },
  {
    key: "checkpoint.recover",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["checkpoint.recover"],
    handle: toRouteHandler<RecoverCheckpointRequest, unknown>(
      api.recoverCheckpoint,
    ),
  },
];
