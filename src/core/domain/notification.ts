import { Effect } from "effect";

import {
  createId,
  createTimestamps,
  DomainValidationError,
  validateNonEmpty,
} from "./common";

export type NotificationStatus = "pending" | "sent" | "dismissed";

export interface Notification {
  id: string;
  type: string;
  message: string;
  status: NotificationStatus;
  relatedEntityType?: string;
  relatedEntityId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNotificationInput {
  id?: string;
  type: string;
  message: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export const createNotification = (
  input: CreateNotificationInput,
): Effect.Effect<Notification, DomainValidationError> => {
  const typeError = validateNonEmpty(input.type, "type");
  if (typeError) {
    return Effect.fail(typeError);
  }

  const messageError = validateNonEmpty(input.message, "message");
  if (messageError) {
    return Effect.fail(messageError);
  }

  const timestamps = createTimestamps({
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  });

  return Effect.succeed({
    id: input.id ?? createId("notification"),
    type: input.type,
    message: input.message,
    status: "pending",
    relatedEntityType: input.relatedEntityType,
    relatedEntityId: input.relatedEntityId,
    ...timestamps,
  });
};
