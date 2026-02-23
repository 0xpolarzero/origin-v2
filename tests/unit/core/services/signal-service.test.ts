import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { createSignal } from "../../../../src/core/domain/signal";
import { makeInMemoryCoreRepository } from "../../../../src/core/repositories/in-memory-core-repository";
import {
  convertSignal,
  triageSignal,
} from "../../../../src/core/services/signal-service";

describe("signal-service", () => {
  test("triageSignal updates triage state with audit record", async () => {
    const repository = makeInMemoryCoreRepository();
    const signal = await Effect.runPromise(
      createSignal({
        id: "signal-1",
        source: "email",
        payload: "Need revised project timeline",
      }),
    );
    await Effect.runPromise(repository.saveEntity("signal", signal.id, signal));

    const triaged = await Effect.runPromise(
      triageSignal(
        repository,
        "signal-1",
        "needs_follow_up",
        { id: "user-1", kind: "user" },
        new Date("2026-02-23T12:00:00.000Z"),
      ),
    );

    const auditTrail = await Effect.runPromise(
      repository.listAuditTrail({ entityType: "signal", entityId: "signal-1" }),
    );

    expect(triaged.triageState).toBe("triaged");
    expect(triaged.triageDecision).toBe("needs_follow_up");
    expect(auditTrail).toHaveLength(1);
    expect(auditTrail[0]?.fromState).toBe("untriaged");
    expect(auditTrail[0]?.toState).toBe("triaged");
  });

  test("convertSignal creates target entity (Task/Event/Note/Project) and audit linkage", async () => {
    const repository = makeInMemoryCoreRepository();

    const conversionCases = [
      {
        signalId: "signal-task",
        targetType: "task" as const,
        targetId: "task-99",
      },
      {
        signalId: "signal-event",
        targetType: "event" as const,
        targetId: "event-99",
      },
      {
        signalId: "signal-note",
        targetType: "note" as const,
        targetId: "note-99",
      },
      {
        signalId: "signal-project",
        targetType: "project" as const,
        targetId: "project-99",
      },
    ];

    for (const conversion of conversionCases) {
      const signal = await Effect.runPromise(
        createSignal({
          id: conversion.signalId,
          source: "api",
          payload: `payload for ${conversion.targetType}`,
        }),
      );
      await Effect.runPromise(
        repository.saveEntity("signal", signal.id, signal),
      );

      const converted = await Effect.runPromise(
        convertSignal(repository, {
          signalId: conversion.signalId,
          targetType: conversion.targetType,
          targetId: conversion.targetId,
          actor: { id: "user-2", kind: "user" },
          at: new Date("2026-02-23T12:30:00.000Z"),
        }),
      );

      const target = await Effect.runPromise(
        repository.getEntity(converted.entityType, converted.entityId),
      );

      const auditTrail = await Effect.runPromise(
        repository.listAuditTrail({
          entityType: "signal",
          entityId: conversion.signalId,
        }),
      );

      expect(converted).toEqual({
        entityType: conversion.targetType,
        entityId: conversion.targetId,
      });
      expect(target).toBeDefined();
      expect(auditTrail[auditTrail.length - 1]?.toState).toBe("converted");
    }
  });
});
