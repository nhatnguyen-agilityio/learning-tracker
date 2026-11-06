"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { deleteResource } from "@/domain/resources";
import { requireUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";

export async function removeResource(resourceId: string) {
  const userId = await requireUserId();
  const deleted = await deleteResource(getDb(), userId, resourceId);
  if (!deleted) return false;

  revalidatePath("/library");
  revalidatePath(`/library/${resourceId}`);
  redirect("/library");
}
