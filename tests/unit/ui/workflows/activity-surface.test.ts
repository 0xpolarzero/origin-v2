import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { ActorRef } from "../../../../src/core/domain/common";
import {
  inspectCheckpointFromActivity,
  keepCheckpointFromActivity,
  loadActivitySurface,
  recoverCheckpointFromActivity,
} from "../../../../src/ui/workflows/activity-surface";
import { WorkflowSurfaceClient } from "../../../../src/ui/workflows/workflow-surface-client";

const ACTOR: ActorRef = { id: "user-1", kind: "user" };

const makeClientStub = (): {
  client: WorkflowSurfaceClient;
  calls: Array<{ method: string; input: unknown }>;
} => {
  const calls: Array<{ method: string; input: unknown }> = [];
  let checkpointStatus: "created" | "kept" | "recovered" = "created";

  const client: WorkflowSurfaceClient = {
    listJobs: () => Effect.die("unused"),
    inspectJobRun: () => Effect.die("unused"),
    listJobRunHistory: () => Effect.die("unused"),
    retryJob: () => Effect.die("unused"),
    listActivity: (input = {}) =>
      Effect.sync(() => {
        calls.push({ method: "listActivity", input });
        return [
          {
            id: `activity-${checkpointStatus}`,
            entityType: "checkpoint",
            entityId: "checkpoint-1",
            fromState: checkpointStatus === "created" ? "none" : "created",
            toState: checkpointStatus,
            actor: { id: "ai-1", kind: "ai" as const },
            reason: "checkpoint update",
            at: "2026-02-23T10:00:00.000Z",
          },
        ];
      }),
    inspectWorkflowCheckpoint: (input) =>
      Effect.sync(() => {
        calls.push({ method: "inspectWorkflowCheckpoint", input });
        return {
          id: "checkpoint-1",
          name: "Checkpoint one",
          snapshotEntityRefs: [],
          snapshotEntities: [],
          auditCursor: 1,
          rollbackTarget: "audit-1",
          status: checkpointStatus,
          createdAt: "2026-02-23T10:00:00.000Z",
          updatedAt: "2026-02-23T10:00:00.000Z",
        };
      }),
    keepCheckpoint: (input) =>
      Effect.sync(() => {
        calls.push({ method: "keepCheckpoint", input });
        checkpointStatus = "kept";
        return {
          id: "checkpoint-1",
          name: "Checkpoint one",
          snapshotEntityRefs: [],
          snapshotEntities: [],
          auditCursor: 1,
          rollbackTarget: "audit-1",
          status: checkpointStatus,
          createdAt: "2026-02-23T10:00:00.000Z",
          updatedAt: "2026-02-23T10:01:00.000Z",
        };
      }),
    recoverCheckpoint: (input) =>
      Effect.sync(() => {
        calls.push({ method: "recoverCheckpoint", input });
        checkpointStatus = "recovered";
        return {
          checkpoint: {
            id: "checkpoint-1",
            name: "Checkpoint one",
            snapshotEntityRefs: [],
            snapshotEntities: [],
            auditCursor: 1,
            rollbackTarget: "audit-1",
            status: checkpointStatus,
            createdAt: "2026-02-23T10:00:00.000Z",
            updatedAt: "2026-02-23T10:02:00.000Z",
            recoveredAt: "2026-02-23T10:02:00.000Z",
          },
          recoveredEntityRefs: [],
          rollbackTarget: "audit-1",
        };
      }),
  };

  return { client, calls };
};

describe("activity-surface", () => {
  test("loadActivitySurface stores feed with filters", async () => {
    const { client, calls } = makeClientStub();

    const state = await Effect.runPromise(
      loadActivitySurface(client, {
        aiOnly: true,
        limit: 10,
      }),
    );

    expect(state.feed).toHaveLength(1);
    expect(state.filters).toEqual({ aiOnly: true, limit: 10 });
    expect(calls).toEqual([
      {
        method: "listActivity",
        input: { aiOnly: true, limit: 10 },
      },
    ]);
  });

  test("inspectCheckpointFromActivity updates selected checkpoint", async () => {
    const { client, calls } = makeClientStub();
    const loaded = await Effect.runPromise(loadActivitySurface(client));

    const inspected = await Effect.runPromise(
      inspectCheckpointFromActivity(client, loaded, "checkpoint-1"),
    );

    expect(inspected.selectedCheckpoint?.id).toBe("checkpoint-1");
    expect(inspected.selectedCheckpoint?.status).toBe("created");
    expect(calls.map((call) => call.method)).toEqual([
      "listActivity",
      "inspectWorkflowCheckpoint",
    ]);
  });

  test("keep/recover actions refresh feed and selected checkpoint", async () => {
    const { client, calls } = makeClientStub();
    const loaded = await Effect.runPromise(loadActivitySurface(client));

    const kept = await Effect.runPromise(
      keepCheckpointFromActivity(client, loaded, {
        checkpointId: "checkpoint-1",
        actor: ACTOR,
      }),
    );
    const recovered = await Effect.runPromise(
      recoverCheckpointFromActivity(client, kept, {
        checkpointId: "checkpoint-1",
        actor: ACTOR,
      }),
    );

    expect(kept.selectedCheckpoint?.status).toBe("kept");
    expect(recovered.selectedCheckpoint?.status).toBe("recovered");
    expect(recovered.feed[0]?.toState).toBe("recovered");
    expect(calls.map((call) => call.method)).toEqual([
      "listActivity",
      "keepCheckpoint",
      "inspectWorkflowCheckpoint",
      "listActivity",
      "recoverCheckpoint",
      "inspectWorkflowCheckpoint",
      "listActivity",
    ]);
  });
});
