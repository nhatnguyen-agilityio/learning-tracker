"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { approveAll } from "@/app/(app)/cards/actions";
import { NoteMarkdown } from "@/components/notes/note-markdown";
import { Button } from "@/components/ui/button";
import { CardRowActions } from "./card-row-actions";

type PendingCard = {
  id: string;
  front: string;
  back: string;
  resourceId: string | null;
  resourceTitle: string | null;
};

function groupByResource(cards: PendingCard[]) {
  const groups = new Map<string | null, PendingCard[]>();
  for (const card of cards) {
    groups.set(card.resourceId, [...(groups.get(card.resourceId) ?? []), card]);
  }
  return [...groups.entries()];
}

function PendingGroup({
  resourceId,
  cards,
}: {
  resourceId: string | null;
  cards: PendingCard[];
}) {
  const t = useTranslations("cardsScreen");
  const tCards = useTranslations("resourceCards");
  const [failed, setFailed] = useState(false);
  const [approving, startApproving] = useTransition();
  const title = cards[0].resourceTitle ?? tCards("noSource");

  function approveGroup() {
    setFailed(false);
    startApproving(async () => {
      const approved = await approveAll(resourceId).catch(() => false);
      setFailed(!approved);
    });
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="min-w-0 truncate font-semibold">{title}</h2>
        <Button
          variant="secondary"
          size="sm"
          disabled={approving}
          onClick={approveGroup}
        >
          {t("approveAll")}
        </Button>
      </div>
      {failed ? (
        <p role="alert" className="text-xs text-destructive">
          {t("actionFailed")}
        </p>
      ) : null}
      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
        {cards.map((card) => (
          <li key={card.id} className="flex flex-col gap-2 p-3">
            <p className="text-sm font-medium wrap-anywhere">{card.front}</p>
            <NoteMarkdown content={card.back} />
            <CardRowActions
              cardId={card.id}
              resourceTitle={card.resourceTitle}
              suspended={false}
              pending
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PendingCards({ cards }: { cards: PendingCard[] }) {
  const t = useTranslations("cardsScreen");

  if (cards.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        {t("pendingEmpty")}
      </p>
    );
  }

  return groupByResource(cards).map(([resourceId, group]) => (
    <PendingGroup
      key={resourceId ?? "none"}
      resourceId={resourceId}
      cards={group}
    />
  ));
}
