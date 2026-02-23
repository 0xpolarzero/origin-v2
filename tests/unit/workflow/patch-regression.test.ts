import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const patchPath = resolve(
  process.cwd(),
  "patches/super-ralph-codex-schema.patch",
);

describe("super-ralph patch regression", () => {
  test("patch includes gate helper files and ticket-scoped wiring hunks", () => {
    const patch = readFileSync(patchPath, "utf8");

    expect(patch).toContain(
      "diff --git a/src/cli/gate-config.ts b/src/cli/gate-config.ts",
    );
    expect(patch).toContain(
      "diff --git a/src/components/ticket-gates.ts b/src/components/ticket-gates.ts",
    );
    expect(patch).toContain(
      "verifyCommands={ticketGateSelection.verifyCommands}",
    );
    expect(patch).toContain("testSuites={ticketGateSelection.testSuites}");
    expect(patch).toContain(
      "validationCommands={ticketGateSelection.validationCommands}",
    );
    expect(patch).toContain("preLandChecks: z.array(z.string()).min(1)");
    expect(patch).toContain("postLandChecks: z.array(z.string()).min(1)");
  });
});
