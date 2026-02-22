import { DEFAULT_INPUT } from "./config";

export type WorkflowInput = {
  goal: string;
  scopeHint?: string;
  allowUi: boolean;
};

export function readWorkflowInput(raw: Record<string, unknown>): WorkflowInput {
  const goal =
    typeof raw.goal === "string" && raw.goal.trim().length > 0
      ? raw.goal
      : DEFAULT_INPUT.goal;

  const scopeHint =
    typeof raw.scopeHint === "string" && raw.scopeHint.trim().length > 0
      ? raw.scopeHint
      : DEFAULT_INPUT.scopeHint;

  const allowUi = typeof raw.allowUi === "boolean" ? raw.allowUi : DEFAULT_INPUT.allowUi;

  return { goal, scopeHint, allowUi };
}
