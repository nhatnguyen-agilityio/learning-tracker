import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CardRow } from "@/components/cards/card-row";
import { Button } from "@/components/ui/button";
import { CARDS_PAGE_SIZE, parseCardsShown } from "@/domain/card-limits";
import { listCards } from "@/domain/cards";
import { requireUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";

// Every signed-in page depends on the request, so it waits for the server.
export const instant = false;

export default async function Cards({ searchParams }: PageProps<"/cards">) {
  const userId = await requireUserId();
  const { show } = await searchParams;
  const shown = parseCardsShown(show);

  const [t, tNav, { cards, total }] = await Promise.all([
    getTranslations("cardsScreen"),
    getTranslations("nav"),
    listCards(getDb(), userId, shown),
  ]);

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">{tNav("cards")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("count", { count: total })}
        </p>
      </div>
      {total === 0 ? (
        <section className="flex flex-col gap-1 rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">{t("emptyTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("emptyBody")}</p>
        </section>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
          {cards.map((card) => (
            <CardRow key={card.id} card={card} />
          ))}
        </ul>
      )}
      {cards.length < total ? (
        <Button asChild variant="secondary" className="self-center">
          <Link href={`/cards?show=${shown + CARDS_PAGE_SIZE}`} scroll={false}>
            {t("showMore")}
          </Link>
        </Button>
      ) : null}
    </>
  );
}
