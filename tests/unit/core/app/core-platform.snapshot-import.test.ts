import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";

import { buildCorePlatform } from "../../../../src/core/app/core-platform";
import { CoreRepository } from "../../../../src/core/repositories/core-repository";
import { makeInMemoryCoreRepository } from "../../../../src/core/repositories/in-memory-core-repository";

type LegacySnapshotPayload = {
  version: 1;
  entities: Record<string, ReadonlyArray<Record<string, unknown>>>;
  auditTrail: ReadonlyArray<Record<string, unknown>>;
};

const createTempSnapshotPath = (): { tempDir: string; snapshotPath: string } => {
  const tempDir = mkdtempSync(join(tmpdir(), "origin-core-platform-unit-"));
  return {
    tempDir,
    snapshotPath: join(tempDir, "legacy-snapshot.json"),
  };
};

const writeLegacySnapshot = (
  snapshotPath: string,
  payload: LegacySnapshotPayload,
): void => {
  writeFileSync(snapshotPath, JSON.stringify(payload, null, 2), "utf8");
};

const createTrackedRepository = (): CoreRepository & {
  counters: {
    saveEntity: number;
    appendAuditTransition: number;
    withTransaction: number;
  };
} => {
  const baseRepository = makeInMemoryCoreRepository();
  const counters = {
    saveEntity: 0,
    appendAuditTransition: 0,
    withTransaction: 0,
  };

  return {
    ...baseRepository,
    counters,
    saveEntity: (entityType, entityId, entity) =>
      Effect.sync(() => {
        counters.saveEntity += 1;
      }).pipe(
        Effect.flatMap(() =>
          baseRepository.saveEntity(entityType, entityId, entity),
        ),
      ),
    appendAuditTransition: (transition) =>
      Effect.sync(() => {
        counters.appendAuditTransition += 1;
      }).pipe(
        Effect.flatMap(() => baseRepository.appendAuditTransition(transition)),
      ),
    withTransaction: (effect) =>
      Effect.sync(() => {
        counters.withTransaction += 1;
      }).pipe(Effect.flatMap(() => baseRepository.withTransaction(effect))),
  };
};

describe("buildCorePlatform legacy snapshot import guard", () => {
  test("skips legacy snapshot import when repository is already non-empty", async () => {
    const { tempDir, snapshotPath } = createTempSnapshotPath();
    const repository = createTrackedRepository();

    try {
      await Effect.runPromise(
        repository.saveEntity("entry", "entry-existing-1", {
          id: "entry-existing-1",
          content: "Existing repository row",
          source: "manual",
          status: "captured",
          capturedAt: "2026-02-23T09:00:00.000Z",
          createdAt: "2026-02-23T09:00:00.000Z",
          updatedAt: "2026-02-23T09:00:00.000Z",
        }),
      );
      repository.counters.saveEntity = 0;

      writeLegacySnapshot(snapshotPath, {
        version: 1,
        entities: {
          entry: [
            {
              id: "entry-existing-1",
              content: "Snapshot overwrite attempt",
              source: "manual",
              status: "captured",
              capturedAt: "2026-02-23T10:00:00.000Z",
              createdAt: "2026-02-23T10:00:00.000Z",
              updatedAt: "2026-02-23T10:00:00.000Z",
            },
            {
              id: "entry-snapshot-only-1",
              content: "Snapshot-only entry",
              source: "manual",
              status: "captured",
              capturedAt: "2026-02-23T10:05:00.000Z",
              createdAt: "2026-02-23T10:05:00.000Z",
              updatedAt: "2026-02-23T10:05:00.000Z",
            },
          ],
        },
        auditTrail: [
          {
            id: "audit-snapshot-only-1",
            entityType: "entry",
            entityId: "entry-existing-1",
            fromState: "none",
            toState: "captured",
            actor: { id: "user-1", kind: "user" },
            reason: "snapshot-skip-guard-marker",
            at: "2026-02-23T10:00:00.000Z",
          },
        ],
      });

      const platform = await Effect.runPromise(
        buildCorePlatform({
          repository,
          snapshotPath,
          importSnapshotIntoDatabase: true,
        }),
      );

      const existingEntry = await Effect.runPromise(
        platform.getEntity<{ content: string }>("entry", "entry-existing-1"),
      );
      const snapshotOnlyEntry = await Effect.runPromise(
        platform.getEntity("entry", "entry-snapshot-only-1"),
      );

      expect(existingEntry?.content).toBe("Existing repository row");
      expect(snapshotOnlyEntry).toBeUndefined();
      expect(repository.counters.saveEntity).toBe(0);
      expect(repository.counters.appendAuditTransition).toBe(0);
      expect(repository.counters.withTransaction).toBe(1);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
