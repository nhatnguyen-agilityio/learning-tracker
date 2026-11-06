import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { cardSchedules, cards, reviews } from "@/lib/db/schema";
import { SEEDED_USERS, withTestDb } from "@/lib/db/test-db";
import type { Db } from "@/lib/db/types";
import { createCard, deleteCard, setCardSuspended } from "./cards";
import { createResource } from "./resources";
import {
  isIdempotencyKey,
  isReviewRating,
  MAX_IDEMPOTENCY_KEY_LENGTH,
  recordReview,
  undoReview,
} from "./reviews";

const { a: userA, b: userB } = SEEDED_USERS;
const now = new Date("2026-11-06T12:00:00Z");
const later = new Date("2026-11-06T12:05:00Z");

async function addCard(db: Db, userId: string) {
  const resource = await createResource(db, userId, {
    url: `https://reviews.test/${crypto.randomUUID()}`,
    title: "Guide",
  });
  if (resource.kind !== "created") throw new Error("Resource not created");
  const card = await createCard(db, userId, resource.resource.id, {
    front: "Q",
    back: "A",
  });
  if (card?.kind !== "created") throw new Error("Card not created");
  return card.card.id;
}

async function readSchedule(db: Db, cardId: string) {
  const [schedule] = await db
    .select()
    .from(cardSchedules)
    .where(eq(cardSchedules.cardId, cardId));
  return schedule;
}

const readReviews = (db: Db, cardId: string) =>
  db
    .select({
      rating: reviews.rating,
      reviewedAt: reviews.reviewedAt,
      prevSchedule: reviews.prevSchedule,
    })
    .from(reviews)
    .where(eq(reviews.cardId, cardId));

const rate = (
  db: Db,
  userId: string,
  cardId: string,
  key: string,
  at = now,
  rating: "forgot" | "vaguely" | "remembered" = "remembered",
) => recordReview(db, userId, { cardId, rating, idempotencyKey: key }, at);

describe("recording a rating", () => {
  it("should save the review and move the schedule", () =>
    withTestDb(async (db) => {
      const cardId = await addCard(db, userA);
      const before = await readSchedule(db, cardId);

      const result = await rate(db, userA, cardId, "key-1");

      expect(result?.kind).toBe("saved");
      const after = await readSchedule(db, cardId);
      expect(after.reps).toBe(before.reps + 1);
      expect(after.lastReview).toEqual(now);
      const [review] = await readReviews(db, cardId);
      expect(review.rating).toBe(3);
      expect(review.reviewedAt).toEqual(now);
      expect(review.prevSchedule).toMatchObject({ reps: 0, state: 0 });
    }));

  it.each([
    ["forgot", 1],
    ["vaguely", 2],
    ["remembered", 3],
  ] as const)("should store %s as %d", (rating, value) =>
    withTestDb(async (db) => {
      const cardId = await addCard(db, userA);

      await rate(db, userA, cardId, "key", now, rating);

      expect((await readReviews(db, cardId))[0].rating).toBe(value);
    }),
  );

  it("should create one review when the same key is sent twice", () =>
    withTestDb(async (db) => {
      const cardId = await addCard(db, userA);
      await rate(db, userA, cardId, "key-1");
      const saved = await readSchedule(db, cardId);

      const resent = await rate(db, userA, cardId, "key-1", later);

      expect(resent).toEqual({ kind: "duplicate" });
      expect(await readReviews(db, cardId)).toHaveLength(1);
      expect(await readSchedule(db, cardId)).toEqual(saved);
    }));

  it("should answer duplicate when the card was suspended after saving", () =>
    withTestDb(async (db) => {
      const cardId = await addCard(db, userA);
      await rate(db, userA, cardId, "key-1");
      await setCardSuspended(db, userA, cardId, true);

      expect(await rate(db, userA, cardId, "key-1")).toEqual({
        kind: "duplicate",
      });
    }));

  it("should let two users use the same key", () =>
    withTestDb(async (db) => {
      const cardA = await addCard(db, userA);
      const cardB = await addCard(db, userB);

      await rate(db, userA, cardA, "shared");
      const result = await rate(db, userB, cardB, "shared");

      expect(result?.kind).toBe("saved");
    }));

  it("should not rate another user's card", () =>
    withTestDb(async (db) => {
      const cardId = await addCard(db, userB);
      const before = await readSchedule(db, cardId);

      expect(await rate(db, userA, cardId, "key-1")).toBeNull();
      expect(await readSchedule(db, cardId)).toEqual(before);
      expect(await readReviews(db, cardId)).toEqual([]);
    }));

  it("should not rate a suspended card", () =>
    withTestDb(async (db) => {
      const cardId = await addCard(db, userA);
      await setCardSuspended(db, userA, cardId, true);

      expect(await rate(db, userA, cardId, "key-1")).toBeNull();
    }));

  it("should not rate a pending card", () =>
    withTestDb(async (db) => {
      const cardId = await addCard(db, userA);
      await db
        .update(cards)
        .set({ status: "pending" })
        .where(eq(cards.id, cardId));

      expect(await rate(db, userA, cardId, "key-1")).toBeNull();
    }));

  it("should not rate a deleted card", () =>
    withTestDb(async (db) => {
      const cardId = await addCard(db, userA);
      await rate(db, userA, cardId, "key-1");
      await deleteCard(db, userA, cardId);

      expect(await rate(db, userA, cardId, "key-2", later)).toBeNull();
    }));
});

describe("undoing a rating", () => {
  it("should restore a new card's schedule exactly", () =>
    withTestDb(async (db) => {
      const cardId = await addCard(db, userA);
      const before = await readSchedule(db, cardId);
      await rate(db, userA, cardId, "key-1");

      expect(await undoReview(db, userA, "key-1")).toEqual({ kind: "undone" });

      expect(await readSchedule(db, cardId)).toEqual(before);
      expect(await readReviews(db, cardId)).toEqual([]);
    }));

  it("should restore every field when the card has been reviewed", () =>
    withTestDb(async (db) => {
      const cardId = await addCard(db, userA);
      await rate(db, userA, cardId, "key-1");
      const before = await readSchedule(db, cardId);
      await rate(db, userA, cardId, "key-2", later, "forgot");

      await undoReview(db, userA, "key-2");

      expect(await readSchedule(db, cardId)).toEqual(before);
      expect(before.lastReview).toEqual(now);
    }));

  it("should refuse a rating that is not the latest", () =>
    withTestDb(async (db) => {
      const first = await addCard(db, userA);
      const second = await addCard(db, userA);
      await rate(db, userA, first, "key-1");
      await rate(db, userA, second, "key-2", later);
      const saved = await readSchedule(db, first);

      expect(await undoReview(db, userA, "key-1")).toEqual({
        kind: "not_latest",
      });
      expect(await readSchedule(db, first)).toEqual(saved);
    }));

  it("should change nothing when the undo is sent twice", () =>
    withTestDb(async (db) => {
      const cardId = await addCard(db, userA);
      await rate(db, userA, cardId, "key-1");
      await undoReview(db, userA, "key-1");
      const undone = await readSchedule(db, cardId);

      expect(await undoReview(db, userA, "key-1")).toEqual({
        kind: "already_undone",
      });
      expect(await readSchedule(db, cardId)).toEqual(undone);
    }));

  it("should let the user rate again with the same key after undo", () =>
    withTestDb(async (db) => {
      const cardId = await addCard(db, userA);
      await rate(db, userA, cardId, "key-1");
      await undoReview(db, userA, "key-1");

      const again = await rate(db, userA, cardId, "key-1", later);

      expect(again?.kind).toBe("saved");
    }));

  it("should not undo another user's rating", () =>
    withTestDb(async (db) => {
      const cardId = await addCard(db, userB);
      await rate(db, userB, cardId, "key-1");
      const saved = await readSchedule(db, cardId);

      expect(await undoReview(db, userA, "key-1")).toEqual({
        kind: "already_undone",
      });
      expect(await readSchedule(db, cardId)).toEqual(saved);
      expect(await readReviews(db, cardId)).toHaveLength(1);
    }));
});

describe("checking input", () => {
  it.each(["forgot", "vaguely", "remembered"])("should accept %s", (rating) => {
    expect(isReviewRating(rating)).toBe(true);
  });

  it.each(["easy", "toString", 3, null])("should refuse %s", (rating) => {
    expect(isReviewRating(rating)).toBe(false);
  });

  it("should accept a key at the length limit", () => {
    expect(isIdempotencyKey("k".repeat(MAX_IDEMPOTENCY_KEY_LENGTH))).toBe(true);
  });

  it.each(["", "k".repeat(MAX_IDEMPOTENCY_KEY_LENGTH + 1), 5])(
    "should refuse the key %s",
    (key) => {
      expect(isIdempotencyKey(key)).toBe(false);
    },
  );
});
