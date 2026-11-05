import { getTranslations } from "next-intl/server";
import { requireUserId } from "@/lib/auth/session";

export default async function Cards() {
  await requireUserId();
  const t = await getTranslations("nav");

  return <h1 className="text-2xl font-semibold">{t("cards")}</h1>;
}
