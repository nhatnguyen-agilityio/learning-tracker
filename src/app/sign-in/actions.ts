"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveTimezone } from "@/domain/timezone";
import { TIMEZONE_COOKIE } from "@/lib/auth/first-sign-in";
import { safeNextPath, SIGN_IN_PATH } from "@/lib/auth/routes";
import { createClient } from "@/lib/auth/server";

const TEN_MINUTES_IN_SECONDS = 60 * 10;

export async function signInWithGoogle(formData: FormData) {
  const next = safeNextPath(formData.get("next"));
  const origin = (await headers()).get("origin");

  // The browser's time zone has to survive the round trip through Google.
  (await cookies()).set(
    TIMEZONE_COOKIE,
    resolveTimezone(formData.get("timezone")),
    {
      path: "/",
      maxAge: TEN_MINUTES_IN_SECONDS,
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    },
  );

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error || !data.url) redirect(`${SIGN_IN_PATH}?error=google`);
  redirect(data.url);
}
