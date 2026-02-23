import { Data, Effect } from "effect";

import { createAuditTransition } from "../domain/audit-transition";
import { ActorRef } from "../domain/common";
import { Notification, createNotification } from "../domain/notification";
import { OutboundDraft } from "../domain/outbound-draft";
import { CoreRepository } from "../repositories/core-repository";

export class OutboundDraftServiceError extends Data.TaggedError(
  "OutboundDraftServiceError",
)<{
  message: string;
}> {}

export const requestOutboundDraftExecution = (
  repository: CoreRepository,
  draftId: string,
  actor: ActorRef,
  at: Date = new Date(),
): Effect.Effect<
  { draft: OutboundDraft; notification: Notification },
  OutboundDraftServiceError
> =>
  Effect.gen(function* () {
    const draft = yield* repository.getEntity<OutboundDraft>(
      "outbound_draft",
      draftId,
    );

    if (!draft) {
      return yield* Effect.fail(
        new OutboundDraftServiceError({
          message: `outbound draft ${draftId} was not found`,
        }),
      );
    }

    if (draft.status !== "draft") {
      return yield* Effect.fail(
        new OutboundDraftServiceError({
          message: `outbound draft ${draft.id} must be in draft before requesting approval`,
        }),
      );
    }

    const atIso = at.toISOString();
    const updatedDraft: OutboundDraft = {
      ...draft,
      status: "pending_approval",
      updatedAt: atIso,
    };

    const notification = yield* createNotification({
      type: "approval_required",
      message: `Approval required to execute outbound draft ${draft.id}`,
      relatedEntityType: "outbound_draft",
      relatedEntityId: draft.id,
      createdAt: at,
      updatedAt: at,
    }).pipe(
      Effect.mapError(
        (error) =>
          new OutboundDraftServiceError({
            message: `failed to create approval notification: ${error.message}`,
          }),
      ),
    );

    yield* repository.saveEntity(
      "outbound_draft",
      updatedDraft.id,
      updatedDraft,
    );
    yield* repository.saveEntity("notification", notification.id, notification);

    const transition = yield* createAuditTransition({
      entityType: "outbound_draft",
      entityId: updatedDraft.id,
      fromState: draft.status,
      toState: updatedDraft.status,
      actor,
      reason: "Outbound draft execution requested",
      at,
      metadata: {
        notificationId: notification.id,
      },
    }).pipe(
      Effect.mapError(
        (error) =>
          new OutboundDraftServiceError({
            message: `failed to append outbound draft transition: ${error.message}`,
          }),
      ),
    );

    yield* repository.appendAuditTransition(transition);

    return {
      draft: updatedDraft,
      notification,
    };
  });
