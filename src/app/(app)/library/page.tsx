import { getTranslations } from "next-intl/server";
import { ResourceModal } from "@/components/resource-modal/resource-modal";
import { listTopics } from "@/domain/topics";
import { requireUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";

// Every signed-in page depends on the request, so it waits for the server.
export const instant = false;

export default async function Library() {
  const userId = await requireUserId();
  const [t, topics] = await Promise.all([
    getTranslations("nav"),
    listTopics(getDb(), userId),
  ]);

  return (
    <header className="flex items-center justify-between gap-4">
      <h1 className="text-2xl font-semibold">{t("library")}</h1>
      <ResourceModal topics={topics} />
    </header>
  );
}
