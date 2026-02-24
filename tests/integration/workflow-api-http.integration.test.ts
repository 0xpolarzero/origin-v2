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
  expected: { status: number; route: WorkflowRouteKey; messageIncludes?: string },
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
      }),
    );

    expectSanitizedError(forbidden, {
      status: 403,
      route: "approval.approveOutboundAction",
    });
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
      }),
    );
    expectSanitizedError(conflict, {
      status: 409,
      route: "approval.approveOutboundAction",
    });
    expect(executeCount).toBe(1);
  });
});
