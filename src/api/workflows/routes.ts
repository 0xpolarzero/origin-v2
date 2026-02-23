import { Effect } from "effect";

import { ENTITY_TYPES, EntityType } from "../../core/domain/common";
import {
  CompleteTaskRequest,
  DeferTaskRequest,
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
  "job.listHistory": "/api/workflows/job/list-history",
  "job.retry": "/api/workflows/job/retry",
  "checkpoint.create": "/api/workflows/checkpoint/create",
  "checkpoint.keep": "/api/workflows/checkpoint/keep",
  "checkpoint.recover": "/api/workflows/checkpoint/recover",
};

type ActorKind = "user" | "system" | "ai";

interface ActorRefPayload {
  id: string;
  kind: ActorKind;
}

type CaptureEntryRequest = Parameters<WorkflowApi["captureEntry"]>[0];
type SuggestEntryAsTaskRequest = Parameters<
  WorkflowApi["suggestEntryAsTask"]
>[0];
type EditEntrySuggestionRequest = Parameters<
  WorkflowApi["editEntrySuggestion"]
>[0];
type RejectEntrySuggestionRequest = Parameters<
  WorkflowApi["rejectEntrySuggestion"]
>[0];
type AcceptEntryAsTaskRequest = Parameters<WorkflowApi["acceptEntryAsTask"]>[0];
type IngestSignalRequest = Parameters<WorkflowApi["ingestSignal"]>[0];
type ConvertSignalRequest = Parameters<WorkflowApi["convertSignal"]>[0];
type ApproveOutboundActionRequest = Parameters<
  WorkflowApi["approveOutboundAction"]
>[0];
type CreateJobRequest = Parameters<WorkflowApi["createJob"]>[0];
type RecordJobRunRequest = Parameters<WorkflowApi["recordJobRun"]>[0];
type CreateWorkflowCheckpointRequest = Parameters<
  WorkflowApi["createWorkflowCheckpoint"]
>[0];

type RouteValidation<Input> =
  | { ok: true; value: Input }
  | { ok: false; message: string };

type RouteValidator<Input> = (input: unknown) => RouteValidation<Input>;

const ACTOR_KINDS: ReadonlyArray<ActorKind> = ["user", "system", "ai"];
const SIGNAL_CONVERSION_TARGETS = [
  "task",
  "event",
  "note",
  "project",
  "outbound_draft",
] as const;
const OUTBOUND_ACTION_TYPES = ["event_sync", "outbound_draft"] as const;
const JOB_RUN_OUTCOMES = ["succeeded", "failed"] as const;
const ISO_8601_UTC_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

const valid = <Input>(value: Input): RouteValidation<Input> => ({
  ok: true,
  value,
});

const invalid = <Input>(
  route: WorkflowRouteKey,
  reason: string,
): RouteValidation<Input> => ({
  ok: false,
  message: `invalid request payload for ${route}: ${reason}`,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isDate = (value: unknown): value is Date =>
  value instanceof Date && !Number.isNaN(value.getTime());

const parseDateLike = (value: unknown): Date | undefined => {
  if (isDate(value)) {
    return value;
  }

  if (typeof value !== "string" || !ISO_8601_UTC_PATTERN.test(value)) {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const parseRecord = (
  route: WorkflowRouteKey,
  input: unknown,
): RouteValidation<Record<string, unknown>> =>
  isRecord(input) ? valid(input) : invalid(route, "expected an object");

function parseStringField(
  route: WorkflowRouteKey,
  source: Record<string, unknown>,
  field: string,
): RouteValidation<string>;
function parseStringField(
  route: WorkflowRouteKey,
  source: Record<string, unknown>,
  field: string,
  optional: true,
): RouteValidation<string | undefined>;
function parseStringField(
  route: WorkflowRouteKey,
  source: Record<string, unknown>,
  field: string,
  optional = false,
): RouteValidation<string | undefined> {
  const value = source[field];
  if (value === undefined) {
    return optional
      ? valid(undefined)
      : invalid(route, `${field} is required and must be a string`);
  }

  return typeof value === "string"
    ? valid(value)
    : invalid(route, `${field} must be a string`);
}

function parseDateField(
  route: WorkflowRouteKey,
  source: Record<string, unknown>,
  field: string,
): RouteValidation<Date>;
function parseDateField(
  route: WorkflowRouteKey,
  source: Record<string, unknown>,
  field: string,
  optional: true,
): RouteValidation<Date | undefined>;
function parseDateField(
  route: WorkflowRouteKey,
  source: Record<string, unknown>,
  field: string,
  optional = false,
): RouteValidation<Date | undefined> {
  const value = source[field];
  if (value === undefined) {
    return optional
      ? valid(undefined)
      : invalid(route, `${field} is required and must be a Date`);
  }

  const parsed = parseDateLike(value);
  return parsed === undefined
    ? invalid(route, `${field} must be a valid Date`)
    : valid(parsed);
}

function parseActorField(
  route: WorkflowRouteKey,
  source: Record<string, unknown>,
  field: string,
): RouteValidation<ActorRefPayload>;
function parseActorField(
  route: WorkflowRouteKey,
  source: Record<string, unknown>,
  field: string,
  optional: true,
): RouteValidation<ActorRefPayload | undefined>;
function parseActorField(
  route: WorkflowRouteKey,
  source: Record<string, unknown>,
  field: string,
  optional = false,
): RouteValidation<ActorRefPayload | undefined> {
  const value = source[field];
  if (value === undefined) {
    return optional
      ? valid(undefined)
      : invalid(route, `${field} is required and must be an actor reference`);
  }

  if (!isRecord(value)) {
    return invalid(route, `${field} must be an object`);
  }

  const idResult = parseStringField(route, value, "id");
  if (!idResult.ok) {
    return invalid(route, `${field}.id must be a string`);
  }

  const kindValue = value.kind;
  const kind = ACTOR_KINDS.find((candidate) => candidate === kindValue);
  if (kind === undefined) {
    return invalid(
      route,
      `${field}.kind must be one of: ${ACTOR_KINDS.join(", ")}`,
    );
  }

  return valid({
    id: idResult.value,
    kind,
  });
}

const parseBooleanField = (
  route: WorkflowRouteKey,
  source: Record<string, unknown>,
  field: string,
): RouteValidation<boolean> => {
  const value = source[field];
  return typeof value === "boolean"
    ? valid(value)
    : invalid(route, `${field} must be a boolean`);
};

const parseNumberField = (
  route: WorkflowRouteKey,
  source: Record<string, unknown>,
  field: string,
): RouteValidation<number> => {
  const value = source[field];
  return typeof value === "number" && Number.isFinite(value)
    ? valid(value)
    : invalid(route, `${field} must be a finite number`);
};

function parsePositiveIntegerField(
  route: WorkflowRouteKey,
  source: Record<string, unknown>,
  field: string,
): RouteValidation<number>;
function parsePositiveIntegerField(
  route: WorkflowRouteKey,
  source: Record<string, unknown>,
  field: string,
  optional: true,
): RouteValidation<number | undefined>;
function parsePositiveIntegerField(
  route: WorkflowRouteKey,
  source: Record<string, unknown>,
  field: string,
  optional = false,
): RouteValidation<number | undefined> {
  const value = source[field];
  if (value === undefined) {
    return optional
      ? valid(undefined)
      : invalid(route, `${field} is required and must be a positive integer`);
  }

  return typeof value === "number" &&
    Number.isInteger(value) &&
    Number.isFinite(value) &&
    value > 0
    ? valid(value)
    : invalid(route, `${field} must be a positive integer`);
}

const parseLiteralStringField = <T extends string>(
  route: WorkflowRouteKey,
  source: Record<string, unknown>,
  field: string,
  allowedValues: ReadonlyArray<T>,
): RouteValidation<T> => {
  const valueResult = parseStringField(route, source, field);
  if (!valueResult.ok) {
    return valueResult;
  }

  const matched = allowedValues.find(
    (candidate) => candidate === valueResult.value,
  );
  if (matched === undefined) {
    return invalid(
      route,
      `${field} must be one of: ${allowedValues.join(", ")}`,
    );
  }

  return valid(matched);
};

const parseEntityReferencesField = (
  route: WorkflowRouteKey,
  source: Record<string, unknown>,
  field: string,
): RouteValidation<
  ReadonlyArray<{ entityType: EntityType; entityId: string }>
> => {
  const value = source[field];
  if (!Array.isArray(value)) {
    return invalid(route, `${field} must be an array`);
  }

  const parsed: Array<{ entityType: EntityType; entityId: string }> = [];
  for (const [index, reference] of value.entries()) {
    if (!isRecord(reference)) {
      return invalid(route, `${field}[${index}] must be an object`);
    }

    const entityTypeValue = reference.entityType;
    if (typeof entityTypeValue !== "string") {
      return invalid(route, `${field}[${index}].entityType must be a string`);
    }

    const entityType = ENTITY_TYPES.find(
      (candidate) => candidate === entityTypeValue,
    );
    if (entityType === undefined) {
      return invalid(
        route,
        `${field}[${index}].entityType must be one of: ${ENTITY_TYPES.join(", ")}`,
      );
    }

    const entityIdValue = reference.entityId;
    if (typeof entityIdValue !== "string") {
      return invalid(route, `${field}[${index}].entityId must be a string`);
    }

    parsed.push({
      entityType,
      entityId: entityIdValue,
    });
  }

  return valid(parsed);
};

const validateCaptureEntryRequest: RouteValidator<CaptureEntryRequest> = (
  input,
) => {
  const route: WorkflowRouteKey = "capture.entry";
  const sourceResult = parseRecord(route, input);
  if (!sourceResult.ok) {
    return sourceResult;
  }

  const entryId = parseStringField(route, sourceResult.value, "entryId", true);
  if (!entryId.ok) {
    return entryId;
  }

  const content = parseStringField(route, sourceResult.value, "content");
  if (!content.ok) {
    return content;
  }

  const actor = parseActorField(route, sourceResult.value, "actor");
  if (!actor.ok) {
    return actor;
  }

  const at = parseDateField(route, sourceResult.value, "at", true);
  if (!at.ok) {
    return at;
  }

  return valid({
    entryId: entryId.value,
    content: content.value,
    actor: actor.value,
    at: at.value,
  });
};

const validateSuggestEntryAsTaskRequest: RouteValidator<
  SuggestEntryAsTaskRequest
> = (input) => {
  const route: WorkflowRouteKey = "capture.suggest";
  const sourceResult = parseRecord(route, input);
  if (!sourceResult.ok) {
    return sourceResult;
  }

  const entryId = parseStringField(route, sourceResult.value, "entryId");
  if (!entryId.ok) {
    return entryId;
  }

  const suggestedTitle = parseStringField(
    route,
    sourceResult.value,
    "suggestedTitle",
  );
  if (!suggestedTitle.ok) {
    return suggestedTitle;
  }

  const actor = parseActorField(route, sourceResult.value, "actor");
  if (!actor.ok) {
    return actor;
  }

  const at = parseDateField(route, sourceResult.value, "at", true);
  if (!at.ok) {
    return at;
  }

  return valid({
    entryId: entryId.value,
    suggestedTitle: suggestedTitle.value,
    actor: actor.value,
    at: at.value,
  });
};

const validateEditEntrySuggestionRequest: RouteValidator<
  EditEntrySuggestionRequest
> = (input) => {
  const route: WorkflowRouteKey = "capture.editSuggestion";
  const sourceResult = parseRecord(route, input);
  if (!sourceResult.ok) {
    return sourceResult;
  }

  const entryId = parseStringField(route, sourceResult.value, "entryId");
  if (!entryId.ok) {
    return entryId;
  }

  const suggestedTitle = parseStringField(
    route,
    sourceResult.value,
    "suggestedTitle",
  );
  if (!suggestedTitle.ok) {
    return suggestedTitle;
  }

  const actor = parseActorField(route, sourceResult.value, "actor");
  if (!actor.ok) {
    return actor;
  }

  const at = parseDateField(route, sourceResult.value, "at", true);
  if (!at.ok) {
    return at;
  }

  return valid({
    entryId: entryId.value,
    suggestedTitle: suggestedTitle.value,
    actor: actor.value,
    at: at.value,
  });
};

const validateRejectEntrySuggestionRequest: RouteValidator<
  RejectEntrySuggestionRequest
> = (input) => {
  const route: WorkflowRouteKey = "capture.rejectSuggestion";
  const sourceResult = parseRecord(route, input);
  if (!sourceResult.ok) {
    return sourceResult;
  }

  const entryId = parseStringField(route, sourceResult.value, "entryId");
  if (!entryId.ok) {
    return entryId;
  }

  const reason = parseStringField(route, sourceResult.value, "reason", true);
  if (!reason.ok) {
    return reason;
  }

  const actor = parseActorField(route, sourceResult.value, "actor");
  if (!actor.ok) {
    return actor;
  }

  const at = parseDateField(route, sourceResult.value, "at", true);
  if (!at.ok) {
    return at;
  }

  return valid({
    entryId: entryId.value,
    reason: reason.value,
    actor: actor.value,
    at: at.value,
  });
};

const validateAcceptEntryAsTaskRequest: RouteValidator<
  AcceptEntryAsTaskRequest
> = (input) => {
  const route: WorkflowRouteKey = "capture.acceptAsTask";
  const sourceResult = parseRecord(route, input);
  if (!sourceResult.ok) {
    return sourceResult;
  }

  const entryId = parseStringField(route, sourceResult.value, "entryId");
  if (!entryId.ok) {
    return entryId;
  }

  const taskId = parseStringField(route, sourceResult.value, "taskId", true);
  if (!taskId.ok) {
    return taskId;
  }

  const title = parseStringField(route, sourceResult.value, "title", true);
  if (!title.ok) {
    return title;
  }

  const actor = parseActorField(route, sourceResult.value, "actor");
  if (!actor.ok) {
    return actor;
  }

  const at = parseDateField(route, sourceResult.value, "at", true);
  if (!at.ok) {
    return at;
  }

  return valid({
    entryId: entryId.value,
    taskId: taskId.value,
    title: title.value,
    actor: actor.value,
    at: at.value,
  });
};

const validateIngestSignalRequest: RouteValidator<IngestSignalRequest> = (
  input,
) => {
  const route: WorkflowRouteKey = "signal.ingest";
  const sourceResult = parseRecord(route, input);
  if (!sourceResult.ok) {
    return sourceResult;
  }

  const signalId = parseStringField(
    route,
    sourceResult.value,
    "signalId",
    true,
  );
  if (!signalId.ok) {
    return signalId;
  }

  const source = parseStringField(route, sourceResult.value, "source");
  if (!source.ok) {
    return source;
  }

  const payload = parseStringField(route, sourceResult.value, "payload");
  if (!payload.ok) {
    return payload;
  }

  const actor = parseActorField(route, sourceResult.value, "actor");
  if (!actor.ok) {
    return actor;
  }

  const at = parseDateField(route, sourceResult.value, "at", true);
  if (!at.ok) {
    return at;
  }

  return valid({
    signalId: signalId.value,
    source: source.value,
    payload: payload.value,
    actor: actor.value,
    at: at.value,
  });
};

const validateTriageSignalRequest: RouteValidator<TriageSignalRequest> = (
  input,
) => {
  const route: WorkflowRouteKey = "signal.triage";
  const sourceResult = parseRecord(route, input);
  if (!sourceResult.ok) {
    return sourceResult;
  }

  const signalId = parseStringField(route, sourceResult.value, "signalId");
  if (!signalId.ok) {
    return signalId;
  }

  const decision = parseStringField(route, sourceResult.value, "decision");
  if (!decision.ok) {
    return decision;
  }

  const actor = parseActorField(route, sourceResult.value, "actor");
  if (!actor.ok) {
    return actor;
  }

  const at = parseDateField(route, sourceResult.value, "at", true);
  if (!at.ok) {
    return at;
  }

  return valid({
    signalId: signalId.value,
    decision: decision.value,
    actor: actor.value,
    at: at.value,
  });
};

const validateConvertSignalRequest: RouteValidator<ConvertSignalRequest> = (
  input,
) => {
  const route: WorkflowRouteKey = "signal.convert";
  const sourceResult = parseRecord(route, input);
  if (!sourceResult.ok) {
    return sourceResult;
  }

  const signalId = parseStringField(route, sourceResult.value, "signalId");
  if (!signalId.ok) {
    return signalId;
  }

  const targetType = parseLiteralStringField(
    route,
    sourceResult.value,
    "targetType",
    SIGNAL_CONVERSION_TARGETS,
  );
  if (!targetType.ok) {
    return targetType;
  }

  const targetId = parseStringField(
    route,
    sourceResult.value,
    "targetId",
    true,
  );
  if (!targetId.ok) {
    return targetId;
  }

  const actor = parseActorField(route, sourceResult.value, "actor");
  if (!actor.ok) {
    return actor;
  }

  const at = parseDateField(route, sourceResult.value, "at", true);
  if (!at.ok) {
    return at;
  }

  return valid({
    signalId: signalId.value,
    targetType: targetType.value,
    targetId: targetId.value,
    actor: actor.value,
    at: at.value,
  });
};

const validateCompleteTaskRequest: RouteValidator<CompleteTaskRequest> = (
  input,
) => {
  const route: WorkflowRouteKey = "planning.completeTask";
  const sourceResult = parseRecord(route, input);
  if (!sourceResult.ok) {
    return sourceResult;
  }

  const taskId = parseStringField(route, sourceResult.value, "taskId");
  if (!taskId.ok) {
    return taskId;
  }

  const actor = parseActorField(route, sourceResult.value, "actor");
  if (!actor.ok) {
    return actor;
  }

  const at = parseDateField(route, sourceResult.value, "at", true);
  if (!at.ok) {
    return at;
  }

  return valid({
    taskId: taskId.value,
    actor: actor.value,
    at: at.value,
  });
};

const validateDeferTaskRequest: RouteValidator<DeferTaskRequest> = (input) => {
  const route: WorkflowRouteKey = "planning.deferTask";
  const sourceResult = parseRecord(route, input);
  if (!sourceResult.ok) {
    return sourceResult;
  }

  const taskId = parseStringField(route, sourceResult.value, "taskId");
  if (!taskId.ok) {
    return taskId;
  }

  const until = parseDateField(route, sourceResult.value, "until");
  if (!until.ok) {
    return until;
  }

  const actor = parseActorField(route, sourceResult.value, "actor");
  if (!actor.ok) {
    return actor;
  }

  const at = parseDateField(route, sourceResult.value, "at", true);
  if (!at.ok) {
    return at;
  }

  return valid({
    taskId: taskId.value,
    until: until.value,
    actor: actor.value,
    at: at.value,
  });
};

const validateRescheduleTaskRequest: RouteValidator<RescheduleTaskRequest> = (
  input,
) => {
  const route: WorkflowRouteKey = "planning.rescheduleTask";
  const sourceResult = parseRecord(route, input);
  if (!sourceResult.ok) {
    return sourceResult;
  }

  const taskId = parseStringField(route, sourceResult.value, "taskId");
  if (!taskId.ok) {
    return taskId;
  }

  const nextAt = parseDateField(route, sourceResult.value, "nextAt");
  if (!nextAt.ok) {
    return nextAt;
  }

  const actor = parseActorField(route, sourceResult.value, "actor");
  if (!actor.ok) {
    return actor;
  }

  const at = parseDateField(route, sourceResult.value, "at", true);
  if (!at.ok) {
    return at;
  }

  return valid({
    taskId: taskId.value,
    nextAt: nextAt.value,
    actor: actor.value,
    at: at.value,
  });
};

const validateRequestEventSyncRequest: RouteValidator<
  RequestEventSyncRequest
> = (input) => {
  const route: WorkflowRouteKey = "approval.requestEventSync";
  const sourceResult = parseRecord(route, input);
  if (!sourceResult.ok) {
    return sourceResult;
  }

  const eventId = parseStringField(route, sourceResult.value, "eventId");
  if (!eventId.ok) {
    return eventId;
  }

  const actor = parseActorField(route, sourceResult.value, "actor");
  if (!actor.ok) {
    return actor;
  }

  const at = parseDateField(route, sourceResult.value, "at", true);
  if (!at.ok) {
    return at;
  }

  return valid({
    eventId: eventId.value,
    actor: actor.value,
    at: at.value,
  });
};

const validateRequestOutboundDraftExecutionRequest: RouteValidator<
  RequestOutboundDraftExecutionRequest
> = (input) => {
  const route: WorkflowRouteKey = "approval.requestOutboundDraftExecution";
  const sourceResult = parseRecord(route, input);
  if (!sourceResult.ok) {
    return sourceResult;
  }

  const draftId = parseStringField(route, sourceResult.value, "draftId");
  if (!draftId.ok) {
    return draftId;
  }

  const actor = parseActorField(route, sourceResult.value, "actor");
  if (!actor.ok) {
    return actor;
  }

  const at = parseDateField(route, sourceResult.value, "at", true);
  if (!at.ok) {
    return at;
  }

  return valid({
    draftId: draftId.value,
    actor: actor.value,
    at: at.value,
  });
};

const validateApproveOutboundActionRequest: RouteValidator<
  ApproveOutboundActionRequest
> = (input) => {
  const route: WorkflowRouteKey = "approval.approveOutboundAction";
  const sourceResult = parseRecord(route, input);
  if (!sourceResult.ok) {
    return sourceResult;
  }

  const actionType = parseLiteralStringField(
    route,
    sourceResult.value,
    "actionType",
    OUTBOUND_ACTION_TYPES,
  );
  if (!actionType.ok) {
    return actionType;
  }

  const entityType = parseStringField(route, sourceResult.value, "entityType");
  if (!entityType.ok) {
    return entityType;
  }

  const entityId = parseStringField(route, sourceResult.value, "entityId");
  if (!entityId.ok) {
    return entityId;
  }

  const approved = parseBooleanField(route, sourceResult.value, "approved");
  if (!approved.ok) {
    return approved;
  }

  const actor = parseActorField(route, sourceResult.value, "actor");
  if (!actor.ok) {
    return actor;
  }

  const at = parseDateField(route, sourceResult.value, "at", true);
  if (!at.ok) {
    return at;
  }

  return valid({
    actionType: actionType.value,
    entityType: entityType.value,
    entityId: entityId.value,
    approved: approved.value,
    actor: actor.value,
    at: at.value,
  });
};

const validateCreateJobRequest: RouteValidator<CreateJobRequest> = (input) => {
  const route: WorkflowRouteKey = "job.create";
  const sourceResult = parseRecord(route, input);
  if (!sourceResult.ok) {
    return sourceResult;
  }

  const jobId = parseStringField(route, sourceResult.value, "jobId", true);
  if (!jobId.ok) {
    return jobId;
  }

  const name = parseStringField(route, sourceResult.value, "name");
  if (!name.ok) {
    return name;
  }

  const actor = parseActorField(route, sourceResult.value, "actor", true);
  if (!actor.ok) {
    return actor;
  }

  const at = parseDateField(route, sourceResult.value, "at", true);
  if (!at.ok) {
    return at;
  }

  return valid({
    jobId: jobId.value,
    name: name.value,
    actor: actor.value,
    at: at.value,
  });
};

const validateRecordJobRunRequest: RouteValidator<RecordJobRunRequest> = (
  input,
) => {
  const route: WorkflowRouteKey = "job.recordRun";
  const sourceResult = parseRecord(route, input);
  if (!sourceResult.ok) {
    return sourceResult;
  }

  const jobId = parseStringField(route, sourceResult.value, "jobId");
  if (!jobId.ok) {
    return jobId;
  }

  const outcome = parseLiteralStringField(
    route,
    sourceResult.value,
    "outcome",
    JOB_RUN_OUTCOMES,
  );
  if (!outcome.ok) {
    return outcome;
  }

  const diagnostics = parseStringField(
    route,
    sourceResult.value,
    "diagnostics",
  );
  if (!diagnostics.ok) {
    return diagnostics;
  }

  const actor = parseActorField(route, sourceResult.value, "actor");
  if (!actor.ok) {
    return actor;
  }

  const at = parseDateField(route, sourceResult.value, "at", true);
  if (!at.ok) {
    return at;
  }

  return valid({
    jobId: jobId.value,
    outcome: outcome.value,
    diagnostics: diagnostics.value,
    actor: actor.value,
    at: at.value,
  });
};

const validateInspectJobRunRequest: RouteValidator<InspectJobRunRequest> = (
  input,
) => {
  const route: WorkflowRouteKey = "job.inspectRun";
  const sourceResult = parseRecord(route, input);
  if (!sourceResult.ok) {
    return sourceResult;
  }

  const jobId = parseStringField(route, sourceResult.value, "jobId");
  if (!jobId.ok) {
    return jobId;
  }

  return valid({
    jobId: jobId.value,
  });
};

const validateListJobRunHistoryRequest: RouteValidator<
  ListJobRunHistoryRequest
> = (input) => {
  const route: WorkflowRouteKey = "job.listHistory";
  const sourceResult = parseRecord(route, input);
  if (!sourceResult.ok) {
    return sourceResult;
  }

  const jobId = parseStringField(route, sourceResult.value, "jobId");
  if (!jobId.ok) {
    return jobId;
  }

  const limit = parsePositiveIntegerField(
    route,
    sourceResult.value,
    "limit",
    true,
  );
  if (!limit.ok) {
    return limit;
  }

  const beforeAt = parseDateField(route, sourceResult.value, "beforeAt", true);
  if (!beforeAt.ok) {
    return beforeAt;
  }

  return valid({
    jobId: jobId.value,
    limit: limit.value,
    beforeAt: beforeAt.value,
  });
};

const validateRetryJobRequest: RouteValidator<RetryJobRequest> = (input) => {
  const route: WorkflowRouteKey = "job.retry";
  const sourceResult = parseRecord(route, input);
  if (!sourceResult.ok) {
    return sourceResult;
  }

  const jobId = parseStringField(route, sourceResult.value, "jobId");
  if (!jobId.ok) {
    return jobId;
  }

  const actor = parseActorField(route, sourceResult.value, "actor");
  if (!actor.ok) {
    return actor;
  }

  const at = parseDateField(route, sourceResult.value, "at", true);
  if (!at.ok) {
    return at;
  }

  return valid({
    jobId: jobId.value,
    actor: actor.value,
    at: at.value,
  });
};

const validateCreateWorkflowCheckpointRequest: RouteValidator<
  CreateWorkflowCheckpointRequest
> = (input) => {
  const route: WorkflowRouteKey = "checkpoint.create";
  const sourceResult = parseRecord(route, input);
  if (!sourceResult.ok) {
    return sourceResult;
  }

  const checkpointId = parseStringField(
    route,
    sourceResult.value,
    "checkpointId",
    true,
  );
  if (!checkpointId.ok) {
    return checkpointId;
  }

  const name = parseStringField(route, sourceResult.value, "name");
  if (!name.ok) {
    return name;
  }

  const snapshotEntityRefs = parseEntityReferencesField(
    route,
    sourceResult.value,
    "snapshotEntityRefs",
  );
  if (!snapshotEntityRefs.ok) {
    return snapshotEntityRefs;
  }

  const auditCursor = parseNumberField(
    route,
    sourceResult.value,
    "auditCursor",
  );
  if (!auditCursor.ok) {
    return auditCursor;
  }

  const rollbackTarget = parseStringField(
    route,
    sourceResult.value,
    "rollbackTarget",
  );
  if (!rollbackTarget.ok) {
    return rollbackTarget;
  }

  const actor = parseActorField(route, sourceResult.value, "actor");
  if (!actor.ok) {
    return actor;
  }

  const at = parseDateField(route, sourceResult.value, "at", true);
  if (!at.ok) {
    return at;
  }

  return valid({
    checkpointId: checkpointId.value,
    name: name.value,
    snapshotEntityRefs: snapshotEntityRefs.value,
    auditCursor: auditCursor.value,
    rollbackTarget: rollbackTarget.value,
    actor: actor.value,
    at: at.value,
  });
};

const validateKeepCheckpointRequest: RouteValidator<KeepCheckpointRequest> = (
  input,
) => {
  const route: WorkflowRouteKey = "checkpoint.keep";
  const sourceResult = parseRecord(route, input);
  if (!sourceResult.ok) {
    return sourceResult;
  }

  const checkpointId = parseStringField(
    route,
    sourceResult.value,
    "checkpointId",
  );
  if (!checkpointId.ok) {
    return checkpointId;
  }

  const actor = parseActorField(route, sourceResult.value, "actor");
  if (!actor.ok) {
    return actor;
  }

  const at = parseDateField(route, sourceResult.value, "at", true);
  if (!at.ok) {
    return at;
  }

  return valid({
    checkpointId: checkpointId.value,
    actor: actor.value,
    at: at.value,
  });
};

const validateRecoverCheckpointRequest: RouteValidator<
  RecoverCheckpointRequest
> = (input) => {
  const route: WorkflowRouteKey = "checkpoint.recover";
  const sourceResult = parseRecord(route, input);
  if (!sourceResult.ok) {
    return sourceResult;
  }

  const checkpointId = parseStringField(
    route,
    sourceResult.value,
    "checkpointId",
  );
  if (!checkpointId.ok) {
    return checkpointId;
  }

  const actor = parseActorField(route, sourceResult.value, "actor");
  if (!actor.ok) {
    return actor;
  }

  const at = parseDateField(route, sourceResult.value, "at", true);
  if (!at.ok) {
    return at;
  }

  return valid({
    checkpointId: checkpointId.value,
    actor: actor.value,
    at: at.value,
  });
};

const toRouteHandler =
  <Input, Output>(
    route: WorkflowRouteKey,
    validator: RouteValidator<Input>,
    handler: (input: Input) => Effect.Effect<Output, WorkflowApiError>,
  ): ((input: unknown) => Effect.Effect<unknown, WorkflowApiError>) =>
  (input) => {
    const validationResult = validator(input);
    if (!validationResult.ok) {
      return Effect.fail(
        new WorkflowApiError({
          route,
          message: validationResult.message,
        }),
      );
    }

    return handler(validationResult.value);
  };

export const makeWorkflowRoutes = (
  api: WorkflowApi,
): ReadonlyArray<WorkflowRouteDefinition> => [
  {
    key: "capture.entry",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["capture.entry"],
    handle: toRouteHandler(
      "capture.entry",
      validateCaptureEntryRequest,
      api.captureEntry,
    ),
  },
  {
    key: "capture.suggest",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["capture.suggest"],
    handle: toRouteHandler(
      "capture.suggest",
      validateSuggestEntryAsTaskRequest,
      api.suggestEntryAsTask,
    ),
  },
  {
    key: "capture.editSuggestion",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["capture.editSuggestion"],
    handle: toRouteHandler(
      "capture.editSuggestion",
      validateEditEntrySuggestionRequest,
      api.editEntrySuggestion,
    ),
  },
  {
    key: "capture.rejectSuggestion",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["capture.rejectSuggestion"],
    handle: toRouteHandler(
      "capture.rejectSuggestion",
      validateRejectEntrySuggestionRequest,
      api.rejectEntrySuggestion,
    ),
  },
  {
    key: "capture.acceptAsTask",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["capture.acceptAsTask"],
    handle: toRouteHandler(
      "capture.acceptAsTask",
      validateAcceptEntryAsTaskRequest,
      api.acceptEntryAsTask,
    ),
  },
  {
    key: "signal.ingest",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["signal.ingest"],
    handle: toRouteHandler(
      "signal.ingest",
      validateIngestSignalRequest,
      api.ingestSignal,
    ),
  },
  {
    key: "signal.triage",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["signal.triage"],
    handle: toRouteHandler(
      "signal.triage",
      validateTriageSignalRequest,
      api.triageSignal,
    ),
  },
  {
    key: "signal.convert",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["signal.convert"],
    handle: toRouteHandler(
      "signal.convert",
      validateConvertSignalRequest,
      api.convertSignal,
    ),
  },
  {
    key: "planning.completeTask",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["planning.completeTask"],
    handle: toRouteHandler(
      "planning.completeTask",
      validateCompleteTaskRequest,
      api.completeTask,
    ),
  },
  {
    key: "planning.deferTask",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["planning.deferTask"],
    handle: toRouteHandler(
      "planning.deferTask",
      validateDeferTaskRequest,
      api.deferTask,
    ),
  },
  {
    key: "planning.rescheduleTask",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["planning.rescheduleTask"],
    handle: toRouteHandler(
      "planning.rescheduleTask",
      validateRescheduleTaskRequest,
      api.rescheduleTask,
    ),
  },
  {
    key: "approval.requestEventSync",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["approval.requestEventSync"],
    handle: toRouteHandler(
      "approval.requestEventSync",
      validateRequestEventSyncRequest,
      api.requestEventSync,
    ),
  },
  {
    key: "approval.requestOutboundDraftExecution",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["approval.requestOutboundDraftExecution"],
    handle: toRouteHandler(
      "approval.requestOutboundDraftExecution",
      validateRequestOutboundDraftExecutionRequest,
      api.requestOutboundDraftExecution,
    ),
  },
  {
    key: "approval.approveOutboundAction",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["approval.approveOutboundAction"],
    handle: toRouteHandler(
      "approval.approveOutboundAction",
      validateApproveOutboundActionRequest,
      api.approveOutboundAction,
    ),
  },
  {
    key: "job.create",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["job.create"],
    handle: toRouteHandler(
      "job.create",
      validateCreateJobRequest,
      api.createJob,
    ),
  },
  {
    key: "job.recordRun",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["job.recordRun"],
    handle: toRouteHandler(
      "job.recordRun",
      validateRecordJobRunRequest,
      api.recordJobRun,
    ),
  },
  {
    key: "job.inspectRun",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["job.inspectRun"],
    handle: toRouteHandler(
      "job.inspectRun",
      validateInspectJobRunRequest,
      api.inspectJobRun,
    ),
  },
  {
    key: "job.listHistory",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["job.listHistory"],
    handle: toRouteHandler(
      "job.listHistory",
      validateListJobRunHistoryRequest,
      api.listJobRunHistory,
    ),
  },
  {
    key: "job.retry",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["job.retry"],
    handle: toRouteHandler("job.retry", validateRetryJobRequest, api.retryJob),
  },
  {
    key: "checkpoint.create",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["checkpoint.create"],
    handle: toRouteHandler(
      "checkpoint.create",
      validateCreateWorkflowCheckpointRequest,
      api.createWorkflowCheckpoint,
    ),
  },
  {
    key: "checkpoint.keep",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["checkpoint.keep"],
    handle: toRouteHandler(
      "checkpoint.keep",
      validateKeepCheckpointRequest,
      api.keepCheckpoint,
    ),
  },
  {
    key: "checkpoint.recover",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["checkpoint.recover"],
    handle: toRouteHandler(
      "checkpoint.recover",
      validateRecoverCheckpointRequest,
      api.recoverCheckpoint,
    ),
  },
];
