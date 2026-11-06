"use client";

import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import {
  type AddTokenResult,
  addToken,
  removeToken,
} from "@/app/(app)/settings/token-actions";
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
import { MAX_TOKEN_NAME_LENGTH } from "@/domain/token-limits";

export type TokenRowData = {
  id: string;
  name: string;
  created: string;
  lastUsed: string | null;
};

function TokenRow({ token }: { token: TokenRowData }) {
  const t = useTranslations("settings");
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [revoking, startRevoking] = useTransition();

  function revoke() {
    startRevoking(async () => {
      const revoked = await removeToken(token.id).catch(() => false);
      setFailed(!revoked);
      if (revoked) setOpen(false);
    });
  }

  return (
    <li className="flex items-center gap-2 p-3">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{token.name}</span>
        <span className="text-xs text-muted-foreground">
          {t("tokenCreated", { date: token.created })} ·{" "}
          {token.lastUsed
            ? t("tokenUsed", { date: token.lastUsed })
            : t("tokenNeverUsed")}
        </span>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm">
            {t("revoke")}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("tokenRevokeTitle")}</DialogTitle>
            <DialogDescription>{t("tokenRevokeBody")}</DialogDescription>
          </DialogHeader>
          {failed ? (
            <p role="alert" className="text-sm text-destructive">
              {t("saveFailed")}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button variant="destructive" disabled={revoking} onClick={revoke}>
              {t("tokenRevokeAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}

const errorMessages = {
  invalid_name: "tokenInvalidName",
  limit_reached: "tokenLimit",
  failed: "tokenFailed",
} as const;

export function TokensSection({ tokens }: { tokens: TokenRowData[] }) {
  const t = useTranslations("settings");
  const nameId = useId();
  const [name, setName] = useState("");
  const [rawToken, setRawToken] = useState<string | null>(null);
  const [error, setError] = useState<keyof typeof errorMessages | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const [creating, startCreating] = useTransition();

  function create() {
    setError(null);
    startCreating(async () => {
      const result = await addToken(name).catch((): AddTokenResult => ({
        kind: "failed",
      }));
      if (result.kind === "created") {
        setRawToken(result.rawToken);
        setCopyState("idle");
        setName("");
      } else {
        setError(result.kind);
      }
    });
  }

  async function copy() {
    if (!rawToken) return;
    const copied = await navigator.clipboard
      .writeText(rawToken)
      .then(() => true)
      .catch(() => false);
    setCopyState(copied ? "copied" : "failed");
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">{t("tokens")}</h2>
      <p className="text-sm text-muted-foreground">{t("tokensHint")}</p>
      {rawToken ? (
        <div className="flex flex-col gap-2 rounded-lg bg-warning-soft p-3 text-warning-soft-foreground">
          <p className="text-sm font-medium">{t("tokenOnce")}</p>
          <code className="rounded-md bg-card p-2 font-mono text-xs break-all text-foreground">
            {rawToken}
          </code>
          {copyState === "failed" ? (
            <p role="alert" className="text-xs">
              {t("tokenCopyFailed")}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={copy}>
              {t(copyState === "copied" ? "tokenCopied" : "tokenCopy")}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setRawToken(null)}>
              {t("tokenDone")}
            </Button>
          </div>
        </div>
      ) : null}
      {tokens.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
          {tokens.map((token) => (
            <TokenRow key={token.id} token={token} />
          ))}
        </ul>
      ) : null}
      <div className="flex flex-col gap-1">
        <Label htmlFor={nameId}>{t("tokenName")}</Label>
        <div className="flex flex-wrap gap-2">
          <Input
            id={nameId}
            className="min-w-0 flex-[1_1_200px]"
            maxLength={MAX_TOKEN_NAME_LENGTH}
            placeholder={t("tokenPlaceholder")}
            aria-invalid={error === "invalid_name"}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Button variant="secondary" disabled={creating} onClick={create}>
            {t("tokenCreate")}
          </Button>
        </div>
        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {t(errorMessages[error])}
          </p>
        ) : null}
      </div>
    </section>
  );
}
