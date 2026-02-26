import { Either, Effect } from "effect";

import { WorkflowRouteDefinition } from "./contracts";
import { WorkflowApiError } from "./errors";

export interface WorkflowHttpRequest {
  method: string;
  path: string;
  body?: unknown;
}

export interface WorkflowHttpResponse {
  status: number;
  body: unknown;
}

const normalizeMethod = (method: string): string => method.trim().toUpperCase();

const toClientErrorBody = (
  error: WorkflowApiError,
): {
  error: string;
  route: string;
  message: string;
} => ({
  error: "workflow request failed",
  route: error.route,
  message: error.message,
});

export const makeWorkflowHttpDispatcher =
  (routes: ReadonlyArray<WorkflowRouteDefinition>) =>
  (request: WorkflowHttpRequest): Effect.Effect<WorkflowHttpResponse, never> =>
    Effect.gen(function* () {
      const pathMatches = routes.filter((route) => route.path === request.path);
      if (pathMatches.length === 0) {
        return {
          status: 404,
          body: {
            error: "workflow route not found",
            path: request.path,
          },
        };
      }

      const method = normalizeMethod(request.method);
      const route = pathMatches.find(
        (candidate) => candidate.method === method,
      );
      if (!route) {
        return {
          status: 405,
          body: {
            error: "method not allowed",
            method,
            path: request.path,
          },
        };
      }

      const result = yield* Effect.either(route.handle(request.body));
      if (Either.isLeft(result)) {
        return {
          status: 400,
          body: toClientErrorBody(result.left),
        };
      }

      return {
        status: 200,
        body: result.right,
      };
    }).pipe(
      Effect.catchAllDefect((defect) =>
        Effect.succeed({
          status: 500,
          body: {
            error: "workflow route dispatch failed",
            message: "internal server error",
          },
        }),
      ),
    );
