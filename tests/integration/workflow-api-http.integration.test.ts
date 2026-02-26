import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { makeWorkflowApi } from "../../src/api/workflows/workflow-api";
import {
  makeWorkflowRoutes,
  WORKFLOW_ROUTE_PATHS,
} from "../../src/api/workflows/routes";
import { makeWorkflowHttpDispatcher } from "../../src/api/workflows/http-dispatch";
import { buildCorePlatform } from "../../src/core/app/core-platform";
import { WorkflowRouteKey } from "../../src/api/workflows/contracts";
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

  test("job.list and activity.list accept omitted JSON bodies", async () => {
    const platform = await Effect.runPromise(buildCorePlatform());
    const dispatcher = makeWorkflowHttpDispatcher(
      makeWorkflowRoutes(makeWorkflowApi({ platform })),
    );

    const jobListResponse = await Effect.runPromise(
      dispatcher({
        method: "POST",
        path: WORKFLOW_ROUTE_PATHS["job.list"],
      }),
    );
    const activityListResponse = await Effect.runPromise(
      dispatcher({
        method: "POST",
        path: WORKFLOW_ROUTE_PATHS["activity.list"],
      }),
    );

    expect(jobListResponse).toEqual({
      status: 200,
      body: [],
    });
    expect(activityListResponse).toEqual({
      status: 200,
      body: [],
    });
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
});
