import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { OutboundDraft } from "../../../../src/core/domain/outbound-draft";
import { createSignal } from "../../../../src/core/domain/signal";
import { makeInMemoryCoreRepository } from "../../../../src/core/repositories/in-memory-core-repository";
import {
  convertSignal,
  ingestSignal,
  triageSignal,
} from "../../../../src/core/services/signal-service";

describe("signal-service", () => {
  test("ingestSignal persists untriaged signal and appends audit transition none->untriaged", async () => {
    const repository = makeInMemoryCoreRepository();

    const signal = await Effect.runPromise(
      ingestSignal(repository, {
        signalId: "signal-ingest-1",
        source: "api",
        payload: "Inbound payload",
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T11:00:00.000Z"),
      }),
    );

    const persisted = await Effect.runPromise(
      repository.getEntity("signal", "signal-ingest-1"),
    );
    const auditTrail = await Effect.runPromise(
      repository.listAuditTrail({
        entityType: "signal",
        entityId: "signal-ingest-1",
      }),
    );

    expect(signal.id).toBe("signal-ingest-1");
    expect(signal.triageState).toBe("untriaged");
    expect(persisted).toEqual(signal);
    expect(auditTrail).toHaveLength(1);
    expect(auditTrail[0]?.fromState).toBe("none");
    expect(auditTrail[0]?.toState).toBe("untriaged");
  });

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
      await Effect.runPromise(
        triageSignal(
          repository,
          signal.id,
          "ready_for_conversion",
          { id: "user-2", kind: "user" },
          new Date("2026-02-23T12:20:00.000Z"),
        ),
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

  test("convertSignal creates typed outbound draft with status=draft", async () => {
    const repository = makeInMemoryCoreRepository();
    const signal = await Effect.runPromise(
      createSignal({
        id: "signal-outbound-draft",
        source: "api",
        payload: "Send follow-up email",
      }),
    );

    await Effect.runPromise(repository.saveEntity("signal", signal.id, signal));
    await Effect.runPromise(
      triageSignal(
        repository,
        signal.id,
        "ready_for_conversion",
        { id: "user-2", kind: "user" },
        new Date("2026-02-23T12:20:00.000Z"),
      ),
    );

    const converted = await Effect.runPromise(
      convertSignal(repository, {
        signalId: signal.id,
        targetType: "outbound_draft",
        targetId: "outbound-draft-99",
        actor: { id: "user-2", kind: "user" },
        at: new Date("2026-02-23T12:30:00.000Z"),
      }),
    );

    const outboundDraft = await Effect.runPromise(
      repository.getEntity<OutboundDraft>(
        "outbound_draft",
        "outbound-draft-99",
      ),
    );
    const auditTrail = await Effect.runPromise(
      repository.listAuditTrail({
        entityType: "outbound_draft",
        entityId: "outbound-draft-99",
      }),
    );

    expect(converted).toEqual({
      entityType: "outbound_draft",
      entityId: "outbound-draft-99",
    });
    expect(outboundDraft?.status).toBe("draft");
    expect(outboundDraft?.sourceSignalId).toBe(signal.id);
    expect(outboundDraft?.payload).toBe(signal.payload);
    expect(auditTrail[0]?.fromState).toBe("none");
    expect(auditTrail[0]?.toState).toBe("draft");
  });

  test("convertSignal rejects conversion when signal has not been triaged", async () => {
    const repository = makeInMemoryCoreRepository();
    const signal = await Effect.runPromise(
      createSignal({
        id: "signal-untriaged",
        source: "api",
        payload: "untriaged payload",
      }),
    );

    await Effect.runPromise(repository.saveEntity("signal", signal.id, signal));

    await expect(
      Effect.runPromise(
        convertSignal(repository, {
          signalId: signal.id,
          targetType: "task",
          targetId: "task-untriaged",
          actor: { id: "user-2", kind: "user" },
          at: new Date("2026-02-23T12:30:00.000Z"),
        }),
      ),
    ).rejects.toThrow("must be triaged before conversion");
  });

  test("convertSignal fails gracefully on unknown conversion target", async () => {
    const repository = makeInMemoryCoreRepository();
    const signal = await Effect.runPromise(
      createSignal({
        id: "signal-unknown-target",
        source: "api",
        payload: "payload for unknown target",
      }),
    );

    await Effect.runPromise(repository.saveEntity("signal", signal.id, signal));

    await expect(
      Effect.runPromise(
        convertSignal(repository, {
          signalId: signal.id,
          targetType: "unknown_target" as never,
          actor: { id: "user-2", kind: "user" },
          at: new Date("2026-02-23T12:30:00.000Z"),
        }),
      ),
    ).rejects.toThrow("unsupported signal conversion target");
  });
});
