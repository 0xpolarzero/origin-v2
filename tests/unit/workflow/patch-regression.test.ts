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

describe("super-ralph patch regression", () => {
  test("patch keeps required gate helper and wiring sections", () => {
    const patch = readFileSync(patchPath, "utf8");
    const sections = parsePatchSections(patch);

    expect(sections.has("src/cli/gate-config.ts")).toBe(true);
    expect(sections.has("src/cli/fallback-config.ts")).toBe(true);
    expect(sections.has("src/cli/index.ts")).toBe(true);
    expect(sections.has("src/components/ticket-gates.ts")).toBe(true);
    expect(sections.has("src/components/SuperRalph.tsx")).toBe(true);
    expect(sections.has("src/components/InterpretConfig.tsx")).toBe(true);
  });

  test("CLI patch hunks retain fallback-gate wiring", () => {
    const patch = readFileSync(patchPath, "utf8");
    const sections = parsePatchSections(patch);
    const cliSection = sections.get("src/cli/index.ts") ?? "";
    const fallbackSection = sections.get("src/cli/fallback-config.ts") ?? "";

    expect(cliSection).toContain('import { buildFallbackConfig } from "./fallback-config"');
    expect(cliSection).toContain("-function buildFallbackConfig(");
    expect(cliSection).toContain("-function detectScriptRunner(");
    expect(fallbackSection).toContain("buildGateCommandConfig");
    expect(fallbackSection).toContain("preLandChecks: Object.values(buildCmds)");
    expect(fallbackSection).toContain("postLandChecks: Object.values(testCmds)");
    expect(cliSection).toContain("function mergeCommandMap(");
    expect(cliSection).toContain("function resolveRuntimeConfig(ctx: any)");
    expect(cliSection).toContain("const runtimeConfig = resolveRuntimeConfig(ctx);");
    expect(cliSection).toContain("+            {...runtimeConfig}");
    expect(cliSection).toContain("+            config={runtimeConfig}");
  });

  test("component wiring hunks preserve ticket-scoped gate contracts", () => {
    const patch = readFileSync(patchPath, "utf8");
    const sections = parsePatchSections(patch);
    const superRalphSection = sections.get("src/components/SuperRalph.tsx") ?? "";
    const interpretSection = sections.get("src/components/InterpretConfig.tsx") ?? "";

    expect(superRalphSection).toContain("resolveTicketGateSelection");
    expect(superRalphSection).toContain("verifyCommands={ticketGateSelection.verifyCommands}");
    expect(superRalphSection).toContain("testSuites.length > 0");
    expect(superRalphSection).toContain("ticketGateSelection.testSuites");
    expect(superRalphSection).toContain(
      "validationCommands={ticketGateSelection.validationCommands}",
    );
    expect(interpretSection).toContain("buildCmds: z.object({}).catchall(z.string())");
    expect(interpretSection).toContain("testCmds: z.object({}).catchall(z.string())");
    expect(interpretSection).toContain("preLandChecks: z.array(z.string()).min(1)");
    expect(interpretSection).toContain("postLandChecks: z.array(z.string()).min(1)");
  });

  test("ticket gate patch hunks enforce strict no-placeholder behavior", () => {
    const patch = readFileSync(patchPath, "utf8");
    const sections = parsePatchSections(patch);
    const ticketGatesSection = sections.get("src/components/ticket-gates.ts") ?? "";

    expect(ticketGatesSection).not.toContain(
      'return "echo \\"No test command configured yet\\"";',
    );
    expect(ticketGatesSection).toContain("throw new Error(");
    expect(ticketGatesSection).toContain("resolveVerifyCommands");
    expect(ticketGatesSection).toContain("resolveTicketGateSelection");
  });
});
