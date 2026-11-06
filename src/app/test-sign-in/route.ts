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
// A throwaway account for tests that need a user with no data.
const NEW_USER = "new";

export async function GET(request: NextRequest) {
  const user = request.nextUrl.searchParams.get("user") ?? "a";
  const email = TEST_USERS[user];

  if (!canUseTestSignIn(process.env) || (!email && user !== NEW_USER)) {
    return new NextResponse(null, { status: 404 });
  }

  const supabase = await createClient();
  const { data, error } = email
    ? await supabase.auth.signInWithPassword({
        email,
        password: TEST_PASSWORD,
      })
    : await supabase.auth.signUp({
        email: `e2e-${crypto.randomUUID()}@example.test`,
        password: TEST_PASSWORD,
      });

  if (error || !data.user) {
    return new NextResponse(error?.message, { status: 500 });
  }

  await afterSignIn(data.user.id);
  return NextResponse.redirect(new URL("/", request.url));
}
