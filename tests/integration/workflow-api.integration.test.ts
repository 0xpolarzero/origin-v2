import { describe, expect, test } from "bun:test";
import { Either, Effect } from "effect";

import { buildCorePlatform } from "../../src/core/app/core-platform";
import { createEvent } from "../../src/core/domain/event";
import { makeInMemoryCoreRepository } from "../../src/core/repositories/in-memory-core-repository";
import { makeWorkflowApi } from "../../src/api/workflows/workflow-api";

describe("workflow-api integration", () => {
  test("capture -> suggest -> accept/edit/reject workflows execute through API handlers", async () => {
    const platform = await Effect.runPromise(buildCorePlatform());
    const api = makeWorkflowApi({ platform });

    await Effect.runPromise(
      api.captureEntry({
        entryId: "entry-api-capture-1",
        content: "Prepare customer follow-up",
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T09:00:00.000Z"),
      }),
    );
    await Effect.runPromise(
      api.suggestEntryAsTask({
        entryId: "entry-api-capture-1",
        suggestedTitle: "Prepare and send customer follow-up",
        actor: { id: "ai-1", kind: "ai" },
        at: new Date("2026-02-23T09:01:00.000Z"),
      }),
    );
    await Effect.runPromise(
      api.editEntrySuggestion({
        entryId: "entry-api-capture-1",
        suggestedTitle: "Send customer follow-up with revised ETA",
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T09:02:00.000Z"),
      }),
    );
    await Effect.runPromise(
      api.acceptEntryAsTask({
        entryId: "entry-api-capture-1",
        taskId: "task-api-capture-1",
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T09:03:00.000Z"),
      }),
    );

    await Effect.runPromise(
      api.captureEntry({
        entryId: "entry-api-capture-2",
        content: "Optional webinar draft",
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T09:04:00.000Z"),
      }),
    );
    await Effect.runPromise(
      api.suggestEntryAsTask({
        entryId: "entry-api-capture-2",
        suggestedTitle: "Draft webinar invitation",
        actor: { id: "ai-1", kind: "ai" },
        at: new Date("2026-02-23T09:05:00.000Z"),
      }),
    );
    await Effect.runPromise(
      api.rejectEntrySuggestion({
        entryId: "entry-api-capture-2",
        reason: "No webinar planned",
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T09:06:00.000Z"),
      }),
    );

    const acceptedEntry = await Effect.runPromise(
      platform.getEntity<{ status: string; acceptedTaskId?: string }>(
        "entry",
        "entry-api-capture-1",
      ),
    );
    const rejectedEntry = await Effect.runPromise(
      platform.getEntity<{ status: string; rejectionReason?: string }>(
        "entry",
        "entry-api-capture-2",
      ),
    );
    const acceptedAudit = await Effect.runPromise(
      platform.listAuditTrail({
        entityType: "entry",
        entityId: "entry-api-capture-1",
      }),
    );

    expect(acceptedEntry?.status).toBe("accepted_as_task");
    expect(acceptedEntry?.acceptedTaskId).toBe("task-api-capture-1");
    expect(rejectedEntry?.status).toBe("rejected");
    expect(rejectedEntry?.rejectionReason).toBe("No webinar planned");
    expect(acceptedAudit.map((transition) => transition.toState)).toEqual([
      "captured",
      "suggested",
      "suggested",
      "accepted_as_task",
    ]);
  });

  test("signal ingest -> triage -> convert to each supported entity executes through API handlers", async () => {
    const platform = await Effect.runPromise(buildCorePlatform());
    const api = makeWorkflowApi({ platform });

    const targets = [
      { targetType: "task" as const, targetId: "task-from-signal-api-1" },
      { targetType: "event" as const, targetId: "event-from-signal-api-1" },
      { targetType: "note" as const, targetId: "note-from-signal-api-1" },
      {
        targetType: "project" as const,
        targetId: "project-from-signal-api-1",
      },
      {
        targetType: "outbound_draft" as const,
        targetId: "outbound-draft-from-signal-api-1",
      },
    ];

    for (const [index, target] of targets.entries()) {
      const signalId = `signal-api-${index + 1}`;

      await Effect.runPromise(
        api.ingestSignal({
          signalId,
          source: "email",
          payload: `payload for ${target.targetType}`,
          actor: { id: "user-1", kind: "user" },
          at: new Date(`2026-02-23T10:0${index}:00.000Z`),
        }),
      );
      await Effect.runPromise(
        api.triageSignal({
          signalId,
          decision: "ready_for_conversion",
          actor: { id: "user-1", kind: "user" },
          at: new Date(`2026-02-23T10:1${index}:00.000Z`),
        }),
      );
      await Effect.runPromise(
        api.convertSignal({
          signalId,
          targetType: target.targetType,
          targetId: target.targetId,
          actor: { id: "user-1", kind: "user" },
          at: new Date(`2026-02-23T10:2${index}:00.000Z`),
        }),
      );

      const persistedSignal = await Effect.runPromise(
        platform.getEntity<{ triageState: string }>("signal", signalId),
      );
      const persistedTarget = await Effect.runPromise(
        platform.getEntity<Record<string, unknown>>(
          target.targetType,
          target.targetId,
        ),
      );

      expect(persistedSignal?.triageState).toBe("converted");
      expect(persistedTarget).toBeDefined();
    }

    const outboundDraft = await Effect.runPromise(
      platform.getEntity<{ status: string }>(
        "outbound_draft",
        "outbound-draft-from-signal-api-1",
      ),
    );

    expect(outboundDraft?.status).toBe("draft");
  });

  test("planning complete/defer/reschedule flow executes through API handlers", async () => {
    const platform = await Effect.runPromise(buildCorePlatform());
    const api = makeWorkflowApi({ platform });

    await Effect.runPromise(
      api.captureEntry({
        entryId: "entry-api-planning-1",
        content: "Prepare planning review",
        actor: { id: "user-1", kind: "user" },
      }),
    );
    await Effect.runPromise(
      api.acceptEntryAsTask({
        entryId: "entry-api-planning-1",
        taskId: "task-api-planning-1",
        actor: { id: "user-1", kind: "user" },
      }),
    );

    await Effect.runPromise(
      api.deferTask({
        taskId: "task-api-planning-1",
        until: new Date("2026-02-24T09:00:00.000Z"),
        actor: { id: "user-1", kind: "user" },
      }),
    );
    await Effect.runPromise(
      api.rescheduleTask({
        taskId: "task-api-planning-1",
        nextAt: new Date("2026-02-24T15:00:00.000Z"),
        actor: { id: "user-1", kind: "user" },
      }),
    );
    await Effect.runPromise(
      api.completeTask({
        taskId: "task-api-planning-1",
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-24T16:00:00.000Z"),
      }),
    );

    const persistedTask = await Effect.runPromise(
      platform.getEntity<{ status: string }>("task", "task-api-planning-1"),
    );

    expect(persistedTask?.status).toBe("completed");
  });

  test("event sync remains pending until explicit approval and then executes exactly once", async () => {
    const repository = makeInMemoryCoreRepository();
    const event = await Effect.runPromise(
      createEvent({
        id: "event-api-approval-1",
        title: "Approval-gated sync",
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
    const api = makeWorkflowApi({ platform });

    await Effect.runPromise(
      api.requestEventSync({
        eventId: event.id,
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T11:00:00.000Z"),
      }),
    );

    const pendingEvent = await Effect.runPromise(
      platform.getEntity<{ syncState: string }>("event", event.id),
    );

    const rejectedEventApproval = await Effect.runPromise(
      Effect.either(
        api.approveOutboundAction({
          actionType: "event_sync",
          entityType: "event",
          entityId: event.id,
          approved: false,
          actor: { id: "user-1", kind: "user" },
          at: new Date("2026-02-23T11:01:00.000Z"),
        }),
      ),
    );

    expect(Either.isLeft(rejectedEventApproval)).toBe(true);
    if (Either.isLeft(rejectedEventApproval)) {
      expect(rejectedEventApproval.left).toMatchObject({
        _tag: "WorkflowApiError",
        route: "approval.approveOutboundAction",
        message: "outbound actions require explicit approval",
      });
    }

    await Effect.runPromise(
      api.approveOutboundAction({
        actionType: "event_sync",
        entityType: "event",
        entityId: event.id,
        approved: true,
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T11:02:00.000Z"),
      }),
    );

    const syncedEvent = await Effect.runPromise(
      platform.getEntity<{ syncState: string }>("event", event.id),
    );

    expect(pendingEvent?.syncState).toBe("pending_approval");
    expect(executeCount).toBe(1);
    expect(syncedEvent?.syncState).toBe("synced");
  });

  test("outbound draft execution stays blocked until explicit approval, then executes once", async () => {
    let executeCount = 0;
    const platform = await Effect.runPromise(
      buildCorePlatform({
        outboundActionPort: {
          execute: (action) =>
            Effect.sync(() => {
              executeCount += 1;
              return { executionId: `exec-${action.entityId}` };
            }),
        },
      }),
    );
    const api = makeWorkflowApi({ platform });

    await Effect.runPromise(
      api.ingestSignal({
        signalId: "signal-api-outbound-1",
        source: "chat",
        payload: "Draft outbound response",
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T12:00:00.000Z"),
      }),
    );
    await Effect.runPromise(
      api.triageSignal({
        signalId: "signal-api-outbound-1",
        decision: "requires_outbound",
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T12:01:00.000Z"),
      }),
    );
    await Effect.runPromise(
      api.convertSignal({
        signalId: "signal-api-outbound-1",
        targetType: "outbound_draft",
        targetId: "outbound-draft-api-approval-1",
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T12:02:00.000Z"),
      }),
    );

    const preApprovalAttempt = await Effect.runPromise(
      Effect.either(
        api.approveOutboundAction({
          actionType: "outbound_draft",
          entityType: "outbound_draft",
          entityId: "outbound-draft-api-approval-1",
          approved: true,
          actor: { id: "user-1", kind: "user" },
          at: new Date("2026-02-23T12:03:00.000Z"),
        }),
      ),
    );

    expect(Either.isLeft(preApprovalAttempt)).toBe(true);
    if (Either.isLeft(preApprovalAttempt)) {
      expect(preApprovalAttempt.left).toMatchObject({
        _tag: "WorkflowApiError",
        route: "approval.approveOutboundAction",
        message:
          "outbound draft outbound-draft-api-approval-1 must be in pending_approval before execution approval",
      });
    }

    await Effect.runPromise(
      api.requestOutboundDraftExecution({
        draftId: "outbound-draft-api-approval-1",
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T12:04:00.000Z"),
      }),
    );

    const rejectedDraftApproval = await Effect.runPromise(
      Effect.either(
        api.approveOutboundAction({
          actionType: "outbound_draft",
          entityType: "outbound_draft",
          entityId: "outbound-draft-api-approval-1",
          approved: false,
          actor: { id: "user-1", kind: "user" },
          at: new Date("2026-02-23T12:05:00.000Z"),
        }),
      ),
    );

    expect(Either.isLeft(rejectedDraftApproval)).toBe(true);
    if (Either.isLeft(rejectedDraftApproval)) {
      expect(rejectedDraftApproval.left).toMatchObject({
        _tag: "WorkflowApiError",
        route: "approval.approveOutboundAction",
        message: "outbound actions require explicit approval",
      });
    }

    await Effect.runPromise(
      api.approveOutboundAction({
        actionType: "outbound_draft",
        entityType: "outbound_draft",
        entityId: "outbound-draft-api-approval-1",
        approved: true,
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T12:06:00.000Z"),
      }),
    );

    const persistedDraft = await Effect.runPromise(
      platform.getEntity<{ status: string }>(
        "outbound_draft",
        "outbound-draft-api-approval-1",
      ),
    );

    expect(executeCount).toBe(1);
    expect(persistedDraft?.status).toBe("executed");
  });

  test("job run -> inspect -> retry -> listHistory workflow executes through API handlers", async () => {
    const platform = await Effect.runPromise(buildCorePlatform());
    const api = makeWorkflowApi({ platform });

    await Effect.runPromise(
      api.createJob({
        jobId: "job-api-flow-1",
        name: "Daily planner",
      }),
    );
    await Effect.runPromise(
      api.recordJobRun({
        jobId: "job-api-flow-1",
        outcome: "failed",
        diagnostics: "Webhook timeout",
        actor: { id: "system-1", kind: "system" },
        at: new Date("2026-02-23T17:00:00.000Z"),
      }),
    );

    await Effect.runPromise(
      api.inspectJobRun({
        jobId: "job-api-flow-1",
      }),
    );

    await Effect.runPromise(
      api.retryJob({
        jobId: "job-api-flow-1",
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T17:10:00.000Z"),
      }),
    );

    await Effect.runPromise(
      api.recordJobRun({
        jobId: "job-api-flow-1",
        outcome: "succeeded",
        diagnostics: "Retried successfully",
        actor: { id: "system-1", kind: "system" },
        at: new Date("2026-02-23T17:11:00.000Z"),
      }),
    );
    const history = await Effect.runPromise(
      api.listJobRunHistory({
        jobId: "job-api-flow-1",
      }),
    );

    const inspection = await Effect.runPromise(
      platform.inspectJobRun("job-api-flow-1"),
    );

    expect(inspection.runState).toBe("succeeded");
    expect(inspection.retryCount).toBe(1);
    expect(history).toHaveLength(2);
    expect(history.map((entry) => entry.outcome)).toEqual([
      "succeeded",
      "failed",
    ]);
    expect(history[0]?.retryCount).toBe(1);
    expect(history[1]?.retryCount).toBe(0);
  });

  test("checkpoint create/keep/recover stays auditable and reversible through API handlers", async () => {
    const platform = await Effect.runPromise(buildCorePlatform());
    const api = makeWorkflowApi({ platform });

    await Effect.runPromise(
      api.createWorkflowCheckpoint({
        checkpointId: "checkpoint-api-flow-1",
        name: "Before AI update",
        snapshotEntityRefs: [{ entityType: "task", entityId: "task-api-99" }],
        auditCursor: 3,
        rollbackTarget: "audit-3",
        actor: { id: "user-1", kind: "user" },
      }),
    );
    await Effect.runPromise(
      api.keepCheckpoint({
        checkpointId: "checkpoint-api-flow-1",
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T18:00:00.000Z"),
      }),
    );
    await Effect.runPromise(
      api.recoverCheckpoint({
        checkpointId: "checkpoint-api-flow-1",
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T18:01:00.000Z"),
      }),
    );

    const checkpoint = await Effect.runPromise(
      platform.getEntity<{ status: string }>(
        "checkpoint",
        "checkpoint-api-flow-1",
      ),
    );
    const checkpointAudit = await Effect.runPromise(
      platform.listAuditTrail({
        entityType: "checkpoint",
        entityId: "checkpoint-api-flow-1",
      }),
    );

    expect(checkpoint?.status).toBe("recovered");
    expect(checkpointAudit.map((transition) => transition.toState)).toEqual([
      "created",
      "kept",
      "recovered",
    ]);
  });
});
