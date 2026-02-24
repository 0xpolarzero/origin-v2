import { Data, Effect } from "effect";

import { CoreRepository } from "../repositories/core-repository";

export class ActivityServiceError extends Data.TaggedError("ActivityServiceError")<{
  message: string;
  code?: "invalid_request";
}> {}

export interface ListActivityFeedInput {
  entityType?: string;
  entityId?: string;
  actorKind?: "user" | "system" | "ai";
  aiOnly?: boolean;
  limit?: number;
  beforeAt?: Date;
}

export interface ActivityFeedItem {
  id: string;
  entityType: string;
  entityId: string;
  fromState: string;
  toState: string;
  actor: { id: string; kind: "user" | "system" | "ai" };
  reason: string;
  at: string;
  metadata?: Record<string, string>;
}

const ACTOR_KINDS: ReadonlyArray<ActivityFeedItem["actor"]["kind"]> = [
  "user",
  "system",
  "ai",
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseMetadata = (value: unknown): Record<string, string> | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const entries = Object.entries(value);
  const metadata: Record<string, string> = {};
  for (const [key, entryValue] of entries) {
    if (typeof entryValue !== "string") {
      return undefined;
    }
    metadata[key] = entryValue;
  }

  return metadata;
};

const toActivityFeedItem = (value: unknown): ActivityFeedItem | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const actor = value.actor;
  if (!isRecord(actor)) {
    return undefined;
  }

  const actorId = actor.id;
  const actorKind = actor.kind;
  if (
    typeof actorId !== "string" ||
    typeof actorKind !== "string" ||
    !ACTOR_KINDS.includes(actorKind as ActivityFeedItem["actor"]["kind"])
  ) {
    return undefined;
  }

  const id = value.id;
  const entityType = value.entityType;
  const entityId = value.entityId;
  const fromState = value.fromState;
  const toState = value.toState;
  const reason = value.reason;
  const at = value.at;

  if (
    typeof id !== "string" ||
    typeof entityType !== "string" ||
    typeof entityId !== "string" ||
    typeof fromState !== "string" ||
    typeof toState !== "string" ||
    typeof reason !== "string" ||
    typeof at !== "string"
  ) {
    return undefined;
  }

  return {
    id,
    entityType,
    entityId,
    fromState,
    toState,
    actor: {
      id: actorId,
      kind: actorKind as ActivityFeedItem["actor"]["kind"],
    },
    reason,
    at,
    metadata: parseMetadata(value.metadata),
  };
};

export const listActivityFeed = (
  repository: CoreRepository,
  input: ListActivityFeedInput = {},
): Effect.Effect<ReadonlyArray<ActivityFeedItem>, ActivityServiceError> =>
  Effect.gen(function* () {
    if (
      input.limit !== undefined &&
      (!Number.isInteger(input.limit) || input.limit <= 0)
    ) {
      return yield* Effect.fail(
        new ActivityServiceError({
          message: "limit must be a positive integer",
          code: "invalid_request",
        }),
      );
    }

    if (repository.listActivityFeed) {
      const queriedRows = yield* repository.listActivityFeed({
        entityType: input.entityType,
        entityId: input.entityId,
        actorKind: input.actorKind,
        aiOnly: input.aiOnly,
        limit: input.limit,
        beforeAt: input.beforeAt,
      });

      return queriedRows
        .map((row) => toActivityFeedItem(row))
        .filter((row): row is ActivityFeedItem => row !== undefined);
    }

    const beforeAtIso = input.beforeAt?.toISOString();
    const transitions = yield* repository.listAuditTrail({
      entityType: input.entityType,
      entityId: input.entityId,
    });

    const activity = transitions
      .filter(
        (transition) =>
          input.actorKind === undefined ||
          transition.actor.kind === input.actorKind,
      )
      .filter(
        (transition) => input.aiOnly !== true || transition.actor.kind === "ai",
      )
      .filter(
        (transition) => beforeAtIso === undefined || transition.at < beforeAtIso,
      )
      .sort(
        (left, right) =>
          right.at.localeCompare(left.at) || right.id.localeCompare(left.id),
      )
      .map(
        (transition): ActivityFeedItem => ({
          id: transition.id,
          entityType: transition.entityType,
          entityId: transition.entityId,
          fromState: transition.fromState,
          toState: transition.toState,
          actor: transition.actor,
          reason: transition.reason,
          at: transition.at,
          metadata: transition.metadata,
        }),
      );

    if (input.limit === undefined) {
      return activity;
    }

    return activity.slice(0, input.limit);
  });
