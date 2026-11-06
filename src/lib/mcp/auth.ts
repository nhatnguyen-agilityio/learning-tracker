import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "@/lib/auth/env";

/** Reads the token from `Authorization: Bearer <token>`. */
export function readBearerToken(header: string | null) {
  return header?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? null;
}

/**
 * Only tokens from the OAuth flow carry `client_id`. A web session token
 * doesn't, so it can't be used against MCP.
 */
export function userIdFromClaims(
  claims: { sub?: unknown; client_id?: unknown } | null | undefined,
) {
  if (typeof claims?.client_id !== "string" || !claims.client_id) return null;
  return typeof claims.sub === "string" && claims.sub ? claims.sub : null;
}

/** Checks the signature with Supabase and returns the token's user. */
export async function verifyOAuthToken(token: string) {
  const { url, anonKey } = supabaseEnv();
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client.auth.getClaims(token);
  return error ? null : userIdFromClaims(data?.claims);
}
