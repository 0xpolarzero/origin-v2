import { Either, Effect } from "effect";

import { ActorRef } from "../../core/domain/common";
import { WorkflowRouteDefinition } from "./contracts";
import { WorkflowApiError } from "./errors";

export interface WorkflowSignedInternalActorContext {
  actor: ActorRef;
  issuedAt: string;
  signature: string;
}

export interface WorkflowHttpAuthContext {
  sessionActor?: ActorRef;
  signedInternalActor?: WorkflowSignedInternalActorContext;
}

export interface WorkflowHttpRequest {
  method: string;
  path: string;
  body?: unknown;
  auth?: WorkflowHttpAuthContext;
}

export interface WorkflowHttpResponse {
  status: number;
  body: unknown;
}

export interface MakeWorkflowHttpDispatcherOptions {
  verifySignedInternalActorContext?: (
    context: WorkflowSignedInternalActorContext,
  ) => Effect.Effect<ActorRef, WorkflowApiError>;
}

const ACTOR_KINDS: ReadonlyArray<ActorRef["kind"]> = ["user", "system", "ai"];

const normalizeMethod = (method: string): string => method.trim().toUpperCase();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isActorKind = (value: unknown): value is ActorRef["kind"] =>
  ACTOR_KINDS.some((candidate) => candidate === value);

const normalizeActorId = (id: string): string => id.trim();

const normalizeActor = (actor: ActorRef): ActorRef => ({
  id: normalizeActorId(actor.id),
  kind: actor.kind,
});

const toForbiddenRouteError = (
  route: WorkflowRouteDefinition,
  message: string,
): WorkflowApiError =>
  new WorkflowApiError({
    route: route.key,
    message,
    code: "forbidden",
    statusCode: 403,
  });

const toForbiddenRouteErrorFromUnknown = (
  route: WorkflowRouteDefinition,
  fallbackMessage: string,
  error: unknown,
): WorkflowApiError => {
  if (error instanceof WorkflowApiError) {
    return toForbiddenRouteError(route, error.message);
  }

  return toForbiddenRouteError(route, fallbackMessage);
};

const parsePayloadActor = (body: unknown): ActorRef | undefined => {
  if (!isRecord(body) || !("actor" in body)) {
    return undefined;
  }

  const actor = body.actor;
  if (!isRecord(actor) || typeof actor.id !== "string" || !isActorKind(actor.kind)) {
    return undefined;
  }

  return {
    id: normalizeActorId(actor.id),
    kind: actor.kind,
  };
};

const resolveTrustedActor = (
  request: WorkflowHttpRequest,
  route: WorkflowRouteDefinition,
  options: MakeWorkflowHttpDispatcherOptions,
): Effect.Effect<ActorRef | undefined, WorkflowApiError> => {
  if (route.actorSource !== "trusted") {
    return Effect.succeed(undefined);
  }

  const sessionActor = request.auth?.sessionActor;
  if (sessionActor) {
    return Effect.succeed(normalizeActor(sessionActor));
  }

  const signedInternalActor = request.auth?.signedInternalActor;
  if (!signedInternalActor) {
    return Effect.fail(
      toForbiddenRouteError(route, "trusted actor context is required"),
    );
  }

  if (!options.verifySignedInternalActorContext) {
    return Effect.fail(
      toForbiddenRouteError(
        route,
        "trusted actor context verification is required",
      ),
    );
  }

  return options.verifySignedInternalActorContext(signedInternalActor).pipe(
    Effect.map(normalizeActor),
    Effect.mapError((error) =>
      toForbiddenRouteErrorFromUnknown(
        route,
        "trusted actor context verification failed",
        error,
      ),
    ),
  );
};

const assertPayloadActorNotSpoofed = (
  route: WorkflowRouteDefinition,
  body: unknown,
  trustedActor: ActorRef,
): Effect.Effect<void, WorkflowApiError> => {
  if (route.actorSource !== "trusted") {
    return Effect.void;
  }

  const payloadActor = parsePayloadActor(body);
  if (!payloadActor) {
    return Effect.void;
  }

  if (
    payloadActor.id === trustedActor.id &&
    payloadActor.kind === trustedActor.kind
  ) {
    return Effect.void;
  }

  return Effect.fail(
    toForbiddenRouteError(
      route,
      "payload actor does not match trusted actor context (spoof attempt)",
    ),
  );
};

const withTrustedActor = (body: unknown, trustedActor: ActorRef): unknown =>
  isRecord(body)
    ? {
        ...body,
        actor: trustedActor,
      }
    : body;

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

const toHttpStatus = (error: WorkflowApiError): number => {
  if (
    Number.isInteger(error.statusCode) &&
    error.statusCode >= 100 &&
    error.statusCode <= 599
  ) {
    return error.statusCode;
  }

  switch (error.code) {
    case "forbidden":
      return 403;
    case "conflict":
      return 409;
    case "not_found":
      return 404;
    case "validation":
    case "unknown":
    default:
      return 400;
  }
};

export const makeWorkflowHttpDispatcher =
  (
    routes: ReadonlyArray<WorkflowRouteDefinition>,
    options: MakeWorkflowHttpDispatcherOptions = {},
  ) =>
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

      const result = yield* Effect.either(
        Effect.gen(function* () {
          const trustedActor = yield* resolveTrustedActor(request, route, options);
          if (trustedActor) {
            yield* assertPayloadActorNotSpoofed(route, request.body, trustedActor);
          }

          const routedBody = trustedActor
            ? withTrustedActor(request.body, trustedActor)
            : request.body;

          return yield* route.handle(routedBody);
        }),
      );
      if (Either.isLeft(result)) {
        return {
          status: toHttpStatus(result.left),
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
