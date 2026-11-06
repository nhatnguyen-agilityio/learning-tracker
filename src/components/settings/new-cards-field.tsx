"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { saveNewCardsPerDay } from "@/app/(app)/settings/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isValidNewCardsPerDay } from "@/domain/user-settings-limits";

type FieldState = "idle" | "saved" | "invalid" | "failed";

export function NewCardsField({ initialValue }: { initialValue: number }) {
  const t = useTranslations("settings");
  const id = useId();
  const [value, setValue] = useState(`${initialValue}`);
  const [lastSaved, setLastSaved] = useState(initialValue);
  const [state, setState] = useState<FieldState>("idle");

  async function save() {
    const next = value.trim() === "" ? Number.NaN : Number(value);
    if (!isValidNewCardsPerDay(next)) {
      setState("invalid");
      return;
    }
    if (next === lastSaved) {
      setState("idle");
      return;
    }

    const saved = await saveNewCardsPerDay(next).catch(() => false);
    if (saved) setLastSaved(next);
    setState(saved ? "saved" : "failed");
  }

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{t("perDay")}</Label>
      <div className="flex items-center gap-3">
        <Input
          id={id}
          type="number"
          min={0}
          max={100}
          className="w-24"
          aria-invalid={state === "invalid"}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onBlur={save}
          onKeyDown={(event) => {
            if (event.key === "Enter") save();
          }}
        />
        <span role="status" className="text-xs text-muted-foreground">
          {state === "saved" ? t("saved") : ""}
        </span>
      </div>
      {state === "invalid" || state === "failed" ? (
        <p role="alert" className="text-xs text-destructive">
          {t(state === "invalid" ? "perDayError" : "saveFailed")}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">{t("perDayHint")}</p>
      )}
    </div>
  );
}
