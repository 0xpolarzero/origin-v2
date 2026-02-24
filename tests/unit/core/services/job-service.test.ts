import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { createJob } from "../../../../src/core/domain/job";
import { makeInMemoryCoreRepository } from "../../../../src/core/repositories/in-memory-core-repository";
import {
  inspectJobRun,
  listJobs,
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

  test("retryJobRun stores optional fixSummary in retry transition metadata", async () => {
    const repository = makeInMemoryCoreRepository();
    const job = await Effect.runPromise(
      createJob({
        id: "job-retry-fix-summary-1",
        name: "Retry with fix summary",
      }),
    );
    await Effect.runPromise(repository.saveEntity("job", job.id, job));

    await Effect.runPromise(
      recordJobRun(repository, {
        jobId: "job-retry-fix-summary-1",
        outcome: "failed",
        diagnostics: "Provider timeout",
        actor: { id: "system-1", kind: "system" },
        at: new Date("2026-02-23T14:20:00.000Z"),
      }),
    );

    await Effect.runPromise(
      retryJobRun(
        repository,
        "job-retry-fix-summary-1",
        { id: "user-1", kind: "user" },
        new Date("2026-02-23T14:21:00.000Z"),
        "Increase timeout to 15s and rerun",
      ),
    );

    const auditTrail = await Effect.runPromise(
      repository.listAuditTrail({
        entityType: "job",
        entityId: "job-retry-fix-summary-1",
      }),
    );

    expect(auditTrail[auditTrail.length - 1]?.metadata).toEqual({
      previousFailure: "Provider timeout",
      fixSummary: "Increase timeout to 15s and rerun",
    });
  });

  test("recordJobRun and retryJobRun execute within repository transaction boundaries", async () => {
    const baseRepository = makeInMemoryCoreRepository();
    const transactionCalls: Array<string> = [];
    const repository = {
      ...baseRepository,
      withTransaction: <A, E>(effect: Effect.Effect<A, E>) =>
        Effect.sync(() => {
          transactionCalls.push("withTransaction");
        }).pipe(Effect.zipRight(effect)),
    };

    const job = await Effect.runPromise(
      createJob({
        id: "job-service-transaction-1",
        name: "Job transaction boundary",
      }),
    );
    await Effect.runPromise(repository.saveEntity("job", job.id, job));

    await Effect.runPromise(
      recordJobRun(repository, {
        jobId: "job-service-transaction-1",
        outcome: "failed",
        diagnostics: "timeout",
        actor: { id: "system-1", kind: "system" },
        at: new Date("2026-02-23T14:30:00.000Z"),
      }),
    );

    await Effect.runPromise(
      retryJobRun(
        repository,
        "job-service-transaction-1",
        { id: "user-1", kind: "user" },
        new Date("2026-02-23T14:31:00.000Z"),
      ),
    );

    expect(transactionCalls).toEqual(["withTransaction", "withTransaction"]);
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

  test("listJobRunHistory uses repository-level filtered history query when available", async () => {
    const baseRepository = makeInMemoryCoreRepository();
    const job = await Effect.runPromise(
      createJob({
        id: "job-history-repo-query",
        name: "History from repository query",
      }),
    );
    await Effect.runPromise(baseRepository.saveEntity("job", job.id, job));

    let listEntitiesCalls = 0;
    const repository = {
      ...baseRepository,
      listEntities: <T>(entityType: string) => {
        if (entityType === "job_run_history") {
          listEntitiesCalls += 1;
        }
        return baseRepository.listEntities<T>(entityType);
      },
      listJobRunHistory: () =>
        Effect.succeed([
          {
            id: "repo-history-1",
            jobId: "job-history-repo-query",
            outcome: "succeeded",
            diagnostics: "queried in repository",
            retryCount: 0,
            actorId: "system-1",
            actorKind: "system",
            at: "2026-02-23T20:01:00.000Z",
            createdAt: "2026-02-23T20:01:00.000Z",
          },
        ]),
    };

    const history = await Effect.runPromise(
      listJobRunHistory(repository, {
        jobId: "job-history-repo-query",
        limit: 10,
      }),
    );

    expect(history).toEqual([
      {
        id: "repo-history-1",
        jobId: "job-history-repo-query",
        outcome: "succeeded",
        diagnostics: "queried in repository",
        retryCount: 0,
        actor: { id: "system-1", kind: "system" },
        at: "2026-02-23T20:01:00.000Z",
        createdAt: "2026-02-23T20:01:00.000Z",
      },
    ]);
    expect(listEntitiesCalls).toBe(0);
  });

  test("listJobs uses repository-level filtered query when available", async () => {
    const baseRepository = makeInMemoryCoreRepository();

    let listEntitiesCalls = 0;
    const repository = {
      ...baseRepository,
      listEntities: <T>(entityType: string) => {
        if (entityType === "job") {
          listEntitiesCalls += 1;
        }
        return baseRepository.listEntities<T>(entityType);
      },
      listJobs: () =>
        Effect.succeed([
          {
            id: "job-repo-query-1",
            name: "Repo queried job",
            runState: "failed",
            retryCount: 2,
            createdAt: "2026-02-23T09:00:00.000Z",
            updatedAt: "2026-02-23T10:00:00.000Z",
          },
        ]),
    };

    const jobs = await Effect.runPromise(
      listJobs(repository, {
        runState: "failed",
        limit: 10,
        beforeUpdatedAt: new Date("2026-02-24T00:00:00.000Z"),
      }),
    );

    expect(jobs).toEqual([
      {
        id: "job-repo-query-1",
        name: "Repo queried job",
        runState: "failed",
        retryCount: 2,
        createdAt: "2026-02-23T09:00:00.000Z",
        updatedAt: "2026-02-23T10:00:00.000Z",
        lastRunAt: undefined,
        lastSuccessAt: undefined,
        lastFailureAt: undefined,
        lastFailureReason: undefined,
        diagnostics: undefined,
      },
    ]);
    expect(listEntitiesCalls).toBe(0);
  });

  test("listJobs returns newest-updated-first and supports runState/limit/beforeUpdatedAt filters", async () => {
    const repository = makeInMemoryCoreRepository();
    const jobIdle = await Effect.runPromise(
      createJob({
        id: "job-list-idle-1",
        name: "Idle job",
        createdAt: new Date("2026-02-23T15:58:00.000Z"),
        updatedAt: new Date("2026-02-23T15:58:00.000Z"),
      }),
    );
    const jobFailed = await Effect.runPromise(
      createJob({
        id: "job-list-failed-1",
        name: "Failed job",
        createdAt: new Date("2026-02-23T15:59:00.000Z"),
        updatedAt: new Date("2026-02-23T15:59:00.000Z"),
      }),
    );
    const jobSucceeded = await Effect.runPromise(
      createJob({
        id: "job-list-succeeded-1",
        name: "Succeeded job",
        createdAt: new Date("2026-02-23T16:00:00.000Z"),
        updatedAt: new Date("2026-02-23T16:00:00.000Z"),
      }),
    );
    await Effect.runPromise(repository.saveEntity("job", jobIdle.id, jobIdle));
    await Effect.runPromise(
      repository.saveEntity("job", jobFailed.id, jobFailed),
    );
    await Effect.runPromise(
      repository.saveEntity("job", jobSucceeded.id, jobSucceeded),
    );

    await Effect.runPromise(
      recordJobRun(repository, {
        jobId: "job-list-failed-1",
        outcome: "failed",
        diagnostics: "failed once",
        actor: { id: "system-1", kind: "system" },
        at: new Date("2026-02-23T16:01:00.000Z"),
      }),
    );
    await Effect.runPromise(
      recordJobRun(repository, {
        jobId: "job-list-succeeded-1",
        outcome: "succeeded",
        diagnostics: "passed",
        actor: { id: "system-1", kind: "system" },
        at: new Date("2026-02-23T16:02:00.000Z"),
      }),
    );

    const allJobs = await Effect.runPromise(listJobs(repository));
    const failedOnly = await Effect.runPromise(
      listJobs(repository, { runState: "failed" }),
    );
    const beforeUpdatedAt = await Effect.runPromise(
      listJobs(repository, {
        beforeUpdatedAt: new Date("2026-02-23T16:01:30.000Z"),
      }),
    );
    const limited = await Effect.runPromise(listJobs(repository, { limit: 1 }));

    expect(allJobs.map((job) => job.id)).toEqual([
      "job-list-succeeded-1",
      "job-list-failed-1",
      "job-list-idle-1",
    ]);
    expect(failedOnly.map((job) => job.id)).toEqual(["job-list-failed-1"]);
    expect(beforeUpdatedAt.map((job) => job.id)).toEqual([
      "job-list-failed-1",
      "job-list-idle-1",
    ]);
    expect(limited.map((job) => job.id)).toEqual(["job-list-succeeded-1"]);
  });
});
