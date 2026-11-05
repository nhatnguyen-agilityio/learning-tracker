export const themes = ["light", "dark"] as const;

export type AppTheme = (typeof themes)[number];

export const THEME_COOKIE = "theme";

export function isTheme(value: unknown): value is AppTheme {
  return themes.some((theme) => theme === value);
}

export function resolveTheme(cookieValue: string | undefined): AppTheme {
  return isTheme(cookieValue) ? cookieValue : "light";
}
