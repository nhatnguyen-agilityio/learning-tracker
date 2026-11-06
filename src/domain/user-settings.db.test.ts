import { inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { userSettings } from "@/lib/db/schema";
import { SEEDED_USERS, withTestDb } from "@/lib/db/test-db";
import type { Db } from "@/lib/db/types";
import {
  ensureUserSettings,
  getUserSettings,
  updateUserSettings,
} from "./user-settings";

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

describe("updating user settings", () => {
  it("should change only the given field", () =>
    withoutSettings(async (db) => {
      await ensureUserSettings(db, userA, defaults);

      const result = await updateUserSettings(db, userA, {
        newCardsPerDay: 5,
      });

      expect(result).toEqual({
        kind: "updated",
        settings: { ...defaults, newCardsPerDay: 5 },
      });
    }));

  it.each([0, 100])("should accept %d new cards per day", (newCardsPerDay) =>
    withoutSettings(async (db) => {
      await ensureUserSettings(db, userA, defaults);

      const result = await updateUserSettings(db, userA, { newCardsPerDay });

      expect(result?.kind).toBe("updated");
    }),
  );

  it.each([-1, 101, 2.5, Number.NaN])(
    "should refuse %d new cards per day",
    (newCardsPerDay) =>
      withoutSettings(async (db) => {
        await ensureUserSettings(db, userA, defaults);

        const result = await updateUserSettings(db, userA, { newCardsPerDay });

        expect(result).toEqual({ kind: "invalid" });
        expect(await getUserSettings(db, userA)).toMatchObject({
          newCardsPerDay: 20,
        });
      }),
  );

  it("should change the time zone when it is valid", () =>
    withoutSettings(async (db) => {
      await ensureUserSettings(db, userA, defaults);

      await updateUserSettings(db, userA, { timezone: "Asia/Tokyo" });

      expect(await getUserSettings(db, userA)).toMatchObject({
        timezone: "Asia/Tokyo",
      });
    }));

  it("should refuse a time zone that doesn't exist", () =>
    withoutSettings(async (db) => {
      await ensureUserSettings(db, userA, defaults);

      expect(
        await updateUserSettings(db, userA, { timezone: "Mars/Base" }),
      ).toEqual({ kind: "invalid" });
    }));

  it("should refuse a language the app doesn't have", () =>
    withoutSettings(async (db) => {
      await ensureUserSettings(db, userA, defaults);

      expect(await updateUserSettings(db, userA, { locale: "fr" })).toEqual({
        kind: "invalid",
      });
    }));

  it("should change only the signed-in user's settings", () =>
    withoutSettings(async (db) => {
      await ensureUserSettings(db, userA, defaults);
      await ensureUserSettings(db, userB, defaults);

      await updateUserSettings(db, userA, { newCardsPerDay: 7 });

      expect(await getUserSettings(db, userB)).toMatchObject({
        newCardsPerDay: 20,
      });
    }));

  it("should return null when the user has no settings", () =>
    withoutSettings(async (db) => {
      expect(
        await updateUserSettings(db, userA, { newCardsPerDay: 7 }),
      ).toBeNull();
    }));
});
