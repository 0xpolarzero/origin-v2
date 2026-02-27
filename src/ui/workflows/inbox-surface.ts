import { Data, Effect } from "effect";

import { Entry } from "../../core/domain/entry";
import { Signal } from "../../core/domain/signal";
import { WorkflowSurfaceCorePort } from "./workflow-surface-core-port";

export class InboxSurfaceError extends Data.TaggedError("InboxSurfaceError")<{
  message: string;
  cause?: unknown;
}> {}

export interface InboxSurfaceFilters {
  includeCapturedEntries?: boolean;
  includeSuggestedEntries?: boolean;
  includeUntriagedSignals?: boolean;
  limit?: number;
}

export interface InboxSurfaceState {
  entries: ReadonlyArray<Entry>;
  signals: ReadonlyArray<Signal>;
  suggestions: ReadonlyArray<Entry>;
  filters: InboxSurfaceFilters;
}

const toInboxSurfaceError = (error: unknown): InboxSurfaceError =>
  new InboxSurfaceError({
    message: error instanceof Error ? error.message : String(error),
    cause: error,
  });

const byUpdatedDesc = <T extends { updatedAt: string }>(
  left: T,
  right: T,
): number => right.updatedAt.localeCompare(left.updatedAt);

const takeIfLimited = <T>(items: ReadonlyArray<T>, limit?: number): ReadonlyArray<T> =>
  limit && Number.isInteger(limit) && limit > 0 ? items.slice(0, limit) : items;

export const loadInboxSurface = (
  port: WorkflowSurfaceCorePort,
  input: InboxSurfaceFilters = {},
): Effect.Effect<InboxSurfaceState, InboxSurfaceError> =>
  Effect.gen(function* () {
    const filters: Required<Omit<InboxSurfaceFilters, "limit">> &
      Pick<InboxSurfaceFilters, "limit"> = {
      includeCapturedEntries: input.includeCapturedEntries ?? true,
      includeSuggestedEntries: input.includeSuggestedEntries ?? true,
      includeUntriagedSignals: input.includeUntriagedSignals ?? true,
      limit: input.limit,
    };

    const [entriesRaw, signalsRaw] = yield* Effect.all([
      port.listEntities<Entry>("entry"),
      port.listEntities<Signal>("signal"),
    ]);

    const entries = entriesRaw
      .filter((entry) => {
        if (entry.status === "captured") {
          return filters.includeCapturedEntries;
        }

        if (entry.status === "suggested") {
          return filters.includeSuggestedEntries;
        }

        return false;
      })
      .sort(byUpdatedDesc);
    const suggestions = entries
      .filter(
        (entry) => entry.status === "suggested" && !!entry.suggestedTaskTitle,
      )
      .sort(byUpdatedDesc);
    const signals = signalsRaw
      .filter((signal) =>
        filters.includeUntriagedSignals ? signal.triageState === "untriaged" : false,
      )
      .sort(byUpdatedDesc);

    return {
      entries: takeIfLimited(entries, filters.limit),
      signals: takeIfLimited(signals, filters.limit),
      suggestions: takeIfLimited(suggestions, filters.limit),
      filters,
    };
  }).pipe(Effect.mapError(toInboxSurfaceError));
