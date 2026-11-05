import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { supabaseEnv } from "@/lib/auth/env";
import { isPublicPath, SIGN_IN_PATH } from "@/lib/auth/routes";

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

  if (!data?.claims && !isPublicPath(pathname)) {
    const signIn = request.nextUrl.clone();
    signIn.pathname = SIGN_IN_PATH;
    signIn.search = "";
    if (pathname !== "/") signIn.searchParams.set("next", pathname + search);
    return NextResponse.redirect(signIn);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)",
  ],
};
