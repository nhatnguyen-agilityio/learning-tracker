"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Button } from "@/components/ui/button";
import type { ReviewRating } from "@/domain/fsrs";
import {
  createReviewQueue,
  type QueuedRating,
  type QueueStatus,
  type SendResult,
} from "@/lib/review-queue/queue";
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

async function sendRating(entry: QueuedRating): Promise<SendResult> {
  const response = await fetch("/api/reviews", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(entry),
  });

  if (response.ok) return "done";
  if (response.status === 401) return "stop";
  return response.status < 500 ? "drop" : "retry";
}

function subscribeToNetwork(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function readStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="rounded-sm border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">
      {children}
    </kbd>
  );
}

export function ReviewSession({
  cards,
  userId,
}: {
  cards: ReviewCardData[];
  userId: string;
}) {
  const t = useTranslations("review");
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [waitingIds, setWaitingIds] = useState<string[]>([]);
  const [queueState, setQueueState] = useState<{
    pending: number;
    status: QueueStatus;
  }>({ pending: 0, status: "idle" });
  const online = useSyncExternalStore(
    subscribeToNetwork,
    () => navigator.onLine,
    () => true,
  );
  const queue = useRef<ReturnType<typeof createReviewQueue>>(null);

  useEffect(() => {
    const current = createReviewQueue({
      userId,
      storage: readStorage(),
      send: sendRating,
      onChange: setQueueState,
      onRestore: setWaitingIds,
    });
    queue.current = current;
    current.start();

    const sendNow = () => current.retryNow();
    window.addEventListener("online", sendNow);
    return () => {
      current.pause();
      window.removeEventListener("online", sendNow);
    };
  }, [userId]);

  const session = cards.filter((item) => !waitingIds.includes(item.id));
  const card = session.at(index);
  const left = session.length - index;

  function rate(rating: ReviewRating) {
    if (!card) return;

    queue.current?.add({
      cardId: card.id,
      rating,
      idempotencyKey: crypto.randomUUID(),
    });
    setIndex((current) => current + 1);
    setFlipped(false);
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
      {session.length > 0 ? (
        <span aria-hidden className="h-1 overflow-hidden rounded-full bg-muted">
          <span
            className="block h-full rounded-full bg-primary"
            style={{ width: `${(index / session.length) * 100}%` }}
          />
        </span>
      ) : null}
      {!online ? (
        <p
          role="status"
          className="rounded-md bg-warning-soft p-3 text-sm text-warning-soft-foreground"
        >
          {t("offline", { count: queueState.pending })}
        </p>
      ) : null}
      {online && queueState.status === "retrying" ? (
        <p
          role="status"
          className="rounded-md bg-muted p-3 text-sm text-muted-foreground"
        >
          {t("resending", { count: queueState.pending })}
        </p>
      ) : null}
      {queueState.status === "stopped" ? (
        <p role="alert" className="text-sm text-destructive">
          {t("signedOut")}
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
