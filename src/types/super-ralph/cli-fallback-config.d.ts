export type CommandMap = Record<string, string>;

export type FallbackConfig = {
  specsPath: string;
  referenceFiles: string[];
  buildCmds: CommandMap;
  testCmds: CommandMap;
  preLandChecks: string[];
  postLandChecks: string[];
  agentSafetyPolicy: {
    riskyModeEnabled: boolean;
    approvalRequiredPhases: string[];
  };
};

export function toRepoRelativePath(repoRoot: string, pathValue: string): string;

export function buildFallbackConfig(
  repoRoot: string,
  promptSpecPath: string,
  packageScripts: CommandMap,
): FallbackConfig;
