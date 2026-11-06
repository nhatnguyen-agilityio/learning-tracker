/**
 * Only the OAuth flow puts `client_id` in a token. That token belongs to a
 * connected app, so it must never count as a web session, even in a cookie.
 */
export function webUserIdFromClaims(
  claims: { sub?: unknown; client_id?: unknown } | null | undefined,
) {
  if (claims?.client_id !== undefined) return null;
  return typeof claims?.sub === "string" && claims.sub ? claims.sub : null;
}
