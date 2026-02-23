import { Data, Effect } from "effect";

import { createAuditTransition } from "../domain/audit-transition";
import { createCheckpoint, Checkpoint } from "../domain/checkpoint";
import { ActorRef, EntityReference } from "../domain/common";
import { CoreRepository } from "../repositories/core-repository";

export class CheckpointServiceError extends Data.TaggedError(
  "CheckpointServiceError",
)<{
  message: string;
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
        }),
      );
    }

    return checkpoint;
  });

export const createWorkflowCheckpoint = (
  repository: CoreRepository,
  input: CreateWorkflowCheckpointInput,
): Effect.Effect<Checkpoint, CheckpointServiceError> =>
  Effect.gen(function* () {
    const checkpoint = yield* createCheckpoint({
      id: input.checkpointId,
      name: input.name,
      snapshotEntityRefs: input.snapshotEntityRefs,
      auditCursor: input.auditCursor,
      rollbackTarget: input.rollbackTarget,
      createdAt: input.at,
      updatedAt: input.at,
    }).pipe(
      Effect.mapError(
        (error) =>
          new CheckpointServiceError({
            message: `failed to create checkpoint: ${error.message}`,
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
  });

export const keepCheckpoint = (
  repository: CoreRepository,
  checkpointId: string,
  actor: ActorRef,
  at: Date = new Date(),
): Effect.Effect<Checkpoint, CheckpointServiceError> =>
  Effect.gen(function* () {
    const checkpoint = yield* loadCheckpoint(repository, checkpointId);
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
  });

export const recoverCheckpoint = (
  repository: CoreRepository,
  checkpointId: string,
  actor: ActorRef,
  at: Date = new Date(),
): Effect.Effect<RecoveryResult, CheckpointServiceError> =>
  Effect.gen(function* () {
    const checkpoint = yield* loadCheckpoint(repository, checkpointId);
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
  });
