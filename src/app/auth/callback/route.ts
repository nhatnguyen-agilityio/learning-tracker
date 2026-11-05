import { type NextRequest, NextResponse } from "next/server";
import { afterSignIn } from "@/lib/auth/first-sign-in";
import { safeNextPath, SIGN_IN_PATH } from "@/lib/auth/routes";
import { createClient } from "@/lib/auth/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await afterSignIn(data.user.id);
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(
    new URL(`${SIGN_IN_PATH}?error=google`, request.url),
  );
}
