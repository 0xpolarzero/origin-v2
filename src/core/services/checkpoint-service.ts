import { Data, Effect } from "effect";

import { createAuditTransition } from "../domain/audit-transition";
import {
  Checkpoint,
  CheckpointEntitySnapshot,
  createCheckpoint,
} from "../domain/checkpoint";
import { ActorRef, EntityReference } from "../domain/common";
import { CoreRepository } from "../repositories/core-repository";

export class CheckpointServiceError extends Data.TaggedError(
  "CheckpointServiceError",
)<{
  message: string;
  code?: "not_found" | "conflict" | "invalid_request";
}> {}

export interface CreateWorkflowCheckpointInput {
  checkpointId?: string;
  name: string;
  snapshotEntityRefs: ReadonlyArray<EntityReference>;
  auditCursor: number;
  rollbackTarget: string;
  actor: ActorRef;
  at?: Date;
}

export interface RecoveryResult {
  checkpoint: Checkpoint;
  recoveredEntityRefs: ReadonlyArray<EntityReference>;
  rollbackTarget: string;
}

const loadCheckpoint = (
  repository: CoreRepository,
  checkpointId: string,
): Effect.Effect<Checkpoint, CheckpointServiceError> =>
  Effect.gen(function* () {
    const checkpoint = yield* repository.getEntity<Checkpoint>(
      "checkpoint",
      checkpointId,
    );

    if (!checkpoint) {
      return yield* Effect.fail(
        new CheckpointServiceError({
          message: `checkpoint ${checkpointId} was not found`,
          code: "not_found",
        }),
      );
    }

    return checkpoint;
  });

const ensureCanKeep = (
  checkpoint: Checkpoint,
): Effect.Effect<void, CheckpointServiceError> => {
  if (checkpoint.status === "created") {
    return Effect.void;
  }

  return Effect.fail(
    new CheckpointServiceError({
      message: `checkpoint ${checkpoint.id} cannot transition ${checkpoint.status} -> kept`,
      code: "conflict",
    }),
  );
};

const ensureCanRecover = (
  checkpoint: Checkpoint,
): Effect.Effect<void, CheckpointServiceError> => {
  if (checkpoint.status === "created" || checkpoint.status === "kept") {
    return Effect.void;
  }

  return Effect.fail(
    new CheckpointServiceError({
      message: `checkpoint ${checkpoint.id} cannot transition ${checkpoint.status} -> recovered`,
      code: "conflict",
    }),
  );
};

export const createWorkflowCheckpoint = (
  repository: CoreRepository,
  input: CreateWorkflowCheckpointInput,
): Effect.Effect<Checkpoint, CheckpointServiceError> =>
  repository.withTransaction(
    Effect.gen(function* () {
      const snapshotEntities: Array<CheckpointEntitySnapshot> = [];
      for (const snapshotRef of input.snapshotEntityRefs) {
        const entity = yield* repository.getEntity(
          snapshotRef.entityType,
          snapshotRef.entityId,
        );
        snapshotEntities.push({
          entityType: snapshotRef.entityType,
          entityId: snapshotRef.entityId,
          existed: entity !== undefined,
          state: entity,
        });
      }

      const checkpoint = yield* createCheckpoint({
        id: input.checkpointId,
        name: input.name,
        snapshotEntityRefs: input.snapshotEntityRefs,
        snapshotEntities,
        auditCursor: input.auditCursor,
        rollbackTarget: input.rollbackTarget,
        createdAt: input.at,
        updatedAt: input.at,
      }).pipe(
        Effect.mapError(
          (error) =>
            new CheckpointServiceError({
              message: `failed to create checkpoint: ${error.message}`,
              code: "invalid_request",
            }),
        ),
      );

      yield* repository.saveEntity("checkpoint", checkpoint.id, checkpoint);

      const transition = yield* createAuditTransition({
        entityType: "checkpoint",
        entityId: checkpoint.id,
        fromState: "none",
        toState: checkpoint.status,
        actor: input.actor,
        reason: "Checkpoint created",
        at: input.at,
        metadata: {
          rollbackTarget: checkpoint.rollbackTarget,
        },
      }).pipe(
        Effect.mapError(
          (error) =>
            new CheckpointServiceError({
              message: `failed to append checkpoint create transition: ${error.message}`,
            }),
        ),
      );

      yield* repository.appendAuditTransition(transition);

      return checkpoint;
    }),
  );

export const keepCheckpoint = (
  repository: CoreRepository,
  checkpointId: string,
  actor: ActorRef,
  at: Date = new Date(),
): Effect.Effect<Checkpoint, CheckpointServiceError> =>
  repository.withTransaction(
    Effect.gen(function* () {
      const checkpoint = yield* loadCheckpoint(repository, checkpointId);
      yield* ensureCanKeep(checkpoint);

      const updated: Checkpoint = {
        ...checkpoint,
        status: "kept",
        updatedAt: at.toISOString(),
      };

      yield* repository.saveEntity("checkpoint", updated.id, updated);

      const transition = yield* createAuditTransition({
        entityType: "checkpoint",
        entityId: updated.id,
        fromState: checkpoint.status,
        toState: updated.status,
        actor,
        reason: "Checkpoint kept",
        at,
      }).pipe(
        Effect.mapError(
          (error) =>
            new CheckpointServiceError({
              message: `failed to append checkpoint keep transition: ${error.message}`,
            }),
        ),
      );

      yield* repository.appendAuditTransition(transition);

      return updated;
    }),
  );

export const recoverCheckpoint = (
  repository: CoreRepository,
  checkpointId: string,
  actor: ActorRef,
  at: Date = new Date(),
): Effect.Effect<RecoveryResult, CheckpointServiceError> =>
  repository.withTransaction(
    Effect.gen(function* () {
      const checkpoint = yield* loadCheckpoint(repository, checkpointId);
      yield* ensureCanRecover(checkpoint);

      for (const snapshot of checkpoint.snapshotEntities) {
        if (snapshot.existed) {
          if (snapshot.state === undefined) {
            return yield* Effect.fail(
              new CheckpointServiceError({
                message: `checkpoint ${checkpoint.id} has an invalid snapshot for ${snapshot.entityType}:${snapshot.entityId}`,
                code: "invalid_request",
              }),
            );
          }
          yield* repository.saveEntity(
            snapshot.entityType,
            snapshot.entityId,
            snapshot.state,
          );
          continue;
        }

        yield* repository.deleteEntity(snapshot.entityType, snapshot.entityId);
      }

      const updated: Checkpoint = {
        ...checkpoint,
        status: "recovered",
        recoveredAt: at.toISOString(),
        updatedAt: at.toISOString(),
      };

      yield* repository.saveEntity("checkpoint", updated.id, updated);

      const transition = yield* createAuditTransition({
        entityType: "checkpoint",
        entityId: updated.id,
        fromState: checkpoint.status,
        toState: updated.status,
        actor,
        reason: "Checkpoint recovered",
        at,
        metadata: {
          rollbackTarget: checkpoint.rollbackTarget,
        },
      }).pipe(
        Effect.mapError(
          (error) =>
            new CheckpointServiceError({
              message: `failed to append checkpoint recovery transition: ${error.message}`,
            }),
        ),
      );

      yield* repository.appendAuditTransition(transition);

      return {
        checkpoint: updated,
        recoveredEntityRefs: [...checkpoint.snapshotEntityRefs],
        rollbackTarget: checkpoint.rollbackTarget,
      };
    }),
  );
