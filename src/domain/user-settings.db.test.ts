import { inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { userSettings } from "@/lib/db/schema";
import { SEEDED_USERS, withTestDb } from "@/lib/db/test-db";
import type { Db } from "@/lib/db/types";
import { ensureUserSettings, getUserSettings } from "./user-settings";

const { a: userA, b: userB } = SEEDED_USERS;
const defaults = { timezone: "Asia/Ho_Chi_Minh", locale: "vi" };

/** E2E sign-ins leave settings on the seeded users; this removes them until rollback. */
function withoutSettings(test: (db: Db) => Promise<void>) {
  return withTestDb(async (db) => {
    await db
      .delete(userSettings)
      .where(inArray(userSettings.userId, [userA, userB]));
    await test(db);
  });
}

describe("user settings", () => {
  it("should create settings when the user signs in for the first time", () =>
    withoutSettings(async (db) => {
      const settings = await ensureUserSettings(db, userA, defaults);

      expect(settings).toEqual({ ...defaults, newCardsPerDay: 20 });
    }));

  it("should keep settings when the user signs in again", () =>
    withoutSettings(async (db) => {
      await ensureUserSettings(db, userA, defaults);

      const settings = await ensureUserSettings(db, userA, {
        timezone: "Europe/Paris",
        locale: "en",
      });

      expect(settings).toMatchObject(defaults);
    }));

  it("should not read settings when they belong to another user", () =>
    withoutSettings(async (db) => {
      await ensureUserSettings(db, userB, defaults);

      expect(await getUserSettings(db, userA)).toBeNull();
    }));
});
