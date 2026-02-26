import { describe, expect, test } from "bun:test";
import { Either, Effect } from "effect";

import { buildCorePlatform } from "../../src/core/app/core-platform";
import { makeInMemoryCoreRepository } from "../../src/core/repositories/in-memory-core-repository";

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

  test("retryJob missing-job failures stay deterministic and side-effect free", async () => {
    const platform = await Effect.runPromise(buildCorePlatform());
    const actor = { id: "user-1", kind: "user" } as const;
    const firstAttempt = await Effect.runPromise(
      Effect.either(
        platform.retryJob(
          "job-missing-automation-1",
          actor,
          new Date("2026-02-23T18:10:00.000Z"),
        ),
      ),
    );
    const secondAttempt = await Effect.runPromise(
      Effect.either(
        platform.retryJob(
          "job-missing-automation-1",
          actor,
          new Date("2026-02-23T18:11:00.000Z"),
        ),
      ),
    );

    expect(Either.isLeft(firstAttempt)).toBe(true);
    expect(Either.isLeft(secondAttempt)).toBe(true);
    if (Either.isLeft(firstAttempt) && Either.isLeft(secondAttempt)) {
      expect(firstAttempt.left.message).toContain("job job-missing-automation-1");
      expect(firstAttempt.left.message).toBe(secondAttempt.left.message);
    }

    const jobs = await Effect.runPromise(platform.listEntities("job"));
    const history = await Effect.runPromise(
      platform.listEntities("job_run_history"),
    );
    const audit = await Effect.runPromise(
      platform.listAuditTrail({
        entityType: "job",
        entityId: "job-missing-automation-1",
      }),
    );
    expect(jobs).toHaveLength(0);
    expect(history).toHaveLength(0);
    expect(audit).toHaveLength(0);
  });

  test("recoverCheckpoint failure keeps checkpoint and data state consistent", async () => {
    const repository = makeInMemoryCoreRepository();
    const platform = await Effect.runPromise(
      buildCorePlatform({
        repository,
      }),
    );

    await Effect.runPromise(
      platform.captureEntry({
        entryId: "entry-checkpoint-failure-1",
        content: "Initial content",
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T18:12:00.000Z"),
      }),
    );
    await Effect.runPromise(
      platform.createWorkflowCheckpoint({
        checkpointId: "checkpoint-failure-1",
        name: "Before invalid recovery",
        snapshotEntityRefs: [
          { entityType: "entry", entityId: "entry-checkpoint-failure-1" },
        ],
        auditCursor: 2,
        rollbackTarget: "audit-2",
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T18:13:00.000Z"),
      }),
    );

    const entryAfterCapture = await Effect.runPromise(
      repository.getEntity<{
        id: string;
        content: string;
        source: string;
        status: string;
        capturedAt: string;
        createdAt: string;
        updatedAt: string;
      }>("entry", "entry-checkpoint-failure-1"),
    );
    if (!entryAfterCapture) {
      throw new Error("expected captured entry to exist");
    }

    await Effect.runPromise(
      repository.saveEntity("entry", "entry-checkpoint-failure-1", {
        ...entryAfterCapture,
        content: "Mutated content after checkpoint",
      }),
    );

    const checkpoint = await Effect.runPromise(
      repository.getEntity<{
        id: string;
        name: string;
        snapshotEntityRefs: Array<{ entityType: string; entityId: string }>;
        snapshotEntities: Array<{
          entityType: string;
          entityId: string;
          existed: boolean;
          state?: unknown;
        }>;
        auditCursor: number;
        rollbackTarget: string;
        status: string;
        createdAt: string;
        updatedAt: string;
      }>("checkpoint", "checkpoint-failure-1"),
    );
    if (!checkpoint) {
      throw new Error("expected checkpoint to exist");
    }

    await Effect.runPromise(
      repository.saveEntity("checkpoint", checkpoint.id, {
        ...checkpoint,
        snapshotEntities: checkpoint.snapshotEntities.map((snapshot) => ({
          ...snapshot,
          existed: true,
          state: undefined,
        })),
      }),
    );

    const recoverResult = await Effect.runPromise(
      Effect.either(
        platform.recoverCheckpoint(
          "checkpoint-failure-1",
          { id: "user-1", kind: "user" },
          new Date("2026-02-23T18:14:00.000Z"),
        ),
      ),
    );

    expect(Either.isLeft(recoverResult)).toBe(true);
    if (Either.isLeft(recoverResult)) {
      expect(recoverResult.left.message).toContain("invalid snapshot");
    }

    const persistedEntry = await Effect.runPromise(
      repository.getEntity<{ content: string }>(
        "entry",
        "entry-checkpoint-failure-1",
      ),
    );
    const persistedCheckpoint = await Effect.runPromise(
      repository.getEntity<{ status: string }>("checkpoint", "checkpoint-failure-1"),
    );
    const checkpointAudit = await Effect.runPromise(
      platform.listAuditTrail({
        entityType: "checkpoint",
        entityId: "checkpoint-failure-1",
      }),
    );

    expect(persistedEntry?.content).toBe("Mutated content after checkpoint");
    expect(persistedCheckpoint?.status).toBe("created");
    expect(
      checkpointAudit.filter((transition) => transition.toState === "recovered"),
    ).toHaveLength(0);
  });
});
