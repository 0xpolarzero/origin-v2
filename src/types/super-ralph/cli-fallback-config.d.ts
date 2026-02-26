export type CommandMap = Record<string, string>;

export type FallbackConfig = {
  buildCmds: CommandMap;
  testCmds: CommandMap;
  preLandChecks: string[];
  postLandChecks: string[];
  agentSafetyPolicy: {
    riskyModeEnabled: boolean;
    approvalRequiredPhases: string[];
  };
};

export function buildFallbackConfig(
  repoRoot: string,
  ticketPath: string,
  packageScripts: CommandMap,
): FallbackConfig;
