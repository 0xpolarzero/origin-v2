import { Data, Effect } from "effect";

import { createAuditTransition } from "../domain/audit-transition";
import { ActorRef, validateNonEmpty } from "../domain/common";
import { createNote, Note } from "../domain/note";
import { CoreRepository } from "../repositories/core-repository";

export class NoteServiceError extends Data.TaggedError("NoteServiceError")<{
  message: string;
  code?: "not_found" | "conflict" | "invalid_request";
}> {}

export interface CreateNoteInServiceInput {
  noteId?: string;
  body: string;
  linkedEntityRefs?: ReadonlyArray<string>;
  actor: ActorRef;
  at?: Date;
}

export interface ListNotesInput {
  entityRef?: string;
}

const sortNotesDeterministically = (
  notes: ReadonlyArray<Note>,
): ReadonlyArray<Note> =>
  [...notes].sort(
    (left, right) =>
      right.updatedAt.localeCompare(left.updatedAt) ||
      right.createdAt.localeCompare(left.createdAt) ||
      right.id.localeCompare(left.id),
  );

const normalizeLinkedEntityRefs = (
  refs: ReadonlyArray<string>,
): ReadonlyArray<string> =>
  Array.from(new Set(refs)).sort((left, right) => left.localeCompare(right));

const loadNote = (
  repository: CoreRepository,
  noteId: string,
): Effect.Effect<Note, NoteServiceError> =>
  Effect.gen(function* () {
    const note = yield* repository.getEntity<Note>("note", noteId);
    if (!note) {
      return yield* Effect.fail(
        new NoteServiceError({
          message: `note ${noteId} was not found`,
          code: "not_found",
        }),
      );
    }
    return note;
  });

const validateBody = (
  body: string,
): Effect.Effect<void, NoteServiceError> =>
  Effect.gen(function* () {
    const bodyError = validateNonEmpty(body, "body");
    if (bodyError) {
      return yield* Effect.fail(
        new NoteServiceError({
          message: `failed to update note body: ${bodyError.message}`,
          code: "invalid_request",
        }),
      );
    }
  });

const validateEntityRef = (
  entityRef: string,
): Effect.Effect<void, NoteServiceError> =>
  Effect.gen(function* () {
    const entityRefError = validateNonEmpty(entityRef, "entityRef");
    if (entityRefError) {
      return yield* Effect.fail(
        new NoteServiceError({
          message: `failed to update note link: ${entityRefError.message}`,
          code: "invalid_request",
        }),
      );
    }
  });

export const createNoteInService = (
  repository: CoreRepository,
  input: CreateNoteInServiceInput,
): Effect.Effect<Note, NoteServiceError> =>
  repository.withTransaction(
    Effect.gen(function* () {
      if (input.noteId) {
        const existing = yield* repository.getEntity<Note>("note", input.noteId);
        if (existing) {
          return yield* Effect.fail(
            new NoteServiceError({
              message: `note ${input.noteId} already exists`,
              code: "conflict",
            }),
          );
        }
      }

      const at = input.at ?? new Date();
      const note = yield* createNote({
        id: input.noteId,
        body: input.body,
        linkedEntityRefs: input.linkedEntityRefs,
        createdAt: at,
        updatedAt: at,
      }).pipe(
        Effect.mapError(
          (error) =>
            new NoteServiceError({
              message: `failed to create note: ${error.message}`,
              code: "invalid_request",
            }),
        ),
      );

      yield* repository.saveEntity("note", note.id, note);

      const transition = yield* createAuditTransition({
        entityType: "note",
        entityId: note.id,
        fromState: "none",
        toState: "created",
        actor: input.actor,
        reason: "Note created",
        at,
      }).pipe(
        Effect.mapError(
          (error) =>
            new NoteServiceError({
              message: `failed to append note create transition: ${error.message}`,
            }),
        ),
      );

      yield* repository.appendAuditTransition(transition);
      return note;
    }),
  );

export const updateNoteBody = (
  repository: CoreRepository,
  noteId: string,
  body: string,
  actor: ActorRef,
  at: Date = new Date(),
): Effect.Effect<Note, NoteServiceError> =>
  repository.withTransaction(
    Effect.gen(function* () {
      yield* validateBody(body);
      const note = yield* loadNote(repository, noteId);
      const atIso = at.toISOString();

      const updated: Note = {
        ...note,
        body,
        updatedAt: atIso,
      };

      yield* repository.saveEntity("note", updated.id, updated);

      const transition = yield* createAuditTransition({
        entityType: "note",
        entityId: updated.id,
        fromState: "saved",
        toState: "saved",
        actor,
        reason: "Note body updated",
        at,
      }).pipe(
        Effect.mapError(
          (error) =>
            new NoteServiceError({
              message: `failed to append note body update transition: ${error.message}`,
            }),
        ),
      );

      yield* repository.appendAuditTransition(transition);
      return updated;
    }),
  );

export const linkNoteEntity = (
  repository: CoreRepository,
  noteId: string,
  entityRef: string,
  actor: ActorRef,
  at: Date = new Date(),
): Effect.Effect<Note, NoteServiceError> =>
  repository.withTransaction(
    Effect.gen(function* () {
      yield* validateEntityRef(entityRef);
      const note = yield* loadNote(repository, noteId);
      const atIso = at.toISOString();
      const alreadyLinked = note.linkedEntityRefs.includes(entityRef);

      const updated: Note = {
        ...note,
        linkedEntityRefs: normalizeLinkedEntityRefs([
          ...note.linkedEntityRefs,
          entityRef,
        ]),
        updatedAt: atIso,
      };

      yield* repository.saveEntity("note", updated.id, updated);

      const transition = yield* createAuditTransition({
        entityType: "note",
        entityId: updated.id,
        fromState: "saved",
        toState: "saved",
        actor,
        reason: alreadyLinked
          ? "Note entity link already present"
          : "Note entity linked",
        at,
        metadata: {
          entityRef,
          action: alreadyLinked ? "noop" : "linked",
        },
      }).pipe(
        Effect.mapError(
          (error) =>
            new NoteServiceError({
              message: `failed to append note link transition: ${error.message}`,
            }),
        ),
      );

      yield* repository.appendAuditTransition(transition);
      return updated;
    }),
  );

export const unlinkNoteEntity = (
  repository: CoreRepository,
  noteId: string,
  entityRef: string,
  actor: ActorRef,
  at: Date = new Date(),
): Effect.Effect<Note, NoteServiceError> =>
  repository.withTransaction(
    Effect.gen(function* () {
      yield* validateEntityRef(entityRef);
      const note = yield* loadNote(repository, noteId);
      const atIso = at.toISOString();
      const wasLinked = note.linkedEntityRefs.includes(entityRef);

      const updated: Note = {
        ...note,
        linkedEntityRefs: normalizeLinkedEntityRefs(
          note.linkedEntityRefs.filter((existing) => existing !== entityRef),
        ),
        updatedAt: atIso,
      };

      yield* repository.saveEntity("note", updated.id, updated);

      const transition = yield* createAuditTransition({
        entityType: "note",
        entityId: updated.id,
        fromState: "saved",
        toState: "saved",
        actor,
        reason: wasLinked
          ? "Note entity unlinked"
          : "Note entity link was already absent",
        at,
        metadata: {
          entityRef,
          action: wasLinked ? "unlinked" : "noop",
        },
      }).pipe(
        Effect.mapError(
          (error) =>
            new NoteServiceError({
              message: `failed to append note unlink transition: ${error.message}`,
            }),
        ),
      );

      yield* repository.appendAuditTransition(transition);
      return updated;
    }),
  );

export const listNotes = (
  repository: CoreRepository,
  input: ListNotesInput = {},
): Effect.Effect<ReadonlyArray<Note>> =>
  Effect.gen(function* () {
    const notes = yield* repository.listEntities<Note>("note");
    const filtered = notes.filter(
      (note) =>
        input.entityRef === undefined ||
        note.linkedEntityRefs.includes(input.entityRef),
    );

    return sortNotesDeterministically(filtered);
  });
