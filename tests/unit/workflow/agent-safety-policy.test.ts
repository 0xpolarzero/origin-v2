import { describe, expect, test } from "bun:test";

import {
  normalizeAgentSafetyPolicy,
  requiresApprovalForPhase,
  type AgentSafetyPolicy,
} from "super-ralph/components";

function buildPolicy(
  overrides: Partial<AgentSafetyPolicy> = {},
): AgentSafetyPolicy {
  return normalizeAgentSafetyPolicy({
    riskyModeEnabled: true,
    approvalRequiredPhases: ["implement", "review-fix", "land"],
    ...overrides,
  });
}

describe("agent safety policy", () => {
  test("defaults fail closed when input is missing or malformed", () => {
    const empty = normalizeAgentSafetyPolicy(undefined);
    const malformed = normalizeAgentSafetyPolicy({
      riskyModeEnabled: "true",
      approvalRequiredPhases: "land",
    });

    expect(empty).toEqual({
      riskyModeEnabled: false,
      approvalRequiredPhases: [],
    });
    expect(malformed).toEqual({
      riskyModeEnabled: false,
      approvalRequiredPhases: [],
    });
  });

  test("uses risky-phase defaults when risky mode is explicitly enabled", () => {
    const policy = normalizeAgentSafetyPolicy({ riskyModeEnabled: true });

    expect(policy.riskyModeEnabled).toBe(true);
    expect(policy.approvalRequiredPhases).toEqual([
      "implement",
      "review-fix",
      "land",
    ]);
    expect(requiresApprovalForPhase("implement", policy)).toBe(true);
    expect(requiresApprovalForPhase("review-fix", policy)).toBe(true);
    expect(requiresApprovalForPhase("land", policy)).toBe(true);
    expect(requiresApprovalForPhase("research", policy)).toBe(false);
  });

  test("supports explicit allowlist so only selected risky phases require approval", () => {
    const policy = buildPolicy({ approvalRequiredPhases: ["land"] });

    expect(policy.approvalRequiredPhases).toEqual(["land"]);
    expect(requiresApprovalForPhase("implement", policy)).toBe(false);
    expect(requiresApprovalForPhase("review-fix", policy)).toBe(false);
    expect(requiresApprovalForPhase("land", policy)).toBe(true);
  });

  test("filters unknown phases and duplicates from configured allowlist", () => {
    const policy = buildPolicy({
      approvalRequiredPhases: ["land", "unknown", "land", " IMPLEMENT "],
    });

    expect(policy.approvalRequiredPhases).toEqual(["land", "implement"]);
  });

  test("never requires approval when risky mode is disabled", () => {
    const policy = normalizeAgentSafetyPolicy({
      riskyModeEnabled: false,
      approvalRequiredPhases: ["implement", "land"],
    });

    expect(policy).toEqual({
      riskyModeEnabled: false,
      approvalRequiredPhases: [],
    });
    expect(requiresApprovalForPhase("implement", policy)).toBe(false);
    expect(requiresApprovalForPhase("land", policy)).toBe(false);
  });
});
