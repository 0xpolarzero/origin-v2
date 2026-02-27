import { Data, Effect } from "effect";

import { Notification } from "../../core/domain/notification";
import { WorkflowSurfaceCorePort } from "./workflow-surface-core-port";

export class NotificationsSurfaceError extends Data.TaggedError(
  "NotificationsSurfaceError",
)<{
  message: string;
  cause?: unknown;
}> {}

export interface NotificationsSurfaceFilters {
  status?: Notification["status"];
  relatedEntityType?: string;
  limit?: number;
}

export interface NotificationsSurfaceState {
  notifications: ReadonlyArray<Notification>;
  filters: NotificationsSurfaceFilters;
}

const toNotificationsSurfaceError = (
  error: unknown,
): NotificationsSurfaceError =>
  new NotificationsSurfaceError({
    message: error instanceof Error ? error.message : String(error),
    cause: error,
  });

export const loadNotificationsSurface = (
  port: WorkflowSurfaceCorePort,
  input: NotificationsSurfaceFilters = {},
): Effect.Effect<NotificationsSurfaceState, NotificationsSurfaceError> =>
  port
    .listEntities<Notification>("notification")
    .pipe(
      Effect.map((notificationsRaw) => {
        const filtered = notificationsRaw
          .filter((notification) =>
            input.status ? notification.status === input.status : true,
          )
          .filter((notification) =>
            input.relatedEntityType
              ? notification.relatedEntityType === input.relatedEntityType
              : true,
          )
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

        return {
          notifications:
            input.limit && Number.isInteger(input.limit) && input.limit > 0
              ? filtered.slice(0, input.limit)
              : filtered,
          filters: { ...input },
        };
      }),
      Effect.mapError(toNotificationsSurfaceError),
    );
