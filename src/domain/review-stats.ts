import { and, asc, count, eq, isNull, lte, ne } from "drizzle-orm";
import { cardSchedules, cards, reviews } from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";
import { reviewDayKey } from "./review-day";
import { DEFAULT_TIMEZONE } from "./timezone";
import { getUserSettings } from "./user-settings";

const RECALL_WINDOW_DAYS = 30;
const FORGOT_VALUE = 1;
const RECENT_DAYS = 7;
const NEW_STATE = 0;

/** A span of review days when a card was waiting to be reviewed. */
export type DueSpan = { from: string; until: string | null };

function previousDay(day: string) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/**
 * Days are `YYYY-MM-DD`. A day with a review adds 1. A day with no review
 * breaks the streak only if a card was due; today can't break it because it
 * hasn't ended (SPEC.md, "Review schedule").
 */
export function computeStreak(
  reviewDays: Iterable<string>,
  dueSpans: DueSpan[],
  today: string,
) {
  const reviewed = new Set(reviewDays);
  if (reviewed.size === 0) return 0;

  const firstDay = [...reviewed].sort()[0];
  const hadDueCard = (day: string) =>
    dueSpans.some(
      ({ from, until }) => from <= day && (until === null || day < until),
    );

  let streak = reviewed.has(today) ? 1 : 0;
  for (let day = previousDay(today); day >= firstDay; day = previousDay(day)) {
    if (reviewed.has(day)) streak += 1;
    else if (hadDueCard(day)) break;
  }
  return streak;
}

type RatedReview = { cardId: string; rating: number; day: string };

/** Percent of cards recalled, using each card's first rating of a day. */
export function computeRecallRate(ratings: RatedReview[]) {
  const first = new Map<string, number>();
  for (const { cardId, rating, day } of ratings) {
    const key = `${day}:${cardId}`;
    if (!first.has(key)) first.set(key, rating);
  }
  if (first.size === 0) return null;

  const recalled = [...first.values()].filter(
    (rating) => rating !== FORGOT_VALUE,
  ).length;
  return Math.round((recalled / first.size) * 100);
}

/** Whether each of the last 7 days had a review, today last. */
export function computeRecentDays(reviewDays: Iterable<string>, today: string) {
  const reviewed = new Set(reviewDays);
  const days = [today];
  while (days.length < RECENT_DAYS) days.unshift(previousDay(days[0]));
  return days.map((day) => reviewed.has(day));
}

/** Ratings must be oldest first, which is how they are read below. */
export async function getReviewStats(db: Db, userId: string, now: Date) {
  const settings = await getUserSettings(db, userId);
  const timezone = settings?.timezone ?? DEFAULT_TIMEZONE;

  const isDue = and(
    eq(cards.userId, userId),
    eq(cards.status, "active"),
    isNull(cards.deletedAt),
    ne(cardSchedules.state, NEW_STATE),
    lte(cardSchedules.due, now),
  );

  const [history, waiting, [{ dueCount }]] = await Promise.all([
    db
      .select({
        cardId: reviews.cardId,
        rating: reviews.rating,
        reviewedAt: reviews.reviewedAt,
        prevSchedule: reviews.prevSchedule,
      })
      .from(reviews)
      .where(eq(reviews.userId, userId))
      .orderBy(asc(reviews.reviewedAt)),
    db
      .select({ due: cardSchedules.due })
      .from(cards)
      .innerJoin(cardSchedules, eq(cardSchedules.cardId, cards.id))
      .where(isDue),
    db
      .select({ dueCount: count() })
      .from(cards)
      .innerJoin(cardSchedules, eq(cardSchedules.cardId, cards.id))
      .where(isDue),
  ]);

  const dayOf = (date: Date) => reviewDayKey(date, timezone);
  const rated = history.map((review) => ({
    ...review,
    day: dayOf(review.reviewedAt),
  }));

  // No table records past due cards, so they are worked out from each review's
  // earlier schedule and from cards still waiting today.
  const dueSpans: DueSpan[] = [
    ...rated.flatMap(({ prevSchedule, day }) => {
      const before = prevSchedule as { due?: string; state?: number };
      if (!before.due || before.state === NEW_STATE) return [];
      return [{ from: dayOf(new Date(before.due)), until: day }];
    }),
    ...waiting.map(({ due }) => ({ from: dayOf(due), until: null })),
  ];

  const windowStart = now.getTime() - RECALL_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  const reviewDays = rated.map(({ day }) => day);

  return {
    streak: computeStreak(reviewDays, dueSpans, dayOf(now)),
    recentDays: computeRecentDays(reviewDays, dayOf(now)),
    dueCount,
    recallRate: computeRecallRate(
      rated.filter(({ reviewedAt }) => reviewedAt.getTime() >= windowStart),
    ),
  };
}
