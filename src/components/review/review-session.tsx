"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useEffectEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ReviewRating } from "@/domain/fsrs";
import { ReviewCard, type ReviewCardData } from "./review-card";

const RATINGS = [
  {
    rating: "forgot",
    key: "1",
    className: "bg-destructive-soft text-destructive-soft-foreground",
  },
  {
    rating: "vaguely",
    key: "2",
    className: "bg-warning-soft text-warning-soft-foreground",
  },
  {
    rating: "remembered",
    key: "3",
    className: "bg-success-soft text-success-soft-foreground",
  },
] as const satisfies {
  rating: ReviewRating;
  key: string;
  className: string;
}[];

function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

async function sendRating(cardId: string, rating: ReviewRating) {
  const response = await fetch("/api/reviews", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      cardId,
      rating,
      idempotencyKey: crypto.randomUUID(),
    }),
  });
  return response.ok;
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="rounded-sm border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">
      {children}
    </kbd>
  );
}

export function ReviewSession({ cards }: { cards: ReviewCardData[] }) {
  const t = useTranslations("review");
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const card = cards.at(index);
  const left = cards.length - index;

  function rate(rating: ReviewRating) {
    if (!card) return;

    setIndex((current) => current + 1);
    setFlipped(false);
    sendRating(card.id, rating)
      .catch(() => false)
      .then((saved) => {
        if (!saved) setSaveFailed(true);
      });
  }

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (!card || event.repeat || isTyping(event.target)) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    if (event.code === "Space") {
      event.preventDefault();
      setFlipped(true);
      return;
    }
    const match = RATINGS.find(({ key }) => key === event.key);
    if (match && flipped) rate(match.rating);
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  return (
    <div className="mx-auto flex h-dvh w-full max-w-160 flex-col gap-2 overflow-y-auto p-4">
      <h1 className="sr-only">{t("title")}</h1>
      <div className="flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/">{t("exit")}</Link>
        </Button>
        {card ? (
          <span className="text-xs text-muted-foreground">
            {t("left", { count: left })}
          </span>
        ) : null}
      </div>
      {cards.length > 0 ? (
        <span aria-hidden className="h-1 overflow-hidden rounded-full bg-muted">
          <span
            className="block h-full rounded-full bg-primary"
            style={{ width: `${(index / cards.length) * 100}%` }}
          />
        </span>
      ) : null}
      {saveFailed ? (
        <p role="alert" className="text-sm text-destructive">
          {t("saveFailed")}
        </p>
      ) : null}

      {card ? (
        <div className="flex flex-1 flex-col justify-center gap-4">
          <ReviewCard
            key={card.id}
            card={card}
            flipped={flipped}
            onFlip={() => setFlipped(true)}
          />
          {flipped ? (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-3 gap-2">
                {RATINGS.map(({ rating, key, className }) => (
                  <button
                    key={rating}
                    type="button"
                    className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border border-transparent p-2 text-sm font-medium hover:border-current ${className}`}
                    onClick={() => rate(rating)}
                  >
                    {t(rating)}
                    <small className="font-mono text-xs opacity-85">
                      {key}
                    </small>
                  </button>
                ))}
              </div>
              <p className="text-center text-xs text-muted-foreground">
                {t("help")}
              </p>
            </div>
          ) : (
            <Button
              size="lg"
              className="w-full"
              onClick={() => setFlipped(true)}
            >
              {t("flip")}
            </Button>
          )}
          <p className="hidden items-center justify-center gap-1 text-xs text-muted-foreground min-[900px]:flex">
            <Kbd>Space</Kbd> {t("keyFlip")} <Kbd>1</Kbd> <Kbd>2</Kbd>{" "}
            <Kbd>3</Kbd> {t("keyRate")}
          </p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <p className="text-lg font-semibold">{t("noneLeft")}</p>
          <Button asChild variant="secondary">
            <Link href="/">{t("backToday")}</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
