import Link from "next/link";
import { useTranslations } from "next-intl";
import { ResourceThumbnail } from "@/components/resource-modal/resource-thumbnail";
import { Button } from "@/components/ui/button";

type ResourceInProgress = {
  id: string;
  title: string;
  progress: number;
  thumbnailUrl: string | null;
};

export function InProgressSection({
  resources,
  total,
}: {
  resources: ResourceInProgress[];
  total: number;
}) {
  const t = useTranslations("today");

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">{t("inProgress")}</h2>
        {total > 0 ? (
          <Button asChild variant="ghost" size="sm">
            <Link href="/library?status=learning">
              {t("seeAll", { count: total })}
            </Link>
          </Button>
        ) : null}
      </div>
      {total === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-4">
          <p className="flex-[1_1_200px] text-sm text-muted-foreground">
            {t("noLearning")}
          </p>
          <Button asChild variant="secondary" size="sm">
            <Link href="/library">{t("openLibrary")}</Link>
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {resources.map((resource) => (
            <li key={resource.id}>
              <Link
                href={`/library/${resource.id}`}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 hover:bg-accent"
              >
                <ResourceThumbnail
                  src={resource.thumbnailUrl}
                  className="size-10"
                />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="line-clamp-2 text-sm font-medium wrap-anywhere">
                    {resource.title}
                  </span>
                  <span
                    aria-hidden
                    className="h-1 overflow-hidden rounded-full bg-muted"
                  >
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
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
