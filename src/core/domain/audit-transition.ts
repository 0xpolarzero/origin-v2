import { Effect } from "effect";

import {
  ActorRef,
  createId,
  DomainValidationError,
  EntityType,
  validateNonEmpty,
} from "./common";

export interface AuditTransition {
  id: string;
  entityType: EntityType | string;
  entityId: string;
  fromState: string;
  toState: string;
  actor: ActorRef;
  reason: string;
  at: string;
  metadata?: Record<string, string>;
}

export interface CreateAuditTransitionInput {
  id?: string;
  entityType: EntityType | string;
  entityId: string;
  fromState: string;
  toState: string;
  actor: ActorRef;
  reason: string;
  at?: Date;
  metadata?: Record<string, string>;
}

export const createAuditTransition = (
  input: CreateAuditTransitionInput,
): Effect.Effect<AuditTransition, DomainValidationError> => {
  const entityTypeError = validateNonEmpty(input.entityType, "entityType");
  if (entityTypeError) {
    return Effect.fail(entityTypeError);
  }

  const entityIdError = validateNonEmpty(input.entityId, "entityId");
  if (entityIdError) {
    return Effect.fail(entityIdError);
  }

  const reasonError = validateNonEmpty(input.reason, "reason");
  if (reasonError) {
    return Effect.fail(reasonError);
  }

  return Effect.succeed({
    id: input.id ?? createId("audit"),
    entityType: input.entityType,
    entityId: input.entityId,
    fromState: input.fromState,
    toState: input.toState,
    actor: input.actor,
    reason: input.reason,
    at: (input.at ?? new Date()).toISOString(),
    metadata: input.metadata,
  });
};
