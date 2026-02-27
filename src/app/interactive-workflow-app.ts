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
  jobs: JobsSurfaceState;
  activity: ActivitySurfaceState;
  pendingEventApprovals: ReadonlyArray<Event>;
  pendingOutboundDraftApprovals: ReadonlyArray<OutboundDraft>;
  lastUpdatedAt?: string;
}

export interface InteractiveWorkflowApp {
  getState: () => InteractiveWorkflowAppState;
  load: () => Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError>;
  captureEntry: (input: {
    content: string;
    entryId?: string;
    at?: Date;
  }) => Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError>;
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
      const [inbox, signals, plan, jobs, activity, events, drafts] = yield* Effect.all([
        loadInboxSurface(options.platform),
        loadSignalsSurface(options.platform),
        loadPlanSurface(options.platform),
        loadJobsSurface(client, filtersStore, nextJobsFilters),
        loadActivitySurface(client, filtersStore, nextActivityFilters),
        options.platform.listEntities<Event>("event"),
        options.platform.listEntities<OutboundDraft>("outbound_draft"),
      ]);

      state = withNow({
        inbox,
        signals,
        plan,
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

  const withJobState = (
    effect: Effect.Effect<JobsSurfaceState, unknown>,
  ): Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError> =>
    effect.pipe(
      Effect.map((jobs) => {
        state = withNow({
          ...state,
          jobs,
        });
        return state;
      }),
      Effect.mapError(toAppError),
    );

  const withActivityState = (
    effect: Effect.Effect<ActivitySurfaceState, unknown>,
  ): Effect.Effect<InteractiveWorkflowAppState, InteractiveWorkflowAppError> =>
    effect.pipe(
      Effect.map((activity) => {
        state = withNow({
          ...state,
          activity,
        });
        return state;
      }),
      Effect.mapError(toAppError),
    );

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
