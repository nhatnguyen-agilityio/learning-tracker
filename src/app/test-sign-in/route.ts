import { type NextRequest, NextResponse } from "next/server";
import { afterSignIn } from "@/lib/auth/first-sign-in";
import { createClient } from "@/lib/auth/server";
import { canUseTestSignIn } from "@/lib/auth/test-sign-in";

// The seeded local users from supabase/seed.sql. They don't exist in production.
const TEST_USERS: Record<string, string> = {
  a: "user-a@example.test",
  b: "user-b@example.test",
};
const TEST_PASSWORD = "local-test-password";

export async function GET(request: NextRequest) {
  const email = TEST_USERS[request.nextUrl.searchParams.get("user") ?? "a"];

  if (!canUseTestSignIn(process.env) || !email) {
    return new NextResponse(null, { status: 404 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: TEST_PASSWORD,
  });

  if (error) return new NextResponse(error.message, { status: 500 });

  await afterSignIn(data.user.id);
  return NextResponse.redirect(new URL("/", request.url));
}
