import { and, asc, count, eq } from "drizzle-orm";
import { notes } from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";
import { isNoteTooLarge, MAX_NOTES_PER_USER } from "./note-limits";
import { getResource } from "./resources";
import { isUuid } from "./uuid";

const noteFields = {
  id: notes.id,
  contentMd: notes.contentMd,
  updatedAt: notes.updatedAt,
};

export function listNotes(db: Db, userId: string, resourceId: string) {
  return db
    .select(noteFields)
    .from(notes)
    .where(and(eq(notes.userId, userId), eq(notes.resourceId, resourceId)))
    .orderBy(asc(notes.createdAt), asc(notes.id));
}

/** Returns null for another user's resource, the same as for a missing one. */
export async function createNote(
  db: Db,
  userId: string,
  resourceId: string,
  contentMd = "",
) {
  if (isNoteTooLarge(contentMd)) return { kind: "too_large" } as const;

  return db.transaction(async (tx) => {
    const resource = await getResource(tx, userId, resourceId);
    if (!resource) return null;

    const [{ total }] = await tx
      .select({ total: count() })
      .from(notes)
      .where(eq(notes.userId, userId));
    if (total >= MAX_NOTES_PER_USER) return { kind: "limit_reached" } as const;

    const [note] = await tx
      .insert(notes)
      .values({ userId, resourceId, contentMd })
      .returning(noteFields);
    return { kind: "created", note } as const;
  });
}

/** Returns null for another user's note, the same as for a missing one. */
export async function updateNote(
  db: Db,
  userId: string,
  noteId: string,
  contentMd: string,
) {
  if (isNoteTooLarge(contentMd)) return { kind: "too_large" } as const;
  if (!isUuid(noteId)) return null;

  const [note] = await db
    .update(notes)
    .set({ contentMd })
    .where(and(eq(notes.userId, userId), eq(notes.id, noteId)))
    .returning(noteFields);
  return note ? ({ kind: "updated", note } as const) : null;
}

export async function deleteNote(db: Db, userId: string, noteId: string) {
  if (!isUuid(noteId)) return false;

  const deleted = await db
    .delete(notes)
    .where(and(eq(notes.userId, userId), eq(notes.id, noteId)))
    .returning({ id: notes.id });
  return deleted.length > 0;
}
