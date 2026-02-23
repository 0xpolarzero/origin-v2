import { Effect } from "effect";

import {
  createId,
  createTimestamps,
  DomainValidationError,
  validateNonEmpty,
} from "./common";

export type OutboundDraftStatus = "draft" | "pending_approval" | "executed";

export interface OutboundDraft {
  id: string;
  payload: string;
  sourceSignalId: string;
  status: OutboundDraftStatus;
  executionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOutboundDraftInput {
  id?: string;
  payload: string;
  sourceSignalId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export const createOutboundDraft = (
  input: CreateOutboundDraftInput,
): Effect.Effect<OutboundDraft, DomainValidationError> => {
  const payloadError = validateNonEmpty(input.payload, "payload");
  if (payloadError) {
    return Effect.fail(payloadError);
  }

  const sourceSignalIdError = validateNonEmpty(
    input.sourceSignalId,
    "sourceSignalId",
  );
  if (sourceSignalIdError) {
    return Effect.fail(sourceSignalIdError);
  }

  const timestamps = createTimestamps({
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  });

  return Effect.succeed({
    id: input.id ?? createId("outbound-draft"),
    payload: input.payload,
    sourceSignalId: input.sourceSignalId,
    status: "draft",
    ...timestamps,
  });
};
