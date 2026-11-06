import { createHash, randomBytes } from "node:crypto";
import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { apiTokens } from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";
import { MAX_ACTIVE_TOKENS, MAX_TOKEN_NAME_LENGTH } from "./token-limits";
import { isUuid } from "./uuid";

export const TOKEN_PREFIX = "lt_";
const TOKEN_BYTES = 32;

const tokenFields = {
  id: apiTokens.id,
  name: apiTokens.name,
  createdAt: apiTokens.createdAt,
  lastUsedAt: apiTokens.lastUsedAt,
};

/** A token is long and random, so a fast hash is safe here, unlike a password. */
export function hashToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex");
}

function generateToken() {
  return TOKEN_PREFIX + randomBytes(TOKEN_BYTES).toString("base64url");
}

/** Active tokens, newest first. Hashes never leave this file. */
export function listTokens(db: Db, userId: string) {
  return db
    .select(tokenFields)
    .from(apiTokens)
    .where(and(eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt)))
    .orderBy(desc(apiTokens.createdAt), desc(apiTokens.id));
}

/** `rawToken` exists only in this result; it can't be read again later. */
export function createToken(db: Db, userId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > MAX_TOKEN_NAME_LENGTH) {
    return Promise.resolve({ kind: "invalid_name" } as const);
  }

  return db.transaction(async (tx) => {
    // Two requests at once must not both see room under the limit.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);

    const [{ total }] = await tx
      .select({ total: count() })
      .from(apiTokens)
      .where(and(eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt)));
    if (total >= MAX_ACTIVE_TOKENS) return { kind: "limit_reached" } as const;

    const rawToken = generateToken();
    const [token] = await tx
      .insert(apiTokens)
      .values({ userId, name: trimmed, tokenHash: hashToken(rawToken) })
      .returning(tokenFields);
    return { kind: "created", token, rawToken } as const;
  });
}

/** Returns false for another user's token, the same as for a missing one. */
export async function revokeToken(db: Db, userId: string, tokenId: string) {
  if (!isUuid(tokenId)) return false;

  const revoked = await db
    .update(apiTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(apiTokens.userId, userId),
        eq(apiTokens.id, tokenId),
        isNull(apiTokens.revokedAt),
      ),
    )
    .returning({ id: apiTokens.id });
  return revoked.length > 0;
}

/**
 * The one lookup without a `userId`, because it is how MCP finds the user.
 * Returns that user's id, or null for a wrong or revoked token.
 */
export async function verifyToken(db: Db, rawToken: string, now: Date) {
  if (!rawToken.startsWith(TOKEN_PREFIX)) return null;

  const [token] = await db
    .update(apiTokens)
    .set({ lastUsedAt: now })
    .where(
      and(
        eq(apiTokens.tokenHash, hashToken(rawToken)),
        isNull(apiTokens.revokedAt),
      ),
    )
    .returning({ userId: apiTokens.userId });
  return token?.userId ?? null;
}
