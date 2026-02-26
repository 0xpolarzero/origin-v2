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

  test("approval endpoints return 400, 403, and 409 with sanitized error payloads", async () => {
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
    expect(invalid.status).toBe(400);
    expect(invalid.body).toEqual(
      expect.objectContaining({
        error: "workflow request failed",
        route: "approval.approveOutboundAction",
      }),
    );
    expect(invalid.body).not.toHaveProperty("_tag");
    expect(invalid.body).not.toHaveProperty("cause");

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
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toEqual(
      expect.objectContaining({
        error: "workflow request failed",
        route: "approval.approveOutboundAction",
      }),
    );
    expect(forbidden.body).not.toHaveProperty("_tag");
    expect(forbidden.body).not.toHaveProperty("cause");

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
    expect(conflict.status).toBe(409);
    expect(conflict.body).toEqual(
      expect.objectContaining({
        error: "workflow request failed",
        route: "approval.approveOutboundAction",
      }),
    );
    expect(conflict.body).not.toHaveProperty("_tag");
    expect(conflict.body).not.toHaveProperty("cause");
    expect(executeCount).toBe(1);
  });
});
