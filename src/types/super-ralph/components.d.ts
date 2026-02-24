export type AgentSafetyPolicy = {
  riskyModeEnabled: boolean;
  approvalRequiredPhases: string[];
};

export type CommitPolicy = {
  allowedTypes: string[];
  requireAtomicChecks: boolean;
};

export const DEFAULT_ALLOWED_COMMIT_TYPES: readonly [
  "feat",
  "fix",
  "docs",
  "chore",
];

export function parseCommitType(commitMessage: string): string | null;

export function normalizeCommitPolicy(input: unknown): CommitPolicy;

export function assertCommitMessageAllowed(
  commitMessage: string,
  policy: CommitPolicy,
): void;

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
