import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import {
  createOutboundDraft,
  OutboundDraft,
} from "../../../../src/core/domain/outbound-draft";
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
});
