import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { webUserIdFromClaims } from "@/lib/auth/claims";
import { supabaseEnv } from "@/lib/auth/env";
import { isApiPath, isPublicPath, SIGN_IN_PATH } from "@/lib/auth/routes";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, anonKey } = supabaseEnv();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [name, value] of Object.entries(headers ?? {})) {
          response.headers.set(name, value);
        }
      },
    },
  });

  // Also refreshes an expiring session, so this runs on public routes too.
  const { data } = await supabase.auth.getClaims();
  const { pathname, search } = request.nextUrl;

  const signedIn = webUserIdFromClaims(data?.claims) !== null;

  if (!signedIn && !isPublicPath(pathname) && !isApiPath(pathname)) {
    const signIn = request.nextUrl.clone();
    signIn.pathname = SIGN_IN_PATH;
    signIn.search = "";
    if (pathname !== "/") signIn.searchParams.set("next", pathname + search);
    return NextResponse.redirect(signIn);
  }

  // A page that grants access must not run inside someone else's frame.
  if (pathname.startsWith("/oauth/")) {
    response.headers.set("x-frame-options", "DENY");
    response.headers.set("content-security-policy", "frame-ancestors 'none'");
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)",
  ],
};
