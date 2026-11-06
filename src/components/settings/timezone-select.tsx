"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { saveTimezone } from "@/app/(app)/settings/actions";
import { Label } from "@/components/ui/label";

export function TimezoneSelect({
  current,
  timezones,
}: {
  current: string;
  timezones: string[];
}) {
  const t = useTranslations("settings");
  const id = useId();
  const [value, setValue] = useState(current);
  const [state, setState] = useState<"idle" | "saved" | "failed">("idle");

  // "UTC" and some older names are valid but not in the browser's list.
  const options = timezones.includes(current)
    ? timezones
    : [current, ...timezones];

  async function change(next: string) {
    const previous = value;
    setValue(next);
    const saved = await saveTimezone(next).catch(() => false);
    if (!saved) setValue(previous);
    setState(saved ? "saved" : "failed");
  }

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{t("timezone")}</Label>
      <div className="flex items-center gap-3">
        <select
          id={id}
          className="h-9 w-full max-w-72 min-w-0 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring"
          value={value}
          onChange={(event) => change(event.target.value)}
        >
          {options.map((timezone) => (
            <option key={timezone} value={timezone}>
              {timezone}
            </option>
          ))}
        </select>
        <span role="status" className="text-xs text-muted-foreground">
          {state === "saved" ? t("saved") : ""}
        </span>
      </div>
      {state === "failed" ? (
        <p role="alert" className="text-xs text-destructive">
          {t("saveFailed")}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">{t("timezoneHint")}</p>
      )}
    </div>
  );
}
