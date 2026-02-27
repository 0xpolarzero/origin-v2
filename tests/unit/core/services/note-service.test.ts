import { describe, expect, test } from "bun:test";
import { Either, Effect } from "effect";

import { makeInMemoryCoreRepository } from "../../../../src/core/repositories/in-memory-core-repository";
import {
  createNoteInService,
  linkNoteEntity,
  listNotes,
  NoteServiceError,
  unlinkNoteEntity,
  updateNoteBody,
} from "../../../../src/core/services/note-service";

describe("note-service", () => {
  test("createNoteInService persists note and appends create transition", async () => {
    const repository = makeInMemoryCoreRepository();

    const created = await Effect.runPromise(
      createNoteInService(repository, {
        noteId: "note-1",
        body: "Capture launch learnings",
        linkedEntityRefs: ["task:3", "project:1", "task:3", "entry:2"],
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-24T11:00:00.000Z"),
      }),
    );

    const persisted = await Effect.runPromise(repository.getEntity("note", "note-1"));
    const auditTrail = await Effect.runPromise(
      repository.listAuditTrail({ entityType: "note", entityId: "note-1" }),
    );

    expect(created.linkedEntityRefs).toEqual(["entry:2", "project:1", "task:3"]);
    expect(persisted).toEqual(created);
    expect(auditTrail).toHaveLength(1);
    expect(auditTrail[0]?.fromState).toBe("none");
    expect(auditTrail[0]?.toState).toBe("created");
  });

  test("createNoteInService returns conflict when noteId already exists", async () => {
    const repository = makeInMemoryCoreRepository();
    await Effect.runPromise(
      createNoteInService(repository, {
        noteId: "note-conflict-1",
        body: "Existing",
        actor: { id: "user-1", kind: "user" },
      }),
    );

    const result = await Effect.runPromise(
      Effect.either(
        createNoteInService(repository, {
          noteId: "note-conflict-1",
          body: "Duplicate",
          actor: { id: "user-2", kind: "user" },
        }),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toBeInstanceOf(NoteServiceError);
      expect(result.left).toMatchObject({
        code: "conflict",
        message: "note note-conflict-1 already exists",
      });
    }
  });

  test("updateNoteBody updates body and appends audit transition", async () => {
    const repository = makeInMemoryCoreRepository();

    await Effect.runPromise(
      createNoteInService(repository, {
        noteId: "note-2",
        body: "Original body",
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-24T11:05:00.000Z"),
      }),
    );

    const updated = await Effect.runPromise(
      updateNoteBody(
        repository,
        "note-2",
        "Updated body",
        { id: "user-2", kind: "user" },
        new Date("2026-02-24T11:10:00.000Z"),
      ),
    );

    const persisted = await Effect.runPromise(repository.getEntity("note", "note-2"));
    const auditTrail = await Effect.runPromise(
      repository.listAuditTrail({ entityType: "note", entityId: "note-2" }),
    );

    expect(updated.body).toBe("Updated body");
    expect(updated.updatedAt).toBe("2026-02-24T11:10:00.000Z");
    expect(persisted).toEqual(updated);
    expect(auditTrail).toHaveLength(2);
    expect(auditTrail[1]?.reason).toBe("Note body updated");
  });

  test("linkNoteEntity keeps links deduped and sorted when called repeatedly", async () => {
    const repository = makeInMemoryCoreRepository();

    await Effect.runPromise(
      createNoteInService(repository, {
        noteId: "note-3",
        body: "Linking note",
        linkedEntityRefs: ["task:2"],
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-24T11:15:00.000Z"),
      }),
    );

    await Effect.runPromise(
      linkNoteEntity(
        repository,
        "note-3",
        "project:1",
        { id: "user-1", kind: "user" },
        new Date("2026-02-24T11:16:00.000Z"),
      ),
    );
    const linkedAgain = await Effect.runPromise(
      linkNoteEntity(
        repository,
        "note-3",
        "project:1",
        { id: "user-1", kind: "user" },
        new Date("2026-02-24T11:17:00.000Z"),
      ),
    );

    const auditTrail = await Effect.runPromise(
      repository.listAuditTrail({ entityType: "note", entityId: "note-3" }),
    );

    expect(linkedAgain.linkedEntityRefs).toEqual(["project:1", "task:2"]);
    expect(auditTrail).toHaveLength(3);
    expect(auditTrail[2]?.metadata).toEqual({
      entityRef: "project:1",
      action: "noop",
    });
  });

  test("unlinkNoteEntity removes links and is idempotent when link is missing", async () => {
    const repository = makeInMemoryCoreRepository();

    await Effect.runPromise(
      createNoteInService(repository, {
        noteId: "note-4",
        body: "Unlinking note",
        linkedEntityRefs: ["entry:1", "task:2"],
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-24T11:20:00.000Z"),
      }),
    );

    await Effect.runPromise(
      unlinkNoteEntity(
        repository,
        "note-4",
        "task:2",
        { id: "user-1", kind: "user" },
        new Date("2026-02-24T11:21:00.000Z"),
      ),
    );
    const unlinkedAgain = await Effect.runPromise(
      unlinkNoteEntity(
        repository,
        "note-4",
        "task:2",
        { id: "user-1", kind: "user" },
        new Date("2026-02-24T11:22:00.000Z"),
      ),
    );

    const auditTrail = await Effect.runPromise(
      repository.listAuditTrail({ entityType: "note", entityId: "note-4" }),
    );

    expect(unlinkedAgain.linkedEntityRefs).toEqual(["entry:1"]);
    expect(auditTrail).toHaveLength(3);
    expect(auditTrail[2]?.metadata).toEqual({
      entityRef: "task:2",
      action: "noop",
    });
  });

  test("listNotes supports optional entityRef filter and deterministic ordering", async () => {
    const repository = makeInMemoryCoreRepository();

    await Effect.runPromise(
      createNoteInService(repository, {
        noteId: "note-a",
        body: "A",
        linkedEntityRefs: ["task:1"],
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-24T12:00:00.000Z"),
      }),
    );
    await Effect.runPromise(
      createNoteInService(repository, {
        noteId: "note-b",
        body: "B",
        linkedEntityRefs: ["task:1"],
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-24T12:00:00.000Z"),
      }),
    );
    await Effect.runPromise(
      createNoteInService(repository, {
        noteId: "note-c",
        body: "C",
        linkedEntityRefs: ["project:1"],
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-24T12:05:00.000Z"),
      }),
    );

    const all = await Effect.runPromise(listNotes(repository));
    const taskLinked = await Effect.runPromise(
      listNotes(repository, { entityRef: "task:1" }),
    );

    expect(all.map((note) => note.id)).toEqual(["note-c", "note-b", "note-a"]);
    expect(taskLinked.map((note) => note.id)).toEqual(["note-b", "note-a"]);
  });

  test("missing note operations return not_found errors", async () => {
    const repository = makeInMemoryCoreRepository();

    const updateResult = await Effect.runPromise(
      Effect.either(
        updateNoteBody(
          repository,
          "note-missing-404",
          "Updated",
          { id: "user-1", kind: "user" },
          new Date("2026-02-24T12:10:00.000Z"),
        ),
      ),
    );
    const linkResult = await Effect.runPromise(
      Effect.either(
        linkNoteEntity(
          repository,
          "note-missing-405",
          "task:1",
          { id: "user-1", kind: "user" },
          new Date("2026-02-24T12:11:00.000Z"),
        ),
      ),
    );
    const unlinkResult = await Effect.runPromise(
      Effect.either(
        unlinkNoteEntity(
          repository,
          "note-missing-406",
          "task:1",
          { id: "user-1", kind: "user" },
          new Date("2026-02-24T12:12:00.000Z"),
        ),
      ),
    );

    expect(Either.isLeft(updateResult)).toBe(true);
    expect(Either.isLeft(linkResult)).toBe(true);
    expect(Either.isLeft(unlinkResult)).toBe(true);

    if (Either.isLeft(updateResult)) {
      expect(updateResult.left).toBeInstanceOf(NoteServiceError);
      expect(updateResult.left).toMatchObject({
        message: "note note-missing-404 was not found",
        code: "not_found",
      });
    }
    if (Either.isLeft(linkResult)) {
      expect(linkResult.left).toBeInstanceOf(NoteServiceError);
      expect(linkResult.left).toMatchObject({
        message: "note note-missing-405 was not found",
        code: "not_found",
      });
    }
    if (Either.isLeft(unlinkResult)) {
      expect(unlinkResult.left).toBeInstanceOf(NoteServiceError);
      expect(unlinkResult.left).toMatchObject({
        message: "note note-missing-406 was not found",
        code: "not_found",
      });
    }
  });
});
