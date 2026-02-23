import { Data } from "effect";

import { WorkflowRouteKey } from "./contracts";

const UNKNOWN_WORKFLOW_API_FAILURE_MESSAGE = "unknown workflow api failure";

export type WorkflowApiErrorCode =
  | "validation"
  | "forbidden"
  | "conflict"
  | "not_found"
  | "unknown";

export class WorkflowApiError extends Data.TaggedError("WorkflowApiError")<{
  route: WorkflowRouteKey;
  message: string;
  code: WorkflowApiErrorCode;
  statusCode: number;
  cause?: unknown;
}> {}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (isRecord(error) && typeof error.message === "string") {
    const message = error.message.trim();
    if (message.length > 0) {
      return message;
    }
  }

  return UNKNOWN_WORKFLOW_API_FAILURE_MESSAGE;
};

const toCode = (error: unknown): WorkflowApiErrorCode => {
  if (!isRecord(error) || typeof error.code !== "string") {
    return "unknown";
  }

  switch (error.code) {
    case "forbidden":
    case "conflict":
    case "not_found":
      return error.code;
    case "invalid_request":
      return "validation";
    default:
      return "unknown";
  }
};

const toStatusCode = (code: WorkflowApiErrorCode): number => {
  switch (code) {
    case "forbidden":
      return 403;
    case "conflict":
      return 409;
    case "not_found":
      return 404;
    case "validation":
    case "unknown":
      return 400;
  }
};

export const toWorkflowApiError = (
  route: WorkflowRouteKey,
  error: unknown,
): WorkflowApiError => {
  if (error instanceof WorkflowApiError) {
    return error;
  }

  const code = toCode(error);
  return new WorkflowApiError({
    route,
    message: toMessage(error),
    code,
    statusCode: toStatusCode(code),
    cause: error,
  });
};
