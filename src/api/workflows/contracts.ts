import { Effect } from "effect";

import { CorePlatform } from "../../core/app/core-platform";
import { ActorRef } from "../../core/domain/common";
import { ApproveOutboundActionInput } from "../../core/services/approval-service";
import { CreateWorkflowCheckpointInput } from "../../core/services/checkpoint-service";
import {
  AcceptEntryAsTaskInput,
  CaptureEntryInput,
  EditEntrySuggestionInput,
  RejectEntrySuggestionInput,
  SuggestEntryAsTaskInput,
} from "../../core/services/entry-service";
import { RecordJobRunInput } from "../../core/services/job-service";
import {
  ConvertSignalInput,
  IngestSignalInput,
} from "../../core/services/signal-service";
import { WorkflowApiError } from "./errors";

export type WorkflowRouteKey =
  | "capture.entry"
  | "capture.suggest"
  | "capture.editSuggestion"
  | "capture.rejectSuggestion"
  | "capture.acceptAsTask"
  | "signal.ingest"
  | "signal.triage"
  | "signal.convert"
  | "planning.completeTask"
  | "planning.deferTask"
  | "planning.rescheduleTask"
  | "approval.requestEventSync"
  | "approval.requestOutboundDraftExecution"
  | "approval.approveOutboundAction"
  | "job.create"
  | "job.recordRun"
  | "job.inspectRun"
  | "job.retry"
  | "checkpoint.create"
  | "checkpoint.keep"
  | "checkpoint.recover";

export interface TriageSignalRequest {
  signalId: string;
  decision: string;
  actor: ActorRef;
  at?: Date;
}

export interface CompleteTaskRequest {
  taskId: string;
  actor: ActorRef;
  at?: Date;
}

export interface DeferTaskRequest {
  taskId: string;
  until: Date;
  actor: ActorRef;
  at?: Date;
}

export interface RescheduleTaskRequest {
  taskId: string;
  nextAt: Date;
  actor: ActorRef;
  at?: Date;
}

export interface RequestEventSyncRequest {
  eventId: string;
  actor: ActorRef;
  at?: Date;
}

export interface RequestOutboundDraftExecutionRequest {
  draftId: string;
  actor: ActorRef;
  at?: Date;
}

export interface InspectJobRunRequest {
  jobId: string;
}

export interface RetryJobRequest {
  jobId: string;
  actor: ActorRef;
  at?: Date;
}

export interface KeepCheckpointRequest {
  checkpointId: string;
  actor: ActorRef;
  at?: Date;
}

export interface RecoverCheckpointRequest {
  checkpointId: string;
  actor: ActorRef;
  at?: Date;
}

type ApiOutput<T extends (...args: any[]) => unknown> =
  ReturnType<T> extends Effect.Effect<infer Success, any, any>
    ? Effect.Effect<Success, WorkflowApiError>
    : never;

export interface WorkflowApi {
  captureEntry: (
    input: CaptureEntryInput,
  ) => ApiOutput<CorePlatform["captureEntry"]>;
  suggestEntryAsTask: (
    input: SuggestEntryAsTaskInput,
  ) => ApiOutput<CorePlatform["suggestEntryAsTask"]>;
  editEntrySuggestion: (
    input: EditEntrySuggestionInput,
  ) => ApiOutput<CorePlatform["editEntrySuggestion"]>;
  rejectEntrySuggestion: (
    input: RejectEntrySuggestionInput,
  ) => ApiOutput<CorePlatform["rejectEntrySuggestion"]>;
  acceptEntryAsTask: (
    input: AcceptEntryAsTaskInput,
  ) => ApiOutput<CorePlatform["acceptEntryAsTask"]>;
  ingestSignal: (
    input: IngestSignalInput,
  ) => ApiOutput<CorePlatform["ingestSignal"]>;
  triageSignal: (
    input: TriageSignalRequest,
  ) => ApiOutput<CorePlatform["triageSignal"]>;
  convertSignal: (
    input: ConvertSignalInput,
  ) => ApiOutput<CorePlatform["convertSignal"]>;
  completeTask: (
    input: CompleteTaskRequest,
  ) => ApiOutput<CorePlatform["completeTask"]>;
  deferTask: (input: DeferTaskRequest) => ApiOutput<CorePlatform["deferTask"]>;
  rescheduleTask: (
    input: RescheduleTaskRequest,
  ) => ApiOutput<CorePlatform["rescheduleTask"]>;
  requestEventSync: (
    input: RequestEventSyncRequest,
  ) => ApiOutput<CorePlatform["requestEventSync"]>;
  requestOutboundDraftExecution: (
    input: RequestOutboundDraftExecutionRequest,
  ) => ApiOutput<CorePlatform["requestOutboundDraftExecution"]>;
  approveOutboundAction: (
    input: ApproveOutboundActionInput,
  ) => ApiOutput<CorePlatform["approveOutboundAction"]>;
  createJob: (
    input: Parameters<CorePlatform["createJob"]>[0],
  ) => ApiOutput<CorePlatform["createJob"]>;
  recordJobRun: (
    input: RecordJobRunInput,
  ) => ApiOutput<CorePlatform["recordJobRun"]>;
  inspectJobRun: (
    input: InspectJobRunRequest,
  ) => ApiOutput<CorePlatform["inspectJobRun"]>;
  retryJob: (input: RetryJobRequest) => ApiOutput<CorePlatform["retryJob"]>;
  createWorkflowCheckpoint: (
    input: CreateWorkflowCheckpointInput,
  ) => ApiOutput<CorePlatform["createWorkflowCheckpoint"]>;
  keepCheckpoint: (
    input: KeepCheckpointRequest,
  ) => ApiOutput<CorePlatform["keepCheckpoint"]>;
  recoverCheckpoint: (
    input: RecoverCheckpointRequest,
  ) => ApiOutput<CorePlatform["recoverCheckpoint"]>;
}

export interface WorkflowRouteDefinition {
  key: WorkflowRouteKey;
  method: "POST";
  path: string;
  handle: (input: unknown) => Effect.Effect<unknown, WorkflowApiError>;
}
