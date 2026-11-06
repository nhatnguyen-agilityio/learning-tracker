import type { ReviewRating } from "@/domain/fsrs";

export type QueuedRating = {
  cardId: string;
  rating: ReviewRating;
  idempotencyKey: string;
};

/** done: saved. drop: resending can't help. retry: try later. stop: signed out. */
export type SendResult = "done" | "drop" | "retry" | "stop";

export type QueueStatus = "idle" | "sending" | "retrying" | "stopped";

type QueueOptions = {
  userId: string;
  storage: Pick<Storage, "getItem" | "setItem"> | null;
  send: (entry: QueuedRating) => Promise<SendResult>;
  onChange: (state: { pending: number; status: QueueStatus }) => void;
  /** Gets the cards rated on a past visit, which are already done. */
  onRestore?: (cardIds: string[]) => void;
};

const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;

export function retryDelay(attempt: number) {
  return Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
}

function isQueuedRating(value: unknown): value is QueuedRating {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.cardId === "string" &&
    typeof entry.rating === "string" &&
    typeof entry.idempotencyKey === "string"
  );
}

/**
 * Keeps ratings in localStorage until the server has them, and sends them one
 * at a time in order. Each user has their own key, so one person's ratings are
 * never sent under another person's session.
 */
export function createReviewQueue({
  userId,
  storage,
  send,
  onChange,
  onRestore,
}: QueueOptions) {
  const storageKey = `review-queue:${userId}`;
  let entries: QueuedRating[] = [];
  let status: QueueStatus = "idle";
  let sending = false;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function setStatus(next: QueueStatus) {
    status = next;
    onChange({ pending: entries.length, status });
  }

  function save() {
    try {
      storage?.setItem(storageKey, JSON.stringify(entries));
    } catch {
      // Blocked or full storage: the rating still goes out from memory.
    }
  }

  function load() {
    try {
      const parsed: unknown = JSON.parse(storage?.getItem(storageKey) ?? "[]");
      entries = Array.isArray(parsed) ? parsed.filter(isQueuedRating) : [];
    } catch {
      entries = [];
    }
  }

  async function flush() {
    if (sending) return;
    clearTimeout(timer);
    sending = true;

    while (entries.length > 0) {
      setStatus("sending");
      const result = await send(entries[0]).catch((): SendResult => "retry");

      if (result === "stop") {
        sending = false;
        setStatus("stopped");
        return;
      }
      if (result === "retry") {
        sending = false;
        timer = setTimeout(flush, retryDelay(attempt));
        attempt += 1;
        setStatus("retrying");
        return;
      }
      entries = entries.slice(1);
      attempt = 0;
      save();
    }

    sending = false;
    setStatus("idle");
  }

  return {
    /** Loads what a past visit left behind and starts sending it. */
    start() {
      load();
      onRestore?.(entries.map((entry) => entry.cardId));
      void flush();
    },
    add(entry: QueuedRating) {
      entries = [...entries, entry];
      save();
      void flush();
    },
    /** The network is back, so there is no need to wait for the timer. */
    retryNow() {
      attempt = 0;
      void flush();
    },
    /** Leaves the stored ratings in place for the next visit. */
    pause() {
      clearTimeout(timer);
    },
  };
}
