import { Data, Effect } from "effect";

import { createAuditTransition } from "../domain/audit-transition";
import { ActorRef } from "../domain/common";
import { Event } from "../domain/event";
import { OutboundDraft } from "../domain/outbound-draft";
import { CoreRepository } from "../repositories/core-repository";

export class ApprovalServiceError extends Data.TaggedError(
  "ApprovalServiceError",
)<{
  message: string;
}> {}

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

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

    if (input.actionType === "event_sync") {
      if (input.entityType !== "event") {
        return yield* Effect.fail(
          new ApprovalServiceError({
            message: "event_sync action must target entityType=event",
          }),
        );
      }

      const event = yield* repository.getEntity<Event>("event", input.entityId);

      if (!event) {
        return yield* Effect.fail(
          new ApprovalServiceError({
            message: `event ${input.entityId} was not found`,
          }),
        );
      }

      if (event.syncState !== "pending_approval") {
        return yield* Effect.fail(
          new ApprovalServiceError({
            message: `event ${event.id} must be in pending_approval before sync approval`,
          }),
        );
      }

      const execution = yield* outboundActionPort.execute({
        actionType: input.actionType,
        entityType: input.entityType,
        entityId: input.entityId,
      });

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

      return {
        approved: true,
        executed: true,
        executionId: execution.executionId,
      };
    }

    if (input.actionType === "outbound_draft") {
      if (input.entityType !== "outbound_draft") {
        return yield* Effect.fail(
          new ApprovalServiceError({
            message:
              "outbound_draft action must target entityType=outbound_draft",
          }),
        );
      }

      const draft = yield* repository.getEntity<OutboundDraft>(
        "outbound_draft",
        input.entityId,
      );

      if (!draft) {
        return yield* Effect.fail(
          new ApprovalServiceError({
            message: `outbound draft ${input.entityId} was not found`,
          }),
        );
      }

      if (draft.status !== "pending_approval") {
        return yield* Effect.fail(
          new ApprovalServiceError({
            message: `outbound draft ${draft.id} must be in pending_approval before execution approval`,
          }),
        );
      }

      const atIso = at.toISOString();
      const stagedDraft: OutboundDraft = {
        ...draft,
        status: "executing",
        updatedAt: atIso,
      };

      yield* repository
        .saveEntity("outbound_draft", stagedDraft.id, stagedDraft)
        .pipe(
          Effect.mapError(
            (error) =>
              new ApprovalServiceError({
                message: `failed to persist outbound draft before execution: ${toErrorMessage(error)}`,
              }),
          ),
        );

      const stagedTransition = yield* createAuditTransition({
        entityType: "outbound_draft",
        entityId: stagedDraft.id,
        fromState: draft.status,
        toState: stagedDraft.status,
        actor: input.actor,
        reason: "Outbound draft approval accepted and staged for execution",
        at,
      }).pipe(
        Effect.mapError(
          (error) =>
            new ApprovalServiceError({
              message: `failed to append approval transition: ${error.message}`,
            }),
        ),
      );

      yield* repository.appendAuditTransition(stagedTransition).pipe(
        Effect.mapError(
          (error) =>
            new ApprovalServiceError({
              message: `failed to append approval transition: ${toErrorMessage(error)}`,
            }),
        ),
      );

      let rollbackFromState: OutboundDraft["status"] = stagedDraft.status;
      const rollbackDraftToPendingApproval = (
        reason: string,
      ): Effect.Effect<void, ApprovalServiceError> =>
        Effect.gen(function* () {
          const restoredDraft: OutboundDraft = {
            ...draft,
            status: "pending_approval",
            updatedAt: atIso,
          };

          yield* repository
            .saveEntity("outbound_draft", restoredDraft.id, restoredDraft)
            .pipe(
              Effect.mapError(
                (rollbackError) =>
                  new ApprovalServiceError({
                    message: `failed to rollback outbound draft after execution failure: ${toErrorMessage(rollbackError)}`,
                  }),
              ),
            );

          const rollbackTransition = yield* createAuditTransition({
            entityType: "outbound_draft",
            entityId: restoredDraft.id,
            fromState: rollbackFromState,
            toState: restoredDraft.status,
            actor: input.actor,
            reason,
            at,
          }).pipe(
            Effect.mapError(
              (rollbackError) =>
                new ApprovalServiceError({
                  message: `failed to create rollback approval transition: ${rollbackError.message}`,
                }),
            ),
          );

          yield* repository.appendAuditTransition(rollbackTransition).pipe(
            Effect.mapError(
              (rollbackError) =>
                new ApprovalServiceError({
                  message: `failed to append rollback approval transition: ${toErrorMessage(rollbackError)}`,
                }),
            ),
          );
        });

      return yield* Effect.gen(function* () {
        const execution = yield* outboundActionPort.execute({
          actionType: input.actionType,
          entityType: input.entityType,
          entityId: input.entityId,
        });

        const executionId = execution.executionId.trim();
        if (executionId.length === 0) {
          return yield* Effect.fail(
            new ApprovalServiceError({
              message: "outbound action execution must return non-empty executionId",
            }),
          );
        }

        const updatedDraft: OutboundDraft = {
          ...stagedDraft,
          status: "executed",
          executionId,
          updatedAt: atIso,
        };
        rollbackFromState = updatedDraft.status;

        yield* repository
          .saveEntity("outbound_draft", updatedDraft.id, updatedDraft)
          .pipe(
            Effect.mapError(
              (error) =>
                new ApprovalServiceError({
                  message: `failed to persist outbound draft execution: ${toErrorMessage(error)}`,
                }),
            ),
          );

        const transition = yield* createAuditTransition({
          entityType: "outbound_draft",
          entityId: updatedDraft.id,
          fromState: stagedDraft.status,
          toState: updatedDraft.status,
          actor: input.actor,
          reason: "Outbound draft approval executed",
          at,
          metadata: {
            executionId,
          },
        }).pipe(
          Effect.mapError(
            (error) =>
              new ApprovalServiceError({
                message: `failed to append approval transition: ${error.message}`,
              }),
          ),
        );

        yield* repository.appendAuditTransition(transition).pipe(
          Effect.mapError(
            (error) =>
              new ApprovalServiceError({
                message: `failed to append approval transition: ${toErrorMessage(error)}`,
              }),
          ),
        );

        return {
          approved: true,
          executed: true,
          executionId,
        };
      }).pipe(
        Effect.catchAll((error) =>
          rollbackDraftToPendingApproval("Outbound draft execution failed").pipe(
            Effect.catchAll((rollbackError) =>
              Effect.fail(
                new ApprovalServiceError({
                  message: `${toErrorMessage(error)}; ${rollbackError.message}`,
                }),
              ),
            ),
            Effect.flatMap(() => Effect.fail(error)),
          ),
        ),
      );
    }

    return yield* Effect.fail(
      new ApprovalServiceError({
        message: `unsupported outbound action type: ${input.actionType}`,
      }),
    );
  });
