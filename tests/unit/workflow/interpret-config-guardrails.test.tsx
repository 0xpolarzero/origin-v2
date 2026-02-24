import { describe, expect, test } from "bun:test";

import {
  InterpretConfig,
  interpretConfigOutputSchema,
} from "super-ralph/components";

function buildValidInterpretConfigOutput() {
  return {
    projectName: "Origin",
    projectId: "origin-v2",
    focuses: [{ id: "core", name: "Core Platform" }],
    specsPath: "docs/design.spec.md",
    referenceFiles: ["README.md"],
    buildCmds: { typecheck: "bun run typecheck" },
    testCmds: { test: "bun run test" },
    preLandChecks: ["bun run typecheck"],
    postLandChecks: ["bun run test"],
    commitPolicy: {
      allowedTypes: ["feat", "fix", "docs", "chore"],
      requireAtomicChecks: true,
    },
    codeStyle: "Follow repo conventions",
    reviewChecklist: ["Spec compliance"],
    maxConcurrency: 4,
    reasoning: "Generated from package scripts.",
  };
}

function readInterpretPrompt(): string {
  const taskElement = InterpretConfig({
    prompt: "Set up workflow config",
    clarificationSession: null,
    repoRoot: "/repo",
    fallbackConfig: buildValidInterpretConfigOutput(),
    packageScripts: {
      typecheck: "bunx tsc --noEmit",
      test: "bun test",
    },
    detectedAgents: {
      claude: true,
      codex: true,
      gh: false,
    },
    agent: { id: "planning-agent" },
  }) as { props?: { children?: unknown } };

  return String(taskElement?.props?.children ?? "");
}

describe("InterpretConfig guardrails", () => {
  test("schema requires explicit gate command objects", () => {
    const output = buildValidInterpretConfigOutput();
    expect(interpretConfigOutputSchema.parse(output).buildCmds).toEqual({
      typecheck: "bun run typecheck",
    });
    expect(interpretConfigOutputSchema.parse(output).testCmds).toEqual({
      test: "bun run test",
    });

    const withoutBuildCmds = {
      ...output,
      buildCmds: undefined,
    } as unknown;
    const withoutTestCmds = {
      ...output,
      testCmds: undefined,
    } as unknown;

    expect(() => interpretConfigOutputSchema.parse(withoutBuildCmds)).toThrow();
    expect(() => interpretConfigOutputSchema.parse(withoutTestCmds)).toThrow();
  });

  test("schema enforces non-empty pre/post land checks", () => {
    const output = buildValidInterpretConfigOutput();

    expect(() =>
      interpretConfigOutputSchema.parse({
        ...output,
        preLandChecks: [],
      } as unknown),
    ).toThrow();
    expect(() =>
      interpretConfigOutputSchema.parse({
        ...output,
        postLandChecks: [],
      } as unknown),
    ).toThrow();
  });

  test("prompt hard constraints reinforce mandatory gate fields", () => {
    const prompt = readInterpretPrompt();

    expect(prompt).toContain(
      "Gate fields are mandatory: buildCmds, testCmds, preLandChecks, postLandChecks.",
    );
    expect(prompt).toContain(
      "preLandChecks and postLandChecks must be non-empty arrays.",
    );
    expect(prompt).toContain(
      "If package scripts include typecheck/test, include both commands in the gate config.",
    );
  });

  test("schema and prompt hard requirements include commit policy and atomic check discipline", () => {
    const output = buildValidInterpretConfigOutput();
    const parsed = interpretConfigOutputSchema.parse(output);
    const prompt = readInterpretPrompt();

    expect(parsed.commitPolicy).toEqual({
      allowedTypes: ["feat", "fix", "docs", "chore"],
      requireAtomicChecks: true,
    });
    expect(() =>
      interpretConfigOutputSchema.parse({
        ...output,
        commitPolicy: undefined,
      } as unknown),
    ).toThrow();
    expect(prompt).toContain("commitPolicy is mandatory");
    expect(prompt).toContain(
      "Allowed commit types are restricted to feat|fix|docs|chore.",
    );
    expect(prompt).toContain(
      "requireAtomicChecks must stay true to enforce typecheck + relevant tests before each atomic commit.",
    );
  });
});
