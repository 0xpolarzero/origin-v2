declare module "smithers-orchestrator" {
  import type { ComponentType, ReactNode } from "react";

  export type WorkflowRunResult = {
    status: string;
    error?: unknown;
    [key: string]: unknown;
  };

  export type WorkflowComponentProps = {
    name: string;
    children?: ReactNode;
  };

  export type TaskComponentProps = {
    id: string;
    output: unknown;
    children?: ReactNode;
  };

  export type WorktreeComponentProps = {
    id: string;
    path: string;
    branch?: string;
    children?: ReactNode;
  };

  export const Worktree: ComponentType<WorktreeComponentProps>;

  export function createSmithers(
    outputsShape: Record<string, unknown>,
    options?: { dbPath?: string },
  ): {
    Workflow: ComponentType<WorkflowComponentProps>;
    Task: ComponentType<TaskComponentProps>;
    Worktree: ComponentType<WorktreeComponentProps>;
    outputs: Record<string, unknown>;
    smithers: <T>(builder: () => T) => T;
  };

  export function runWorkflow(
    workflow: unknown,
    options: { runId: string; input: unknown; rootDir: string },
  ): Promise<WorkflowRunResult>;
}
