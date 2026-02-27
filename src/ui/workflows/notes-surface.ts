import { Data, Effect } from "effect";

import { Note } from "../../core/domain/note";
import { WorkflowSurfaceCorePort } from "./workflow-surface-core-port";

export class NotesSurfaceError extends Data.TaggedError("NotesSurfaceError")<{
  message: string;
  cause?: unknown;
}> {}

export interface NotesSurfaceFilters {
  linkedEntityRef?: string;
  limit?: number;
}

export interface NotesSurfaceState {
  notes: ReadonlyArray<Note>;
  filters: NotesSurfaceFilters;
}

const toNotesSurfaceError = (error: unknown): NotesSurfaceError =>
  new NotesSurfaceError({
    message: error instanceof Error ? error.message : String(error),
    cause: error,
  });

export const loadNotesSurface = (
  port: WorkflowSurfaceCorePort,
  input: NotesSurfaceFilters = {},
): Effect.Effect<NotesSurfaceState, NotesSurfaceError> =>
  port
    .listEntities<Note>("note")
    .pipe(
      Effect.map((notesRaw) => {
        const filtered = notesRaw
          .filter((note) =>
            input.linkedEntityRef
              ? note.linkedEntityRefs.includes(input.linkedEntityRef)
              : true,
          )
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

        return {
          notes:
            input.limit && Number.isInteger(input.limit) && input.limit > 0
              ? filtered.slice(0, input.limit)
              : filtered,
          filters: { ...input },
        };
      }),
      Effect.mapError(toNotesSurfaceError),
    );
