import { Data, Effect } from "effect";

import { createAuditTransition } from "../domain/audit-transition";
import { createView, View, ViewFilters } from "../domain/view";
import { CoreRepository } from "../repositories/core-repository";

export class ViewServiceError extends Data.TaggedError("ViewServiceError")<{
  message: string;
}> {}

export interface SaveViewInput {
  viewId?: string;
  name: string;
  query: string;
  filters?: ViewFilters;
  at?: Date;
}

export interface SaveScopedViewInput {
  name?: string;
  query: string;
  filters?: ViewFilters;
  at?: Date;
}

const JOBS_VIEW_ID = "view:workflow:jobs";
const ACTIVITY_VIEW_ID = "view:workflow:activity";

const saveScopedView = (
  repository: CoreRepository,
  input: SaveScopedViewInput & {
    viewId: string;
    defaultName: string;
  },
): Effect.Effect<View, ViewServiceError> =>
  saveView(repository, {
    viewId: input.viewId,
    name: input.name ?? input.defaultName,
    query: input.query,
    filters: input.filters,
    at: input.at,
  });

export const saveView = (
  repository: CoreRepository,
  input: SaveViewInput,
): Effect.Effect<View, ViewServiceError> =>
  Effect.gen(function* () {
    const at = input.at ?? new Date();

    const existing = input.viewId
      ? yield* repository.getEntity<View>("view", input.viewId)
      : undefined;

    const view = existing
      ? {
          ...existing,
          name: input.name,
          query: input.query,
          filters: { ...(input.filters ?? existing.filters ?? {}) },
          updatedAt: at.toISOString(),
        }
      : yield* createView({
          id: input.viewId,
          name: input.name,
          query: input.query,
          filters: input.filters,
          createdAt: at,
          updatedAt: at,
        }).pipe(
          Effect.mapError(
            (error) =>
              new ViewServiceError({
                message: `failed to create view: ${error.message}`,
              }),
          ),
        );

    yield* repository.saveEntity("view", view.id, view);

    const transition = yield* createAuditTransition({
      entityType: "view",
      entityId: view.id,
      fromState: existing ? "saved" : "none",
      toState: "saved",
      actor: { id: "system:view-service", kind: "system" },
      reason: existing ? "View updated" : "View created",
      at,
    }).pipe(
      Effect.mapError(
        (error) =>
          new ViewServiceError({
            message: `failed to append view transition: ${error.message}`,
          }),
      ),
    );

    yield* repository.appendAuditTransition(transition);

    return view;
  });

export const saveJobsView = (
  repository: CoreRepository,
  input: SaveScopedViewInput,
): Effect.Effect<View, ViewServiceError> =>
  saveScopedView(repository, {
    ...input,
    viewId: JOBS_VIEW_ID,
    defaultName: "Jobs Filters",
  });

export const getJobsView = (
  repository: CoreRepository,
): Effect.Effect<View | undefined> =>
  repository.getEntity<View>("view", JOBS_VIEW_ID);

export const saveActivityView = (
  repository: CoreRepository,
  input: SaveScopedViewInput,
): Effect.Effect<View, ViewServiceError> =>
  saveScopedView(repository, {
    ...input,
    viewId: ACTIVITY_VIEW_ID,
    defaultName: "Activity Filters",
  });

export const getActivityView = (
  repository: CoreRepository,
): Effect.Effect<View | undefined> =>
  repository.getEntity<View>("view", ACTIVITY_VIEW_ID);
