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

  test("ingests a signal via platform API and persists it before triage", async () => {
    const platform = await Effect.runPromise(buildCorePlatform());

    await Effect.runPromise(
      platform.ingestSignal({
        signalId: "signal-api-1",
        source: "email",
        payload: "Please draft a customer status update",
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T09:05:00.000Z"),
      }),
    );

    const persistedSignal = await Effect.runPromise(
      platform.getEntity<{ triageState: string }>("signal", "signal-api-1"),
    );
    const auditTrail = await Effect.runPromise(
      platform.listAuditTrail({
        entityType: "signal",
        entityId: "signal-api-1",
      }),
    );

    expect(persistedSignal?.triageState).toBe("untriaged");
    expect(auditTrail).toHaveLength(1);
    expect(auditTrail[0]?.fromState).toBe("none");
    expect(auditTrail[0]?.toState).toBe("untriaged");
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

  test("signal ingestion -> triage -> outbound draft request -> explicit approval executes once", async () => {
    let executeCount = 0;
    const platform = await Effect.runPromise(
      buildCorePlatform({
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
      platform.ingestSignal({
        signalId: "signal-api-2",
        source: "chat",
        payload: "Send outbound follow-up draft",
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T09:30:00.000Z"),
      }),
    );
    await Effect.runPromise(
      platform.triageSignal(
        "signal-api-2",
        "requires_outbound",
        { id: "user-1", kind: "user" },
        new Date("2026-02-23T09:31:00.000Z"),
      ),
    );

    const converted = await Effect.runPromise(
      platform.convertSignal({
        signalId: "signal-api-2",
        targetType: "outbound_draft",
        targetId: "outbound-draft-api-1",
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T09:32:00.000Z"),
      }),
    );

    await expect(
      Effect.runPromise(
        platform.approveOutboundAction({
          actionType: "outbound_draft",
          entityType: "outbound_draft",
          entityId: converted.entityId,
          approved: true,
          actor: { id: "user-1", kind: "user" },
          at: new Date("2026-02-23T09:33:00.000Z"),
        }),
      ),
    ).rejects.toThrow("must be in pending_approval");

    const pending = await Effect.runPromise(
      platform.requestOutboundDraftExecution(
        converted.entityId,
        { id: "user-1", kind: "user" },
        new Date("2026-02-23T09:34:00.000Z"),
      ),
    );

    await expect(
      Effect.runPromise(
        platform.approveOutboundAction({
          actionType: "outbound_draft",
          entityType: "outbound_draft",
          entityId: converted.entityId,
          approved: false,
          actor: { id: "user-1", kind: "user" },
          at: new Date("2026-02-23T09:35:00.000Z"),
        }),
      ),
    ).rejects.toThrow("outbound actions require explicit approval");

    const approval = await Effect.runPromise(
      platform.approveOutboundAction({
        actionType: "outbound_draft",
        entityType: "outbound_draft",
        entityId: converted.entityId,
        approved: true,
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T09:36:00.000Z"),
      }),
    );

    const persistedDraft = await Effect.runPromise(
      platform.getEntity<{ status: string; executionId?: string }>(
        "outbound_draft",
        converted.entityId,
      ),
    );
    const draftAuditTrail = await Effect.runPromise(
      platform.listAuditTrail({
        entityType: "outbound_draft",
        entityId: converted.entityId,
      }),
    );

    expect(pending.draft.status).toBe("pending_approval");
    expect(pending.notification.type).toBe("approval_required");
    expect(approval.executionId).toBe("exec-outbound-draft-api-1");
    expect(executeCount).toBe(1);
    expect(persistedDraft?.status).toBe("executed");
    expect(persistedDraft?.executionId).toBe("exec-outbound-draft-api-1");
    expect(draftAuditTrail.map((transition) => transition.toState)).toEqual([
      "draft",
      "pending_approval",
      "executing",
      "executed",
    ]);
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

  test("replays pending outbound draft approval state after restart", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "origin-api-data-outbound-"));
    const snapshotPath = join(tempDir, "state", "snapshot.json");

    try {
      const repositoryA = await Effect.runPromise(
        makeFileCoreRepository(snapshotPath),
      );
      const platformA = await Effect.runPromise(
        buildCorePlatform({
          repository: repositoryA,
          snapshotPath,
        }),
      );

      await Effect.runPromise(
        platformA.ingestSignal({
          signalId: "signal-api-restart-1",
          source: "inbox",
          payload: "Draft outbound recap",
          actor: { id: "user-1", kind: "user" },
          at: new Date("2026-02-23T09:40:00.000Z"),
        }),
      );
      await Effect.runPromise(
        platformA.triageSignal(
          "signal-api-restart-1",
          "requires_outbound",
          { id: "user-1", kind: "user" },
          new Date("2026-02-23T09:41:00.000Z"),
        ),
      );
      await Effect.runPromise(
        platformA.convertSignal({
          signalId: "signal-api-restart-1",
          targetType: "outbound_draft",
          targetId: "outbound-draft-api-restart-1",
          actor: { id: "user-1", kind: "user" },
          at: new Date("2026-02-23T09:42:00.000Z"),
        }),
      );
      await Effect.runPromise(
        platformA.requestOutboundDraftExecution(
          "outbound-draft-api-restart-1",
          { id: "user-1", kind: "user" },
          new Date("2026-02-23T09:43:00.000Z"),
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

      const persistedSignal = await Effect.runPromise(
        platformB.getEntity<{ triageState: string }>(
          "signal",
          "signal-api-restart-1",
        ),
      );
      const persistedDraft = await Effect.runPromise(
        platformB.getEntity<{ status: string }>(
          "outbound_draft",
          "outbound-draft-api-restart-1",
        ),
      );

      expect(persistedSignal?.triageState).toBe("converted");
      expect(persistedDraft?.status).toBe("pending_approval");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
