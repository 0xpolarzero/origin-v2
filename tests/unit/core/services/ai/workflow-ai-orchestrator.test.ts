import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { makeInMemoryCoreRepository } from "../../../../../src/core/repositories/in-memory-core-repository";
import { upsertMemory } from "../../../../../src/core/services/memory-service";
import {
  AiRuntimeError,
  type WorkflowAiRuntime,
} from "../../../../../src/core/services/ai/ai-runtime";
import { makeWorkflowAiOrchestrator } from "../../../../../src/core/services/ai/workflow-ai-orchestrator";

const writeAiSetting = (
  repository: ReturnType<typeof makeInMemoryCoreRepository>,
  key: string,
  value: unknown,
) =>
  upsertMemory(repository, {
    key: `settings.ai.${key}`,
    value: JSON.stringify(value),
    source: "test:workflow-ai-orchestrator",
    confidence: 1,
    at: new Date("2026-02-23T00:00:00.000Z"),
  });

describe("core/services/ai/workflow-ai-orchestrator", () => {
  test("returns manual entry suggestion when explicit title is provided without aiAssist", async () => {
    const repository = makeInMemoryCoreRepository();
    const orchestrator = makeWorkflowAiOrchestrator({ repository });

    const result = await Effect.runPromise(
      orchestrator.resolveEntrySuggestion({
        entryId: "entry-orchestrator-1",
        content: "Capture content",
        suggestedTitle: "Manual suggested title",
      }),
    );

    expect(result).toEqual({
      text: "Manual suggested title",
      metadata: {
        aiResolution: "manual",
      },
    });
  });

  test("does not call runtime when aiAssist is false and suggestedTitle is omitted", async () => {
    const repository = makeInMemoryCoreRepository();
    await Effect.runPromise(writeAiSetting(repository, "enabled", true));
    let runtimeCallCount = 0;

    const runtime: WorkflowAiRuntime = {
      suggestTaskTitleFromEntry: () =>
        Effect.sync(() => {
          runtimeCallCount += 1;
          return {
            text: "Runtime generated title",
            trace: {
              provider: "openai",
              model: "gpt-4.1-mini",
            },
          };
        }),
      suggestRetryFixSummary: () => Effect.die("unused"),
    };

    const orchestrator = makeWorkflowAiOrchestrator({
      repository,
      runtime,
    });

    const result = await Effect.runPromise(
      orchestrator.resolveEntrySuggestion({
        entryId: "entry-orchestrator-aiassist-false-1",
        content: "  Follow up with legal on contract review soon. ",
        aiAssist: false,
      }),
    );

    expect(runtimeCallCount).toBe(0);
    expect(result.text).toBe("Follow up with legal on contract review soon");
    expect(result.metadata).toMatchObject({
      aiResolution: "fallback",
      aiRuntimeEnabled: "false",
      aiFallbackReason: "runtime_disabled",
    });
  });

  test("preserves caller title when aiAssist is true and runtime is disabled", async () => {
    const repository = makeInMemoryCoreRepository();
    const orchestrator = makeWorkflowAiOrchestrator({ repository });

    const result = await Effect.runPromise(
      orchestrator.resolveEntrySuggestion({
        entryId: "entry-orchestrator-title-preserve-disabled-1",
        content: "Derived content should not replace caller title",
        suggestedTitle: "Caller provided title",
        aiAssist: true,
      }),
    );

    expect(result.text).toBe("Caller provided title");
    expect(result.metadata).toMatchObject({
      aiResolution: "fallback",
      aiRuntimeEnabled: "false",
      aiFallbackReason: "runtime_disabled",
    });
  });

  test("preserves caller title when runtime errors while aiAssist is true", async () => {
    const repository = makeInMemoryCoreRepository();
    await Effect.runPromise(writeAiSetting(repository, "enabled", true));

    const runtime: WorkflowAiRuntime = {
      suggestTaskTitleFromEntry: () =>
        Effect.fail(
          new AiRuntimeError({
            message: "provider unavailable",
            code: "unknown",
            target: "capture.suggest",
          }),
        ),
      suggestRetryFixSummary: () => Effect.die("unused"),
    };

    const orchestrator = makeWorkflowAiOrchestrator({
      repository,
      runtime,
    });

    const result = await Effect.runPromise(
      orchestrator.resolveEntrySuggestion({
        entryId: "entry-orchestrator-title-preserve-error-1",
        content: "Derived content should not replace caller title",
        suggestedTitle: "Caller provided title",
        aiAssist: true,
      }),
    );

    expect(result.text).toBe("Caller provided title");
    expect(result.metadata).toMatchObject({
      aiResolution: "fallback",
      aiRuntimeEnabled: "true",
      aiFallbackReason: "runtime_error",
      aiErrorCode: "unknown",
    });
  });

  test("preserves caller title when runtime output is invalid while aiAssist is true", async () => {
    const repository = makeInMemoryCoreRepository();
    await Effect.runPromise(writeAiSetting(repository, "enabled", true));

    const runtime: WorkflowAiRuntime = {
      suggestTaskTitleFromEntry: () =>
        Effect.succeed({
          text: " \n\t ",
          trace: {
            provider: "openai",
            model: "gpt-4.1-mini",
          },
        }),
      suggestRetryFixSummary: () => Effect.die("unused"),
    };

    const orchestrator = makeWorkflowAiOrchestrator({
      repository,
      runtime,
    });

    const result = await Effect.runPromise(
      orchestrator.resolveEntrySuggestion({
        entryId: "entry-orchestrator-title-preserve-invalid-1",
        content: "Derived content should not replace caller title",
        suggestedTitle: "Caller provided title",
        aiAssist: true,
      }),
    );

    expect(result.text).toBe("Caller provided title");
    expect(result.metadata).toMatchObject({
      aiResolution: "fallback",
      aiRuntimeEnabled: "true",
      aiFallbackReason: "runtime_invalid_output",
      aiProvider: "openai",
      aiModel: "gpt-4.1-mini",
    });
  });

  test("fails closed when configured provider is invalid and does not create runtime", async () => {
    const repository = makeInMemoryCoreRepository();
    await Effect.runPromise(writeAiSetting(repository, "enabled", true));
    await Effect.runPromise(writeAiSetting(repository, "provider", "not-a-provider"));
    let makeRuntimeCallCount = 0;
    let runtimeCallCount = 0;

    const orchestrator = makeWorkflowAiOrchestrator({
      repository,
      makeRuntime: () => {
        makeRuntimeCallCount += 1;
        return {
          suggestTaskTitleFromEntry: () =>
            Effect.sync(() => {
              runtimeCallCount += 1;
              return {
                text: "Runtime generated title",
                trace: {
                  provider: "openai",
                  model: "gpt-4.1-mini",
                },
              };
            }),
          suggestRetryFixSummary: () => Effect.die("unused"),
        };
      },
    });

    const result = await Effect.runPromise(
      orchestrator.resolveEntrySuggestion({
        entryId: "entry-orchestrator-invalid-provider-1",
        content: "Follow up with legal on contract review soon.",
        aiAssist: true,
      }),
    );

    expect(makeRuntimeCallCount).toBe(0);
    expect(runtimeCallCount).toBe(0);
    expect(result.text).toBe("Follow up with legal on contract review soon");
    expect(result.metadata).toMatchObject({
      aiResolution: "fallback",
      aiRuntimeEnabled: "false",
      aiFallbackReason: "runtime_invalid_provider",
      aiConfiguredProviderRaw: "not-a-provider",
      aiConfiguredProviderInvalid: "true",
    });
  });

  test("loads runtime settings from memory and uses runtime when enabled", async () => {
    const repository = makeInMemoryCoreRepository();
    const runtimeCalls: Array<{ entryId: string; content: string }> = [];
    const capturedConfigs: Array<{
      enabled: boolean;
      provider: string;
      modelId: string;
      temperature: number;
      maxTokens: number;
      timeoutMs: number;
    }> = [];

    await Effect.runPromise(writeAiSetting(repository, "enabled", true));
    await Effect.runPromise(writeAiSetting(repository, "provider", "openai"));
    await Effect.runPromise(writeAiSetting(repository, "model", "gpt-5-mini"));
    await Effect.runPromise(writeAiSetting(repository, "temperature", 0.1));
    await Effect.runPromise(writeAiSetting(repository, "maxTokens", 128));
    await Effect.runPromise(writeAiSetting(repository, "timeoutMs", 2_500));

    const runtime: WorkflowAiRuntime = {
      suggestTaskTitleFromEntry: (input) =>
        Effect.sync(() => {
          runtimeCalls.push(input);
          return {
            text: "Runtime generated title",
            trace: {
              provider: "openai",
              model: "gpt-5-mini",
              promptTokens: 11,
              completionTokens: 7,
              totalTokens: 18,
              costUsd: 0.001,
            },
          };
        }),
      suggestRetryFixSummary: () => Effect.die("unused"),
    };

    const orchestrator = makeWorkflowAiOrchestrator({
      repository,
      makeRuntime: (config) => {
        capturedConfigs.push(config);
        return runtime;
      },
    });

    const result = await Effect.runPromise(
      orchestrator.resolveEntrySuggestion({
        entryId: "entry-orchestrator-2",
        content: "Prepare launch notes",
        aiAssist: true,
      }),
    );

    expect(runtimeCalls).toEqual([
      { entryId: "entry-orchestrator-2", content: "Prepare launch notes" },
    ]);
    expect(capturedConfigs).toEqual([
      {
        enabled: true,
        provider: "openai",
        modelId: "gpt-5-mini",
        temperature: 0.1,
        maxTokens: 128,
        timeoutMs: 2500,
      },
    ]);
    expect(result.metadata).toMatchObject({
      aiResolution: "runtime",
      aiRuntimeEnabled: "true",
      aiProvider: "openai",
      aiModel: "gpt-5-mini",
      aiPromptTokens: "11",
      aiCompletionTokens: "7",
      aiTotalTokens: "18",
      aiCostUsd: "0.001",
    });
  });

  test("falls back deterministically when runtime initialization fails asynchronously", async () => {
    const repository = makeInMemoryCoreRepository();
    await Effect.runPromise(writeAiSetting(repository, "enabled", true));

    const orchestrator = makeWorkflowAiOrchestrator({
      repository,
      makeRuntime: async () => {
        throw new Error("lazy runtime import failed");
      },
    });

    const result = await Effect.runPromise(
      orchestrator.resolveEntrySuggestion({
        entryId: "entry-orchestrator-runtime-init-error-1",
        content: "  Follow up with legal on contract review soon. ",
        aiAssist: true,
      }),
    );

    expect(result.text).toBe("Follow up with legal on contract review soon");
    expect(result.metadata).toMatchObject({
      aiResolution: "fallback",
      aiRuntimeEnabled: "true",
      aiFallbackReason: "runtime_init_error",
    });
  });

  test("falls back deterministically and maps runtime errors when enabled runtime fails", async () => {
    const repository = makeInMemoryCoreRepository();
    await Effect.runPromise(writeAiSetting(repository, "enabled", true));

    const runtime: WorkflowAiRuntime = {
      suggestTaskTitleFromEntry: () =>
        Effect.fail(
          new AiRuntimeError({
            message: "provider request timed out after 2500ms",
            code: "unknown",
            target: "capture.suggest",
          }),
        ),
      suggestRetryFixSummary: () => Effect.die("unused"),
    };

    const orchestrator = makeWorkflowAiOrchestrator({
      repository,
      runtime,
    });

    const result = await Effect.runPromise(
      orchestrator.resolveEntrySuggestion({
        entryId: "entry-orchestrator-3",
        content: "  Follow up with legal on contract review soon. ",
        aiAssist: true,
      }),
    );

    expect(result.text).toBe("Follow up with legal on contract review soon");
    expect(result.metadata).toMatchObject({
      aiResolution: "fallback",
      aiRuntimeEnabled: "true",
      aiFallbackReason: "runtime_timeout",
      aiErrorCode: "unknown",
    });
  });

  test("falls back when runtime entry suggestion normalizes to empty output", async () => {
    const repository = makeInMemoryCoreRepository();
    await Effect.runPromise(writeAiSetting(repository, "enabled", true));

    const runtime: WorkflowAiRuntime = {
      suggestTaskTitleFromEntry: () =>
        Effect.succeed({
          text: "   ",
          trace: {
            provider: "openai",
            model: "gpt-4.1-mini",
          },
        }),
      suggestRetryFixSummary: () => Effect.die("unused"),
    };

    const orchestrator = makeWorkflowAiOrchestrator({
      repository,
      runtime,
    });

    const result = await Effect.runPromise(
      orchestrator.resolveEntrySuggestion({
        entryId: "entry-orchestrator-empty-1",
        content: "  Follow up with legal on contract review soon. ",
        aiAssist: true,
      }),
    );

    expect(result.text).toBe("Follow up with legal on contract review soon");
    expect(result.metadata).toMatchObject({
      aiResolution: "fallback",
      aiRuntimeEnabled: "true",
      aiFallbackReason: "runtime_invalid_output",
      aiProvider: "openai",
      aiModel: "gpt-4.1-mini",
    });
  });

  test("keeps runtime disabled by default and returns deterministic fallback", async () => {
    const repository = makeInMemoryCoreRepository();
    const orchestrator = makeWorkflowAiOrchestrator({ repository });

    const result = await Effect.runPromise(
      orchestrator.resolveRetryFixSummary({
        jobId: "job-orchestrator-1",
        diagnostics: "Provider timeout",
      }),
    );

    expect(result.text).toBe("Investigate and address: Provider timeout");
    expect(result.metadata).toMatchObject({
      aiResolution: "fallback",
      aiRuntimeEnabled: "false",
      aiFallbackReason: "runtime_disabled",
      aiConfiguredProvider: "openai",
      aiConfiguredModel: "gpt-4.1-mini",
    });
  });

  test("uses runtime for retry fix summary when enabled and fixSummary is omitted", async () => {
    const repository = makeInMemoryCoreRepository();
    await Effect.runPromise(writeAiSetting(repository, "enabled", true));
    await Effect.runPromise(writeAiSetting(repository, "modelId", "gpt-4.1-mini"));

    const runtime: WorkflowAiRuntime = {
      suggestTaskTitleFromEntry: () => Effect.die("unused"),
      suggestRetryFixSummary: () =>
        Effect.succeed({
          text: "Increase timeout and retry with bounded backoff",
          trace: {
            provider: "openai",
            model: "gpt-4.1-mini",
            stopReason: "stop",
            promptTokens: 20,
            completionTokens: 9,
            totalTokens: 29,
            costUsd: 0.002,
          },
        }),
    };

    const orchestrator = makeWorkflowAiOrchestrator({
      repository,
      runtime,
    });

    const result = await Effect.runPromise(
      orchestrator.resolveRetryFixSummary({
        jobId: "job-orchestrator-2",
        diagnostics: "upstream timeout",
        lastFailureReason: "upstream timeout",
      }),
    );

    expect(result.text).toBe("Increase timeout and retry with bounded backoff");
    expect(result.metadata).toMatchObject({
      aiResolution: "runtime",
      aiRuntimeEnabled: "true",
      aiProvider: "openai",
      aiModel: "gpt-4.1-mini",
      aiStopReason: "stop",
      aiPromptTokens: "20",
      aiCompletionTokens: "9",
      aiTotalTokens: "29",
      aiCostUsd: "0.002",
    });
  });

  test("falls back when runtime retry fix summary normalizes to empty output", async () => {
    const repository = makeInMemoryCoreRepository();
    await Effect.runPromise(writeAiSetting(repository, "enabled", true));

    const runtime: WorkflowAiRuntime = {
      suggestTaskTitleFromEntry: () => Effect.die("unused"),
      suggestRetryFixSummary: () =>
        Effect.succeed({
          text: "\n\t  ",
          trace: {
            provider: "openai",
            model: "gpt-4.1-mini",
          },
        }),
    };

    const orchestrator = makeWorkflowAiOrchestrator({
      repository,
      runtime,
    });

    const result = await Effect.runPromise(
      orchestrator.resolveRetryFixSummary({
        jobId: "job-orchestrator-empty-1",
        diagnostics: "upstream timeout",
        lastFailureReason: "upstream timeout",
      }),
    );

    expect(result.text).toBe("Investigate and address: upstream timeout");
    expect(result.metadata).toMatchObject({
      aiResolution: "fallback",
      aiRuntimeEnabled: "true",
      aiFallbackReason: "runtime_invalid_output",
      aiProvider: "openai",
      aiModel: "gpt-4.1-mini",
    });
  });
});
