export const locales = ["vi", "en"] as const;

export type AppLocale = (typeof locales)[number];

export const LOCALE_COOKIE = "locale";

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

export function localeCookieOptions() {
  return {
    path: "/",
    maxAge: ONE_YEAR_IN_SECONDS,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  } as const;
}

export function isLocale(value: unknown): value is AppLocale {
  return locales.some((locale) => locale === value);
}

function preferredLanguage(acceptLanguage: string) {
  const [preferred] = acceptLanguage
    .split(",")
    .map((entry) => {
      const [tag, ...params] = entry.trim().split(";");
      const quality = params.find((param) => param.trim().startsWith("q="));
      return {
        language: tag.trim().toLowerCase().split("-")[0],
        weight: quality ? Number(quality.trim().slice(2)) || 0 : 1,
      };
    })
    .sort((a, b) => b.weight - a.weight);

  return preferred.language;
}

export function resolveLocale(
  cookieValue: string | undefined,
  acceptLanguage: string | null,
): AppLocale {
  if (isLocale(cookieValue)) return cookieValue;
  return preferredLanguage(acceptLanguage ?? "") === "vi" ? "vi" : "en";
}
