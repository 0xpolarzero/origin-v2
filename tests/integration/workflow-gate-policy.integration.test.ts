import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { buildFallbackConfig } from "super-ralph/cli/fallback-config";
import { buildGateCommandConfig } from "super-ralph/gate-config";
import { resolveTicketGateSelection } from "super-ralph/ticket-gates";
import {
  loadResolveAgentSafetyPolicy,
  withEnv,
} from "../helpers/generated-workflow";

function readPackageScripts() {
  const packageJsonPath = resolve(process.cwd(), "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    scripts?: Record<string, string>;
  };

  return packageJson.scripts ?? {};
}

function readGeneratedWorkflowSource() {
  const workflowPath = resolve(
    process.cwd(),
    ".super-ralph/generated/workflow.tsx",
  );
  return readFileSync(workflowPath, "utf8");
}

function extractConstJson<T = unknown>(source: string, constName: string): T {
  const marker = `const ${constName} =`;
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) {
    throw new Error(`Missing const declaration: ${constName}`);
  }

  const valueStart = source.indexOf("=", markerIndex) + 1;
  let semicolonIndex = source.indexOf(";", valueStart);
  while (semicolonIndex >= 0) {
    const candidate = source.slice(valueStart, semicolonIndex).trim();
    try {
      return JSON.parse(candidate) as T;
    } catch {
      semicolonIndex = source.indexOf(";", semicolonIndex + 1);
    }
  }

  throw new Error(`Could not parse const value as JSON: ${constName}`);
}

function assertNoNoopPatterns(commands: string[], context: string) {
  const noOpPatterns = [/No .* configured yet/i, /\|\|\s*echo\b/i];

  for (const command of commands) {
    for (const pattern of noOpPatterns) {
      expect(command).not.toMatch(pattern);
    }
    expect(command.startsWith("bun run ")).toBe(true);
  }

  expect(commands.length).toBeGreaterThan(0);
  expect(context.length).toBeGreaterThan(0);
}

function runCommand(
  command: string,
  args: string[],
  cwd: string,
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function isCommandAvailable(command: string): boolean {
  const probe = spawnSync(command, ["--version"], {
    encoding: "utf8",
  });
  return probe.status === 0;
}

describe("workflow gate policy integration", () => {
  test("command availability probe marks missing commands unavailable", () => {
    expect(isCommandAvailable("__origin_missing_binary__")).toBe(false);
  });

  test("CLI fallback config keeps Go/Rust gates runnable when node scripts are missing", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "workflow-gates-polyglot-"));

    try {
      writeFileSync(
        join(repoRoot, "go.mod"),
        "module example.com/polyglot\n\ngo 1.22.0\n",
      );
      writeFileSync(
        join(repoRoot, "Cargo.toml"),
        '[package]\nname = "polyglot"\nversion = "0.1.0"\nedition = "2021"\n',
      );

      const fallbackConfig = buildFallbackConfig(
        repoRoot,
        "docs/plans/CORE-REV-004.md",
        {},
      );

      expect(fallbackConfig.buildCmds).toEqual({
        go: "go build ./...",
        rust: "cargo build",
      });
      expect(fallbackConfig.testCmds).toEqual({
        go: "go test ./...",
        rust: "cargo test",
      });
      expect(fallbackConfig.preLandChecks).toEqual([
        "go build ./...",
        "cargo build",
      ]);
      expect(fallbackConfig.postLandChecks).toEqual([
        "go test ./...",
        "cargo test",
      ]);
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test("CLI fallback config uses deterministic gate command wiring for this repo", () => {
    const scripts = readPackageScripts();
    const fallbackConfig = buildFallbackConfig(
      process.cwd(),
      "docs/plans/CORE-REV-004.md",
      scripts,
    );

    expect(fallbackConfig.buildCmds.typecheck).toBe("bun run typecheck");
    expect(fallbackConfig.testCmds.core).toBe("bun run test:core");
    expect(fallbackConfig.testCmds.api).toBe("bun run test:integration:api");
    expect(fallbackConfig.testCmds.workflow).toBe(
      "bun run test:integration:workflow",
    );
    expect(fallbackConfig.testCmds.db).toBe("bun run test:integration:db");
    expect(fallbackConfig.preLandChecks).toEqual(
      Object.values(fallbackConfig.buildCmds),
    );
    expect(fallbackConfig.postLandChecks).toEqual(
      Object.values(fallbackConfig.testCmds),
    );
    expect(fallbackConfig.agentSafetyPolicy).toEqual({
      riskyModeEnabled: false,
      approvalRequiredPhases: [],
    });
  });

  test("maps this repo's scripts to runnable gate commands", () => {
    const scripts = readPackageScripts();
    const config = buildGateCommandConfig("bun", scripts);

    expect(config.buildCmds.typecheck).toBe("bun run typecheck");
    expect(config.testCmds.test).toBe("bun run test");
    expect(config.testCmds.core).toBe("bun run test:core");
    expect(config.testCmds.api).toBe("bun run test:integration:api");
    expect(config.testCmds.workflow).toBe("bun run test:integration:workflow");
    expect(config.testCmds.db).toBe("bun run test:integration:db");

    const allCommands = [
      ...Object.values(config.buildCmds),
      ...Object.values(config.testCmds),
    ];
    expect(allCommands.every((command) => command.startsWith("bun run "))).toBe(
      true,
    );
  });

  test("resolves category-specific gates with typecheck + relevant tests", () => {
    const scripts = readPackageScripts();
    const config = buildGateCommandConfig("bun", scripts);

    const core = resolveTicketGateSelection({
      ticketCategory: "core",
      buildCmds: config.buildCmds,
      testCmds: config.testCmds,
      preLandChecks: config.preLandChecks,
    });
    const api = resolveTicketGateSelection({
      ticketCategory: "api",
      buildCmds: config.buildCmds,
      testCmds: config.testCmds,
      preLandChecks: config.preLandChecks,
    });
    const workflow = resolveTicketGateSelection({
      ticketCategory: "workflow",
      buildCmds: config.buildCmds,
      testCmds: config.testCmds,
      preLandChecks: config.preLandChecks,
    });
    const db = resolveTicketGateSelection({
      ticketCategory: "db",
      buildCmds: config.buildCmds,
      testCmds: config.testCmds,
      preLandChecks: config.preLandChecks,
    });

    expect(core.verifyCommands).toContain("bun run typecheck");
    expect(core.verifyCommands).toContain("bun run test:core");

    expect(api.verifyCommands).toContain("bun run typecheck");
    expect(api.verifyCommands).toContain("bun run test:integration:api");

    expect(workflow.verifyCommands).toContain("bun run typecheck");
    expect(workflow.verifyCommands).toContain(
      "bun run test:integration:workflow",
    );
    expect(db.verifyCommands).toContain("bun run typecheck");
    expect(db.verifyCommands).toContain("bun run test:integration:db");
  });

  test("API testing tickets resolve to typecheck + API integration tests", () => {
    const scripts = readPackageScripts();
    const config = buildGateCommandConfig("bun", scripts);

    const apiTesting = resolveTicketGateSelection({
      ticketId: "API-005",
      ticketCategory: "testing",
      buildCmds: config.buildCmds,
      testCmds: config.testCmds,
      preLandChecks: config.preLandChecks,
    });

    expect(apiTesting.verifyCommands).toEqual([
      "bun run typecheck",
      "bun run test:integration:api",
    ]);
    expect(apiTesting.validationCommands).toEqual([
      "bun run typecheck",
      "bun run test:integration:api",
    ]);
    expect(apiTesting.testSuites).toEqual([
      {
        name: "api tests",
        command: "bun run test:integration:api",
        description: "Run api tests",
      },
    ]);
  });

  test("falls back to default test command for unknown categories", () => {
    const scripts = readPackageScripts();
    const config = buildGateCommandConfig("bun", scripts);

    const fallback = resolveTicketGateSelection({
      ticketCategory: "unknown",
      buildCmds: config.buildCmds,
      testCmds: config.testCmds,
      preLandChecks: config.preLandChecks,
    });

    expect(fallback.verifyCommands).toContain("bun run typecheck");
    expect(fallback.verifyCommands).toContain("bun run test");
    expect(fallback.testSuites).toEqual([
      {
        name: "unknown tests",
        command: "bun run test",
        description: "Run unknown tests",
      },
    ]);
    expect(fallback.validationCommands).toEqual(fallback.verifyCommands);
  });

  test("workflow integration script includes workflow surfaces suite", () => {
    const scripts = readPackageScripts();
    const workflowScript = scripts["test:integration:workflow"];

    expect(workflowScript).toBeDefined();
    expect(workflowScript).toContain("workflow-surfaces.integration.test.ts");
  });

  test("resolved gate commands never include placeholder/no-op patterns", () => {
    const scripts = readPackageScripts();
    const config = buildGateCommandConfig("bun", scripts);
    const categories = ["core", "api", "workflow", "db", "unknown"];

    for (const category of categories) {
      const selection = resolveTicketGateSelection({
        ticketCategory: category,
        buildCmds: config.buildCmds,
        testCmds: config.testCmds,
        preLandChecks: config.preLandChecks,
      });

      assertNoNoopPatterns(selection.verifyCommands, `${category}:verify`);
      assertNoNoopPatterns(
        selection.validationCommands,
        `${category}:validation`,
      );
      assertNoNoopPatterns(
        selection.testSuites.map((suite) => suite.command),
        `${category}:suite`,
      );
    }
  });

  test("package scripts required by workflow gates remain defined, non-empty, and correctly shaped", () => {
    const scripts = readPackageScripts();
    const requiredRootScriptNames = [
      "test",
      "typecheck",
      "test:integration:api",
      "test:integration:db",
    ];

    for (const scriptName of requiredRootScriptNames) {
      const script = scripts[scriptName];
      expect(typeof script).toBe("string");
      expect(script?.trim().length).toBeGreaterThan(0);
      expect(script?.trim().startsWith("bun")).toBe(true);
    }

    expect(scripts.test).toContain("bun test");
    expect(scripts.typecheck).toContain("tsc");
    expect(scripts.typecheck).toContain("tsconfig.typecheck.json");
    expect(scripts["test:integration:api"]).toContain("bun test");
    expect(scripts["test:integration:db"]).toContain("bun test");
  });

  test("generated workflow required gate script keys mirror root package scripts", () => {
    const scripts = readPackageScripts();
    const generatedPackageScripts = extractConstJson<Record<string, string>>(
      readGeneratedWorkflowSource(),
      "PACKAGE_SCRIPTS",
    );
    const requiredRootScriptNames = [
      "test",
      "typecheck",
      "test:integration:api",
      "test:integration:db",
    ] as const;

    for (const scriptName of requiredRootScriptNames) {
      expect(generatedPackageScripts[scriptName]).toBe(scripts[scriptName]);
    }
  });

  test("generated workflow resolves safety policy behavior from env overrides at runtime", () => {
    const resolveAgentSafetyPolicy = loadResolveAgentSafetyPolicy(
      readGeneratedWorkflowSource(),
    );

    withEnv(
      {
        SUPER_RALPH_RISKY_MODE: "1",
        SUPER_RALPH_APPROVAL_REQUIRED_PHASES: "review-fix",
      },
      () => {
        expect(
          resolveAgentSafetyPolicy({
            riskyModeEnabled: true,
            approvalRequiredPhases: ["land"],
          }),
        ).toEqual({
          riskyModeEnabled: true,
          approvalRequiredPhases: ["review-fix"],
        });
      },
    );

    withEnv(
      {
        SUPER_RALPH_RISKY_MODE: undefined,
        SUPER_RALPH_APPROVAL_REQUIRED_PHASES: "implement",
      },
      () => {
        expect(
          resolveAgentSafetyPolicy({
            riskyModeEnabled: true,
            approvalRequiredPhases: ["land"],
          }),
        ).toEqual({
          riskyModeEnabled: true,
          approvalRequiredPhases: ["land"],
        });
      },
    );
  });

  test("temp jj repo keeps progress checkpoints visible from bookmarks and accepts bookmarks(...) revsets", () => {
    if (!isCommandAvailable("jj")) {
      return;
    }

    const repoRoot = mkdtempSync(
      join(tmpdir(), "workflow-gates-jj-traceability-"),
    );
    const remoteRoot = join(repoRoot, "origin.git");

    try {
      expect(runCommand("jj", ["git", "init", "."], repoRoot).status).toBe(0);
      expect(
        runCommand(
          "jj",
          ["config", "set", "--repo", "user.name", "Workflow Bot"],
          repoRoot,
        ).status,
      ).toBe(0);
      expect(
        runCommand(
          "jj",
          ["config", "set", "--repo", "user.email", "workflow@example.com"],
          repoRoot,
        ).status,
      ).toBe(0);

      writeFileSync(join(repoRoot, "PROGRESS.md"), "# Progress\n\n- Updated\n");

      const describe = runCommand(
        "jj",
        ["describe", "-m", "📝 docs: update progress report"],
        repoRoot,
      );
      expect(describe.status).toBe(0);

      const bookmarkSet = runCommand(
        "jj",
        ["bookmark", "set", "progress/update-progress", "-r", "@"],
        repoRoot,
      );
      expect(bookmarkSet.status).toBe(0);

      const checkpoint = runCommand(
        "jj",
        ["log", "-r", "@", "--no-graph", "-T", "commit_id"],
        repoRoot,
      );
      const checkpointCommit = checkpoint.stdout.trim().split("\n")[0] ?? "";
      expect(checkpoint.status).toBe(0);
      expect(checkpointCommit.length).toBeGreaterThan(0);

      expect(runCommand("jj", ["new"], repoRoot).status).toBe(0);
      expect(
        runCommand("git", ["init", "--bare", remoteRoot], repoRoot).status,
      ).toBe(0);
      expect(
        runCommand("git", ["remote", "add", "origin", remoteRoot], repoRoot)
          .status,
      ).toBe(0);
      expect(
        runCommand(
          "jj",
          [
            "bookmark",
            "track",
            "progress/update-progress",
            "--remote",
            "origin",
          ],
          repoRoot,
        ).status,
      ).toBe(0);
      expect(
        runCommand(
          "jj",
          ["git", "push", "--bookmark", "progress/update-progress"],
          repoRoot,
        ).status,
      ).toBe(0);

      const visibleCheckpointLog = runCommand(
        "jj",
        [
          "log",
          "-r",
          'ancestors(bookmarks("progress/update-progress")) & @-',
          "--no-graph",
          "-T",
          "commit_id",
        ],
        repoRoot,
      );
      expect(visibleCheckpointLog.status).toBe(0);
      expect(visibleCheckpointLog.stdout).toContain(checkpointCommit);

      const ticketRevsetCheck = runCommand(
        "jj",
        [
          "log",
          "-r",
          'bookmarks("ticket/CORE-REV-007")',
          "--no-graph",
          "-T",
          "commit_id",
        ],
        repoRoot,
      );
      expect(ticketRevsetCheck.status).toBe(0);
      expect(ticketRevsetCheck.stderr.trim()).toBe("");
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
