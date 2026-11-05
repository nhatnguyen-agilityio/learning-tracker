export const DEFAULT_TIMEZONE = "UTC";

function isValidTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** The time zone comes from the browser, so it is checked before it is stored. */
export function resolveTimezone(value: unknown): string {
  return typeof value === "string" && value && isValidTimezone(value)
    ? value
    : DEFAULT_TIMEZONE;
}
