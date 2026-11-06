"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { loadReviewBatch, loadStreak } from "@/app/review/actions";
import { Button } from "@/components/ui/button";
import type { ReviewRating } from "@/domain/fsrs";
import {
  createReviewQueue,
  type QueuedAction,
  type QueueStatus,
  type SendResult,
} from "@/lib/review-queue/queue";
import {
  cardsLeft,
  currentItem,
  dropCards,
  rateCurrent,
  startNextBatch,
  startSession,
  summarize,
  undoLast,
} from "@/lib/review-session/session";
import { ReviewCard, type ReviewCardData } from "./review-card";
import { ReviewSummary } from "./review-summary";

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

function postJson(url: string, body: unknown) {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function toSendResult(response: Response): SendResult {
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
  initialRemaining,
  userId,
}: {
  cards: ReviewCardData[];
  initialRemaining: number;
  userId: string;
}) {
  const t = useTranslations("review");
  const [session, setSession] = useState(() => startSession(cards));
  const [remaining, setRemaining] = useState(initialRemaining);
  const [batchFailed, setBatchFailed] = useState(false);
  const [streak, setStreak] = useState<number | null>(null);
  const [loadingBatch, startLoadingBatch] = useTransition();
  const [flipped, setFlipped] = useState(false);
  const [undoFailed, setUndoFailed] = useState(false);
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
    async function send(entry: QueuedAction) {
      if (!("undo" in entry)) {
        return toSendResult(await postJson("/api/reviews", entry));
      }
      const response = await postJson("/api/reviews/undo", {
        idempotencyKey: entry.idempotencyKey,
      });
      if (response.status === 409) setUndoFailed(true);
      return toSendResult(response);
    }

    const current = createReviewQueue({
      userId,
      storage: readStorage(),
      send,
      onChange: setQueueState,
      onRestore: (cardIds) => setSession((state) => dropCards(state, cardIds)),
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

  const item = currentItem(session);
  const card = item?.card;
  const left = cardsLeft(session);
  const summary = summarize(session);

  // Read after the queue is empty, so today's ratings are counted.
  const showingSummary = !card && summary.reviewed > 0;
  const allSent = queueState.pending === 0;
  useEffect(() => {
    if (!showingSummary || !allSent) return;

    let current = true;
    loadStreak()
      .then((value) => {
        if (current) setStreak(value);
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [showingSummary, allSent]);

  function keepReviewing() {
    setBatchFailed(false);
    startLoadingBatch(async () => {
      const batch = await loadReviewBatch().catch(() => null);
      if (!batch) {
        setBatchFailed(true);
        return;
      }
      setRemaining(batch.remaining);
      setSession((state) => startNextBatch(state, batch.cards));
      setFlipped(false);
    });
  }

  function rate(rating: ReviewRating) {
    if (!card) return;

    const idempotencyKey = crypto.randomUUID();
    queue.current?.add({ cardId: card.id, rating, idempotencyKey });
    setSession((state) => rateCurrent(state, rating, idempotencyKey));
    setFlipped(false);
    setUndoFailed(false);
  }

  function undo() {
    if (!session.last) return;

    queue.current?.undo(session.last.idempotencyKey);
    setSession(undoLast);
    setFlipped(false);
  }

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.repeat || isTyping(event.target)) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    if (event.key.toLowerCase() === "z") {
      undo();
      return;
    }
    if (!card) return;
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
        <Button
          variant="ghost"
          size="sm"
          disabled={!session.last}
          onClick={undo}
        >
          {t("undo")}
        </Button>
      </div>
      {session.items.length > 0 ? (
        <span aria-hidden className="h-1 overflow-hidden rounded-full bg-muted">
          <span
            className="block h-full rounded-full bg-primary"
            style={{
              width: `${(session.position / session.items.length) * 100}%`,
            }}
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
      {undoFailed ? (
        <p role="alert" className="text-sm text-destructive">
          {t("undoFailed")}
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
            key={`${card.id}-${session.position}`}
            card={card}
            again={item?.again ?? false}
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
            <Kbd>3</Kbd> {t("keyRate")} <Kbd>Z</Kbd> {t("undo")}
          </p>
        </div>
      ) : summary.reviewed > 0 ? (
        <ReviewSummary
          summary={summary}
          remaining={remaining}
          streak={streak}
          pending={queueState.pending}
          loading={loadingBatch}
          loadFailed={batchFailed}
          onContinue={keepReviewing}
        />
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
