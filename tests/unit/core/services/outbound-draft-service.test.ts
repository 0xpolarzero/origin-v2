import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import {
  createOutboundDraft,
  OutboundDraft,
} from "../../../../src/core/domain/outbound-draft";
import { CoreRepository } from "../../../../src/core/repositories/core-repository";
import { makeInMemoryCoreRepository } from "../../../../src/core/repositories/in-memory-core-repository";
import { requestOutboundDraftExecution } from "../../../../src/core/services/outbound-draft-service";

describe("outbound-draft-service", () => {
  test("requestOutboundDraftExecution moves draft->pending_approval, creates approval notification, appends audit", async () => {
    const repository = makeInMemoryCoreRepository();

    const draft = await Effect.runPromise(
      createOutboundDraft({
        id: "outbound-draft-1",
        payload: "Email customer launch details",
        sourceSignalId: "signal-1",
        createdAt: new Date("2026-02-23T14:00:00.000Z"),
        updatedAt: new Date("2026-02-23T14:00:00.000Z"),
      }),
    );

    await Effect.runPromise(
      repository.saveEntity("outbound_draft", draft.id, draft),
    );

    const result = await Effect.runPromise(
      requestOutboundDraftExecution(
        repository,
        draft.id,
        { id: "user-1", kind: "user" },
        new Date("2026-02-23T14:05:00.000Z"),
      ),
    );

    const persistedDraft = await Effect.runPromise(
      repository.getEntity<OutboundDraft>("outbound_draft", draft.id),
    );
    const persistedNotification = await Effect.runPromise(
      repository.getEntity("notification", result.notification.id),
    );
    const auditTrail = await Effect.runPromise(
      repository.listAuditTrail({
        entityType: "outbound_draft",
        entityId: draft.id,
      }),
    );

    expect(result.draft.status).toBe("pending_approval");
    expect(result.notification.type).toBe("approval_required");
    expect(result.notification.relatedEntityType).toBe("outbound_draft");
    expect(result.notification.relatedEntityId).toBe(draft.id);
    expect(persistedDraft).toEqual(result.draft);
    expect(persistedNotification).toEqual(result.notification);
    expect(auditTrail).toHaveLength(1);
    expect(auditTrail[0]?.fromState).toBe("draft");
    expect(auditTrail[0]?.toState).toBe("pending_approval");
  });

  test("requestOutboundDraftExecution rejects when outbound draft is missing", async () => {
    const repository = makeInMemoryCoreRepository();

    await expect(
      Effect.runPromise(
        requestOutboundDraftExecution(
          repository,
          "outbound-draft-missing",
          { id: "user-1", kind: "user" },
          new Date("2026-02-23T14:05:00.000Z"),
        ),
      ),
    ).rejects.toThrow("outbound draft outbound-draft-missing was not found");
  });

  test("requestOutboundDraftExecution rejects when outbound draft is not in draft state", async () => {
    const repository = makeInMemoryCoreRepository();
    const pendingDraft: OutboundDraft = {
      id: "outbound-draft-pending",
      payload: "Already pending",
      sourceSignalId: "signal-2",
      status: "pending_approval",
      createdAt: "2026-02-23T14:00:00.000Z",
      updatedAt: "2026-02-23T14:01:00.000Z",
    };
    await Effect.runPromise(
      repository.saveEntity("outbound_draft", pendingDraft.id, pendingDraft),
    );

    await expect(
      Effect.runPromise(
        requestOutboundDraftExecution(
          repository,
          pendingDraft.id,
          { id: "user-1", kind: "user" },
          new Date("2026-02-23T14:05:00.000Z"),
        ),
      ),
    ).rejects.toThrow("must be in draft before requesting approval");
  });

  test("requestOutboundDraftExecution rolls back draft state when audit append fails", async () => {
    const repository = makeInMemoryCoreRepository();
    const draft = await Effect.runPromise(
      createOutboundDraft({
        id: "outbound-draft-rollback",
        payload: "Email customer launch details",
        sourceSignalId: "signal-rollback",
        createdAt: new Date("2026-02-23T14:00:00.000Z"),
        updatedAt: new Date("2026-02-23T14:00:00.000Z"),
      }),
    );
    await Effect.runPromise(
      repository.saveEntity("outbound_draft", draft.id, draft),
    );

    const failingRepository: CoreRepository = {
      ...repository,
      appendAuditTransition: (_transition) =>
        Effect.fail(new Error("audit persistence unavailable")).pipe(
          Effect.orDie,
        ),
    };

    await expect(
      Effect.runPromise(
        requestOutboundDraftExecution(
          failingRepository,
          draft.id,
          { id: "user-1", kind: "user" },
          new Date("2026-02-23T14:05:00.000Z"),
        ),
      ),
    ).rejects.toThrow("audit persistence unavailable");

    const persistedDraft = await Effect.runPromise(
      repository.getEntity<OutboundDraft>("outbound_draft", draft.id),
    );
    const notifications = await Effect.runPromise(
      repository.listEntities("notification"),
    );
    const auditTrail = await Effect.runPromise(
      repository.listAuditTrail({
        entityType: "outbound_draft",
        entityId: draft.id,
      }),
    );

    expect(persistedDraft?.status).toBe("draft");
    expect(notifications).toHaveLength(0);
    expect(auditTrail).toHaveLength(0);
  });

  test("requestOutboundDraftExecution does not move draft when notification save fails", async () => {
    const repository = makeInMemoryCoreRepository();
    const draft = await Effect.runPromise(
      createOutboundDraft({
        id: "outbound-draft-notification-fail",
        payload: "Email customer launch details",
        sourceSignalId: "signal-notification-fail",
        createdAt: new Date("2026-02-23T14:00:00.000Z"),
        updatedAt: new Date("2026-02-23T14:00:00.000Z"),
      }),
    );
    await Effect.runPromise(
      repository.saveEntity("outbound_draft", draft.id, draft),
    );

    const failingRepository: CoreRepository = {
      ...repository,
      saveEntity: (entityType, entityId, entity) => {
        if (entityType === "notification") {
          return Effect.fail(
            new Error("notification persistence unavailable"),
          ).pipe(Effect.orDie);
        }

        return repository.saveEntity(entityType, entityId, entity);
      },
    };

    await expect(
      Effect.runPromise(
        requestOutboundDraftExecution(
          failingRepository,
          draft.id,
          { id: "user-1", kind: "user" },
          new Date("2026-02-23T14:05:00.000Z"),
        ),
      ),
    ).rejects.toThrow("notification persistence unavailable");

    const persistedDraft = await Effect.runPromise(
      repository.getEntity<OutboundDraft>("outbound_draft", draft.id),
    );
    const notifications = await Effect.runPromise(
      repository.listEntities("notification"),
    );
    const auditTrail = await Effect.runPromise(
      repository.listAuditTrail({
        entityType: "outbound_draft",
        entityId: draft.id,
      }),
    );

    expect(persistedDraft?.status).toBe("draft");
    expect(notifications).toHaveLength(0);
    expect(auditTrail).toHaveLength(0);
  });
});
