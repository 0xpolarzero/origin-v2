import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

function runJj(cwd: string, args: string[]): {
  status: number;
  stdout: string;
  stderr: string;
} {
  const result = spawnSync("jj", args, {
    cwd,
    encoding: "utf8",
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function runJjOrThrow(cwd: string, args: string[]): void {
  const result = runJj(cwd, args);
  if (result.status !== 0) {
    throw new Error(
      `jj ${args.join(" ")} failed in ${cwd}: ${result.stderr || `exit ${result.status}`}`,
    );
  }
}

function createTempJjRepo(): { root: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), "jj-revset-compat-"));
  runJjOrThrow(root, ["git", "init", "."]);
  runJjOrThrow(root, ["bookmark", "set", "main", "-r", "@"]);
  return {
    root,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

async function loadCoordinatorModule() {
  return await import(
    resolve(process.cwd(), "node_modules/super-ralph/src/mergeQueue/coordinator.ts")
  );
}

describe("jj revset compatibility helpers", () => {
  test("default merge-queue ops can rebase and fast-forward through bookmarks(...) revsets", async () => {
    const repo = createTempJjRepo();

    try {
      runJjOrThrow(repo.root, ["bookmark", "set", "ticket/CORE-REV-007", "-r", "@"]);

      const { createDefaultMergeQueueOps } = (await loadCoordinatorModule()) as {
        createDefaultMergeQueueOps: () => {
          rebase: (
            repoRoot: string,
            ticketId: string,
            destinationRev: string,
          ) => Promise<{ ok: boolean; details: string }>;
          fastForwardMain: (
            repoRoot: string,
            ticketId: string,
          ) => Promise<{ ok: boolean; details: string }>;
          readCommitId: (
            repoRoot: string,
            revset: string,
          ) => Promise<string | null>;
        };
      };
      const ops = createDefaultMergeQueueOps();

      const rebase = await ops.rebase(repo.root, "CORE-REV-007", "main");
      expect(rebase.ok).toBe(true);

      const fastForward = await ops.fastForwardMain(repo.root, "CORE-REV-007");
      expect(fastForward.ok).toBe(true);

      const ticketCommit = await ops.readCommitId(
        repo.root,
        'bookmarks("ticket/CORE-REV-007")',
      );
      expect(ticketCommit).not.toBeNull();
      expect(ticketCommit?.length ?? 0).toBeGreaterThan(0);
    } finally {
      repo.cleanup();
    }
  });

  test("escaped ticket ids avoid revset parse errors during merge-queue rebase operations", async () => {
    const repo = createTempJjRepo();

    try {
      const { createDefaultMergeQueueOps } = (await loadCoordinatorModule()) as {
        createDefaultMergeQueueOps: () => {
          rebase: (
            repoRoot: string,
            ticketId: string,
            destinationRev: string,
          ) => Promise<{ ok: boolean; details: string }>;
        };
      };
      const ops = createDefaultMergeQueueOps();
      const rebase = await ops.rebase(
        repo.root,
        'quote"and\\slash',
        "main",
      );

      expect(rebase.ok).toBe(false);
      expect(rebase.details).toContain("Empty revision set");
      expect(rebase.details).not.toMatch(/syntax|parse|unterminated/i);
    } finally {
      repo.cleanup();
    }
  });
});
