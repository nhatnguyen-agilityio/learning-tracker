import { cookies, headers } from "next/headers";
import { resolveTimezone } from "@/domain/timezone";
import { ensureUserSettings } from "@/domain/user-settings";
import { getDb } from "@/lib/db/client";
import {
  isLocale,
  LOCALE_COOKIE,
  localeCookieOptions,
  resolveLocale,
} from "@/lib/i18n/locale";

export const TIMEZONE_COOKIE = "sign_in_timezone";

/** Runs after every sign-in: creates settings once, then restores the language. */
export async function afterSignIn(userId: string) {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);
  const languageCookie = cookieStore.get(LOCALE_COOKIE)?.value;

  const settings = await ensureUserSettings(getDb(), userId, {
    timezone: resolveTimezone(cookieStore.get(TIMEZONE_COOKIE)?.value),
    locale: resolveLocale(languageCookie, headerList.get("accept-language")),
  });

  cookieStore.delete(TIMEZONE_COOKIE);

  // A cookie means this browser already chose; only a new browser needs this.
  if (!isLocale(languageCookie) && isLocale(settings.locale)) {
    cookieStore.set(LOCALE_COOKIE, settings.locale, localeCookieOptions());
  }
}
