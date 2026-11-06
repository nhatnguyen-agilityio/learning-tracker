"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/auth/server";
import { requireUserId } from "@/lib/auth/session";

export async function disconnectApp(clientId: string) {
  await requireUserId();
  const { error } = await (
    await createClient()
  ).auth.oauth.revokeGrant({
    clientId,
  });

  if (error) return false;
  revalidatePath("/settings");
  return true;
}
