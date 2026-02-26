import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Effect } from "effect";

import { buildCorePlatform } from "../../src/core/app/core-platform";
import { createEvent } from "../../src/core/domain/event";
import { makeFileCoreRepository } from "../../src/core/repositories/file-core-repository";
import { makeInMemoryCoreRepository } from "../../src/core/repositories/in-memory-core-repository";

describe("API and Data integration scaffold", () => {
  test("captures input and persists an Entry before AI suggestion is surfaced", async () => {
    const platform = await Effect.runPromise(buildCorePlatform());

    await Effect.runPromise(
      platform.captureEntry({
        entryId: "entry-api-1",
        content: "Draft response for customer",
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T09:00:00.000Z"),
      }),
    );

    const persistedAfterCapture = await Effect.runPromise(
      platform.getEntity<{
        id: string;
        status: string;
      }>("entry", "entry-api-1"),
    );

    await Effect.runPromise(
      platform.suggestEntryAsTask({
        entryId: "entry-api-1",
        suggestedTitle: "Reply to customer with updated timeline",
        actor: { id: "ai-1", kind: "ai" },
        at: new Date("2026-02-23T09:01:00.000Z"),
      }),
    );

    const persistedAfterSuggestion = await Effect.runPromise(
      platform.getEntity<{
        status: string;
        suggestedTaskTitle?: string;
      }>("entry", "entry-api-1"),
    );
    const auditTrail = await Effect.runPromise(
      platform.listAuditTrail({ entityType: "entry", entityId: "entry-api-1" }),
    );

    expect(persistedAfterCapture?.status).toBe("captured");
    expect(persistedAfterSuggestion?.status).toBe("suggested");
    expect(persistedAfterSuggestion?.suggestedTaskTitle).toBe(
      "Reply to customer with updated timeline",
    );
    expect(auditTrail[0]?.toState).toBe("captured");
    expect(auditTrail[1]?.toState).toBe("suggested");
  });

  test("requires explicit approval before any outbound sync action executes", async () => {
    const repository = makeInMemoryCoreRepository();
    const event = await Effect.runPromise(
      createEvent({
        id: "event-api-1",
        title: "Launch sync candidate",
        startAt: new Date("2026-02-24T12:00:00.000Z"),
      }),
    );
    await Effect.runPromise(repository.saveEntity("event", event.id, event));

    let executeCount = 0;
    const platform = await Effect.runPromise(
      buildCorePlatform({
        repository,
        outboundActionPort: {
          execute: (action) =>
            Effect.sync(() => {
              executeCount += 1;
              return { executionId: `exec-${action.entityId}` };
            }),
        },
      }),
    );

    await Effect.runPromise(
      platform.requestEventSync(
        event.id,
        { id: "user-1", kind: "user" },
        new Date("2026-02-23T09:10:00.000Z"),
      ),
    );

    await expect(
      Effect.runPromise(
        platform.approveOutboundAction({
          actionType: "event_sync",
          entityType: "event",
          entityId: event.id,
          approved: false,
          actor: { id: "user-1", kind: "user" },
          at: new Date("2026-02-23T09:11:00.000Z"),
        }),
      ),
    ).rejects.toThrow("outbound actions require explicit approval");
    expect(executeCount).toBe(0);

    await Effect.runPromise(
      platform.approveOutboundAction({
        actionType: "event_sync",
        entityType: "event",
        entityId: event.id,
        approved: true,
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T09:12:00.000Z"),
      }),
    );

    const persistedEvent = await Effect.runPromise(
      platform.getEntity<{ syncState: string }>("event", event.id),
    );
    expect(executeCount).toBe(1);
    expect(persistedEvent?.syncState).toBe("synced");
  });

  test("replays pending approval state after restart and preserves local-first data", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "origin-api-data-"));
    const snapshotPath = join(tempDir, "state", "snapshot.json");

    try {
      const repositoryA = await Effect.runPromise(
        makeFileCoreRepository(snapshotPath),
      );
      const event = await Effect.runPromise(
        createEvent({
          id: "event-api-2",
          title: "Pending approval event",
          startAt: new Date("2026-02-25T13:00:00.000Z"),
        }),
      );
      await Effect.runPromise(repositoryA.saveEntity("event", event.id, event));

      const platformA = await Effect.runPromise(
        buildCorePlatform({
          repository: repositoryA,
          snapshotPath,
        }),
      );

      await Effect.runPromise(
        platformA.captureEntry({
          entryId: "entry-api-2",
          content: "Preserve locally-authored capture",
          actor: { id: "user-1", kind: "user" },
        }),
      );
      await Effect.runPromise(
        platformA.requestEventSync(
          event.id,
          { id: "user-1", kind: "user" },
          new Date("2026-02-23T09:20:00.000Z"),
        ),
      );
      await Effect.runPromise(platformA.persistSnapshot());

      const repositoryB = await Effect.runPromise(
        makeFileCoreRepository(snapshotPath),
      );
      const platformB = await Effect.runPromise(
        buildCorePlatform({
          repository: repositoryB,
          snapshotPath,
          loadSnapshotOnInit: true,
        }),
      );

      const persistedEntry = await Effect.runPromise(
        platformB.getEntity<{ id: string }>("entry", "entry-api-2"),
      );
      const persistedEvent = await Effect.runPromise(
        platformB.getEntity<{ syncState: string }>("event", "event-api-2"),
      );

      expect(persistedEntry?.id).toBe("entry-api-2");
      expect(persistedEvent?.syncState).toBe("pending_approval");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
