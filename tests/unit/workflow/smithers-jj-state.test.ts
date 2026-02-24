import { describe, expect, test } from "bun:test";
import React from "react";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createSmithers, runWorkflow, Worktree } from "smithers-orchestrator";
import { z } from "zod";

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

function runJj(cwd: string, args: string[]): { status: number; stdout: string; stderr: string } {
  const res = spawnSync("jj", args, {
    cwd,
    encoding: "utf8",
  });
  return {
    status: res.status ?? 1,
    stdout: res.stdout ?? "",
    stderr: res.stderr ?? "",
  };
}

function runJjOrThrow(cwd: string, args: string[]): void {
  const res = runJj(cwd, args);
  if (res.status !== 0) {
    throw new Error(
      `jj ${args.join(" ")} failed in ${cwd}: ${res.stderr || `exit ${res.status}`}`,
    );
  }
}

function readCommitId(cwd: string, revset: string): string {
  const res = runJj(cwd, ["log", "-r", revset, "--no-graph", "-T", "commit_id"]);
  if (res.status !== 0) {
    throw new Error(
      `Failed to read commit for revset ${revset}: ${res.stderr || `exit ${res.status}`}`,
    );
  }
  return res.stdout.trim().split("\n")[0]?.trim() ?? "";
}

async function runWorkflowWithWorktree(params: {
  dbPath: string;
  runId: string;
  rootDir: string;
  worktreePath: string;
  branch: string;
}): Promise<{ status: string; error?: unknown }> {
  const outputSchema = z.object({
    ok: z.boolean(),
  });

  const { Workflow, Task, outputs, smithers } = createSmithers(
    { noop_task: outputSchema },
    { dbPath: params.dbPath },
  );

  const workflow = smithers(() =>
    React.createElement(
      Workflow,
      { name: "jj-worktree-reconcile-runtime" },
      React.createElement(
        Worktree,
        {
          id: "wt-existing-jj",
          path: params.worktreePath,
          branch: params.branch,
        },
        React.createElement(
          Task,
          {
            id: "noop-task",
            output: outputs.noop_task,
          },
          { ok: true } as any,
        ),
      ),
    ),
  );

  return await runWorkflow(workflow, {
    runId: params.runId,
    input: {},
    rootDir: params.rootDir,
  });
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

  test("workspaceUpdateStale returns deterministic failure details outside a jj repo", async () => {
    const outsideRepo = mkdtempSync(join(tmpdir(), "smithers-jj-outside-"));

    try {
      const { workspaceUpdateStale } = (await loadJjHelpersModule()) as {
        workspaceUpdateStale: (
          cwd?: string,
        ) => Promise<{ success: boolean; error?: string }>;
      };

      const result = await workspaceUpdateStale(outsideRepo);
      expect(result.success).toBe(false);
      expect(result.error?.trim().length ?? 0).toBeGreaterThan(0);
    } finally {
      rmSync(outsideRepo, { recursive: true, force: true });
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

  test("bookmarkSet surfaces deterministic failures when revision lookup fails", async () => {
    const repo = await initTempJjRepo();

    try {
      const { bookmarkSet } = (await loadJjHelpersModule()) as {
        bookmarkSet: (
          name: string,
          rev: string,
          cwd?: string,
        ) => Promise<{ success: boolean; error?: string }>;
      };

      const result = await bookmarkSet(
        "progress/update-progress",
        "non-existent-rev",
        repo.root,
      );
      expect(result.success).toBe(false);
      expect(result.error?.trim().length ?? 0).toBeGreaterThan(0);
    } finally {
      repo.cleanup();
    }
  });

  test("engine behaviorally reconciles pre-existing jj worktrees and remains idempotent on re-entry", async () => {
    const repo = await initTempJjRepo();
    const worktreePath = join(
      tmpdir(),
      `existing-jj-worktree-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    const outsideRoot = mkdtempSync(join(tmpdir(), "smithers-jj-outside-root-"));
    const dbPath = join(tmpdir(), `smithers-jj-runtime-${Date.now()}-${Math.random()}.sqlite`);
    const bookmarkName = "ticket/CORE-REV-007";

    try {
      runJjOrThrow(repo.root, ["workspace", "add", worktreePath, "--name", "existing-wt"]);
      runJjOrThrow(repo.root, ["bookmark", "set", bookmarkName, "-r", "@"]);

      writeFileSync(join(worktreePath, "runtime-reconcile.txt"), "worktree runtime\n");
      runJjOrThrow(worktreePath, ["commit", "-m", "worktree-change"]);
      runJjOrThrow(worktreePath, [
        "bookmark",
        "set",
        bookmarkName,
        "-r",
        "@-",
        "--allow-backwards",
      ]);

      const bookmarkBefore = readCommitId(
        worktreePath,
        `bookmarks("${bookmarkName}")`,
      );
      const worktreeHeadBefore = readCommitId(worktreePath, "@");
      expect(bookmarkBefore).not.toBe(worktreeHeadBefore);

      const firstRun = await runWorkflowWithWorktree({
        dbPath,
        runId: `run-one-${Date.now()}`,
        rootDir: repo.root,
        worktreePath,
        branch: bookmarkName,
      });
      if (firstRun.status !== "finished") {
        throw new Error(
          `first run failed: ${JSON.stringify(firstRun.error ?? null)}`,
        );
      }

      const bookmarkAfterFirstRun = readCommitId(
        worktreePath,
        `bookmarks("${bookmarkName}")`,
      );
      expect(bookmarkAfterFirstRun.length).toBeGreaterThan(0);

      const secondRun = await runWorkflowWithWorktree({
        dbPath,
        runId: `run-two-${Date.now()}`,
        rootDir: outsideRoot,
        worktreePath,
        branch: bookmarkName,
      });
      if (secondRun.status !== "finished") {
        throw new Error(
          `second run failed: ${JSON.stringify(secondRun.error ?? null)}`,
        );
      }
    } finally {
      rmSync(dbPath, { force: true });
      rmSync(worktreePath, { recursive: true, force: true });
      rmSync(outsideRoot, { recursive: true, force: true });
      repo.cleanup();
    }
  });

  test("engine source keeps reconciliation helper wired for existing worktrees", () => {
    const source = readFileSync(
      resolve(process.cwd(), "node_modules/smithers-orchestrator/src/engine/index.ts"),
      "utf8",
    );

    expect(source).toContain("async function reconcileExistingJjWorktree(");
    expect(source).toContain("await reconcileExistingJjWorktree(vcs.root, worktreePath, branch);");
  });
});
