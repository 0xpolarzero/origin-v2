import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { WORKFLOW_ROUTE_PATHS } from "../../../../src/api/workflows/routes";
import { WorkflowHttpRequest } from "../../../../src/api/workflows/http-dispatch";
import { makeWorkflowSurfaceClient } from "../../../../src/ui/workflows/workflow-surface-client";

describe("workflow-surface-client", () => {
  test("maps client methods to workflow HTTP routes", async () => {
    const requests: Array<WorkflowHttpRequest> = [];
    const client = makeWorkflowSurfaceClient((request) =>
      Effect.sync(() => {
        requests.push(request);
        return {
          status: 200,
          body: { ok: true, route: request.path },
        };
      }),
    );

    await Effect.runPromise(client.listJobs({ runState: "failed", limit: 10 }));
    await Effect.runPromise(client.inspectJobRun({ jobId: "job-1" }));
    await Effect.runPromise(
      client.retryJob({
        jobId: "job-1",
        actor: { id: "user-1", kind: "user" },
        fixSummary: "Increase timeout and retry",
      }),
    );
    await Effect.runPromise(
      client.listActivity({
        aiOnly: true,
        limit: 5,
      }),
    );
    await Effect.runPromise(
      client.inspectWorkflowCheckpoint({ checkpointId: "checkpoint-1" }),
    );
    await Effect.runPromise(
      client.keepCheckpoint({
        checkpointId: "checkpoint-1",
        actor: { id: "user-1", kind: "user" },
      }),
    );
    await Effect.runPromise(
      client.recoverCheckpoint({
        checkpointId: "checkpoint-1",
        actor: { id: "user-1", kind: "user" },
      }),
    );

    expect(requests.map((request) => request.path)).toEqual([
      WORKFLOW_ROUTE_PATHS["job.list"],
      WORKFLOW_ROUTE_PATHS["job.inspectRun"],
      WORKFLOW_ROUTE_PATHS["job.retry"],
      WORKFLOW_ROUTE_PATHS["activity.list"],
      WORKFLOW_ROUTE_PATHS["checkpoint.inspect"],
      WORKFLOW_ROUTE_PATHS["checkpoint.keep"],
      WORKFLOW_ROUTE_PATHS["checkpoint.recover"],
    ]);
    expect(requests.every((request) => request.method === "POST")).toBe(true);
    expect(requests[2]?.body).toMatchObject({
      fixSummary: "Increase timeout and retry",
    });
  });

  test("returns successful response bodies and fails on non-2xx responses", async () => {
    const client = makeWorkflowSurfaceClient((request) =>
      Effect.succeed(
        request.path === WORKFLOW_ROUTE_PATHS["job.list"]
          ? {
              status: 200,
              body: [
                {
                  id: "job-1",
                  name: "Job One",
                  runState: "failed",
                  retryCount: 0,
                  createdAt: "2026-02-23T10:00:00.000Z",
                  updatedAt: "2026-02-23T10:00:00.000Z",
                },
              ],
            }
          : {
              status: 404,
              body: {
                route: "checkpoint.inspect",
                message: "checkpoint checkpoint-1 was not found",
              },
            },
      ),
    );

    const jobs = await Effect.runPromise(client.listJobs({ limit: 1 }));
    expect(jobs).toEqual([
      {
        id: "job-1",
        name: "Job One",
        runState: "failed",
        retryCount: 0,
        createdAt: "2026-02-23T10:00:00.000Z",
        updatedAt: "2026-02-23T10:00:00.000Z",
      },
    ]);

    await expect(
      Effect.runPromise(
        client.inspectWorkflowCheckpoint({ checkpointId: "checkpoint-1" }),
      ),
    ).rejects.toThrow("checkpoint checkpoint-1 was not found");
  });
});
