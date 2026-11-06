"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function McpGuide({ url }: { url: string }) {
  const t = useTranslations("settings");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );

  async function copy() {
    const copied = await navigator.clipboard
      .writeText(url)
      .then(() => true)
      .catch(() => false);
    setCopyState(copied ? "copied" : "failed");
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">{t("mcpTitle")}</h2>
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
        <li>{t("mcpStep1")}</li>
        <li className="flex flex-col gap-2">
          {t("mcpStep2")}
          <code className="rounded-md bg-code p-3 font-mono text-xs break-all text-code-foreground">
            {url}
          </code>
          <Button
            variant="secondary"
            size="sm"
            className="self-start"
            onClick={copy}
          >
            {t(copyState === "copied" ? "tokenCopied" : "tokenCopy")}
          </Button>
          {copyState === "failed" ? (
            <p role="alert" className="text-xs text-destructive">
              {t("tokenCopyFailed")}
            </p>
          ) : null}
        </li>
        <li>{t("mcpStep3")}</li>
      </ol>
      <p className="text-xs text-muted-foreground">{t("mcpNote")}</p>
    </section>
  );
}
