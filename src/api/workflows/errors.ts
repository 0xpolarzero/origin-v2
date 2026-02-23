import { Data } from "effect";

import { WorkflowRouteKey } from "./contracts";

const UNKNOWN_WORKFLOW_API_FAILURE_MESSAGE = "unknown workflow api failure";

export class WorkflowApiError extends Data.TaggedError("WorkflowApiError")<{
  route: WorkflowRouteKey;
  message: string;
  cause?: unknown;
}> {}

export const toWorkflowApiError = (
  route: WorkflowRouteKey,
  error: unknown,
): WorkflowApiError => {
  if (error instanceof WorkflowApiError) {
    return error;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return new WorkflowApiError({
      route,
      message: error.message,
      cause: error,
    });
  }

  return new WorkflowApiError({
    route,
    message: UNKNOWN_WORKFLOW_API_FAILURE_MESSAGE,
    cause: error,
  });
};
