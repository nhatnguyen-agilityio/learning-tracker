import { and, asc, count, eq, isNull, lte, ne, sql } from "drizzle-orm";
import { cardSchedules, cards, reviews } from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";
import { reviewDayStart } from "./review-day";
import { DEFAULT_TIMEZONE } from "./timezone";
import { getUserSettings } from "./user-settings";

export const REVIEW_BATCH_SIZE = 50;

const DEFAULT_NEW_CARDS_PER_DAY = 20;
const NEW_STATE = 0;

const reviewCardFields = {
  id: cards.id,
  front: cards.front,
  back: cards.back,
  due: cardSchedules.due,
  stability: cardSchedules.stability,
  difficulty: cardSchedules.difficulty,
  learningSteps: cardSchedules.learningSteps,
  reps: cardSchedules.reps,
  lapses: cardSchedules.lapses,
  state: cardSchedules.state,
  lastReview: cardSchedules.lastReview,
};

/** Cards first reviewed in the current review day, so they used a new slot. */
async function countNewCardsStarted(db: Db, userId: string, dayStart: Date) {
  const firstReviews = db
    .select({ cardId: reviews.cardId })
    .from(reviews)
    .where(eq(reviews.userId, userId))
    .groupBy(reviews.cardId)
    .having(sql`min(${reviews.reviewedAt}) >= ${dayStart.toISOString()}`)
    .as("first_reviews");

  const [{ total }] = await db.select({ total: count() }).from(firstReviews);
  return total;
}

/**
 * The next batch: due cards, longest overdue first, then new cards up to the
 * daily limit. More than one batch of due cards is a backlog, and a backlog
 * pauses new cards (SPEC.md, "Review schedule").
 */
export async function selectReviewCards(db: Db, userId: string, now: Date) {
  const settings = await getUserSettings(db, userId);
  const newCardsPerDay = settings?.newCardsPerDay ?? DEFAULT_NEW_CARDS_PER_DAY;
  const timezone = settings?.timezone ?? DEFAULT_TIMEZONE;

  const reviewable = and(
    eq(cards.userId, userId),
    eq(cards.status, "active"),
    isNull(cards.deletedAt),
  );
  const isDue = and(
    reviewable,
    ne(cardSchedules.state, NEW_STATE),
    lte(cardSchedules.due, now),
  );

  const [dueRows, [{ dueCount }]] = await Promise.all([
    db
      .select(reviewCardFields)
      .from(cards)
      .innerJoin(cardSchedules, eq(cardSchedules.cardId, cards.id))
      .where(isDue)
      .orderBy(asc(cardSchedules.due), asc(cards.id))
      .limit(REVIEW_BATCH_SIZE),
    db
      .select({ dueCount: count() })
      .from(cards)
      .innerJoin(cardSchedules, eq(cardSchedules.cardId, cards.id))
      .where(isDue),
  ]);

  const isBacklog = dueCount > REVIEW_BATCH_SIZE;
  const newRows = isBacklog
    ? []
    : await selectNewCards(db, {
        reviewable,
        userId,
        dayStart: reviewDayStart(now, timezone),
        newCardsPerDay,
        room: REVIEW_BATCH_SIZE - dueRows.length,
      });

  return {
    cards: [...dueRows, ...newRows].map(({ id, front, back, ...schedule }) => ({
      id,
      front,
      back,
      schedule,
    })),
    dueCount,
    isBacklog,
  };
}

async function selectNewCards(
  db: Db,
  options: {
    reviewable: ReturnType<typeof and>;
    userId: string;
    dayStart: Date;
    newCardsPerDay: number;
    room: number;
  },
) {
  const started = await countNewCardsStarted(
    db,
    options.userId,
    options.dayStart,
  );
  const limit = Math.min(options.newCardsPerDay - started, options.room);
  if (limit <= 0) return [];

  return db
    .select(reviewCardFields)
    .from(cards)
    .innerJoin(cardSchedules, eq(cardSchedules.cardId, cards.id))
    .where(and(options.reviewable, eq(cardSchedules.state, NEW_STATE)))
    .orderBy(asc(cards.createdAt), asc(cards.id))
    .limit(limit);
}
