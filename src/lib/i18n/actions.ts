"use server";

import { cookies } from "next/headers";
import { preferenceCookieOptions } from "@/lib/preference-cookie";
import { isLocale, LOCALE_COOKIE } from "./locale";

export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;

  (await cookies()).set(LOCALE_COOKIE, locale, preferenceCookieOptions());
}
