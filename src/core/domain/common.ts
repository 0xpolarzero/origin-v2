import { Data } from "effect";

export type EntityType =
  | "entry"
  | "task"
  | "event"
  | "project"
  | "note"
  | "signal"
  | "job"
  | "notification"
  | "view"
  | "memory"
  | "checkpoint"
  | "outbound_draft";

export const ENTITY_TYPES: ReadonlyArray<EntityType> = [
  "entry",
  "task",
  "event",
  "project",
  "note",
  "signal",
  "job",
  "notification",
  "view",
  "memory",
  "checkpoint",
  "outbound_draft",
];

export type ActorKind = "user" | "system" | "ai";

export interface ActorRef {
  id: string;
  kind: ActorKind;
}

export interface EntityReference {
  entityType: EntityType;
  entityId: string;
}

export class DomainValidationError extends Data.TaggedError(
  "DomainValidationError",
)<{
  message: string;
}> {}

export const createTimestamps = (
  input: {
    createdAt?: Date;
    updatedAt?: Date;
  } = {},
): {
  createdAt: string;
  updatedAt: string;
} => {
  const createdAt = input.createdAt ?? new Date();
  const updatedAt = input.updatedAt ?? createdAt;
  return {
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
};

export const validateNonEmpty = (
  value: string,
  field: string,
): DomainValidationError | undefined => {
  if (value.trim() === "") {
    return new DomainValidationError({ message: `${field} is required` });
  }

  return undefined;
};

export const createId = (prefix: string): string =>
  `${prefix}-${crypto.randomUUID()}`;
