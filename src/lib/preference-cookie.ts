const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

/** Options for cookies that keep a per-browser preference, such as language. */
export function preferenceCookieOptions() {
  return {
    path: "/",
    maxAge: ONE_YEAR_IN_SECONDS,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  } as const;
}
