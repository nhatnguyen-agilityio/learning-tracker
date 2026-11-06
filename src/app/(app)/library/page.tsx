import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LibraryFilters } from "@/components/library-filters";
import { ResourceModal } from "@/components/resource-modal/resource-modal";
import { ResourceRow } from "@/components/resource-row";
import { Button } from "@/components/ui/button";
import {
  type ResourceFilters,
  searchResources,
} from "@/domain/search-resources";
import { listTopics, listUsedTopics } from "@/domain/topics";
import { requireUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";

// Every signed-in page depends on the request, so it waits for the server.
export const instant = false;

function single(value: string | string[] | undefined) {
  return typeof value === "string" && value ? value : undefined;
}

function isStatus(
  value: string | undefined,
): value is ResourceFilters["status"] {
  return value === "want" || value === "learning" || value === "done";
}

export default async function Library({ searchParams }: PageProps<"/library">) {
  const userId = await requireUserId();
  const db = getDb();
  const params = await searchParams;
  const status = single(params.status);
  const filters: ResourceFilters = {
    query: single(params.q),
    status: isStatus(status) ? status : undefined,
    topicId: single(params.topic),
  };
  const filtered = Boolean(filters.query || filters.status || filters.topicId);

  const [tNav, t, topics, usedTopics, resources] = await Promise.all([
    getTranslations("nav"),
    getTranslations("library"),
    listTopics(db, userId),
    listUsedTopics(db, userId),
    searchResources(db, userId, filters),
  ]);

  return (
    <>
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{tNav("library")}</h1>
        <ResourceModal topics={topics} />
      </header>
      {resources.length > 0 || filtered ? (
        <LibraryFilters
          key={filtered ? "filtered" : "all"}
          topics={usedTopics}
        />
      ) : null}
      {resources.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {resources.map((resource) => (
            <li key={resource.id}>
              <ResourceRow resource={resource} />
            </li>
          ))}
        </ul>
      ) : filtered ? (
        <section className="flex flex-col items-start gap-2 rounded-lg border border-border bg-card p-6">
          <h2 className="font-semibold">{t("noResult")}</h2>
          <Button asChild variant="secondary" size="sm">
            <Link href="/library">{t("clearFilters")}</Link>
          </Button>
        </section>
      ) : (
        <section className="flex flex-col gap-2 rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">{t("emptyTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("emptyBody")}</p>
        </section>
      )}
    </>
  );
}
