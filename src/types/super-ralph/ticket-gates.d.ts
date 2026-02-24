export type CommandMap = Record<string, string>;

export type TestSuite = {
  name: string;
  command: string;
  description: string;
};

export type TicketGateSelection = {
  verifyCommands: string[];
  validationCommands: string[];
  testSuites: TestSuite[];
};

export function resolveCategoryTestCommand(
  ticketCategory: string,
  testCmds: CommandMap,
): string;

export function resolveVerifyCommands(input: {
  ticketCategory: string;
  buildCmds: CommandMap;
  testCmds: CommandMap;
  preLandChecks: string[];
}): string[];

export function resolveTicketGateSelection(input: {
  ticketCategory: string;
  buildCmds: CommandMap;
  testCmds: CommandMap;
  preLandChecks: string[];
}): TicketGateSelection;
