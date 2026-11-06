import { and, eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { rateLimits } from "@/lib/db/schema";
import { SEEDED_USERS, withTestDb } from "@/lib/db/test-db";
import type { Db } from "@/lib/db/types";
import { checkRateLimit } from "./rate-limit";

const { a: userA, b: userB } = SEEDED_USERS;
const rule = { limit: 2, windowSeconds: 60 };
const action = "test_action";

const attempt = (db: Db, userId: string = userA, name = action) =>
  checkRateLimit(db, userId, name, rule);

describe("checkRateLimit", () => {
  it("should allow the request when the user is under the limit", () =>
    withTestDb(async (db) => {
      expect(await attempt(db)).toBe(true);
      expect(await attempt(db)).toBe(true);
    }));

  it("should refuse the request when the user reaches the limit", () =>
    withTestDb(async (db) => {
      await attempt(db);
      await attempt(db);

      expect(await attempt(db)).toBe(false);
    }));

  it("should allow requests again when the window has passed", () =>
    withTestDb(async (db) => {
      await attempt(db);
      await attempt(db);
      await attempt(db);
      await db
        .update(rateLimits)
        .set({ windowStartedAt: sql`now() - interval '61 seconds'` })
        .where(
          and(eq(rateLimits.userId, userA), eq(rateLimits.action, action)),
        );

      expect(await attempt(db)).toBe(true);
      expect(await attempt(db)).toBe(true);
      expect(await attempt(db)).toBe(false);
    }));

  it("should count each user separately", () =>
    withTestDb(async (db) => {
      await attempt(db);
      await attempt(db);
      await attempt(db);

      expect(await attempt(db, userB)).toBe(true);
    }));

  it("should count each action separately", () =>
    withTestDb(async (db) => {
      await attempt(db);
      await attempt(db);
      await attempt(db);

      expect(await attempt(db, userA, "other_action")).toBe(true);
    }));

  it("should not lose counts when requests are sent together", () =>
    withTestDb(async (db) => {
      const results = await Promise.all(
        Array.from({ length: 5 }, () => attempt(db)),
      );

      expect(results.filter(Boolean)).toHaveLength(rule.limit);
    }));
});
