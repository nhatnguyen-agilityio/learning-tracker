"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function ResourceError({ retry }: { retry: () => void }) {
  const t = useTranslations("resourceDetail");
  const tLibrary = useTranslations("library");

  return (
    <section
      role="alert"
      className="flex flex-col items-start gap-3 rounded-lg border border-border bg-card p-6"
    >
      <h1 className="font-semibold">{t("errorTitle")}</h1>
      <p className="text-sm text-muted-foreground">{tLibrary("errorBody")}</p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={retry}>{tLibrary("retry")}</Button>
        <Button asChild variant="ghost">
          <Link href="/library">{t("backToLibrary")}</Link>
        </Button>
      </div>
    </section>
  );
}
