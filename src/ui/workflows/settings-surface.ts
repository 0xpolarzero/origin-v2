import { Data, Effect } from "effect";

import { Memory } from "../../core/domain/memory";
import { WorkflowSurfaceCorePort } from "./workflow-surface-core-port";

export class SettingsSurfaceError extends Data.TaggedError("SettingsSurfaceError")<{
  message: string;
  cause?: unknown;
}> {}

export type SettingsValue =
  | string
  | number
  | boolean
  | null
  | ReadonlyArray<unknown>
  | Record<string, unknown>;

export interface SettingsSurfaceState {
  values: Readonly<Record<string, SettingsValue>>;
}

export interface SaveSettingsInput {
  values: Record<string, SettingsValue>;
  source?: string;
  confidence?: number;
  at?: Date;
}

const SETTINGS_KEY_PREFIX = "settings.";

const toSettingsSurfaceError = (error: unknown): SettingsSurfaceError =>
  new SettingsSurfaceError({
    message: error instanceof Error ? error.message : String(error),
    cause: error,
  });

const toMemoryKey = (key: string): string => `${SETTINGS_KEY_PREFIX}${key}`;

const fromMemoryKey = (key: string): string =>
  key.startsWith(SETTINGS_KEY_PREFIX) ? key.slice(SETTINGS_KEY_PREFIX.length) : key;

const decodeSettingValue = (value: string): SettingsValue => {
  try {
    return JSON.parse(value) as SettingsValue;
  } catch {
    return value;
  }
};

const encodeSettingValue = (value: SettingsValue): string =>
  typeof value === "string" ? JSON.stringify(value) : JSON.stringify(value);

const toSettingsState = (
  memories: ReadonlyArray<Memory>,
  keys?: ReadonlyArray<string>,
): SettingsSurfaceState => {
  const expectedKeys = keys ? new Set(keys) : undefined;
  const values: Record<string, SettingsValue> = {};

  for (const memory of memories) {
    if (!memory.key.startsWith(SETTINGS_KEY_PREFIX)) {
      continue;
    }

    const key = fromMemoryKey(memory.key);
    if (expectedKeys && !expectedKeys.has(key)) {
      continue;
    }

    values[key] = decodeSettingValue(memory.value);
  }

  return { values };
};

export const loadSettingsSurface = (
  port: WorkflowSurfaceCorePort,
  keys?: ReadonlyArray<string>,
): Effect.Effect<SettingsSurfaceState, SettingsSurfaceError> =>
  port.listEntities<Memory>("memory").pipe(
    Effect.map((memories) => toSettingsState(memories, keys)),
    Effect.mapError(toSettingsSurfaceError),
  );

export const saveSettingsSurface = (
  port: WorkflowSurfaceCorePort,
  input: SaveSettingsInput,
): Effect.Effect<SettingsSurfaceState, SettingsSurfaceError> =>
  Effect.gen(function* () {
    const source = input.source ?? "ui:settings-surface";
    const confidence = input.confidence ?? 1;
    const entries = Object.entries(input.values);

    yield* Effect.forEach(entries, ([key, value]) =>
      port.upsertMemory({
        key: toMemoryKey(key),
        value: encodeSettingValue(value),
        source,
        confidence,
        at: input.at,
      }),
    );

    return yield* loadSettingsSurface(
      port,
      entries.map(([key]) => key),
    );
  }).pipe(Effect.mapError(toSettingsSurfaceError));
