import { Database } from "bun:sqlite";
import { describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Effect } from "effect";

import { buildCorePlatform } from "../../src/core/app/core-platform";
import { CORE_DB_MIGRATIONS } from "../../src/core/repositories/sqlite/migrations";

const createTempPaths = (): {
  tempDir: string;
  databasePath: string;
  snapshotPath: string;
} => {
  const tempDir = mkdtempSync(join(tmpdir(), "origin-db-platform-"));
  return {
    tempDir,
    databasePath: join(tempDir, "core.sqlite"),
    snapshotPath: join(tempDir, "legacy-snapshot.json"),
  };
};

describe("database-backed core platform", () => {
  test("buildCorePlatform({ databasePath }) runs migrations and supports existing workflow routes", async () => {
    const { tempDir, databasePath } = createTempPaths();

    try {
      const platform = await Effect.runPromise(
        buildCorePlatform({
          databasePath,
        }),
      );

      await Effect.runPromise(
        platform.captureEntry({
          entryId: "entry-db-1",
          content: "Use sqlite backend",
          actor: { id: "user-1", kind: "user" },
        }),
      );
      await Effect.runPromise(
        platform.acceptEntryAsTask({
          entryId: "entry-db-1",
          taskId: "task-db-1",
          actor: { id: "user-1", kind: "user" },
        }),
      );

      const task = await Effect.runPromise(
        platform.getEntity<{ id: string; status: string }>("task", "task-db-1"),
      );

      const db = new Database(databasePath, { readonly: true });
      const migrationCount = db
        .query("SELECT COUNT(*) AS count FROM schema_migrations")
        .get() as { count: number };
      db.close();

      expect(task?.id).toBe("task-db-1");
      expect(task?.status).toBe("planned");
      expect(migrationCount.count).toBe(CORE_DB_MIGRATIONS.length);

      if (!platform.close) {
        throw new Error("database-backed platform should expose close()");
      }
      await Effect.runPromise(platform.close());
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("database backend preserves local data and pending approval state across restart", async () => {
    const { tempDir, databasePath } = createTempPaths();

    try {
      const platformA = await Effect.runPromise(
        buildCorePlatform({
          databasePath,
        }),
      );

      await Effect.runPromise(
        platformA.captureEntry({
          entryId: "entry-db-restart-1",
          content: "Persist this authored entry",
          actor: { id: "user-1", kind: "user" },
        }),
      );
      await Effect.runPromise(
        platformA.ingestSignal({
          signalId: "signal-db-restart-1",
          source: "email",
          payload: "Draft outbound status update",
          actor: { id: "user-1", kind: "user" },
        }),
      );
      await Effect.runPromise(
        platformA.triageSignal("signal-db-restart-1", "requires_outbound", {
          id: "user-1",
          kind: "user",
        }),
      );
      await Effect.runPromise(
        platformA.convertSignal({
          signalId: "signal-db-restart-1",
          targetType: "outbound_draft",
          targetId: "outbound-draft-db-restart-1",
          actor: { id: "user-1", kind: "user" },
        }),
      );
      await Effect.runPromise(
        platformA.requestOutboundDraftExecution(
          "outbound-draft-db-restart-1",
          { id: "user-1", kind: "user" },
          new Date("2026-02-23T14:00:00.000Z"),
        ),
      );

      if (!platformA.close) {
        throw new Error("database-backed platform should expose close()");
      }
      await Effect.runPromise(platformA.close());

      const platformB = await Effect.runPromise(
        buildCorePlatform({
          databasePath,
        }),
      );

      const entry = await Effect.runPromise(
        platformB.getEntity<{ id: string }>("entry", "entry-db-restart-1"),
      );
      const draft = await Effect.runPromise(
        platformB.getEntity<{ status: string }>(
          "outbound_draft",
          "outbound-draft-db-restart-1",
        ),
      );

      expect(entry?.id).toBe("entry-db-restart-1");
      expect(draft?.status).toBe("pending_approval");

      if (!platformB.close) {
        throw new Error("database-backed platform should expose close()");
      }
      await Effect.runPromise(platformB.close());
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("database backend converts triaged signals into tasks without entry links", async () => {
    const { tempDir, databasePath } = createTempPaths();

    try {
      const platform = await Effect.runPromise(
        buildCorePlatform({
          databasePath,
        }),
      );

      await Effect.runPromise(
        platform.ingestSignal({
          signalId: "signal-db-task-convert-1",
          source: "email",
          payload: "Turn this into a task",
          actor: { id: "user-1", kind: "user" },
          at: new Date("2026-02-23T15:00:00.000Z"),
        }),
      );
      await Effect.runPromise(
        platform.triageSignal(
          "signal-db-task-convert-1",
          "ready_for_conversion",
          { id: "user-1", kind: "user" },
          new Date("2026-02-23T15:01:00.000Z"),
        ),
      );

      const converted = await Effect.runPromise(
        platform.convertSignal({
          signalId: "signal-db-task-convert-1",
          targetType: "task",
          targetId: "task-db-from-signal-1",
          actor: { id: "user-1", kind: "user" },
          at: new Date("2026-02-23T15:02:00.000Z"),
        }),
      );

      const task = await Effect.runPromise(
        platform.getEntity<{ status: string; sourceEntryId?: string }>(
          "task",
          "task-db-from-signal-1",
        ),
      );
      const signal = await Effect.runPromise(
        platform.getEntity<{
          triageState: string;
          convertedEntityType?: string;
          convertedEntityId?: string;
        }>("signal", "signal-db-task-convert-1"),
      );

      expect(converted).toEqual({
        entityType: "task",
        entityId: "task-db-from-signal-1",
      });
      expect(task?.status).toBe("planned");
      expect(task?.sourceEntryId).toBeUndefined();
      expect(signal?.triageState).toBe("converted");
      expect(signal?.convertedEntityType).toBe("task");
      expect(signal?.convertedEntityId).toBe("task-db-from-signal-1");

      if (!platform.close) {
        throw new Error("database-backed platform should expose close()");
      }
      await Effect.runPromise(platform.close());
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("database backend executes approved event_sync actions and persists synced state", async () => {
    const { tempDir, databasePath } = createTempPaths();

    try {
      const execute = mock(async (_action: unknown) => ({
        executionId: "exec-sqlite-event-sync-1",
      }));
      const platform = await Effect.runPromise(
        buildCorePlatform({
          databasePath,
          outboundActionPort: {
            execute: (action) => Effect.promise(() => execute(action)),
          },
        }),
      );

      await Effect.runPromise(
        platform.ingestSignal({
          signalId: "signal-db-event-approval-1",
          source: "calendar",
          payload: "Board review",
          actor: { id: "user-1", kind: "user" },
          at: new Date("2026-02-23T16:00:00.000Z"),
        }),
      );
      await Effect.runPromise(
        platform.triageSignal(
          "signal-db-event-approval-1",
          "schedule_event",
          { id: "user-1", kind: "user" },
          new Date("2026-02-23T16:01:00.000Z"),
        ),
      );
      await Effect.runPromise(
        platform.convertSignal({
          signalId: "signal-db-event-approval-1",
          targetType: "event",
          targetId: "event-db-approval-1",
          actor: { id: "user-1", kind: "user" },
          at: new Date("2026-02-23T16:02:00.000Z"),
        }),
      );

      await Effect.runPromise(
        platform.requestEventSync(
          "event-db-approval-1",
          { id: "user-1", kind: "user" },
          new Date("2026-02-23T16:03:00.000Z"),
        ),
      );

      const approved = await Effect.runPromise(
        platform.approveOutboundAction({
          actionType: "event_sync",
          entityType: "event",
          entityId: "event-db-approval-1",
          approved: true,
          actor: { id: "user-1", kind: "user" },
          at: new Date("2026-02-23T16:04:00.000Z"),
        }),
      );
      const event = await Effect.runPromise(
        platform.getEntity<{ syncState: string }>(
          "event",
          "event-db-approval-1",
        ),
      );
      const eventAudit = await Effect.runPromise(
        platform.listAuditTrail({
          entityType: "event",
          entityId: "event-db-approval-1",
        }),
      );

      expect(approved.executionId).toBe("exec-sqlite-event-sync-1");
      expect(execute).toHaveBeenCalledTimes(1);
      expect(event?.syncState).toBe("synced");
      expect(eventAudit[eventAudit.length - 1]?.toState).toBe("synced");

      if (!platform.close) {
        throw new Error("database-backed platform should expose close()");
      }
      await Effect.runPromise(platform.close());
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("database backend executes approved outbound_draft actions and persists execution metadata", async () => {
    const { tempDir, databasePath } = createTempPaths();

    try {
      const execute = mock(async (_action: unknown) => ({
        executionId: "exec-sqlite-outbound-1",
      }));
      const platform = await Effect.runPromise(
        buildCorePlatform({
          databasePath,
          outboundActionPort: {
            execute: (action) => Effect.promise(() => execute(action)),
          },
        }),
      );

      await Effect.runPromise(
        platform.ingestSignal({
          signalId: "signal-db-outbound-approval-1",
          source: "email",
          payload: "Send partner update",
          actor: { id: "user-1", kind: "user" },
          at: new Date("2026-02-23T17:00:00.000Z"),
        }),
      );
      await Effect.runPromise(
        platform.triageSignal(
          "signal-db-outbound-approval-1",
          "requires_outbound",
          { id: "user-1", kind: "user" },
          new Date("2026-02-23T17:01:00.000Z"),
        ),
      );
      await Effect.runPromise(
        platform.convertSignal({
          signalId: "signal-db-outbound-approval-1",
          targetType: "outbound_draft",
          targetId: "outbound-draft-db-approval-1",
          actor: { id: "user-1", kind: "user" },
          at: new Date("2026-02-23T17:02:00.000Z"),
        }),
      );

      await Effect.runPromise(
        platform.requestOutboundDraftExecution(
          "outbound-draft-db-approval-1",
          { id: "user-1", kind: "user" },
          new Date("2026-02-23T17:03:00.000Z"),
        ),
      );

      const approved = await Effect.runPromise(
        platform.approveOutboundAction({
          actionType: "outbound_draft",
          entityType: "outbound_draft",
          entityId: "outbound-draft-db-approval-1",
          approved: true,
          actor: { id: "user-1", kind: "user" },
          at: new Date("2026-02-23T17:04:00.000Z"),
        }),
      );
      const draft = await Effect.runPromise(
        platform.getEntity<{ status: string; executionId?: string }>(
          "outbound_draft",
          "outbound-draft-db-approval-1",
        ),
      );
      const draftAudit = await Effect.runPromise(
        platform.listAuditTrail({
          entityType: "outbound_draft",
          entityId: "outbound-draft-db-approval-1",
        }),
      );

      expect(approved.executionId).toBe("exec-sqlite-outbound-1");
      expect(execute).toHaveBeenCalledTimes(1);
      expect(draft?.status).toBe("executed");
      expect(draft?.executionId).toBe("exec-sqlite-outbound-1");
      expect(draftAudit[draftAudit.length - 1]?.toState).toBe("executed");

      if (!platform.close) {
        throw new Error("database-backed platform should expose close()");
      }
      await Effect.runPromise(platform.close());
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("database-backed checkpoint keep/recover remains auditable and reversible", async () => {
    const { tempDir, databasePath } = createTempPaths();

    try {
      const platformA = await Effect.runPromise(
        buildCorePlatform({
          databasePath,
        }),
      );

      await Effect.runPromise(
        platformA.saveView({
          viewId: "view-db-1",
          name: "DB view",
          query: "status:planned",
          filters: {
            status: "planned",
            priority: 2,
            includeCompleted: false,
          },
        }),
      );

      const checkpoint = await Effect.runPromise(
        platformA.createWorkflowCheckpoint({
          checkpointId: "checkpoint-db-1",
          name: "Before AI rewrite",
          snapshotEntityRefs: [{ entityType: "view", entityId: "view-db-1" }],
          auditCursor: 9,
          rollbackTarget: "audit-9",
          actor: { id: "user-1", kind: "user" },
        }),
      );

      await Effect.runPromise(
        platformA.keepCheckpoint("checkpoint-db-1", {
          id: "user-1",
          kind: "user",
        }),
      );
      const recovered = await Effect.runPromise(
        platformA.recoverCheckpoint("checkpoint-db-1", {
          id: "user-1",
          kind: "user",
        }),
      );

      const auditTrail = await Effect.runPromise(
        platformA.listAuditTrail({
          entityType: "checkpoint",
          entityId: "checkpoint-db-1",
        }),
      );

      expect(checkpoint.snapshotEntityRefs).toEqual([
        { entityType: "view", entityId: "view-db-1" },
      ]);
      expect(recovered.checkpoint.status).toBe("recovered");
      expect(auditTrail.map((transition) => transition.toState)).toEqual([
        "created",
        "kept",
        "recovered",
      ]);
      expect(auditTrail[0]?.metadata?.rollbackTarget).toBe("audit-9");
      expect(auditTrail[2]?.metadata?.rollbackTarget).toBe("audit-9");

      if (!platformA.close) {
        throw new Error("database-backed platform should expose close()");
      }
      await Effect.runPromise(platformA.close());

      const platformB = await Effect.runPromise(
        buildCorePlatform({
          databasePath,
        }),
      );

      const persistedView = await Effect.runPromise(
        platformB.getEntity<{ filters: Record<string, unknown> }>(
          "view",
          "view-db-1",
        ),
      );
      const persistedCheckpoint = await Effect.runPromise(
        platformB.getEntity<{
          snapshotEntityRefs: Array<{ entityType: string; entityId: string }>;
          snapshotEntities: Array<{
            state?: { filters?: Record<string, unknown> };
          }>;
        }>("checkpoint", "checkpoint-db-1"),
      );

      expect(persistedView?.filters).toEqual({
        status: "planned",
        priority: 2,
        includeCompleted: false,
      });
      expect(persistedCheckpoint?.snapshotEntityRefs).toEqual([
        { entityType: "view", entityId: "view-db-1" },
      ]);
      expect(persistedCheckpoint?.snapshotEntities[0]?.state?.filters).toEqual({
        status: "planned",
        priority: 2,
        includeCompleted: false,
      });

      if (!platformB.close) {
        throw new Error("database-backed platform should expose close()");
      }
      await Effect.runPromise(platformB.close());
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("capture/signal/approval/checkpoint workflows preserve relations and audit-version sync", async () => {
    const { tempDir, databasePath } = createTempPaths();

    try {
      const execute = mock(async (_action: unknown) => ({
        executionId: "exec-sqlite-api-002-1",
      }));
      const platform = await Effect.runPromise(
        buildCorePlatform({
          databasePath,
          outboundActionPort: {
            execute: (action) => Effect.promise(() => execute(action)),
          },
        }),
      );

      await Effect.runPromise(
        platform.captureEntry({
          entryId: "entry-api-002-1",
          content: "Capture for relation regression",
          actor: { id: "user-1", kind: "user" },
          at: new Date("2026-02-23T18:00:00.000Z"),
        }),
      );
      await Effect.runPromise(
        platform.acceptEntryAsTask({
          entryId: "entry-api-002-1",
          taskId: "task-api-002-1",
          actor: { id: "user-1", kind: "user" },
          at: new Date("2026-02-23T18:01:00.000Z"),
        }),
      );

      await Effect.runPromise(
        platform.ingestSignal({
          signalId: "signal-api-002-1",
          source: "email",
          payload: "Draft an outbound update",
          actor: { id: "user-1", kind: "user" },
          at: new Date("2026-02-23T18:02:00.000Z"),
        }),
      );
      await Effect.runPromise(
        platform.triageSignal(
          "signal-api-002-1",
          "requires_outbound",
          { id: "user-1", kind: "user" },
          new Date("2026-02-23T18:03:00.000Z"),
        ),
      );
      await Effect.runPromise(
        platform.convertSignal({
          signalId: "signal-api-002-1",
          targetType: "outbound_draft",
          targetId: "outbound-draft-api-002-1",
          actor: { id: "user-1", kind: "user" },
          at: new Date("2026-02-23T18:04:00.000Z"),
        }),
      );
      await Effect.runPromise(
        platform.requestOutboundDraftExecution(
          "outbound-draft-api-002-1",
          { id: "user-1", kind: "user" },
          new Date("2026-02-23T18:05:00.000Z"),
        ),
      );
      await Effect.runPromise(
        platform.approveOutboundAction({
          actionType: "outbound_draft",
          entityType: "outbound_draft",
          entityId: "outbound-draft-api-002-1",
          approved: true,
          actor: { id: "user-1", kind: "user" },
          at: new Date("2026-02-23T18:06:00.000Z"),
        }),
      );

      await Effect.runPromise(
        platform.saveView({
          viewId: "view-api-002-1",
          name: "API-002 view",
          query: "status:planned",
          filters: { status: "planned" },
        }),
      );
      await Effect.runPromise(
        platform.createWorkflowCheckpoint({
          checkpointId: "checkpoint-api-002-1",
          name: "API-002 checkpoint",
          snapshotEntityRefs: [
            { entityType: "view", entityId: "view-api-002-1" },
          ],
          auditCursor: 42,
          rollbackTarget: "audit-42",
          actor: { id: "user-1", kind: "user" },
          at: new Date("2026-02-23T18:07:00.000Z"),
        }),
      );
      await Effect.runPromise(
        platform.keepCheckpoint(
          "checkpoint-api-002-1",
          { id: "user-1", kind: "user" },
          new Date("2026-02-23T18:08:00.000Z"),
        ),
      );
      await Effect.runPromise(
        platform.recoverCheckpoint(
          "checkpoint-api-002-1",
          { id: "user-1", kind: "user" },
          new Date("2026-02-23T18:09:00.000Z"),
        ),
      );

      const db = new Database(databasePath, { readonly: true });

      const taskLink = db
        .query("SELECT source_entry_id AS sourceEntryId FROM task WHERE id = ?")
        .get("task-api-002-1") as { sourceEntryId: string } | null;
      const entryLink = db
        .query(
          "SELECT accepted_task_id AS acceptedTaskId FROM entry WHERE id = ?",
        )
        .get("entry-api-002-1") as { acceptedTaskId: string } | null;
      const signalLink = db
        .query(
          `
            SELECT
              converted_entity_type AS convertedEntityType,
              converted_entity_id AS convertedEntityId
            FROM signal
            WHERE id = ?
          `,
        )
        .get("signal-api-002-1") as {
        convertedEntityType: string;
        convertedEntityId: string;
      } | null;
      const draftLink = db
        .query(
          "SELECT source_signal_id AS sourceSignalId FROM outbound_draft WHERE id = ?",
        )
        .get("outbound-draft-api-002-1") as { sourceSignalId: string } | null;
      const relatedNotification = db
        .query(
          `
            SELECT id
            FROM notification
            WHERE related_entity_type = ? AND related_entity_id = ?
            LIMIT 1
          `,
        )
        .get("outbound_draft", "outbound-draft-api-002-1");

      const missingVersionRows = db
        .query(
          `
            SELECT COUNT(*) AS count
            FROM audit_transitions transition
            LEFT JOIN entity_versions version
              ON version.entity_type = transition.entity_type
              AND version.entity_id = transition.entity_id
            WHERE version.entity_type IS NULL
          `,
        )
        .get() as { count: number };
      const mismatchedVersionRows = db
        .query(
          `
            SELECT COUNT(*) AS count
            FROM (
              SELECT
                transition.entity_type,
                transition.entity_id,
                COUNT(*) AS transition_count,
                version.latest_version AS latest_version
              FROM audit_transitions transition
              JOIN entity_versions version
                ON version.entity_type = transition.entity_type
                AND version.entity_id = transition.entity_id
              GROUP BY transition.entity_type, transition.entity_id
              HAVING transition_count != latest_version
            )
          `,
        )
        .get() as { count: number };
      const checkpointVersion = db
        .query(
          `
            SELECT latest_version AS latestVersion
            FROM entity_versions
            WHERE entity_type = 'checkpoint' AND entity_id = 'checkpoint-api-002-1'
          `,
        )
        .get() as { latestVersion: number } | null;

      db.close();

      expect(taskLink?.sourceEntryId).toBe("entry-api-002-1");
      expect(entryLink?.acceptedTaskId).toBe("task-api-002-1");
      expect(signalLink).toEqual({
        convertedEntityType: "outbound_draft",
        convertedEntityId: "outbound-draft-api-002-1",
      });
      expect(draftLink?.sourceSignalId).toBe("signal-api-002-1");
      expect(relatedNotification).not.toBeNull();

      expect(missingVersionRows.count).toBe(0);
      expect(mismatchedVersionRows.count).toBe(0);
      expect(checkpointVersion?.latestVersion).toBe(3);

      if (!platform.close) {
        throw new Error("database-backed platform should expose close()");
      }
      await Effect.runPromise(platform.close());
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("legacy snapshot import hydrates an empty database once when enabled", async () => {
    const { tempDir, databasePath, snapshotPath } = createTempPaths();

    try {
      writeFileSync(
        snapshotPath,
        JSON.stringify(
          {
            version: 1,
            entities: {
              entry: [
                {
                  id: "entry-legacy-1",
                  content: "Imported from snapshot",
                  source: "manual",
                  status: "captured",
                  capturedAt: "2026-02-23T00:00:00.000Z",
                  createdAt: "2026-02-23T00:00:00.000Z",
                  updatedAt: "2026-02-23T00:00:00.000Z",
                },
              ],
            },
            auditTrail: [
              {
                id: "audit-legacy-1",
                entityType: "entry",
                entityId: "entry-legacy-1",
                fromState: "none",
                toState: "captured",
                actor: { id: "user-1", kind: "user" },
                reason: "Imported capture",
                at: "2026-02-23T00:00:00.000Z",
              },
            ],
          },
          null,
          2,
        ),
        "utf8",
      );

      const platformA = await Effect.runPromise(
        buildCorePlatform({
          databasePath,
          snapshotPath,
          importSnapshotIntoDatabase: true,
        }),
      );

      const importedEntry = await Effect.runPromise(
        platformA.getEntity<{ id: string }>("entry", "entry-legacy-1"),
      );
      const importedAudit = await Effect.runPromise(
        platformA.listAuditTrail({
          entityType: "entry",
          entityId: "entry-legacy-1",
        }),
      );

      expect(importedEntry?.id).toBe("entry-legacy-1");
      expect(importedAudit).toHaveLength(1);

      if (!platformA.close) {
        throw new Error("database-backed platform should expose close()");
      }
      await Effect.runPromise(platformA.close());

      const platformB = await Effect.runPromise(
        buildCorePlatform({
          databasePath,
          snapshotPath,
          importSnapshotIntoDatabase: true,
        }),
      );

      const importedEntriesAfterRestart = await Effect.runPromise(
        platformB.listEntities<{ id: string }>("entry"),
      );
      const importedAuditAfterRestart = await Effect.runPromise(
        platformB.listAuditTrail({
          entityType: "entry",
          entityId: "entry-legacy-1",
        }),
      );

      expect(importedEntriesAfterRestart).toHaveLength(1);
      expect(importedAuditAfterRestart).toHaveLength(1);

      if (!platformB.close) {
        throw new Error("database-backed platform should expose close()");
      }
      await Effect.runPromise(platformB.close());
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
