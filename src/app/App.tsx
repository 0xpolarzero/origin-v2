import { type ReactElement, useEffect, useState } from "react";
import { Effect } from "effect";

import { buildCorePlatform, type CorePlatform } from "../core/app/core-platform";
import { createInteractiveWorkflowAppShell } from "./interactive-workflow-app";

const ACTOR = { id: "user-local", kind: "user" } as const;

export function App(): ReactElement {
  const [shell, setShell] = useState<ReactElement | undefined>(undefined);
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

        setShell(
          createInteractiveWorkflowAppShell({
            platform,
            actor: ACTOR,
          }),
        );
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
      <main className="app-shell">
        <h1>Origin</h1>
        <p role="alert">Failed to initialize app: {error}</p>
      </main>
    );
  }

  if (!shell) {
    return (
      <main className="app-shell">
        <h1>Origin</h1>
        <p>Initializing app shell...</p>
      </main>
    );
  }

  return shell;
}
