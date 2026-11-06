import { and, desc, eq, isNull } from "drizzle-orm";
import { cardSchedules, cards, reviews } from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";
import { type CardSchedule, nextSchedule, type ReviewRating } from "./fsrs";

export const MAX_IDEMPOTENCY_KEY_LENGTH = 100;

const RATING_VALUES = { forgot: 1, vaguely: 2, remembered: 3 } as const;

export function isReviewRating(value: unknown): value is ReviewRating {
  return typeof value === "string" && Object.hasOwn(RATING_VALUES, value);
}

export function isIdempotencyKey(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_IDEMPOTENCY_KEY_LENGTH
  );
}

/** `prev_schedule` is JSON, so dates are stored as ISO strings. */
type StoredSchedule = Omit<CardSchedule, "due" | "lastReview"> & {
  due: string;
  lastReview: string | null;
};

function toStored(schedule: CardSchedule): StoredSchedule {
  return {
    ...schedule,
    due: schedule.due.toISOString(),
    lastReview: schedule.lastReview?.toISOString() ?? null,
  };
}

function fromStored(stored: StoredSchedule): CardSchedule {
  return {
    ...stored,
    due: new Date(stored.due),
    lastReview: stored.lastReview ? new Date(stored.lastReview) : null,
  };
}

function findReview(db: Db, userId: string, idempotencyKey: string) {
  return db
    .select({
      id: reviews.id,
      cardId: reviews.cardId,
      prevSchedule: reviews.prevSchedule,
    })
    .from(reviews)
    .where(
      and(
        eq(reviews.userId, userId),
        eq(reviews.idempotencyKey, idempotencyKey),
      ),
    );
}

/**
 * Saves one rating and moves the schedule. A key that was already saved does
 * nothing, so the client can resend safely. Returns null for a card that can't
 * be reviewed: another user's, suspended, deleted, pending or missing.
 */
export function recordReview(
  db: Db,
  userId: string,
  input: { cardId: string; rating: ReviewRating; idempotencyKey: string },
  now: Date,
) {
  return db.transaction(async (tx) => {
    const [saved] = await findReview(tx, userId, input.idempotencyKey);
    if (saved) return { kind: "duplicate" } as const;

    const [current] = await tx
      .select({
        due: cardSchedules.due,
        stability: cardSchedules.stability,
        difficulty: cardSchedules.difficulty,
        learningSteps: cardSchedules.learningSteps,
        reps: cardSchedules.reps,
        lapses: cardSchedules.lapses,
        state: cardSchedules.state,
        lastReview: cardSchedules.lastReview,
      })
      .from(cardSchedules)
      .innerJoin(cards, eq(cards.id, cardSchedules.cardId))
      .where(
        and(
          eq(cards.userId, userId),
          eq(cards.id, input.cardId),
          eq(cards.status, "active"),
          isNull(cards.deletedAt),
        ),
      )
      .for("update", { of: cardSchedules });
    if (!current) return null;

    const next = nextSchedule(current, input.rating, now);

    // A second request with the same key waits on the lock and stops here.
    const inserted = await tx
      .insert(reviews)
      .values({
        cardId: input.cardId,
        userId,
        rating: RATING_VALUES[input.rating],
        reviewedAt: now,
        elapsedDays: next.elapsedDays,
        scheduledDays: next.scheduledDays,
        idempotencyKey: input.idempotencyKey,
        prevSchedule: toStored(current),
      })
      .onConflictDoNothing({
        target: [reviews.userId, reviews.idempotencyKey],
      })
      .returning({ id: reviews.id });
    if (inserted.length === 0) return { kind: "duplicate" } as const;

    await tx
      .update(cardSchedules)
      .set(next.schedule)
      .where(
        and(
          eq(cardSchedules.userId, userId),
          eq(cardSchedules.cardId, input.cardId),
        ),
      );
    return { kind: "saved", schedule: next.schedule } as const;
  });
}

/**
 * Undoes the account's latest rating: the schedule goes back and the review is
 * removed, so streaks and daily limits stay right. A key with no review, like
 * a resent undo or another user's key, changes nothing.
 */
export function undoReview(db: Db, userId: string, idempotencyKey: string) {
  return db.transaction(async (tx) => {
    const [latest] = await tx
      .select({ id: reviews.id })
      .from(reviews)
      .where(eq(reviews.userId, userId))
      .orderBy(desc(reviews.reviewedAt), desc(reviews.id))
      .limit(1)
      .for("update");

    const [review] = await findReview(tx, userId, idempotencyKey);
    if (!review) return { kind: "already_undone" } as const;
    if (review.id !== latest?.id) return { kind: "not_latest" } as const;

    await tx
      .update(cardSchedules)
      .set(fromStored(review.prevSchedule as StoredSchedule))
      .where(
        and(
          eq(cardSchedules.userId, userId),
          eq(cardSchedules.cardId, review.cardId),
        ),
      );
    await tx
      .delete(reviews)
      .where(and(eq(reviews.userId, userId), eq(reviews.id, review.id)));
    return { kind: "undone" } as const;
  });
}
