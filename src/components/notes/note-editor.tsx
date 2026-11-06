"use client";

import { CodeIcon, HeadingIcon, ListIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { removeNote, saveNote } from "@/app/(app)/library/[id]/note-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  isNoteTooLarge,
  MAX_NOTE_BYTES,
  NOTE_WARNING_BYTES,
  noteBytes,
} from "@/domain/note-limits";
import { NoteMarkdown } from "./note-markdown";

const SAVE_DELAY_MS = 800;

type SaveState = "idle" | "saving" | "saved" | "failed";

type NoteEditorProps = {
  id: string;
  resourceId: string;
  initialContent: string;
  onDeleted: (id: string) => void;
};

export function NoteEditor({
  id,
  resourceId,
  initialContent,
  onDeleted,
}: NoteEditorProps) {
  const t = useTranslations("notes");
  const [content, setContent] = useState(initialContent);
  const [mode, setMode] = useState(initialContent ? "preview" : "write");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const latest = useRef(initialContent);
  const lastSaved = useRef(initialContent);
  const inFlight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  /** One save at a time, so an older save can't overwrite a newer one. */
  async function flush() {
    clearTimeout(timer.current);
    if (inFlight.current) return;

    inFlight.current = true;
    while (
      latest.current !== lastSaved.current &&
      !isNoteTooLarge(latest.current)
    ) {
      const sending = latest.current;
      setSaveState("saving");
      try {
        const result = await saveNote(id, sending);
        if (result !== "saved") {
          setSaveState("failed");
          break;
        }
        lastSaved.current = sending;
        setSaveState("saved");
      } catch {
        setSaveState("failed");
        break;
      }
    }
    inFlight.current = false;
  }

  function change(next: string) {
    setContent(next);
    latest.current = next;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY_MS);
  }

  function append(snippet: string) {
    change(content ? `${content}\n${snippet}` : snippet);
    setMode("write");
  }

  async function confirmDelete() {
    clearTimeout(timer.current);
    if (await removeNote(id, resourceId)) onDeleted(id);
  }

  const bytes = noteBytes(content);
  const tooLarge = bytes > MAX_NOTE_BYTES;
  const remaining = MAX_NOTE_BYTES - bytes;

  return (
    <article className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
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
        <div className="flex items-center gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={t("heading")}
            onClick={() => append("## ")}
          >
            <HeadingIcon aria-hidden />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={t("list")}
            onClick={() => append("- ")}
          >
            <ListIcon aria-hidden />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={t("codeBlock")}
            onClick={() => append("```\n\n```")}
          >
            <CodeIcon aria-hidden />
          </Button>
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogTrigger asChild>
              <Button size="icon-sm" variant="ghost" aria-label={t("delete")}>
                <Trash2Icon aria-hidden />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("deleteTitle")}</DialogTitle>
                <DialogDescription>{t("deleteBody")}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
                  {t("cancel")}
                </Button>
                <Button variant="destructive" onClick={confirmDelete}>
                  {t("confirmDelete")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {mode === "write" ? (
        <textarea
          aria-label={t("label")}
          aria-invalid={tooLarge}
          placeholder={t("placeholder")}
          className="min-h-32 w-full resize-y rounded-md border border-input bg-transparent p-3 font-mono text-sm outline-none focus-visible:border-ring"
          value={content}
          onChange={(event) => change(event.target.value)}
          onBlur={flush}
        />
      ) : (
        <div className="min-h-12 p-1">
          <NoteMarkdown content={content} />
        </div>
      )}

      <div className="flex flex-wrap justify-between gap-2 text-xs">
        {tooLarge ? (
          <p role="alert" className="text-destructive">
            {t("tooLarge")}
          </p>
        ) : (
          <p role="status" className="text-muted-foreground">
            {saveState === "idle" ? "" : t(saveState)}
          </p>
        )}
        {remaining < NOTE_WARNING_BYTES ? (
          <p className="text-muted-foreground">
            {t("size", {
              used: Math.ceil(bytes / 1024),
              max: MAX_NOTE_BYTES / 1024,
            })}
          </p>
        ) : null}
      </div>
    </article>
  );
}
