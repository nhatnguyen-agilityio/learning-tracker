import { useTranslations } from "next-intl";
import { CardRowActions } from "./card-row-actions";

type CardRowProps = {
  card: {
    id: string;
    front: string;
    status: "pending" | "active" | "suspended";
    isNew: boolean;
    resourceTitle: string | null;
  };
};

const badges = {
  new: "bg-warning-soft text-warning-soft-foreground",
  active: "bg-primary-soft text-primary-soft-foreground",
  suspended: "bg-muted text-muted-foreground",
};

export function CardRow({ card }: CardRowProps) {
  const t = useTranslations("cardsScreen");
  const tCards = useTranslations("resourceCards");

  const label =
    card.status === "suspended" ? "suspended" : card.isNew ? "new" : "active";

  return (
    <li className="flex flex-wrap items-center gap-2 p-3">
      <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-1">
        <span className="line-clamp-2 text-sm font-medium wrap-anywhere">
          {card.front}
        </span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <span
            className={`flex-none rounded-sm px-1.5 py-0.5 font-medium ${badges[label]}`}
          >
            {t(label)}
          </span>
          <span className="truncate">
            {card.resourceTitle ?? tCards("noSource")}
          </span>
        </span>
      </div>
      <CardRowActions
        cardId={card.id}
        resourceTitle={card.resourceTitle}
        suspended={card.status === "suspended"}
      />
    </li>
  );
}
