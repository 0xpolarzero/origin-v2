import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { ActorRef } from "../../../../src/core/domain/common";
import {
  inspectJobFromSurface,
  loadJobsSurface,
  retryJobFromSurface,
} from "../../../../src/ui/workflows/jobs-surface";
import { WorkflowSurfaceClient } from "../../../../src/ui/workflows/workflow-surface-client";

const ACTOR: ActorRef = { id: "user-1", kind: "user" };

const makeClientStub = (): {
  client: WorkflowSurfaceClient;
  calls: Array<{ method: string; input: unknown }>;
} => {
  const calls: Array<{ method: string; input: unknown }> = [];

  const client: WorkflowSurfaceClient = {
    listJobs: (input = {}) =>
      Effect.sync(() => {
        calls.push({ method: "listJobs", input });
        return [
          {
            id: "job-1",
            name: "Daily sync",
            runState: "failed",
            retryCount: 0,
            diagnostics: "timeout",
            createdAt: "2026-02-23T10:00:00.000Z",
            updatedAt: "2026-02-23T10:00:00.000Z",
          },
        ];
      }),
    inspectJobRun: (input) =>
      Effect.sync(() => {
        calls.push({ method: "inspectJobRun", input });
        return {
          jobId: "job-1",
          runState: "failed",
          retryCount: 0,
          diagnostics: "timeout",
          lastFailureReason: "timeout",
        };
      }),
    listJobRunHistory: (input) =>
      Effect.sync(() => {
        calls.push({ method: "listJobRunHistory", input });
        return [
          {
            id: "history-1",
            jobId: "job-1",
            outcome: "failed" as const,
            diagnostics: "timeout",
            retryCount: 0,
            actor: { id: "system-1", kind: "system" as const },
            at: "2026-02-23T10:00:00.000Z",
            createdAt: "2026-02-23T10:00:00.000Z",
          },
        ];
      }),
    retryJob: (input) =>
      Effect.sync(() => {
        calls.push({ method: "retryJob", input });
        return {
          id: "job-1",
          name: "Daily sync",
          runState: "retrying" as const,
          retryCount: 1,
          diagnostics: "retry requested",
          createdAt: "2026-02-23T10:00:00.000Z",
          updatedAt: "2026-02-23T10:01:00.000Z",
        };
      }),
    listActivity: () => Effect.die("unused"),
    inspectWorkflowCheckpoint: () => Effect.die("unused"),
    keepCheckpoint: () => Effect.die("unused"),
    recoverCheckpoint: () => Effect.die("unused"),
  };

  return { client, calls };
};

describe("jobs-surface", () => {
  test("loadJobsSurface loads list state", async () => {
    const { client, calls } = makeClientStub();

    const state = await Effect.runPromise(
      loadJobsSurface(client, { runState: "failed", limit: 10 }),
    );

    expect(state.jobs).toHaveLength(1);
    expect(state.jobs[0]?.id).toBe("job-1");
    expect(state.filters).toEqual({ runState: "failed", limit: 10 });
    expect(calls).toEqual([
      {
        method: "listJobs",
        input: { runState: "failed", limit: 10 },
      },
    ]);
  });

  test("inspectJobFromSurface loads run inspection and history", async () => {
    const { client, calls } = makeClientStub();
    const loaded = await Effect.runPromise(loadJobsSurface(client));

    const inspected = await Effect.runPromise(
      inspectJobFromSurface(client, loaded, "job-1"),
    );

    expect(inspected.selectedJobId).toBe("job-1");
    expect(inspected.inspection?.runState).toBe("failed");
    expect(inspected.history).toHaveLength(1);
    expect(calls.map((call) => call.method)).toEqual([
      "listJobs",
      "inspectJobRun",
      "listJobRunHistory",
    ]);
  });

  test("retryJobFromSurface forwards fixSummary and refreshes state", async () => {
    const { client, calls } = makeClientStub();
    const loaded = await Effect.runPromise(loadJobsSurface(client));
    const inspected = await Effect.runPromise(
      inspectJobFromSurface(client, loaded, "job-1"),
    );

    const retried = await Effect.runPromise(
      retryJobFromSurface(client, inspected, {
        jobId: "job-1",
        actor: ACTOR,
        at: new Date("2026-02-23T10:01:00.000Z"),
        fixSummary: "Increase timeout and retry",
      }),
    );

    const retryCall = calls.find((call) => call.method === "retryJob");

    expect(retryCall).toBeDefined();
    expect(retryCall?.input).toMatchObject({
      jobId: "job-1",
      fixSummary: "Increase timeout and retry",
    });
    expect(retried.jobs[0]?.id).toBe("job-1");
    expect(retried.selectedJobId).toBe("job-1");
    expect(retried.history).toHaveLength(1);
  });
});
