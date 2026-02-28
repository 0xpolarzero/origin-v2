import React, {
  type ReactElement,
  useCallback,
  useEffect,
  useState,
} from "react";
import { Data, Effect } from "effect";

import {
  type WorkflowRouteKey,
  type WorkflowApi,
  type ListActivityRequest,
  type ListJobsRequest,
} from "../api/workflows/contracts";
import {
  type WorkflowHttpRequest,
  type WorkflowHttpResponse,
  makeWorkflowHttpDispatcher,
} from "../api/workflows/http-dispatch";
import { WORKFLOW_ROUTE_PATHS, makeWorkflowRoutes } from "../api/workflows/routes";
import { makeWorkflowApi } from "../api/workflows/workflow-api";
import {
  type CorePlatform,
} from "../core/app/core-platform";
import { type Checkpoint } from "../core/domain/checkpoint";
import { type ActorRef, type EntityReference } from "../core/domain/common";
import { type Entry } from "../core/domain/entry";
import { type Event } from "../core/domain/event";
import { type OutboundDraft } from "../core/domain/outbound-draft";
import { type Signal } from "../core/domain/signal";
import { type Task } from "../core/domain/task";
import {
  type ActivityFeedItem,
} from "../core/services/activity-service";
import {
  inspectCheckpointFromActivity,
  keepCheckpointFromActivity,
  loadActivitySurface,
  recoverCheckpointFromActivity,
  type ActivitySurfaceState,
} from "../ui/workflows/activity-surface";
import {
  loadInboxSurface,
  type InboxSurfaceState,
} from "../ui/workflows/inbox-surface";
import {
  inspectJobFromSurface,
  loadJobsSurface,
  retryJobFromSurface,
  type JobsSurfaceState,
} from "../ui/workflows/jobs-surface";
import {
  loadPlanSurface,
  type PlanSurfaceState,
} from "../ui/workflows/plan-surface";
import {
  loadSignalsSurface,
  type SignalsSurfaceState,
} from "../ui/workflows/signals-surface";
import {
  loadTasksSurface,
  type TasksSurfaceState,
} from "../ui/workflows/tasks-surface";
import {
  loadEventsSurface,
  type EventsSurfaceState,
} from "../ui/workflows/events-surface";
import {
  loadProjectsSurface,
  type ProjectsSurfaceState,
} from "../ui/workflows/projects-surface";
import {
  loadNotesSurface,
  type NotesSurfaceState,
} from "../ui/workflows/notes-surface";
import {
  loadNotificationsSurface,
  type NotificationsSurfaceState,
} from "../ui/workflows/notifications-surface";
import {
  loadSearchSurface,
  type SearchSurfaceState,
} from "../ui/workflows/search-surface";
import {
  loadSettingsSurface,
  saveSettingsSurface,
  type SettingsSurfaceState,
} from "../ui/workflows/settings-surface";
import { type WorkflowSurfaceCorePort } from "../ui/workflows/workflow-surface-core-port";
import { makeWorkflowSurfaceClient } from "../ui/workflows/workflow-surface-client";
import { makeWorkflowSurfaceFiltersStore } from "../ui/workflows/workflow-surface-filters";

export class InteractiveWorkflowAppError extends Data.TaggedError(
  "InteractiveWorkflowAppError",
)<{
  message: string;
  cause?: unknown;
}> {}

export interface InteractiveWorkflowAppState {
  inbox: InboxSurfaceState;
  signals: SignalsSurfaceState;
  plan: PlanSurfaceState;
  tasks: TasksSurfaceState;
  events: EventsSurfaceState;
  projects: ProjectsSurfaceState;
  notes: NotesSurfaceState;
  notifications: NotificationsSurfaceState;
  search: SearchSurfaceState;
  settings: SettingsSurfaceState;
  jobs: JobsSurfaceState;
  activity: ActivitySurfaceState;
  pendingEventApprovals: ReadonlyArray<Event>;
  pendingOutboundDraftApprovals: ReadonlyArray<OutboundDraft>;
  lastUpdatedAt?: string;
}

export interface AIConfig {
  enabled: boolean;
  provider: string;
  modelId: string;
  maxTokens: number;
  timeoutMs: number;
  temperature: number;
}

export interface InteractiveWorkflowApp {
  getState: () => InteractiveWorkflowAppState;
  load: () => Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError>;
  captureEntry: (input: {
    content: string;
    entryId?: string;
    at?: Date;
  }) => Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError>;
  captureWithAISuggestion: (input: {
    content: string;
    entryId?: string;
    at?: Date;
  }) => Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError>;
  isAIEnabled: () => boolean;
  getAIConfig: () => AIConfig;
  suggestEntryAsTask: (input: {
    entryId: string;
    suggestedTitle: string;
    at?: Date;
  }) => Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError>;
  editEntrySuggestion: (input: {
    entryId: string;
    suggestedTitle: string;
    at?: Date;
  }) => Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError>;
  acceptEntryAsTask: (input: {
    entryId: string;
    title?: string;
    taskId?: string;
    at?: Date;
  }) => Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError>;
  rejectEntrySuggestion: (input: {
    entryId: string;
    reason?: string;
    at?: Date;
  }) => Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError>;
  ingestSignal: (input: {
    source: string;
    payload: string;
    signalId?: string;
    at?: Date;
  }) => Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError>;
  triageSignal: (input: {
    signalId: string;
    decision: string;
    at?: Date;
  }) => Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError>;
  convertSignal: (input: {
    signalId: string;
    targetType: "task" | "event" | "note" | "project" | "outbound_draft";
    targetId?: string;
    at?: Date;
  }) => Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError>;
  completeTask: (input: {
    taskId: string;
    at?: Date;
  }) => Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError>;
  deferTask: (input: {
    taskId: string;
    until: Date;
    at?: Date;
  }) => Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError>;
  rescheduleTask: (input: {
    taskId: string;
    nextAt: Date;
    at?: Date;
  }) => Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError>;
  createTask: (input: {
    title: string;
    taskId?: string;
    description?: string;
    scheduledFor?: Date;
    dueAt?: Date;
    projectId?: string;
    sourceEntryId?: string;
    at?: Date;
  }) => Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError>;
  updateTask: (input: {
    taskId: string;
    title?: string;
    description?: string | null;
    scheduledFor?: Date | null;
    dueAt?: Date | null;
    projectId?: string | null;
    at?: Date;
  }) => Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError>;
  loadTasks: (
    filters?: Parameters<typeof loadTasksSurface>[1],
  ) => Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError>;
  createEvent: (input: {
    title: string;
    startAt: Date;
    eventId?: string;
    endAt?: Date;
    at?: Date;
  }) => Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError>;
  updateEvent: (input: {
    eventId: string;
    title?: string;
    startAt?: Date;
    endAt?: Date | null;
    at?: Date;
  }) => Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError>;
  loadEvents: (
    filters?: Parameters<typeof loadEventsSurface>[1],
  ) => Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError>;
  createProject: (input: {
    name: string;
    projectId?: string;
    description?: string;
    at?: Date;
  }) => Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError>;
  updateProject: (input: {
    projectId: string;
    name?: string;
    description?: string;
    at?: Date;
  }) => Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError>;
  setProjectLifecycle: (input: {
    projectId: string;
    lifecycle: "active" | "paused" | "completed";
    at?: Date;
  }) => Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError>;
  loadProjects: (
    filters?: Parameters<typeof loadProjectsSurface>[1],
  ) => Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError>;
  createNote: (input: {
    body: string;
    noteId?: string;
    linkedEntityRefs?: ReadonlyArray<string>;
    at?: Date;
  }) => Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError>;
  updateNote: (input: {
    noteId: string;
    body: string;
    at?: Date;
  }) => Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError>;
  linkNoteEntity: (input: {
    noteId: string;
    entityRef: string;
    at?: Date;
  }) => Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError>;
  unlinkNoteEntity: (input: {
    noteId: string;
    entityRef: string;
    at?: Date;
  }) => Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError>;
  loadNotes: (
    filters?: Parameters<typeof loadNotesSurface>[1],
  ) => Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError>;
  loadNotifications: (
    filters?: Parameters<typeof loadNotificationsSurface>[1],
  ) => Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError>;
  acknowledgeNotification: (input: {
    notificationId: string;
    at?: Date;
  }) => Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError>;
  dismissNotification: (input: {
    notificationId: string;
    at?: Date;
  }) => Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError>;
  search: (
    input: Parameters<typeof loadSearchSurface>[1],
  ) => Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError>;
  loadSettings: (
    keys?: Parameters<typeof loadSettingsSurface>[1],
  ) => Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError>;
  saveSettings: (
    input: Parameters<typeof saveSettingsSurface>[1],
  ) => Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError>;
  requestEventSync: (input: {
    eventId: string;
    at?: Date;
  }) => Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError>;
  requestOutboundDraftExecution: (input: {
    draftId: string;
    at?: Date;
  }) => Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError>;
  approveOutboundAction: (input: {
    actionType: "event_sync" | "outbound_draft";
    entityType: string;
    entityId: string;
    approved: boolean;
    at?: Date;
  }) => Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError>;
  createJob: (input: {
    jobId: string;
    name: string;
    at?: Date;
  }) => Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError>;
  recordJobRun: (input: {
    jobId: string;
    outcome: "succeeded" | "failed";
    diagnostics?: string;
    at?: Date;
  }) => Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError>;
  inspectJob: (jobId: string) => Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError>;
  retryJob: (input: {
    jobId: string;
    fixSummary?: string;
    at?: Date;
  }) => Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError>;
  createCheckpoint: (input: {
    checkpointId: string;
    name: string;
    rollbackTarget: string;
    auditCursor: number;
    snapshotEntityRefs?: ReadonlyArray<EntityReference>;
    at?: Date;
  }) => Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError>;
  inspectCheckpoint: (
    checkpointId: string,
  ) => Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError>;
  keepCheckpoint: (input: {
    checkpointId: string;
    at?: Date;
  }) => Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError>;
  recoverCheckpoint: (input: {
    checkpointId: string;
    at?: Date;
  }) => Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError>;
}

export interface MakeInteractiveWorkflowAppOptions {
  platform: CorePlatform;
  actor: ActorRef;
  jobsFilters?: ListJobsRequest;
  activityFilters?: ListActivityRequest;
}

const toAppError = (error: unknown): InteractiveWorkflowAppError =>
  new InteractiveWorkflowAppError({
    message: error instanceof Error ? error.message : String(error),
    cause: error,
  });

const emptyInboxState: InboxSurfaceState = {
  entries: [],
  signals: [],
  suggestions: [],
  filters: {},
};

const emptySignalsState: SignalsSurfaceState = {
  signals: [],
  filters: {},
};

const emptyPlanState: PlanSurfaceState = {
  tasks: [],
  events: [],
  timeline: [],
  filters: {},
};

const emptyTasksState: TasksSurfaceState = {
  tasks: [],
  filters: {},
};

const emptyEventsState: EventsSurfaceState = {
  events: [],
  pendingApprovalCount: 0,
  filters: {},
};

const emptyProjectsState: ProjectsSurfaceState = {
  projects: [],
  filters: {},
};

const emptyNotesState: NotesSurfaceState = {
  notes: [],
  filters: {},
};

const emptyNotificationsState: NotificationsSurfaceState = {
  notifications: [],
  filters: {},
};

const emptySearchState: SearchSurfaceState = {
  query: "",
  results: [],
  scannedEntityTypes: [],
};

const emptySettingsState: SettingsSurfaceState = {
  values: {},
};

const emptyJobsState: JobsSurfaceState = {
  jobs: [],
  history: [],
  filters: {},
};

const emptyActivityState: ActivitySurfaceState = {
  feed: [],
  filters: {},
};

const emptyInteractiveWorkflowAppState = (): InteractiveWorkflowAppState => ({
  inbox: emptyInboxState,
  signals: emptySignalsState,
  plan: emptyPlanState,
  tasks: emptyTasksState,
  events: emptyEventsState,
  projects: emptyProjectsState,
  notes: emptyNotesState,
  notifications: emptyNotificationsState,
  search: emptySearchState,
  settings: emptySettingsState,
  jobs: emptyJobsState,
  activity: emptyActivityState,
  pendingEventApprovals: [],
  pendingOutboundDraftApprovals: [],
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toRouteErrorMessage = (
  route: WorkflowRouteKey,
  response: WorkflowHttpResponse,
): string => {
  if (isRecord(response.body) && typeof response.body.message === "string") {
    return response.body.message;
  }

  return `workflow route ${route} failed with status ${response.status}`;
};

const withNow = (
  state: InteractiveWorkflowAppState,
): InteractiveWorkflowAppState => ({
  ...state,
  lastUpdatedAt: new Date().toISOString(),
});

const summarizePlanStatuses = (
  tasks: ReadonlyArray<Task>,
): { planned: number; deferred: number; completed: number } => {
  let planned = 0;
  let deferred = 0;
  let completed = 0;

  for (const task of tasks) {
    if (task.status === "planned") {
      planned += 1;
      continue;
    }

    if (task.status === "deferred") {
      deferred += 1;
      continue;
    }

    completed += 1;
  }

  return {
    planned,
    deferred,
    completed,
  };
};

const createCachedSurfaceCorePort = (
  port: WorkflowSurfaceCorePort,
): WorkflowSurfaceCorePort => {
  const cache = new Map<string, ReadonlyArray<unknown>>();

  return {
    getEntity: port.getEntity,
    upsertMemory: port.upsertMemory,
    listEntities: <T>(entityType: string) =>
      Effect.gen(function* () {
        const cached = cache.get(entityType);
        if (cached) {
          return cached as ReadonlyArray<T>;
        }

        const loaded = yield* port.listEntities<T>(entityType);
        cache.set(entityType, loaded as ReadonlyArray<unknown>);
        return loaded;
      }),
  };
};

export const makeInteractiveWorkflowApp = (
  options: MakeInteractiveWorkflowAppOptions,
): InteractiveWorkflowApp => {
  const workflowApi = makeWorkflowApi({ platform: options.platform });
  const routes = makeWorkflowRoutes(workflowApi);
  const dispatch = makeWorkflowHttpDispatcher(routes);
  const client = makeWorkflowSurfaceClient(dispatch);
  const filtersStore = makeWorkflowSurfaceFiltersStore({
    getJobsView: options.platform.getJobsView,
    saveJobsView: options.platform.saveJobsView,
    getActivityView: options.platform.getActivityView,
    saveActivityView: options.platform.saveActivityView,
  });

  let state = emptyInteractiveWorkflowAppState();
  let searchFilters: Parameters<typeof loadSearchSurface>[1] = {
    query: "",
  };

  const route = <Output>(
    routeKey: WorkflowRouteKey,
    body: unknown,
  ): Effect.Effect<Output, InteractiveWorkflowAppError> =>
    dispatch({
      method: "POST",
      path: WORKFLOW_ROUTE_PATHS[routeKey],
      body,
      auth: {
        sessionActor: options.actor,
      },
    }).pipe(
      Effect.flatMap((response) => {
        if (response.status >= 200 && response.status <= 299) {
          return Effect.succeed(response.body as Output);
        }

        return Effect.fail(
          new InteractiveWorkflowAppError({
            message: toRouteErrorMessage(routeKey, response),
            cause: response.body,
          }),
        );
      }),
      Effect.mapError(toAppError),
    );

  const refresh = (
    nextJobsFilters?: ListJobsRequest,
    nextActivityFilters?: ListActivityRequest,
  ): Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError> =>
    Effect.gen(function* () {
      const surfacePort = createCachedSurfaceCorePort(options.platform);
      const [
        inbox,
        signals,
        plan,
        tasks,
        eventsSurface,
        projects,
        notes,
        notifications,
        search,
        settings,
        jobs,
        activity,
        events,
        drafts,
      ] = yield* Effect.all([
        loadInboxSurface(surfacePort, state.inbox.filters),
        loadSignalsSurface(surfacePort, state.signals.filters),
        loadPlanSurface(surfacePort, state.plan.filters),
        loadTasksSurface(surfacePort, state.tasks.filters),
        loadEventsSurface(surfacePort, state.events.filters),
        loadProjectsSurface(surfacePort, state.projects.filters),
        loadNotesSurface(surfacePort, state.notes.filters),
        loadNotificationsSurface(surfacePort, state.notifications.filters),
        loadSearchSurface(surfacePort, searchFilters),
        loadSettingsSurface(surfacePort),
        loadJobsSurface(client, filtersStore, nextJobsFilters),
        loadActivitySurface(client, filtersStore, nextActivityFilters),
        surfacePort.listEntities<Event>("event"),
        surfacePort.listEntities<OutboundDraft>("outbound_draft"),
      ]);

      state = withNow({
        inbox,
        signals,
        plan,
        tasks,
        events: eventsSurface,
        projects,
        notes,
        notifications,
        search,
        settings,
        jobs,
        activity,
        pendingEventApprovals: events.filter(
          (event) => event.syncState === "pending_approval",
        ),
        pendingOutboundDraftApprovals: drafts.filter(
          (draft) => draft.status === "pending_approval",
        ),
      });

      return state;
    }).pipe(Effect.mapError(toAppError));

  const runMutation = (
    effect: Effect.Effect<unknown, InteractiveWorkflowAppError>,
  ): Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError> =>
    effect.pipe(Effect.flatMap(() => refresh()));

  const withPatchedState = <A>(
    effect: Effect.Effect<A, unknown>,
    patch: (current: InteractiveWorkflowAppState, value: A) => InteractiveWorkflowAppState,
  ): Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError> =>
    effect.pipe(
      Effect.map((value) => {
        state = withNow(patch(state, value));
        return state;
      }),
      Effect.mapError(toAppError),
    );

  const withJobState = (
    effect: Effect.Effect<JobsSurfaceState, unknown>,
  ): Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError> =>
    withPatchedState(effect, (current, jobs) => ({
      ...current,
      jobs,
    }));

  const withActivityState = (
    effect: Effect.Effect<ActivitySurfaceState, unknown>,
  ): Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError> =>
    withPatchedState(effect, (current, activity) => ({
      ...current,
      activity,
    }));

  // AI configuration helpers
  const isAIEnabled = (): boolean => {
    const aiEnabled = state.settings.values["ai.enabled"];
    return typeof aiEnabled === "boolean" ? aiEnabled : false;
  };

  const getAIConfig = (): AIConfig => {
    const values = state.settings.values;
    return {
      enabled: typeof values["ai.enabled"] === "boolean" ? values["ai.enabled"] : false,
      provider: typeof values["ai.provider"] === "string" ? values["ai.provider"] : "openai",
      modelId: typeof values["ai.modelId"] === "string" ? values["ai.modelId"] : "",
      maxTokens: typeof values["ai.maxTokens"] === "number" ? values["ai.maxTokens"] : 1000,
      timeoutMs: typeof values["ai.timeoutMs"] === "number" ? values["ai.timeoutMs"] : 30000,
      temperature: typeof values["ai.temperature"] === "number" ? values["ai.temperature"] : 0.7,
    };
  };

  return {
    getState: () => state,
    load: () => refresh(options.jobsFilters, options.activityFilters),
    captureEntry: (input) =>
      runMutation(
        route<Entry>("capture.entry", {
          entryId: input.entryId,
          content: input.content,
          actor: options.actor,
          at: input.at,
        }),
      ),
    captureWithAISuggestion: (input) =>
      Effect.gen(function* () {
        // First capture the entry
        const capturedEntry = yield* route<Entry>("capture.entry", {
          entryId: input.entryId,
          content: input.content,
          actor: options.actor,
          at: input.at,
        });

        // If AI is enabled, trigger AI suggestion
        if (isAIEnabled()) {
          yield* route<Entry>("capture.suggest", {
            entryId: capturedEntry.id,
            suggestedTitle: input.content, // Initial fallback
            aiAssist: true,
            actor: options.actor,
            at: input.at,
          }).pipe(
            Effect.catchAll(() =>
              // If AI fails, just use the content as the suggestion (manual fallback)
              route<Entry>("capture.suggest", {
                entryId: capturedEntry.id,
                suggestedTitle: input.content,
                actor: options.actor,
                at: input.at,
              }),
            ),
          );
        }

        return yield* refresh();
      }).pipe(Effect.mapError(toAppError)),
    isAIEnabled,
    getAIConfig,
    suggestEntryAsTask: (input) =>
      runMutation(
        route<Entry>("capture.suggest", {
          entryId: input.entryId,
          suggestedTitle: input.suggestedTitle,
          actor: options.actor,
          at: input.at,
        }),
      ),
    editEntrySuggestion: (input) =>
      runMutation(
        route<Entry>("capture.editSuggestion", {
          entryId: input.entryId,
          suggestedTitle: input.suggestedTitle,
          actor: options.actor,
          at: input.at,
        }),
      ),
    acceptEntryAsTask: (input) =>
      runMutation(
        route<Task>("capture.acceptAsTask", {
          entryId: input.entryId,
          taskId: input.taskId,
          title: input.title,
          actor: options.actor,
          at: input.at,
        }),
      ),
    rejectEntrySuggestion: (input) =>
      runMutation(
        route<Entry>("capture.rejectSuggestion", {
          entryId: input.entryId,
          reason: input.reason,
          actor: options.actor,
          at: input.at,
        }),
      ),
    ingestSignal: (input) =>
      runMutation(
        route<Signal>("signal.ingest", {
          signalId: input.signalId,
          source: input.source,
          payload: input.payload,
          actor: options.actor,
          at: input.at,
        }),
      ),
    triageSignal: (input) =>
      runMutation(
        route<Signal>("signal.triage", {
          signalId: input.signalId,
          decision: input.decision,
          actor: options.actor,
          at: input.at,
        }),
      ),
    convertSignal: (input) =>
      runMutation(
        route("signal.convert", {
          signalId: input.signalId,
          targetType: input.targetType,
          targetId: input.targetId,
          actor: options.actor,
          at: input.at,
        }),
      ),
    completeTask: (input) =>
      runMutation(
        route<Task>("planning.completeTask", {
          taskId: input.taskId,
          actor: options.actor,
          at: input.at,
        }),
      ),
    deferTask: (input) =>
      runMutation(
        route<Task>("planning.deferTask", {
          taskId: input.taskId,
          until: input.until,
          actor: options.actor,
          at: input.at,
        }),
      ),
    rescheduleTask: (input) =>
      runMutation(
        route<Task>("planning.rescheduleTask", {
          taskId: input.taskId,
          nextAt: input.nextAt,
          actor: options.actor,
          at: input.at,
        }),
      ),
    createTask: (input) =>
      runMutation(
        route<Task>("task.create", {
          title: input.title,
          actor: options.actor,
          ...(input.taskId !== undefined ? { taskId: input.taskId } : {}),
          ...(input.description !== undefined
            ? { description: input.description }
            : {}),
          ...(input.scheduledFor !== undefined
            ? { scheduledFor: input.scheduledFor }
            : {}),
          ...(input.dueAt !== undefined ? { dueAt: input.dueAt } : {}),
          ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
          ...(input.sourceEntryId !== undefined
            ? { sourceEntryId: input.sourceEntryId }
            : {}),
          ...(input.at !== undefined ? { at: input.at } : {}),
        }),
      ),
    updateTask: (input) =>
      runMutation(
        route<Task>("task.update", {
          taskId: input.taskId,
          actor: options.actor,
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.description !== undefined
            ? { description: input.description }
            : {}),
          ...(input.scheduledFor !== undefined
            ? { scheduledFor: input.scheduledFor }
            : {}),
          ...(input.dueAt !== undefined ? { dueAt: input.dueAt } : {}),
          ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
          ...(input.at !== undefined ? { at: input.at } : {}),
        }),
      ),
    loadTasks: (filters) =>
      withPatchedState(loadTasksSurface(options.platform, filters), (current, tasks) => ({
        ...current,
        tasks,
      })),
    createEvent: (input) =>
      runMutation(
        route<Event>("event.create", {
          title: input.title,
          startAt: input.startAt,
          actor: options.actor,
          ...(input.eventId !== undefined ? { eventId: input.eventId } : {}),
          ...(input.endAt !== undefined ? { endAt: input.endAt } : {}),
          ...(input.at !== undefined ? { at: input.at } : {}),
        }),
      ),
    updateEvent: (input) =>
      runMutation(
        route<Event>("event.update", {
          eventId: input.eventId,
          actor: options.actor,
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.startAt !== undefined ? { startAt: input.startAt } : {}),
          ...(input.endAt !== undefined ? { endAt: input.endAt } : {}),
          ...(input.at !== undefined ? { at: input.at } : {}),
        }),
      ),
    loadEvents: (filters) =>
      withPatchedState(loadEventsSurface(options.platform, filters), (current, events) => ({
        ...current,
        events,
      })),
    createProject: (input) =>
      runMutation(
        route("project.create", {
          name: input.name,
          actor: options.actor,
          ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
          ...(input.description !== undefined
            ? { description: input.description }
            : {}),
          ...(input.at !== undefined ? { at: input.at } : {}),
        }),
      ),
    updateProject: (input) =>
      runMutation(
        route("project.update", {
          projectId: input.projectId,
          actor: options.actor,
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined
            ? { description: input.description }
            : {}),
          ...(input.at !== undefined ? { at: input.at } : {}),
        }),
      ),
    setProjectLifecycle: (input) =>
      runMutation(
        route("project.setLifecycle", {
          projectId: input.projectId,
          lifecycle: input.lifecycle,
          actor: options.actor,
          at: input.at,
        }),
      ),
    loadProjects: (filters) =>
      withPatchedState(loadProjectsSurface(options.platform, filters), (current, projects) => ({
        ...current,
        projects,
      })),
    createNote: (input) =>
      runMutation(
        route("note.create", {
          body: input.body,
          actor: options.actor,
          ...(input.noteId !== undefined ? { noteId: input.noteId } : {}),
          ...(input.linkedEntityRefs !== undefined
            ? { linkedEntityRefs: input.linkedEntityRefs }
            : {}),
          ...(input.at !== undefined ? { at: input.at } : {}),
        }),
      ),
    updateNote: (input) =>
      runMutation(
        route("note.update", {
          noteId: input.noteId,
          body: input.body,
          actor: options.actor,
          at: input.at,
        }),
      ),
    linkNoteEntity: (input) =>
      runMutation(
        route("note.linkEntity", {
          noteId: input.noteId,
          entityRef: input.entityRef,
          actor: options.actor,
          at: input.at,
        }),
      ),
    unlinkNoteEntity: (input) =>
      runMutation(
        route("note.unlinkEntity", {
          noteId: input.noteId,
          entityRef: input.entityRef,
          actor: options.actor,
          at: input.at,
        }),
      ),
    loadNotes: (filters) =>
      withPatchedState(loadNotesSurface(options.platform, filters), (current, notes) => ({
        ...current,
        notes,
      })),
    loadNotifications: (filters) =>
      withPatchedState(
        loadNotificationsSurface(options.platform, filters),
        (current, notifications) => ({
          ...current,
          notifications,
        }),
      ),
    acknowledgeNotification: (input) =>
      runMutation(
        route("notification.acknowledge", {
          notificationId: input.notificationId,
          actor: options.actor,
          at: input.at,
        }),
      ),
    dismissNotification: (input) =>
      runMutation(
        route("notification.dismiss", {
          notificationId: input.notificationId,
          actor: options.actor,
          at: input.at,
        }),
      ),
    search: (input) =>
      withPatchedState(
        Effect.sync(() => {
          searchFilters = {
            query: input.query,
            entityTypes: input.entityTypes ? [...input.entityTypes] : input.entityTypes,
            limit: input.limit,
          };

          return searchFilters;
        }).pipe(Effect.flatMap((filters) => loadSearchSurface(options.platform, filters))),
        (current, search) => ({
          ...current,
          search,
        }),
      ),
    loadSettings: (keys) =>
      withPatchedState(loadSettingsSurface(options.platform, keys), (current, settings) => ({
        ...current,
        settings: keys
          ? {
              values: {
                ...current.settings.values,
                ...settings.values,
              },
            }
          : settings,
      })),
    saveSettings: (input) =>
      withPatchedState(saveSettingsSurface(options.platform, input), (current, settings) => ({
        ...current,
        settings: {
          values: {
            ...current.settings.values,
            ...settings.values,
          },
        },
      })),
    requestEventSync: (input) =>
      runMutation(
        route("approval.requestEventSync", {
          eventId: input.eventId,
          actor: options.actor,
          at: input.at,
        }),
      ),
    requestOutboundDraftExecution: (input) =>
      runMutation(
        route("approval.requestOutboundDraftExecution", {
          draftId: input.draftId,
          actor: options.actor,
          at: input.at,
        }),
      ),
    approveOutboundAction: (input) =>
      runMutation(
        route("approval.approveOutboundAction", {
          actionType: input.actionType,
          entityType: input.entityType,
          entityId: input.entityId,
          approved: input.approved,
          actor: options.actor,
          at: input.at,
        }),
      ),
    createJob: (input) =>
      runMutation(
        route("job.create", {
          jobId: input.jobId,
          name: input.name,
          actor: options.actor,
          at: input.at,
        }),
      ),
    recordJobRun: (input) =>
      runMutation(
        route("job.recordRun", {
          jobId: input.jobId,
          outcome: input.outcome,
          diagnostics: input.diagnostics,
          actor: options.actor,
          at: input.at,
        }),
      ),
    inspectJob: (jobId) => withJobState(inspectJobFromSurface(client, state.jobs, jobId)),
    retryJob: (input) =>
      withJobState(
        retryJobFromSurface(client, state.jobs, {
          jobId: input.jobId,
          fixSummary: input.fixSummary,
          actor: options.actor,
          at: input.at,
        }),
      ),
    createCheckpoint: (input) =>
      runMutation(
        route<Checkpoint>("checkpoint.create", {
          checkpointId: input.checkpointId,
          name: input.name,
          rollbackTarget: input.rollbackTarget,
          auditCursor: input.auditCursor,
          snapshotEntityRefs: input.snapshotEntityRefs ?? [],
          actor: options.actor,
          at: input.at,
        }),
      ),
    inspectCheckpoint: (checkpointId) =>
      withActivityState(
        inspectCheckpointFromActivity(client, state.activity, checkpointId),
      ),
    keepCheckpoint: (input) =>
      withActivityState(
        keepCheckpointFromActivity(client, state.activity, {
          checkpointId: input.checkpointId,
          actor: options.actor,
          at: input.at,
        }),
      ),
    recoverCheckpoint: (input) =>
      withActivityState(
        recoverCheckpointFromActivity(client, state.activity, {
          checkpointId: input.checkpointId,
          actor: options.actor,
          at: input.at,
        }),
      ),
  };
};

const toMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const surfaceSummary = (state: InteractiveWorkflowAppState): string => {
  const plan = summarizePlanStatuses(state.plan.tasks);

  return [
    `Entries: ${state.inbox.entries.length}`,
    `Suggestions: ${state.inbox.suggestions.length}`,
    `Signals: ${state.signals.signals.length}`,
    `Plan(planned/deferred/completed): ${plan.planned}/${plan.deferred}/${plan.completed}`,
    `Tasks: ${state.tasks.tasks.length}`,
    `Events: ${state.events.events.length}`,
    `Projects: ${state.projects.projects.length}`,
    `Notes: ${state.notes.notes.length}`,
    `Notifications: ${state.notifications.notifications.length}`,
    `Search results: ${state.search.results.length}`,
    `Settings: ${Object.keys(state.settings.values).length}`,
    `Pending approvals(event/draft): ${state.pendingEventApprovals.length}/${state.pendingOutboundDraftApprovals.length}`,
    `Jobs: ${state.jobs.jobs.length}`,
    `Activity: ${state.activity.feed.length}`,
  ].join(" | ");
};

const perform = (
  action: () => Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError>,
  setState: (state: InteractiveWorkflowAppState) => void,
  setError: (message: string | undefined) => void,
): void => {
  Effect.runPromise(action())
    .then((next) => {
      setState(next);
      setError(undefined);
    })
    .catch((error: unknown) => {
      setError(toMessage(error));
    });
};

export interface InteractiveWorkflowAppShellProps {
  app: InteractiveWorkflowApp;
}

export const InteractiveWorkflowAppShell = (
  props: InteractiveWorkflowAppShellProps,
): ReactElement => {
  const [state, setState] = useState<InteractiveWorkflowAppState>(() =>
    props.app.getState(),
  );
  const [entryContent, setEntryContent] = useState("Capture from app shell");
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

  useEffect(() => {
    perform(() => props.app.load(), setState, setErrorMessage);
  }, [props.app]);

  const refresh = useCallback(() => {
    perform(() => props.app.load(), setState, setErrorMessage);
  }, [props.app]);

  const capture = useCallback(() => {
    perform(
      () =>
        props.app.captureEntry({
          content: entryContent,
        }),
      setState,
      setErrorMessage,
    );
  }, [entryContent, props.app]);

  return React.createElement(
    "main",
    {
      "aria-label": "interactive-workflow-app-shell",
    },
    React.createElement("h1", null, "Origin App Shell"),
    React.createElement("p", null, surfaceSummary(state)),
    errorMessage
      ? React.createElement(
          "p",
          {
            role: "alert",
          },
          errorMessage,
        )
      : null,
    React.createElement(
      "section",
      {
        "aria-label": "capture-controls",
      },
      React.createElement("label", null, "Quick capture"),
      React.createElement("input", {
        value: entryContent,
        onChange: (event) =>
          setEntryContent((event.target as HTMLInputElement).value),
      }),
      React.createElement(
        "button",
        {
          type: "button",
          onClick: capture,
        },
        "Capture",
      ),
    ),
    React.createElement(
      "section",
      {
        "aria-label": "refresh-controls",
      },
      React.createElement(
        "button",
        {
          type: "button",
          onClick: refresh,
        },
        "Refresh",
      ),
    ),
  );
};

export const createInteractiveWorkflowAppShell = (
  options: MakeInteractiveWorkflowAppOptions,
): ReactElement =>
  React.createElement(InteractiveWorkflowAppShell, {
    app: makeInteractiveWorkflowApp(options),
  });

export const createWorkflowRequestDispatcher = (
  platform: CorePlatform,
): ((request: WorkflowHttpRequest) => Effect.Effect<WorkflowHttpResponse, never>) => {
  const api: WorkflowApi = makeWorkflowApi({ platform });
  return makeWorkflowHttpDispatcher(makeWorkflowRoutes(api));
};

export const selectPendingApprovals = (
  state: InteractiveWorkflowAppState,
): {
  events: ReadonlyArray<Event>;
  outboundDrafts: ReadonlyArray<OutboundDraft>;
} => ({
  events: state.pendingEventApprovals,
  outboundDrafts: state.pendingOutboundDraftApprovals,
});

export const selectActivityCheckpoint = (
  state: InteractiveWorkflowAppState,
): Checkpoint | undefined => state.activity.selectedCheckpoint;

export const selectJobInspection = (
  state: InteractiveWorkflowAppState,
) => state.jobs.inspection;

export const selectJobHistory = (
  state: InteractiveWorkflowAppState,
) => state.jobs.history;

export const selectPlanStatusSummary = (
  state: InteractiveWorkflowAppState,
): {
  planned: number;
  deferred: number;
  completed: number;
} => summarizePlanStatuses(state.plan.tasks);

export const selectActivityFeed = (
  state: InteractiveWorkflowAppState,
): ReadonlyArray<ActivityFeedItem> => state.activity.feed;

export const selectSuggestions = (
  state: InteractiveWorkflowAppState,
): ReadonlyArray<Entry> => state.inbox.suggestions;
