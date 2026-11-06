"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { addNote } from "@/app/(app)/library/[id]/note-actions";
import { Button } from "@/components/ui/button";
import { NoteEditor } from "./note-editor";

type Note = { id: string; contentMd: string };

export function NotesSection({
  resourceId,
  initialNotes,
}: {
  resourceId: string;
  initialNotes: Note[];
}) {
  const t = useTranslations("notes");
  const [notes, setNotes] = useState(initialNotes);
  const [adding, startAdding] = useTransition();

  function add() {
    startAdding(async () => {
      const note = await addNote(resourceId);
      if (note) setNotes((current) => [...current, note]);
    });
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">{t("title")}</h2>
        <Button variant="secondary" size="sm" disabled={adding} onClick={add}>
          {t("add")}
        </Button>
      </div>
      {notes.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : null}
      {notes.map((note) => (
        <NoteEditor
          key={note.id}
          id={note.id}
          resourceId={resourceId}
          initialContent={note.contentMd}
          onDeleted={(id) =>
            setNotes((current) => current.filter((item) => item.id !== id))
          }
        />
      ))}
    </section>
  );
}
