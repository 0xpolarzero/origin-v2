import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { WorkflowRouteKey } from "../../src/api/workflows/contracts";
import { makeWorkflowHttpDispatcher } from "../../src/api/workflows/http-dispatch";
import {
  makeWorkflowRoutes,
  WORKFLOW_ROUTE_PATHS,
} from "../../src/api/workflows/routes";
import { makeWorkflowApi } from "../../src/api/workflows/workflow-api";
import { buildCorePlatform } from "../../src/core/app/core-platform";
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

describe("workflow automation edge cases", () => {
  test("capture.entry and signal.ingest return sanitized 400s for empty required fields", async () => {
    const platform = await Effect.runPromise(buildCorePlatform());
    const dispatch = makeWorkflowHttpDispatcher(
      makeWorkflowRoutes(makeWorkflowApi({ platform })),
    );

    const emptyCapture = await Effect.runPromise(
      dispatch({
        method: "POST",
        path: WORKFLOW_ROUTE_PATHS["capture.entry"],
        body: {
          entryId: "entry-edge-empty-1",
          content: "   ",
          actor: ACTOR,
          at: "2026-02-24T09:00:00.000Z",
        },
      }),
    );
    const emptySource = await Effect.runPromise(
      dispatch({
        method: "POST",
        path: WORKFLOW_ROUTE_PATHS["signal.ingest"],
        body: {
          signalId: "signal-edge-empty-source-1",
          source: "   ",
          payload: "valid payload",
          actor: ACTOR,
          at: "2026-02-24T09:01:00.000Z",
        },
      }),
    );
    const emptyPayload = await Effect.runPromise(
      dispatch({
        method: "POST",
        path: WORKFLOW_ROUTE_PATHS["signal.ingest"],
        body: {
          signalId: "signal-edge-empty-payload-1",
          source: "email",
          payload: "   ",
          actor: ACTOR,
          at: "2026-02-24T09:02:00.000Z",
        },
      }),
    );

    expectSanitizedError(emptyCapture, {
      status: 400,
      route: "capture.entry",
      messageIncludes: "content",
    });
    expectSanitizedError(emptySource, {
      status: 400,
      route: "signal.ingest",
      messageIncludes: "source",
    });
    expectSanitizedError(emptyPayload, {
      status: 400,
      route: "signal.ingest",
      messageIncludes: "payload",
    });

    const entries = await Effect.runPromise(platform.listEntities("entry"));
    const signals = await Effect.runPromise(platform.listEntities("signal"));

    expect(entries).toHaveLength(0);
    expect(signals).toHaveLength(0);
  });

  test("approval denial/auth failures are sanitized and do not execute or mutate outbound state", async () => {
    const repository = makeInMemoryCoreRepository();
    const event = await Effect.runPromise(
      createEvent({
        id: "event-edge-approval-1",
        title: "Approval edge event",
        startAt: new Date("2026-02-24T13:00:00.000Z"),
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
    const dispatch = makeWorkflowHttpDispatcher(
      makeWorkflowRoutes(makeWorkflowApi({ platform })),
    );

    await expectOk(dispatch, "approval.requestEventSync", {
      eventId: event.id,
      actor: ACTOR,
      at: "2026-02-24T13:01:00.000Z",
    });

    const deniedEvent = await Effect.runPromise(
      dispatch({
        method: "POST",
        path: WORKFLOW_ROUTE_PATHS["approval.approveOutboundAction"],
        body: {
          actionType: "event_sync",
          entityType: "event",
          entityId: event.id,
          approved: false,
          actor: ACTOR,
          at: "2026-02-24T13:02:00.000Z",
        },
      }),
    );
    const forbiddenEvent = await Effect.runPromise(
      dispatch({
        method: "POST",
        path: WORKFLOW_ROUTE_PATHS["approval.approveOutboundAction"],
        body: {
          actionType: "event_sync",
          entityType: "event",
          entityId: event.id,
          approved: true,
          actor: { id: "system-1", kind: "system" },
          at: "2026-02-24T13:03:00.000Z",
        },
      }),
    );

    await expectOk(dispatch, "signal.ingest", {
      signalId: "signal-edge-approval-1",
      source: "email",
      payload: "Draft outbound edge case",
      actor: ACTOR,
      at: "2026-02-24T13:04:00.000Z",
    });
    await expectOk(dispatch, "signal.triage", {
      signalId: "signal-edge-approval-1",
      decision: "requires_outbound",
      actor: ACTOR,
      at: "2026-02-24T13:05:00.000Z",
    });
    await expectOk(dispatch, "signal.convert", {
      signalId: "signal-edge-approval-1",
      targetType: "outbound_draft",
      targetId: "outbound-draft-edge-approval-1",
      actor: ACTOR,
      at: "2026-02-24T13:06:00.000Z",
    });
    await expectOk(dispatch, "approval.requestOutboundDraftExecution", {
      draftId: "outbound-draft-edge-approval-1",
      actor: ACTOR,
      at: "2026-02-24T13:07:00.000Z",
    });

    const deniedDraft = await Effect.runPromise(
      dispatch({
        method: "POST",
        path: WORKFLOW_ROUTE_PATHS["approval.approveOutboundAction"],
        body: {
          actionType: "outbound_draft",
          entityType: "outbound_draft",
          entityId: "outbound-draft-edge-approval-1",
          approved: false,
          actor: ACTOR,
          at: "2026-02-24T13:08:00.000Z",
        },
      }),
    );
    const forbiddenDraft = await Effect.runPromise(
      dispatch({
        method: "POST",
        path: WORKFLOW_ROUTE_PATHS["approval.approveOutboundAction"],
        body: {
          actionType: "outbound_draft",
          entityType: "outbound_draft",
          entityId: "outbound-draft-edge-approval-1",
          approved: true,
          actor: { id: "system-1", kind: "system" },
          at: "2026-02-24T13:09:00.000Z",
        },
      }),
    );

    expectSanitizedError(deniedEvent, {
      status: 400,
      route: "approval.approveOutboundAction",
      messageIncludes: "explicit approval",
    });
    expectSanitizedError(forbiddenEvent, {
      status: 403,
      route: "approval.approveOutboundAction",
    });
    expectSanitizedError(deniedDraft, {
      status: 400,
      route: "approval.approveOutboundAction",
      messageIncludes: "explicit approval",
    });
    expectSanitizedError(forbiddenDraft, {
      status: 403,
      route: "approval.approveOutboundAction",
    });

    const persistedEvent = await Effect.runPromise(
      repository.getEntity<{ syncState: string }>("event", event.id),
    );
    const persistedDraft = await Effect.runPromise(
      repository.getEntity<{
        status: string;
        executionId?: string;
      }>("outbound_draft", "outbound-draft-edge-approval-1"),
    );
    const eventAudit = await Effect.runPromise(
      repository.listAuditTrail({
        entityType: "event",
        entityId: event.id,
      }),
    );
    const draftAudit = await Effect.runPromise(
      repository.listAuditTrail({
        entityType: "outbound_draft",
        entityId: "outbound-draft-edge-approval-1",
      }),
    );

    expect(executeCount).toBe(0);
    expect(persistedEvent?.syncState).toBe("pending_approval");
    expect(persistedDraft?.status).toBe("pending_approval");
    expect(persistedDraft?.executionId).toBeUndefined();
    expect(
      eventAudit.some((transition) => transition.toState === "synced"),
    ).toBe(false);
    expect(
      draftAudit.some(
        (transition) =>
          transition.toState === "executing" ||
          transition.toState === "executed",
      ),
    ).toBe(false);
  });

  test("duplicate job.retry attempts return sanitized conflict and keep retry history stable", async () => {
    const platform = await Effect.runPromise(buildCorePlatform());
    const dispatch = makeWorkflowHttpDispatcher(
      makeWorkflowRoutes(makeWorkflowApi({ platform })),
    );

    await expectOk(dispatch, "job.create", {
      jobId: "job-edge-retry-1",
      name: "Edge retry workflow",
      actor: { id: "system-1", kind: "system" },
      at: "2026-02-24T14:00:00.000Z",
    });
    await expectOk(dispatch, "job.recordRun", {
      jobId: "job-edge-retry-1",
      outcome: "failed",
      diagnostics: "edge failure",
      actor: { id: "system-1", kind: "system" },
      at: "2026-02-24T14:01:00.000Z",
    });
    await expectOk(dispatch, "job.retry", {
      jobId: "job-edge-retry-1",
      actor: ACTOR,
      at: "2026-02-24T14:02:00.000Z",
    });

    const historyBeforeDuplicate = (await expectOk(
      dispatch,
      "job.listHistory",
      {
        jobId: "job-edge-retry-1",
      },
    )) as ReadonlyArray<{
      outcome: string;
      retryCount: number;
    }>;
    const duplicateRetry = await Effect.runPromise(
      dispatch({
        method: "POST",
        path: WORKFLOW_ROUTE_PATHS["job.retry"],
        body: {
          jobId: "job-edge-retry-1",
          actor: ACTOR,
          at: "2026-02-24T14:03:00.000Z",
        },
      }),
    );
    const historyAfterDuplicate = (await expectOk(dispatch, "job.listHistory", {
      jobId: "job-edge-retry-1",
    })) as ReadonlyArray<{
      outcome: string;
      retryCount: number;
    }>;
    const inspection = (await expectOk(dispatch, "job.inspectRun", {
      jobId: "job-edge-retry-1",
    })) as {
      runState: string;
      retryCount: number;
    };
    const retryActivity = (await expectOk(dispatch, "activity.list", {
      entityType: "job",
      entityId: "job-edge-retry-1",
      limit: 20,
    })) as ReadonlyArray<{ toState: string }>;

    expectSanitizedError(duplicateRetry, {
      status: 409,
      route: "job.retry",
    });
    expect(historyBeforeDuplicate).toEqual(historyAfterDuplicate);
    expect(historyAfterDuplicate).toHaveLength(1);
    expect(historyAfterDuplicate[0]?.outcome).toBe("failed");
    expect(historyAfterDuplicate[0]?.retryCount).toBe(0);
    expect(inspection.runState).toBe("retrying");
    expect(inspection.retryCount).toBe(1);
    expect(
      retryActivity.filter((transition) => transition.toState === "retrying"),
    ).toHaveLength(1);
  });

  test("checkpoint recovery remains correct after adjacent workflow failures", async () => {
    const repository = makeInMemoryCoreRepository();
    const event = await Effect.runPromise(
      createEvent({
        id: "event-edge-recovery-1",
        title: "Recovery adjacent failure event",
        startAt: new Date("2026-02-24T15:00:00.000Z"),
      }),
    );
    await Effect.runPromise(repository.saveEntity("event", event.id, event));

    const platform = await Effect.runPromise(buildCorePlatform({ repository }));
    const dispatch = makeWorkflowHttpDispatcher(
      makeWorkflowRoutes(makeWorkflowApi({ platform })),
    );

    await expectOk(dispatch, "capture.entry", {
      entryId: "entry-edge-recovery-1",
      content: "Checkpoint baseline content",
      actor: ACTOR,
      at: "2026-02-24T15:01:00.000Z",
    });
    await expectOk(dispatch, "checkpoint.create", {
      checkpointId: "checkpoint-edge-recovery-1",
      name: "Before adjacent failures",
      snapshotEntityRefs: [
        { entityType: "entry", entityId: "entry-edge-recovery-1" },
      ],
      auditCursor: 2,
      rollbackTarget: "audit-2",
      actor: ACTOR,
      at: "2026-02-24T15:02:00.000Z",
    });

    const capturedEntry = await Effect.runPromise(
      repository.getEntity<{
        id: string;
        content: string;
      }>("entry", "entry-edge-recovery-1"),
    );
    if (!capturedEntry) {
      throw new Error("expected entry-edge-recovery-1 to exist");
    }

    await Effect.runPromise(
      repository.saveEntity("entry", capturedEntry.id, {
        ...capturedEntry,
        content: "Mutated after checkpoint",
      }),
    );

    await expectOk(dispatch, "approval.requestEventSync", {
      eventId: event.id,
      actor: ACTOR,
      at: "2026-02-24T15:03:00.000Z",
    });
    const deniedApproval = await Effect.runPromise(
      dispatch({
        method: "POST",
        path: WORKFLOW_ROUTE_PATHS["approval.approveOutboundAction"],
        body: {
          actionType: "event_sync",
          entityType: "event",
          entityId: event.id,
          approved: false,
          actor: ACTOR,
          at: "2026-02-24T15:04:00.000Z",
        },
      }),
    );

    await expectOk(dispatch, "job.create", {
      jobId: "job-edge-recovery-1",
      name: "Adjacent failure retry job",
      actor: { id: "system-1", kind: "system" },
      at: "2026-02-24T15:05:00.000Z",
    });
    await expectOk(dispatch, "job.recordRun", {
      jobId: "job-edge-recovery-1",
      outcome: "failed",
      diagnostics: "adjacent retry failure",
      actor: { id: "system-1", kind: "system" },
      at: "2026-02-24T15:06:00.000Z",
    });
    await expectOk(dispatch, "job.retry", {
      jobId: "job-edge-recovery-1",
      actor: ACTOR,
      at: "2026-02-24T15:07:00.000Z",
    });
    const duplicateRetry = await Effect.runPromise(
      dispatch({
        method: "POST",
        path: WORKFLOW_ROUTE_PATHS["job.retry"],
        body: {
          jobId: "job-edge-recovery-1",
          actor: ACTOR,
          at: "2026-02-24T15:08:00.000Z",
        },
      }),
    );

    const recovered = (await expectOk(dispatch, "checkpoint.recover", {
      checkpointId: "checkpoint-edge-recovery-1",
      actor: ACTOR,
      at: "2026-02-24T15:09:00.000Z",
    })) as { checkpoint: { status: string } };

    const entryAfterRecovery = await Effect.runPromise(
      repository.getEntity<{ content: string }>(
        "entry",
        "entry-edge-recovery-1",
      ),
    );
    const eventAfterFailures = await Effect.runPromise(
      repository.getEntity<{ syncState: string }>("event", event.id),
    );
    const retryInspection = (await expectOk(dispatch, "job.inspectRun", {
      jobId: "job-edge-recovery-1",
    })) as { runState: string; retryCount: number };
    const checkpointAudit = await Effect.runPromise(
      repository.listAuditTrail({
        entityType: "checkpoint",
        entityId: "checkpoint-edge-recovery-1",
      }),
    );

    expectSanitizedError(deniedApproval, {
      status: 400,
      route: "approval.approveOutboundAction",
    });
    expectSanitizedError(duplicateRetry, {
      status: 409,
      route: "job.retry",
    });
    expect(recovered.checkpoint.status).toBe("recovered");
    expect(entryAfterRecovery?.content).toBe("Checkpoint baseline content");
    expect(eventAfterFailures?.syncState).toBe("pending_approval");
    expect(retryInspection.runState).toBe("retrying");
    expect(retryInspection.retryCount).toBe(1);
    expect(
      checkpointAudit.filter(
        (transition) => transition.toState === "recovered",
      ),
    ).toHaveLength(1);
  });
});
