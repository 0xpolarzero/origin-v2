import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

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

describe("workflow gate policy integration", () => {
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

  test("package scripts required by workflow gates remain defined and non-empty", () => {
    const scripts = readPackageScripts();
    const requiredScriptNames = [
      "test",
      "typecheck",
      "test:core",
      "test:integration:api",
      "test:integration:workflow",
      "test:integration:db",
    ];

    for (const scriptName of requiredScriptNames) {
      const script = scripts[scriptName];
      expect(typeof script).toBe("string");
      expect(script?.trim().length).toBeGreaterThan(0);
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
});
