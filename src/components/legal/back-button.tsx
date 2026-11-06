"use client";

import { ArrowLeftIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function BackButton() {
  const t = useTranslations("legal");
  const router = useRouter();

  // A page opened straight from a link has nothing to go back to.
  function goBack() {
    if (window.history.length > 1) router.back();
    else router.push("/");
  }

  return (
    <Button variant="ghost" size="sm" className="self-start" onClick={goBack}>
      <ArrowLeftIcon aria-hidden />
      {t("back")}
    </Button>
  );
}
