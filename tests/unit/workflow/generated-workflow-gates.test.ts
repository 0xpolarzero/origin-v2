import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildGateCommandConfig } from "super-ralph/gate-config";
import {
  loadResolveAgentSafetyPolicy,
  readGeneratedWorkflowSource,
  withEnv,
} from "../../helpers/generated-workflow";

type WorkflowConfig = {
  buildCmds: Record<string, string>;
  testCmds: Record<string, string>;
  preLandChecks: string[];
  postLandChecks: string[];
};

export function extractConstJson<T = unknown>(
  source: string,
  constName: string,
): T {
  const marker = `const ${constName} =`;
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) {
    throw new Error(`Missing const declaration: ${constName}`);
  }

  const valueStart = source.indexOf("=", markerIndex) + 1;
  let semicolonIndex = source.indexOf(";", valueStart);
  while (semicolonIndex >= 0) {
    const candidate = source.slice(valueStart, semicolonIndex).trim();
    try {
      return JSON.parse(candidate) as T;
    } catch {
      semicolonIndex = source.indexOf(";", semicolonIndex + 1);
    }
  }

  throw new Error(`Could not parse const value as JSON: ${constName}`);
}

export function assertNoPlaceholderCommands(
  commands: string[],
  context: string,
): void {
  const blockedPatterns = [
    /No .* configured yet/i,
    /\|\|\s*echo\b/i,
    /^echo\b/i,
  ];

  for (const command of commands) {
    for (const pattern of blockedPatterns) {
      expect(command).not.toMatch(pattern);
    }
    expect(command.trim().length).toBeGreaterThan(0);
  }

  expect(context.trim().length).toBeGreaterThan(0);
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, "");
}

function matchesIgnoringWhitespace(source: string, snippet: string): boolean {
  return normalizeWhitespace(source).includes(normalizeWhitespace(snippet));
}

describe("generated workflow gates", () => {
  test("matches snippet content independent of whitespace formatting", () => {
    expect(
      matchesIgnoringWhitespace(
        `const buildCmds = mergeCommandMap(
          FALLBACK_CONFIG.buildCmds,
          interpreted.buildCmds
        );`,
        "const buildCmds = mergeCommandMap(FALLBACK_CONFIG.buildCmds, interpreted.buildCmds);",
      ),
    ).toBe(true);
  });

  test("workflow artifact contains script-derived gate command maps with no placeholders", () => {
    const source = readGeneratedWorkflowSource();
    const packageScripts = extractConstJson<Record<string, string>>(
      source,
      "PACKAGE_SCRIPTS",
    );
    const fallbackConfig = extractConstJson<WorkflowConfig>(
      source,
      "FALLBACK_CONFIG",
    );

    expect(packageScripts.test?.trim().length).toBeGreaterThan(0);
    expect(packageScripts.typecheck?.trim().length).toBeGreaterThan(0);

    const expectedGateConfig = buildGateCommandConfig("bun", packageScripts);
    expect(fallbackConfig.buildCmds).toMatchObject(
      expectedGateConfig.buildCmds,
    );
    expect(fallbackConfig.testCmds).toMatchObject(expectedGateConfig.testCmds);

    const buildCommands = Object.values(fallbackConfig.buildCmds);
    const testCommands = Object.values(fallbackConfig.testCmds);
    expect(buildCommands.length).toBeGreaterThan(0);
    expect(testCommands.length).toBeGreaterThan(0);
    expect(fallbackConfig.preLandChecks).toEqual(buildCommands);
    expect(fallbackConfig.postLandChecks).toEqual(testCommands);

    assertNoPlaceholderCommands(buildCommands, "build commands");
    assertNoPlaceholderCommands(testCommands, "test commands");
    assertNoPlaceholderCommands(
      fallbackConfig.preLandChecks,
      "pre-land checks",
    );
    assertNoPlaceholderCommands(
      fallbackConfig.postLandChecks,
      "post-land checks",
    );
  });

  test("workflow artifact wires runtime command-map merge into SuperRalph and Monitor", () => {
    const source = readGeneratedWorkflowSource();

    expect(source).toMatch(/function\s+mergeCommandMap\s*\(/);
    expect(source).toMatch(/function\s+resolveRuntimeConfig\s*\(\s*ctx:\s*any\s*\)/);
    expect(
      matchesIgnoringWhitespace(
        source,
        "const buildCmds = mergeCommandMap(FALLBACK_CONFIG.buildCmds, interpreted.buildCmds);",
      ),
    ).toBe(true);
    expect(
      matchesIgnoringWhitespace(
        source,
        "const testCmds = mergeCommandMap(FALLBACK_CONFIG.testCmds, interpreted.testCmds);",
      ),
    ).toBe(true);
    expect(
      matchesIgnoringWhitespace(
        source,
        "const runtimeConfig = resolveRuntimeConfig(ctx);",
      ),
    ).toBe(true);
    expect(source).toMatch(/\{\s*\.\.\.\s*runtimeConfig\s*\}/);
    expect(source).toMatch(/config=\{\s*runtimeConfig\s*\}/);
    expect(source).not.toContain(
      '{...((ctx.outputMaybe("interpret-config", outputs.interpret_config) as any) || FALLBACK_CONFIG)}',
    );
    expect(source).not.toContain(
      'config={(ctx.outputMaybe("interpret-config", outputs.interpret_config) as any) || FALLBACK_CONFIG}',
    );
  });

  test("PACKAGE_SCRIPTS required keys mirror root package.json scripts", () => {
    const source = readGeneratedWorkflowSource();
    const generatedPackageScripts = extractConstJson<Record<string, string>>(
      source,
      "PACKAGE_SCRIPTS",
    );
    const rootPackage = JSON.parse(
      readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };
    const rootScripts = rootPackage.scripts ?? {};
    const requiredKeys = [
      "test",
      "typecheck",
      "test:integration:api",
      "test:integration:db",
    ] as const;

    for (const key of requiredKeys) {
      expect(generatedPackageScripts[key]).toBe(rootScripts[key]);
    }
  });

  test("workflow artifact bans hardcoded permissive agent flags and wires safety policy", () => {
    const source = readGeneratedWorkflowSource();

    expect(source).not.toContain("dangerouslySkipPermissions: true");
    expect(source).not.toContain("yolo: true");
    expect(
      matchesIgnoringWhitespace(
        source,
        "const agentSafetyPolicy = resolveAgentSafetyPolicy(runtimeConfig.agentSafetyPolicy);",
      ),
    ).toBe(true);
    expect(source).toMatch(/agentSafetyPolicy=\{\s*agentSafetyPolicy\s*\}/);
  });

  test("workflow artifact resolves policy behavior with env precedence and fail-closed normalization", () => {
    const source = readGeneratedWorkflowSource();
    const resolveAgentSafetyPolicy = loadResolveAgentSafetyPolicy(source);

    withEnv(
      {
        SUPER_RALPH_RISKY_MODE: undefined,
        SUPER_RALPH_APPROVAL_REQUIRED_PHASES: undefined,
      },
      () => {
        expect(resolveAgentSafetyPolicy(undefined)).toEqual({
          riskyModeEnabled: false,
          approvalRequiredPhases: [],
        });
        expect(
          resolveAgentSafetyPolicy({
            riskyModeEnabled: true,
            approvalRequiredPhases: ["land", "unknown", " LAND "],
          }),
        ).toEqual({
          riskyModeEnabled: true,
          approvalRequiredPhases: ["land"],
        });
      },
    );

    withEnv(
      {
        SUPER_RALPH_RISKY_MODE: "1",
        SUPER_RALPH_APPROVAL_REQUIRED_PHASES: undefined,
      },
      () => {
        expect(resolveAgentSafetyPolicy(undefined)).toEqual({
          riskyModeEnabled: true,
          approvalRequiredPhases: ["implement", "review-fix", "land"],
        });
      },
    );

    withEnv(
      {
        SUPER_RALPH_RISKY_MODE: "1",
        SUPER_RALPH_APPROVAL_REQUIRED_PHASES: " land,unknown,IMPLEMENT,land ",
      },
      () => {
        expect(
          resolveAgentSafetyPolicy({
            riskyModeEnabled: true,
            approvalRequiredPhases: ["review-fix"],
          }),
        ).toEqual({
          riskyModeEnabled: true,
          approvalRequiredPhases: ["land", "implement"],
        });
      },
    );
  });
});
