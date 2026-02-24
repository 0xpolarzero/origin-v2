export type AgentSafetyPolicy = {
  riskyModeEnabled: boolean;
  approvalRequiredPhases: string[];
};

export function normalizeAgentSafetyPolicy(
  input: unknown,
): AgentSafetyPolicy;

export function requiresApprovalForPhase(
  phase: string,
  policy: AgentSafetyPolicy,
): boolean;

export function SuperRalph(props: Record<string, unknown>): unknown;

export function InterpretConfig(props: Record<string, unknown>): unknown;

export const interpretConfigOutputSchema: {
  parse: (input: unknown) => any;
};
