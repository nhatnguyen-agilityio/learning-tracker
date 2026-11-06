import { eq } from "drizzle-orm";
import { userSettings } from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";
import { isLocale } from "@/lib/i18n/locale";
import { isValidTimezone } from "./timezone";
import { isValidNewCardsPerDay } from "./user-settings-limits";

const settingsFields = {
  newCardsPerDay: userSettings.newCardsPerDay,
  timezone: userSettings.timezone,
  locale: userSettings.locale,
};

export async function getUserSettings(db: Db, userId: string) {
  const [settings] = await db
    .select(settingsFields)
    .from(userSettings)
    .where(eq(userSettings.userId, userId));
  return settings ?? null;
}

/** Creates settings on the first sign-in. Later sign-ins keep what is stored. */
export async function ensureUserSettings(
  db: Db,
  userId: string,
  defaults: { timezone: string; locale: string },
) {
  const [created] = await db
    .insert(userSettings)
    .values({ userId, ...defaults })
    .onConflictDoNothing({ target: userSettings.userId })
    .returning(settingsFields);
  if (created) return created;

  const existing = await getUserSettings(db, userId);
  if (!existing) throw new Error("User settings could not be created.");
  return existing;
}

type SettingsChanges = {
  newCardsPerDay?: number;
  timezone?: string;
  locale?: string;
};

function isValidChange({ newCardsPerDay, timezone, locale }: SettingsChanges) {
  return (
    (newCardsPerDay === undefined || isValidNewCardsPerDay(newCardsPerDay)) &&
    (timezone === undefined || isValidTimezone(timezone)) &&
    (locale === undefined || isLocale(locale))
  );
}

/** Returns null when the user has no settings row yet. */
export async function updateUserSettings(
  db: Db,
  userId: string,
  changes: SettingsChanges,
) {
  if (!isValidChange(changes)) return { kind: "invalid" } as const;

  const [settings] = await db
    .update(userSettings)
    .set(changes)
    .where(eq(userSettings.userId, userId))
    .returning(settingsFields);
  return settings ? ({ kind: "updated", settings } as const) : null;
}
