import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ResourceModal } from "@/components/resource-modal/resource-modal";
import { InProgressSection } from "@/components/today/in-progress-section";
import { StreakCard } from "@/components/today/streak-card";
import { Button } from "@/components/ui/button";
import { countResources, listResourcesInProgress } from "@/domain/resources";
import { countPendingCards } from "@/domain/cards";
import { selectReviewCards } from "@/domain/review-selection";
import { getReviewStats } from "@/domain/review-stats";
import { DEFAULT_TIMEZONE } from "@/domain/timezone";
import { listTopics } from "@/domain/topics";
import { getUserSettings } from "@/domain/user-settings";
import { requireUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";

// Every signed-in page depends on the request, so it waits for the server.
export const instant = false;

export default async function Today() {
  const userId = await requireUserId();
  const db = getDb();
  const now = new Date();

  const [
    t,
    tNav,
    tReview,
    locale,
    settings,
    batch,
    stats,
    inProgress,
    resourceCount,
    topics,
    pendingCount,
  ] = await Promise.all([
    getTranslations("today"),
    getTranslations("nav"),
    getTranslations("review"),
    getLocale(),
    getUserSettings(db, userId),
    selectReviewCards(db, userId, now),
    getReviewStats(db, userId, now),
    listResourcesInProgress(db, userId),
    countResources(db, userId),
    listTopics(db, userId),
    countPendingCards(db, userId),
  ]);

  const date = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: settings?.timezone ?? DEFAULT_TIMEZONE,
  }).format(now);

  const firstRun = resourceCount === 0;
  const waiting = batch.cards.length + batch.remaining;
  const reviewedToday = stats.recentDays.at(-1) ?? false;

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">{tNav("today")}</h1>
        <p className="text-sm text-muted-foreground">{date}</p>
      </div>

      {pendingCount > 0 ? (
        <p
          role="status"
          className="rounded-md bg-warning-soft p-3 text-sm text-warning-soft-foreground"
        >
          <Link
            href="/cards?tab=pending"
            className="underline underline-offset-4"
          >
            {t("pendingNote", { count: pendingCount })}
          </Link>
        </p>
      ) : null}

      {waiting > 0 ? (
        <section className="flex flex-col gap-3 rounded-lg border border-border bg-card px-4 py-6">
          <div>
            <p className="text-4xl font-semibold">{waiting}</p>
            <p className="text-sm text-muted-foreground">
              {t("dueLabel", { count: waiting })}
            </p>
          </div>
          <Button asChild size="lg" className="w-full">
            <Link href="/review">{tReview("start")}</Link>
          </Button>
        </section>
      ) : null}

      {batch.isBacklog ? (
        <p
          role="status"
          className="rounded-md bg-muted p-3 text-sm text-muted-foreground"
        >
          {t("backlog")}
        </p>
      ) : null}

      {waiting === 0 && !firstRun ? (
        <section className="flex flex-col gap-1 rounded-lg border border-border bg-card px-4 py-6">
          <h2 className="text-lg font-semibold">
            {t(reviewedToday ? "doneTitle" : "noDueTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("noDueBody")}</p>
        </section>
      ) : null}

      {firstRun ? (
        <section className="flex flex-col gap-3 rounded-lg border border-border bg-card px-4 py-6">
          <div>
            <h2 className="text-lg font-semibold">{t("firstTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("firstBody")}</p>
          </div>
          <ResourceModal topics={topics} triggerLabel={t("firstAction")} />
        </section>
      ) : (
        <>
          <StreakCard streak={stats.streak} recentDays={stats.recentDays} />
          <InProgressSection
            resources={inProgress.resources}
            total={inProgress.total}
          />
        </>
      )}
    </>
  );
}
