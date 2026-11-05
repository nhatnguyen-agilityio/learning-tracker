"use server";

import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE, localeCookieOptions } from "./locale";

export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;

  (await cookies()).set(LOCALE_COOKIE, locale, localeCookieOptions());
}
