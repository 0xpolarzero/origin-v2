import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { WorkflowApi } from "../../../../src/api/workflows/contracts";
import { WorkflowRouteDefinition } from "../../../../src/api/workflows/contracts";
import { makeWorkflowHttpDispatcher } from "../../../../src/api/workflows/http-dispatch";
import { makeWorkflowRoutes } from "../../../../src/api/workflows/routes";

const ACTOR = { id: "user-1", kind: "user" } as const;

const makeApiStub = (): WorkflowApi =>
  ({
    captureEntry: (input: unknown) =>
      Effect.sync(() => ({
        route: "capture.entry",
        input,
      })),
    suggestEntryAsTask: (_input: unknown) => Effect.die("unused"),
    editEntrySuggestion: (_input: unknown) => Effect.die("unused"),
    rejectEntrySuggestion: (_input: unknown) => Effect.die("unused"),
    acceptEntryAsTask: (_input: unknown) => Effect.die("unused"),
    ingestSignal: (_input: unknown) => Effect.die("unused"),
    triageSignal: (_input: unknown) => Effect.die("unused"),
    convertSignal: (_input: unknown) => Effect.die("unused"),
    completeTask: (_input: unknown) => Effect.die("unused"),
    deferTask: (_input: unknown) => Effect.die("unused"),
    rescheduleTask: (_input: unknown) => Effect.die("unused"),
    requestEventSync: (_input: unknown) => Effect.die("unused"),
    requestOutboundDraftExecution: (_input: unknown) => Effect.die("unused"),
    approveOutboundAction: (_input: unknown) => Effect.die("unused"),
    createJob: (_input: unknown) => Effect.die("unused"),
    recordJobRun: (_input: unknown) => Effect.die("unused"),
    inspectJobRun: (_input: unknown) => Effect.die("unused"),
    retryJob: (_input: unknown) => Effect.die("unused"),
    createWorkflowCheckpoint: (_input: unknown) => Effect.die("unused"),
    keepCheckpoint: (_input: unknown) => Effect.die("unused"),
    recoverCheckpoint: (_input: unknown) => Effect.die("unused"),
  }) as unknown as WorkflowApi;

describe("api/workflows/http-dispatch", () => {
  test("returns 404 when no workflow route matches the path", async () => {
    const dispatcher = makeWorkflowHttpDispatcher(
      makeWorkflowRoutes(makeApiStub()),
    );

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
    const dispatcher = makeWorkflowHttpDispatcher(
      makeWorkflowRoutes(makeApiStub()),
    );

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
    const dispatcher = makeWorkflowHttpDispatcher(
      makeWorkflowRoutes(makeApiStub()),
    );

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
    const dispatcher = makeWorkflowHttpDispatcher(
      makeWorkflowRoutes(makeApiStub()),
    );

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
    expect(response.body).toEqual(
      expect.objectContaining({
        route: "capture.entry",
      }),
    );
    expect(
      (response.body as { input: { at: unknown } }).input.at,
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
