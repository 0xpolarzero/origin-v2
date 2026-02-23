import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { createJob } from "../../../../src/core/domain/job";
import { makeInMemoryCoreRepository } from "../../../../src/core/repositories/in-memory-core-repository";
import {
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
});
