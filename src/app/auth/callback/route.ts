import { type NextRequest, NextResponse } from "next/server";
import { safeNextPath, SIGN_IN_PATH } from "@/lib/auth/routes";
import { createClient } from "@/lib/auth/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }

  return NextResponse.redirect(
    new URL(`${SIGN_IN_PATH}?error=google`, request.url),
  );
}
