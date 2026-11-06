"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { removeAccount } from "@/app/(app)/settings/account-actions";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { reviewQueueKey } from "@/lib/review-queue/queue";

function forgetWaitingRatings(userId: string) {
  try {
    window.localStorage.removeItem(reviewQueueKey(userId));
  } catch {
    // Blocked storage has nothing to clean up.
  }
}

export function DeleteAccountSection({ userId }: { userId: string }) {
  const t = useTranslations("settings");
  const router = useRouter();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [failed, setFailed] = useState(false);
  const [deleting, startDeleting] = useTransition();

  function changeOpen(next: boolean) {
    setOpen(next);
    setTyped("");
    setFailed(false);
  }

  function confirm() {
    setFailed(false);
    startDeleting(async () => {
      const deleted = await removeAccount().catch(() => false);
      if (!deleted) {
        setFailed(true);
        return;
      }
      forgetWaitingRatings(userId);
      router.replace("/sign-in");
    });
  }

  return (
    <section className="flex flex-col items-start gap-2">
      <h2 className="font-semibold">{t("deleteAccount")}</h2>
      <p className="text-sm text-muted-foreground">{t("deleteAccountHint")}</p>
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" className="text-destructive">
            {t("deleteAccount")}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteAccountTitle")}</DialogTitle>
            <DialogDescription>{t("deleteAccountBody")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1">
            <Label htmlFor={inputId}>{t("deleteAccountType")}</Label>
            <Input
              id={inputId}
              autoComplete="off"
              disabled={deleting}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
            />
          </div>
          {failed ? (
            <p role="alert" className="text-sm text-destructive">
              {t("deleteAccountFailed")}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => changeOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={deleting || typed.trim() !== t("deleteAccountWord")}
              onClick={confirm}
            >
              {t("deleteAccountAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
