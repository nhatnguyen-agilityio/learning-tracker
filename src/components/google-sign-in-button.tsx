"use client";

import { Loader2Icon } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function GoogleSignInButton() {
  const { pending } = useFormStatus();
  const t = useTranslations("signIn");

  return (
    <Button
      type="submit"
      variant="outline"
      size="lg"
      className="w-full"
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? (
        <Loader2Icon aria-hidden className="animate-spin" />
      ) : (
        <Image src="/google.svg" alt="" width={16} height={16} />
      )}
      {pending ? t("googleBusy") : t("google")}
    </Button>
  );
}
