export type CommandMap = Record<string, string>;

export type GateConfig = {
  buildCmds: CommandMap;
  testCmds: CommandMap;
  preLandChecks: string[];
  postLandChecks: string[];
  agentSafetyPolicy?: {
    riskyModeEnabled: boolean;
    approvalRequiredPhases: string[];
  };
};

export function assertRequiredGateScripts(scripts: CommandMap): void;

export function resolveFocusTestCommands(
  runner: string,
  scripts: CommandMap,
): CommandMap;

export function buildGateCommandConfig(
  runner: string,
  scripts: CommandMap,
): GateConfig;
