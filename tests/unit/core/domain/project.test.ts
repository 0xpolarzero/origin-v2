import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { createProject } from "../../../../src/core/domain/project";

describe("createProject", () => {
  test("seeds lifecycle=active", async () => {
    const project = await Effect.runPromise(
      createProject({
        id: "project-1",
        name: "Launch prep",
      }),
    );

    expect(project.id).toBe("project-1");
    expect(project.lifecycle).toBe("active");
    expect(project.name).toBe("Launch prep");
  });
});
