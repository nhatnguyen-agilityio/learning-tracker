"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import {
  saveProgress,
  saveStatus,
} from "@/app/(app)/library/[id]/progress-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  RESOURCE_STATUSES,
  type ResourceStatus,
  shouldSuggestDone,
  statusAfterProgress,
} from "@/domain/resource-status";

const SAVE_DELAY_MS = 300;

type SaveState = "idle" | "saving" | "saved" | "failed";

type ResourceProgressProps = {
  resourceId: string;
  initialProgress: number;
  initialStatus: ResourceStatus;
};

export function ResourceProgress({
  resourceId,
  initialProgress,
  initialStatus,
}: ResourceProgressProps) {
  const t = useTranslations("progress");
  const tForm = useTranslations("resourceForm");
  const sliderId = useId();
  const [progress, setProgress] = useState(initialProgress);
  const [status, setStatus] = useState(initialStatus);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [dismissed, setDismissed] = useState(false);

  const latest = useRef(initialProgress);
  const lastSaved = useRef(initialProgress);
  const inFlight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  /** One save at a time, so an older value can't overwrite a newer one. */
  async function flush() {
    clearTimeout(timer.current);
    if (inFlight.current) return;

    inFlight.current = true;
    while (latest.current !== lastSaved.current) {
      const sending = latest.current;
      setSaveState("saving");
      const saved = await saveProgress(resourceId, sending).catch(() => false);
      if (!saved) {
        setSaveState("failed");
        break;
      }
      lastSaved.current = sending;
      setSaveState("saved");
    }
    inFlight.current = false;
  }

  function changeProgress(next: number) {
    setProgress(next);
    setStatus((current) => statusAfterProgress(current, next));
    latest.current = next;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY_MS);
  }

  async function changeStatus(next: ResourceStatus) {
    const previous = status;
    setStatus(next);
    setSaveState("saving");
    const saved = await saveStatus(resourceId, next).catch(() => false);
    if (!saved) setStatus(previous);
    setSaveState(saved ? "saved" : "failed");
  }

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={sliderId}>{t("label")}</Label>
        <span className="flex items-center gap-3">
          <span
            role="status"
            className={
              saveState === "failed"
                ? "text-xs text-destructive"
                : "text-xs text-muted-foreground"
            }
          >
            {saveState === "idle" ? "" : t(saveState)}
          </span>
          <strong className="min-w-11 text-right">{progress}%</strong>
        </span>
      </div>
      <input
        id={sliderId}
        type="range"
        min={0}
        max={100}
        step={5}
        value={progress}
        className="w-full accent-primary"
        onChange={(event) => changeProgress(event.target.valueAsNumber)}
      />
      <div role="group" aria-label={t("status")} className="flex gap-1">
        {RESOURCE_STATUSES.map((option) => (
          <Button
            key={option}
            size="sm"
            variant={status === option ? "secondary" : "ghost"}
            aria-pressed={status === option}
            onClick={() => changeStatus(option)}
          >
            {tForm(`statuses.${option}`)}
          </Button>
        ))}
      </div>
      {shouldSuggestDone(status, progress) && !dismissed ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-success-soft p-3 text-sm text-success-soft-foreground">
          <span>{t("suggestDone")}</span>
          <span className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDismissed(true)}
            >
              {t("notNow")}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => changeStatus("done")}
            >
              {t("markDone")}
            </Button>
          </span>
        </div>
      ) : null}
    </section>
  );
}
