"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const browserTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Sends the browser's time zone with a form. It is empty on the server. */
export function TimezoneField() {
  const timezone = useSyncExternalStore(subscribe, browserTimezone, () => "");

  return <input type="hidden" name="timezone" value={timezone} />;
}
