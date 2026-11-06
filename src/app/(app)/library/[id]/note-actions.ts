"use server";

import { revalidatePath } from "next/cache";
import { createNote, deleteNote, updateNote } from "@/domain/notes";
import { requireUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";

export async function addNote(resourceId: string) {
  const userId = await requireUserId();
  const result = await createNote(getDb(), userId, resourceId);

  return result?.kind === "created" ? result.note : null;
}

export type SaveNoteResult = "saved" | "too_large" | "failed";

export async function saveNote(
  noteId: string,
  contentMd: string,
): Promise<SaveNoteResult> {
  const userId = await requireUserId();
  const result = await updateNote(getDb(), userId, noteId, contentMd);

  if (!result) return "failed";
  return result.kind === "updated" ? "saved" : "too_large";
}

export async function removeNote(noteId: string, resourceId: string) {
  const userId = await requireUserId();
  const deleted = await deleteNote(getDb(), userId, noteId);

  if (deleted) revalidatePath(`/library/${resourceId}`);
  return deleted;
}
