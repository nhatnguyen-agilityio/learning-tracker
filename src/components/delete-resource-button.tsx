"use client";

import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { removeResource } from "@/app/(app)/library/[id]/resource-actions";
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

type DeleteResourceButtonProps = {
  resourceId: string;
  noteCount: number;
  cardCount: number;
};

export function DeleteResourceButton({
  resourceId,
  noteCount,
  cardCount,
}: DeleteResourceButtonProps) {
  const t = useTranslations("deleteResource");
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [deleting, startDeleting] = useTransition();

  function confirm() {
    setFailed(false);
    startDeleting(async () => {
      // On success the server redirects to Library, so nothing comes back.
      const deleted = await removeResource(resourceId).catch(() => false);
      if (deleted === false) setFailed(true);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="self-start text-destructive">
          <Trash2Icon aria-hidden />
          {t("button")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {noteCount + cardCount === 0
              ? t("emptyBody")
              : t("body", { notes: noteCount, cards: cardCount })}
          </DialogDescription>
        </DialogHeader>
        {failed ? (
          <p role="alert" className="text-sm text-destructive">
            {t("failed")}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {t("cancel")}
          </Button>
          <Button variant="destructive" disabled={deleting} onClick={confirm}>
            {deleting
              ? t("deleting")
              : t(noteCount > 0 ? "withNotes" : "button")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
