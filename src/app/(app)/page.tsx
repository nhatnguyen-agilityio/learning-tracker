import { getTranslations } from "next-intl/server";
import { requireUserId } from "@/lib/auth/session";

// Every signed-in page depends on the request, so it waits for the server.
export const instant = false;

export default async function Today() {
  await requireUserId();
  const t = await getTranslations("nav");

  return <h1 className="text-2xl font-semibold">{t("today")}</h1>;
}
