"use client";

import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { loadCard, saveCard } from "@/app/(app)/cards/actions";
import { addCard } from "@/app/(app)/library/[id]/card-actions";
import { NoteMarkdown } from "@/components/notes/note-markdown";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  type CardErrors,
  type CardSideError,
  validateCard,
} from "@/domain/card-limits";

type SideFieldProps = {
  label: string;
  placeholder: string;
  rows: number;
  value: string;
  disabled: boolean;
  error: string | null;
  onChange: (value: string) => void;
};

function SideField({
  label,
  placeholder,
  rows,
  value,
  disabled,
  error,
  onChange,
}: SideFieldProps) {
  const id = useId();

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        rows={rows}
        disabled={disabled}
        placeholder={placeholder}
        aria-invalid={error !== null}
        className="w-full resize-y rounded-md border border-input bg-transparent p-3 font-mono text-sm outline-none focus-visible:border-ring aria-invalid:border-destructive"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function SidePreview({
  label,
  content,
  empty,
}: {
  label: string;
  content: string;
  empty: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      {content.trim() ? (
        <NoteMarkdown content={content} />
      ) : (
        <p className="text-xs text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}

type Problem = "limit" | "failed" | "loadFailed";

const problemMessages = {
  limit: "limitReached",
  failed: "saveFailed",
  loadFailed: "loadFailed",
} as const;

type CardModalTarget =
  | { kind: "add"; resourceId: string; resourceTitle: string }
  | { kind: "edit"; cardId: string; resourceTitle: string | null };

export function CardModal({ target }: { target: CardModalTarget }) {
  const t = useTranslations("resourceCards");
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [errors, setErrors] = useState<CardErrors | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [loaded, setLoaded] = useState(target.kind === "add");
  const [loading, startLoading] = useTransition();
  const [saving, startSaving] = useTransition();

  function sideMessage(
    error: CardSideError | undefined,
    side: "front" | "back",
  ) {
    if (!error) return null;
    return t(error === "empty" ? `${side}Empty` : "sideTooLarge");
  }

  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next || target.kind !== "edit") return;

    setErrors(null);
    setProblem(null);
    setMode("write");
    setLoaded(false);
    startLoading(async () => {
      const card = await loadCard(target.cardId).catch(() => null);
      if (!card) {
        setProblem("loadFailed");
        return;
      }
      setFront(card.front);
      setBack(card.back);
      setLoaded(true);
    });
  }

  function save() {
    const sides = { front, back };
    const invalid = validateCard(sides);
    setErrors(invalid);
    setProblem(null);
    if (invalid) {
      setMode("write");
      return;
    }

    startSaving(async () => {
      const request =
        target.kind === "add"
          ? addCard(target.resourceId, sides)
          : saveCard(target.cardId, sides);
      const result = await request.catch(() => ({ kind: "failed" }) as const);
      if (result.kind === "saved") {
        setFront("");
        setBack("");
        setMode("write");
        setOpen(false);
      } else if (result.kind === "invalid") {
        setErrors(result.errors);
        setMode("write");
      } else {
        setProblem(result.kind === "limit_reached" ? "limit" : "failed");
      }
    });
  }

  const title = t(target.kind === "add" ? "add" : "editTitle");

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        {target.kind === "add" ? (
          <Button variant="secondary" size="sm">
            {title}
          </Button>
        ) : (
          <Button variant="ghost" size="sm">
            {t("edit")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
          {problem ? (
            <p role="alert" className="text-sm text-destructive">
              {t(problemMessages[problem])}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground wrap-anywhere">
            {t("source")}: {target.resourceTitle ?? t("noSource")}
          </p>
          <div role="group" aria-label={t("mode")} className="flex gap-1">
            {(["write", "preview"] as const).map((option) => (
              <Button
                key={option}
                size="sm"
                variant={mode === option ? "secondary" : "ghost"}
                aria-pressed={mode === option}
                onClick={() => setMode(option)}
              >
                {t(option)}
              </Button>
            ))}
          </div>
          {mode === "write" ? (
            <>
              <SideField
                label={t("front")}
                placeholder={t("frontPlaceholder")}
                rows={3}
                value={front}
                disabled={!loaded}
                error={sideMessage(errors?.front, "front")}
                onChange={setFront}
              />
              <SideField
                label={t("back")}
                placeholder={t("backPlaceholder")}
                rows={5}
                value={back}
                disabled={!loaded}
                error={sideMessage(errors?.back, "back")}
                onChange={setBack}
              />
              <p className="text-xs text-muted-foreground">
                {t("markdownHint")}
              </p>
            </>
          ) : (
            <>
              <SidePreview
                label={t("front")}
                content={front}
                empty={t("emptySide")}
              />
              <SidePreview
                label={t("back")}
                content={back}
                empty={t("emptySide")}
              />
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {t("cancel")}
          </Button>
          <Button disabled={saving || loading || !loaded} onClick={save}>
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
