export type CommandMap = Record<string, string>;

export type FallbackFocus = {
  id: string;
  name: string;
};

export type CommitPolicyAllowedType = "feat" | "fix" | "docs" | "chore";

export type FallbackConfig = {
  projectName: string;
  projectId: string;
  focuses: FallbackFocus[];
  specsPath: string;
  referenceFiles: string[];
  buildCmds: CommandMap;
  testCmds: CommandMap;
  commitPolicy: {
    allowedTypes: CommitPolicyAllowedType[];
    requireAtomicChecks: true;
  };
  preLandChecks: string[];
  postLandChecks: string[];
  codeStyle: string;
  reviewChecklist: string[];
  maxConcurrency: number;
  agentSafetyPolicy: {
    riskyModeEnabled: boolean;
    approvalRequiredPhases: string[];
  };
  [key: string]: unknown;
};

export function toRepoRelativePath(repoRoot: string, pathValue: string): string;

export function buildFallbackConfig(
  repoRoot: string,
  promptSpecPath: string,
  packageScripts: CommandMap,
): FallbackConfig;
