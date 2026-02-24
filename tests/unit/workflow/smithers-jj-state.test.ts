import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

async function initTempJjRepo(): Promise<{ root: string; cleanup: () => void }> {
  const root = mkdtempSync(join(tmpdir(), "smithers-jj-state-"));

  const init = spawnSync("jj", ["git", "init", "."], {
    cwd: root,
    encoding: "utf8",
  });
  if (init.status !== 0) {
    throw new Error(init.stderr || `jj git init failed with exit ${init.status}`);
  }

  return {
    root,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

async function loadJjHelpersModule() {
  return await import(
    resolve(process.cwd(), "node_modules/smithers-orchestrator/src/vcs/jj.ts")
  );
}

describe("smithers jj state helpers", () => {
  test("smithers index exports jj workspace reconciliation helpers", () => {
    const indexSource = readFileSync(
      resolve(process.cwd(), "node_modules/smithers-orchestrator/src/index.ts"),
      "utf8",
    );

    expect(indexSource).toContain("workspaceUpdateStale");
    expect(indexSource).toContain("bookmarkSet");
  });

  test("workspaceUpdateStale is safe and idempotent with no stale workspaces", async () => {
    const repo = await initTempJjRepo();

    try {
      const { workspaceUpdateStale } = (await loadJjHelpersModule()) as {
        workspaceUpdateStale: (
          cwd?: string,
        ) => Promise<{ success: boolean; error?: string }>;
      };

      const first = await workspaceUpdateStale(repo.root);
      const second = await workspaceUpdateStale(repo.root);

      expect(first.success).toBe(true);
      expect(second.success).toBe(true);
    } finally {
      repo.cleanup();
    }
  });

  test("bookmarkSet updates a bookmark that is queryable via bookmarks(...) revset", async () => {
    const repo = await initTempJjRepo();

    try {
      const { bookmarkSet } = (await loadJjHelpersModule()) as {
        bookmarkSet: (
          name: string,
          rev: string,
          cwd?: string,
        ) => Promise<{ success: boolean; error?: string }>;
      };

      const result = await bookmarkSet("progress/update-progress", "@", repo.root);
      expect(result.success).toBe(true);

      const check = spawnSync(
        "jj",
        [
          "log",
          "-r",
          'bookmarks("progress/update-progress")',
          "--no-graph",
          "-T",
          "commit_id",
        ],
        {
          cwd: repo.root,
          encoding: "utf8",
        },
      );

      expect(check.status).toBe(0);
      expect(check.stdout.trim().length).toBeGreaterThan(0);
    } finally {
      repo.cleanup();
    }
  });

  test("engine reconciles existing jj worktrees instead of returning stale state early", () => {
    const source = readFileSync(
      resolve(process.cwd(), "node_modules/smithers-orchestrator/src/engine/index.ts"),
      "utf8",
    );

    expect(source).toContain("async function reconcileExistingJjWorktree(");
    expect(source).toContain("const worktreeExists = existsSync(worktreePath);");
    expect(source).toMatch(
      /if \(worktreeExists\) \{[\s\S]*await reconcileExistingJjWorktree\(vcs\.root, worktreePath, branch\);[\s\S]*return;/,
    );
  });
});
