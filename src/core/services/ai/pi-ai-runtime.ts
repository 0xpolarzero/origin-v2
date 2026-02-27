import {
  complete as piComplete,
  getModel as piGetModel,
  type AssistantMessage,
  type Context,
  type KnownProvider,
  type ProviderStreamOptions,
} from "@mariozechner/pi-ai";
import { Effect } from "effect";

import {
  AiRuntimeError,
  type AiTraceMetadata,
  type SuggestRetryFixSummaryInput,
  type SuggestTaskTitleFromEntryInput,
  type WorkflowAiRuntime,
} from "./ai-runtime";

const DEFAULT_PROVIDER: KnownProvider = "openai";
const DEFAULT_MODEL_ID = "gpt-4.1-mini";
const DEFAULT_TEMPERATURE = 0;
const DEFAULT_MAX_TOKENS = 64;
const DEFAULT_TIMEOUT_MS = 15_000;
const AI_RUNTIME_FALLBACK_MESSAGE = "ai runtime request failed";

type GetModelFn = (provider: string, modelId: string) => unknown;
type CompleteFn = (
  model: unknown,
  context: Context,
  options?: ProviderStreamOptions,
) => Promise<AssistantMessage>;

export interface MakePiAiRuntimeOptions {
  provider?: KnownProvider;
  modelId?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  getModel?: GetModelFn;
  complete?: CompleteFn;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeWhitespace = (value: string): string =>
  value.trim().replace(/\s+/g, " ");

const toRuntimeErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (isRecord(error) && typeof error.message === "string") {
    const message = error.message.trim();
    if (message.length > 0) {
      return message;
    }
  }

  return AI_RUNTIME_FALLBACK_MESSAGE;
};

const toRuntimeErrorCode = (error: unknown): "invalid_request" | "unknown" => {
  if (isRecord(error) && typeof error.code === "string") {
    if (error.code === "invalid_request" || error.code === "validation") {
      return "invalid_request";
    }
  }

  return "unknown";
};

const toAiRuntimeError = (
  target: "capture.suggest" | "job.retry",
  error: unknown,
): AiRuntimeError =>
  new AiRuntimeError({
    message: toRuntimeErrorMessage(error),
    code: toRuntimeErrorCode(error),
    target,
    cause: error,
  });

const toAiTraceMetadata = (message: AssistantMessage): AiTraceMetadata => ({
  provider: message.provider,
  model: message.model,
  stopReason: message.stopReason,
  promptTokens: message.usage.input,
  completionTokens: message.usage.output,
  totalTokens: message.usage.totalTokens,
  costUsd: message.usage.cost.total,
});

const toCompletionText = (
  target: "capture.suggest" | "job.retry",
  message: AssistantMessage,
): Effect.Effect<string, AiRuntimeError> => {
  const textBlocks = message.content
    .filter((content) => content.type === "text")
    .map((content) => normalizeWhitespace(content.text))
    .filter((content) => content.length > 0);

  const text = textBlocks.join(" ").trim();
  if (text.length > 0) {
    return Effect.succeed(text);
  }

  return Effect.fail(
    new AiRuntimeError({
      message: "ai runtime returned an empty text response",
      code: "invalid_request",
      target,
    }),
  );
};

const makeTaskTitleContext = (
  input: SuggestTaskTitleFromEntryInput,
): Context => ({
  systemPrompt:
    "You convert captured notes into concise, actionable task titles. Respond with title text only.",
  messages: [
    {
      role: "user",
      content: `Entry ID: ${input.entryId}\nCaptured entry:\n${input.content}\n\nReturn one concise task title.`,
      timestamp: Date.now(),
    },
  ],
});

const makeRetrySummaryContext = (
  input: SuggestRetryFixSummaryInput,
): Context => ({
  systemPrompt:
    "You summarize concrete retry fixes for failed automation jobs. Respond with one concise fix summary sentence.",
  messages: [
    {
      role: "user",
      content: `Job ID: ${input.jobId}\nDiagnostics: ${input.diagnostics ?? "unknown"}\nLast failure reason: ${input.lastFailureReason ?? "unknown"}\n\nReturn one concise retry fix summary.`,
      timestamp: Date.now(),
    },
  ],
});

const makeDeterministicOptions = (
  options: Pick<MakePiAiRuntimeOptions, "temperature" | "maxTokens">,
): ProviderStreamOptions => ({
  temperature: options.temperature ?? DEFAULT_TEMPERATURE,
  maxTokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
});

const resolveTimeoutMs = (timeoutMs: number | undefined): number => {
  if (!Number.isFinite(timeoutMs) || timeoutMs === undefined) {
    return DEFAULT_TIMEOUT_MS;
  }

  if (timeoutMs <= 0) {
    return DEFAULT_TIMEOUT_MS;
  }

  return Math.floor(timeoutMs);
};

export const makePiAiRuntime = (
  options: MakePiAiRuntimeOptions = {},
): WorkflowAiRuntime => {
  const getModel = options.getModel ?? (piGetModel as unknown as GetModelFn);
  const complete = options.complete ?? (piComplete as unknown as CompleteFn);
  const provider = options.provider ?? DEFAULT_PROVIDER;
  const modelId = options.modelId ?? DEFAULT_MODEL_ID;
  const deterministicOptions = makeDeterministicOptions(options);
  const timeoutMs = resolveTimeoutMs(options.timeoutMs);

  const runCompletion = (
    target: "capture.suggest" | "job.retry",
    context: Context,
  ): Effect.Effect<{ text: string; trace: AiTraceMetadata }, AiRuntimeError> =>
    Effect.tryPromise({
      try: (signal) => {
        const model = getModel(provider, modelId);
        return complete(model, context, {
          ...deterministicOptions,
          signal,
        });
      },
      catch: (error) => toAiRuntimeError(target, error),
    }).pipe(
      Effect.timeoutFail({
        duration: `${timeoutMs} millis`,
        onTimeout: () =>
          new AiRuntimeError({
            message: `ai runtime request timed out after ${timeoutMs}ms`,
            code: "unknown",
            target,
          }),
      }),
      Effect.flatMap((completion) =>
        toCompletionText(target, completion).pipe(
          Effect.map((text) => ({
            text,
            trace: toAiTraceMetadata(completion),
          })),
        ),
      ),
    );

  return {
    suggestTaskTitleFromEntry: (input) =>
      runCompletion("capture.suggest", makeTaskTitleContext(input)),
    suggestRetryFixSummary: (input) =>
      runCompletion("job.retry", makeRetrySummaryContext(input)),
  };
};
