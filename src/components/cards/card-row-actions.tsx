"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { changeCardSuspended, removeCard } from "@/app/(app)/cards/actions";
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
import { CardModal } from "./card-modal";

type CardRowActionsProps = {
  cardId: string;
  resourceTitle: string | null;
  suspended: boolean;
};

export function CardRowActions({
  cardId,
  resourceTitle,
  suspended,
}: CardRowActionsProps) {
  const t = useTranslations("cardsScreen");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, startAction] = useTransition();

  function run(action: () => Promise<boolean>) {
    setFailed(false);
    startAction(async () => {
      const done = await action().catch(() => false);
      setFailed(!done);
      setConfirmOpen(false);
    });
  }

  return (
    <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
      {failed ? (
        <p role="alert" className="text-xs text-destructive">
          {t("actionFailed")}
        </p>
      ) : null}
      <CardModal target={{ kind: "edit", cardId, resourceTitle }} />
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={() => run(() => changeCardSuspended(cardId, !suspended))}
      >
        {t(suspended ? "resume" : "suspend")}
      </Button>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm">
            {t("delete")}
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
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => run(() => removeCard(cardId))}
            >
              {t("confirmDelete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
