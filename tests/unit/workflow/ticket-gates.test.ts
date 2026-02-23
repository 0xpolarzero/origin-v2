import { describe, expect, test } from "bun:test";

import {
  resolveCategoryTestCommand,
  resolveTicketGateSelection,
  resolveVerifyCommands,
} from "super-ralph/ticket-gates";

const buildCmds = {
  typecheck: "bun run typecheck",
  lint: "bun run lint",
};

const testCmds = {
  test: "bun run test",
  core: "bun run test:core",
  api: "bun run test:integration:api",
  workflow: "bun run test:integration:workflow",
};

describe("ticket-gates", () => {
  test("resolveTicketGateSelection chooses typecheck + category test for core tickets", () => {
    const selection = resolveTicketGateSelection({
      ticketCategory: "core",
      buildCmds,
      testCmds,
      preLandChecks: [],
    });

    expect(selection.verifyCommands).toEqual([
      "bun run typecheck",
      "bun run test:core",
    ]);
    expect(selection.validationCommands).toEqual([
      "bun run typecheck",
      "bun run test:core",
    ]);
    expect(selection.testSuites).toEqual([
      {
        name: "core tests",
        command: "bun run test:core",
        description: "Run core tests",
      },
    ]);
  });

  test("resolveCategoryTestCommand maps api/workflow and falls back to default test", () => {
    expect(resolveCategoryTestCommand("api", testCmds)).toBe(
      "bun run test:integration:api",
    );
    expect(resolveCategoryTestCommand("workflow", testCmds)).toBe(
      "bun run test:integration:workflow",
    );
    expect(resolveCategoryTestCommand("unknown-category", testCmds)).toBe(
      "bun run test",
    );
  });

  test("resolveVerifyCommands reuses preLandChecks and always includes relevant test", () => {
    const verifyCommands = resolveVerifyCommands({
      ticketCategory: "core",
      buildCmds,
      testCmds,
      preLandChecks: ["bun run typecheck", "bun run lint"],
    });

    expect(verifyCommands).toEqual([
      "bun run typecheck",
      "bun run lint",
      "bun run test:core",
    ]);
  });
});
