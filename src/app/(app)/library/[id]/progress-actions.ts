"use server";

import { revalidatePath } from "next/cache";
import { setResourceProgress, setResourceStatus } from "@/domain/resources";
import { requireUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";

function refreshPages(resourceId: string) {
  revalidatePath("/library");
  revalidatePath(`/library/${resourceId}`);
}

export async function saveProgress(resourceId: string, progress: number) {
  const userId = await requireUserId();
  const result = await setResourceProgress(
    getDb(),
    userId,
    resourceId,
    progress,
  );

  if (result?.kind !== "updated") return false;
  refreshPages(resourceId);
  return true;
}

export async function saveStatus(resourceId: string, status: string) {
  const userId = await requireUserId();
  const result = await setResourceStatus(getDb(), userId, resourceId, status);

  if (result?.kind !== "updated") return false;
  refreshPages(resourceId);
  return true;
}
