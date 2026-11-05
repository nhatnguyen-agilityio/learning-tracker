"use server";

import { cookies } from "next/headers";
import { preferenceCookieOptions } from "@/lib/preference-cookie";
import { isTheme, THEME_COOKIE } from "./theme";

export async function setTheme(theme: string) {
  if (!isTheme(theme)) return;

  (await cookies()).set(THEME_COOKIE, theme, preferenceCookieOptions());
}
