import { describe, expect, test } from "bun:test";

import {
  InterpretConfig,
  interpretConfigOutputSchema,
} from "../../../node_modules/super-ralph/src/components/InterpretConfig";

const validConfig = {
  projectName: "Origin",
  projectId: "origin-v2",
  focuses: [{ id: "core", name: "Core Platform" }],
  specsPath: "docs/design.spec.md",
  referenceFiles: ["README.md"],
  buildCmds: { typecheck: "bun run typecheck" },
  testCmds: { test: "bun run test" },
  preLandChecks: ["bun run typecheck"],
  postLandChecks: ["bun run test"],
  codeStyle: "Follow repo conventions",
  reviewChecklist: ["Spec compliance"],
  maxConcurrency: 4,
  reasoning: "Use deterministic quality gates.",
};

describe("InterpretConfig guardrails", () => {
  test("schema requires explicit gate command fields", () => {
    const missingBuild = interpretConfigOutputSchema.safeParse({
      ...validConfig,
      buildCmds: undefined,
    });
    const missingTest = interpretConfigOutputSchema.safeParse({
      ...validConfig,
      testCmds: undefined,
    });

    expect(missingBuild.success).toBe(false);
    expect(missingTest.success).toBe(false);
  });

  test("schema rejects empty pre/post land check arrays", () => {
    const emptyPreLand = interpretConfigOutputSchema.safeParse({
      ...validConfig,
      preLandChecks: [],
    });
    const emptyPostLand = interpretConfigOutputSchema.safeParse({
      ...validConfig,
      postLandChecks: [],
    });

    expect(emptyPreLand.success).toBe(false);
    expect(emptyPostLand.success).toBe(false);
  });

  test("prompt hard constraints reinforce gate field requirements", () => {
    const taskElement = InterpretConfig({
      prompt: "Implement workflow gates",
      clarificationSession: null,
      repoRoot: "/tmp/repo",
      fallbackConfig: validConfig,
      packageScripts: {
        typecheck: "bunx tsc --noEmit",
        test: "bun test",
      },
      detectedAgents: {
        claude: true,
        codex: true,
        gh: false,
      },
      agent: { id: "planner" },
    }) as any;

    const promptText = String(taskElement.props.children);

    expect(promptText).toContain(
      "Gate fields are mandatory: buildCmds, testCmds, preLandChecks, postLandChecks.",
    );
    expect(promptText).toContain(
      "preLandChecks and postLandChecks must be non-empty arrays.",
    );
    expect(promptText).toContain(
      "If package scripts include typecheck/test, include both commands in the gate config.",
    );
  });
});
