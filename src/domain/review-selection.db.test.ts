import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  cardSchedules,
  cards,
  resources,
  reviews,
  userSettings,
} from "@/lib/db/schema";
import { SEEDED_USERS, withTestDb } from "@/lib/db/test-db";
import type { Db } from "@/lib/db/types";
import { REVIEW_BATCH_SIZE, selectReviewCards } from "./review-selection";

const { a: userA, b: userB } = SEEDED_USERS;

const now = new Date("2026-11-06T12:00:00Z");
const hoursAgo = (hours: number) =>
  new Date(now.getTime() - hours * 60 * 60 * 1000);

const NEW = 0;
const REVIEW = 2;

type CardOptions = {
  userId?: string;
  state?: number;
  due?: Date;
  status?: "pending" | "active" | "suspended";
  deletedAt?: Date;
  createdAt?: Date;
};

async function addCards(db: Db, total: number, options: CardOptions = {}) {
  const userId = options.userId ?? userA;
  const rows = await db
    .insert(cards)
    .values(
      Array.from({ length: total }, () => ({
        userId,
        front: "Q",
        back: "A",
        status: options.status ?? "active",
        deletedAt: options.deletedAt,
        createdAt: options.createdAt,
      })),
    )
    .returning({ id: cards.id });
  await db.insert(cardSchedules).values(
    rows.map(({ id }) => ({
      cardId: id,
      userId,
      state: options.state ?? NEW,
      due: options.due ?? hoursAgo(1),
    })),
  );
  return rows.map(({ id }) => id);
}

const addDue = (db: Db, total: number, options: CardOptions = {}) =>
  addCards(db, total, { state: REVIEW, ...options });

async function addReview(db: Db, cardId: string, reviewedAt: Date) {
  await db.insert(reviews).values({
    cardId,
    userId: userA,
    rating: 3,
    reviewedAt,
    elapsedDays: 0,
    scheduledDays: 1,
    idempotencyKey: crypto.randomUUID(),
    prevSchedule: {},
  });
}

/** Starts from a known account; `withTestDb` rolls all of this back. */
function withCleanUser(
  test: (db: Db) => Promise<void>,
  settings: { timezone?: string; newCardsPerDay?: number } = {},
) {
  return withTestDb(async (db) => {
    await db.delete(cards).where(eq(cards.userId, userA));
    const values = {
      timezone: settings.timezone ?? "UTC",
      newCardsPerDay: settings.newCardsPerDay ?? 20,
    };
    await db
      .insert(userSettings)
      .values({ userId: userA, locale: "en", ...values })
      .onConflictDoUpdate({ target: userSettings.userId, set: values });
    await test(db);
  });
}

const ids = async (db: Db) =>
  (await selectReviewCards(db, userA, now)).cards.map((card) => card.id);

describe("selecting due cards", () => {
  it("should put the longest overdue card first", () =>
    withCleanUser(async (db) => {
      const [recent] = await addDue(db, 1, { due: hoursAgo(1) });
      const [oldest] = await addDue(db, 1, { due: hoursAgo(90) });
      const [middle] = await addDue(db, 1, { due: hoursAgo(20) });

      expect(await ids(db)).toEqual([oldest, middle, recent]);
    }));

  it("should return at most one batch", () =>
    withCleanUser(async (db) => {
      await addDue(db, REVIEW_BATCH_SIZE + 5);

      const result = await selectReviewCards(db, userA, now);

      expect(result.cards).toHaveLength(REVIEW_BATCH_SIZE);
      expect(result.dueCount).toBe(REVIEW_BATCH_SIZE + 5);
    }));

  it("should leave out a card when it is not due yet", () =>
    withCleanUser(async (db) => {
      await addDue(db, 1, { due: new Date(now.getTime() + 1000) });

      expect(await ids(db)).toEqual([]);
    }));

  it("should include a card when it is due right now", () =>
    withCleanUser(async (db) => {
      const [id] = await addDue(db, 1, { due: now });

      expect(await ids(db)).toEqual([id]);
    }));

  it("should not limit due cards by the new card limit", () =>
    withCleanUser(
      async (db) => {
        await addDue(db, 5);

        expect(await ids(db)).toHaveLength(5);
      },
      { newCardsPerDay: 1 },
    ));

  it("should return the schedule for the rating step", () =>
    withCleanUser(async (db) => {
      await addDue(db, 1);

      const [card] = (await selectReviewCards(db, userA, now)).cards;

      expect(card).toMatchObject({
        front: "Q",
        back: "A",
        resourceTitle: null,
        schedule: { state: REVIEW, reps: 0, lapses: 0, lastReview: null },
      });
    }));

  it("should return the resource title when the card has a resource", () =>
    withCleanUser(async (db) => {
      const [id] = await addDue(db, 1);
      const [resource] = await db
        .insert(resources)
        .values({
          userId: userA,
          url: "https://selection.test/guide",
          normalizedUrl: `https://selection.test/${crypto.randomUUID()}`,
          title: "Guide",
        })
        .returning({ id: resources.id });
      await db
        .update(cards)
        .set({ resourceId: resource.id })
        .where(eq(cards.id, id));

      const [card] = (await selectReviewCards(db, userA, now)).cards;

      expect(card.resourceTitle).toBe("Guide");
    }));
});

describe("selecting new cards", () => {
  it("should put due cards before new cards", () =>
    withCleanUser(async (db) => {
      const [fresh] = await addCards(db, 1);
      const [due] = await addDue(db, 1);

      expect(await ids(db)).toEqual([due, fresh]);
    }));

  it("should take the oldest new cards first", () =>
    withCleanUser(async (db) => {
      const [later] = await addCards(db, 1, { createdAt: hoursAgo(1) });
      const [earlier] = await addCards(db, 1, { createdAt: hoursAgo(5) });

      expect(await ids(db)).toEqual([earlier, later]);
    }));

  it("should stop at the daily limit", () =>
    withCleanUser(
      async (db) => {
        await addCards(db, 5);

        expect(await ids(db)).toHaveLength(3);
      },
      { newCardsPerDay: 3 },
    ));

  it("should fill only the room left in the batch", () =>
    withCleanUser(
      async (db) => {
        await addDue(db, REVIEW_BATCH_SIZE - 2);
        await addCards(db, 10);

        expect(await ids(db)).toHaveLength(REVIEW_BATCH_SIZE);
      },
      { newCardsPerDay: 10 },
    ));

  it("should count new cards already started today", () =>
    withCleanUser(
      async (db) => {
        const [started] = await addCards(db, 1, { state: REVIEW, due: now });
        await addReview(db, started, hoursAgo(2));
        await addCards(db, 5);

        const result = await selectReviewCards(db, userA, now);

        expect(result.cards.filter((card) => card.id !== started)).toHaveLength(
          2,
        );
      },
      { newCardsPerDay: 3 },
    ));

  it("should not count a card first reviewed before today", () =>
    withCleanUser(
      async (db) => {
        const [old] = await addDue(db, 1, {
          due: new Date(now.getTime() + 1000),
        });
        await addReview(db, old, hoursAgo(30));
        await addReview(db, old, hoursAgo(1));
        await addCards(db, 5);

        expect(await ids(db)).toHaveLength(3);
      },
      { newCardsPerDay: 3 },
    ));

  it("should give the slots back after 04:00", () =>
    withCleanUser(
      async (db) => {
        const [before] = await addDue(db, 1, {
          due: new Date(now.getTime() + 1000),
        });
        await addReview(db, before, new Date("2026-11-06T03:59:00Z"));
        const [after] = await addDue(db, 1, {
          due: new Date(now.getTime() + 1000),
        });
        await addReview(db, after, new Date("2026-11-06T04:00:00Z"));
        await addCards(db, 5);

        expect(await ids(db)).toHaveLength(2);
      },
      { newCardsPerDay: 3 },
    ));

  it("should use the user's time zone for the day", () =>
    withCleanUser(
      async (db) => {
        const [started] = await addDue(db, 1, {
          due: new Date(now.getTime() + 1000),
        });
        await addReview(db, started, new Date("2026-11-05T22:00:00Z"));
        await addCards(db, 5);

        expect(await ids(db)).toHaveLength(2);
      },
      { timezone: "Asia/Ho_Chi_Minh", newCardsPerDay: 3 },
    ));

  it("should give no new cards when today's limit is used up", () =>
    withCleanUser(
      async (db) => {
        const [started] = await addDue(db, 1, {
          due: new Date(now.getTime() + 1000),
        });
        await addReview(db, started, hoursAgo(1));
        await addCards(db, 2);

        expect(await ids(db)).toEqual([]);
      },
      { newCardsPerDay: 1 },
    ));
});

describe("backlog", () => {
  it("should keep new cards when due cards fill one batch exactly", () =>
    withCleanUser(async (db) => {
      await addDue(db, REVIEW_BATCH_SIZE - 1);
      await addCards(db, 3);

      const result = await selectReviewCards(db, userA, now);

      expect(result.isBacklog).toBe(false);
      expect(result.cards).toHaveLength(REVIEW_BATCH_SIZE);
    }));

  it("should not be a backlog at exactly 50 due cards", () =>
    withCleanUser(async (db) => {
      await addDue(db, REVIEW_BATCH_SIZE);

      expect((await selectReviewCards(db, userA, now)).isBacklog).toBe(false);
    }));

  it("should pause new cards at 51 due cards", () =>
    withCleanUser(async (db) => {
      const due = await addDue(db, REVIEW_BATCH_SIZE + 1);
      const fresh = await addCards(db, 3);

      const result = await selectReviewCards(db, userA, now);

      expect(result.isBacklog).toBe(true);
      const selected = result.cards.map((card) => card.id);
      expect(selected).toHaveLength(REVIEW_BATCH_SIZE);
      expect(selected.every((id) => due.includes(id))).toBe(true);
      expect(selected.some((id) => fresh.includes(id))).toBe(false);
    }));
});

describe("cards left out of a session", () => {
  it.each(["suspended", "pending"] as const)(
    "should skip a %s card",
    (status) =>
      withCleanUser(async (db) => {
        await addDue(db, 1, { status });
        await addCards(db, 1, { status });

        const result = await selectReviewCards(db, userA, now);

        expect(result.cards).toEqual([]);
        expect(result.dueCount).toBe(0);
      }),
  );

  it("should skip a deleted card", () =>
    withCleanUser(async (db) => {
      await addDue(db, 1, { deletedAt: hoursAgo(1) });
      await addCards(db, 1, { deletedAt: hoursAgo(1) });

      expect(await ids(db)).toEqual([]);
    }));

  it("should not select another user's cards", () =>
    withCleanUser(async (db) => {
      await addDue(db, 1, { userId: userB });
      await addCards(db, 1, { userId: userB });

      const result = await selectReviewCards(db, userA, now);

      expect(result.cards).toEqual([]);
      expect(result.dueCount).toBe(0);
    }));

  it("should not count another user's reviews toward the limit", () =>
    withCleanUser(
      async (db) => {
        const [other] = await addDue(db, 1, { userId: userB });
        await db.insert(reviews).values({
          cardId: other,
          userId: userB,
          rating: 3,
          reviewedAt: hoursAgo(1),
          elapsedDays: 0,
          scheduledDays: 1,
          idempotencyKey: crypto.randomUUID(),
          prevSchedule: {},
        });
        await addCards(db, 1);

        expect(await ids(db)).toHaveLength(1);
      },
      { newCardsPerDay: 1 },
    ));
});
