import { Data, Effect } from "effect";

import { createAuditTransition } from "../domain/audit-transition";
import { ActorRef } from "../domain/common";
import { Event } from "../domain/event";
import { CoreRepository } from "../repositories/core-repository";

export class ApprovalServiceError extends Data.TaggedError(
  "ApprovalServiceError",
)<{
  message: string;
}> {}

export interface OutboundAction {
  actionType: "event_sync" | "outbound_draft";
  entityType: string;
  entityId: string;
}

export interface OutboundActionPort {
  execute: (action: OutboundAction) => Effect.Effect<{ executionId: string }>;
}

export interface ApproveOutboundActionInput {
  actionType: "event_sync" | "outbound_draft";
  entityType: string;
  entityId: string;
  approved: boolean;
  actor: ActorRef;
  at?: Date;
}

export interface ApprovalResult {
  approved: true;
  executed: true;
  executionId: string;
}

export const approveOutboundAction = (
  repository: CoreRepository,
  outboundActionPort: OutboundActionPort,
  input: ApproveOutboundActionInput,
): Effect.Effect<ApprovalResult, ApprovalServiceError> =>
  Effect.gen(function* () {
    if (!input.approved) {
      return yield* Effect.fail(
        new ApprovalServiceError({
          message: "outbound actions require explicit approval",
        }),
      );
    }

    const at = input.at ?? new Date();

    const execution = yield* outboundActionPort.execute({
      actionType: input.actionType,
      entityType: input.entityType,
      entityId: input.entityId,
    });

    if (input.entityType === "event" && input.actionType === "event_sync") {
      const event = yield* repository.getEntity<Event>("event", input.entityId);

      if (!event) {
        return yield* Effect.fail(
          new ApprovalServiceError({
            message: `event ${input.entityId} was not found`,
          }),
        );
      }

      const updatedEvent: Event = {
        ...event,
        syncState: "synced",
        updatedAt: at.toISOString(),
      };

      yield* repository.saveEntity("event", updatedEvent.id, updatedEvent);

      const transition = yield* createAuditTransition({
        entityType: "event",
        entityId: updatedEvent.id,
        fromState: event.syncState,
        toState: updatedEvent.syncState,
        actor: input.actor,
        reason: "Event sync approved and executed",
        at,
      }).pipe(
        Effect.mapError(
          (error) =>
            new ApprovalServiceError({
              message: `failed to append approval transition: ${error.message}`,
            }),
        ),
      );

      yield* repository.appendAuditTransition(transition);
    }

    return {
      approved: true,
      executed: true,
      executionId: execution.executionId,
    };
  });
