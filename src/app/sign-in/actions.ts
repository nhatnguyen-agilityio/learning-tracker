"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeNextPath, SIGN_IN_PATH } from "@/lib/auth/routes";
import { createClient } from "@/lib/auth/server";

export async function signInWithGoogle(formData: FormData) {
  const next = safeNextPath(formData.get("next"));
  const origin = (await headers()).get("origin");
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
