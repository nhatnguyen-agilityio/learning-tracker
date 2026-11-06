import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CardRow } from "@/components/cards/card-row";
import { PendingCards } from "@/components/cards/pending-cards";
import { Button } from "@/components/ui/button";
import { CARDS_PAGE_SIZE, parseCardsShown } from "@/domain/card-limits";
import { countPendingCards, listCards, listPendingCards } from "@/domain/cards";
import { requireUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";

// Every signed-in page depends on the request, so it waits for the server.
export const instant = false;

export default async function Cards({ searchParams }: PageProps<"/cards">) {
  const userId = await requireUserId();
  const { show, tab } = await searchParams;
  const showPending = tab === "pending";
  const shown = parseCardsShown(show);

  const db = getDb();
  const [t, tNav, { cards, total }, pendingTotal, pending] = await Promise.all([
    getTranslations("cardsScreen"),
    getTranslations("nav"),
    listCards(db, userId, shown),
    countPendingCards(db, userId),
    showPending ? listPendingCards(db, userId) : [],
  ]);

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">{tNav("cards")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("count", { count: total })}
        </p>
      </div>
      <nav aria-label={t("tabs")} className="flex gap-1 border-b border-border">
        {[
          {
            href: "/cards",
            label: t("allCards"),
            count: total,
            on: !showPending,
          },
          {
            href: "/cards?tab=pending",
            label: t("pendingTab"),
            count: pendingTotal,
            on: showPending,
          },
        ].map(({ href, label, count, on }) => (
          <Link
            key={href}
            href={href}
            aria-current={on ? "page" : undefined}
            className="border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground aria-[current=page]:border-primary aria-[current=page]:text-foreground"
          >
            {label} {count}
          </Link>
        ))}
      </nav>
      {showPending ? <PendingCards cards={pending} /> : null}
      {!showPending && total === 0 ? (
        <section className="flex flex-col gap-1 rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">{t("emptyTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("emptyBody")}</p>
        </section>
      ) : null}
      {!showPending && total > 0 ? (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
          {cards.map((card) => (
            <CardRow key={card.id} card={card} />
          ))}
        </ul>
      ) : null}
      {!showPending && cards.length < total ? (
        <Button asChild variant="secondary" className="self-center">
          <Link href={`/cards?show=${shown + CARDS_PAGE_SIZE}`} scroll={false}>
            {t("showMore")}
          </Link>
        </Button>
      ) : null}
    </>
  );
}
