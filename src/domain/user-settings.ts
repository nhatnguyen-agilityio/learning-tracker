import { eq } from "drizzle-orm";
import { userSettings } from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";

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
