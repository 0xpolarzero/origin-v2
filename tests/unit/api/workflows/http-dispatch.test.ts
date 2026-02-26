import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { WorkflowApi } from "../../../../src/api/workflows/contracts";
import { WorkflowRouteDefinition } from "../../../../src/api/workflows/contracts";
import { makeWorkflowHttpDispatcher } from "../../../../src/api/workflows/http-dispatch";
import { WorkflowApiError } from "../../../../src/api/workflows/errors";
import { makeWorkflowRoutes } from "../../../../src/api/workflows/routes";

const ACTOR = { id: "user-1", kind: "user" } as const;

type StubCall = {
  route: "capture.entry" | "job.listHistory";
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
    listJobRunHistory: (input) =>
      Effect.sync(() => {
        calls.push({ route: "job.listHistory", input });
        return [];
      }),
    retryJob: (_input) => Effect.die("unused"),
    createWorkflowCheckpoint: (_input) => Effect.die("unused"),
    keepCheckpoint: (_input) => Effect.die("unused"),
    recoverCheckpoint: (_input) => Effect.die("unused"),
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

  test("returns 403 when a route returns a forbidden WorkflowApiError", async () => {
    const routes: ReadonlyArray<WorkflowRouteDefinition> = [
      {
        key: "approval.approveOutboundAction",
        method: "POST",
        path: "/api/workflows/approval/approve-outbound-action",
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
        path: "/api/workflows/approval/approve-outbound-action",
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
