import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildGateCommandConfig } from "../../node_modules/super-ralph/src/cli/gate-config";
import { resolveTicketGateSelection } from "../../node_modules/super-ralph/src/components/ticket-gates";

function readPackageScripts() {
  const packageJsonPath = resolve(process.cwd(), "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    scripts?: Record<string, string>;
  };

  return packageJson.scripts ?? {};
}

describe("workflow gate policy integration", () => {
  test("maps this repo's scripts to runnable gate commands", () => {
    const scripts = readPackageScripts();
    const config = buildGateCommandConfig("bun", scripts);

    expect(config.buildCmds.typecheck).toBe("bun run typecheck");
    expect(config.testCmds.test).toBe("bun run test");
    expect(config.testCmds.core).toBe("bun run test:core");
    expect(config.testCmds.api).toBe("bun run test:integration:api");
    expect(config.testCmds.workflow).toBe("bun run test:integration:workflow");

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

    expect(core.verifyCommands).toContain("bun run typecheck");
    expect(core.verifyCommands).toContain("bun run test:core");

    expect(api.verifyCommands).toContain("bun run typecheck");
    expect(api.verifyCommands).toContain("bun run test:integration:api");

    expect(workflow.verifyCommands).toContain("bun run typecheck");
    expect(workflow.verifyCommands).toContain(
      "bun run test:integration:workflow",
    );
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
});
