import { describe, expect, test } from "bun:test";
import { Either, Effect } from "effect";

import { makePiAiRuntime } from "../../../../../src/core/services/ai/pi-ai-runtime";

describe("core/services/ai/pi-ai-runtime", () => {
  test("suggestTaskTitleFromEntry calls pi-ai complete with deterministic options", async () => {
    const calls: Array<{
      model: unknown;
      context: unknown;
      options: unknown;
    }> = [];
    const modelRef = { id: "gpt-4.1-mini", provider: "openai" };

    const runtime = makePiAiRuntime({
      provider: "openai",
      modelId: "gpt-4.1-mini",
      temperature: 0,
      maxTokens: 42,
      getModel: ((provider: string, modelId: string) => {
        expect(provider).toBe("openai");
        expect(modelId).toBe("gpt-4.1-mini");
        return modelRef;
      }) as never,
      complete: (async (model: unknown, context: unknown, options: unknown) => {
        calls.push({ model, context, options });
        return {
          role: "assistant",
          content: [
            {
              type: "text",
              text: "Draft launch follow-up task",
            },
          ],
          api: "openai-responses",
          provider: "openai",
          model: "gpt-4.1-mini",
          usage: {
            input: 7,
            output: 5,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 12,
            cost: {
              input: 0,
              output: 0,
              cacheRead: 0,
              cacheWrite: 0,
              total: 0,
            },
          },
          stopReason: "stop",
          timestamp: Date.now(),
        };
      }) as never,
    });

    const result = await Effect.runPromise(
      runtime.suggestTaskTitleFromEntry({
        entryId: "entry-ai-runtime-1",
        content: "Need a concise launch follow-up title",
      }),
    );

    expect(result.text).toBe("Draft launch follow-up task");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.model).toBe(modelRef);
    expect(calls[0]?.context).toMatchObject({
      messages: [
        expect.objectContaining({
          role: "user",
        }),
      ],
    });
    expect(calls[0]?.options).toMatchObject({
      temperature: 0,
      maxTokens: 42,
    });
  });

  test("suggestTaskTitleFromEntry maps pi-ai runtime failure into AiRuntimeError", async () => {
    const runtime = makePiAiRuntime({
      getModel: (() => ({ id: "gpt-4.1-mini", provider: "openai" })) as never,
      complete: (async () => {
        throw {
          code: "invalid_request",
          message: "prompt shape is invalid",
          providerPayload: { secret: "should-not-leak" },
        };
      }) as never,
    });

    const result = await Effect.runPromise(
      Effect.either(
        runtime.suggestTaskTitleFromEntry({
          entryId: "entry-ai-runtime-2",
          content: "Entry content",
        }),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        _tag: "AiRuntimeError",
        code: "invalid_request",
        target: "capture.suggest",
      });
      expect(result.left.message).toContain("prompt shape is invalid");
      expect(result.left.message).not.toContain("should-not-leak");
    }
  });

  test("suggestTaskTitleFromEntry enforces a timeout and abort signal boundary", async () => {
    let observedSignal: AbortSignal | undefined;

    const runtime = makePiAiRuntime({
      provider: "openai",
      modelId: "gpt-4.1-mini",
      // Intentionally short timeout to verify runtime timeout behavior.
      timeoutMs: 20,
      getModel: (() => ({ id: "gpt-4.1-mini", provider: "openai" })) as never,
      complete: ((
        _model: unknown,
        _context: unknown,
        options?: { signal?: AbortSignal },
      ) =>
        new Promise(() => {
          observedSignal = options?.signal;
        })) as never,
    } as never);

    const result = await Effect.runPromise(
      Effect.either(
        runtime.suggestTaskTitleFromEntry({
          entryId: "entry-ai-runtime-timeout-1",
          content: "This completion never resolves",
        }).pipe(
          Effect.timeoutFail({
            duration: "250 millis",
            onTimeout: () => new Error("test timeout exceeded"),
          }),
        ),
      ),
    );

    expect(observedSignal).toBeDefined();
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        _tag: "AiRuntimeError",
        target: "capture.suggest",
      });
      expect(result.left.message).toContain("timed out");
    }
  });

  test("suggestRetryFixSummary returns normalized trace metadata (provider/model/usage/stopReason)", async () => {
    const runtime = makePiAiRuntime({
      getModel: (() => ({ id: "gpt-5-mini", provider: "openai" })) as never,
      complete: (async () => ({
        role: "assistant",
        content: [
          {
            type: "text",
            text: "Increase timeout and retry with exponential backoff.",
          },
        ],
        api: "openai-responses",
        provider: "openai",
        model: "gpt-5-mini",
        usage: {
          input: 24,
          output: 13,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 37,
          cost: {
            input: 0.001,
            output: 0.002,
            cacheRead: 0,
            cacheWrite: 0,
            total: 0.003,
          },
        },
        stopReason: "length",
        timestamp: Date.now(),
      })) as never,
    });

    const result = await Effect.runPromise(
      runtime.suggestRetryFixSummary({
        jobId: "job-ai-runtime-1",
        diagnostics: "provider timeout",
        lastFailureReason: "provider timeout",
      }),
    );

    expect(result.text).toBe(
      "Increase timeout and retry with exponential backoff.",
    );
    expect(result.trace).toEqual({
      provider: "openai",
      model: "gpt-5-mini",
      stopReason: "length",
      promptTokens: 24,
      completionTokens: 13,
      totalTokens: 37,
      costUsd: 0.003,
    });
  });
});
