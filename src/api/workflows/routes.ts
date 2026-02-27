import { Effect } from "effect";

import { ENTITY_TYPES, EntityType } from "../../core/domain/common";
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
  "task.create": "/api/workflows/task/create",
  "task.update": "/api/workflows/task/update",
  "task.list": "/api/workflows/task/list",
  "event.create": "/api/workflows/event/create",
  "event.update": "/api/workflows/event/update",
  "event.list": "/api/workflows/event/list",
  "event.listConflicts": "/api/workflows/event/list-conflicts",
  "project.create": "/api/workflows/project/create",
  "project.update": "/api/workflows/project/update",
  "project.setLifecycle": "/api/workflows/project/set-lifecycle",
  "project.list": "/api/workflows/project/list",
  "note.create": "/api/workflows/note/create",
  "note.update": "/api/workflows/note/update",
  "note.linkEntity": "/api/workflows/note/link-entity",
  "note.unlinkEntity": "/api/workflows/note/unlink-entity",
  "note.list": "/api/workflows/note/list",
  "notification.list": "/api/workflows/notification/list",
  "notification.acknowledge": "/api/workflows/notification/acknowledge",
  "notification.dismiss": "/api/workflows/notification/dismiss",
  "search.query": "/api/workflows/search/query",
  "approval.requestEventSync": "/api/workflows/approval/request-event-sync",
  "approval.requestOutboundDraftExecution":
    "/api/workflows/approval/request-outbound-draft-execution",
  "approval.approveOutboundAction":
    "/api/workflows/approval/approve-outbound-action",
  "job.create": "/api/workflows/job/create",
  "job.recordRun": "/api/workflows/job/record-run",
  "job.inspectRun": "/api/workflows/job/inspect-run",
  "job.list": "/api/workflows/job/list",
  "job.listHistory": "/api/workflows/job/list-history",
  "job.retry": "/api/workflows/job/retry",
  "checkpoint.create": "/api/workflows/checkpoint/create",
  "checkpoint.inspect": "/api/workflows/checkpoint/inspect",
  "checkpoint.keep": "/api/workflows/checkpoint/keep",
  "checkpoint.recover": "/api/workflows/checkpoint/recover",
  "activity.list": "/api/workflows/activity/list",
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
type CreateTaskRouteRequest = Parameters<
  NonNullable<WorkflowApi["createTask"]>
>[0];
type UpdateTaskRouteRequest = Parameters<
  NonNullable<WorkflowApi["updateTask"]>
>[0];
type ListTasksRouteRequest = Parameters<NonNullable<WorkflowApi["listTasks"]>>[0];
type CreateEventRouteRequest = Parameters<
  NonNullable<WorkflowApi["createEvent"]>
>[0];
type UpdateEventRouteRequest = Parameters<
  NonNullable<WorkflowApi["updateEvent"]>
>[0];
type ListEventsRouteRequest = Parameters<
  NonNullable<WorkflowApi["listEvents"]>
>[0];
type ListEventConflictsRouteRequest = Parameters<
  NonNullable<WorkflowApi["listEventConflicts"]>
>[0];
type CreateProjectRouteRequest = Parameters<
  NonNullable<WorkflowApi["createProject"]>
>[0];
type UpdateProjectRouteRequest = Parameters<
  NonNullable<WorkflowApi["updateProject"]>
>[0];
type SetProjectLifecycleRouteRequest = Parameters<
  NonNullable<WorkflowApi["setProjectLifecycle"]>
>[0];
type ListProjectsRouteRequest = Parameters<
  NonNullable<WorkflowApi["listProjects"]>
>[0];
type CreateNoteRouteRequest = Parameters<NonNullable<WorkflowApi["createNote"]>>[0];
type UpdateNoteRouteRequest = Parameters<NonNullable<WorkflowApi["updateNote"]>>[0];
type LinkNoteEntityRouteRequest = Parameters<
  NonNullable<WorkflowApi["linkNoteEntity"]>
>[0];
type UnlinkNoteEntityRouteRequest = Parameters<
  NonNullable<WorkflowApi["unlinkNoteEntity"]>
>[0];
type ListNotesRouteRequest = Parameters<NonNullable<WorkflowApi["listNotes"]>>[0];
type ListNotificationsRouteRequest = Parameters<
  NonNullable<WorkflowApi["listNotifications"]>
>[0];
type AcknowledgeNotificationRouteRequest = Parameters<
  NonNullable<WorkflowApi["acknowledgeNotification"]>
>[0];
type DismissNotificationRouteRequest = Parameters<
  NonNullable<WorkflowApi["dismissNotification"]>
>[0];
type SearchQueryRouteRequest = Parameters<NonNullable<WorkflowApi["searchQuery"]>>[0];

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
const JOB_RUN_STATES = [
  "idle",
  "running",
  "succeeded",
  "failed",
  "retrying",
] as const;
const TASK_STATUSES = ["planned", "completed", "deferred"] as const;
const EVENT_SYNC_STATES = [
  "local_only",
  "pending_approval",
  "synced",
] as const;
const EVENT_SORT_VALUES = [
  "startAt_asc",
  "startAt_desc",
  "updatedAt_asc",
  "updatedAt_desc",
] as const;
const PROJECT_LIFECYCLES = ["active", "paused", "completed"] as const;
const NOTIFICATION_STATUSES = ["pending", "sent", "dismissed"] as const;
const ISO_8601_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

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

  if (typeof value !== "string" || !ISO_8601_PATTERN.test(value)) {
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

const parseOptionalRecord = (
  route: WorkflowRouteKey,
  input: unknown,
): RouteValidation<Record<string, unknown>> =>
  input === undefined ? valid({}) : parseRecord(route, input);

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

function parseNonEmptyStringField(
  route: WorkflowRouteKey,
  source: Record<string, unknown>,
  field: string,
): RouteValidation<string>;
function parseNonEmptyStringField(
  route: WorkflowRouteKey,
  source: Record<string, unknown>,
  field: string,
  optional: true,
): RouteValidation<string | undefined>;
function parseNonEmptyStringField(
  route: WorkflowRouteKey,
  source: Record<string, unknown>,
  field: string,
  optional = false,
): RouteValidation<string | undefined> {
  const value = source[field];
  if (value === undefined) {
    return optional
      ? valid(undefined)
      : invalid(route, `${field} is required and must be a non-empty string`);
  }

  if (typeof value !== "string") {
    return invalid(route, `${field} must be a string`);
  }

  return value.trim().length > 0
    ? valid(value)
    : invalid(route, `${field} must be a non-empty string`);
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

  const idResult = parseNonEmptyStringField(route, value, "id");
  if (!idResult.ok) {
    return invalid(route, `${field}.id must be a non-empty string`);
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
    id: idResult.value.trim(),
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

const parseIntegerField = (
  route: WorkflowRouteKey,
  source: Record<string, unknown>,
  field: string,
): RouteValidation<number> => {
  const value = source[field];
  return typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value)
    ? valid(value)
    : invalid(route, `${field} must be an integer`);
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

function parseStringOrNullField(
  route: WorkflowRouteKey,
  source: Record<string, unknown>,
  field: string,
): RouteValidation<string | null | undefined>;
function parseStringOrNullField(
  route: WorkflowRouteKey,
  source: Record<string, unknown>,
  field: string,
  optional: false,
): RouteValidation<string | null>;
function parseStringOrNullField(
  route: WorkflowRouteKey,
  source: Record<string, unknown>,
  field: string,
  optional = true,
): RouteValidation<string | null | undefined> {
  if (!(field in source)) {
    return optional
      ? valid(undefined)
      : invalid(route, `${field} is required and must be a string or null`);
  }

  const value = source[field];
  if (value === null) {
    return valid(null);
  }

  return typeof value === "string"
    ? valid(value)
    : invalid(route, `${field} must be a string or null`);
}

function parseDateOrNullField(
  route: WorkflowRouteKey,
  source: Record<string, unknown>,
  field: string,
): RouteValidation<Date | null | undefined>;
function parseDateOrNullField(
  route: WorkflowRouteKey,
  source: Record<string, unknown>,
  field: string,
  optional: false,
): RouteValidation<Date | null>;
function parseDateOrNullField(
  route: WorkflowRouteKey,
  source: Record<string, unknown>,
  field: string,
  optional = true,
): RouteValidation<Date | null | undefined> {
  if (!(field in source)) {
    return optional
      ? valid(undefined)
      : invalid(route, `${field} is required and must be a Date or null`);
  }

  const value = source[field];
  if (value === null) {
    return valid(null);
  }

  const parsed = parseDateLike(value);
  return parsed === undefined
    ? invalid(route, `${field} must be a valid Date or null`)
    : valid(parsed);
}

const parseStringArrayField = (
  route: WorkflowRouteKey,
  source: Record<string, unknown>,
  field: string,
  optional = false,
): RouteValidation<ReadonlyArray<string> | undefined> => {
  const value = source[field];
  if (value === undefined) {
    return optional
      ? valid(undefined)
      : invalid(route, `${field} is required and must be an array`);
  }

  if (!Array.isArray(value)) {
    return invalid(route, `${field} must be an array`);
  }

  const parsed: Array<string> = [];
  for (const [index, candidate] of value.entries()) {
    if (typeof candidate !== "string") {
      return invalid(route, `${field}[${index}] must be a string`);
    }

    const trimmed = candidate.trim();
    if (trimmed.length === 0) {
      return invalid(route, `${field}[${index}] must be a non-empty string`);
    }
    parsed.push(trimmed);
  }

  return valid(parsed);
};

const parseRelatedEntityField = (
  route: WorkflowRouteKey,
  source: Record<string, unknown>,
  field: string,
): RouteValidation<{ entityType?: string; entityId?: string } | undefined> => {
  const value = source[field];
  if (value === undefined) {
    return valid(undefined);
  }

  if (!isRecord(value)) {
    return invalid(route, `${field} must be an object`);
  }

  const entityTypeResult = parseNonEmptyStringField(
    route,
    value,
    "entityType",
    true,
  );
  if (!entityTypeResult.ok) {
    return invalid(route, `${field}.entityType must be a non-empty string`);
  }

  const entityIdResult = parseNonEmptyStringField(route, value, "entityId", true);
  if (!entityIdResult.ok) {
    return invalid(route, `${field}.entityId must be a non-empty string`);
  }

  return valid({
    entityType: entityTypeResult.value,
    entityId: entityIdResult.value,
  });
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

    if (entityIdValue.trim().length === 0) {
      return invalid(
        route,
        `${field}[${index}].entityId must be a non-empty string`,
      );
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

  const content = parseNonEmptyStringField(
    route,
    sourceResult.value,
    "content",
  );
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

  const source = parseNonEmptyStringField(route, sourceResult.value, "source");
  if (!source.ok) {
    return source;
  }

  const payload = parseNonEmptyStringField(
    route,
    sourceResult.value,
    "payload",
  );
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

const validateCreateTaskRequest: RouteValidator<CreateTaskRouteRequest> = (
  input,
) => {
  const route: WorkflowRouteKey = "task.create";
  const sourceResult = parseRecord(route, input);
  if (!sourceResult.ok) {
    return sourceResult;
  }

  const taskId = parseNonEmptyStringField(
    route,
    sourceResult.value,
    "taskId",
    true,
  );
  if (!taskId.ok) {
    return taskId;
  }

  const title = parseNonEmptyStringField(route, sourceResult.value, "title");
  if (!title.ok) {
    return title;
  }

  const description = parseStringField(
    route,
    sourceResult.value,
    "description",
    true,
  );
  if (!description.ok) {
    return description;
  }

  const scheduledFor = parseDateField(
    route,
    sourceResult.value,
    "scheduledFor",
    true,
  );
  if (!scheduledFor.ok) {
    return scheduledFor;
  }

  const dueAt = parseDateField(route, sourceResult.value, "dueAt", true);
  if (!dueAt.ok) {
    return dueAt;
  }

  const projectId = parseNonEmptyStringField(
    route,
    sourceResult.value,
    "projectId",
    true,
  );
  if (!projectId.ok) {
    return projectId;
  }

  const sourceEntryId = parseNonEmptyStringField(
    route,
    sourceResult.value,
    "sourceEntryId",
    true,
  );
  if (!sourceEntryId.ok) {
    return sourceEntryId;
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
    title: title.value,
    description: description.value,
    scheduledFor: scheduledFor.value,
    dueAt: dueAt.value,
    projectId: projectId.value,
    sourceEntryId: sourceEntryId.value,
    actor: actor.value,
    at: at.value,
  });
};

const validateUpdateTaskRequest: RouteValidator<UpdateTaskRouteRequest> = (
  input,
) => {
  const route: WorkflowRouteKey = "task.update";
  const sourceResult = parseRecord(route, input);
  if (!sourceResult.ok) {
    return sourceResult;
  }

  const taskId = parseNonEmptyStringField(route, sourceResult.value, "taskId");
  if (!taskId.ok) {
    return taskId;
  }

  const title = parseStringField(route, sourceResult.value, "title", true);
  if (!title.ok) {
    return title;
  }

  const description = parseStringOrNullField(
    route,
    sourceResult.value,
    "description",
  );
  if (!description.ok) {
    return description;
  }

  const scheduledFor = parseDateOrNullField(
    route,
    sourceResult.value,
    "scheduledFor",
  );
  if (!scheduledFor.ok) {
    return scheduledFor;
  }

  const dueAt = parseDateOrNullField(route, sourceResult.value, "dueAt");
  if (!dueAt.ok) {
    return dueAt;
  }

  const projectId = parseStringOrNullField(
    route,
    sourceResult.value,
    "projectId",
  );
  if (!projectId.ok) {
    return projectId;
  }
  if (typeof projectId.value === "string" && projectId.value.trim().length === 0) {
    return invalid(route, "projectId must be a non-empty string or null");
  }

  const actor = parseActorField(route, sourceResult.value, "actor");
  if (!actor.ok) {
    return actor;
  }

  const at = parseDateField(route, sourceResult.value, "at", true);
  if (!at.ok) {
    return at;
  }

  const hasUpdates =
    title.value !== undefined ||
    description.value !== undefined ||
    scheduledFor.value !== undefined ||
    dueAt.value !== undefined ||
    projectId.value !== undefined;
  if (!hasUpdates) {
    return invalid(route, "at least one task update field is required");
  }

  return valid({
    taskId: taskId.value,
    title: title.value,
    description: description.value,
    scheduledFor: scheduledFor.value,
    dueAt: dueAt.value,
    projectId: projectId.value,
    actor: actor.value,
    at: at.value,
  });
};

const validateListTasksRequest: RouteValidator<ListTasksRouteRequest> = (
  input,
) => {
  const route: WorkflowRouteKey = "task.list";
  const sourceResult = parseOptionalRecord(route, input);
  if (!sourceResult.ok) {
    return sourceResult;
  }

  const statusValue = sourceResult.value.status;
  const status =
    statusValue === undefined
      ? undefined
      : TASK_STATUSES.find((candidate) => candidate === statusValue);
  if (statusValue !== undefined && status === undefined) {
    return invalid(route, `status must be one of: ${TASK_STATUSES.join(", ")}`);
  }

  const projectId = parseNonEmptyStringField(
    route,
    sourceResult.value,
    "projectId",
    true,
  );
  if (!projectId.ok) {
    return projectId;
  }

  const scheduledFrom = parseDateField(
    route,
    sourceResult.value,
    "scheduledFrom",
    true,
  );
  if (!scheduledFrom.ok) {
    return scheduledFrom;
  }

  const scheduledTo = parseDateField(
    route,
    sourceResult.value,
    "scheduledTo",
    true,
  );
  if (!scheduledTo.ok) {
    return scheduledTo;
  }

  if (
    scheduledFrom.value !== undefined &&
    scheduledTo.value !== undefined &&
    scheduledFrom.value.getTime() > scheduledTo.value.getTime()
  ) {
    return invalid(route, "scheduledFrom must be before or equal to scheduledTo");
  }

  return valid({
    status,
    projectId: projectId.value,
    scheduledFrom: scheduledFrom.value,
    scheduledTo: scheduledTo.value,
  });
};

const validateCreateEventRequest: RouteValidator<CreateEventRouteRequest> = (
  input,
) => {
  const route: WorkflowRouteKey = "event.create";
  const sourceResult = parseRecord(route, input);
  if (!sourceResult.ok) {
    return sourceResult;
  }

  const eventId = parseNonEmptyStringField(
    route,
    sourceResult.value,
    "eventId",
    true,
  );
  if (!eventId.ok) {
    return eventId;
  }

  const title = parseNonEmptyStringField(route, sourceResult.value, "title");
  if (!title.ok) {
    return title;
  }

  const startAt = parseDateField(route, sourceResult.value, "startAt");
  if (!startAt.ok) {
    return startAt;
  }

  const endAt = parseDateField(route, sourceResult.value, "endAt", true);
  if (!endAt.ok) {
    return endAt;
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
    title: title.value,
    startAt: startAt.value,
    endAt: endAt.value,
    actor: actor.value,
    at: at.value,
  });
};

const validateUpdateEventRequest: RouteValidator<UpdateEventRouteRequest> = (
  input,
) => {
  const route: WorkflowRouteKey = "event.update";
  const sourceResult = parseRecord(route, input);
  if (!sourceResult.ok) {
    return sourceResult;
  }

  const eventId = parseNonEmptyStringField(
    route,
    sourceResult.value,
    "eventId",
  );
  if (!eventId.ok) {
    return eventId;
  }

  const title = parseStringField(route, sourceResult.value, "title", true);
  if (!title.ok) {
    return title;
  }

  const startAt = parseDateField(route, sourceResult.value, "startAt", true);
  if (!startAt.ok) {
    return startAt;
  }

  const endAt = parseDateOrNullField(route, sourceResult.value, "endAt");
  if (!endAt.ok) {
    return endAt;
  }

  const actor = parseActorField(route, sourceResult.value, "actor");
  if (!actor.ok) {
    return actor;
  }

  const at = parseDateField(route, sourceResult.value, "at", true);
  if (!at.ok) {
    return at;
  }

  const hasUpdates =
    title.value !== undefined ||
    startAt.value !== undefined ||
    endAt.value !== undefined;
  if (!hasUpdates) {
    return invalid(route, "at least one event update field is required");
  }

  return valid({
    eventId: eventId.value,
    title: title.value,
    startAt: startAt.value,
    endAt: endAt.value,
    actor: actor.value,
    at: at.value,
  });
};

const validateListEventsRequest: RouteValidator<ListEventsRouteRequest> = (
  input,
) => {
  const route: WorkflowRouteKey = "event.list";
  const sourceResult = parseOptionalRecord(route, input);
  if (!sourceResult.ok) {
    return sourceResult;
  }

  const from = parseDateField(route, sourceResult.value, "from", true);
  if (!from.ok) {
    return from;
  }

  const to = parseDateField(route, sourceResult.value, "to", true);
  if (!to.ok) {
    return to;
  }

  if (
    from.value !== undefined &&
    to.value !== undefined &&
    from.value.getTime() > to.value.getTime()
  ) {
    return invalid(route, "from must be less than or equal to to");
  }

  const syncStateValue = sourceResult.value.syncState;
  const syncState =
    syncStateValue === undefined
      ? undefined
      : EVENT_SYNC_STATES.find((candidate) => candidate === syncStateValue);
  if (syncStateValue !== undefined && syncState === undefined) {
    return invalid(
      route,
      `syncState must be one of: ${EVENT_SYNC_STATES.join(", ")}`,
    );
  }

  const sortValue = sourceResult.value.sort;
  const sort =
    sortValue === undefined
      ? undefined
      : EVENT_SORT_VALUES.find((candidate) => candidate === sortValue);
  if (sortValue !== undefined && sort === undefined) {
    return invalid(route, `sort must be one of: ${EVENT_SORT_VALUES.join(", ")}`);
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

  return valid({
    from: from.value,
    to: to.value,
    syncState,
    sort,
    limit: limit.value,
  });
};

const validateListEventConflictsRequest: RouteValidator<
  ListEventConflictsRouteRequest
> = (input) => {
  const route: WorkflowRouteKey = "event.listConflicts";
  const sourceResult = parseOptionalRecord(route, input);
  if (!sourceResult.ok) {
    return sourceResult;
  }

  const eventId = parseNonEmptyStringField(
    route,
    sourceResult.value,
    "eventId",
    true,
  );
  if (!eventId.ok) {
    return eventId;
  }

  return valid({
    eventId: eventId.value,
  });
};

const validateCreateProjectRequest: RouteValidator<CreateProjectRouteRequest> = (
  input,
) => {
  const route: WorkflowRouteKey = "project.create";
  const sourceResult = parseRecord(route, input);
  if (!sourceResult.ok) {
    return sourceResult;
  }

  const projectId = parseNonEmptyStringField(
    route,
    sourceResult.value,
    "projectId",
    true,
  );
  if (!projectId.ok) {
    return projectId;
  }

  const name = parseNonEmptyStringField(route, sourceResult.value, "name");
  if (!name.ok) {
    return name;
  }

  const description = parseStringField(
    route,
    sourceResult.value,
    "description",
    true,
  );
  if (!description.ok) {
    return description;
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
    projectId: projectId.value,
    name: name.value,
    description: description.value,
    actor: actor.value,
    at: at.value,
  });
};

const validateUpdateProjectRequest: RouteValidator<UpdateProjectRouteRequest> = (
  input,
) => {
  const route: WorkflowRouteKey = "project.update";
  const sourceResult = parseRecord(route, input);
  if (!sourceResult.ok) {
    return sourceResult;
  }

  const projectId = parseNonEmptyStringField(
    route,
    sourceResult.value,
    "projectId",
  );
  if (!projectId.ok) {
    return projectId;
  }

  const name = parseStringField(route, sourceResult.value, "name", true);
  if (!name.ok) {
    return name;
  }

  const description = parseStringField(
    route,
    sourceResult.value,
    "description",
    true,
  );
  if (!description.ok) {
    return description;
  }

  const actor = parseActorField(route, sourceResult.value, "actor");
  if (!actor.ok) {
    return actor;
  }

  const at = parseDateField(route, sourceResult.value, "at", true);
  if (!at.ok) {
    return at;
  }

  if (name.value === undefined && description.value === undefined) {
    return invalid(route, "at least one project update field is required");
  }

  return valid({
    projectId: projectId.value,
    name: name.value,
    description: description.value,
    actor: actor.value,
    at: at.value,
  });
};

const validateSetProjectLifecycleRequest: RouteValidator<
  SetProjectLifecycleRouteRequest
> = (input) => {
  const route: WorkflowRouteKey = "project.setLifecycle";
  const sourceResult = parseRecord(route, input);
  if (!sourceResult.ok) {
    return sourceResult;
  }

  const projectId = parseNonEmptyStringField(
    route,
    sourceResult.value,
    "projectId",
  );
  if (!projectId.ok) {
    return projectId;
  }

  const lifecycle = parseLiteralStringField(
    route,
    sourceResult.value,
    "lifecycle",
    PROJECT_LIFECYCLES,
  );
  if (!lifecycle.ok) {
    return lifecycle;
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
    projectId: projectId.value,
    lifecycle: lifecycle.value,
    actor: actor.value,
    at: at.value,
  });
};

const validateListProjectsRequest: RouteValidator<ListProjectsRouteRequest> = (
  input,
) => {
  const route: WorkflowRouteKey = "project.list";
  const sourceResult = parseOptionalRecord(route, input);
  if (!sourceResult.ok) {
    return sourceResult;
  }

  const lifecycleValue = sourceResult.value.lifecycle;
  const lifecycle =
    lifecycleValue === undefined
      ? undefined
      : PROJECT_LIFECYCLES.find((candidate) => candidate === lifecycleValue);
  if (lifecycleValue !== undefined && lifecycle === undefined) {
    return invalid(
      route,
      `lifecycle must be one of: ${PROJECT_LIFECYCLES.join(", ")}`,
    );
  }

  return valid({
    lifecycle,
  });
};

const validateCreateNoteRequest: RouteValidator<CreateNoteRouteRequest> = (
  input,
) => {
  const route: WorkflowRouteKey = "note.create";
  const sourceResult = parseRecord(route, input);
  if (!sourceResult.ok) {
    return sourceResult;
  }

  const noteId = parseNonEmptyStringField(
    route,
    sourceResult.value,
    "noteId",
    true,
  );
  if (!noteId.ok) {
    return noteId;
  }

  const body = parseNonEmptyStringField(route, sourceResult.value, "body");
  if (!body.ok) {
    return body;
  }

  const linkedEntityRefs = parseStringArrayField(
    route,
    sourceResult.value,
    "linkedEntityRefs",
    true,
  );
  if (!linkedEntityRefs.ok) {
    return linkedEntityRefs;
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
    noteId: noteId.value,
    body: body.value,
    linkedEntityRefs: linkedEntityRefs.value,
    actor: actor.value,
    at: at.value,
  });
};

const validateUpdateNoteRequest: RouteValidator<UpdateNoteRouteRequest> = (
  input,
) => {
  const route: WorkflowRouteKey = "note.update";
  const sourceResult = parseRecord(route, input);
  if (!sourceResult.ok) {
    return sourceResult;
  }

  const noteId = parseNonEmptyStringField(route, sourceResult.value, "noteId");
  if (!noteId.ok) {
    return noteId;
  }

  const body = parseNonEmptyStringField(route, sourceResult.value, "body");
  if (!body.ok) {
    return body;
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
    noteId: noteId.value,
    body: body.value,
    actor: actor.value,
    at: at.value,
  });
};

const validateLinkNoteEntityRequest: RouteValidator<
  LinkNoteEntityRouteRequest
> = (input) => {
  const route: WorkflowRouteKey = "note.linkEntity";
  const sourceResult = parseRecord(route, input);
  if (!sourceResult.ok) {
    return sourceResult;
  }

  const noteId = parseNonEmptyStringField(route, sourceResult.value, "noteId");
  if (!noteId.ok) {
    return noteId;
  }

  const entityRef = parseNonEmptyStringField(
    route,
    sourceResult.value,
    "entityRef",
  );
  if (!entityRef.ok) {
    return entityRef;
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
    noteId: noteId.value,
    entityRef: entityRef.value,
    actor: actor.value,
    at: at.value,
  });
};

const validateUnlinkNoteEntityRequest: RouteValidator<
  UnlinkNoteEntityRouteRequest
> = (input) => {
  const route: WorkflowRouteKey = "note.unlinkEntity";
  const sourceResult = parseRecord(route, input);
  if (!sourceResult.ok) {
    return sourceResult;
  }

  const noteId = parseNonEmptyStringField(route, sourceResult.value, "noteId");
  if (!noteId.ok) {
    return noteId;
  }

  const entityRef = parseNonEmptyStringField(
    route,
    sourceResult.value,
    "entityRef",
  );
  if (!entityRef.ok) {
    return entityRef;
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
    noteId: noteId.value,
    entityRef: entityRef.value,
    actor: actor.value,
    at: at.value,
  });
};

const validateListNotesRequest: RouteValidator<ListNotesRouteRequest> = (
  input,
) => {
  const route: WorkflowRouteKey = "note.list";
  const sourceResult = parseOptionalRecord(route, input);
  if (!sourceResult.ok) {
    return sourceResult;
  }

  const entityRef = parseNonEmptyStringField(
    route,
    sourceResult.value,
    "entityRef",
    true,
  );
  if (!entityRef.ok) {
    return entityRef;
  }

  return valid({
    entityRef: entityRef.value,
  });
};

const validateListNotificationsRequest: RouteValidator<
  ListNotificationsRouteRequest
> = (input) => {
  const route: WorkflowRouteKey = "notification.list";
  const sourceResult = parseOptionalRecord(route, input);
  if (!sourceResult.ok) {
    return sourceResult;
  }

  const statusValue = sourceResult.value.status;
  const status =
    statusValue === undefined
      ? undefined
      : NOTIFICATION_STATUSES.find((candidate) => candidate === statusValue);
  if (statusValue !== undefined && status === undefined) {
    return invalid(
      route,
      `status must be one of: ${NOTIFICATION_STATUSES.join(", ")}`,
    );
  }

  const type = parseNonEmptyStringField(route, sourceResult.value, "type", true);
  if (!type.ok) {
    return type;
  }

  const relatedEntity = parseRelatedEntityField(
    route,
    sourceResult.value,
    "relatedEntity",
  );
  if (!relatedEntity.ok) {
    return relatedEntity;
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

  return valid({
    status,
    type: type.value,
    relatedEntity: relatedEntity.value,
    limit: limit.value,
  });
};

const validateAcknowledgeNotificationRequest: RouteValidator<
  AcknowledgeNotificationRouteRequest
> = (input) => {
  const route: WorkflowRouteKey = "notification.acknowledge";
  const sourceResult = parseRecord(route, input);
  if (!sourceResult.ok) {
    return sourceResult;
  }

  const notificationId = parseNonEmptyStringField(
    route,
    sourceResult.value,
    "notificationId",
  );
  if (!notificationId.ok) {
    return notificationId;
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
    notificationId: notificationId.value,
    actor: actor.value,
    at: at.value,
  });
};

const validateDismissNotificationRequest: RouteValidator<
  DismissNotificationRouteRequest
> = (input) => {
  const route: WorkflowRouteKey = "notification.dismiss";
  const sourceResult = parseRecord(route, input);
  if (!sourceResult.ok) {
    return sourceResult;
  }

  const notificationId = parseNonEmptyStringField(
    route,
    sourceResult.value,
    "notificationId",
  );
  if (!notificationId.ok) {
    return notificationId;
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
    notificationId: notificationId.value,
    actor: actor.value,
    at: at.value,
  });
};

const validateSearchQueryRequest: RouteValidator<SearchQueryRouteRequest> = (
  input,
) => {
  const route: WorkflowRouteKey = "search.query";
  const sourceResult = parseRecord(route, input);
  if (!sourceResult.ok) {
    return sourceResult;
  }

  const query = parseNonEmptyStringField(route, sourceResult.value, "query");
  if (!query.ok) {
    return query;
  }

  const entityTypes = parseStringArrayField(
    route,
    sourceResult.value,
    "entityTypes",
    true,
  );
  if (!entityTypes.ok) {
    return entityTypes;
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

  return valid({
    query: query.value,
    entityTypes: entityTypes.value,
    limit: limit.value,
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

  const eventId = parseNonEmptyStringField(
    route,
    sourceResult.value,
    "eventId",
  );
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

  const draftId = parseNonEmptyStringField(
    route,
    sourceResult.value,
    "draftId",
  );
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

  const entityId = parseNonEmptyStringField(
    route,
    sourceResult.value,
    "entityId",
  );
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

  const name = parseNonEmptyStringField(route, sourceResult.value, "name");
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

  const jobId = parseNonEmptyStringField(route, sourceResult.value, "jobId");
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

  const jobId = parseNonEmptyStringField(route, sourceResult.value, "jobId");
  if (!jobId.ok) {
    return jobId;
  }

  return valid({
    jobId: jobId.value,
  });
};

const validateListJobsRequest: RouteValidator<ListJobsRequest> = (input) => {
  const route: WorkflowRouteKey = "job.list";
  const sourceResult = parseOptionalRecord(route, input);
  if (!sourceResult.ok) {
    return sourceResult;
  }

  const runStateValue = sourceResult.value.runState;
  const runState =
    runStateValue === undefined
      ? undefined
      : JOB_RUN_STATES.find((candidate) => candidate === runStateValue);
  if (runStateValue !== undefined && runState === undefined) {
    return invalid(
      route,
      `runState must be one of: ${JOB_RUN_STATES.join(", ")}`,
    );
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

  const beforeUpdatedAt = parseDateField(
    route,
    sourceResult.value,
    "beforeUpdatedAt",
    true,
  );
  if (!beforeUpdatedAt.ok) {
    return beforeUpdatedAt;
  }

  return valid({
    runState,
    limit: limit.value,
    beforeUpdatedAt: beforeUpdatedAt.value,
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

  const jobId = parseNonEmptyStringField(route, sourceResult.value, "jobId");
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

  const fixSummary = parseNonEmptyStringField(
    route,
    sourceResult.value,
    "fixSummary",
    true,
  );
  if (!fixSummary.ok) {
    return fixSummary;
  }

  return valid({
    jobId: jobId.value,
    actor: actor.value,
    at: at.value,
    fixSummary: fixSummary.value,
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

  const checkpointId = parseNonEmptyStringField(
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

  const auditCursor = parseIntegerField(
    route,
    sourceResult.value,
    "auditCursor",
  );
  if (!auditCursor.ok) {
    return auditCursor;
  }

  const rollbackTarget = parseNonEmptyStringField(
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

  const checkpointId = parseNonEmptyStringField(
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

const validateInspectWorkflowCheckpointRequest: RouteValidator<
  InspectWorkflowCheckpointRequest
> = (input) => {
  const route: WorkflowRouteKey = "checkpoint.inspect";
  const sourceResult = parseRecord(route, input);
  if (!sourceResult.ok) {
    return sourceResult;
  }

  const checkpointId = parseNonEmptyStringField(
    route,
    sourceResult.value,
    "checkpointId",
  );
  if (!checkpointId.ok) {
    return checkpointId;
  }

  return valid({
    checkpointId: checkpointId.value,
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

  const checkpointId = parseNonEmptyStringField(
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

const validateListActivityRequest: RouteValidator<ListActivityRequest> = (
  input,
) => {
  const route: WorkflowRouteKey = "activity.list";
  const sourceResult = parseOptionalRecord(route, input);
  if (!sourceResult.ok) {
    return sourceResult;
  }

  const entityType = parseNonEmptyStringField(
    route,
    sourceResult.value,
    "entityType",
    true,
  );
  if (!entityType.ok) {
    return entityType;
  }

  const entityId = parseNonEmptyStringField(
    route,
    sourceResult.value,
    "entityId",
    true,
  );
  if (!entityId.ok) {
    return entityId;
  }

  const actorKindValue = sourceResult.value.actorKind;
  const actorKind =
    actorKindValue === undefined
      ? undefined
      : ACTOR_KINDS.find((candidate) => candidate === actorKindValue);
  if (actorKindValue !== undefined && actorKind === undefined) {
    return invalid(
      route,
      `actorKind must be one of: ${ACTOR_KINDS.join(", ")}`,
    );
  }

  const aiOnlyValue = sourceResult.value.aiOnly;
  if (aiOnlyValue !== undefined && typeof aiOnlyValue !== "boolean") {
    return invalid(route, "aiOnly must be a boolean");
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
    entityType: entityType.value,
    entityId: entityId.value,
    actorKind,
    aiOnly: aiOnlyValue as boolean | undefined,
    limit: limit.value,
    beforeAt: beforeAt.value,
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
          code: "validation",
          statusCode: 400,
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
    key: "task.create",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["task.create"],
    handle: toRouteHandler("task.create", validateCreateTaskRequest, api.createTask!),
  },
  {
    key: "task.update",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["task.update"],
    handle: toRouteHandler("task.update", validateUpdateTaskRequest, api.updateTask!),
  },
  {
    key: "task.list",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["task.list"],
    handle: toRouteHandler("task.list", validateListTasksRequest, api.listTasks!),
  },
  {
    key: "event.create",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["event.create"],
    handle: toRouteHandler(
      "event.create",
      validateCreateEventRequest,
      api.createEvent!,
    ),
  },
  {
    key: "event.update",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["event.update"],
    handle: toRouteHandler(
      "event.update",
      validateUpdateEventRequest,
      api.updateEvent!,
    ),
  },
  {
    key: "event.list",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["event.list"],
    handle: toRouteHandler("event.list", validateListEventsRequest, api.listEvents!),
  },
  {
    key: "event.listConflicts",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["event.listConflicts"],
    handle: toRouteHandler(
      "event.listConflicts",
      validateListEventConflictsRequest,
      api.listEventConflicts!,
    ),
  },
  {
    key: "project.create",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["project.create"],
    handle: toRouteHandler(
      "project.create",
      validateCreateProjectRequest,
      api.createProject!,
    ),
  },
  {
    key: "project.update",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["project.update"],
    handle: toRouteHandler(
      "project.update",
      validateUpdateProjectRequest,
      api.updateProject!,
    ),
  },
  {
    key: "project.setLifecycle",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["project.setLifecycle"],
    handle: toRouteHandler(
      "project.setLifecycle",
      validateSetProjectLifecycleRequest,
      api.setProjectLifecycle!,
    ),
  },
  {
    key: "project.list",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["project.list"],
    handle: toRouteHandler(
      "project.list",
      validateListProjectsRequest,
      api.listProjects!,
    ),
  },
  {
    key: "note.create",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["note.create"],
    handle: toRouteHandler("note.create", validateCreateNoteRequest, api.createNote!),
  },
  {
    key: "note.update",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["note.update"],
    handle: toRouteHandler("note.update", validateUpdateNoteRequest, api.updateNote!),
  },
  {
    key: "note.linkEntity",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["note.linkEntity"],
    handle: toRouteHandler(
      "note.linkEntity",
      validateLinkNoteEntityRequest,
      api.linkNoteEntity!,
    ),
  },
  {
    key: "note.unlinkEntity",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["note.unlinkEntity"],
    handle: toRouteHandler(
      "note.unlinkEntity",
      validateUnlinkNoteEntityRequest,
      api.unlinkNoteEntity!,
    ),
  },
  {
    key: "note.list",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["note.list"],
    handle: toRouteHandler("note.list", validateListNotesRequest, api.listNotes!),
  },
  {
    key: "notification.list",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["notification.list"],
    handle: toRouteHandler(
      "notification.list",
      validateListNotificationsRequest,
      api.listNotifications!,
    ),
  },
  {
    key: "notification.acknowledge",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["notification.acknowledge"],
    handle: toRouteHandler(
      "notification.acknowledge",
      validateAcknowledgeNotificationRequest,
      api.acknowledgeNotification!,
    ),
  },
  {
    key: "notification.dismiss",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["notification.dismiss"],
    handle: toRouteHandler(
      "notification.dismiss",
      validateDismissNotificationRequest,
      api.dismissNotification!,
    ),
  },
  {
    key: "search.query",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["search.query"],
    handle: toRouteHandler("search.query", validateSearchQueryRequest, api.searchQuery!),
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
    actorSource: "trusted",
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
    key: "job.list",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["job.list"],
    handle: toRouteHandler("job.list", validateListJobsRequest, api.listJobs),
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
    key: "checkpoint.inspect",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["checkpoint.inspect"],
    handle: toRouteHandler(
      "checkpoint.inspect",
      validateInspectWorkflowCheckpointRequest,
      api.inspectWorkflowCheckpoint,
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
  {
    key: "activity.list",
    method: "POST",
    path: WORKFLOW_ROUTE_PATHS["activity.list"],
    handle: toRouteHandler(
      "activity.list",
      validateListActivityRequest,
      api.listActivity,
    ),
  },
];
