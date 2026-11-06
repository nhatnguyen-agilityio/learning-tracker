import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function ResourceNotFound() {
  const t = useTranslations("resourceDetail");

  return (
    <section className="flex flex-col items-start gap-3 rounded-lg border border-border bg-card p-6">
      <h1 className="font-semibold">{t("notFound")}</h1>
      <Button asChild variant="secondary">
        <Link href="/library">{t("backToLibrary")}</Link>
      </Button>
    </section>
  );
}
