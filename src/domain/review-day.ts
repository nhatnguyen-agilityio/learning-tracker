/** A review day starts at 04:00 in the user's time zone (SPEC.md). */
const DAY_START_HOUR = 4;

const formatters = new Map<string, Intl.DateTimeFormat>();

/** Building a formatter is slow, and stats format every review. */
function formatterFor(timezone: string) {
  let formatter = formatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatters.set(timezone, formatter);
  }
  return formatter;
}

function wallClock(instant: Date, timezone: string) {
  const parts = formatterFor(timezone).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);

  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}

function offsetAt(instant: Date, timezone: string) {
  const clock = wallClock(instant, timezone);
  const asUtc = Date.UTC(
    clock.year,
    clock.month - 1,
    clock.day,
    clock.hour,
    clock.minute,
    clock.second,
  );
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The calendar day the review day began on, at noon UTC to avoid edges. */
function reviewDate(now: Date, timezone: string) {
  const { year, month, day, hour } = wallClock(now, timezone);
  const daysBack = hour < DAY_START_HOUR ? 1 : 0;
  return new Date(Date.UTC(year, month - 1, day - daysBack, 12));
}

/** The review day as `YYYY-MM-DD`, for daily limits and streaks. */
export function reviewDayKey(now: Date, timezone: string) {
  return reviewDate(now, timezone).toISOString().slice(0, 10);
}

/** The instant the current review day began. */
export function reviewDayStart(now: Date, timezone: string) {
  const date = reviewDate(now, timezone);
  const wallStart = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    DAY_START_HOUR,
  );

  // The offset can differ on a clock-change day, so it is read a second time
  // at the first estimate.
  const estimate = wallStart - offsetAt(new Date(wallStart), timezone);
  return new Date(wallStart - offsetAt(new Date(estimate), timezone));
}
