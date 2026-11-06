import { eq } from "drizzle-orm";
import { authUsers } from "drizzle-orm/supabase";
import type { Db } from "@/lib/db/types";

/**
 * Removes the login itself. Every table's `user_id` cascades from it, so all
 * of the account's data goes in this one delete.
 */
export async function deleteAccount(db: Db, userId: string) {
  const deleted = await db
    .delete(authUsers)
    .where(eq(authUsers.id, userId))
    .returning({ id: authUsers.id });
  return deleted.length > 0;
}
