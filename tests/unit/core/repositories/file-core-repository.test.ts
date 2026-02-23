import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Effect } from "effect";

import { createEntry } from "../../../../src/core/domain/entry";
import { makeFileCoreRepository } from "../../../../src/core/repositories/file-core-repository";

describe("makeFileCoreRepository", () => {
  test("persistSnapshot creates parent directories for new snapshot paths", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "origin-file-repo-"));
    const snapshotPath = join(tempDir, "nested", "state", "snapshot.json");

    try {
      const repository = await Effect.runPromise(
        makeFileCoreRepository(snapshotPath),
      );
      const entry = await Effect.runPromise(
        createEntry({
          id: "entry-file-1",
          content: "Persist me to nested path",
        }),
      );

      await Effect.runPromise(repository.saveEntity("entry", entry.id, entry));
      if (!repository.persistSnapshot) {
        throw new Error("persistSnapshot is required for file repository");
      }
      await Effect.runPromise(repository.persistSnapshot(snapshotPath));

      expect(existsSync(snapshotPath)).toBe(true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("loadSnapshot fails with controlled error when snapshot shape is invalid", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "origin-file-repo-"));
    const snapshotPath = join(tempDir, "invalid-shape.json");

    try {
      writeFileSync(
        snapshotPath,
        JSON.stringify({
          version: 1,
          entities: null,
          auditTrail: [],
        }),
        "utf8",
      );

      const repository = await Effect.runPromise(
        makeFileCoreRepository(snapshotPath),
      );
      if (!repository.loadSnapshot) {
        throw new Error("loadSnapshot is required for file repository");
      }

      await expect(
        Effect.runPromise(repository.loadSnapshot(snapshotPath)),
      ).rejects.toThrow("invalid snapshot shape");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
