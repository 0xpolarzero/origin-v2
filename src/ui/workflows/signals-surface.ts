import { Data, Effect } from "effect";

import { Signal } from "../../core/domain/signal";
import { WorkflowSurfaceCorePort } from "./workflow-surface-core-port";

export class SignalsSurfaceError extends Data.TaggedError("SignalsSurfaceError")<{
  message: string;
  cause?: unknown;
}> {}

export interface SignalsSurfaceFilters {
  triageState?: Signal["triageState"];
  source?: string;
  limit?: number;
}

export interface SignalsSurfaceState {
  signals: ReadonlyArray<Signal>;
  filters: SignalsSurfaceFilters;
}

const toSignalsSurfaceError = (error: unknown): SignalsSurfaceError =>
  new SignalsSurfaceError({
    message: error instanceof Error ? error.message : String(error),
    cause: error,
  });

export const loadSignalsSurface = (
  port: WorkflowSurfaceCorePort,
  input: SignalsSurfaceFilters = {},
): Effect.Effect<SignalsSurfaceState, SignalsSurfaceError> =>
  port
    .listEntities<Signal>("signal")
    .pipe(
      Effect.map((signalsRaw) => {
        const filtered = signalsRaw
          .filter((signal) =>
            input.triageState ? signal.triageState === input.triageState : true,
          )
          .filter((signal) => (input.source ? signal.source === input.source : true))
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

        return {
          signals:
            input.limit && Number.isInteger(input.limit) && input.limit > 0
              ? filtered.slice(0, input.limit)
              : filtered,
          filters: { ...input },
        };
      }),
      Effect.mapError(toSignalsSurfaceError),
    );
