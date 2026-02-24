import { describe, expect, test } from "bun:test";
import { Either, Effect } from "effect";

import { WorkflowRouteKey } from "../../src/api/workflows/contracts";
import { makeWorkflowHttpDispatcher } from "../../src/api/workflows/http-dispatch";
import { WORKFLOW_ROUTE_PATHS, makeWorkflowRoutes } from "../../src/api/workflows/routes";
import { makeWorkflowApi } from "../../src/api/workflows/workflow-api";
import { buildCorePlatform } from "../../src/core/app/core-platform";
import {
  inspectCheckpointFromActivity,
  keepCheckpointFromActivity,
  loadActivitySurface,
  recoverCheckpointFromActivity,
} from "../../src/ui/workflows/activity-surface";
import {
  inspectJobFromSurface,
  loadJobsSurface,
  retryJobFromSurface,
} from "../../src/ui/workflows/jobs-surface";
import { makeWorkflowSurfaceFiltersStore } from "../../src/ui/workflows/workflow-surface-filters";
import { makeWorkflowSurfaceClient } from "../../src/ui/workflows/workflow-surface-client";

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

describe("workflow surfaces integration", () => {
  test("jobs + activity surfaces orchestrate end-to-end over workflow HTTP dispatcher", async () => {
    const platform = await Effect.runPromise(buildCorePlatform());
    const dispatch = makeWorkflowHttpDispatcher(
      makeWorkflowRoutes(makeWorkflowApi({ platform })),
    );
    const client = makeWorkflowSurfaceClient(dispatch);
    const filtersStore = makeWorkflowSurfaceFiltersStore({
      getJobsView: platform.getJobsView,
      saveJobsView: platform.saveJobsView,
      getActivityView: platform.getActivityView,
      saveActivityView: platform.saveActivityView,
    });

    await expectOk(dispatch, "job.create", {
      jobId: "job-surface-e2e-1",
      name: "Surface orchestration job",
      actor: { id: "system-1", kind: "system" },
      at: "2026-02-23T20:00:00.000Z",
    });
    await expectOk(dispatch, "job.recordRun", {
      jobId: "job-surface-e2e-1",
      outcome: "failed",
      diagnostics: "Timeout",
      actor: { id: "system-1", kind: "system" },
      at: "2026-02-23T20:01:00.000Z",
    });

    let jobsState = await Effect.runPromise(
      loadJobsSurface(client, filtersStore, {
        runState: "failed",
      }),
    );
    jobsState = await Effect.runPromise(
      inspectJobFromSurface(client, jobsState, "job-surface-e2e-1"),
    );
    jobsState = await Effect.runPromise(
      retryJobFromSurface(client, jobsState, {
        jobId: "job-surface-e2e-1",
        actor: ACTOR,
        at: new Date("2026-02-23T20:02:00.000Z"),
        fixSummary: "Increase timeout to 15 seconds",
      }),
    );
    expect(jobsState.inspection?.runState).toBe("retrying");
    expect(jobsState.jobs).toHaveLength(0);
    await expectOk(dispatch, "job.recordRun", {
      jobId: "job-surface-e2e-1",
      outcome: "succeeded",
      diagnostics: "Recovered",
      actor: { id: "system-1", kind: "system" },
      at: "2026-02-23T20:03:00.000Z",
    });
    jobsState = await Effect.runPromise(
      inspectJobFromSurface(client, jobsState, "job-surface-e2e-1"),
    );
    const reloadedJobsState = await Effect.runPromise(
      loadJobsSurface(client, filtersStore),
    );

    await expectOk(dispatch, "checkpoint.create", {
      checkpointId: "checkpoint-surface-e2e-1",
      name: "Before AI apply",
      snapshotEntityRefs: [],
      auditCursor: 15,
      rollbackTarget: "audit-15",
      actor: { id: "ai-1", kind: "ai" },
      at: "2026-02-23T20:04:00.000Z",
    });

    let activityState = await Effect.runPromise(
      loadActivitySurface(client, filtersStore, {
        entityType: "checkpoint",
        entityId: "checkpoint-surface-e2e-1",
      }),
    );
    activityState = await Effect.runPromise(
      inspectCheckpointFromActivity(
        client,
        activityState,
        "checkpoint-surface-e2e-1",
      ),
    );
    activityState = await Effect.runPromise(
      keepCheckpointFromActivity(client, activityState, {
        checkpointId: "checkpoint-surface-e2e-1",
        actor: ACTOR,
        at: new Date("2026-02-23T20:05:00.000Z"),
      }),
    );
    activityState = await Effect.runPromise(
      recoverCheckpointFromActivity(client, activityState, {
        checkpointId: "checkpoint-surface-e2e-1",
        actor: ACTOR,
        at: new Date("2026-02-23T20:06:00.000Z"),
      }),
    );
    const reloadedActivityState = await Effect.runPromise(
      loadActivitySurface(client, filtersStore),
    );

    expect(jobsState.inspection?.runState).toBe("succeeded");
    expect(jobsState.history.map((entry) => entry.outcome)).toEqual([
      "succeeded",
      "failed",
    ]);
    expect(reloadedJobsState.filters).toEqual({
      runState: "failed",
    });
    expect(activityState.selectedCheckpoint?.status).toBe("recovered");
    expect(activityState.feed.some((item) => item.toState === "recovered")).toBe(
      true,
    );
    expect(reloadedActivityState.filters).toEqual({
      entityType: "checkpoint",
      entityId: "checkpoint-surface-e2e-1",
    });
  });

  test("surfaces map dispatcher failures into typed surface errors", async () => {
    const platform = await Effect.runPromise(buildCorePlatform());
    const dispatch = makeWorkflowHttpDispatcher(
      makeWorkflowRoutes(makeWorkflowApi({ platform })),
    );
    const client = makeWorkflowSurfaceClient(dispatch);
    const filtersStore = makeWorkflowSurfaceFiltersStore({
      getJobsView: platform.getJobsView,
      saveJobsView: platform.saveJobsView,
      getActivityView: platform.getActivityView,
      saveActivityView: platform.saveActivityView,
    });

    const jobsLoaded = await Effect.runPromise(loadJobsSurface(client, filtersStore, {}));
    const retryFailure = await Effect.runPromise(
      Effect.either(
        retryJobFromSurface(client, jobsLoaded, {
          jobId: "job-missing-surface-1",
          actor: ACTOR,
        }),
      ),
    );
    expect(Either.isLeft(retryFailure)).toBe(true);
    if (Either.isLeft(retryFailure)) {
      expect(retryFailure.left).toMatchObject({
        _tag: "JobsSurfaceError",
      });
    }

    const activityLoaded = await Effect.runPromise(
      loadActivitySurface(client, filtersStore, {}),
    );
    const keepFailure = await Effect.runPromise(
      Effect.either(
        keepCheckpointFromActivity(client, activityLoaded, {
          checkpointId: "checkpoint-missing-surface-1",
          actor: ACTOR,
        }),
      ),
    );
    expect(Either.isLeft(keepFailure)).toBe(true);
    if (Either.isLeft(keepFailure)) {
      expect(keepFailure.left).toMatchObject({
        _tag: "ActivitySurfaceError",
      });
    }
  });
});
