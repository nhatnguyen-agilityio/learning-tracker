"use server";

import { cookies } from "next/headers";
import { updateUserSettings } from "@/domain/user-settings";
import { getUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { preferenceCookieOptions } from "@/lib/preference-cookie";
import { isLocale, LOCALE_COOKIE } from "./locale";

export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;

  (await cookies()).set(LOCALE_COOKIE, locale, preferenceCookieOptions());

  // The sign-in page has this switcher too, where nobody is signed in yet.
  const userId = await getUserId();
  if (userId) await updateUserSettings(getDb(), userId, { locale });
}
