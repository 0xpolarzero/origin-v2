import { Database } from "bun:sqlite";
import { describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Effect } from "effect";

import { buildCorePlatform } from "../../src/core/app/core-platform";
import { CORE_DB_MIGRATIONS } from "../../src/core/repositories/sqlite/migrations";
import { makeSqliteCoreRepository } from "../../src/core/repositories/sqlite/sqlite-core-repository";

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

type LegacySnapshotPayload = {
  version: 1;
  entities: Record<string, ReadonlyArray<Record<string, unknown>>>;
  auditTrail: ReadonlyArray<Record<string, unknown>>;
};

const writeLegacySnapshot = (
  snapshotPath: string,
  payload: LegacySnapshotPayload,
): void => {
  writeFileSync(snapshotPath, JSON.stringify(payload, null, 2), "utf8");
};

type ForcedFailureConfig = {
  enabled: boolean;
  mode:
    | "ingestAudit"
    | "triageAudit"
    | "convertSignalSave"
    | "outboundExecutedSave";
};

const signalIdForIngestRollback = "signal-db-rollback-ingest-1";
const signalIdForTriageRollback = "signal-db-rollback-triage-1";
const signalIdForConvertRollback = "signal-db-rollback-convert-1";
const outboundDraftIdForApprovalRollback = "outbound-draft-db-rollback-approval-1";

const stringField = (
  value: unknown,
  key: string,
): string | undefined => {
  if (typeof value !== "object" || value === null || !(key in value)) {
    return undefined;
  }

  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" ? field : undefined;
};

const buildFailureInjectedRepository = (
  databasePath: string,
  config: ForcedFailureConfig,
) =>
  makeSqliteCoreRepository({ databasePath }).pipe(
    Effect.map((sqliteRepository) => ({
      ...sqliteRepository,
      saveEntity: (entityType: string, entityId: string, entity: unknown) => {
        if (
          config.enabled &&
          config.mode === "convertSignalSave" &&
          entityType === "signal" &&
          entityId === signalIdForConvertRollback &&
          stringField(entity, "triageState") === "converted"
        ) {
          return Effect.fail(
            new Error("forced convertSignal signal write failure"),
          );
        }

        if (
          config.enabled &&
          config.mode === "outboundExecutedSave" &&
          entityType === "outbound_draft" &&
          entityId === outboundDraftIdForApprovalRollback &&
          stringField(entity, "status") === "executed"
        ) {
          return Effect.fail(
            new Error("forced outbound_draft executed write failure"),
          );
        }

        return sqliteRepository.saveEntity(entityType, entityId, entity);
      },
      appendAuditTransition: (transition: {
        entityType: string;
        entityId: string;
        reason: string;
      }) => {
        if (
          config.enabled &&
          config.mode === "ingestAudit" &&
          transition.entityType === "signal" &&
          transition.entityId === signalIdForIngestRollback &&
          transition.reason === "Signal ingested"
        ) {
          return Effect.fail(
            new Error("forced ingestSignal audit write failure"),
          );
        }

        if (
          config.enabled &&
          config.mode === "triageAudit" &&
          transition.entityType === "signal" &&
          transition.entityId === signalIdForTriageRollback &&
          transition.reason.startsWith("Signal triaged:")
        ) {
          return Effect.fail(
            new Error("forced triageSignal audit write failure"),
          );
        }

        return sqliteRepository.appendAuditTransition(transition as never);
      },
    })),
  );
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

  test("database backend persists job_run_history across restart and stays consistent with latest job state", async () => {
    const { tempDir, databasePath } = createTempPaths();

    try {
      const platformA = await Effect.runPromise(
        buildCorePlatform({
          databasePath,
        }),
      );

      await Effect.runPromise(
        platformA.createJob({
          jobId: "job-db-history-1",
          name: "History durability",
          actor: { id: "system-1", kind: "system" },
          at: new Date("2026-02-23T14:00:00.000Z"),
        }),
      );
      await Effect.runPromise(
        platformA.recordJobRun({
          jobId: "job-db-history-1",
          outcome: "failed",
          diagnostics: "First failure",
          actor: { id: "system-1", kind: "system" },
          at: new Date("2026-02-23T14:01:00.000Z"),
        }),
      );
      await Effect.runPromise(
        platformA.retryJob(
          "job-db-history-1",
          { id: "user-1", kind: "user" },
          new Date("2026-02-23T14:02:00.000Z"),
          "Increase timeout before retry",
        ),
      );
      await Effect.runPromise(
        platformA.recordJobRun({
          jobId: "job-db-history-1",
          outcome: "succeeded",
          diagnostics: "Recovered",
          actor: { id: "system-1", kind: "system" },
          at: new Date("2026-02-23T14:03:00.000Z"),
        }),
      );

      const historyBeforeRestart = await Effect.runPromise(
        platformA.listJobRunHistory("job-db-history-1"),
      );
      expect(historyBeforeRestart.map((entry) => entry.outcome)).toEqual([
        "succeeded",
        "failed",
      ]);

      if (!platformA.close) {
        throw new Error("database-backed platform should expose close()");
      }
      await Effect.runPromise(platformA.close());

      const platformB = await Effect.runPromise(
        buildCorePlatform({
          databasePath,
        }),
      );

      const inspection = await Effect.runPromise(
        platformB.inspectJobRun("job-db-history-1"),
      );
      const historyAfterRestart = await Effect.runPromise(
        platformB.listJobRunHistory("job-db-history-1"),
      );

      expect(historyAfterRestart).toHaveLength(2);
      expect(historyAfterRestart.map((entry) => entry.outcome)).toEqual([
        "succeeded",
        "failed",
      ]);
      expect(inspection.runState).toBe("succeeded");
      expect(inspection.diagnostics).toBe("Recovered");
      expect(historyAfterRestart[0]?.retryCount).toBe(1);
      expect(historyAfterRestart[0]?.outcome).toBe("succeeded");
      expect(historyAfterRestart[0]?.diagnostics).toBe("Recovered");

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

  test("database backend cannot persist fractional checkpoint audit_cursor", async () => {
    const { tempDir, databasePath } = createTempPaths();

    try {
      const platform = await Effect.runPromise(
        buildCorePlatform({
          databasePath,
        }),
      );

      const result = await Effect.runPromise(
        Effect.either(
          platform.createWorkflowCheckpoint({
            checkpointId: "checkpoint-db-fractional-cursor-1",
            name: "Fractional cursor",
            snapshotEntityRefs: [],
            auditCursor: 1.5,
            rollbackTarget: "audit-1",
            actor: { id: "user-1", kind: "user" },
          }),
        ),
      );

      expect(result._tag).toBe("Left");
      if (result._tag === "Left") {
        expect(result.left).toMatchObject({
          _tag: "CheckpointServiceError",
          code: "invalid_request",
        });
      }

      const db = new Database(databasePath, { readonly: true });
      const checkpointCount = db
        .query("SELECT COUNT(*) AS count FROM checkpoint WHERE id = ?")
        .get("checkpoint-db-fractional-cursor-1") as { count: number };
      db.close();

      expect(checkpointCount.count).toBe(0);

      if (!platform.close) {
        throw new Error("database-backed platform should expose close()");
      }
      await Effect.runPromise(platform.close());
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

  test("sqlite relation-integrity trigger failures surface and leave existing links intact", async () => {
    const { tempDir, databasePath } = createTempPaths();

    try {
      const platform = await Effect.runPromise(
        buildCorePlatform({
          databasePath,
        }),
      );

      await Effect.runPromise(
        platform.captureEntry({
          entryId: "entry-db-trigger-1",
          content: "Trigger integrity source entry",
          actor: { id: "user-1", kind: "user" },
          at: new Date("2026-02-23T19:00:00.000Z"),
        }),
      );
      await Effect.runPromise(
        platform.acceptEntryAsTask({
          entryId: "entry-db-trigger-1",
          taskId: "task-db-trigger-1",
          actor: { id: "user-1", kind: "user" },
          at: new Date("2026-02-23T19:01:00.000Z"),
        }),
      );

      const db = new Database(databasePath);
      expect(() =>
        db.query("DELETE FROM entry WHERE id = ?").run("entry-db-trigger-1"),
      ).toThrow("invalid delete entry.id referenced by task.source_entry_id");
      db.close();

      const entry = await Effect.runPromise(
        platform.getEntity<{ id: string; acceptedTaskId?: string }>(
          "entry",
          "entry-db-trigger-1",
        ),
      );
      const task = await Effect.runPromise(
        platform.getEntity<{ id: string; sourceEntryId?: string }>(
          "task",
          "task-db-trigger-1",
        ),
      );

      expect(entry?.id).toBe("entry-db-trigger-1");
      expect(entry?.acceptedTaskId).toBe("task-db-trigger-1");
      expect(task?.id).toBe("task-db-trigger-1");
      expect(task?.sourceEntryId).toBe("entry-db-trigger-1");

      if (!platform.close) {
        throw new Error("database-backed platform should expose close()");
      }
      await Effect.runPromise(platform.close());
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("forced recordJobRun write failure rolls back partial sqlite mutations", async () => {
    const { tempDir, databasePath } = createTempPaths();

    try {
      const sqliteRepository = await Effect.runPromise(
        makeSqliteCoreRepository({ databasePath }),
      );
      let forceTransitionFailure = false;
      const repository = {
        ...sqliteRepository,
        appendAuditTransition: (transition: {
          entityType: string;
          reason: string;
        }) => {
          if (
            forceTransitionFailure &&
            transition.entityType === "job" &&
            transition.reason.includes("Job run recorded")
          ) {
            return Effect.fail(
              new Error("forced recordJobRun transition failure"),
            );
          }

          return sqliteRepository.appendAuditTransition(transition as never);
        },
      };
      const platform = await Effect.runPromise(
        buildCorePlatform({
          repository: repository as never,
        }),
      );

      await Effect.runPromise(
        platform.createJob({
          jobId: "job-db-rollback-1",
          name: "Rollback coverage job",
          actor: { id: "system-1", kind: "system" },
          at: new Date("2026-02-23T19:10:00.000Z"),
        }),
      );
      const before = await Effect.runPromise(
        platform.inspectJobRun("job-db-rollback-1"),
      );

      forceTransitionFailure = true;
      const failedRun = await Effect.runPromise(
        Effect.either(
          platform.recordJobRun({
            jobId: "job-db-rollback-1",
            outcome: "failed",
            diagnostics: "forced failure",
            actor: { id: "system-1", kind: "system" },
            at: new Date("2026-02-23T19:11:00.000Z"),
          }),
        ),
      );

      expect(failedRun._tag).toBe("Left");
      if (failedRun._tag === "Left") {
        expect(failedRun.left.message).toContain(
          "forced recordJobRun transition failure",
        );
      }

      const after = await Effect.runPromise(
        platform.inspectJobRun("job-db-rollback-1"),
      );
      const history = await Effect.runPromise(
        platform.listJobRunHistory("job-db-rollback-1"),
      );
      const audit = await Effect.runPromise(
        platform.listAuditTrail({
          entityType: "job",
          entityId: "job-db-rollback-1",
        }),
      );

      expect(after.runState).toBe(before.runState);
      expect(after.retryCount).toBe(before.retryCount);
      expect(after.diagnostics).toBe(before.diagnostics);
      expect(history).toHaveLength(0);
      expect(
        audit.filter((transition) => transition.toState === "failed"),
      ).toHaveLength(0);

      if (!platform.close) {
        throw new Error("database-backed platform should expose close()");
      }
      await Effect.runPromise(platform.close());
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("forced recoverCheckpoint write failure rolls back partial sqlite restore", async () => {
    const { tempDir, databasePath } = createTempPaths();

    try {
      const sqliteRepository = await Effect.runPromise(
        makeSqliteCoreRepository({ databasePath }),
      );
      let forceRecoverCheckpointWriteFailure = false;
      const repository = {
        ...sqliteRepository,
        saveEntity: (entityType: string, entityId: string, entity: unknown) => {
          const status =
            typeof entity === "object" &&
            entity !== null &&
            "status" in entity &&
            typeof (entity as { status?: unknown }).status === "string"
              ? (entity as { status: string }).status
              : undefined;
          if (
            forceRecoverCheckpointWriteFailure &&
            entityType === "checkpoint" &&
            entityId === "checkpoint-db-rollback-1" &&
            status === "recovered"
          ) {
            return Effect.fail(
              new Error("forced recoverCheckpoint checkpoint write failure"),
            );
          }

          return sqliteRepository.saveEntity(entityType, entityId, entity);
        },
      };
      const platform = await Effect.runPromise(
        buildCorePlatform({
          repository: repository as never,
        }),
      );

      await Effect.runPromise(
        platform.saveView({
          viewId: "view-db-rollback-1",
          name: "Pre-recovery view",
          query: "status:planned",
          filters: { status: "planned" },
        }),
      );
      await Effect.runPromise(
        platform.createWorkflowCheckpoint({
          checkpointId: "checkpoint-db-rollback-1",
          name: "Before rollback failure",
          snapshotEntityRefs: [
            { entityType: "view", entityId: "view-db-rollback-1" },
          ],
          auditCursor: 12,
          rollbackTarget: "audit-12",
          actor: { id: "user-1", kind: "user" },
          at: new Date("2026-02-23T19:20:00.000Z"),
        }),
      );
      await Effect.runPromise(
        platform.saveView({
          viewId: "view-db-rollback-1",
          name: "Mutated after checkpoint",
          query: "status:completed",
          filters: { status: "completed" },
        }),
      );

      forceRecoverCheckpointWriteFailure = true;
      const recoverAttempt = await Effect.runPromise(
        Effect.either(
          platform.recoverCheckpoint(
            "checkpoint-db-rollback-1",
            { id: "user-1", kind: "user" },
            new Date("2026-02-23T19:21:00.000Z"),
          ),
        ),
      );

      expect(recoverAttempt._tag).toBe("Left");
      if (recoverAttempt._tag === "Left") {
        expect(recoverAttempt.left.message).toContain(
          "forced recoverCheckpoint checkpoint write failure",
        );
      }

      const persistedView = await Effect.runPromise(
        platform.getEntity<{
          name: string;
          query: string;
          filters: { status: string };
        }>("view", "view-db-rollback-1"),
      );
      const checkpoint = await Effect.runPromise(
        platform.getEntity<{ status: string }>(
          "checkpoint",
          "checkpoint-db-rollback-1",
        ),
      );
      const checkpointAudit = await Effect.runPromise(
        platform.listAuditTrail({
          entityType: "checkpoint",
          entityId: "checkpoint-db-rollback-1",
        }),
      );

      expect(persistedView?.name).toBe("Mutated after checkpoint");
      expect(persistedView?.query).toBe("status:completed");
      expect(persistedView?.filters.status).toBe("completed");
      expect(checkpoint?.status).toBe("created");
      expect(
        checkpointAudit.filter(
          (transition) => transition.toState === "recovered",
        ),
      ).toHaveLength(0);

      if (!platform.close) {
        throw new Error("database-backed platform should expose close()");
      }
      await Effect.runPromise(platform.close());
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("forced ingestSignal audit write failure rolls back signal insert", async () => {
    const { tempDir, databasePath } = createTempPaths();

    try {
      const repository = await Effect.runPromise(
        buildFailureInjectedRepository(databasePath, {
          enabled: true,
          mode: "ingestAudit",
        }),
      );
      const platform = await Effect.runPromise(
        buildCorePlatform({
          repository: repository as never,
        }),
      );

      const ingestAttempt = await Effect.runPromise(
        Effect.either(
          platform.ingestSignal({
            signalId: "signal-db-rollback-ingest-1",
            source: "email",
            payload: "Forced rollback on ingest audit",
            actor: { id: "user-1", kind: "user" },
            at: new Date("2026-02-25T10:00:00.000Z"),
          }),
        ),
      );

      expect(ingestAttempt._tag).toBe("Left");
      if (ingestAttempt._tag === "Left") {
        expect(ingestAttempt.left.message).toContain(
          "forced ingestSignal audit write failure",
        );
      }

      const signal = await Effect.runPromise(
        platform.getEntity("signal", "signal-db-rollback-ingest-1"),
      );
      const audit = await Effect.runPromise(
        platform.listAuditTrail({
          entityType: "signal",
          entityId: "signal-db-rollback-ingest-1",
        }),
      );

      expect(signal).toBeUndefined();
      expect(audit).toHaveLength(0);

      if (!platform.close) {
        throw new Error("database-backed platform should expose close()");
      }
      await Effect.runPromise(platform.close());
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("forced triageSignal audit write failure rolls back signal triage update", async () => {
    const { tempDir, databasePath } = createTempPaths();

    try {
      const repository = await Effect.runPromise(
        buildFailureInjectedRepository(databasePath, {
          enabled: true,
          mode: "triageAudit",
        }),
      );
      const platform = await Effect.runPromise(
        buildCorePlatform({
          repository: repository as never,
        }),
      );

      await Effect.runPromise(
        platform.ingestSignal({
          signalId: "signal-db-rollback-triage-1",
          source: "email",
          payload: "Force triage rollback",
          actor: { id: "user-1", kind: "user" },
          at: new Date("2026-02-25T10:10:00.000Z"),
        }),
      );

      const triageAttempt = await Effect.runPromise(
        Effect.either(
          platform.triageSignal(
            "signal-db-rollback-triage-1",
            "requires_outbound",
            { id: "user-1", kind: "user" },
            new Date("2026-02-25T10:11:00.000Z"),
          ),
        ),
      );

      expect(triageAttempt._tag).toBe("Left");
      if (triageAttempt._tag === "Left") {
        expect(triageAttempt.left.message).toContain(
          "forced triageSignal audit write failure",
        );
      }

      const signal = await Effect.runPromise(
        platform.getEntity<{
          triageState: string;
          triageDecision?: string;
        }>("signal", "signal-db-rollback-triage-1"),
      );
      const audit = await Effect.runPromise(
        platform.listAuditTrail({
          entityType: "signal",
          entityId: "signal-db-rollback-triage-1",
        }),
      );

      expect(signal?.triageState).toBe("untriaged");
      expect(signal?.triageDecision).toBeUndefined();
      expect(audit.some((transition) => transition.toState === "triaged")).toBe(
        false,
      );

      if (!platform.close) {
        throw new Error("database-backed platform should expose close()");
      }
      await Effect.runPromise(platform.close());
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("forced convertSignal signal-write failure rolls back target+signal conversion mutations", async () => {
    const { tempDir, databasePath } = createTempPaths();

    try {
      const repository = await Effect.runPromise(
        buildFailureInjectedRepository(databasePath, {
          enabled: true,
          mode: "convertSignalSave",
        }),
      );
      const platform = await Effect.runPromise(
        buildCorePlatform({
          repository: repository as never,
        }),
      );

      await Effect.runPromise(
        platform.ingestSignal({
          signalId: "signal-db-rollback-convert-1",
          source: "email",
          payload: "Force conversion rollback",
          actor: { id: "user-1", kind: "user" },
          at: new Date("2026-02-25T10:20:00.000Z"),
        }),
      );
      await Effect.runPromise(
        platform.triageSignal(
          "signal-db-rollback-convert-1",
          "ready_for_conversion",
          { id: "user-1", kind: "user" },
          new Date("2026-02-25T10:21:00.000Z"),
        ),
      );

      const convertAttempt = await Effect.runPromise(
        Effect.either(
          platform.convertSignal({
            signalId: "signal-db-rollback-convert-1",
            targetType: "task",
            targetId: "task-db-rollback-convert-1",
            actor: { id: "user-1", kind: "user" },
            at: new Date("2026-02-25T10:22:00.000Z"),
          }),
        ),
      );

      expect(convertAttempt._tag).toBe("Left");
      if (convertAttempt._tag === "Left") {
        expect(convertAttempt.left.message).toContain(
          "forced convertSignal signal write failure",
        );
      }

      const task = await Effect.runPromise(
        platform.getEntity("task", "task-db-rollback-convert-1"),
      );
      const signal = await Effect.runPromise(
        platform.getEntity<{
          triageState: string;
          convertedEntityType?: string;
          convertedEntityId?: string;
        }>("signal", "signal-db-rollback-convert-1"),
      );
      const signalAudit = await Effect.runPromise(
        platform.listAuditTrail({
          entityType: "signal",
          entityId: "signal-db-rollback-convert-1",
        }),
      );
      const taskAudit = await Effect.runPromise(
        platform.listAuditTrail({
          entityType: "task",
          entityId: "task-db-rollback-convert-1",
        }),
      );

      expect(task).toBeUndefined();
      expect(signal?.triageState).toBe("triaged");
      expect(signal?.convertedEntityType).toBeUndefined();
      expect(signal?.convertedEntityId).toBeUndefined();
      expect(
        signalAudit.some((transition) => transition.toState === "converted"),
      ).toBe(false);
      expect(taskAudit).toHaveLength(0);

      if (!platform.close) {
        throw new Error("database-backed platform should expose close()");
      }
      await Effect.runPromise(platform.close());
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("forced outbound_draft approval executed-write failure rolls back staged execution mutations", async () => {
    const { tempDir, databasePath } = createTempPaths();

    try {
      const execute = mock(async (_action: unknown) => ({
        executionId: "exec-db-rollback-approval-1",
      }));
      const repository = await Effect.runPromise(
        buildFailureInjectedRepository(databasePath, {
          enabled: true,
          mode: "outboundExecutedSave",
        }),
      );
      const platform = await Effect.runPromise(
        buildCorePlatform({
          repository: repository as never,
          outboundActionPort: {
            execute: (action) => Effect.promise(() => execute(action)),
          },
        }),
      );

      await Effect.runPromise(
        platform.ingestSignal({
          signalId: "signal-db-rollback-approval-1",
          source: "email",
          payload: "Rollback outbound approval",
          actor: { id: "user-1", kind: "user" },
          at: new Date("2026-02-25T10:30:00.000Z"),
        }),
      );
      await Effect.runPromise(
        platform.triageSignal(
          "signal-db-rollback-approval-1",
          "requires_outbound",
          { id: "user-1", kind: "user" },
          new Date("2026-02-25T10:31:00.000Z"),
        ),
      );
      await Effect.runPromise(
        platform.convertSignal({
          signalId: "signal-db-rollback-approval-1",
          targetType: "outbound_draft",
          targetId: "outbound-draft-db-rollback-approval-1",
          actor: { id: "user-1", kind: "user" },
          at: new Date("2026-02-25T10:32:00.000Z"),
        }),
      );
      await Effect.runPromise(
        platform.requestOutboundDraftExecution(
          "outbound-draft-db-rollback-approval-1",
          { id: "user-1", kind: "user" },
          new Date("2026-02-25T10:33:00.000Z"),
        ),
      );

      const approveAttempt = await Effect.runPromise(
        Effect.either(
          platform.approveOutboundAction({
            actionType: "outbound_draft",
            entityType: "outbound_draft",
            entityId: "outbound-draft-db-rollback-approval-1",
            approved: true,
            actor: { id: "user-1", kind: "user" },
            at: new Date("2026-02-25T10:34:00.000Z"),
          }),
        ),
      );

      expect(approveAttempt._tag).toBe("Left");
      if (approveAttempt._tag === "Left") {
        expect(approveAttempt.left.message).toContain(
          "forced outbound_draft executed write failure",
        );
      }

      const draft = await Effect.runPromise(
        platform.getEntity<{ status: string; executionId?: string }>(
          "outbound_draft",
          "outbound-draft-db-rollback-approval-1",
        ),
      );
      const draftAudit = await Effect.runPromise(
        platform.listAuditTrail({
          entityType: "outbound_draft",
          entityId: "outbound-draft-db-rollback-approval-1",
        }),
      );

      expect(execute).toHaveBeenCalledTimes(1);
      expect(draft?.status).toBe("pending_approval");
      expect(draft?.executionId).toBeUndefined();
      expect(
        draftAudit.some(
          (transition) =>
            transition.toState === "executing" ||
            transition.toState === "executed",
        ),
      ).toBe(false);

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
      writeLegacySnapshot(snapshotPath, {
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
      });

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

  test("legacy snapshot import skips non-empty database and preserves existing rows", async () => {
    const { tempDir, databasePath, snapshotPath } = createTempPaths();
    const existingEntryId = "entry-db-legacy-existing-1";
    const existingEntryContent = "Keep existing sqlite content";
    const snapshotOnlyEntryId = "entry-db-legacy-snapshot-only-1";
    const snapshotAuditMarker = "snapshot-import-should-skip-marker";

    try {
      const platformA = await Effect.runPromise(
        buildCorePlatform({
          databasePath,
        }),
      );
      await Effect.runPromise(
        platformA.captureEntry({
          entryId: existingEntryId,
          content: existingEntryContent,
          actor: { id: "user-1", kind: "user" },
          at: new Date("2026-02-23T11:00:00.000Z"),
        }),
      );

      const seededEntryBeforeImport = await Effect.runPromise(
        platformA.getEntity<{ content: string; updatedAt: string }>(
          "entry",
          existingEntryId,
        ),
      );
      const seededAuditBeforeImport = await Effect.runPromise(
        platformA.listAuditTrail({
          entityType: "entry",
          entityId: existingEntryId,
        }),
      );

      if (!platformA.close) {
        throw new Error("database-backed platform should expose close()");
      }
      await Effect.runPromise(platformA.close());

      writeLegacySnapshot(snapshotPath, {
        version: 1,
        entities: {
          entry: [
            {
              id: existingEntryId,
              content: "Snapshot overwrite attempt",
              source: "manual",
              status: "captured",
              capturedAt: "2026-02-23T12:00:00.000Z",
              createdAt: "2026-02-23T12:00:00.000Z",
              updatedAt: "2026-02-23T12:00:00.000Z",
            },
            {
              id: snapshotOnlyEntryId,
              content: "Snapshot-only row that must not import",
              source: "manual",
              status: "captured",
              capturedAt: "2026-02-23T12:05:00.000Z",
              createdAt: "2026-02-23T12:05:00.000Z",
              updatedAt: "2026-02-23T12:05:00.000Z",
            },
          ],
        },
        auditTrail: [
          {
            id: "audit-db-legacy-existing-1",
            entityType: "entry",
            entityId: existingEntryId,
            fromState: "none",
            toState: "captured",
            actor: { id: "user-1", kind: "user" },
            reason: snapshotAuditMarker,
            at: "2026-02-23T12:00:00.000Z",
          },
        ],
      });

      const platformB = await Effect.runPromise(
        buildCorePlatform({
          databasePath,
          snapshotPath,
          importSnapshotIntoDatabase: true,
        }),
      );

      const seededEntryAfterImportAttempt = await Effect.runPromise(
        platformB.getEntity<{ content: string; updatedAt: string }>(
          "entry",
          existingEntryId,
        ),
      );
      const snapshotOnlyEntry = await Effect.runPromise(
        platformB.getEntity("entry", snapshotOnlyEntryId),
      );
      const seededAuditAfterImportAttempt = await Effect.runPromise(
        platformB.listAuditTrail({
          entityType: "entry",
          entityId: existingEntryId,
        }),
      );

      expect(seededEntryBeforeImport).toBeDefined();
      expect(seededEntryAfterImportAttempt?.content).toBe(existingEntryContent);
      expect(seededEntryAfterImportAttempt?.updatedAt).toBe(
        seededEntryBeforeImport?.updatedAt,
      );
      expect(snapshotOnlyEntry).toBeUndefined();
      expect(seededAuditAfterImportAttempt).toHaveLength(
        seededAuditBeforeImport.length,
      );
      expect(
        seededAuditAfterImportAttempt.some(
          (transition) => transition.reason === snapshotAuditMarker,
        ),
      ).toBe(false);

      if (!platformB.close) {
        throw new Error("database-backed platform should expose close()");
      }
      await Effect.runPromise(platformB.close());
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
