import { getTranslations } from "next-intl/server";
import { ResourceModal } from "@/components/resource-modal/resource-modal";
import { ResourceRow } from "@/components/resource-row";
import { listResourcesWithTopics, listTopics } from "@/domain/topics";
import { requireUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";

// Every signed-in page depends on the request, so it waits for the server.
export const instant = false;

export default async function Library() {
  const userId = await requireUserId();
  const db = getDb();
  const [tNav, t, topics, resources] = await Promise.all([
    getTranslations("nav"),
    getTranslations("library"),
    listTopics(db, userId),
    listResourcesWithTopics(db, userId),
  ]);

  return (
    <>
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{tNav("library")}</h1>
        <ResourceModal topics={topics} />
      </header>
      {resources.length === 0 ? (
        <section className="flex flex-col gap-2 rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">{t("emptyTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("emptyBody")}</p>
        </section>
      ) : (
        <ul className="flex flex-col gap-2">
          {resources.map((resource) => (
            <li key={resource.id}>
              <ResourceRow resource={resource} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
