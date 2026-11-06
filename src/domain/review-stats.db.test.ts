import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { cardSchedules, cards, reviews, userSettings } from "@/lib/db/schema";
import { SEEDED_USERS, withTestDb } from "@/lib/db/test-db";
import type { Db } from "@/lib/db/types";
import { getReviewStats } from "./review-stats";

const { a: userA, b: userB } = SEEDED_USERS;
const now = new Date("2026-11-06T12:00:00Z");
const daysAgo = (days: number) =>
  new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
const REVIEW = 2;

async function addCard(
  db: Db,
  options: { userId?: string; state?: number; due?: Date } = {},
) {
  const userId = options.userId ?? userA;
  const [card] = await db
    .insert(cards)
    .values({ userId, front: "Q", back: "A", status: "active" })
    .returning({ id: cards.id });
  await db.insert(cardSchedules).values({
    cardId: card.id,
    userId,
    state: options.state ?? REVIEW,
    due: options.due ?? new Date(now.getTime() + 30 * 86_400_000),
  });
  return card.id;
}

async function addReview(
  db: Db,
  cardId: string,
  reviewedAt: Date,
  options: {
    userId?: string;
    rating?: number;
    prev?: { due: string; state: number };
  } = {},
) {
  await db.insert(reviews).values({
    cardId,
    userId: options.userId ?? userA,
    rating: options.rating ?? 3,
    reviewedAt,
    elapsedDays: 0,
    scheduledDays: 1,
    idempotencyKey: crypto.randomUUID(),
    prevSchedule: options.prev ?? { due: now.toISOString(), state: 0 },
  });
}

function withCleanUser(test: (db: Db) => Promise<void>, timezone = "UTC") {
  return withTestDb(async (db) => {
    await db.delete(cards).where(eq(cards.userId, userA));
    await db
      .insert(userSettings)
      .values({ userId: userA, locale: "en", timezone })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: { timezone },
      });
    await test(db);
  });
}

describe("reading review stats", () => {
  it("should be empty when the user never reviewed", () =>
    withCleanUser(async (db) => {
      expect(await getReviewStats(db, userA, now)).toEqual({
        streak: 0,
        dueCount: 0,
        recallRate: null,
      });
    }));

  it("should count days from the stored reviews", () =>
    withCleanUser(async (db) => {
      const id = await addCard(db);
      await addReview(db, id, daysAgo(2));
      await addReview(db, id, daysAgo(1));
      await addReview(db, id, now);

      expect((await getReviewStats(db, userA, now)).streak).toBe(3);
    }));

  it("should break when a later review shows a card was due in the gap", () =>
    withCleanUser(async (db) => {
      const id = await addCard(db);
      await addReview(db, id, daysAgo(3));
      await addReview(db, id, now, {
        prev: { due: daysAgo(2).toISOString(), state: REVIEW },
      });

      expect((await getReviewStats(db, userA, now)).streak).toBe(1);
    }));

  it("should not break when the later review was of a new card", () =>
    withCleanUser(async (db) => {
      const id = await addCard(db);
      await addReview(db, id, daysAgo(3));
      await addReview(db, id, now, {
        prev: { due: daysAgo(2).toISOString(), state: 0 },
      });

      expect((await getReviewStats(db, userA, now)).streak).toBe(2);
    }));

  it("should break when a card has waited since before the gap", () =>
    withCleanUser(async (db) => {
      const id = await addCard(db, { due: daysAgo(2) });
      await addReview(db, id, daysAgo(3));

      const stats = await getReviewStats(db, userA, now);

      expect(stats.streak).toBe(0);
      expect(stats.dueCount).toBe(1);
    }));

  it("should use the 04:00 boundary in the user's time zone", () =>
    withCleanUser(async (db) => {
      const id = await addCard(db);
      await addReview(db, id, new Date("2026-11-05T20:00:00Z"));
      await addReview(db, id, new Date("2026-11-05T21:30:00Z"));

      const { streak } = await getReviewStats(db, userA, now);

      expect(streak).toBe(2);
    }, "Asia/Ho_Chi_Minh"));

  it("should keep the reviews of a soft deleted card", () =>
    withCleanUser(async (db) => {
      const id = await addCard(db);
      await addReview(db, id, now);
      await db.update(cards).set({ deletedAt: now }).where(eq(cards.id, id));

      expect((await getReviewStats(db, userA, now)).streak).toBe(1);
    }));

  it("should leave ratings older than 30 days out of the recall rate", () =>
    withCleanUser(async (db) => {
      const id = await addCard(db);
      await addReview(db, id, daysAgo(40), { rating: 1 });
      await addReview(db, id, daysAgo(1), { rating: 3 });

      expect((await getReviewStats(db, userA, now)).recallRate).toBe(100);
    }));

  it("should not read another user's data", () =>
    withCleanUser(async (db) => {
      const id = await addCard(db, { userId: userB, due: daysAgo(1) });
      await addReview(db, id, now, { userId: userB });

      expect(await getReviewStats(db, userA, now)).toEqual({
        streak: 0,
        dueCount: 0,
        recallRate: null,
      });
    }));
});
