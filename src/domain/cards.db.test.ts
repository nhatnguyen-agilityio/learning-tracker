import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { cardSchedules, cards } from "@/lib/db/schema";
import { SEEDED_USERS, withTestDb } from "@/lib/db/test-db";
import type { Db } from "@/lib/db/types";
import { MAX_CARD_SIDE_BYTES, MAX_CARDS_PER_USER } from "./card-limits";
import { createCard, listResourceCards } from "./cards";
import { createResource } from "./resources";

const { a: userA, b: userB } = SEEDED_USERS;
const sides = { front: "Question", back: "Answer" };

async function addResource(db: Db, userId: string) {
  const result = await createResource(db, userId, {
    url: `https://cards.test/${crypto.randomUUID()}`,
    title: "Guide",
  });
  if (result.kind !== "created") throw new Error("Resource not created");
  return result.resource.id;
}

async function addCard(db: Db, userId: string, resourceId: string) {
  const result = await createCard(db, userId, resourceId, sides);
  if (result?.kind !== "created") throw new Error("Card not created");
  return result.card.id;
}

describe("creating cards", () => {
  it("should create an active manual card when the sides are valid", () =>
    withTestDb(async (db) => {
      const resourceId = await addResource(db, userA);

      const id = await addCard(db, userA, resourceId);

      const [card] = await db
        .select({ status: cards.status, source: cards.source })
        .from(cards)
        .where(eq(cards.id, id));
      expect(card).toEqual({ status: "active", source: "manual" });
    }));

  it("should put the card in the new-card queue", () =>
    withTestDb(async (db) => {
      const resourceId = await addResource(db, userA);
      const before = Date.now();

      const id = await addCard(db, userA, resourceId);

      const [schedule] = await db
        .select({ due: cardSchedules.due, state: cardSchedules.state })
        .from(cardSchedules)
        .where(eq(cardSchedules.cardId, id));
      expect(schedule.state).toBe(0);
      expect(schedule.due.getTime()).toBeGreaterThanOrEqual(before);
    }));

  it("should refuse the card when a side is empty", () =>
    withTestDb(async (db) => {
      const resourceId = await addResource(db, userA);

      const result = await createCard(db, userA, resourceId, {
        front: " ",
        back: "Answer",
      });

      expect(result).toEqual({
        kind: "invalid",
        errors: { front: "empty", back: null },
      });
    }));

  it("should refuse the card when a side is over 10 KB", () =>
    withTestDb(async (db) => {
      const resourceId = await addResource(db, userA);

      const result = await createCard(db, userA, resourceId, {
        front: "Question",
        back: "a".repeat(MAX_CARD_SIDE_BYTES + 1),
      });

      expect(result).toEqual({
        kind: "invalid",
        errors: { front: null, back: "too_large" },
      });
    }));

  it("should refuse a new card when the account has reached the limit", () =>
    withTestDb(async (db) => {
      const resourceId = await addResource(db, userA);
      await db.insert(cards).values(
        Array.from({ length: MAX_CARDS_PER_USER }, () => ({
          userId: userA,
          resourceId,
          ...sides,
        })),
      );
      const otherResource = await addResource(db, userB);

      const refused = await createCard(db, userA, resourceId, sides);
      const otherUser = await createCard(db, userB, otherResource, sides);

      expect(refused).toEqual({ kind: "limit_reached" });
      expect(otherUser?.kind).toBe("created");
    }));

  it("should not add a card to another user's resource", () =>
    withTestDb(async (db) => {
      const otherResource = await addResource(db, userB);

      expect(await createCard(db, userA, otherResource, sides)).toBeNull();
      expect(await listResourceCards(db, userB, otherResource)).toEqual([]);
    }));

  it("should return null when the resource id is not valid", () =>
    withTestDb(async (db) => {
      expect(await createCard(db, userA, "nope", sides)).toBeNull();
    }));
});

describe("listing cards of a resource", () => {
  it("should mark a card as new when it has not been reviewed", () =>
    withTestDb(async (db) => {
      const resourceId = await addResource(db, userA);
      const id = await addCard(db, userA, resourceId);

      expect(await listResourceCards(db, userA, resourceId)).toEqual([
        { id, front: "Question", status: "active", isNew: true },
      ]);
    }));

  it("should not mark a card as new when it has been reviewed", () =>
    withTestDb(async (db) => {
      const resourceId = await addResource(db, userA);
      const id = await addCard(db, userA, resourceId);
      await db
        .update(cardSchedules)
        .set({ state: 2 })
        .where(eq(cardSchedules.cardId, id));

      const [card] = await listResourceCards(db, userA, resourceId);

      expect(card.isNew).toBe(false);
    }));

  it("should leave out deleted cards", () =>
    withTestDb(async (db) => {
      const resourceId = await addResource(db, userA);
      const id = await addCard(db, userA, resourceId);
      await db
        .update(cards)
        .set({ deletedAt: new Date() })
        .where(eq(cards.id, id));

      expect(await listResourceCards(db, userA, resourceId)).toEqual([]);
    }));

  it("should not read cards when the resource belongs to another user", () =>
    withTestDb(async (db) => {
      const resourceId = await addResource(db, userB);
      await addCard(db, userB, resourceId);

      expect(await listResourceCards(db, userA, resourceId)).toEqual([]);
    }));
});
