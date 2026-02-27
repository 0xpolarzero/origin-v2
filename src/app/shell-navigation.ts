export const SHELL_VIEW_ORDER = [
  "plan",
  "inbox",
  "tasks",
  "events",
  "projects",
  "notes",
  "signals",
  "jobs",
  "notifications",
  "search",
  "settings",
  "activity",
] as const;

export type ShellViewKey = (typeof SHELL_VIEW_ORDER)[number];

export interface ShellViewDefinition {
  key: ShellViewKey;
  label: string;
}

export const SHELL_VIEWS: ReadonlyArray<ShellViewDefinition> = [
  { key: "plan", label: "Plan" },
  { key: "inbox", label: "Inbox" },
  { key: "tasks", label: "Tasks" },
  { key: "events", label: "Events" },
  { key: "projects", label: "Projects" },
  { key: "notes", label: "Notes" },
  { key: "signals", label: "Signals" },
  { key: "jobs", label: "Jobs" },
  { key: "notifications", label: "Notifications" },
  { key: "search", label: "Search" },
  { key: "settings", label: "Settings" },
  { key: "activity", label: "Activity" },
];

export interface ShellNavigationState {
  activeView: ShellViewKey;
}

const fallbackView: ShellViewKey = "plan";

const isShellViewKey = (value: string): value is ShellViewKey =>
  (SHELL_VIEW_ORDER as ReadonlyArray<string>).includes(value);

export const createShellNavigationState = (
  activeView: string | undefined = fallbackView,
): ShellNavigationState => {
  const resolvedActiveView = activeView ?? fallbackView;

  return {
    activeView: isShellViewKey(resolvedActiveView)
      ? resolvedActiveView
      : fallbackView,
  };
};

export const setActiveShellView = (
  state: ShellNavigationState,
  view: string,
): ShellNavigationState => ({
  activeView: isShellViewKey(view) ? view : state.activeView,
});

export const selectNextShellView = (
  state: ShellNavigationState,
): ShellNavigationState => {
  const index = SHELL_VIEW_ORDER.indexOf(state.activeView);
  if (index < 0) {
    return {
      activeView: fallbackView,
    };
  }

  const nextIndex = (index + 1) % SHELL_VIEW_ORDER.length;
  const next = SHELL_VIEW_ORDER[nextIndex];
  if (!next) {
    return {
      activeView: fallbackView,
    };
  }

  return {
    activeView: next,
  };
};

export const selectPreviousShellView = (
  state: ShellNavigationState,
): ShellNavigationState => {
  const index = SHELL_VIEW_ORDER.indexOf(state.activeView);
  if (index < 0) {
    return {
      activeView: fallbackView,
    };
  }

  const previousIndex =
    index === 0 ? SHELL_VIEW_ORDER.length - 1 : index - 1;
  const previous = SHELL_VIEW_ORDER[previousIndex];
  if (!previous) {
    return {
      activeView: fallbackView,
    };
  }

  return {
    activeView: previous,
  };
};
