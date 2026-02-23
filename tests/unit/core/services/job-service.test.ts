import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { createJob } from "../../../../src/core/domain/job";
import { makeInMemoryCoreRepository } from "../../../../src/core/repositories/in-memory-core-repository";
import {
  inspectJobRun,
  listJobRunHistory,
  recordJobRun,
  retryJobRun,
} from "../../../../src/core/services/job-service";

describe("job-service", () => {
  test("recordJobRun stores success/failure outcome and diagnostics", async () => {
    const repository = makeInMemoryCoreRepository();
    const job = await Effect.runPromise(
      createJob({
        id: "job-1",
        name: "Nightly summary",
      }),
    );
    await Effect.runPromise(repository.saveEntity("job", job.id, job));

    const failed = await Effect.runPromise(
      recordJobRun(repository, {
        jobId: "job-1",
        outcome: "failed",
        diagnostics: "Timeout while fetching signals",
        actor: { id: "system-1", kind: "system" },
        at: new Date("2026-02-23T14:00:00.000Z"),
      }),
    );

    const succeeded = await Effect.runPromise(
      recordJobRun(repository, {
        jobId: "job-1",
        outcome: "succeeded",
        diagnostics: "All checks passed",
        actor: { id: "system-1", kind: "system" },
        at: new Date("2026-02-23T14:05:00.000Z"),
      }),
    );

    expect(failed.runState).toBe("failed");
    expect(failed.lastFailureReason).toBe("Timeout while fetching signals");
    expect(succeeded.runState).toBe("succeeded");
    expect(succeeded.diagnostics).toBe("All checks passed");
  });

  test("recordJobRun appends one job_run_history row per run with diagnostics and retry snapshot", async () => {
    const repository = makeInMemoryCoreRepository();
    const job = await Effect.runPromise(
      createJob({
        id: "job-history-1",
        name: "History audit",
      }),
    );
    await Effect.runPromise(repository.saveEntity("job", job.id, job));

    await Effect.runPromise(
      recordJobRun(repository, {
        jobId: "job-history-1",
        outcome: "failed",
        diagnostics: "First failure",
        actor: { id: "system-1", kind: "system" },
        at: new Date("2026-02-23T15:00:00.000Z"),
      }),
    );

    await Effect.runPromise(
      retryJobRun(
        repository,
        "job-history-1",
        { id: "user-1", kind: "user" },
        new Date("2026-02-23T15:01:00.000Z"),
      ),
    );

    await Effect.runPromise(
      recordJobRun(repository, {
        jobId: "job-history-1",
        outcome: "succeeded",
        diagnostics: "Recovered",
        actor: { id: "system-1", kind: "system" },
        at: new Date("2026-02-23T15:02:00.000Z"),
      }),
    );

    const history = await Effect.runPromise(
      repository.listEntities<{
        id: string;
        jobId: string;
        outcome: "succeeded" | "failed";
        diagnostics: string;
        retryCount: number;
        actor: { id: string; kind: "user" | "system" | "ai" };
        at: string;
        createdAt: string;
      }>("job_run_history"),
    );

    expect(history).toHaveLength(2);
    expect(history.map((entry) => entry.outcome)).toEqual([
      "failed",
      "succeeded",
    ]);
    expect(history.map((entry) => entry.diagnostics)).toEqual([
      "First failure",
      "Recovered",
    ]);
    expect(history.map((entry) => entry.retryCount)).toEqual([0, 1]);
    expect(history.map((entry) => entry.actor.id)).toEqual([
      "system-1",
      "system-1",
    ]);
    expect(history[0]?.at).toBe("2026-02-23T15:00:00.000Z");
    expect(history[1]?.at).toBe("2026-02-23T15:02:00.000Z");
  });

  test("retryJobRun increments retry count and links prior failure", async () => {
    const repository = makeInMemoryCoreRepository();
    const job = await Effect.runPromise(
      createJob({
        id: "job-2",
        name: "Nightly summary",
      }),
    );
    await Effect.runPromise(repository.saveEntity("job", job.id, job));

    await Effect.runPromise(
      recordJobRun(repository, {
        jobId: "job-2",
        outcome: "failed",
        diagnostics: "API 503",
        actor: { id: "system-1", kind: "system" },
        at: new Date("2026-02-23T14:10:00.000Z"),
      }),
    );

    const retried = await Effect.runPromise(
      retryJobRun(
        repository,
        "job-2",
        { id: "user-1", kind: "user" },
        new Date("2026-02-23T14:12:00.000Z"),
      ),
    );

    const auditTrail = await Effect.runPromise(
      repository.listAuditTrail({ entityType: "job", entityId: "job-2" }),
    );

    expect(retried.runState).toBe("retrying");
    expect(retried.retryCount).toBe(1);
    expect(retried.diagnostics).toContain("Retry requested");
    expect(auditTrail[auditTrail.length - 1]?.toState).toBe("retrying");
  });

  test("inspectJobRun returns current status snapshot for a job", async () => {
    const repository = makeInMemoryCoreRepository();
    const job = await Effect.runPromise(
      createJob({
        id: "job-3",
        name: "Digest generator",
      }),
    );
    await Effect.runPromise(repository.saveEntity("job", job.id, job));

    await Effect.runPromise(
      recordJobRun(repository, {
        jobId: "job-3",
        outcome: "failed",
        diagnostics: "Provider timeout",
        actor: { id: "system-1", kind: "system" },
      }),
    );

    const inspected = await Effect.runPromise(
      inspectJobRun(repository, "job-3"),
    );
    expect(inspected.jobId).toBe("job-3");
    expect(inspected.runState).toBe("failed");
    expect(inspected.lastFailureReason).toBe("Provider timeout");
  });

  test("inspectJobRun fails for missing jobs", async () => {
    const repository = makeInMemoryCoreRepository();

    await expect(
      Effect.runPromise(inspectJobRun(repository, "job-missing")),
    ).rejects.toThrow("job job-missing was not found");
  });

  test("listJobRunHistory returns newest-first and honors limit/beforeAt filters", async () => {
    const repository = makeInMemoryCoreRepository();
    const job = await Effect.runPromise(
      createJob({
        id: "job-history-2",
        name: "History list",
      }),
    );
    await Effect.runPromise(repository.saveEntity("job", job.id, job));

    await Effect.runPromise(
      recordJobRun(repository, {
        jobId: "job-history-2",
        outcome: "failed",
        diagnostics: "first",
        actor: { id: "system-1", kind: "system" },
        at: new Date("2026-02-23T16:00:00.000Z"),
      }),
    );
    await Effect.runPromise(
      retryJobRun(
        repository,
        "job-history-2",
        { id: "user-1", kind: "user" },
        new Date("2026-02-23T16:01:00.000Z"),
      ),
    );
    await Effect.runPromise(
      recordJobRun(repository, {
        jobId: "job-history-2",
        outcome: "succeeded",
        diagnostics: "second",
        actor: { id: "system-1", kind: "system" },
        at: new Date("2026-02-23T16:02:00.000Z"),
      }),
    );

    const allHistory = await Effect.runPromise(
      listJobRunHistory(repository, { jobId: "job-history-2" }),
    );
    const limitedHistory = await Effect.runPromise(
      listJobRunHistory(repository, { jobId: "job-history-2", limit: 1 }),
    );
    const beforeFiltered = await Effect.runPromise(
      listJobRunHistory(repository, {
        jobId: "job-history-2",
        beforeAt: new Date("2026-02-23T16:01:30.000Z"),
      }),
    );

    expect(allHistory.map((entry) => entry.outcome)).toEqual([
      "succeeded",
      "failed",
    ]);
    expect(limitedHistory).toHaveLength(1);
    expect(limitedHistory[0]?.outcome).toBe("succeeded");
    expect(beforeFiltered.map((entry) => entry.outcome)).toEqual(["failed"]);
  });
});
