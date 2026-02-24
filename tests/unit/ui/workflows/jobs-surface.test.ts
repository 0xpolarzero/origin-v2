import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { ActorRef } from "../../../../src/core/domain/common";
import {
  inspectJobFromSurface,
  loadJobsSurface,
  retryJobFromSurface,
} from "../../../../src/ui/workflows/jobs-surface";
import { WorkflowSurfaceFiltersStore } from "../../../../src/ui/workflows/workflow-surface-filters";
import { WorkflowSurfaceClient } from "../../../../src/ui/workflows/workflow-surface-client";

const ACTOR: ActorRef = { id: "user-1", kind: "user" };

const makeClientStub = (): {
  client: WorkflowSurfaceClient;
  calls: Array<{ method: string; input: unknown }>;
} => {
  const calls: Array<{ method: string; input: unknown }> = [];
  let runState: "failed" | "retrying" = "failed";
  let retryCount = 0;
  let diagnostics = "timeout";

  const client: WorkflowSurfaceClient = {
    listJobs: (input = {}) =>
      Effect.sync(() => {
        calls.push({ method: "listJobs", input });
        return [
          {
            id: "job-1",
            name: "Daily sync",
            runState,
            retryCount,
            diagnostics,
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
          runState,
          retryCount,
          diagnostics,
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
        runState = "retrying";
        retryCount = 1;
        diagnostics = "retry requested";
        return {
          id: "job-1",
          name: "Daily sync",
          runState,
          retryCount,
          diagnostics,
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

const makeFiltersStoreStub = (
  initialJobsFilters: { runState?: "idle" | "running" | "succeeded" | "failed" | "retrying"; limit?: number; beforeUpdatedAt?: Date } = {},
): {
  store: WorkflowSurfaceFiltersStore;
  calls: Array<{ method: string; input?: unknown }>;
} => {
  const calls: Array<{ method: string; input?: unknown }> = [];
  let savedJobsFilters = { ...initialJobsFilters };

  const store: WorkflowSurfaceFiltersStore = {
    loadJobsFilters: () =>
      Effect.sync(() => {
        calls.push({ method: "loadJobsFilters" });
        return { ...savedJobsFilters };
      }),
    saveJobsFilters: (filters) =>
      Effect.sync(() => {
        calls.push({ method: "saveJobsFilters", input: filters });
        savedJobsFilters = { ...filters };
      }),
    loadActivityFilters: () => Effect.die("unused"),
    saveActivityFilters: () => Effect.die("unused"),
  };

  return { store, calls };
};

describe("jobs-surface", () => {
  test("loadJobsSurface persists explicit filters and loads list state", async () => {
    const { client, calls } = makeClientStub();
    const { store, calls: storeCalls } = makeFiltersStoreStub();

    const state = await Effect.runPromise(
      loadJobsSurface(client, store, { runState: "failed", limit: 10 }),
    );

    expect(state.jobs).toHaveLength(1);
    expect(state.jobs[0]?.id).toBe("job-1");
    expect(state.filters).toEqual({ runState: "failed", limit: 10 });
    expect(storeCalls).toEqual([
      {
        method: "saveJobsFilters",
        input: { runState: "failed", limit: 10 },
      },
    ]);
    expect(calls).toEqual([
      {
        method: "listJobs",
        input: { runState: "failed", limit: 10 },
      },
    ]);
  });

  test("loadJobsSurface reuses persisted filters when no input is provided", async () => {
    const { client, calls } = makeClientStub();
    const { store, calls: storeCalls } = makeFiltersStoreStub({
      runState: "retrying",
      limit: 5,
    });

    const state = await Effect.runPromise(loadJobsSurface(client, store));

    expect(state.filters).toEqual({
      runState: "retrying",
      limit: 5,
    });
    expect(storeCalls.map((call) => call.method)).toEqual(["loadJobsFilters"]);
    expect(calls).toEqual([
      {
        method: "listJobs",
        input: { runState: "retrying", limit: 5 },
      },
    ]);
  });

  test("inspectJobFromSurface loads run inspection and history", async () => {
    const { client, calls } = makeClientStub();
    const { store } = makeFiltersStoreStub();
    const loaded = await Effect.runPromise(loadJobsSurface(client, store, {}));

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
    const { store } = makeFiltersStoreStub();
    const loaded = await Effect.runPromise(loadJobsSurface(client, store, {}));
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
    expect(retried.jobs[0]?.runState).toBe("retrying");
    expect(retried.selectedJobId).toBe("job-1");
    expect(retried.inspection?.runState).toBe("retrying");
    expect(retried.inspection?.retryCount).toBe(1);
    expect(retried.history).toHaveLength(1);
    expect(calls.map((call) => call.method)).toEqual([
      "listJobs",
      "inspectJobRun",
      "listJobRunHistory",
      "retryJob",
      "listJobs",
      "inspectJobRun",
      "listJobRunHistory",
    ]);
  });
});
