"use server";

import { revalidatePath } from "next/cache";
import { updateUserSettings } from "@/domain/user-settings";
import { requireUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";

async function save(changes: { newCardsPerDay?: number; timezone?: string }) {
  const userId = await requireUserId();
  const result = await updateUserSettings(getDb(), userId, changes);

  if (result?.kind !== "updated") return false;
  revalidatePath("/");
  revalidatePath("/settings");
  return true;
}

export async function saveNewCardsPerDay(newCardsPerDay: number) {
  return save({ newCardsPerDay });
}

export async function saveTimezone(timezone: string) {
  return save({ timezone });
}
