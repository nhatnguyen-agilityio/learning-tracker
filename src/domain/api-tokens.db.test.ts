import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { apiTokens } from "@/lib/db/schema";
import { SEEDED_USERS, withTestDb } from "@/lib/db/test-db";
import type { Db } from "@/lib/db/types";
import {
  createToken,
  hashToken,
  listTokens,
  revokeToken,
  verifyToken,
} from "./api-tokens";
import { MAX_ACTIVE_TOKENS, MAX_TOKEN_NAME_LENGTH } from "./token-limits";

const { a: userA, b: userB } = SEEDED_USERS;
const now = new Date("2026-11-06T12:00:00Z");

async function addToken(db: Db, userId: string, name = "Laptop") {
  const result = await createToken(db, userId, name);
  if (result.kind !== "created") throw new Error("Token not created");
  return result;
}

/** Starts from an account with no tokens; `withTestDb` rolls this back. */
function withNoTokens(test: (db: Db) => Promise<void>) {
  return withTestDb(async (db) => {
    await db.delete(apiTokens).where(eq(apiTokens.userId, userA));
    await test(db);
  });
}

describe("creating tokens", () => {
  it("should store only the hash of the token", () =>
    withNoTokens(async (db) => {
      const { rawToken, token } = await addToken(db, userA);

      const rows = await db
        .select()
        .from(apiTokens)
        .where(eq(apiTokens.id, token.id));

      expect(rows[0].tokenHash).toBe(hashToken(rawToken));
      expect(JSON.stringify(rows)).not.toContain(rawToken);
    }));

  it("should give a different token each time", () =>
    withNoTokens(async (db) => {
      const first = await addToken(db, userA);
      const second = await addToken(db, userA);

      expect(first.rawToken).not.toBe(second.rawToken);
      expect(first.rawToken.length).toBeGreaterThan(40);
    }));

  it.each(["", "   ", "a".repeat(MAX_TOKEN_NAME_LENGTH + 1)])(
    "should refuse the name %j",
    (name) =>
      withNoTokens(async (db) => {
        expect(await createToken(db, userA, name)).toEqual({
          kind: "invalid_name",
        });
      }),
  );

  it("should stop at the limit of active tokens", () =>
    withNoTokens(async (db) => {
      for (let index = 0; index < MAX_ACTIVE_TOKENS; index += 1) {
        await addToken(db, userA);
      }

      expect(await createToken(db, userA, "One more")).toEqual({
        kind: "limit_reached",
      });
    }));

  it("should not count revoked tokens toward the limit", () =>
    withNoTokens(async (db) => {
      let last = await addToken(db, userA);
      for (let index = 1; index < MAX_ACTIVE_TOKENS; index += 1) {
        last = await addToken(db, userA);
      }
      await revokeToken(db, userA, last.token.id);

      const result = await createToken(db, userA, "Replacement");

      expect(result.kind).toBe("created");
    }));
});

describe("listing tokens", () => {
  it("should leave out revoked tokens", () =>
    withNoTokens(async (db) => {
      const kept = await addToken(db, userA, "Kept");
      const gone = await addToken(db, userA, "Gone");
      await revokeToken(db, userA, gone.token.id);

      const rows = await listTokens(db, userA);

      expect(rows.map((row) => row.id)).toEqual([kept.token.id]);
    }));

  it("should never return the hash", () =>
    withNoTokens(async (db) => {
      await addToken(db, userA);

      const [row] = await listTokens(db, userA);

      expect(Object.keys(row).sort()).toEqual([
        "createdAt",
        "id",
        "lastUsedAt",
        "name",
      ]);
    }));

  it("should not list another user's tokens", () =>
    withNoTokens(async (db) => {
      const other = await addToken(db, userB);

      const rows = await listTokens(db, userA);

      expect(rows.map((row) => row.id)).not.toContain(other.token.id);
    }));
});

describe("revoking tokens", () => {
  it("should not revoke another user's token", () =>
    withNoTokens(async (db) => {
      const other = await addToken(db, userB);

      expect(await revokeToken(db, userA, other.token.id)).toBe(false);
      expect(await verifyToken(db, other.rawToken, now)).toBe(userB);
    }));

  it("should return false when revoking twice", () =>
    withNoTokens(async (db) => {
      const { token } = await addToken(db, userA);

      expect(await revokeToken(db, userA, token.id)).toBe(true);
      expect(await revokeToken(db, userA, token.id)).toBe(false);
    }));

  it("should return false when the id is not valid", () =>
    withNoTokens(async (db) => {
      expect(await revokeToken(db, userA, "nope")).toBe(false);
    }));
});

describe("verifying tokens", () => {
  it("should return the owner and record the use", () =>
    withNoTokens(async (db) => {
      const { rawToken } = await addToken(db, userA);

      expect(await verifyToken(db, rawToken, now)).toBe(userA);

      const [row] = await listTokens(db, userA);
      expect(row.lastUsedAt).toEqual(now);
    }));

  it("should refuse a revoked token", () =>
    withNoTokens(async (db) => {
      const { rawToken, token } = await addToken(db, userA);
      await revokeToken(db, userA, token.id);

      expect(await verifyToken(db, rawToken, now)).toBeNull();
    }));

  it("should refuse a wrong token", () =>
    withNoTokens(async (db) => {
      expect(await verifyToken(db, "lt_wrong", now)).toBeNull();
      expect(await verifyToken(db, "wrong", now)).toBeNull();
    }));

  it("should refuse the stored hash used as a token", () =>
    withNoTokens(async (db) => {
      const { rawToken } = await addToken(db, userA);

      expect(await verifyToken(db, hashToken(rawToken), now)).toBeNull();
    }));
});
