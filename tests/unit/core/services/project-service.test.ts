import { describe, expect, test } from "bun:test";
import { Either, Effect } from "effect";

import { makeInMemoryCoreRepository } from "../../../../src/core/repositories/in-memory-core-repository";
import {
  createProjectInService,
  listProjects,
  ProjectServiceError,
  setProjectLifecycle,
  updateProjectInService,
} from "../../../../src/core/services/project-service";

describe("project-service", () => {
  test("createProjectInService persists project and appends none->active transition", async () => {
    const repository = makeInMemoryCoreRepository();

    const created = await Effect.runPromise(
      createProjectInService(repository, {
        projectId: "project-1",
        name: "Launch prep",
        description: "Ship v2",
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-24T09:00:00.000Z"),
      }),
    );

    const persisted = await Effect.runPromise(
      repository.getEntity("project", "project-1"),
    );
    const auditTrail = await Effect.runPromise(
      repository.listAuditTrail({ entityType: "project", entityId: "project-1" }),
    );

    expect(created.lifecycle).toBe("active");
    expect(persisted).toEqual(created);
    expect(auditTrail).toHaveLength(1);
    expect(auditTrail[0]?.fromState).toBe("none");
    expect(auditTrail[0]?.toState).toBe("active");
  });

  test("createProjectInService returns conflict when projectId already exists", async () => {
    const repository = makeInMemoryCoreRepository();
    await Effect.runPromise(
      createProjectInService(repository, {
        projectId: "project-conflict-1",
        name: "Existing",
        actor: { id: "user-1", kind: "user" },
      }),
    );

    const result = await Effect.runPromise(
      Effect.either(
        createProjectInService(repository, {
          projectId: "project-conflict-1",
          name: "Duplicate",
          actor: { id: "user-2", kind: "user" },
        }),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toBeInstanceOf(ProjectServiceError);
      expect(result.left).toMatchObject({
        code: "conflict",
        message: "project project-conflict-1 already exists",
      });
    }
  });

  test("updateProjectInService updates editable fields and appends audit transition", async () => {
    const repository = makeInMemoryCoreRepository();

    await Effect.runPromise(
      createProjectInService(repository, {
        projectId: "project-2",
        name: "Initial name",
        description: "Initial description",
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-24T09:05:00.000Z"),
      }),
    );

    const updated = await Effect.runPromise(
      updateProjectInService(repository, {
        projectId: "project-2",
        name: "Updated name",
        description: "Updated description",
        actor: { id: "user-2", kind: "user" },
        at: new Date("2026-02-24T09:10:00.000Z"),
      }),
    );

    const persisted = await Effect.runPromise(
      repository.getEntity("project", "project-2"),
    );
    const auditTrail = await Effect.runPromise(
      repository.listAuditTrail({ entityType: "project", entityId: "project-2" }),
    );

    expect(updated.name).toBe("Updated name");
    expect(updated.description).toBe("Updated description");
    expect(updated.updatedAt).toBe("2026-02-24T09:10:00.000Z");
    expect(persisted).toEqual(updated);
    expect(auditTrail).toHaveLength(2);
    expect(auditTrail[1]?.fromState).toBe("active");
    expect(auditTrail[1]?.toState).toBe("active");
  });

  test("setProjectLifecycle transitions lifecycle and appends audit transition", async () => {
    const repository = makeInMemoryCoreRepository();

    await Effect.runPromise(
      createProjectInService(repository, {
        projectId: "project-3",
        name: "Lifecycle test",
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-24T09:15:00.000Z"),
      }),
    );

    const paused = await Effect.runPromise(
      setProjectLifecycle(
        repository,
        "project-3",
        "paused",
        { id: "user-1", kind: "user" },
        new Date("2026-02-24T09:20:00.000Z"),
      ),
    );

    const auditTrail = await Effect.runPromise(
      repository.listAuditTrail({ entityType: "project", entityId: "project-3" }),
    );

    expect(paused.lifecycle).toBe("paused");
    expect(paused.updatedAt).toBe("2026-02-24T09:20:00.000Z");
    expect(auditTrail).toHaveLength(2);
    expect(auditTrail[1]?.fromState).toBe("active");
    expect(auditTrail[1]?.toState).toBe("paused");
  });

  test("listProjects supports optional lifecycle filter and deterministic ordering", async () => {
    const repository = makeInMemoryCoreRepository();

    await Effect.runPromise(
      createProjectInService(repository, {
        projectId: "project-a",
        name: "A",
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-24T10:00:00.000Z"),
      }),
    );
    await Effect.runPromise(
      createProjectInService(repository, {
        projectId: "project-b",
        name: "B",
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-24T10:00:00.000Z"),
      }),
    );
    await Effect.runPromise(
      createProjectInService(repository, {
        projectId: "project-c",
        name: "C",
        actor: { id: "user-1", kind: "user" },
        at: new Date("2026-02-24T09:50:00.000Z"),
      }),
    );
    await Effect.runPromise(
      setProjectLifecycle(
        repository,
        "project-c",
        "paused",
        { id: "user-1", kind: "user" },
        new Date("2026-02-24T10:05:00.000Z"),
      ),
    );

    const all = await Effect.runPromise(listProjects(repository));
    const active = await Effect.runPromise(
      listProjects(repository, { lifecycle: "active" }),
    );
    const paused = await Effect.runPromise(
      listProjects(repository, { lifecycle: "paused" }),
    );

    expect(all.map((project) => project.id)).toEqual([
      "project-c",
      "project-b",
      "project-a",
    ]);
    expect(active.map((project) => project.id)).toEqual([
      "project-b",
      "project-a",
    ]);
    expect(paused.map((project) => project.id)).toEqual(["project-c"]);
  });

  test("updateProjectInService returns not_found when project is missing", async () => {
    const repository = makeInMemoryCoreRepository();

    const result = await Effect.runPromise(
      Effect.either(
        updateProjectInService(repository, {
          projectId: "project-missing-404",
          name: "Missing",
          actor: { id: "user-1", kind: "user" },
          at: new Date("2026-02-24T09:30:00.000Z"),
        }),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toBeInstanceOf(ProjectServiceError);
      expect(result.left).toMatchObject({
        message: "project project-missing-404 was not found",
        code: "not_found",
      });
    }
  });

  test("updateProjectInService rejects empty update payload", async () => {
    const repository = makeInMemoryCoreRepository();
    await Effect.runPromise(
      createProjectInService(repository, {
        projectId: "project-empty-update-1",
        name: "No-op candidate",
        actor: { id: "user-1", kind: "user" },
      }),
    );

    const result = await Effect.runPromise(
      Effect.either(
        updateProjectInService(repository, {
          projectId: "project-empty-update-1",
          actor: { id: "user-2", kind: "user" },
        }),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toBeInstanceOf(ProjectServiceError);
      expect(result.left).toMatchObject({
        code: "invalid_request",
        message: "at least one project field must be provided for update",
      });
    }
  });

  test("setProjectLifecycle returns not_found when project is missing", async () => {
    const repository = makeInMemoryCoreRepository();

    const result = await Effect.runPromise(
      Effect.either(
        setProjectLifecycle(
          repository,
          "project-missing-405",
          "completed",
          { id: "user-1", kind: "user" },
          new Date("2026-02-24T09:35:00.000Z"),
        ),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toBeInstanceOf(ProjectServiceError);
      expect(result.left).toMatchObject({
        message: "project project-missing-405 was not found",
        code: "not_found",
      });
    }
  });
});
