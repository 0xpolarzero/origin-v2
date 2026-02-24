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
  db: "bun run test:integration:db",
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

  test("resolveCategoryTestCommand maps API testing tickets to integration API tests", () => {
    expect(resolveCategoryTestCommand("testing", testCmds, "API-005")).toBe(
      "bun run test:integration:api",
    );
  });

  test("resolveCategoryTestCommand throws when no runnable test command exists", () => {
    expect(() =>
      resolveCategoryTestCommand("core", { core: "   ", test: "  " }),
    ).toThrow(/No runnable test command configured/i);
    expect(() => resolveCategoryTestCommand("unknown", {})).toThrow(
      /No runnable test command configured/i,
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

  test("resolveVerifyCommands for API testing tickets keeps typecheck + api suite and dedupes", () => {
    const verifyCommands = resolveVerifyCommands({
      ticketId: "API-005",
      ticketCategory: "testing",
      buildCmds,
      testCmds,
      preLandChecks: ["bun run typecheck", "bun run typecheck"],
    });

    expect(verifyCommands).toEqual([
      "bun run typecheck",
      "bun run test:integration:api",
    ]);
  });

  test("resolveVerifyCommands rejects placeholder and soft-fail command patterns", () => {
    expect(() =>
      resolveVerifyCommands({
        ticketCategory: "core",
        buildCmds,
        testCmds,
        preLandChecks: ['echo "No build/typecheck command configured yet"'],
      }),
    ).toThrow(/non-runnable gate command/i);

    expect(() =>
      resolveVerifyCommands({
        ticketCategory: "core",
        buildCmds: {
          typecheck: 'bun run typecheck || echo "No tsconfig yet"',
        },
        testCmds,
        preLandChecks: [],
      }),
    ).toThrow(/non-runnable gate command/i);

    expect(() =>
      resolveVerifyCommands({
        ticketId: "API-005",
        ticketCategory: "testing",
        buildCmds,
        testCmds: {
          ...testCmds,
          api: 'echo "No api tests configured yet"',
          test: 'echo "No tests configured yet"',
        },
        preLandChecks: ["bun run typecheck"],
      }),
    ).toThrow(/No runnable test command configured/i);
  });

  test("resolveTicketGateSelection rejects missing and non-runnable validation commands", () => {
    expect(() =>
      resolveTicketGateSelection({
        ticketCategory: "core",
        buildCmds: {},
        testCmds: {},
        preLandChecks: [],
      }),
    ).toThrow(/No runnable test command configured/i);

    expect(() =>
      resolveTicketGateSelection({
        ticketCategory: "workflow",
        buildCmds: {
          typecheck: 'bun run typecheck || echo "No tsconfig yet"',
        },
        testCmds: {
          workflow: "bun run test:integration:workflow",
        },
        preLandChecks: [],
      }),
    ).toThrow(/non-runnable gate command/i);
  });
});
