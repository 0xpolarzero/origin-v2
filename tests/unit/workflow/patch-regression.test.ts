import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  loadRuntimeConfigHelpers,
  readGeneratedWorkflowSource,
} from "../../helpers/generated-workflow";

const patchPath = resolve(
  process.cwd(),
  "patches/super-ralph-codex-schema.patch",
);
const smithersPatchPath = resolve(
  process.cwd(),
  "patches/smithers-orchestrator-jj-traceability.patch",
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
    expect(sections.has("src/prompts/Land.mdx")).toBe(true);
    expect(sections.has("src/prompts/UpdateProgress.mdx")).toBe(true);
    expect(sections.has("src/mergeQueue/coordinator.ts")).toBe(true);
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

  test("smithers patch persists jj state reconciliation helpers", () => {
    const rootPackage = JSON.parse(
      readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
    ) as {
      patchedDependencies?: Record<string, string>;
    };
    const patched = rootPackage.patchedDependencies ?? {};
    expect(patched["smithers-orchestrator@0.8.5"]).toBe(
      "patches/smithers-orchestrator-jj-traceability.patch",
    );

    const patch = readFileSync(smithersPatchPath, "utf8");
    const sections = parsePatchSections(patch);
    const jjSection = sections.get("src/vcs/jj.ts") ?? "";
    const engineSection = sections.get("src/engine/index.ts") ?? "";
    const indexSection = sections.get("src/index.ts") ?? "";

    expect(sections.has("src/vcs/jj.ts")).toBe(true);
    expect(sections.has("src/engine/index.ts")).toBe(true);
    expect(sections.has("src/index.ts")).toBe(true);
    expect(jjSection).toContain("export async function workspaceUpdateStale(");
    expect(jjSection).toContain("export async function bookmarkSet(");
    expect(engineSection).toContain(
      "async function reconcileExistingJjWorktree(",
    );
    expect(engineSection).toContain(
      "await reconcileExistingJjWorktree(vcs.root, worktreePath, branch);",
    );
    expect(indexSection).toContain("workspaceUpdateStale");
    expect(indexSection).toContain("bookmarkSet");
  });

  test("generated workflow runtime helpers execute merge and check resolution behavior", () => {
    const source = readGeneratedWorkflowSource();
    const { mergeCommandMap, resolveRuntimeConfig, fallbackConfig } =
      loadRuntimeConfigHelpers(source);

    const merged = mergeCommandMap(
      { typecheck: "bun run typecheck" },
      {
        lint: "bun run lint",
        ignoredEmpty: "   ",
        ignoredNonString: 1,
      },
    );
    expect(merged).toEqual({
      typecheck: "bun run typecheck",
      lint: "bun run lint",
    });

    const mergedFallback = resolveRuntimeConfig({
      outputMaybe(schema) {
        if (schema !== "interpret-config") return undefined;
        return {
          buildCmds: {
            lint: "bun run lint",
            ignoredEmpty: "   ",
          },
          testCmds: {
            unit: "bun test unit",
            ignoredEmpty: "",
          },
          preLandChecks: [],
          postLandChecks: [],
        };
      },
    });
    expect(mergedFallback.buildCmds).toMatchObject({
      ...fallbackConfig.buildCmds,
      lint: "bun run lint",
    });
    expect(mergedFallback.buildCmds.ignoredEmpty).toBeUndefined();
    expect(mergedFallback.testCmds).toMatchObject({
      ...fallbackConfig.testCmds,
      unit: "bun test unit",
    });
    expect(mergedFallback.testCmds.ignoredEmpty).toBeUndefined();
    expect(mergedFallback.preLandChecks).toEqual(
      Object.values(mergedFallback.buildCmds),
    );
    expect(mergedFallback.postLandChecks).toEqual(
      Object.values(mergedFallback.testCmds),
    );

    const explicitChecks = resolveRuntimeConfig({
      outputMaybe() {
        return {
          preLandChecks: ["bun run typecheck", "bun run lint"],
          postLandChecks: ["bun run test"],
        };
      },
    });
    expect(explicitChecks.preLandChecks).toEqual([
      "bun run typecheck",
      "bun run lint",
    ]);
    expect(explicitChecks.postLandChecks).toEqual(["bun run test"]);
  });
});
