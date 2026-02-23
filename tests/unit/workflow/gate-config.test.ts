import { describe, expect, test } from "bun:test";

import {
  assertRequiredGateScripts,
  buildGateCommandConfig,
  resolveFocusTestCommands,
} from "../../../node_modules/super-ralph/src/cli/gate-config";

describe("gate-config", () => {
  test("buildGateCommandConfig derives deterministic base build/test commands from package scripts", () => {
    const config = buildGateCommandConfig("bun", {
      typecheck: "bunx tsc --noEmit",
      build: "bun run build-app",
      lint: "bunx eslint .",
      test: "bun test",
    });

    expect(config.buildCmds).toEqual({
      typecheck: "bun run typecheck",
      build: "bun run build",
      lint: "bun run lint",
    });
    expect(config.testCmds).toEqual({
      test: "bun run test",
    });
    expect(config.preLandChecks).toEqual([
      "bun run typecheck",
      "bun run build",
      "bun run lint",
    ]);
    expect(config.postLandChecks).toEqual(["bun run test"]);

    const allCommands = [
      ...Object.values(config.buildCmds),
      ...Object.values(config.testCmds),
    ];
    expect(
      allCommands.some((command) =>
        command.includes("No build/typecheck command"),
      ),
    ).toBe(false);
    expect(
      allCommands.some((command) => command.includes("No test command")),
    ).toBe(false);
  });

  test("resolveFocusTestCommands maps focus scripts and keeps test as fallback", () => {
    const focusCmds = resolveFocusTestCommands("bun", {
      test: "bun test",
      "test:core": "bun test tests/unit/core",
      "test:integration:api": "bun test tests/integration/api",
      "test:integration:workflow": "bun test tests/integration/workflow",
      "test:integration:db": "bun test tests/integration/db",
    });

    expect(focusCmds).toEqual({
      test: "bun run test",
      core: "bun run test:core",
      api: "bun run test:integration:api",
      workflow: "bun run test:integration:workflow",
      db: "bun run test:integration:db",
    });
  });

  test("assertRequiredGateScripts fails when required gate scripts are missing", () => {
    expect(() =>
      assertRequiredGateScripts({ typecheck: "bunx tsc --noEmit" }),
    ).toThrow("Missing required package scripts: test");

    expect(() => assertRequiredGateScripts({ test: "bun test" })).toThrow(
      "Missing required package scripts: typecheck",
    );
  });
});
