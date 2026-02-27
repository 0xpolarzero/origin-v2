import { describe, expect, test } from "bun:test";

import {
  createShellNavigationState,
  selectNextShellView,
  selectPreviousShellView,
  setActiveShellView,
  SHELL_VIEW_ORDER,
  SHELL_VIEWS,
} from "../../../src/app/shell-navigation";

describe("shell-navigation", () => {
  test("declares required shell views in stable order", () => {
    expect(SHELL_VIEW_ORDER).toEqual([
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
    ]);
    expect(SHELL_VIEWS.map((view) => view.key)).toEqual([...SHELL_VIEW_ORDER]);
  });

  test("falls back to plan when active view is missing or invalid", () => {
    expect(createShellNavigationState().activeView).toBe("plan");
    expect(createShellNavigationState("invalid-view").activeView).toBe("plan");
    expect(createShellNavigationState("jobs").activeView).toBe("jobs");
  });

  test("supports setting active view with invalid-view guard", () => {
    const initial = createShellNavigationState("plan");
    expect(setActiveShellView(initial, "notes").activeView).toBe("notes");
    expect(setActiveShellView(initial, "nope").activeView).toBe("plan");
  });

  test("cycles next/previous across all views", () => {
    const fromActivity = createShellNavigationState("activity");
    expect(selectNextShellView(fromActivity).activeView).toBe("plan");
    expect(selectPreviousShellView(fromActivity).activeView).toBe("settings");

    const fromPlan = createShellNavigationState("plan");
    expect(selectNextShellView(fromPlan).activeView).toBe("inbox");
    expect(selectPreviousShellView(fromPlan).activeView).toBe("activity");
  });
});
