import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import React from "react";

import { SuperRalph } from "super-ralph/components";
import { ralphOutputSchemas } from "super-ralph";
import type { AgentSafetyPolicy } from "super-ralph/components";

const require = createRequire(import.meta.url);

type RenderOptions = {
  specReviewSeverity?: "none" | "minor" | "major" | "critical";
  testSuites?: Array<{
    name: string;
    command: string;
    description: string;
  }>;
  ticket?: TicketFixture;
  agentSafetyPolicy?: AgentSafetyPolicy;
  progressBookmark?: string;
};

type TicketFixture = {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
};

const DEFAULT_TICKET: TicketFixture = {
  id: "CORE-REV-004",
  title: "Ticket",
  description: "Ticket description",
  category: "core",
  priority: "high",
};

function createCtx(
  ticket: TicketFixture = DEFAULT_TICKET,
  specReviewSeverity: RenderOptions["specReviewSeverity"] = "none",
) {
  return {
    runId: "run-1",
    outputMaybe(schema: string, opts: { nodeId: string }) {
      if (
        schema === "category_review" &&
        opts.nodeId === "codebase-review:core"
      ) {
        return {
          suggestedTickets: [ticket],
          overallSeverity: "none",
          specCompliance: { feedback: "" },
        };
      }

      if (
        schema === "spec_review" &&
        opts.nodeId === `${ticket.id}:spec-review`
      ) {
        return {
          severity: specReviewSeverity,
          feedback: specReviewSeverity === "none" ? "" : "Needs fixes",
          issues: specReviewSeverity === "none" ? null : ["Issue"],
        };
      }

      return undefined;
    },
    latest() {
      return undefined;
    },
  } as any;
}

function asArray(value: unknown): unknown[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function findTaskPromptProps(
  tree: unknown,
  taskId: string,
): Record<string, unknown> {
  const queue = [...asArray(tree)];

  while (queue.length > 0) {
    const node = queue.shift();
    if (Array.isArray(node)) {
      queue.push(...node);
      continue;
    }
    if (!node || typeof node !== "object") continue;

    const maybeElement = node as { props?: Record<string, unknown> };
    const props = maybeElement.props;
    if (!props) continue;

    if (props.id === taskId) {
      const promptNode = asArray(props.children)[0] as {
        props?: Record<string, unknown>;
      };
      return promptNode?.props ?? {};
    }

    queue.push(...asArray(props.children));
  }

  throw new Error(`Task not found: ${taskId}`);
}

function findTaskProps(tree: unknown, taskId: string): Record<string, unknown> {
  const queue = [...asArray(tree)];

  while (queue.length > 0) {
    const node = queue.shift();
    if (Array.isArray(node)) {
      queue.push(...node);
      continue;
    }
    if (!node || typeof node !== "object") continue;

    const maybeElement = node as { props?: Record<string, unknown> };
    const props = maybeElement.props;
    if (!props) continue;

    if (props.id === taskId) {
      return props;
    }

    queue.push(...asArray(props.children));
  }

  throw new Error(`Task not found: ${taskId}`);
}

function renderSuperRalph(options: RenderOptions = {}) {
  return SuperRalph({
    ctx: createCtx(options.ticket, options.specReviewSeverity),
    focuses: [{ id: "core", name: "Core Platform" }],
    outputs: ralphOutputSchemas,
    projectId: "origin-v2",
    projectName: "Origin",
    specsPath: "docs/engineering.choices.md",
    referenceFiles: ["README.md"],
    buildCmds: {
      typecheck: "bun run typecheck",
      lint: "bun run lint",
    },
    testCmds: {
      test: "bun run test",
      core: "bun run test:core",
      api: "bun run test:integration:api",
      workflow: "bun run test:integration:workflow",
    },
    codeStyle: "Follow repo conventions",
    reviewChecklist: ["Spec compliance"],
    maxConcurrency: 1,
    agents: {
      planning: { id: "planning" },
      implementation: { id: "implementation" },
      testing: { id: "testing" },
      reviewing: { id: "reviewing" },
      reporting: { id: "reporting" },
      mergeQueue: { id: "merge-queue" },
    },
    preLandChecks: [],
    postLandChecks: [],
    testSuites: options.testSuites ?? [],
    progressBookmark: options.progressBookmark,
    agentSafetyPolicy: options.agentSafetyPolicy,
  });
}

function resolveSuperRalphSourcePath(): string {
  const componentsEntryPath = require.resolve("super-ralph/components");
  return resolve(dirname(componentsEntryPath), "SuperRalph.tsx");
}

describe("SuperRalph ticket-gate wiring", () => {
  test("passes ticket-scoped verify commands to ImplementPrompt", () => {
    const tree = renderSuperRalph();
    const implementProps = findTaskPromptProps(tree, "CORE-REV-004:implement");

    expect(implementProps.verifyCommands).toEqual([
      "bun run typecheck",
      "bun run test:core",
    ]);
  });

  test("passes ticket-scoped suites to TestPrompt", () => {
    const tree = renderSuperRalph();
    const testProps = findTaskPromptProps(tree, "CORE-REV-004:test");

    expect(testProps.testSuites).toEqual([
      {
        name: "core tests",
        command: "bun run test:core",
        description: "Run core tests",
      },
    ]);
  });

  test("reuses configured testSuites when provided", () => {
    const configuredSuites = [
      {
        name: "custom unit suite",
        command: "bun run test:core",
        description: "Run custom unit suite",
      },
      {
        name: "custom api suite",
        command: "bun run test:integration:api",
        description: "Run custom api suite",
      },
    ];
    const tree = renderSuperRalph({ testSuites: configuredSuites });
    const testProps = findTaskPromptProps(tree, "CORE-REV-004:test");

    expect(testProps.testSuites).toEqual(configuredSuites);
  });

  test("reuses ticket-scoped validation commands in ReviewFixPrompt", () => {
    const tree = renderSuperRalph({ specReviewSeverity: "major" });
    const reviewFixProps = findTaskPromptProps(tree, "CORE-REV-004:review-fix");

    expect(reviewFixProps.validationCommands).toEqual([
      "bun run typecheck",
      "bun run test:core",
    ]);
  });

  test("sets explicit no-approval defaults on risky phases when risky mode is off", () => {
    const tree = renderSuperRalph({ specReviewSeverity: "major" });
    const implementTaskProps = findTaskProps(tree, "CORE-REV-004:implement");
    const reviewFixTaskProps = findTaskProps(tree, "CORE-REV-004:review-fix");
    const landTaskProps = findTaskProps(tree, "CORE-REV-004:land");

    expect(implementTaskProps.needsApproval).toBe(false);
    expect(reviewFixTaskProps.needsApproval).toBe(false);
    expect(landTaskProps.needsApproval).toBe(false);
  });

  test("gates risky phases when risky mode is enabled", () => {
    const tree = renderSuperRalph({
      specReviewSeverity: "major",
      agentSafetyPolicy: {
        riskyModeEnabled: true,
        approvalRequiredPhases: [],
      },
    });
    const implementTaskProps = findTaskProps(tree, "CORE-REV-004:implement");
    const reviewFixTaskProps = findTaskProps(tree, "CORE-REV-004:review-fix");
    const landTaskProps = findTaskProps(tree, "CORE-REV-004:land");

    expect(implementTaskProps.needsApproval).toBe(true);
    expect(reviewFixTaskProps.needsApproval).toBe(true);
    expect(landTaskProps.needsApproval).toBe(true);
  });

  test("only gates allowlisted risky phases", () => {
    const tree = renderSuperRalph({
      specReviewSeverity: "major",
      agentSafetyPolicy: {
        riskyModeEnabled: true,
        approvalRequiredPhases: ["land"],
      },
    });
    const implementTaskProps = findTaskProps(tree, "CORE-REV-004:implement");
    const reviewFixTaskProps = findTaskProps(tree, "CORE-REV-004:review-fix");
    const landTaskProps = findTaskProps(tree, "CORE-REV-004:land");

    expect(implementTaskProps.needsApproval).toBe(false);
    expect(reviewFixTaskProps.needsApproval).toBe(false);
    expect(landTaskProps.needsApproval).toBe(true);
  });

  test("binds update-progress worktree to deterministic bookmark branch", () => {
    const tree = renderSuperRalph();
    const updateProgressWorktreeProps = findTaskProps(
      tree,
      "wt-update-progress",
    );

    expect(updateProgressWorktreeProps.branch).toBe("progress/update-progress");
  });

  test("passes progress bookmark into UpdateProgressPrompt", () => {
    const tree = renderSuperRalph({
      progressBookmark: "progress/custom-track",
    });
    const updateProgressPromptProps = findTaskPromptProps(
      tree,
      "update-progress",
    );

    expect(updateProgressPromptProps.progressBookmark).toBe(
      "progress/custom-track",
    );
  });

  test("routes API testing tickets to API integration gates", () => {
    const tree = renderSuperRalph({
      ticket: {
        id: "API-005",
        title: "API ticket",
        description: "Ensure API gates are enforceable",
        category: "testing",
        priority: "medium",
      },
      specReviewSeverity: "major",
    });

    expect(
      findTaskPromptProps(tree, "API-005:implement").verifyCommands,
    ).toEqual(["bun run typecheck", "bun run test:integration:api"]);
    expect(findTaskPromptProps(tree, "API-005:test").testSuites).toEqual([
      {
        name: "api tests",
        command: "bun run test:integration:api",
        description: "Run api tests",
      },
    ]);
    expect(
      findTaskPromptProps(tree, "API-005:review-fix").validationCommands,
    ).toEqual(["bun run typecheck", "bun run test:integration:api"]);
  });

  test("resolves SuperRalph source path through module resolution", () => {
    const sourcePath = resolveSuperRalphSourcePath();
    const componentsEntryPath = require.resolve("super-ralph/components");

    expect(dirname(sourcePath)).toBe(dirname(componentsEntryPath));
    expect(sourcePath.endsWith("SuperRalph.tsx")).toBe(true);
  });

  test("passes ticketId into ticket gate resolution in SuperRalph", () => {
    const source = readFileSync(resolveSuperRalphSourcePath(), "utf8");

    expect(source).toContain("ticketId: ticket.id");
  });
});
