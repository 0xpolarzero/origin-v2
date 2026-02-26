import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const patchPath = resolve(
  process.cwd(),
  "patches/super-ralph-codex-schema.patch",
);

function parsePatchSections(patch: string): Map<string, string> {
  const sectionHeaders = [...patch.matchAll(/^diff --git a\/(.+?) b\/(.+)$/gm)];
  const sections = new Map<string, string>();

  for (let index = 0; index < sectionHeaders.length; index += 1) {
    const current = sectionHeaders[index];
    const next = sectionHeaders[index + 1];
    const start = current.index ?? 0;
    const end = next?.index ?? patch.length;
    const path = current[2];
    sections.set(path, patch.slice(start, end));
  }

  return sections;
}

function extractAddedLines(section: string): string {
  return section
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1))
    .join("\n");
}

describe("super-ralph patch regression", () => {
  test("patch keeps required gate helper and wiring sections", () => {
    const patch = readFileSync(patchPath, "utf8");
    const sections = parsePatchSections(patch);

    expect(sections.has("package.json")).toBe(true);
    expect(sections.has("src/cli/index.ts")).toBe(true);
    expect(sections.has("src/components/SuperRalph.tsx")).toBe(true);
    expect(sections.has("src/components/index.ts")).toBe(true);
    expect(sections.has("src/components/InterpretConfig.tsx")).toBe(true);
  });

  test("CLI patch hunks retain safety-policy wiring and safe agent defaults", () => {
    const patch = readFileSync(patchPath, "utf8");
    const sections = parsePatchSections(patch);
    const cliSection = sections.get("src/cli/index.ts") ?? "";
    const cliAddedLines = extractAddedLines(cliSection);

    expect(cliSection).not.toContain("old mode 100644");
    expect(cliSection).not.toContain("new mode 100755");
    expect(cliSection).toContain(
      'import { buildFallbackConfig } from "./fallback-config"',
    );
    expect(cliSection).toContain(
      "function resolveAgentSafetyPolicy(input: unknown): AgentSafetyPolicy",
    );
    expect(cliSection).toContain('process.env.SUPER_RALPH_RISKY_MODE === "1"');
    expect(cliSection).toContain(
      "process.env.SUPER_RALPH_APPROVAL_REQUIRED_PHASES",
    );
    expect(cliSection).toContain("const safeDefaults = {");
    expect(cliSection).toContain("yolo: false");
    expect(cliSection).toContain(
      "dangerouslySkipPermissions: policy.riskyModeEnabled",
    );
    expect(cliSection).not.toMatch(/^\+.*dangerouslySkipPermissions:\s*true/m);
    expect(cliSection).not.toMatch(/^\+.*yolo:\s*true/m);
    expect(cliSection).toContain("function mergeCommandMap(");
    expect(cliSection).toContain("function resolveRuntimeConfig(ctx: any)");
    expect(cliSection).toContain(
      "const runtimeConfig = resolveRuntimeConfig(ctx);",
    );
    expect(cliSection).toContain(
      "const agentSafetyPolicy = resolveAgentSafetyPolicy(runtimeConfig.agentSafetyPolicy);",
    );
    expect(cliAddedLines).toMatch(/\{\s*\.\.\.runtimeConfig\s*\}/);
    expect(cliAddedLines).toMatch(/config=\{runtimeConfig\}/);
    expect(cliAddedLines).toMatch(/agentSafetyPolicy=\{agentSafetyPolicy\}/);
  });

  test("component wiring hunks preserve ticket gates and approval gating markers", () => {
    const patch = readFileSync(patchPath, "utf8");
    const sections = parsePatchSections(patch);
    const superRalphSection =
      sections.get("src/components/SuperRalph.tsx") ?? "";
    const interpretSection =
      sections.get("src/components/InterpretConfig.tsx") ?? "";
    const indexSection = sections.get("src/components/index.ts") ?? "";
    const superRalphAddedLines = extractAddedLines(superRalphSection);

    expect(superRalphSection).toContain("resolveTicketGateSelection");
    expect(superRalphSection).toContain(
      "verifyCommands={ticketGateSelection.verifyCommands}",
    );
    expect(superRalphSection).toContain("testSuites.length > 0");
    expect(superRalphSection).toContain("ticketGateSelection.testSuites");
    expect(superRalphSection).toContain(
      "validationCommands={ticketGateSelection.validationCommands}",
    );
    expect(superRalphAddedLines).toMatch(
      /needsApproval=\{requiresApprovalForPhase\(\s*"implement",\s*agentSafetyPolicy,\s*\)\}/s,
    );
    expect(superRalphAddedLines).toMatch(
      /needsApproval=\{requiresApprovalForPhase\(\s*"review-fix",\s*agentSafetyPolicy,\s*\)\}/s,
    );
    expect(superRalphAddedLines).toMatch(
      /needsApproval=\{requiresApprovalForPhase\(\s*"land",\s*agentSafetyPolicy,\s*\)\}/s,
    );
    expect(indexSection).toContain("normalizeAgentSafetyPolicy");
    expect(indexSection).toContain("requiresApprovalForPhase");
    expect(indexSection).toContain("AgentSafetyPolicy");
    expect(interpretSection).toContain(
      "buildCmds: z.object({}).catchall(z.string())",
    );
    expect(interpretSection).toContain(
      "testCmds: z.object({}).catchall(z.string())",
    );
    expect(interpretSection).toContain(
      "preLandChecks: z.array(z.string()).min(1)",
    );
    expect(interpretSection).toContain(
      "postLandChecks: z.array(z.string()).min(1)",
    );
  });
});
