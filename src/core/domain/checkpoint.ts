import { Effect } from "effect";

import {
  createId,
  createTimestamps,
  DomainValidationError,
  EntityReference,
  validateNonEmpty,
} from "./common";

export type CheckpointStatus = "created" | "kept" | "recovered";

export interface Checkpoint {
  id: string;
  name: string;
  snapshotEntityRefs: ReadonlyArray<EntityReference>;
  auditCursor: number;
  rollbackTarget: string;
  status: CheckpointStatus;
  createdAt: string;
  updatedAt: string;
  recoveredAt?: string;
}

export interface CreateCheckpointInput {
  id?: string;
  name: string;
  snapshotEntityRefs: ReadonlyArray<EntityReference>;
  auditCursor: number;
  rollbackTarget: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export const createCheckpoint = (
  input: CreateCheckpointInput,
): Effect.Effect<Checkpoint, DomainValidationError> => {
  const nameError = validateNonEmpty(input.name, "name");
  if (nameError) {
    return Effect.fail(nameError);
  }

  const rollbackTargetError = validateNonEmpty(
    input.rollbackTarget,
    "rollbackTarget",
  );
  if (rollbackTargetError) {
    return Effect.fail(rollbackTargetError);
  }

  const timestamps = createTimestamps({
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  });

  return Effect.succeed({
    id: input.id ?? createId("checkpoint"),
    name: input.name,
    snapshotEntityRefs: [...input.snapshotEntityRefs],
    auditCursor: input.auditCursor,
    rollbackTarget: input.rollbackTarget,
    status: "created",
    ...timestamps,
  });
};
