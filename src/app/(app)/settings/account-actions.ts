"use server";

import { deleteAccount } from "@/domain/delete-account";
import { requireUserId } from "@/lib/auth/session";
import { createClient } from "@/lib/auth/server";
import { getDb } from "@/lib/db/client";

export async function removeAccount() {
  const userId = await requireUserId();
  const deleted = await deleteAccount(getDb(), userId);
  if (!deleted) return false;

  // The user is gone, so this only clears the session cookies in the browser.
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  return true;
}
