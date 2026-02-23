import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { buildCorePlatform } from "../../src/core/app/core-platform";

describe("Workflow and Automation integration", () => {
  test("runs planning loop updates and supports complete/defer/reschedule transitions", async () => {
    const platform = await Effect.runPromise(buildCorePlatform());

    await Effect.runPromise(
      platform.captureEntry({
        entryId: "entry-10",
        content: "Prepare board deck",
        actor: { id: "user-1", kind: "user" },
      }),
    );
    await Effect.runPromise(
      platform.acceptEntryAsTask({
        entryId: "entry-10",
        taskId: "task-10",
        actor: { id: "user-1", kind: "user" },
      }),
    );

    await Effect.runPromise(
      platform.deferTask("task-10", new Date("2026-02-24T09:00:00.000Z"), {
        id: "user-1",
        kind: "user",
      }),
    );
    await Effect.runPromise(
      platform.rescheduleTask("task-10", new Date("2026-02-24T15:00:00.000Z"), {
        id: "user-1",
        kind: "user",
      }),
    );
    const completed = await Effect.runPromise(
      platform.completeTask(
        "task-10",
        { id: "user-1", kind: "user" },
        new Date("2026-02-24T16:00:00.000Z"),
      ),
    );

    expect(completed.status).toBe("completed");
  });

  test("records automation run outcomes and supports inspect + retry/fix flow", async () => {
    const platform = await Effect.runPromise(buildCorePlatform());

    await Effect.runPromise(
      platform.createJob({
        jobId: "job-1",
        name: "Daily planner",
      }),
    );

    await Effect.runPromise(
      platform.recordJobRun({
        jobId: "job-1",
        outcome: "failed",
        diagnostics: "Webhook timeout",
        actor: { id: "system-1", kind: "system" },
      }),
    );

    await Effect.runPromise(
      platform.retryJob(
        "job-1",
        { id: "user-1", kind: "user" },
        new Date("2026-02-23T17:10:00.000Z"),
      ),
    );

    await Effect.runPromise(
      platform.recordJobRun({
        jobId: "job-1",
        outcome: "succeeded",
        diagnostics: "Retried successfully",
        actor: { id: "system-1", kind: "system" },
      }),
    );

    const inspection = await Effect.runPromise(platform.inspectJobRun("job-1"));

    expect(inspection.runState).toBe("succeeded");
    expect(inspection.retryCount).toBe(1);
  });

  test("supports AI-applied update inspection and keep/recover audit workflow", async () => {
    const platform = await Effect.runPromise(buildCorePlatform());

    const checkpoint = await Effect.runPromise(
      platform.createWorkflowCheckpoint({
        checkpointId: "checkpoint-ai-1",
        name: "Before AI apply",
        snapshotEntityRefs: [{ entityType: "task", entityId: "task-1" }],
        auditCursor: 3,
        rollbackTarget: "audit-3",
        actor: { id: "user-1", kind: "user" },
      }),
    );

    const kept = await Effect.runPromise(
      platform.keepCheckpoint(
        checkpoint.id,
        { id: "user-1", kind: "user" },
        new Date("2026-02-23T18:00:00.000Z"),
      ),
    );

    const recovered = await Effect.runPromise(
      platform.recoverCheckpoint(
        checkpoint.id,
        { id: "user-1", kind: "user" },
        new Date("2026-02-23T18:01:00.000Z"),
      ),
    );

    const auditTrail = await Effect.runPromise(
      platform.listAuditTrail({
        entityType: "checkpoint",
        entityId: checkpoint.id,
      }),
    );

    expect(kept.status).toBe("kept");
    expect(recovered.checkpoint.status).toBe("recovered");
    expect(auditTrail[auditTrail.length - 1]?.toState).toBe("recovered");
  });
});
