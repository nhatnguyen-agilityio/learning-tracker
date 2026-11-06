import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { requireUserId } from "@/lib/auth/session";

// Every signed-in page depends on the request, so it waits for the server.
export const instant = false;

export default async function Today() {
  await requireUserId();
  const [t, tReview] = await Promise.all([
    getTranslations("nav"),
    getTranslations("review"),
  ]);

  return (
    <>
      <h1 className="text-2xl font-semibold">{t("today")}</h1>
      <Button asChild className="self-start">
        <Link href="/review">{tReview("start")}</Link>
      </Button>
    </>
  );
}
