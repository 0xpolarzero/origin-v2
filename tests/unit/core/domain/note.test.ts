import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

import { createNote } from "../../../../src/core/domain/note";

describe("createNote", () => {
  test("links entity references deterministically", async () => {
    const note = await Effect.runPromise(
      createNote({
        id: "note-1",
        body: "Need budget and launch date",
        linkedEntityRefs: ["task:3", "project:1", "task:3", "entry:2"],
      }),
    );

    expect(note.linkedEntityRefs).toEqual(["entry:2", "project:1", "task:3"]);
  });
});
