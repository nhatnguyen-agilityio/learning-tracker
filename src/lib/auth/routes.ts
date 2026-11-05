export const SIGN_IN_PATH = "/sign-in";

const PUBLIC_PATHS = [
  SIGN_IN_PATH,
  "/auth/callback",
  "/test-sign-in",
  "/terms",
  "/privacy",
];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

const PROBE_ORIGIN = "http://internal.invalid";

/** Keeps a post-sign-in redirect inside the app; anything else goes home. */
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/")) return "/";

  try {
    const url = new URL(value, PROBE_ORIGIN);
    if (url.origin !== PROBE_ORIGIN) return "/";
    // "/.//evil.test" normalizes to "//evil.test", which a browser reads as a host.
    if (url.pathname.startsWith("//")) return "/";
    return `${url.pathname}${url.search}`;
  } catch {
    return "/";
  }
}
