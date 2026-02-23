import { Data, Effect } from "effect";

import { createAuditTransition } from "../domain/audit-transition";
import { ActorRef } from "../domain/common";
import { createEvent } from "../domain/event";
import { createNote } from "../domain/note";
import { createOutboundDraft } from "../domain/outbound-draft";
import { createProject } from "../domain/project";
import { createSignal, Signal } from "../domain/signal";
import { createTask } from "../domain/task";
import { CoreRepository } from "../repositories/core-repository";

export class SignalServiceError extends Data.TaggedError("SignalServiceError")<{
  message: string;
}> {}

export type SignalTriageDecision = string;

export type SignalConversionTarget =
  | "task"
  | "event"
  | "note"
  | "project"
  | "outbound_draft";

export interface ConvertedEntityRef {
  entityType: SignalConversionTarget;
  entityId: string;
}

export interface ConvertSignalInput {
  signalId: string;
  targetType: SignalConversionTarget;
  targetId?: string;
  actor: ActorRef;
  at?: Date;
}

export interface IngestSignalInput {
  signalId?: string;
  source: string;
  payload: string;
  actor: ActorRef;
  at?: Date;
}

const loadSignal = (
  repository: CoreRepository,
  signalId: string,
): Effect.Effect<Signal, SignalServiceError> =>
  Effect.gen(function* () {
    const signal = yield* repository.getEntity<Signal>("signal", signalId);

    if (!signal) {
      return yield* Effect.fail(
        new SignalServiceError({ message: `signal ${signalId} was not found` }),
      );
    }

    return signal;
  });

export const ingestSignal = (
  repository: CoreRepository,
  input: IngestSignalInput,
): Effect.Effect<Signal, SignalServiceError> =>
  Effect.gen(function* () {
    const signal = yield* createSignal({
      id: input.signalId,
      source: input.source,
      payload: input.payload,
      createdAt: input.at,
      updatedAt: input.at,
    }).pipe(
      Effect.mapError(
        (error) =>
          new SignalServiceError({
            message: `failed to ingest signal: ${error.message}`,
          }),
      ),
    );

    yield* repository.saveEntity("signal", signal.id, signal);

    const transition = yield* createAuditTransition({
      entityType: "signal",
      entityId: signal.id,
      fromState: "none",
      toState: signal.triageState,
      actor: input.actor,
      reason: "Signal ingested",
      at: input.at,
    }).pipe(
      Effect.mapError(
        (error) =>
          new SignalServiceError({
            message: `failed to append signal ingest transition: ${error.message}`,
          }),
      ),
    );

    yield* repository.appendAuditTransition(transition);

    return signal;
  });

export const triageSignal = (
  repository: CoreRepository,
  signalId: string,
  decision: SignalTriageDecision,
  actor: ActorRef,
  at: Date = new Date(),
): Effect.Effect<Signal, SignalServiceError> =>
  Effect.gen(function* () {
    const signal = yield* loadSignal(repository, signalId);
    const atIso = at.toISOString();

    const updated: Signal = {
      ...signal,
      triageState: "triaged",
      triageDecision: decision,
      updatedAt: atIso,
    };

    yield* repository.saveEntity("signal", updated.id, updated);

    const transition = yield* createAuditTransition({
      entityType: "signal",
      entityId: updated.id,
      fromState: signal.triageState,
      toState: updated.triageState,
      actor,
      reason: `Signal triaged: ${decision}`,
      at,
    }).pipe(
      Effect.mapError(
        (error) =>
          new SignalServiceError({
            message: `failed to append signal triage transition: ${error.message}`,
          }),
      ),
    );

    yield* repository.appendAuditTransition(transition);

    return updated;
  });

export const convertSignal = (
  repository: CoreRepository,
  input: ConvertSignalInput,
): Effect.Effect<ConvertedEntityRef, SignalServiceError> =>
  Effect.gen(function* () {
    const signal = yield* loadSignal(repository, input.signalId);
    const at = input.at ?? new Date();
    const atIso = at.toISOString();

    let converted: ConvertedEntityRef;
    let targetState: string;

    switch (input.targetType) {
      case "task": {
        const task = yield* createTask({
          id: input.targetId,
          title: signal.payload,
          sourceEntryId: signal.id,
          createdAt: at,
          updatedAt: at,
        }).pipe(
          Effect.mapError(
            (error) =>
              new SignalServiceError({
                message: `failed to convert signal to task: ${error.message}`,
              }),
          ),
        );
        yield* repository.saveEntity("task", task.id, task);
        converted = { entityType: "task", entityId: task.id };
        targetState = task.status;
        break;
      }
      case "event": {
        const event = yield* createEvent({
          id: input.targetId,
          title: signal.payload,
          startAt: at,
          createdAt: at,
          updatedAt: at,
        }).pipe(
          Effect.mapError(
            (error) =>
              new SignalServiceError({
                message: `failed to convert signal to event: ${error.message}`,
              }),
          ),
        );
        yield* repository.saveEntity("event", event.id, event);
        converted = { entityType: "event", entityId: event.id };
        targetState = event.syncState;
        break;
      }
      case "note": {
        const note = yield* createNote({
          id: input.targetId,
          body: signal.payload,
          linkedEntityRefs: [`signal:${signal.id}`],
          createdAt: at,
          updatedAt: at,
        }).pipe(
          Effect.mapError(
            (error) =>
              new SignalServiceError({
                message: `failed to convert signal to note: ${error.message}`,
              }),
          ),
        );
        yield* repository.saveEntity("note", note.id, note);
        converted = { entityType: "note", entityId: note.id };
        targetState = "created";
        break;
      }
      case "project": {
        const project = yield* createProject({
          id: input.targetId,
          name: signal.payload,
          createdAt: at,
          updatedAt: at,
        }).pipe(
          Effect.mapError(
            (error) =>
              new SignalServiceError({
                message: `failed to convert signal to project: ${error.message}`,
              }),
          ),
        );
        yield* repository.saveEntity("project", project.id, project);
        converted = { entityType: "project", entityId: project.id };
        targetState = project.lifecycle;
        break;
      }
      case "outbound_draft": {
        const outboundDraft = yield* createOutboundDraft({
          id: input.targetId,
          payload: signal.payload,
          sourceSignalId: signal.id,
          createdAt: at,
          updatedAt: at,
        }).pipe(
          Effect.mapError(
            (error) =>
              new SignalServiceError({
                message: `failed to convert signal to outbound draft: ${error.message}`,
              }),
          ),
        );
        yield* repository.saveEntity(
          "outbound_draft",
          outboundDraft.id,
          outboundDraft,
        );
        converted = {
          entityType: "outbound_draft",
          entityId: outboundDraft.id,
        };
        targetState = outboundDraft.status;
        break;
      }
      default: {
        return yield* Effect.fail(
          new SignalServiceError({
            message: `unsupported signal conversion target: ${String(input.targetType)}`,
          }),
        );
      }
    }

    const updatedSignal: Signal = {
      ...signal,
      triageState: "converted",
      triageDecision: `converted_to_${converted.entityType}`,
      convertedEntityType: converted.entityType,
      convertedEntityId: converted.entityId,
      updatedAt: atIso,
    };

    yield* repository.saveEntity("signal", updatedSignal.id, updatedSignal);

    const targetTransition = yield* createAuditTransition({
      entityType: converted.entityType,
      entityId: converted.entityId,
      fromState: "none",
      toState: targetState,
      actor: input.actor,
      reason: "Entity created from signal conversion",
      at,
      metadata: {
        sourceSignalId: signal.id,
      },
    }).pipe(
      Effect.mapError(
        (error) =>
          new SignalServiceError({
            message: `failed to append target conversion transition: ${error.message}`,
          }),
      ),
    );

    const signalTransition = yield* createAuditTransition({
      entityType: "signal",
      entityId: signal.id,
      fromState: signal.triageState,
      toState: "converted",
      actor: input.actor,
      reason: "Signal converted",
      at,
      metadata: {
        targetEntityType: converted.entityType,
        targetEntityId: converted.entityId,
      },
    }).pipe(
      Effect.mapError(
        (error) =>
          new SignalServiceError({
            message: `failed to append signal conversion transition: ${error.message}`,
          }),
      ),
    );

    yield* repository.appendAuditTransition(targetTransition);
    yield* repository.appendAuditTransition(signalTransition);

    return converted;
  });

export const createSignalEntity = createSignal;
