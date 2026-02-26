import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { WorkflowApi } from "../../../../src/api/workflows/contracts";
import { WorkflowRouteDefinition } from "../../../../src/api/workflows/contracts";
import { makeWorkflowHttpDispatcher } from "../../../../src/api/workflows/http-dispatch";
import { WorkflowApiError } from "../../../../src/api/workflows/errors";
import { makeWorkflowRoutes } from "../../../../src/api/workflows/routes";

const ACTOR = { id: "user-1", kind: "user" } as const;
const APPROVAL_ROUTE_PATH = "/api/workflows/approval/approve-outbound-action";
const TRUSTED_USER_ACTOR = { id: "trusted-user-1", kind: "user" } as const;
const TRUSTED_SYSTEM_ACTOR = {
  id: "trusted-system-1",
  kind: "system",
} as const;

type StubCall = {
  route:
    | "capture.entry"
    | "job.list"
    | "job.listHistory"
    | "checkpoint.inspect"
    | "activity.list";
  input: unknown;
};

const makeApiStub = (): { api: WorkflowApi; calls: Array<StubCall> } => {
  const calls: Array<StubCall> = [];
  const api: WorkflowApi = {
    captureEntry: (input) =>
      Effect.sync(() => {
        calls.push({ route: "capture.entry", input });
        const atIso = (input.at ?? new Date()).toISOString();
        return {
          id: input.entryId ?? "entry-http-generated",
          content: input.content,
          source: "manual",
          status: "captured",
          capturedAt: atIso,
          createdAt: atIso,
          updatedAt: atIso,
        };
      }),
    suggestEntryAsTask: (_input) => Effect.die("unused"),
    editEntrySuggestion: (_input) => Effect.die("unused"),
    rejectEntrySuggestion: (_input) => Effect.die("unused"),
    acceptEntryAsTask: (_input) => Effect.die("unused"),
    ingestSignal: (_input) => Effect.die("unused"),
    triageSignal: (_input) => Effect.die("unused"),
    convertSignal: (_input) => Effect.die("unused"),
    completeTask: (_input) => Effect.die("unused"),
    deferTask: (_input) => Effect.die("unused"),
    rescheduleTask: (_input) => Effect.die("unused"),
    requestEventSync: (_input) => Effect.die("unused"),
    requestOutboundDraftExecution: (_input) => Effect.die("unused"),
    approveOutboundAction: (_input) => Effect.die("unused"),
    createJob: (_input) => Effect.die("unused"),
    recordJobRun: (_input) => Effect.die("unused"),
    inspectJobRun: (_input) => Effect.die("unused"),
    listJobs: (input) =>
      Effect.sync(() => {
        calls.push({ route: "job.list", input });
        return [];
      }),
    listJobRunHistory: (input) =>
      Effect.sync(() => {
        calls.push({ route: "job.listHistory", input });
        return [];
      }),
    retryJob: (_input) => Effect.die("unused"),
    createWorkflowCheckpoint: (_input) => Effect.die("unused"),
    inspectWorkflowCheckpoint: (input) =>
      Effect.sync(() => {
        calls.push({ route: "checkpoint.inspect", input });
        return {
          id: input.checkpointId,
          name: "Checkpoint from stub",
          snapshotEntityRefs: [],
          snapshotEntities: [],
          auditCursor: 0,
          rollbackTarget: "audit-0",
          status: "created",
          createdAt: "2026-02-23T10:00:00.000Z",
          updatedAt: "2026-02-23T10:00:00.000Z",
        };
      }),
    keepCheckpoint: (_input) => Effect.die("unused"),
    recoverCheckpoint: (_input) => Effect.die("unused"),
    listActivity: (input) =>
      Effect.sync(() => {
        calls.push({ route: "activity.list", input });
        return [];
      }),
  };
  return { api, calls };
};

describe("api/workflows/http-dispatch", () => {
  test("returns 404 when no workflow route matches the path", async () => {
    const stub = makeApiStub();
    const dispatcher = makeWorkflowHttpDispatcher(makeWorkflowRoutes(stub.api));

    const response = await Effect.runPromise(
      dispatcher({
        method: "POST",
        path: "/api/workflows/unknown-route",
        body: {},
      }),
    );

    expect(response.status).toBe(404);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: "workflow route not found",
      }),
    );
  });

  test("returns 405 when path exists but method is unsupported", async () => {
    const stub = makeApiStub();
    const dispatcher = makeWorkflowHttpDispatcher(makeWorkflowRoutes(stub.api));

    const response = await Effect.runPromise(
      dispatcher({
        method: "GET",
        path: "/api/workflows/capture/entry",
        body: {},
      }),
    );

    expect(response.status).toBe(405);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: "method not allowed",
      }),
    );
  });

  test("returns 400 when payload fails route validation", async () => {
    const stub = makeApiStub();
    const dispatcher = makeWorkflowHttpDispatcher(makeWorkflowRoutes(stub.api));

    const response = await Effect.runPromise(
      dispatcher({
        method: "POST",
        path: "/api/workflows/capture/entry",
        body: {
          entryId: "entry-http-1",
          actor: ACTOR,
        },
      }),
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: "workflow request failed",
        route: "capture.entry",
      }),
    );
    expect(response.body).toMatchObject({
      message: expect.stringContaining(
        "invalid request payload for capture.entry",
      ),
    });
    expect(response.body).not.toHaveProperty("cause");
    expect(response.body).not.toHaveProperty("_tag");
  });

  test("returns 200 with handler output for valid JSON payloads", async () => {
    const stub = makeApiStub();
    const dispatcher = makeWorkflowHttpDispatcher(makeWorkflowRoutes(stub.api));

    const response = await Effect.runPromise(
      dispatcher({
        method: "POST",
        path: "/api/workflows/capture/entry",
        body: {
          entryId: "entry-http-1",
          content: "Use dispatcher",
          actor: ACTOR,
          at: "2026-02-23T10:00:00.000Z",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: "entry-http-1",
      content: "Use dispatcher",
    });

    const captureCall = stub.calls.find(
      (call) => call.route === "capture.entry",
    );
    expect(captureCall).toBeDefined();
    expect((captureCall!.input as { at: unknown }).at).toBeInstanceOf(Date);
  });

  test("rejects trusted-actor routes when trusted actor context is missing", async () => {
    let handled = 0;
    const routes = [
      {
        key: "approval.approveOutboundAction",
        method: "POST",
        path: APPROVAL_ROUTE_PATH,
        actorSource: "trusted",
        handle: () =>
          Effect.sync(() => {
            handled += 1;
            return { ok: true };
          }),
      },
    ] as ReadonlyArray<WorkflowRouteDefinition>;
    const dispatcher = makeWorkflowHttpDispatcher(routes);

    const response = await Effect.runPromise(
      dispatcher({
        method: "POST",
        path: APPROVAL_ROUTE_PATH,
        body: {
          actionType: "event_sync",
          entityType: "event",
          entityId: "event-1",
          approved: true,
          actor: ACTOR,
        },
      }),
    );

    expect(response.status).toBe(403);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: "workflow request failed",
        route: "approval.approveOutboundAction",
      }),
    );
    expect((response.body as { message: string }).message).toContain(
      "trusted actor",
    );
    expect(handled).toBe(0);
  });

  test("injects trusted session actor into trusted-route payload before handler invocation", async () => {
    let handledInput: unknown;
    const routes = [
      {
        key: "approval.approveOutboundAction",
        method: "POST",
        path: APPROVAL_ROUTE_PATH,
        actorSource: "trusted",
        handle: (input) =>
          Effect.sync(() => {
            handledInput = input;
            return { ok: true };
          }),
      },
    ] as ReadonlyArray<WorkflowRouteDefinition>;
    const dispatcher = makeWorkflowHttpDispatcher(routes);

    const response = await Effect.runPromise(
      dispatcher({
        method: "POST",
        path: APPROVAL_ROUTE_PATH,
        body: {
          actionType: "event_sync",
          entityType: "event",
          entityId: "event-2",
          approved: true,
        },
        auth: {
          sessionActor: TRUSTED_USER_ACTOR,
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(handledInput).toMatchObject({
      actionType: "event_sync",
      entityType: "event",
      entityId: "event-2",
      approved: true,
      actor: TRUSTED_USER_ACTOR,
    });
  });

  test("rejects spoofed payload actor when trusted context actor is non-user", async () => {
    let handled = 0;
    const routes = [
      {
        key: "approval.approveOutboundAction",
        method: "POST",
        path: APPROVAL_ROUTE_PATH,
        actorSource: "trusted",
        handle: () =>
          Effect.sync(() => {
            handled += 1;
            return { ok: true };
          }),
      },
    ] as ReadonlyArray<WorkflowRouteDefinition>;
    const dispatcher = makeWorkflowHttpDispatcher(routes);

    const response = await Effect.runPromise(
      dispatcher({
        method: "POST",
        path: APPROVAL_ROUTE_PATH,
        body: {
          actionType: "event_sync",
          entityType: "event",
          entityId: "event-3",
          approved: true,
          actor: ACTOR,
        },
        auth: {
          sessionActor: TRUSTED_SYSTEM_ACTOR,
        },
      }),
    );

    expect(response.status).toBe(403);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: "workflow request failed",
        route: "approval.approveOutboundAction",
      }),
    );
    expect((response.body as { message: string }).message).toContain("spoof");
    expect(handled).toBe(0);
  });

  test("rejects spoofed payload actor when trusted user context actor id mismatches", async () => {
    let handled = 0;
    const routes = [
      {
        key: "approval.approveOutboundAction",
        method: "POST",
        path: APPROVAL_ROUTE_PATH,
        actorSource: "trusted",
        handle: () =>
          Effect.sync(() => {
            handled += 1;
            return { ok: true };
          }),
      },
    ] as ReadonlyArray<WorkflowRouteDefinition>;
    const dispatcher = makeWorkflowHttpDispatcher(routes);

    const response = await Effect.runPromise(
      dispatcher({
        method: "POST",
        path: APPROVAL_ROUTE_PATH,
        body: {
          actionType: "event_sync",
          entityType: "event",
          entityId: "event-4",
          approved: true,
          actor: ACTOR,
        },
        auth: {
          sessionActor: TRUSTED_USER_ACTOR,
        },
      }),
    );

    expect(response.status).toBe(403);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: "workflow request failed",
        route: "approval.approveOutboundAction",
      }),
    );
    expect((response.body as { message: string }).message).toContain("spoof");
    expect(handled).toBe(0);
  });

  test("accepts signed internal actor context when verifier succeeds", async () => {
    let verifierCalls = 0;
    let handledInput: unknown;
    const routes = [
      {
        key: "approval.approveOutboundAction",
        method: "POST",
        path: APPROVAL_ROUTE_PATH,
        actorSource: "trusted",
        handle: (input) =>
          Effect.sync(() => {
            handledInput = input;
            return { ok: true };
          }),
      },
    ] as ReadonlyArray<WorkflowRouteDefinition>;
    const dispatcher = makeWorkflowHttpDispatcher(routes, {
      verifySignedInternalActorContext: (context) =>
        Effect.sync(() => {
          verifierCalls += 1;
          expect(context.signature).toBe("sig-valid");
          return TRUSTED_USER_ACTOR;
        }),
    });

    const response = await Effect.runPromise(
      dispatcher({
        method: "POST",
        path: APPROVAL_ROUTE_PATH,
        body: {
          actionType: "event_sync",
          entityType: "event",
          entityId: "event-5",
          approved: true,
        },
        auth: {
          signedInternalActor: {
            actor: TRUSTED_USER_ACTOR,
            issuedAt: "2026-02-25T10:00:00.000Z",
            signature: "sig-valid",
          },
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(verifierCalls).toBe(1);
    expect(handledInput).toMatchObject({
      actor: TRUSTED_USER_ACTOR,
    });
  });

  test("rejects signed internal actor context when verifier fails", async () => {
    let handled = 0;
    const routes = [
      {
        key: "approval.approveOutboundAction",
        method: "POST",
        path: APPROVAL_ROUTE_PATH,
        actorSource: "trusted",
        handle: () =>
          Effect.sync(() => {
            handled += 1;
            return { ok: true };
          }),
      },
    ] as ReadonlyArray<WorkflowRouteDefinition>;
    const dispatcher = makeWorkflowHttpDispatcher(routes, {
      verifySignedInternalActorContext: () =>
        Effect.fail(
          new WorkflowApiError({
            route: "approval.approveOutboundAction",
            message: "signed context verification failed",
            code: "forbidden",
            statusCode: 403,
          }),
        ),
    });

    const response = await Effect.runPromise(
      dispatcher({
        method: "POST",
        path: APPROVAL_ROUTE_PATH,
        body: {
          actionType: "event_sync",
          entityType: "event",
          entityId: "event-6",
          approved: true,
        },
        auth: {
          signedInternalActor: {
            actor: TRUSTED_USER_ACTOR,
            issuedAt: "2026-02-25T11:00:00.000Z",
            signature: "sig-invalid",
          },
        },
      }),
    );

    expect(response.status).toBe(403);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: "workflow request failed",
        route: "approval.approveOutboundAction",
      }),
    );
    expect((response.body as { message: string }).message).toContain(
      "verification",
    );
    expect(handled).toBe(0);
  });

  test("rejects signed internal actor context when verifier is not configured", async () => {
    let handled = 0;
    const routes = [
      {
        key: "approval.approveOutboundAction",
        method: "POST",
        path: APPROVAL_ROUTE_PATH,
        actorSource: "trusted",
        handle: () =>
          Effect.sync(() => {
            handled += 1;
            return { ok: true };
          }),
      },
    ] as ReadonlyArray<WorkflowRouteDefinition>;
    const dispatcher = makeWorkflowHttpDispatcher(routes);

    const response = await Effect.runPromise(
      dispatcher({
        method: "POST",
        path: APPROVAL_ROUTE_PATH,
        body: {
          actionType: "event_sync",
          entityType: "event",
          entityId: "event-7",
          approved: true,
          actor: ACTOR,
        },
        auth: {
          signedInternalActor: {
            actor: TRUSTED_USER_ACTOR,
            issuedAt: "2026-02-25T12:00:00.000Z",
            signature: "sig-missing-verifier",
          },
        },
      }),
    );

    expect(response.status).toBe(403);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: "workflow request failed",
        route: "approval.approveOutboundAction",
      }),
    );
    expect((response.body as { message: string }).message).toContain(
      "verification",
    );
    expect(handled).toBe(0);
  });

  test("returns 403 when a route returns a forbidden WorkflowApiError", async () => {
    const routes: ReadonlyArray<WorkflowRouteDefinition> = [
      {
        key: "approval.approveOutboundAction",
        method: "POST",
        path: APPROVAL_ROUTE_PATH,
        handle: () =>
          Effect.fail(
            new WorkflowApiError({
              route: "approval.approveOutboundAction",
              message: "only user actors may approve outbound actions",
              code: "forbidden",
              statusCode: 403,
            }),
          ),
      },
    ];
    const dispatcher = makeWorkflowHttpDispatcher(routes);

    const response = await Effect.runPromise(
      dispatcher({
        method: "POST",
        path: APPROVAL_ROUTE_PATH,
        body: {},
      }),
    );

    expect(response.status).toBe(403);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: "workflow request failed",
        route: "approval.approveOutboundAction",
        message: "only user actors may approve outbound actions",
      }),
    );
  });

  test("returns 409 when a route returns a conflict WorkflowApiError", async () => {
    const routes: ReadonlyArray<WorkflowRouteDefinition> = [
      {
        key: "approval.requestEventSync",
        method: "POST",
        path: "/api/workflows/approval/request-event-sync",
        handle: () =>
          Effect.fail(
            new WorkflowApiError({
              route: "approval.requestEventSync",
              message:
                "event event-1 must be local_only before requesting sync",
              code: "conflict",
              statusCode: 409,
            }),
          ),
      },
    ];
    const dispatcher = makeWorkflowHttpDispatcher(routes);

    const response = await Effect.runPromise(
      dispatcher({
        method: "POST",
        path: "/api/workflows/approval/request-event-sync",
        body: {},
      }),
    );

    expect(response.status).toBe(409);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: "workflow request failed",
        route: "approval.requestEventSync",
        message: "event event-1 must be local_only before requesting sync",
      }),
    );
  });

  test("returns 404 when a route returns a not_found WorkflowApiError", async () => {
    const routes: ReadonlyArray<WorkflowRouteDefinition> = [
      {
        key: "approval.approveOutboundAction",
        method: "POST",
        path: APPROVAL_ROUTE_PATH,
        handle: () =>
          Effect.fail(
            new WorkflowApiError({
              route: "approval.approveOutboundAction",
              message: "event event-404 was not found",
              code: "not_found",
              statusCode: 404,
              cause: { internal: "do-not-leak" },
            }),
          ),
      },
    ];
    const dispatcher = makeWorkflowHttpDispatcher(routes);

    const response = await Effect.runPromise(
      dispatcher({
        method: "POST",
        path: APPROVAL_ROUTE_PATH,
        body: {},
      }),
    );

    expect(response.status).toBe(404);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: "workflow request failed",
        route: "approval.approveOutboundAction",
        message: "event event-404 was not found",
      }),
    );
    expect(response.body).not.toHaveProperty("_tag");
    expect(response.body).not.toHaveProperty("cause");
  });

  test("dispatches job.listHistory route with the API stub", async () => {
    const stub = makeApiStub();
    const dispatcher = makeWorkflowHttpDispatcher(makeWorkflowRoutes(stub.api));

    const response = await Effect.runPromise(
      dispatcher({
        method: "POST",
        path: "/api/workflows/job/list-history",
        body: {
          jobId: "job-http-1",
          beforeAt: "2026-02-23T10:00:00.000Z",
          limit: 3,
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);

    const historyCall = stub.calls.find(
      (call) => call.route === "job.listHistory",
    );
    expect(historyCall).toBeDefined();
    expect(
      (historyCall!.input as { beforeAt: unknown }).beforeAt,
    ).toBeInstanceOf(Date);
  });

  test("dispatches job.list route with date coercion", async () => {
    const stub = makeApiStub();
    const dispatcher = makeWorkflowHttpDispatcher(makeWorkflowRoutes(stub.api));

    const response = await Effect.runPromise(
      dispatcher({
        method: "POST",
        path: "/api/workflows/job/list",
        body: {
          runState: "failed",
          beforeUpdatedAt: "2026-02-23T10:00:00.000Z",
          limit: 2,
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);

    const listCall = stub.calls.find((call) => call.route === "job.list");
    expect(listCall).toBeDefined();
    expect(
      (listCall!.input as { beforeUpdatedAt: unknown }).beforeUpdatedAt,
    ).toBeInstanceOf(Date);
  });

  test("dispatches bodyless POST to job.list with normalized empty filters", async () => {
    const stub = makeApiStub();
    const dispatcher = makeWorkflowHttpDispatcher(makeWorkflowRoutes(stub.api));

    const response = await Effect.runPromise(
      dispatcher({
        method: "POST",
        path: "/api/workflows/job/list",
      }),
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);

    const listCall = stub.calls.find((call) => call.route === "job.list");
    expect(listCall).toBeDefined();
    expect(listCall?.input).toEqual({
      runState: undefined,
      limit: undefined,
      beforeUpdatedAt: undefined,
    });
  });

  test("dispatches bodyless POST to activity.list with normalized empty filters", async () => {
    const stub = makeApiStub();
    const dispatcher = makeWorkflowHttpDispatcher(makeWorkflowRoutes(stub.api));

    const response = await Effect.runPromise(
      dispatcher({
        method: "POST",
        path: "/api/workflows/activity/list",
      }),
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);

    const activityCall = stub.calls.find(
      (call) => call.route === "activity.list",
    );
    expect(activityCall).toBeDefined();
    expect(activityCall?.input).toEqual({
      entityType: undefined,
      entityId: undefined,
      actorKind: undefined,
      aiOnly: undefined,
      limit: undefined,
      beforeAt: undefined,
    });
  });

  test("dispatches checkpoint.inspect and activity.list routes with the API stub", async () => {
    const stub = makeApiStub();
    const dispatcher = makeWorkflowHttpDispatcher(makeWorkflowRoutes(stub.api));

    const inspectResponse = await Effect.runPromise(
      dispatcher({
        method: "POST",
        path: "/api/workflows/checkpoint/inspect",
        body: {
          checkpointId: "checkpoint-http-1",
        },
      }),
    );
    const activityResponse = await Effect.runPromise(
      dispatcher({
        method: "POST",
        path: "/api/workflows/activity/list",
        body: {
          aiOnly: true,
          beforeAt: "2026-02-23T10:00:00.000Z",
          limit: 5,
        },
      }),
    );

    expect(inspectResponse.status).toBe(200);
    expect(inspectResponse.body).toMatchObject({
      id: "checkpoint-http-1",
      status: "created",
    });
    expect(activityResponse.status).toBe(200);
    expect(activityResponse.body).toEqual([]);

    const inspectCall = stub.calls.find(
      (call) => call.route === "checkpoint.inspect",
    );
    expect(inspectCall).toBeDefined();
    expect(inspectCall?.input).toEqual({ checkpointId: "checkpoint-http-1" });

    const activityCall = stub.calls.find(
      (call) => call.route === "activity.list",
    );
    expect(activityCall).toBeDefined();
    expect(
      (activityCall?.input as { beforeAt: unknown }).beforeAt,
    ).toBeInstanceOf(Date);
  });

  test("returns sanitized failure body for job.list route errors", async () => {
    const routes: ReadonlyArray<WorkflowRouteDefinition> = [
      {
        key: "job.list",
        method: "POST",
        path: "/api/workflows/job/list",
        handle: () =>
          Effect.fail(
            new WorkflowApiError({
              route: "job.list",
              message: "cannot load jobs",
              code: "not_found",
              statusCode: 404,
              cause: { internal: "sensitive" },
            }),
          ),
      },
    ];
    const dispatcher = makeWorkflowHttpDispatcher(routes);

    const response = await Effect.runPromise(
      dispatcher({
        method: "POST",
        path: "/api/workflows/job/list",
        body: {},
      }),
    );

    expect(response.status).toBe(404);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: "workflow request failed",
        route: "job.list",
        message: "cannot load jobs",
      }),
    );
    expect(response.body).not.toHaveProperty("_tag");
    expect(response.body).not.toHaveProperty("cause");
  });

  test("returns sanitized 500 body when a route defects", async () => {
    const routes: ReadonlyArray<WorkflowRouteDefinition> = [
      {
        key: "capture.entry",
        method: "POST",
        path: "/api/workflows/capture/entry",
        handle: () => Effect.die(new Error("sensitive defect details")),
      },
    ];
    const dispatcher = makeWorkflowHttpDispatcher(routes);

    const response = await Effect.runPromise(
      dispatcher({
        method: "POST",
        path: "/api/workflows/capture/entry",
        body: {},
      }),
    );

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: "workflow route dispatch failed",
      message: "internal server error",
    });
  });
});
