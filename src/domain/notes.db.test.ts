import { describe, expect, it } from "vitest";
import { SEEDED_USERS, withTestDb } from "@/lib/db/test-db";
import type { Db } from "@/lib/db/types";
import { MAX_NOTE_BYTES, noteBytes } from "./note-limits";
import { createNote, deleteNote, listNotes, updateNote } from "./notes";
import { createResource } from "./resources";

const { a: userA, b: userB } = SEEDED_USERS;

async function addResource(db: Db, userId: string) {
  const result = await createResource(db, userId, {
    url: `https://notes.test/${crypto.randomUUID()}`,
    title: "Guide",
  });
  if (result.kind !== "created") throw new Error("Resource not created");
  return result.resource.id;
}

async function addNote(db: Db, userId: string, content = "Note") {
  const resourceId = await addResource(db, userId);
  const result = await createNote(db, userId, resourceId, content);
  if (result?.kind !== "created") throw new Error("Note not created");
  return { resourceId, noteId: result.note.id };
}

describe("noteBytes", () => {
  it("should count bytes when the text has Vietnamese accents", () => {
    expect(noteBytes("ệ")).toBe(3);
    expect(noteBytes("e")).toBe(1);
  });
});

describe("creating notes", () => {
  it("should create the note when the content is valid", () =>
    withTestDb(async (db) => {
      const resourceId = await addResource(db, userA);

      const result = await createNote(db, userA, resourceId, "# Hello");

      expect(result).toMatchObject({
        kind: "created",
        note: { contentMd: "# Hello" },
      });
    }));

  it("should create an empty note when no content is given", () =>
    withTestDb(async (db) => {
      const resourceId = await addResource(db, userA);

      const result = await createNote(db, userA, resourceId);

      expect(result).toMatchObject({ note: { contentMd: "" } });
    }));

  it("should refuse the content when it is over 100 KB", () =>
    withTestDb(async (db) => {
      const resourceId = await addResource(db, userA);

      const result = await createNote(
        db,
        userA,
        resourceId,
        "a".repeat(MAX_NOTE_BYTES + 1),
      );

      expect(result).toEqual({ kind: "too_large" });
    }));

  it("should accept the content when it is exactly 100 KB", () =>
    withTestDb(async (db) => {
      const resourceId = await addResource(db, userA);

      const result = await createNote(
        db,
        userA,
        resourceId,
        "a".repeat(MAX_NOTE_BYTES),
      );

      expect(result?.kind).toBe("created");
    }));

  it("should not add a note to another user's resource", () =>
    withTestDb(async (db) => {
      const otherResource = await addResource(db, userB);

      expect(await createNote(db, userA, otherResource, "Hi")).toBeNull();
      expect(await listNotes(db, userB, otherResource)).toEqual([]);
    }));
});

describe("reading notes", () => {
  it("should list notes of the resource oldest first", () =>
    withTestDb(async (db) => {
      const resourceId = await addResource(db, userA);
      await createNote(db, userA, resourceId, "First");
      await createNote(db, userA, resourceId, "Second");

      const rows = await listNotes(db, userA, resourceId);

      expect(rows).toHaveLength(2);
    }));

  it("should not read notes when the resource belongs to another user", () =>
    withTestDb(async (db) => {
      const { resourceId } = await addNote(db, userB);

      expect(await listNotes(db, userA, resourceId)).toEqual([]);
    }));
});

describe("updating notes", () => {
  it("should change the content when the owner updates the note", () =>
    withTestDb(async (db) => {
      const { noteId } = await addNote(db, userA);

      const result = await updateNote(db, userA, noteId, "Changed");

      expect(result).toMatchObject({
        kind: "updated",
        note: { contentMd: "Changed" },
      });
    }));

  it("should keep the saved content when an update is too large", () =>
    withTestDb(async (db) => {
      const { resourceId, noteId } = await addNote(db, userA, "Kept");

      const result = await updateNote(
        db,
        userA,
        noteId,
        "ệ".repeat(MAX_NOTE_BYTES / 2),
      );

      expect(result).toEqual({ kind: "too_large" });
      const [note] = await listNotes(db, userA, resourceId);
      expect(note.contentMd).toBe("Kept");
    }));

  it("should return null when updating another user's note", () =>
    withTestDb(async (db) => {
      const { noteId } = await addNote(db, userB);

      expect(await updateNote(db, userA, noteId, "Taken")).toBeNull();
    }));

  it("should return null when the note id is not valid", () =>
    withTestDb(async (db) => {
      expect(await updateNote(db, userA, "not-a-uuid", "Hi")).toBeNull();
    }));
});

describe("deleting notes", () => {
  it("should delete the note when the owner asks", () =>
    withTestDb(async (db) => {
      const { resourceId, noteId } = await addNote(db, userA);

      expect(await deleteNote(db, userA, noteId)).toBe(true);
      expect(await listNotes(db, userA, resourceId)).toEqual([]);
    }));

  it("should not delete another user's note", () =>
    withTestDb(async (db) => {
      const { resourceId, noteId } = await addNote(db, userB);

      expect(await deleteNote(db, userA, noteId)).toBe(false);
      expect(await listNotes(db, userB, resourceId)).toHaveLength(1);
    }));
});
