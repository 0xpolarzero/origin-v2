import { describe, expect, test } from "bun:test";
import React from "react";

import { SuperRalph } from "super-ralph/components";
import { ralphOutputSchemas } from "super-ralph";

type RenderOptions = {
  specReviewSeverity?: "none" | "minor" | "major" | "critical";
  testSuites?: Array<{
    name: string;
    command: string;
    description: string;
  }>;
};

function createCtx(
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
          suggestedTickets: [
            {
              id: "CORE-REV-004",
              title: "Ticket",
              description: "Ticket description",
              category: "core",
              priority: "high",
            },
          ],
          overallSeverity: "none",
          specCompliance: { feedback: "" },
        };
      }

      if (
        schema === "spec_review" &&
        opts.nodeId === "CORE-REV-004:spec-review"
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

function renderSuperRalph(options: RenderOptions = {}) {
  return SuperRalph({
    ctx: createCtx(options.specReviewSeverity),
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
  });
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
});
