import { describe, expect, mock, test } from "bun:test";
import { Either, Effect } from "effect";

import { createEvent } from "../../../../src/core/domain/event";
import { OutboundDraft } from "../../../../src/core/domain/outbound-draft";
import { CoreRepository } from "../../../../src/core/repositories/core-repository";
import { makeInMemoryCoreRepository } from "../../../../src/core/repositories/in-memory-core-repository";
import { requestEventSync } from "../../../../src/core/services/event-service";
import {
  approveOutboundAction,
  OutboundActionPort,
} from "../../../../src/core/services/approval-service";

describe("approval-service", () => {
  test("approveOutboundAction rejects non-user approvers as forbidden", async () => {
    const repository = makeInMemoryCoreRepository();
    const event = await Effect.runPromise(
      createEvent({
        id: "event-forbidden-1",
        title: "Unauthorized approval candidate",
        startAt: new Date("2026-02-25T12:00:00.000Z"),
      }),
    );
    await Effect.runPromise(repository.saveEntity("event", event.id, event));

    await Effect.runPromise(
      requestEventSync(
        repository,
        event.id,
        { id: "user-1", kind: "user" },
        new Date("2026-02-23T13:30:00.000Z"),
      ),
    );

    const execute = mock(async (_action: unknown) => ({
      executionId: "exec-forbidden-1",
    }));
    const outboundPort: OutboundActionPort = {
      execute: (action) => Effect.promise(() => execute(action)),
    };

    const result = await Effect.runPromise(
      Effect.either(
        approveOutboundAction(repository, outboundPort, {
          actionType: "event_sync",
          entityType: "event",
          entityId: event.id,
          approved: true,
          actor: { id: "system-1", kind: "system" },
          at: new Date("2026-02-23T13:35:00.000Z"),
        }),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        _tag: "ApprovalServiceError",
        code: "forbidden",
      });
    }
    expect(execute).toHaveBeenCalledTimes(0);
  });

  test("approveOutboundAction denial is side-effect free for event_sync and outbound_draft", async () => {
    const repository = makeInMemoryCoreRepository();
    const event = await Effect.runPromise(
      createEvent({
        id: "event-denied-1",
        title: "Denied event sync candidate",
        startAt: new Date("2026-02-25T12:10:00.000Z"),
      }),
    );
    await Effect.runPromise(repository.saveEntity("event", event.id, event));

    await Effect.runPromise(
      requestEventSync(
        repository,
        event.id,
        { id: "user-1", kind: "user" },
        new Date("2026-02-23T13:40:00.000Z"),
      ),
    );

    const outboundDraft: OutboundDraft = {
      id: "outbound-draft-denied-1",
      payload: "Denied outbound payload",
      sourceSignalId: "signal-denied-1",
      status: "pending_approval",
      createdAt: "2026-02-23T14:00:00.000Z",
      updatedAt: "2026-02-23T14:00:00.000Z",
    };
    await Effect.runPromise(
      repository.saveEntity("outbound_draft", outboundDraft.id, outboundDraft),
    );

    const execute = mock(async (_action: unknown) => ({
      executionId: "exec-denied-1",
    }));
    const outboundPort: OutboundActionPort = {
      execute: (action) => Effect.promise(() => execute(action)),
    };

    const deniedEvent = await Effect.runPromise(
      Effect.either(
        approveOutboundAction(repository, outboundPort, {
          actionType: "event_sync",
          entityType: "event",
          entityId: event.id,
          approved: false,
          actor: { id: "user-1", kind: "user" },
          at: new Date("2026-02-23T13:41:00.000Z"),
        }),
      ),
    );
    const deniedDraft = await Effect.runPromise(
      Effect.either(
        approveOutboundAction(repository, outboundPort, {
          actionType: "outbound_draft",
          entityType: "outbound_draft",
          entityId: outboundDraft.id,
          approved: false,
          actor: { id: "user-1", kind: "user" },
          at: new Date("2026-02-23T13:42:00.000Z"),
        }),
      ),
    );

    const persistedEvent = await Effect.runPromise(
      repository.getEntity<{ syncState: string }>("event", event.id),
    );
    const persistedDraft = await Effect.runPromise(
      repository.getEntity<OutboundDraft>("outbound_draft", outboundDraft.id),
    );
    const eventAudit = await Effect.runPromise(
      repository.listAuditTrail({
        entityType: "event",
        entityId: event.id,
      }),
    );
    const draftAudit = await Effect.runPromise(
      repository.listAuditTrail({
        entityType: "outbound_draft",
        entityId: outboundDraft.id,
      }),
    );

    expect(Either.isLeft(deniedEvent)).toBe(true);
    expect(Either.isLeft(deniedDraft)).toBe(true);
    if (Either.isLeft(deniedEvent)) {
      expect(deniedEvent.left.code).toBe("invalid_request");
    }
    if (Either.isLeft(deniedDraft)) {
      expect(deniedDraft.left.code).toBe("invalid_request");
    }
    expect(execute).toHaveBeenCalledTimes(0);
    expect(persistedEvent?.syncState).toBe("pending_approval");
    expect(persistedDraft?.status).toBe("pending_approval");
    expect(persistedDraft?.executionId).toBeUndefined();
    expect(eventAudit).toHaveLength(1);
    expect(draftAudit).toHaveLength(0);
  });

  test("approveOutboundAction rejects non-user outbound_draft approvals without state mutation", async () => {
    const repository = makeInMemoryCoreRepository();
    const draft: OutboundDraft = {
      id: "outbound-draft-forbidden-1",
      payload: "Forbidden outbound payload",
      sourceSignalId: "signal-forbidden-1",
      status: "pending_approval",
      createdAt: "2026-02-23T14:10:00.000Z",
      updatedAt: "2026-02-23T14:10:00.000Z",
    };
    await Effect.runPromise(
      repository.saveEntity("outbound_draft", draft.id, draft),
    );

    const execute = mock(async (_action: unknown) => ({
      executionId: "exec-forbidden-outbound-1",
    }));
    const outboundPort: OutboundActionPort = {
      execute: (action) => Effect.promise(() => execute(action)),
    };

    const forbidden = await Effect.runPromise(
      Effect.either(
        approveOutboundAction(repository, outboundPort, {
          actionType: "outbound_draft",
          entityType: "outbound_draft",
          entityId: draft.id,
          approved: true,
          actor: { id: "system-1", kind: "system" },
          at: new Date("2026-02-23T14:11:00.000Z"),
        }),
      ),
    );

    const persistedDraft = await Effect.runPromise(
      repository.getEntity<OutboundDraft>("outbound_draft", draft.id),
    );
    const draftAudit = await Effect.runPromise(
      repository.listAuditTrail({
        entityType: "outbound_draft",
        entityId: draft.id,
      }),
    );

    expect(Either.isLeft(forbidden)).toBe(true);
    if (Either.isLeft(forbidden)) {
      expect(forbidden.left.code).toBe("forbidden");
    }
    expect(execute).toHaveBeenCalledTimes(0);
    expect(persistedDraft?.status).toBe("pending_approval");
    expect(persistedDraft?.executionId).toBeUndefined();
    expect(draftAudit).toHaveLength(0);
  });

  test("approveOutboundAction enforces explicit approval before execute", async () => {
    const repository = makeInMemoryCoreRepository();
    const event = await Effect.runPromise(
      createEvent({
        id: "event-2",
        title: "Sync candidate",
        startAt: new Date("2026-02-25T12:00:00.000Z"),
      }),
    );
    await Effect.runPromise(repository.saveEntity("event", event.id, event));

    await Effect.runPromise(
      requestEventSync(
        repository,
        event.id,
        { id: "user-1", kind: "user" },
        new Date("2026-02-23T13:30:00.000Z"),
      ),
    );

    const execute = mock(async (_action: unknown) => ({
      executionId: "exec-1",
    }));

    const outboundPort: OutboundActionPort = {
      execute: (action) => Effect.promise(() => execute(action)),
    };

    await expect(
      Effect.runPromise(
        approveOutboundAction(repository, outboundPort, {
          actionType: "event_sync",
          entityType: "event",
          entityId: "event-2",
          approved: false,
          actor: { id: "user-1", kind: "user" },
          at: new Date("2026-02-23T13:35:00.000Z"),
        }),
      ),
    ).rejects.toThrow();

    expect(execute).toHaveBeenCalledTimes(0);

    const approved = await Effect.runPromise(
      approveOutboundAction(repository, outboundPort, {
        actionType: "event_sync",
        entityType: "event",
        entityId: "event-2",
        approved: true,
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T13:40:00.000Z"),
      }),
    );

    const persistedEvent = await Effect.runPromise(
      repository.getEntity<{ syncState: string }>("event", "event-2"),
    );

    expect(approved.executed).toBe(true);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(persistedEvent?.syncState).toBe("synced");
  });

  test("approveOutboundAction rejects duplicate event approvals as conflict and does not re-execute", async () => {
    const repository = makeInMemoryCoreRepository();
    const event = await Effect.runPromise(
      createEvent({
        id: "event-duplicate-1",
        title: "Duplicate approval candidate",
        startAt: new Date("2026-02-25T12:00:00.000Z"),
      }),
    );
    await Effect.runPromise(repository.saveEntity("event", event.id, event));
    await Effect.runPromise(
      requestEventSync(
        repository,
        event.id,
        { id: "user-1", kind: "user" },
        new Date("2026-02-23T13:30:00.000Z"),
      ),
    );

    const execute = mock(async (_action: unknown) => ({
      executionId: "exec-event-duplicate-1",
    }));
    const outboundPort: OutboundActionPort = {
      execute: (action) => Effect.promise(() => execute(action)),
    };

    await Effect.runPromise(
      approveOutboundAction(repository, outboundPort, {
        actionType: "event_sync",
        entityType: "event",
        entityId: event.id,
        approved: true,
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T13:31:00.000Z"),
      }),
    );

    const duplicate = await Effect.runPromise(
      Effect.either(
        approveOutboundAction(repository, outboundPort, {
          actionType: "event_sync",
          entityType: "event",
          entityId: event.id,
          approved: true,
          actor: { id: "user-1", kind: "user" },
          at: new Date("2026-02-23T13:32:00.000Z"),
        }),
      ),
    );

    expect(Either.isLeft(duplicate)).toBe(true);
    if (Either.isLeft(duplicate)) {
      expect(duplicate.left).toMatchObject({
        _tag: "ApprovalServiceError",
        code: "conflict",
      });
    }
    expect(execute).toHaveBeenCalledTimes(1);
  });

  test("approveOutboundAction validates event existence before executing outbound sync", async () => {
    const repository = makeInMemoryCoreRepository();
    const execute = mock(async (_action: unknown) => ({
      executionId: "exec-2",
    }));
    const outboundPort: OutboundActionPort = {
      execute: (action) => Effect.promise(() => execute(action)),
    };

    await expect(
      Effect.runPromise(
        approveOutboundAction(repository, outboundPort, {
          actionType: "event_sync",
          entityType: "event",
          entityId: "event-missing",
          approved: true,
          actor: { id: "user-1", kind: "user" },
          at: new Date("2026-02-23T13:35:00.000Z"),
        }),
      ),
    ).rejects.toThrow("event event-missing was not found");

    expect(execute).toHaveBeenCalledTimes(0);
  });

  test("approveOutboundAction requires event to be pending_approval before execute", async () => {
    const repository = makeInMemoryCoreRepository();
    const event = await Effect.runPromise(
      createEvent({
        id: "event-3",
        title: "Local-only event",
        startAt: new Date("2026-02-25T13:00:00.000Z"),
      }),
    );
    await Effect.runPromise(repository.saveEntity("event", event.id, event));

    const execute = mock(async (_action: unknown) => ({
      executionId: "exec-3",
    }));
    const outboundPort: OutboundActionPort = {
      execute: (action) => Effect.promise(() => execute(action)),
    };

    await expect(
      Effect.runPromise(
        approveOutboundAction(repository, outboundPort, {
          actionType: "event_sync",
          entityType: "event",
          entityId: event.id,
          approved: true,
          actor: { id: "user-1", kind: "user" },
          at: new Date("2026-02-23T13:35:00.000Z"),
        }),
      ),
    ).rejects.toThrow("must be in pending_approval");

    expect(execute).toHaveBeenCalledTimes(0);
  });

  test("approveOutboundAction maps event persistence failures to ApprovalServiceError", async () => {
    const repository = makeInMemoryCoreRepository();
    const event = await Effect.runPromise(
      createEvent({
        id: "event-persistence-failure-1",
        title: "Persistence failure candidate",
        startAt: new Date("2026-02-25T13:00:00.000Z"),
      }),
    );
    await Effect.runPromise(repository.saveEntity("event", event.id, event));
    await Effect.runPromise(
      requestEventSync(
        repository,
        event.id,
        { id: "user-1", kind: "user" },
        new Date("2026-02-23T13:30:00.000Z"),
      ),
    );

    const execute = mock(async (_action: unknown) => ({
      executionId: "exec-event-persistence-failure-1",
    }));
    const outboundPort: OutboundActionPort = {
      execute: (action) => Effect.promise(() => execute(action)),
    };
    const failingRepository: CoreRepository = {
      ...repository,
      saveEntity: (entityType, entityId, entityValue) => {
        if (entityType === "event" && entityId === event.id) {
          return Effect.fail(new Error("event persistence unavailable")).pipe(
            Effect.orDie,
          );
        }

        return repository.saveEntity(entityType, entityId, entityValue);
      },
    };

    const result = await Effect.runPromise(
      Effect.either(
        approveOutboundAction(failingRepository, outboundPort, {
          actionType: "event_sync",
          entityType: "event",
          entityId: event.id,
          approved: true,
          actor: { id: "user-1", kind: "user" },
          at: new Date("2026-02-23T13:35:00.000Z"),
        }),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        _tag: "ApprovalServiceError",
      });
      expect(result.left.message).toContain("event persistence unavailable");
    }
    expect(execute).toHaveBeenCalledTimes(1);

    const persistedEvent = await Effect.runPromise(
      repository.getEntity<{ syncState: string }>("event", event.id),
    );
    const auditTrail = await Effect.runPromise(
      repository.listAuditTrail({
        entityType: "event",
        entityId: event.id,
      }),
    );

    expect(persistedEvent?.syncState).toBe("pending_approval");
    expect(auditTrail).toHaveLength(1);
  });

  test("approveOutboundAction rolls back synced event state when audit append fails", async () => {
    const repository = makeInMemoryCoreRepository();
    const event = await Effect.runPromise(
      createEvent({
        id: "event-audit-failure-1",
        title: "Audit failure candidate",
        startAt: new Date("2026-02-25T13:00:00.000Z"),
      }),
    );
    await Effect.runPromise(repository.saveEntity("event", event.id, event));
    await Effect.runPromise(
      requestEventSync(
        repository,
        event.id,
        { id: "user-1", kind: "user" },
        new Date("2026-02-23T13:30:00.000Z"),
      ),
    );

    const execute = mock(async (_action: unknown) => ({
      executionId: "exec-event-audit-failure-1",
    }));
    const outboundPort: OutboundActionPort = {
      execute: (action) => Effect.promise(() => execute(action)),
    };
    const failingRepository: CoreRepository = {
      ...repository,
      appendAuditTransition: (_transition) =>
        Effect.fail(new Error("approval audit append unavailable")).pipe(
          Effect.orDie,
        ),
    };

    const result = await Effect.runPromise(
      Effect.either(
        approveOutboundAction(failingRepository, outboundPort, {
          actionType: "event_sync",
          entityType: "event",
          entityId: event.id,
          approved: true,
          actor: { id: "user-1", kind: "user" },
          at: new Date("2026-02-23T13:35:00.000Z"),
        }),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toMatchObject({
        _tag: "ApprovalServiceError",
      });
      expect(result.left.message).toContain(
        "approval audit append unavailable",
      );
    }
    expect(execute).toHaveBeenCalledTimes(1);

    const persistedEvent = await Effect.runPromise(
      repository.getEntity<{ syncState: string }>("event", event.id),
    );
    const auditTrail = await Effect.runPromise(
      repository.listAuditTrail({
        entityType: "event",
        entityId: event.id,
      }),
    );

    expect(persistedEvent?.syncState).toBe("pending_approval");
    expect(auditTrail).toHaveLength(1);
  });

  test("approveOutboundAction rejects outbound_draft actions when entityType is not outbound_draft", async () => {
    const repository = makeInMemoryCoreRepository();
    const execute = mock(async (_action: unknown) => ({
      executionId: "exec-4",
    }));
    const outboundPort: OutboundActionPort = {
      execute: (action) => Effect.promise(() => execute(action)),
    };

    await expect(
      Effect.runPromise(
        approveOutboundAction(repository, outboundPort, {
          actionType: "outbound_draft",
          entityType: "event",
          entityId: "outbound-draft-1",
          approved: true,
          actor: { id: "user-1", kind: "user" },
        }),
      ),
    ).rejects.toThrow("must target entityType=outbound_draft");

    expect(execute).toHaveBeenCalledTimes(0);
  });

  test("approveOutboundAction rejects outbound_draft approval when draft is missing", async () => {
    const repository = makeInMemoryCoreRepository();
    const execute = mock(async (_action: unknown) => ({
      executionId: "exec-5",
    }));
    const outboundPort: OutboundActionPort = {
      execute: (action) => Effect.promise(() => execute(action)),
    };

    await expect(
      Effect.runPromise(
        approveOutboundAction(repository, outboundPort, {
          actionType: "outbound_draft",
          entityType: "outbound_draft",
          entityId: "outbound-draft-missing",
          approved: true,
          actor: { id: "user-1", kind: "user" },
        }),
      ),
    ).rejects.toThrow("outbound draft outbound-draft-missing was not found");

    expect(execute).toHaveBeenCalledTimes(0);
  });

  test("approveOutboundAction rejects outbound_draft unless status=pending_approval", async () => {
    const repository = makeInMemoryCoreRepository();
    const draft: OutboundDraft = {
      id: "outbound-draft-2",
      payload: "Draft payload",
      sourceSignalId: "signal-2",
      status: "draft",
      createdAt: "2026-02-23T14:00:00.000Z",
      updatedAt: "2026-02-23T14:00:00.000Z",
    };
    await Effect.runPromise(
      repository.saveEntity("outbound_draft", draft.id, draft),
    );

    const execute = mock(async (_action: unknown) => ({
      executionId: "exec-6",
    }));
    const outboundPort: OutboundActionPort = {
      execute: (action) => Effect.promise(() => execute(action)),
    };

    await expect(
      Effect.runPromise(
        approveOutboundAction(repository, outboundPort, {
          actionType: "outbound_draft",
          entityType: "outbound_draft",
          entityId: draft.id,
          approved: true,
          actor: { id: "user-1", kind: "user" },
        }),
      ),
    ).rejects.toThrow("must be in pending_approval");

    expect(execute).toHaveBeenCalledTimes(0);
  });

  test("approveOutboundAction executes outbound draft, persists status=executed, stores executionId, appends audit", async () => {
    const repository = makeInMemoryCoreRepository();
    const draft: OutboundDraft = {
      id: "outbound-draft-3",
      payload: "Draft payload",
      sourceSignalId: "signal-3",
      status: "pending_approval",
      createdAt: "2026-02-23T14:00:00.000Z",
      updatedAt: "2026-02-23T14:05:00.000Z",
    };
    await Effect.runPromise(
      repository.saveEntity("outbound_draft", draft.id, draft),
    );

    const execute = mock(async (_action: unknown) => ({
      executionId: "exec-7",
    }));
    const outboundPort: OutboundActionPort = {
      execute: (action) => Effect.promise(() => execute(action)),
    };

    const approved = await Effect.runPromise(
      approveOutboundAction(repository, outboundPort, {
        actionType: "outbound_draft",
        entityType: "outbound_draft",
        entityId: draft.id,
        approved: true,
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T14:10:00.000Z"),
      }),
    );

    const persistedDraft = await Effect.runPromise(
      repository.getEntity<OutboundDraft>("outbound_draft", draft.id),
    );
    const auditTrail = await Effect.runPromise(
      repository.listAuditTrail({
        entityType: "outbound_draft",
        entityId: draft.id,
      }),
    );

    expect(approved.executed).toBe(true);
    expect(approved.executionId).toBe("exec-7");
    expect(execute).toHaveBeenCalledTimes(1);
    expect(persistedDraft?.status).toBe("executed");
    expect(persistedDraft?.executionId).toBe("exec-7");
    expect(auditTrail).toHaveLength(2);
    expect(auditTrail[0]?.fromState).toBe("pending_approval");
    expect(auditTrail[0]?.toState).toBe("executing");
    expect(auditTrail[1]?.fromState).toBe("executing");
    expect(auditTrail[1]?.toState).toBe("executed");
  });

  test("approveOutboundAction rejects duplicate outbound draft approvals as conflict and does not re-execute", async () => {
    const repository = makeInMemoryCoreRepository();
    const draft: OutboundDraft = {
      id: "outbound-draft-duplicate-1",
      payload: "Draft payload",
      sourceSignalId: "signal-duplicate-1",
      status: "pending_approval",
      createdAt: "2026-02-23T14:00:00.000Z",
      updatedAt: "2026-02-23T14:05:00.000Z",
    };
    await Effect.runPromise(
      repository.saveEntity("outbound_draft", draft.id, draft),
    );

    const execute = mock(async (_action: unknown) => ({
      executionId: "exec-duplicate-outbound-1",
    }));
    const outboundPort: OutboundActionPort = {
      execute: (action) => Effect.promise(() => execute(action)),
    };

    await Effect.runPromise(
      approveOutboundAction(repository, outboundPort, {
        actionType: "outbound_draft",
        entityType: "outbound_draft",
        entityId: draft.id,
        approved: true,
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-23T14:10:00.000Z"),
      }),
    );

    const duplicate = await Effect.runPromise(
      Effect.either(
        approveOutboundAction(repository, outboundPort, {
          actionType: "outbound_draft",
          entityType: "outbound_draft",
          entityId: draft.id,
          approved: true,
          actor: { id: "user-1", kind: "user" },
          at: new Date("2026-02-23T14:11:00.000Z"),
        }),
      ),
    );

    expect(Either.isLeft(duplicate)).toBe(true);
    if (Either.isLeft(duplicate)) {
      expect(duplicate.left).toMatchObject({
        _tag: "ApprovalServiceError",
        code: "conflict",
      });
    }
    expect(execute).toHaveBeenCalledTimes(1);
  });

  test("approveOutboundAction does not execute outbound draft when pre-execution persistence fails", async () => {
    const repository = makeInMemoryCoreRepository();
    const draft: OutboundDraft = {
      id: "outbound-draft-4",
      payload: "Draft payload",
      sourceSignalId: "signal-4",
      status: "pending_approval",
      createdAt: "2026-02-23T14:00:00.000Z",
      updatedAt: "2026-02-23T14:05:00.000Z",
    };
    await Effect.runPromise(
      repository.saveEntity("outbound_draft", draft.id, draft),
    );

    const execute = mock(async (_action: unknown) => ({
      executionId: "exec-8",
    }));
    const outboundPort: OutboundActionPort = {
      execute: (action) => Effect.promise(() => execute(action)),
    };
    const failingRepository: CoreRepository = {
      ...repository,
      saveEntity: (entityType, entityId, entity) => {
        if (entityType === "outbound_draft") {
          return Effect.fail(
            new Error("outbound draft persistence unavailable"),
          ).pipe(Effect.orDie);
        }

        return repository.saveEntity(entityType, entityId, entity);
      },
    };

    await expect(
      Effect.runPromise(
        approveOutboundAction(failingRepository, outboundPort, {
          actionType: "outbound_draft",
          entityType: "outbound_draft",
          entityId: draft.id,
          approved: true,
          actor: { id: "user-1", kind: "user" },
          at: new Date("2026-02-23T14:10:00.000Z"),
        }),
      ),
    ).rejects.toThrow("outbound draft persistence unavailable");

    expect(execute).toHaveBeenCalledTimes(0);
  });

  test("approveOutboundAction rejects outbound draft execution when executionId is empty", async () => {
    const repository = makeInMemoryCoreRepository();
    const draft: OutboundDraft = {
      id: "outbound-draft-5",
      payload: "Draft payload",
      sourceSignalId: "signal-5",
      status: "pending_approval",
      createdAt: "2026-02-23T14:00:00.000Z",
      updatedAt: "2026-02-23T14:05:00.000Z",
    };
    await Effect.runPromise(
      repository.saveEntity("outbound_draft", draft.id, draft),
    );

    const execute = mock(async (_action: unknown) => ({
      executionId: "   ",
    }));
    const outboundPort: OutboundActionPort = {
      execute: (action) => Effect.promise(() => execute(action)),
    };

    await expect(
      Effect.runPromise(
        approveOutboundAction(repository, outboundPort, {
          actionType: "outbound_draft",
          entityType: "outbound_draft",
          entityId: draft.id,
          approved: true,
          actor: { id: "user-1", kind: "user" },
          at: new Date("2026-02-23T14:10:00.000Z"),
        }),
      ),
    ).rejects.toThrow("non-empty executionId");

    const persistedDraft = await Effect.runPromise(
      repository.getEntity<OutboundDraft>("outbound_draft", draft.id),
    );
    expect(execute).toHaveBeenCalledTimes(1);
    expect(persistedDraft?.status).toBe("pending_approval");
    expect(persistedDraft?.executionId).toBeUndefined();
  });
});
