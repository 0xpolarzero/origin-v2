import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { makeWorkflowApi } from "../../src/api/workflows/workflow-api";
import {
  makeWorkflowRoutes,
  WORKFLOW_ROUTE_PATHS,
} from "../../src/api/workflows/routes";
import {
  makeWorkflowHttpDispatcher,
  WorkflowHttpAuthContext,
} from "../../src/api/workflows/http-dispatch";
import { buildCorePlatform, CorePlatform } from "../../src/core/app/core-platform";
import { WorkflowRouteKey } from "../../src/api/workflows/contracts";
import { WORKFLOW_ROUTE_KEYS } from "../../src/contracts/workflow-route-keys";
import { createEvent } from "../../src/core/domain/event";
import { makeInMemoryCoreRepository } from "../../src/core/repositories/in-memory-core-repository";

const ACTOR = { id: "user-1", kind: "user" } as const;
const TRUSTED_SYSTEM_ACTOR = {
  id: "system-trusted-1",
  kind: "system",
} as const;
const TRUSTED_SIGNED_USER_ACTOR = {
  id: "signed-user-1",
  kind: "user",
} as const;

type InvalidActorKindRoute = Exclude<
  WorkflowRouteKey,
  | "approval.approveOutboundAction"
  | "task.list"
  | "event.list"
  | "event.listConflicts"
  | "project.list"
  | "note.list"
  | "notification.list"
  | "search.query"
  | "job.inspectRun"
  | "job.list"
  | "job.listHistory"
  | "checkpoint.inspect"
  | "activity.list"
>;

const INVALID_ACTOR_KIND_CASES: ReadonlyArray<{
  route: InvalidActorKindRoute;
  body: Record<string, unknown>;
}> = [
  {
    route: "capture.entry",
    body: {
      entryId: "entry-http-invalid-actor-kind-1",
      content: "Capture with invalid actor kind",
      actor: { id: "user-1", kind: "robot" },
      at: "2026-02-24T18:00:00.000Z",
    },
  },
  {
    route: "capture.suggest",
    body: {
      entryId: "entry-http-invalid-actor-kind-2",
      suggestedTitle: "Suggest task",
      actor: { id: "user-1", kind: "robot" },
      at: "2026-02-24T18:01:00.000Z",
    },
  },
  {
    route: "capture.editSuggestion",
    body: {
      entryId: "entry-http-invalid-actor-kind-3",
      suggestedTitle: "Edited suggestion",
      actor: { id: "user-1", kind: "robot" },
      at: "2026-02-24T18:02:00.000Z",
    },
  },
  {
    route: "capture.rejectSuggestion",
    body: {
      entryId: "entry-http-invalid-actor-kind-4",
      reason: "Not now",
      actor: { id: "user-1", kind: "robot" },
      at: "2026-02-24T18:03:00.000Z",
    },
  },
  {
    route: "capture.acceptAsTask",
    body: {
      entryId: "entry-http-invalid-actor-kind-5",
      taskId: "task-http-invalid-actor-kind-1",
      actor: { id: "user-1", kind: "robot" },
      at: "2026-02-24T18:04:00.000Z",
    },
  },
  {
    route: "signal.ingest",
    body: {
      signalId: "signal-http-invalid-actor-kind-1",
      source: "email",
      payload: "Signal payload",
      actor: { id: "user-1", kind: "robot" },
      at: "2026-02-24T18:05:00.000Z",
    },
  },
  {
    route: "signal.triage",
    body: {
      signalId: "signal-http-invalid-actor-kind-2",
      decision: "ready_for_conversion",
      actor: { id: "user-1", kind: "robot" },
      at: "2026-02-24T18:06:00.000Z",
    },
  },
  {
    route: "signal.convert",
    body: {
      signalId: "signal-http-invalid-actor-kind-3",
      targetType: "task",
      targetId: "task-http-invalid-actor-kind-2",
      actor: { id: "user-1", kind: "robot" },
      at: "2026-02-24T18:07:00.000Z",
    },
  },
  {
    route: "planning.completeTask",
    body: {
      taskId: "task-http-invalid-actor-kind-3",
      actor: { id: "user-1", kind: "robot" },
      at: "2026-02-24T18:08:00.000Z",
    },
  },
  {
    route: "planning.deferTask",
    body: {
      taskId: "task-http-invalid-actor-kind-4",
      until: "2026-02-25T18:09:00.000Z",
      actor: { id: "user-1", kind: "robot" },
      at: "2026-02-24T18:09:00.000Z",
    },
  },
  {
    route: "planning.rescheduleTask",
    body: {
      taskId: "task-http-invalid-actor-kind-5",
      nextAt: "2026-02-25T18:10:00.000Z",
      actor: { id: "user-1", kind: "robot" },
      at: "2026-02-24T18:10:00.000Z",
    },
  },
  {
    route: "task.create",
    body: {
      taskId: "task-http-invalid-actor-kind-6",
      title: "Create task invalid actor kind",
      actor: { id: "user-1", kind: "robot" },
      at: "2026-02-24T18:10:30.000Z",
    },
  },
  {
    route: "task.update",
    body: {
      taskId: "task-http-invalid-actor-kind-7",
      title: "Update task invalid actor kind",
      actor: { id: "user-1", kind: "robot" },
      at: "2026-02-24T18:10:40.000Z",
    },
  },
  {
    route: "event.create",
    body: {
      eventId: "event-http-invalid-actor-kind-2",
      title: "Create event invalid actor kind",
      startAt: "2026-02-25T18:10:50.000Z",
      actor: { id: "user-1", kind: "robot" },
      at: "2026-02-24T18:10:50.000Z",
    },
  },
  {
    route: "event.update",
    body: {
      eventId: "event-http-invalid-actor-kind-3",
      title: "Update event invalid actor kind",
      actor: { id: "user-1", kind: "robot" },
      at: "2026-02-24T18:10:55.000Z",
    },
  },
  {
    route: "project.create",
    body: {
      projectId: "project-http-invalid-actor-kind-1",
      name: "Create project invalid actor kind",
      actor: { id: "user-1", kind: "robot" },
      at: "2026-02-24T18:11:00.000Z",
    },
  },
  {
    route: "project.update",
    body: {
      projectId: "project-http-invalid-actor-kind-2",
      name: "Update project invalid actor kind",
      actor: { id: "user-1", kind: "robot" },
      at: "2026-02-24T18:11:05.000Z",
    },
  },
  {
    route: "project.setLifecycle",
    body: {
      projectId: "project-http-invalid-actor-kind-3",
      lifecycle: "paused",
      actor: { id: "user-1", kind: "robot" },
      at: "2026-02-24T18:11:10.000Z",
    },
  },
  {
    route: "note.create",
    body: {
      noteId: "note-http-invalid-actor-kind-1",
      body: "Create note invalid actor kind",
      actor: { id: "user-1", kind: "robot" },
      at: "2026-02-24T18:11:15.000Z",
    },
  },
  {
    route: "note.update",
    body: {
      noteId: "note-http-invalid-actor-kind-2",
      body: "Update note invalid actor kind",
      actor: { id: "user-1", kind: "robot" },
      at: "2026-02-24T18:11:20.000Z",
    },
  },
  {
    route: "note.linkEntity",
    body: {
      noteId: "note-http-invalid-actor-kind-3",
      entityRef: "task:task-http-invalid-actor-kind-1",
      actor: { id: "user-1", kind: "robot" },
      at: "2026-02-24T18:11:25.000Z",
    },
  },
  {
    route: "note.unlinkEntity",
    body: {
      noteId: "note-http-invalid-actor-kind-4",
      entityRef: "task:task-http-invalid-actor-kind-1",
      actor: { id: "user-1", kind: "robot" },
      at: "2026-02-24T18:11:30.000Z",
    },
  },
  {
    route: "notification.acknowledge",
    body: {
      notificationId: "notification-http-invalid-actor-kind-1",
      actor: { id: "user-1", kind: "robot" },
      at: "2026-02-24T18:11:35.000Z",
    },
  },
  {
    route: "notification.dismiss",
    body: {
      notificationId: "notification-http-invalid-actor-kind-2",
      actor: { id: "user-1", kind: "robot" },
      at: "2026-02-24T18:11:40.000Z",
    },
  },
  {
    route: "approval.requestEventSync",
    body: {
      eventId: "event-http-invalid-actor-kind-1",
      actor: { id: "user-1", kind: "robot" },
      at: "2026-02-24T18:11:00.000Z",
    },
  },
  {
    route: "approval.requestOutboundDraftExecution",
    body: {
      draftId: "outbound-draft-http-invalid-actor-kind-1",
      actor: { id: "user-1", kind: "robot" },
      at: "2026-02-24T18:12:00.000Z",
    },
  },
  {
    route: "job.create",
    body: {
      jobId: "job-http-invalid-actor-kind-1",
      name: "Create job invalid actor kind",
      actor: { id: "system-1", kind: "robot" },
      at: "2026-02-24T18:13:00.000Z",
    },
  },
  {
    route: "job.recordRun",
    body: {
      jobId: "job-http-invalid-actor-kind-2",
      outcome: "failed",
      diagnostics: "timeout",
      actor: { id: "system-1", kind: "robot" },
      at: "2026-02-24T18:14:00.000Z",
    },
  },
  {
    route: "job.retry",
    body: {
      jobId: "job-http-invalid-actor-kind-3",
      actor: { id: "user-1", kind: "robot" },
      at: "2026-02-24T18:15:00.000Z",
    },
  },
  {
    route: "checkpoint.create",
    body: {
      checkpointId: "checkpoint-http-invalid-actor-kind-1",
      name: "Before invalid actor kind",
      snapshotEntityRefs: [
        { entityType: "task", entityId: "task-http-invalid-actor-kind-6" },
      ],
      auditCursor: 1,
      rollbackTarget: "audit-invalid-actor-kind-1",
      actor: { id: "user-1", kind: "robot" },
      at: "2026-02-24T18:16:00.000Z",
    },
  },
  {
    route: "checkpoint.keep",
    body: {
      checkpointId: "checkpoint-http-invalid-actor-kind-2",
      actor: { id: "user-1", kind: "robot" },
      at: "2026-02-24T18:17:00.000Z",
    },
  },
  {
    route: "checkpoint.recover",
    body: {
      checkpointId: "checkpoint-http-invalid-actor-kind-3",
      actor: { id: "user-1", kind: "robot" },
      at: "2026-02-24T18:18:00.000Z",
    },
  },
];

const expectOk = async (
  dispatch: ReturnType<typeof makeWorkflowHttpDispatcher>,
  route: WorkflowRouteKey,
  body: unknown,
): Promise<unknown> => {
  const response = await Effect.runPromise(
    dispatch({
      method: "POST",
      path: WORKFLOW_ROUTE_PATHS[route],
      body,
    }),
  );

  expect(response.status).toBe(200);
  return response.body;
};

const expectSanitizedError = (
  response: { status: number; body: unknown },
  expected: {
    status: number;
    route: WorkflowRouteKey;
    messageIncludes?: string;
  },
): void => {
  expect(response.status).toBe(expected.status);
  expect(response.body).toEqual(
    expect.objectContaining({
      error: "workflow request failed",
      route: expected.route,
    }),
  );
  expect(response.body).not.toHaveProperty("_tag");
  expect(response.body).not.toHaveProperty("cause");
  if (expected.messageIncludes) {
    expect((response.body as { message: string }).message).toContain(
      expected.messageIncludes,
    );
  }
};

const expectInvalidActorKind400 = async (
  dispatch: ReturnType<typeof makeWorkflowHttpDispatcher>,
  route: InvalidActorKindRoute,
  body: Record<string, unknown>,
): Promise<void> => {
  const response = await Effect.runPromise(
    dispatch({
      method: "POST",
      path: WORKFLOW_ROUTE_PATHS[route],
      body,
    }),
  );

  expectSanitizedError(response, {
    status: 400,
    route,
    messageIncludes: "actor.kind",
  });
};

const expectInvalidActivityList400 = async (
  dispatch: ReturnType<typeof makeWorkflowHttpDispatcher>,
  body: Record<string, unknown>,
  messageIncludes: string,
): Promise<void> => {
  const response = await Effect.runPromise(
    dispatch({
      method: "POST",
      path: WORKFLOW_ROUTE_PATHS["activity.list"],
      body,
    }),
  );

  expectSanitizedError(response, {
    status: 400,
    route: "activity.list",
    messageIncludes,
  });
};

interface IntegrationWorkflowNegativeCase {
  route: WorkflowRouteKey;
  expectedStatus: 400 | 403 | 404 | 409;
  body?: Record<string, unknown>;
  auth?: WorkflowHttpAuthContext;
  setup?: (ctx: {
    dispatch: ReturnType<typeof makeWorkflowHttpDispatcher>;
    platform: CorePlatform;
  }) => Promise<void>;
  messageIncludes?: string;
}

const postWorkflowRoute = async (
  dispatch: ReturnType<typeof makeWorkflowHttpDispatcher>,
  route: WorkflowRouteKey,
  body?: unknown,
  auth?: WorkflowHttpAuthContext,
): Promise<{ status: number; body: unknown }> =>
  Effect.runPromise(
    dispatch({
      method: "POST",
      path: WORKFLOW_ROUTE_PATHS[route],
      body,
      auth,
    }),
  );

const assertRouteNegativeCase = async (
  dispatch: ReturnType<typeof makeWorkflowHttpDispatcher>,
  routeCase: IntegrationWorkflowNegativeCase,
): Promise<void> => {
  const response = await postWorkflowRoute(
    dispatch,
    routeCase.route,
    routeCase.body,
    routeCase.auth,
  );

  expectSanitizedError(response, {
    status: routeCase.expectedStatus,
    route: routeCase.route,
    messageIncludes: routeCase.messageIncludes,
  });
};

const seedPendingApprovalEvent = async (
  dispatch: ReturnType<typeof makeWorkflowHttpDispatcher>,
  ids: { signalId: string; eventId: string },
): Promise<void> => {
  await expectOk(dispatch, "signal.ingest", {
    signalId: ids.signalId,
    source: "email",
    payload: "Seed event pending approval",
    actor: ACTOR,
    at: "2026-02-26T10:00:00.000Z",
  });
  await expectOk(dispatch, "signal.triage", {
    signalId: ids.signalId,
    decision: "ready_for_conversion",
    actor: ACTOR,
    at: "2026-02-26T10:01:00.000Z",
  });
  await expectOk(dispatch, "signal.convert", {
    signalId: ids.signalId,
    targetType: "event",
    targetId: ids.eventId,
    actor: ACTOR,
    at: "2026-02-26T10:02:00.000Z",
  });
  await expectOk(dispatch, "approval.requestEventSync", {
    eventId: ids.eventId,
    actor: ACTOR,
    at: "2026-02-26T10:03:00.000Z",
  });
};

const seedPendingApprovalDraft = async (
  dispatch: ReturnType<typeof makeWorkflowHttpDispatcher>,
  ids: { signalId: string; draftId: string },
): Promise<void> => {
  await expectOk(dispatch, "signal.ingest", {
    signalId: ids.signalId,
    source: "email",
    payload: "Seed draft pending approval",
    actor: ACTOR,
    at: "2026-02-26T10:10:00.000Z",
  });
  await expectOk(dispatch, "signal.triage", {
    signalId: ids.signalId,
    decision: "requires_outbound",
    actor: ACTOR,
    at: "2026-02-26T10:11:00.000Z",
  });
  await expectOk(dispatch, "signal.convert", {
    signalId: ids.signalId,
    targetType: "outbound_draft",
    targetId: ids.draftId,
    actor: ACTOR,
    at: "2026-02-26T10:12:00.000Z",
  });
  await expectOk(dispatch, "approval.requestOutboundDraftExecution", {
    draftId: ids.draftId,
    actor: ACTOR,
    at: "2026-02-26T10:13:00.000Z",
  });
};

const INTEGRATION_NEGATIVE_CASES: ReadonlyArray<IntegrationWorkflowNegativeCase> = [
  {
    route: "capture.entry",
    expectedStatus: 400,
    body: {
      entryId: "entry-http-negative-1",
      content: "   ",
      actor: ACTOR,
      at: "2026-02-26T11:00:00.000Z",
    },
    messageIncludes: "content",
  },
  {
    route: "capture.suggest",
    expectedStatus: 404,
    body: {
      entryId: "entry-http-negative-missing-1",
      suggestedTitle: "Missing entry suggestion",
      actor: ACTOR,
      at: "2026-02-26T11:01:00.000Z",
    },
    messageIncludes: "was not found",
  },
  {
    route: "capture.editSuggestion",
    expectedStatus: 404,
    body: {
      entryId: "entry-http-negative-missing-2",
      suggestedTitle: "Missing entry edit",
      actor: ACTOR,
      at: "2026-02-26T11:02:00.000Z",
    },
    messageIncludes: "was not found",
  },
  {
    route: "capture.rejectSuggestion",
    expectedStatus: 404,
    body: {
      entryId: "entry-http-negative-missing-3",
      reason: "No longer needed",
      actor: ACTOR,
      at: "2026-02-26T11:03:00.000Z",
    },
    messageIncludes: "was not found",
  },
  {
    route: "capture.acceptAsTask",
    expectedStatus: 404,
    body: {
      entryId: "entry-http-negative-missing-4",
      actor: ACTOR,
      at: "2026-02-26T11:04:00.000Z",
    },
    messageIncludes: "was not found",
  },
  {
    route: "signal.ingest",
    expectedStatus: 400,
    body: {
      signalId: "signal-http-negative-1",
      source: "email",
      payload: "   ",
      actor: ACTOR,
      at: "2026-02-26T11:05:00.000Z",
    },
    messageIncludes: "payload",
  },
  {
    route: "signal.triage",
    expectedStatus: 404,
    body: {
      signalId: "signal-http-negative-missing-1",
      decision: "ready_for_conversion",
      actor: ACTOR,
      at: "2026-02-26T11:06:00.000Z",
    },
    messageIncludes: "was not found",
  },
  {
    route: "signal.convert",
    expectedStatus: 409,
    setup: async ({ dispatch }) => {
      await expectOk(dispatch, "signal.ingest", {
        signalId: "signal-http-negative-untriaged-1",
        source: "email",
        payload: "Need conversion precondition",
        actor: ACTOR,
        at: "2026-02-26T11:07:00.000Z",
      });
    },
    body: {
      signalId: "signal-http-negative-untriaged-1",
      targetType: "task",
      targetId: "task-http-negative-convert-1",
      actor: ACTOR,
      at: "2026-02-26T11:08:00.000Z",
    },
    messageIncludes: "must be triaged",
  },
  {
    route: "planning.completeTask",
    expectedStatus: 404,
    body: {
      taskId: "task-http-negative-missing-1",
      actor: ACTOR,
      at: "2026-02-26T11:09:00.000Z",
    },
    messageIncludes: "was not found",
  },
  {
    route: "planning.deferTask",
    expectedStatus: 404,
    body: {
      taskId: "task-http-negative-missing-2",
      until: "2026-02-27T11:10:00.000Z",
      actor: ACTOR,
      at: "2026-02-26T11:10:00.000Z",
    },
    messageIncludes: "was not found",
  },
  {
    route: "planning.rescheduleTask",
    expectedStatus: 404,
    body: {
      taskId: "task-http-negative-missing-3",
      nextAt: "2026-02-27T11:11:00.000Z",
      actor: ACTOR,
      at: "2026-02-26T11:11:00.000Z",
    },
    messageIncludes: "was not found",
  },
  {
    route: "task.create",
    expectedStatus: 400,
    body: {
      taskId: "task-http-negative-1",
      title: "   ",
      actor: ACTOR,
      at: "2026-02-26T11:11:20.000Z",
    },
    messageIncludes: "title",
  },
  {
    route: "task.update",
    expectedStatus: 404,
    body: {
      taskId: "task-http-negative-missing-4",
      title: "Update missing task",
      actor: ACTOR,
      at: "2026-02-26T11:11:30.000Z",
    },
    messageIncludes: "was not found",
  },
  {
    route: "task.list",
    expectedStatus: 400,
    body: {
      status: "unknown",
    },
    messageIncludes: "status",
  },
  {
    route: "event.create",
    expectedStatus: 400,
    body: {
      eventId: "event-http-negative-1",
      title: "Missing startAt event",
      actor: ACTOR,
      at: "2026-02-26T11:11:40.000Z",
    },
    messageIncludes: "startAt",
  },
  {
    route: "event.update",
    expectedStatus: 404,
    body: {
      eventId: "event-http-negative-missing-1",
      title: "Update missing event",
      actor: ACTOR,
      at: "2026-02-26T11:11:50.000Z",
    },
    messageIncludes: "was not found",
  },
  {
    route: "event.list",
    expectedStatus: 400,
    body: {
      syncState: "unknown",
    },
    messageIncludes: "syncState",
  },
  {
    route: "event.listConflicts",
    expectedStatus: 400,
    body: {
      eventId: "   ",
    },
    messageIncludes: "eventId",
  },
  {
    route: "project.create",
    expectedStatus: 400,
    body: {
      projectId: "project-http-negative-1",
      name: "   ",
      actor: ACTOR,
      at: "2026-02-26T11:12:00.000Z",
    },
    messageIncludes: "name",
  },
  {
    route: "project.update",
    expectedStatus: 404,
    body: {
      projectId: "project-http-negative-missing-1",
      name: "Update missing project",
      actor: ACTOR,
      at: "2026-02-26T11:12:10.000Z",
    },
    messageIncludes: "was not found",
  },
  {
    route: "project.setLifecycle",
    expectedStatus: 400,
    body: {
      projectId: "project-http-negative-2",
      lifecycle: "archived",
      actor: ACTOR,
      at: "2026-02-26T11:12:20.000Z",
    },
    messageIncludes: "lifecycle",
  },
  {
    route: "project.list",
    expectedStatus: 400,
    body: {
      lifecycle: "archived",
    },
    messageIncludes: "lifecycle",
  },
  {
    route: "note.create",
    expectedStatus: 400,
    body: {
      noteId: "note-http-negative-1",
      body: "   ",
      actor: ACTOR,
      at: "2026-02-26T11:12:30.000Z",
    },
    messageIncludes: "body",
  },
  {
    route: "note.update",
    expectedStatus: 404,
    body: {
      noteId: "note-http-negative-missing-1",
      body: "Update missing note",
      actor: ACTOR,
      at: "2026-02-26T11:12:40.000Z",
    },
    messageIncludes: "was not found",
  },
  {
    route: "note.linkEntity",
    expectedStatus: 404,
    body: {
      noteId: "note-http-negative-missing-2",
      entityRef: "task:task-http-negative-1",
      actor: ACTOR,
      at: "2026-02-26T11:12:50.000Z",
    },
    messageIncludes: "was not found",
  },
  {
    route: "note.unlinkEntity",
    expectedStatus: 404,
    body: {
      noteId: "note-http-negative-missing-3",
      entityRef: "task:task-http-negative-1",
      actor: ACTOR,
      at: "2026-02-26T11:13:00.000Z",
    },
    messageIncludes: "was not found",
  },
  {
    route: "note.list",
    expectedStatus: 400,
    body: {
      entityRef: "   ",
    },
    messageIncludes: "entityRef",
  },
  {
    route: "notification.list",
    expectedStatus: 400,
    body: {
      status: "unknown",
    },
    messageIncludes: "status",
  },
  {
    route: "notification.acknowledge",
    expectedStatus: 404,
    body: {
      notificationId: "notification-http-negative-missing-1",
      actor: ACTOR,
      at: "2026-02-26T11:13:10.000Z",
    },
    messageIncludes: "was not found",
  },
  {
    route: "notification.dismiss",
    expectedStatus: 404,
    body: {
      notificationId: "notification-http-negative-missing-2",
      actor: ACTOR,
      at: "2026-02-26T11:13:20.000Z",
    },
    messageIncludes: "was not found",
  },
  {
    route: "search.query",
    expectedStatus: 400,
    body: {
      query: "   ",
      entityTypes: ["task"],
      limit: 5,
    },
    messageIncludes: "query",
  },
  {
    route: "approval.requestEventSync",
    expectedStatus: 409,
    setup: async ({ dispatch }) => {
      await seedPendingApprovalEvent(dispatch, {
        signalId: "signal-http-negative-event-sync-1",
        eventId: "event-http-negative-event-sync-1",
      });
    },
    body: {
      eventId: "event-http-negative-event-sync-1",
      actor: ACTOR,
      at: "2026-02-26T11:12:00.000Z",
    },
    messageIncludes: "must be local_only",
  },
  {
    route: "approval.requestOutboundDraftExecution",
    expectedStatus: 409,
    setup: async ({ dispatch }) => {
      await seedPendingApprovalDraft(dispatch, {
        signalId: "signal-http-negative-draft-exec-1",
        draftId: "outbound-draft-http-negative-draft-exec-1",
      });
    },
    body: {
      draftId: "outbound-draft-http-negative-draft-exec-1",
      actor: ACTOR,
      at: "2026-02-26T11:13:00.000Z",
    },
    messageIncludes: "must be in draft before requesting approval",
  },
  {
    route: "approval.approveOutboundAction",
    expectedStatus: 403,
    setup: async ({ dispatch }) => {
      await seedPendingApprovalEvent(dispatch, {
        signalId: "signal-http-negative-approve-1",
        eventId: "event-http-negative-approve-1",
      });
    },
    body: {
      actionType: "event_sync",
      entityType: "event",
      entityId: "event-http-negative-approve-1",
      approved: true,
      at: "2026-02-26T11:14:00.000Z",
    },
    auth: {
      sessionActor: TRUSTED_SYSTEM_ACTOR,
    },
    messageIncludes: "only user actors",
  },
  {
    route: "job.create",
    expectedStatus: 400,
    body: {
      jobId: "job-http-negative-1",
      name: "   ",
      actor: { id: "system-1", kind: "system" },
      at: "2026-02-26T11:15:00.000Z",
    },
    messageIncludes: "name",
  },
  {
    route: "job.recordRun",
    expectedStatus: 404,
    body: {
      jobId: "job-http-negative-missing-1",
      outcome: "failed",
      diagnostics: "timeout",
      actor: { id: "system-1", kind: "system" },
      at: "2026-02-26T11:16:00.000Z",
    },
    messageIncludes: "was not found",
  },
  {
    route: "job.inspectRun",
    expectedStatus: 404,
    body: {
      jobId: "job-http-negative-missing-2",
    },
    messageIncludes: "was not found",
  },
  {
    route: "job.list",
    expectedStatus: 400,
    body: {
      limit: 0,
    },
    messageIncludes: "positive integer",
  },
  {
    route: "job.listHistory",
    expectedStatus: 404,
    body: {
      jobId: "job-http-negative-missing-3",
    },
    messageIncludes: "was not found",
  },
  {
    route: "job.retry",
    expectedStatus: 409,
    setup: async ({ dispatch }) => {
      await expectOk(dispatch, "job.create", {
        jobId: "job-http-negative-retry-1",
        name: "Retry negative case",
        actor: { id: "system-1", kind: "system" },
        at: "2026-02-26T11:17:00.000Z",
      });
    },
    body: {
      jobId: "job-http-negative-retry-1",
      actor: ACTOR,
      at: "2026-02-26T11:18:00.000Z",
    },
    messageIncludes: "must be in failed state before retry",
  },
  {
    route: "checkpoint.create",
    expectedStatus: 400,
    body: {
      checkpointId: "checkpoint-http-negative-1",
      name: "Invalid checkpoint",
      snapshotEntityRefs: [],
      auditCursor: 1,
      rollbackTarget: "   ",
      actor: ACTOR,
      at: "2026-02-26T11:19:00.000Z",
    },
    messageIncludes: "rollbackTarget",
  },
  {
    route: "checkpoint.inspect",
    expectedStatus: 404,
    body: {
      checkpointId: "checkpoint-http-negative-missing-1",
    },
    messageIncludes: "was not found",
  },
  {
    route: "checkpoint.keep",
    expectedStatus: 409,
    setup: async ({ dispatch }) => {
      await expectOk(dispatch, "checkpoint.create", {
        checkpointId: "checkpoint-http-negative-keep-1",
        name: "Checkpoint keep conflict",
        snapshotEntityRefs: [],
        auditCursor: 1,
        rollbackTarget: "audit-negative-1",
        actor: ACTOR,
        at: "2026-02-26T11:20:00.000Z",
      });
      await expectOk(dispatch, "checkpoint.recover", {
        checkpointId: "checkpoint-http-negative-keep-1",
        actor: ACTOR,
        at: "2026-02-26T11:21:00.000Z",
      });
    },
    body: {
      checkpointId: "checkpoint-http-negative-keep-1",
      actor: ACTOR,
      at: "2026-02-26T11:22:00.000Z",
    },
    messageIncludes: "cannot transition recovered -> kept",
  },
  {
    route: "checkpoint.recover",
    expectedStatus: 409,
    setup: async ({ dispatch }) => {
      await expectOk(dispatch, "checkpoint.create", {
        checkpointId: "checkpoint-http-negative-recover-1",
        name: "Checkpoint recover conflict",
        snapshotEntityRefs: [],
        auditCursor: 1,
        rollbackTarget: "audit-negative-2",
        actor: ACTOR,
        at: "2026-02-26T11:23:00.000Z",
      });
      await expectOk(dispatch, "checkpoint.recover", {
        checkpointId: "checkpoint-http-negative-recover-1",
        actor: ACTOR,
        at: "2026-02-26T11:24:00.000Z",
      });
    },
    body: {
      checkpointId: "checkpoint-http-negative-recover-1",
      actor: ACTOR,
      at: "2026-02-26T11:25:00.000Z",
    },
    messageIncludes: "cannot transition recovered -> recovered",
  },
  {
    route: "activity.list",
    expectedStatus: 400,
    body: {
      actorKind: "robot",
      limit: 10,
      beforeAt: "2026-02-26T11:26:00.000Z",
    },
    messageIncludes: "actorKind must be one of",
  },
];
describe("workflow-api http integration", () => {
  test("dispatcher returns 404 for unknown route path and 405 for unsupported method", async () => {
    const platform = await Effect.runPromise(buildCorePlatform());
    const dispatcher = makeWorkflowHttpDispatcher(
      makeWorkflowRoutes(makeWorkflowApi({ platform })),
    );

    const unknownPath = "/api/workflows/unknown/route";
    const notFound = await Effect.runPromise(
      dispatcher({
        method: "POST",
        path: unknownPath,
        body: { ignored: true },
      }),
    );
    const methodNotAllowed = await Effect.runPromise(
      dispatcher({
        method: "GET",
        path: WORKFLOW_ROUTE_PATHS["capture.entry"],
        body: {},
      }),
    );

    expect(notFound).toEqual({
      status: 404,
      body: {
        error: "workflow route not found",
        path: unknownPath,
      },
    });
    expect(methodNotAllowed).toEqual({
      status: 405,
      body: {
        error: "method not allowed",
        method: "GET",
        path: WORKFLOW_ROUTE_PATHS["capture.entry"],
      },
    });
  });

  test("capture/triage/retry/recovery workflows execute through JSON HTTP dispatcher", async () => {
    const platform = await Effect.runPromise(buildCorePlatform());
    const dispatcher = makeWorkflowHttpDispatcher(
      makeWorkflowRoutes(makeWorkflowApi({ platform })),
    );

    await expectOk(dispatcher, "capture.entry", {
      entryId: "entry-http-flow-1",
      content: "Capture via HTTP dispatcher",
      actor: ACTOR,
      at: "2026-02-23T09:00:00.000Z",
    });

    await expectOk(dispatcher, "signal.ingest", {
      signalId: "signal-http-flow-1",
      source: "email",
      payload: "Handle triage from HTTP",
      actor: ACTOR,
      at: "2026-02-23T09:01:00.000Z",
    });
    await expectOk(dispatcher, "signal.triage", {
      signalId: "signal-http-flow-1",
      decision: "ready_for_conversion",
      actor: ACTOR,
      at: "2026-02-23T09:02:00.000Z",
    });

    await expectOk(dispatcher, "job.create", {
      jobId: "job-http-flow-1",
      name: "Dispatcher job",
      actor: { id: "system-1", kind: "system" },
      at: "2026-02-23T09:03:00.000Z",
    });
    await expectOk(dispatcher, "job.recordRun", {
      jobId: "job-http-flow-1",
      outcome: "failed",
      diagnostics: "Timeout",
      actor: { id: "system-1", kind: "system" },
      at: "2026-02-23T09:04:00.000Z",
    });
    await expectOk(dispatcher, "job.retry", {
      jobId: "job-http-flow-1",
      actor: ACTOR,
      at: "2026-02-23T09:05:00.000Z",
    });

    await expectOk(dispatcher, "checkpoint.create", {
      checkpointId: "checkpoint-http-flow-1",
      name: "Before HTTP recovery",
      snapshotEntityRefs: [
        { entityType: "entry", entityId: "entry-http-flow-1" },
      ],
      auditCursor: 3,
      rollbackTarget: "audit-http-3",
      actor: ACTOR,
      at: "2026-02-23T09:06:00.000Z",
    });
    await expectOk(dispatcher, "checkpoint.recover", {
      checkpointId: "checkpoint-http-flow-1",
      actor: ACTOR,
      at: "2026-02-23T09:07:00.000Z",
    });

    const entry = await Effect.runPromise(
      platform.getEntity<{ status: string }>("entry", "entry-http-flow-1"),
    );
    const signal = await Effect.runPromise(
      platform.getEntity<{ triageState: string }>(
        "signal",
        "signal-http-flow-1",
      ),
    );
    const inspection = await Effect.runPromise(
      platform.inspectJobRun("job-http-flow-1"),
    );
    const checkpoint = await Effect.runPromise(
      platform.getEntity<{ status: string }>(
        "checkpoint",
        "checkpoint-http-flow-1",
      ),
    );

    expect(entry?.status).toBe("captured");
    expect(signal?.triageState).toBe("triaged");
    expect(inspection.runState).toBe("retrying");
    expect(inspection.retryCount).toBe(1);
    expect(checkpoint?.status).toBe("recovered");
  });

  test("capture.entry and signal.ingest return sanitized 400s for whitespace-only required fields", async () => {
    const platform = await Effect.runPromise(buildCorePlatform());
    const dispatcher = makeWorkflowHttpDispatcher(
      makeWorkflowRoutes(makeWorkflowApi({ platform })),
    );

    const captureInvalid = await Effect.runPromise(
      dispatcher({
        method: "POST",
        path: WORKFLOW_ROUTE_PATHS["capture.entry"],
        body: {
          entryId: "entry-http-invalid-1",
          content: "   ",
          actor: ACTOR,
          at: "2026-02-23T09:20:00.000Z",
        },
      }),
    );
    const signalInvalid = await Effect.runPromise(
      dispatcher({
        method: "POST",
        path: WORKFLOW_ROUTE_PATHS["signal.ingest"],
        body: {
          signalId: "signal-http-invalid-1",
          source: "email",
          payload: "   ",
          actor: ACTOR,
          at: "2026-02-23T09:21:00.000Z",
        },
      }),
    );

    expectSanitizedError(captureInvalid, {
      status: 400,
      route: "capture.entry",
      messageIncludes: "content",
    });
    expectSanitizedError(signalInvalid, {
      status: 400,
      route: "signal.ingest",
      messageIncludes: "payload",
    });
  });

  for (const testCase of INVALID_ACTOR_KIND_CASES) {
    test(`${testCase.route} returns sanitized 400 for invalid actor.kind`, async () => {
      const platform = await Effect.runPromise(buildCorePlatform());
      const dispatcher = makeWorkflowHttpDispatcher(
        makeWorkflowRoutes(makeWorkflowApi({ platform })),
      );

      await expectInvalidActorKind400(
        dispatcher,
        testCase.route,
        testCase.body,
      );
    });
  }

  test("list routes accept omitted JSON bodies", async () => {
    const platform = await Effect.runPromise(buildCorePlatform());
    const dispatcher = makeWorkflowHttpDispatcher(
      makeWorkflowRoutes(makeWorkflowApi({ platform })),
    );

    const routes: ReadonlyArray<WorkflowRouteKey> = [
      "task.list",
      "event.list",
      "event.listConflicts",
      "project.list",
      "note.list",
      "notification.list",
      "job.list",
      "activity.list",
    ];

    for (const route of routes) {
      const response = await Effect.runPromise(
        dispatcher({
          method: "POST",
          path: WORKFLOW_ROUTE_PATHS[route],
        }),
      );

      expect(response).toEqual({
        status: 200,
        body: [],
      });
    }
  });

  test("activity.list returns sanitized 400 for non-boolean aiOnly", async () => {
    const platform = await Effect.runPromise(buildCorePlatform());
    const dispatcher = makeWorkflowHttpDispatcher(
      makeWorkflowRoutes(makeWorkflowApi({ platform })),
    );

    await expectInvalidActivityList400(
      dispatcher,
      {
        entityType: "checkpoint",
        entityId: "checkpoint-http-invalid-activity-aiOnly-1",
        aiOnly: "true",
        limit: 10,
        beforeAt: "2026-02-23T12:00:00.000Z",
      },
      "aiOnly",
    );
  });

  test("activity.list returns sanitized 400 for unsupported actorKind", async () => {
    const platform = await Effect.runPromise(buildCorePlatform());
    const dispatcher = makeWorkflowHttpDispatcher(
      makeWorkflowRoutes(makeWorkflowApi({ platform })),
    );

    await expectInvalidActivityList400(
      dispatcher,
      {
        entityType: "checkpoint",
        entityId: "checkpoint-http-invalid-activity-actorKind-1",
        actorKind: "robot",
        aiOnly: true,
        limit: 10,
        beforeAt: "2026-02-23T12:00:00.000Z",
      },
      "actorKind",
    );
  });

  test("activity.list returns sanitized 400 for non-positive limit", async () => {
    const platform = await Effect.runPromise(buildCorePlatform());
    const dispatcher = makeWorkflowHttpDispatcher(
      makeWorkflowRoutes(makeWorkflowApi({ platform })),
    );

    await expectInvalidActivityList400(
      dispatcher,
      {
        entityType: "checkpoint",
        entityId: "checkpoint-http-invalid-activity-limit-1",
        actorKind: "ai",
        aiOnly: true,
        limit: 0,
        beforeAt: "2026-02-23T12:00:00.000Z",
      },
      "limit",
    );
  });

  test("activity.list returns sanitized 400 for malformed beforeAt", async () => {
    const platform = await Effect.runPromise(buildCorePlatform());
    const dispatcher = makeWorkflowHttpDispatcher(
      makeWorkflowRoutes(makeWorkflowApi({ platform })),
    );

    await expectInvalidActivityList400(
      dispatcher,
      {
        entityType: "checkpoint",
        entityId: "checkpoint-http-invalid-activity-beforeAt-1",
        actorKind: "ai",
        aiOnly: true,
        limit: 10,
        beforeAt: "not-a-date",
      },
      "beforeAt",
    );
  });

  test("checkpoint.create(ai) -> activity.list(aiOnly) -> checkpoint.inspect -> keep/recover executes through HTTP routes", async () => {
    const platform = await Effect.runPromise(buildCorePlatform());
    const dispatcher = makeWorkflowHttpDispatcher(
      makeWorkflowRoutes(makeWorkflowApi({ platform })),
    );

    await expectOk(dispatcher, "checkpoint.create", {
      checkpointId: "checkpoint-http-ai-flow-1",
      name: "Before AI rewrite",
      snapshotEntityRefs: [],
      auditCursor: 7,
      rollbackTarget: "audit-7",
      actor: { id: "ai-1", kind: "ai" },
      at: "2026-02-23T10:40:00.000Z",
    });

    const activityBody = (await expectOk(dispatcher, "activity.list", {
      entityType: "checkpoint",
      entityId: "checkpoint-http-ai-flow-1",
      aiOnly: true,
      beforeAt: "2026-02-23T12:00:00.000Z",
      limit: 10,
    })) as ReadonlyArray<{
      entityId: string;
      actor: { kind: string };
      toState: string;
    }>;

    const inspected = (await expectOk(dispatcher, "checkpoint.inspect", {
      checkpointId: "checkpoint-http-ai-flow-1",
    })) as {
      id: string;
      status: string;
    };

    await expectOk(dispatcher, "checkpoint.keep", {
      checkpointId: "checkpoint-http-ai-flow-1",
      actor: ACTOR,
      at: "2026-02-23T10:41:00.000Z",
    });
    await expectOk(dispatcher, "checkpoint.recover", {
      checkpointId: "checkpoint-http-ai-flow-1",
      actor: ACTOR,
      at: "2026-02-23T10:42:00.000Z",
    });

    const persisted = await Effect.runPromise(
      platform.getEntity<{ status: string }>(
        "checkpoint",
        "checkpoint-http-ai-flow-1",
      ),
    );

    expect(inspected).toMatchObject({
      id: "checkpoint-http-ai-flow-1",
      status: "created",
    });
    expect(activityBody.some((item) => item.actor.kind === "ai")).toBe(true);
    expect(
      activityBody.some(
        (item) =>
          item.entityId === "checkpoint-http-ai-flow-1" &&
          item.toState === "created",
      ),
    ).toBe(true);
    expect(persisted?.status).toBe("recovered");
  });

  test("job.retry and checkpoint routes return sanitized 404s for missing resources", async () => {
    const platform = await Effect.runPromise(buildCorePlatform());
    const dispatcher = makeWorkflowHttpDispatcher(
      makeWorkflowRoutes(makeWorkflowApi({ platform })),
    );

    const missingJob = await Effect.runPromise(
      dispatcher({
        method: "POST",
        path: WORKFLOW_ROUTE_PATHS["job.retry"],
        body: {
          jobId: "job-http-missing-404",
          actor: ACTOR,
          at: "2026-02-23T09:22:00.000Z",
        },
      }),
    );
    const missingCheckpoint = await Effect.runPromise(
      dispatcher({
        method: "POST",
        path: WORKFLOW_ROUTE_PATHS["checkpoint.keep"],
        body: {
          checkpointId: "checkpoint-http-missing-404",
          actor: ACTOR,
          at: "2026-02-23T09:23:00.000Z",
        },
      }),
    );
    const missingCheckpointRecovery = await Effect.runPromise(
      dispatcher({
        method: "POST",
        path: WORKFLOW_ROUTE_PATHS["checkpoint.recover"],
        body: {
          checkpointId: "checkpoint-http-missing-404",
          actor: ACTOR,
          at: "2026-02-23T09:24:00.000Z",
        },
      }),
    );

    expectSanitizedError(missingJob, {
      status: 404,
      route: "job.retry",
    });
    expectSanitizedError(missingCheckpoint, {
      status: 404,
      route: "checkpoint.keep",
    });
    expectSanitizedError(missingCheckpointRecovery, {
      status: 404,
      route: "checkpoint.recover",
    });
  });

  test("capture.suggest/capture.acceptAsTask/planning.completeTask/signal.triage map missing resources to 404 and signal.convert precondition to 409", async () => {
    const platform = await Effect.runPromise(buildCorePlatform());
    const dispatcher = makeWorkflowHttpDispatcher(
      makeWorkflowRoutes(makeWorkflowApi({ platform })),
    );

    const missingSuggestedEntry = await Effect.runPromise(
      dispatcher({
        method: "POST",
        path: WORKFLOW_ROUTE_PATHS["capture.suggest"],
        body: {
          entryId: "entry-http-missing-404",
          suggestedTitle: "Missing entry suggestion",
          actor: ACTOR,
          at: "2026-02-23T09:35:00.000Z",
        },
      }),
    );
    const missingAcceptedEntry = await Effect.runPromise(
      dispatcher({
        method: "POST",
        path: WORKFLOW_ROUTE_PATHS["capture.acceptAsTask"],
        body: {
          entryId: "entry-http-missing-404",
          taskId: "task-http-created-1",
          actor: ACTOR,
          at: "2026-02-23T09:35:00.000Z",
        },
      }),
    );
    const missingTask = await Effect.runPromise(
      dispatcher({
        method: "POST",
        path: WORKFLOW_ROUTE_PATHS["planning.completeTask"],
        body: {
          taskId: "task-http-missing-404",
          actor: ACTOR,
          at: "2026-02-23T09:36:00.000Z",
        },
      }),
    );
    const missingSignal = await Effect.runPromise(
      dispatcher({
        method: "POST",
        path: WORKFLOW_ROUTE_PATHS["signal.triage"],
        body: {
          signalId: "signal-http-missing-404",
          decision: "ready_for_conversion",
          actor: ACTOR,
          at: "2026-02-23T09:37:00.000Z",
        },
      }),
    );

    await expectOk(dispatcher, "signal.ingest", {
      signalId: "signal-http-untriaged-1",
      source: "email",
      payload: "needs conversion",
      actor: ACTOR,
      at: "2026-02-23T09:38:00.000Z",
    });
    const conflictSignalConvert = await Effect.runPromise(
      dispatcher({
        method: "POST",
        path: WORKFLOW_ROUTE_PATHS["signal.convert"],
        body: {
          signalId: "signal-http-untriaged-1",
          targetType: "task",
          targetId: "task-http-from-signal-1",
          actor: ACTOR,
          at: "2026-02-23T09:39:00.000Z",
        },
      }),
    );

    expectSanitizedError(missingSuggestedEntry, {
      status: 404,
      route: "capture.suggest",
    });
    expectSanitizedError(missingAcceptedEntry, {
      status: 404,
      route: "capture.acceptAsTask",
    });
    expectSanitizedError(missingTask, {
      status: 404,
      route: "planning.completeTask",
    });
    expectSanitizedError(missingSignal, {
      status: 404,
      route: "signal.triage",
    });
    expectSanitizedError(conflictSignalConvert, {
      status: 409,
      route: "signal.convert",
    });
  });

  test("outbound-draft approval rejects non-user actors with sanitized 403", async () => {
    const platform = await Effect.runPromise(buildCorePlatform());
    const dispatcher = makeWorkflowHttpDispatcher(
      makeWorkflowRoutes(makeWorkflowApi({ platform })),
    );

    await expectOk(dispatcher, "signal.ingest", {
      signalId: "signal-http-forbidden-draft-1",
      source: "email",
      payload: "Draft outbound follow-up",
      actor: ACTOR,
      at: "2026-02-23T09:25:00.000Z",
    });
    await expectOk(dispatcher, "signal.triage", {
      signalId: "signal-http-forbidden-draft-1",
      decision: "requires_outbound",
      actor: ACTOR,
      at: "2026-02-23T09:26:00.000Z",
    });
    await expectOk(dispatcher, "signal.convert", {
      signalId: "signal-http-forbidden-draft-1",
      targetType: "outbound_draft",
      targetId: "outbound-draft-http-forbidden-1",
      actor: ACTOR,
      at: "2026-02-23T09:27:00.000Z",
    });
    await expectOk(dispatcher, "approval.requestOutboundDraftExecution", {
      draftId: "outbound-draft-http-forbidden-1",
      actor: ACTOR,
      at: "2026-02-23T09:28:00.000Z",
    });

    const forbidden = await Effect.runPromise(
      dispatcher({
        method: "POST",
        path: WORKFLOW_ROUTE_PATHS["approval.approveOutboundAction"],
        body: {
          actionType: "outbound_draft",
          entityType: "outbound_draft",
          entityId: "outbound-draft-http-forbidden-1",
          approved: true,
          actor: { id: "system-1", kind: "system" },
          at: "2026-02-23T09:29:00.000Z",
        },
        auth: {
          sessionActor: { id: "system-1", kind: "system" },
        },
      }),
    );

    expectSanitizedError(forbidden, {
      status: 403,
      route: "approval.approveOutboundAction",
    });
  });

  test("approval.approveOutboundAction rejects non-user trusted context spoofing user payload actor", async () => {
    const repository = makeInMemoryCoreRepository();
    const event = await Effect.runPromise(
      createEvent({
        id: "event-http-spoof-1",
        title: "HTTP spoofed approval event",
        startAt: new Date("2026-02-24T16:00:00.000Z"),
      }),
    );
    await Effect.runPromise(repository.saveEntity("event", event.id, event));

    let executeCount = 0;
    const platform = await Effect.runPromise(
      buildCorePlatform({
        repository,
        outboundActionPort: {
          execute: (action) =>
            Effect.sync(() => {
              executeCount += 1;
              return { executionId: `exec-${action.entityId}` };
            }),
        },
      }),
    );
    const dispatcher = makeWorkflowHttpDispatcher(
      makeWorkflowRoutes(makeWorkflowApi({ platform })),
    );

    await expectOk(dispatcher, "approval.requestEventSync", {
      eventId: event.id,
      actor: ACTOR,
      at: "2026-02-24T16:01:00.000Z",
    });

    const spoofedApproval = await Effect.runPromise(
      dispatcher({
        method: "POST",
        path: WORKFLOW_ROUTE_PATHS["approval.approveOutboundAction"],
        body: {
          actionType: "event_sync",
          entityType: "event",
          entityId: event.id,
          approved: true,
          actor: ACTOR,
          at: "2026-02-24T16:02:00.000Z",
        },
        auth: {
          sessionActor: TRUSTED_SYSTEM_ACTOR,
        },
      }),
    );

    expectSanitizedError(spoofedApproval, {
      status: 403,
      route: "approval.approveOutboundAction",
    });

    const persisted = await Effect.runPromise(
      repository.getEntity<{ syncState: string }>("event", event.id),
    );
    expect(executeCount).toBe(0);
    expect(persisted?.syncState).toBe("pending_approval");
  });

  test("approval.approveOutboundAction accepts whitespace-padded payload actor id when trusted user context matches", async () => {
    const repository = makeInMemoryCoreRepository();
    const event = await Effect.runPromise(
      createEvent({
        id: "event-http-whitespace-actor-1",
        title: "HTTP whitespace actor approval event",
        startAt: new Date("2026-02-24T16:15:00.000Z"),
      }),
    );
    await Effect.runPromise(repository.saveEntity("event", event.id, event));

    let executeCount = 0;
    const platform = await Effect.runPromise(
      buildCorePlatform({
        repository,
        outboundActionPort: {
          execute: (action) =>
            Effect.sync(() => {
              executeCount += 1;
              return { executionId: `exec-${action.entityId}` };
            }),
        },
      }),
    );
    const dispatcher = makeWorkflowHttpDispatcher(
      makeWorkflowRoutes(makeWorkflowApi({ platform })),
    );

    await expectOk(dispatcher, "approval.requestEventSync", {
      eventId: event.id,
      actor: ACTOR,
      at: "2026-02-24T16:16:00.000Z",
    });

    const approved = await Effect.runPromise(
      dispatcher({
        method: "POST",
        path: WORKFLOW_ROUTE_PATHS["approval.approveOutboundAction"],
        body: {
          actionType: "event_sync",
          entityType: "event",
          entityId: event.id,
          approved: true,
          actor: {
            id: " user-1 ",
            kind: "user",
          },
          at: "2026-02-24T16:17:00.000Z",
        },
        auth: {
          sessionActor: ACTOR,
        },
      }),
    );

    expect(approved.status).toBe(200);
    expect(approved.body).toMatchObject({
      approved: true,
      executed: true,
    });

    const persisted = await Effect.runPromise(
      repository.getEntity<{ syncState: string }>("event", event.id),
    );
    expect(executeCount).toBe(1);
    expect(persisted?.syncState).toBe("synced");
  });

  test("approval.approveOutboundAction accepts verified signed internal user context", async () => {
    const repository = makeInMemoryCoreRepository();
    const event = await Effect.runPromise(
      createEvent({
        id: "event-http-signed-context-1",
        title: "HTTP signed-context approval event",
        startAt: new Date("2026-02-24T17:00:00.000Z"),
      }),
    );
    await Effect.runPromise(repository.saveEntity("event", event.id, event));

    let executeCount = 0;
    let verifierCalls = 0;
    const platform = await Effect.runPromise(
      buildCorePlatform({
        repository,
        outboundActionPort: {
          execute: (action) =>
            Effect.sync(() => {
              executeCount += 1;
              return { executionId: `exec-${action.entityId}` };
            }),
        },
      }),
    );
    const dispatcher = makeWorkflowHttpDispatcher(
      makeWorkflowRoutes(makeWorkflowApi({ platform })),
      {
        verifySignedInternalActorContext: (context) =>
          Effect.sync(() => {
            verifierCalls += 1;
            expect(context.signature).toBe("signed-approval-ok");
            return context.actor;
          }),
      },
    );

    await expectOk(dispatcher, "approval.requestEventSync", {
      eventId: event.id,
      actor: ACTOR,
      at: "2026-02-24T17:01:00.000Z",
    });

    const approved = await Effect.runPromise(
      dispatcher({
        method: "POST",
        path: WORKFLOW_ROUTE_PATHS["approval.approveOutboundAction"],
        body: {
          actionType: "event_sync",
          entityType: "event",
          entityId: event.id,
          approved: true,
          at: "2026-02-24T17:02:00.000Z",
        },
        auth: {
          signedInternalActor: {
            actor: TRUSTED_SIGNED_USER_ACTOR,
            issuedAt: "2026-02-24T17:01:30.000Z",
            signature: "signed-approval-ok",
          },
        },
      }),
    );

    expect(approved.status).toBe(200);
    expect(approved.body).toMatchObject({
      approved: true,
      executed: true,
    });
    expect(verifierCalls).toBe(1);
    expect(executeCount).toBe(1);
  });

  test("approval endpoints return 400, 403, 404, and 409 with sanitized error payloads", async () => {
    const repository = makeInMemoryCoreRepository();
    const event = await Effect.runPromise(
      createEvent({
        id: "event-http-errors-1",
        title: "HTTP approval status mapping",
        startAt: new Date("2026-02-24T12:00:00.000Z"),
      }),
    );
    await Effect.runPromise(repository.saveEntity("event", event.id, event));

    let executeCount = 0;
    const platform = await Effect.runPromise(
      buildCorePlatform({
        repository,
        outboundActionPort: {
          execute: (action) =>
            Effect.sync(() => {
              executeCount += 1;
              return { executionId: `exec-${action.entityId}` };
            }),
        },
      }),
    );
    const dispatcher = makeWorkflowHttpDispatcher(
      makeWorkflowRoutes(makeWorkflowApi({ platform })),
    );

    const notFound = await Effect.runPromise(
      dispatcher({
        method: "POST",
        path: WORKFLOW_ROUTE_PATHS["approval.approveOutboundAction"],
        body: {
          actionType: "event_sync",
          entityType: "event",
          entityId: "event-http-missing-404",
          approved: true,
          actor: ACTOR,
          at: "2026-02-23T09:29:00.000Z",
        },
        auth: {
          sessionActor: ACTOR,
        },
      }),
    );
    expectSanitizedError(notFound, {
      status: 404,
      route: "approval.approveOutboundAction",
    });

    await expectOk(dispatcher, "approval.requestEventSync", {
      eventId: event.id,
      actor: ACTOR,
      at: "2026-02-23T09:30:00.000Z",
    });

    const invalid = await Effect.runPromise(
      dispatcher({
        method: "POST",
        path: WORKFLOW_ROUTE_PATHS["approval.approveOutboundAction"],
        body: {
          actionType: "event_sync",
          entityType: "event",
          entityId: "   ",
          approved: true,
          actor: ACTOR,
          at: "2026-02-23T09:31:00.000Z",
        },
        auth: {
          sessionActor: ACTOR,
        },
      }),
    );
    expectSanitizedError(invalid, {
      status: 400,
      route: "approval.approveOutboundAction",
    });

    const forbidden = await Effect.runPromise(
      dispatcher({
        method: "POST",
        path: WORKFLOW_ROUTE_PATHS["approval.approveOutboundAction"],
        body: {
          actionType: "event_sync",
          entityType: "event",
          entityId: event.id,
          approved: true,
          actor: { id: "system-1", kind: "system" },
          at: "2026-02-23T09:32:00.000Z",
        },
        auth: {
          sessionActor: { id: "system-1", kind: "system" },
        },
      }),
    );
    expectSanitizedError(forbidden, {
      status: 403,
      route: "approval.approveOutboundAction",
    });

    const firstApproval = await Effect.runPromise(
      dispatcher({
        method: "POST",
        path: WORKFLOW_ROUTE_PATHS["approval.approveOutboundAction"],
        body: {
          actionType: "event_sync",
          entityType: "event",
          entityId: event.id,
          approved: true,
          actor: ACTOR,
          at: "2026-02-23T09:33:00.000Z",
        },
        auth: {
          sessionActor: ACTOR,
        },
      }),
    );
    expect(firstApproval.status).toBe(200);

    const conflict = await Effect.runPromise(
      dispatcher({
        method: "POST",
        path: WORKFLOW_ROUTE_PATHS["approval.approveOutboundAction"],
        body: {
          actionType: "event_sync",
          entityType: "event",
          entityId: event.id,
          approved: true,
          actor: ACTOR,
          at: "2026-02-23T09:34:00.000Z",
        },
        auth: {
          sessionActor: ACTOR,
        },
      }),
    );
    expectSanitizedError(conflict, {
      status: 409,
      route: "approval.approveOutboundAction",
    });
    expect(executeCount).toBe(1);
  });

  test("negative-path matrix returns sanitized contract statuses for all workflow routes", async () => {
    for (const routeCase of INTEGRATION_NEGATIVE_CASES) {
      const platform = await Effect.runPromise(buildCorePlatform());
      const dispatch = makeWorkflowHttpDispatcher(
        makeWorkflowRoutes(makeWorkflowApi({ platform })),
      );

      if (routeCase.setup) {
        await routeCase.setup({ dispatch, platform });
      }
      await assertRouteNegativeCase(dispatch, routeCase);
    }
  });

  test("integration negative-case matrix includes every workflow route key", () => {
    const coveredRoutes = INTEGRATION_NEGATIVE_CASES.map(
      (routeCase) => routeCase.route,
    );
    expect(INTEGRATION_NEGATIVE_CASES).toHaveLength(WORKFLOW_ROUTE_KEYS.length);
    expect(new Set(coveredRoutes).size).toBe(WORKFLOW_ROUTE_KEYS.length);
    expect(new Set(coveredRoutes)).toEqual(new Set(WORKFLOW_ROUTE_KEYS));
  });
});
