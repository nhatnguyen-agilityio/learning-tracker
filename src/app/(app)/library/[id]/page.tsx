import { ArrowLeftIcon, ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ResourceModal } from "@/components/resource-modal/resource-modal";
import { ResourceThumbnail } from "@/components/resource-modal/resource-thumbnail";
import { TopicDot } from "@/components/topic-dot";
import { Button } from "@/components/ui/button";
import { getResource } from "@/domain/resources";
import { listResourceTopics, listTopics } from "@/domain/topics";
import { requireUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";

// Every signed-in page depends on the request, so it waits for the server.
export const instant = false;

export default async function ResourceDetail({
  params,
}: PageProps<"/library/[id]">) {
  const { id } = await params;
  const userId = await requireUserId();
  const db = getDb();

  const resource = await getResource(db, userId, id);
  if (!resource) notFound();

  const [t, tForm, tNav, topics, allTopics] = await Promise.all([
    getTranslations("resourceDetail"),
    getTranslations("resourceForm"),
    getTranslations("nav"),
    listResourceTopics(db, userId, id),
    listTopics(db, userId),
  ]);

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="self-start">
        <Link href="/library">
          <ArrowLeftIcon aria-hidden />
          {tNav("library")}
        </Link>
      </Button>
      <div className="flex flex-wrap gap-4">
        <ResourceThumbnail src={resource.thumbnailUrl} className="size-24" />
        <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-2">
          <h1 className="text-2xl font-semibold wrap-anywhere">
            {resource.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{tForm(`types.${resource.type}`)}</span>
            {topics.map((topic) => (
              <span
                key={topic.id}
                className="flex max-w-40 items-center gap-1 rounded-sm bg-secondary px-1.5 py-0.5"
              >
                <TopicDot color={topic.color} />
                <span className="truncate">{topic.name}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <a href={resource.url} target="_blank" rel="noopener noreferrer">
            <ExternalLinkIcon aria-hidden />
            {t("openLink")}
          </a>
        </Button>
        <ResourceModal
          topics={allTopics}
          resource={{ ...resource, topics }}
          triggerLabel={t("edit")}
          triggerVariant="secondary"
        />
      </div>
      {(["progress", "notes", "cards"] as const).map((section) => (
        <section
          key={section}
          className="rounded-lg border border-border bg-card p-4"
        >
          <h2 className="font-semibold">{t(section)}</h2>
        </section>
      ))}
    </>
  );
}
