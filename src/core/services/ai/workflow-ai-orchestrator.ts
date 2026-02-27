import type { KnownProvider } from "@mariozechner/pi-ai";
import { Effect } from "effect";

import { CoreRepository } from "../../repositories/core-repository";
import {
  AiRuntimeError,
  toAiTraceMetadataFields,
  type WorkflowAiRuntime,
} from "./ai-runtime";

const AI_SETTINGS_PREFIX = "settings.ai.";
const AI_ENABLED_KEY = `${AI_SETTINGS_PREFIX}enabled`;
const AI_PROVIDER_KEY = `${AI_SETTINGS_PREFIX}provider`;
const AI_MODEL_KEY = `${AI_SETTINGS_PREFIX}model`;
const AI_MODEL_ID_KEY = `${AI_SETTINGS_PREFIX}modelId`;
const AI_MAX_TOKENS_KEY = `${AI_SETTINGS_PREFIX}maxTokens`;
const AI_TIMEOUT_MS_KEY = `${AI_SETTINGS_PREFIX}timeoutMs`;
const AI_TEMPERATURE_KEY = `${AI_SETTINGS_PREFIX}temperature`;

const FALLBACK_ENTRY_SUGGESTION = "Review captured entry";
const FALLBACK_RETRY_FIX_SUMMARY = "Investigate the failure cause and retry safely.";

const KNOWN_PROVIDERS: ReadonlyArray<KnownProvider> = [
  "amazon-bedrock",
  "anthropic",
  "google",
  "google-gemini-cli",
  "google-antigravity",
  "google-vertex",
  "openai",
  "azure-openai-responses",
  "openai-codex",
  "github-copilot",
  "xai",
  "groq",
  "cerebras",
  "openrouter",
  "vercel-ai-gateway",
  "zai",
  "mistral",
  "minimax",
  "minimax-cn",
  "huggingface",
  "opencode",
  "kimi-coding",
];

const DEFAULT_AI_RUNTIME_CONFIG: WorkflowAiRuntimeConfig = {
  enabled: false,
  provider: "openai",
  modelId: "gpt-4.1-mini",
  temperature: 0,
  maxTokens: 64,
  timeoutMs: 15_000,
};
const PI_AI_RUNTIME_MODULE_PATH = "./pi-ai-runtime";
type PiAiRuntimeModule = typeof import("./pi-ai-runtime");

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeWhitespace = (value: string): string =>
  value.trim().replace(/\s+/g, " ");

const truncate = (value: string, maxLength: number): string => {
  const boundedMaxLength = Math.max(0, Math.floor(maxLength));
  if (value.length <= boundedMaxLength) {
    return value;
  }
  if (boundedMaxLength <= 3) {
    return value.slice(0, boundedMaxLength);
  }

  return `${value.slice(0, boundedMaxLength - 3).trimEnd()}...`;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const toOptionalNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = normalizeWhitespace(value);
  return normalized.length > 0 ? normalized : undefined;
};

const toOptionalNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const toOptionalBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value !== 0;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "off"].includes(normalized)) {
    return false;
  }

  return undefined;
};

const decodeStoredSetting = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const toKnownProvider = (value: unknown): KnownProvider | undefined => {
  const provider = toOptionalNonEmptyString(value);
  if (!provider) {
    return undefined;
  }

  return KNOWN_PROVIDERS.find((candidate) => candidate === provider);
};

const toRuntimeConfigMetadata = (
  config: WorkflowAiRuntimeConfig,
): Record<string, string> => ({
  aiConfiguredProvider: config.provider,
  aiConfiguredModel: config.modelId,
  aiConfiguredTemperature: String(config.temperature),
  aiConfiguredMaxTokens: String(config.maxTokens),
  aiConfiguredTimeoutMs: String(config.timeoutMs),
});

const deriveFallbackEntrySuggestion = (content: string): string => {
  const normalized = normalizeWhitespace(content);
  if (normalized.length === 0) {
    return FALLBACK_ENTRY_SUGGESTION;
  }

  const withoutTrailingPunctuation = normalized.replace(/[.!?,;:]+$/g, "");
  const words = withoutTrailingPunctuation
    .split(" ")
    .filter((word) => word.length > 0)
    .slice(0, 8);
  const fallback = words.join(" ").trim();

  return fallback.length > 0 ? fallback : FALLBACK_ENTRY_SUGGESTION;
};

const deriveFallbackRetryFixSummary = (input: {
  diagnostics?: string;
  lastFailureReason?: string;
}): string => {
  const candidate = normalizeWhitespace(
    input.lastFailureReason ?? input.diagnostics ?? "",
  );
  if (candidate.length === 0) {
    return FALLBACK_RETRY_FIX_SUMMARY;
  }

  return `Investigate and address: ${truncate(candidate, 96)}`;
};

const toFallbackReason = (error: AiRuntimeError): string =>
  error.message.toLowerCase().includes("timed out")
    ? "runtime_timeout"
    : "runtime_error";

interface LoadedAiRuntimeConfig {
  config: WorkflowAiRuntimeConfig;
  invalidProvider?: string;
}

const loadAiRuntimeConfig = (
  repository: CoreRepository,
): Effect.Effect<LoadedAiRuntimeConfig> =>
  Effect.gen(function* () {
    const memories = yield* repository.listEntities<unknown>("memory");
    const settings = new Map<string, unknown>();

    for (const memory of memories) {
      if (!isRecord(memory)) {
        continue;
      }

      const key = memory.key;
      const rawValue = memory.value;
      if (typeof key !== "string" || typeof rawValue !== "string") {
        continue;
      }
      if (!key.startsWith(AI_SETTINGS_PREFIX)) {
        continue;
      }

      settings.set(key, decodeStoredSetting(rawValue));
    }

    const enabled =
      toOptionalBoolean(settings.get(AI_ENABLED_KEY)) ??
      DEFAULT_AI_RUNTIME_CONFIG.enabled;
    const configuredProvider = toOptionalNonEmptyString(
      settings.get(AI_PROVIDER_KEY),
    );
    const knownProvider = toKnownProvider(configuredProvider);
    const provider =
      knownProvider ?? DEFAULT_AI_RUNTIME_CONFIG.provider;
    const modelId =
      toOptionalNonEmptyString(settings.get(AI_MODEL_KEY)) ??
      toOptionalNonEmptyString(settings.get(AI_MODEL_ID_KEY)) ??
      DEFAULT_AI_RUNTIME_CONFIG.modelId;
    const temperature = clamp(
      toOptionalNumber(settings.get(AI_TEMPERATURE_KEY)) ??
        DEFAULT_AI_RUNTIME_CONFIG.temperature,
      0,
      1,
    );
    const maxTokens = Math.floor(
      clamp(
        toOptionalNumber(settings.get(AI_MAX_TOKENS_KEY)) ??
          DEFAULT_AI_RUNTIME_CONFIG.maxTokens,
        1,
        4_096,
      ),
    );
    const timeoutMs = Math.floor(
      clamp(
        toOptionalNumber(settings.get(AI_TIMEOUT_MS_KEY)) ??
          DEFAULT_AI_RUNTIME_CONFIG.timeoutMs,
        250,
        120_000,
      ),
    );

    return {
      config: {
        enabled,
        provider,
        modelId,
        temperature,
        maxTokens,
        timeoutMs,
      },
      invalidProvider:
        configuredProvider !== undefined && knownProvider === undefined
          ? configuredProvider
          : undefined,
    };
  });

export interface WorkflowAiRuntimeConfig {
  enabled: boolean;
  provider: KnownProvider;
  modelId: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
}

export interface ResolveEntrySuggestionInput {
  entryId: string;
  content: string;
  suggestedTitle?: string;
  aiAssist?: boolean;
}

export interface ResolveRetryFixSummaryInput {
  jobId: string;
  diagnostics?: string;
  lastFailureReason?: string;
  fixSummary?: string;
}

export interface WorkflowAiResolution {
  text: string;
  metadata: Record<string, string>;
}

export interface WorkflowAiOrchestrator {
  resolveEntrySuggestion: (
    input: ResolveEntrySuggestionInput,
  ) => Effect.Effect<WorkflowAiResolution>;
  resolveRetryFixSummary: (
    input: ResolveRetryFixSummaryInput,
  ) => Effect.Effect<WorkflowAiResolution>;
}

export interface MakeWorkflowAiOrchestratorOptions {
  repository: CoreRepository;
  runtime?: WorkflowAiRuntime;
  makeRuntime?: (
    config: WorkflowAiRuntimeConfig,
  ) => WorkflowAiRuntime | Promise<WorkflowAiRuntime>;
}

export const makeWorkflowAiOrchestrator = (
  options: MakeWorkflowAiOrchestratorOptions,
): WorkflowAiOrchestrator => {
  const makeDefaultRuntime = async (
    config: WorkflowAiRuntimeConfig,
  ): Promise<WorkflowAiRuntime> => {
    const runtimeModule = (await import(
      /* @vite-ignore */
      PI_AI_RUNTIME_MODULE_PATH
    )) as PiAiRuntimeModule;

    return runtimeModule.makePiAiRuntime({
      provider: config.provider,
      modelId: config.modelId,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      timeoutMs: config.timeoutMs,
    });
  };

  const makeRuntime =
    options.makeRuntime ??
    makeDefaultRuntime;

  const resolveRuntime = (
    config: WorkflowAiRuntimeConfig,
  ): Effect.Effect<{ runtime?: WorkflowAiRuntime; initError?: unknown }> => {
    if (options.runtime) {
      return Effect.succeed({ runtime: options.runtime });
    }

    return Effect.tryPromise({
      try: () => Promise.resolve(makeRuntime(config)),
      catch: (error) => error,
    }).pipe(
      Effect.map((runtime): { runtime: WorkflowAiRuntime } => ({ runtime })),
      Effect.catchAll((initError) => Effect.succeed({ initError })),
    );
  };

  const resolveEntrySuggestion = (
    input: ResolveEntrySuggestionInput,
  ): Effect.Effect<WorkflowAiResolution> => {
    const explicitTitle = toOptionalNonEmptyString(input.suggestedTitle);
    if (input.aiAssist !== true && explicitTitle) {
      return Effect.succeed({
        text: explicitTitle,
        metadata: {
          aiResolution: "manual",
        },
      });
    }

    const fallbackTitle =
      explicitTitle ?? deriveFallbackEntrySuggestion(input.content);
    const shouldAttemptAi =
      input.aiAssist !== false &&
      (input.aiAssist === true || explicitTitle === undefined);

    return loadAiRuntimeConfig(options.repository).pipe(
      Effect.flatMap(({ config, invalidProvider }) => {
        const baseMetadata = {
          ...toRuntimeConfigMetadata(config),
          ...(invalidProvider
            ? {
                aiConfiguredProviderRaw: invalidProvider,
                aiConfiguredProviderInvalid: "true",
              }
            : {}),
        };
        if (!shouldAttemptAi || !config.enabled) {
          return Effect.succeed({
            text: fallbackTitle,
            metadata: {
              ...baseMetadata,
              aiResolution: "fallback",
              aiRuntimeEnabled: "false",
              aiFallbackReason: "runtime_disabled",
            },
          });
        }

        if (invalidProvider) {
          return Effect.succeed({
            text: fallbackTitle,
            metadata: {
              ...baseMetadata,
              aiResolution: "fallback",
              aiRuntimeEnabled: "false",
              aiFallbackReason: "runtime_invalid_provider",
            },
          });
        }

        return resolveRuntime(config).pipe(
          Effect.flatMap((runtimeResolution) => {
            if (!runtimeResolution.runtime) {
              return Effect.succeed({
                text: fallbackTitle,
                metadata: {
                  ...baseMetadata,
                  aiResolution: "fallback",
                  aiRuntimeEnabled: "true",
                  aiFallbackReason: "runtime_init_error",
                },
              });
            }

            return runtimeResolution.runtime
              .suggestTaskTitleFromEntry({
                entryId: input.entryId,
                content: input.content,
              })
              .pipe(
                Effect.match({
                  onSuccess: (response): WorkflowAiResolution => {
                    const normalizedText = normalizeWhitespace(response.text);
                    if (normalizedText.length === 0) {
                      return {
                        text: fallbackTitle,
                        metadata: {
                          ...baseMetadata,
                          aiResolution: "fallback",
                          aiRuntimeEnabled: "true",
                          aiFallbackReason: "runtime_invalid_output",
                          ...toAiTraceMetadataFields(response.trace),
                        },
                      };
                    }

                    return {
                      text: normalizedText,
                      metadata: {
                        ...baseMetadata,
                        aiResolution: "runtime",
                        aiRuntimeEnabled: "true",
                        ...toAiTraceMetadataFields(response.trace),
                      },
                    };
                  },
                  onFailure: (error): WorkflowAiResolution => ({
                    text: fallbackTitle,
                    metadata: {
                      ...baseMetadata,
                      aiResolution: "fallback",
                      aiRuntimeEnabled: "true",
                      aiFallbackReason: toFallbackReason(error),
                      aiErrorCode: error.code,
                    },
                  }),
                }),
              );
          }),
        );
      }),
    );
  };

  const resolveRetryFixSummary = (
    input: ResolveRetryFixSummaryInput,
  ): Effect.Effect<WorkflowAiResolution> => {
    const explicitFixSummary = toOptionalNonEmptyString(input.fixSummary);
    if (explicitFixSummary) {
      return Effect.succeed({
        text: explicitFixSummary,
        metadata: {
          aiResolution: "manual",
        },
      });
    }

    const fallbackSummary = deriveFallbackRetryFixSummary(input);

    return loadAiRuntimeConfig(options.repository).pipe(
      Effect.flatMap(({ config, invalidProvider }) => {
        const baseMetadata = {
          ...toRuntimeConfigMetadata(config),
          ...(invalidProvider
            ? {
                aiConfiguredProviderRaw: invalidProvider,
                aiConfiguredProviderInvalid: "true",
              }
            : {}),
        };
        if (!config.enabled) {
          return Effect.succeed({
            text: fallbackSummary,
            metadata: {
              ...baseMetadata,
              aiResolution: "fallback",
              aiRuntimeEnabled: "false",
              aiFallbackReason: "runtime_disabled",
            },
          });
        }

        if (invalidProvider) {
          return Effect.succeed({
            text: fallbackSummary,
            metadata: {
              ...baseMetadata,
              aiResolution: "fallback",
              aiRuntimeEnabled: "false",
              aiFallbackReason: "runtime_invalid_provider",
            },
          });
        }

        return resolveRuntime(config).pipe(
          Effect.flatMap((runtimeResolution) => {
            if (!runtimeResolution.runtime) {
              return Effect.succeed({
                text: fallbackSummary,
                metadata: {
                  ...baseMetadata,
                  aiResolution: "fallback",
                  aiRuntimeEnabled: "true",
                  aiFallbackReason: "runtime_init_error",
                },
              });
            }

            return runtimeResolution.runtime
              .suggestRetryFixSummary({
                jobId: input.jobId,
                diagnostics: input.diagnostics,
                lastFailureReason: input.lastFailureReason,
              })
              .pipe(
                Effect.match({
                  onSuccess: (response): WorkflowAiResolution => {
                    const normalizedText = normalizeWhitespace(response.text);
                    if (normalizedText.length === 0) {
                      return {
                        text: fallbackSummary,
                        metadata: {
                          ...baseMetadata,
                          aiResolution: "fallback",
                          aiRuntimeEnabled: "true",
                          aiFallbackReason: "runtime_invalid_output",
                          ...toAiTraceMetadataFields(response.trace),
                        },
                      };
                    }

                    return {
                      text: normalizedText,
                      metadata: {
                        ...baseMetadata,
                        aiResolution: "runtime",
                        aiRuntimeEnabled: "true",
                        ...toAiTraceMetadataFields(response.trace),
                      },
                    };
                  },
                  onFailure: (error): WorkflowAiResolution => ({
                    text: fallbackSummary,
                    metadata: {
                      ...baseMetadata,
                      aiResolution: "fallback",
                      aiRuntimeEnabled: "true",
                      aiFallbackReason: toFallbackReason(error),
                      aiErrorCode: error.code,
                    },
                  }),
                }),
              );
          }),
        );
      }),
    );
  };

  return {
    resolveEntrySuggestion,
    resolveRetryFixSummary,
  };
};
