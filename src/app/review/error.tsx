"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function ReviewError({ retry }: { retry: () => void }) {
  const t = useTranslations("review");

  return (
    <div className="mx-auto flex h-dvh w-full max-w-160 flex-col justify-center p-4">
      <section
        role="alert"
        className="flex flex-col items-start gap-3 rounded-lg border border-border bg-card p-6"
      >
        <h1 className="font-semibold">{t("errorTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("errorBody")}</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={retry}>{t("retry")}</Button>
          <Button asChild variant="ghost">
            <Link href="/">{t("backToday")}</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
