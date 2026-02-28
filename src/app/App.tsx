import { type ReactElement, useEffect, useState } from "react";
import { Effect } from "effect";

import { buildCorePlatform, type CorePlatform } from "../core/app/core-platform";
import { makeInteractiveWorkflowApp } from "./interactive-workflow-app";
import { AppShell } from "./AppShell";

const ACTOR = { id: "user-local", kind: "user" } as const;

export function App(): ReactElement {
  const [app, setApp] = useState<ReturnType<typeof makeInteractiveWorkflowApp> | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let active = true;
    let platformRef: CorePlatform | undefined;

    Effect.runPromise(buildCorePlatform())
      .then((platform) => {
        platformRef = platform;
        if (!active) {
          return;
        }

        const interactiveApp = makeInteractiveWorkflowApp({
          platform,
          actor: ACTOR,
        });

        setApp(interactiveApp);
      })
      .catch((cause: unknown) => {
        if (!active) {
          return;
        }
        setError(cause instanceof Error ? cause.message : String(cause));
      });

    return () => {
      active = false;
      if (platformRef?.close) {
        void Effect.runPromise(platformRef.close());
      }
    };
  }, []);

  if (error) {
    return (
      <main className="app-shell app-shell-error">
        <h1>Origin</h1>
        <p role="alert" className="error-message">
          Failed to initialize app: {error}
        </p>
        <button
          type="button"
          className="btn-primary"
          onClick={() => window.location.reload()}
        >
          Reload Application
        </button>
      </main>
    );
  }

  if (!app) {
    return (
      <main className="app-shell app-shell-loading">
        <h1>Origin</h1>
        <div className="loading-spinner" aria-busy="true" aria-label="Loading">
          <span className="spinner-icon">⟳</span>
        </div>
        <p>Initializing app shell...</p>
      </main>
    );
  }

  return <AppShell app={app} />;
}
