import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const interpretConfigPath = resolve(
  process.cwd(),
  "node_modules/super-ralph/src/components/InterpretConfig.tsx",
);
const interpretConfigSource = readFileSync(interpretConfigPath, "utf8");

describe("InterpretConfig guardrails", () => {
  test("schema keeps explicit gate command fields", () => {
    expect(interpretConfigSource).toContain(
      "buildCmds: z.object({}).catchall(z.string()),",
    );
    expect(interpretConfigSource).toContain(
      "testCmds: z.object({}).catchall(z.string()),",
    );
  });

  test("schema enforces non-empty pre/post land check arrays", () => {
    expect(interpretConfigSource).toContain(
      "preLandChecks: z.array(z.string()).min(1),",
    );
    expect(interpretConfigSource).toContain(
      "postLandChecks: z.array(z.string()).min(1),",
    );
  });

  test("prompt hard constraints reinforce gate field requirements", () => {
    expect(interpretConfigSource).toContain(
      "- Gate fields are mandatory: buildCmds, testCmds, preLandChecks, postLandChecks.",
    );
    expect(interpretConfigSource).toContain(
      "- preLandChecks and postLandChecks must be non-empty arrays.",
    );
    expect(interpretConfigSource).toContain(
      "- If package scripts include typecheck/test, include both commands in the gate config.",
    );
  });
});
