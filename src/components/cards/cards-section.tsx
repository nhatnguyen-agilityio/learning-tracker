import { useTranslations } from "next-intl";
import { CardModal } from "./card-modal";

type CardRow = { id: string; front: string; isNew: boolean };

export function CardsSection({
  resourceId,
  resourceTitle,
  cards,
}: {
  resourceId: string;
  resourceTitle: string;
  cards: CardRow[];
}) {
  const t = useTranslations("resourceCards");

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">{t("title")}</h2>
        <CardModal resourceId={resourceId} resourceTitle={resourceTitle} />
      </div>
      {cards.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
          {cards.map((card) => (
            <li key={card.id} className="flex items-center gap-2 p-3 text-sm">
              <span className="line-clamp-2 min-w-0 flex-1 wrap-anywhere">
                {card.front}
              </span>
              {card.isNew ? (
                <span className="flex-none rounded-sm bg-primary-soft px-1.5 py-0.5 text-xs font-medium text-primary-soft-foreground">
                  {t("new")}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
