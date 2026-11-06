"use server";

import { revalidatePath } from "next/cache";
import { deleteTopic, updateTopic } from "@/domain/topics";
import { requireUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";

function refreshPages() {
  revalidatePath("/settings");
  revalidatePath("/library", "layout");
}

export type SaveTopicResult = "saved" | "duplicate" | "invalid_name" | "failed";

export async function saveTopic(
  topicId: string,
  changes: { name: string; color: string },
): Promise<SaveTopicResult> {
  const userId = await requireUserId();
  const result = await updateTopic(getDb(), userId, topicId, changes);

  if (!result || result.kind === "invalid_color") return "failed";
  if (result.kind !== "updated") return result.kind;

  refreshPages();
  return "saved";
}

export async function removeTopic(topicId: string) {
  const userId = await requireUserId();
  const deleted = await deleteTopic(getDb(), userId, topicId);

  if (deleted) refreshPages();
  return deleted;
}
