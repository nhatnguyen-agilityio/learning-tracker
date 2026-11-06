"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function LibraryError({ retry }: { retry: () => void }) {
  const t = useTranslations("library");

  return (
    <section
      role="alert"
      className="flex flex-col items-start gap-3 rounded-lg border border-border bg-card p-6"
    >
      <h1 className="font-semibold">{t("errorTitle")}</h1>
      <p className="text-sm text-muted-foreground">{t("errorBody")}</p>
      <Button variant="secondary" onClick={retry}>
        {t("retry")}
      </Button>
    </section>
  );
}
