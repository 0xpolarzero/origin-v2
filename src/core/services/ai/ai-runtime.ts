import { Data, Effect } from "effect";

export interface AiTraceMetadata {
  provider: string;
  model: string;
  stopReason?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  costUsd?: number;
}

export const toAiTraceMetadataFields = (
  trace: AiTraceMetadata | undefined,
): Record<string, string> =>
  trace
    ? {
        aiProvider: trace.provider,
        aiModel: trace.model,
        ...(trace.stopReason !== undefined
          ? { aiStopReason: trace.stopReason }
          : {}),
        ...(trace.promptTokens !== undefined
          ? { aiPromptTokens: String(trace.promptTokens) }
          : {}),
        ...(trace.completionTokens !== undefined
          ? { aiCompletionTokens: String(trace.completionTokens) }
          : {}),
        ...(trace.totalTokens !== undefined
          ? { aiTotalTokens: String(trace.totalTokens) }
          : {}),
        ...(trace.costUsd !== undefined
          ? { aiCostUsd: String(trace.costUsd) }
          : {}),
      }
    : {};

export class AiRuntimeError extends Data.TaggedError("AiRuntimeError")<{
  message: string;
  code: "invalid_request" | "unknown";
  target: "capture.suggest" | "job.retry";
  cause?: unknown;
}> {}

export interface SuggestTaskTitleFromEntryInput {
  entryId: string;
  content: string;
}

export interface SuggestRetryFixSummaryInput {
  jobId: string;
  diagnostics?: string;
  lastFailureReason?: string;
}

export interface WorkflowAiRuntime {
  suggestTaskTitleFromEntry: (
    input: SuggestTaskTitleFromEntryInput,
  ) => Effect.Effect<{ text: string; trace: AiTraceMetadata }, AiRuntimeError>;
  suggestRetryFixSummary: (
    input: SuggestRetryFixSummaryInput,
  ) => Effect.Effect<{ text: string; trace: AiTraceMetadata }, AiRuntimeError>;
}
