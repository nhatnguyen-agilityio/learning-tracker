import Link from "next/link";
import { useTranslations } from "next-intl";
import { ResourceThumbnail } from "@/components/resource-modal/resource-thumbnail";
import { TopicDot } from "@/components/topic-dot";
import type { ResourceWithTopics } from "@/domain/topics";

const MAX_VISIBLE_TOPICS = 2;

const statusClasses = {
  want: "bg-muted text-muted-foreground",
  learning: "bg-primary-soft text-primary-soft-foreground",
  done: "bg-success-soft text-success-soft-foreground",
};

export function ResourceRow({ resource }: { resource: ResourceWithTopics }) {
  const t = useTranslations("resourceForm");
  const visibleTopics = resource.topics.slice(0, MAX_VISIBLE_TOPICS);
  const hiddenTopics = resource.topics.length - visibleTopics.length;

  return (
    <Link
      href={`/library/${resource.id}`}
      className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 hover:bg-accent"
    >
      <ResourceThumbnail src={resource.thumbnailUrl} className="size-14" />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="line-clamp-2 text-sm font-medium wrap-anywhere">
          {resource.title}
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span>{t(`types.${resource.type}`)}</span>
          <span
            className={`rounded-sm px-1.5 py-0.5 font-medium ${statusClasses[resource.status]}`}
          >
            {t(`statuses.${resource.status}`)}
          </span>
          {visibleTopics.map((topic) => (
            <span
              key={topic.id}
              className="flex max-w-34 items-center gap-1 rounded-sm bg-secondary px-1.5 py-0.5"
            >
              <TopicDot color={topic.color} />
              <span className="truncate">{topic.name}</span>
            </span>
          ))}
          {hiddenTopics > 0 ? <span>+{hiddenTopics}</span> : null}
        </span>
        <span aria-hidden className="h-1 overflow-hidden rounded-full bg-muted">
          <span
            className="block h-full rounded-full bg-primary"
            style={{ width: `${resource.progress}%` }}
          />
        </span>
      </span>
      <span className="w-11 flex-none text-right text-xs text-muted-foreground">
        {resource.progress}%
      </span>
    </Link>
  );
}
