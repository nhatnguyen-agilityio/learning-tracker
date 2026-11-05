import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { SIGN_IN_PATH } from "./routes";
import { createClient } from "./server";

/** Verifies the session token. Returns null when nobody is signed in. */
export const getUserId = cache(async (): Promise<string | null> => {
  // Checking the token reads the clock, so this must not run while prerendering.
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims.sub ?? null;
});

/**
 * The real access check. src/proxy.ts only redirects early, so every page,
 * Server Action and Route Handler that reads user data must call this.
 */
export async function requireUserId(): Promise<string> {
  const userId = await getUserId();
  if (!userId) redirect(SIGN_IN_PATH);
  return userId;
}
