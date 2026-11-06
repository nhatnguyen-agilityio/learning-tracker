import { and, asc, count, desc, eq, isNull, ne } from "drizzle-orm";
import { cardSchedules, cards, resources, reviews } from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";
import { MAX_CARDS_PER_USER, validateCard } from "./card-limits";
import { getResource } from "./resources";
import { isUuid } from "./uuid";

/** Cards of a resource, oldest first, leaving out deleted ones. */
export async function listResourceCards(
  db: Db,
  userId: string,
  resourceId: string,
) {
  const rows = await db
    .select({
      id: cards.id,
      front: cards.front,
      status: cards.status,
      state: cardSchedules.state,
    })
    .from(cards)
    .leftJoin(cardSchedules, eq(cardSchedules.cardId, cards.id))
    .where(
      and(
        eq(cards.userId, userId),
        eq(cards.resourceId, resourceId),
        isNull(cards.deletedAt),
      ),
    )
    .orderBy(asc(cards.createdAt), asc(cards.id));

  return rows.map(({ state, ...card }) => ({ ...card, isNew: state === 0 }));
}

/**
 * The schedule row puts the card in the new-card queue (SPEC.md, F4).
 * Returns null for another user's resource, the same as for a missing one.
 */
export async function createCard(
  db: Db,
  userId: string,
  resourceId: string,
  sides: { front: string; back: string },
) {
  const errors = validateCard(sides);
  if (errors) return { kind: "invalid", errors } as const;

  return db.transaction(async (tx) => {
    const resource = await getResource(tx, userId, resourceId);
    if (!resource) return null;

    const [{ total }] = await tx
      .select({ total: count() })
      .from(cards)
      .where(and(eq(cards.userId, userId), isNull(cards.deletedAt)));
    if (total >= MAX_CARDS_PER_USER) return { kind: "limit_reached" } as const;

    const [card] = await tx
      .insert(cards)
      .values({
        userId,
        resourceId,
        front: sides.front.trim(),
        back: sides.back.trim(),
        status: "active",
        source: "manual",
      })
      .returning({ id: cards.id, front: cards.front, back: cards.back });
    await tx
      .insert(cardSchedules)
      .values({ cardId: card.id, userId, due: new Date() });
    return { kind: "created", card } as const;
  });
}

/**
 * The Cards screen, newest first, with cards detached from a resource too.
 * Pending cards wait in their own tab (SPEC.md, F5).
 */
export async function listCards(db: Db, userId: string, limit: number) {
  const listed = and(
    eq(cards.userId, userId),
    isNull(cards.deletedAt),
    ne(cards.status, "pending"),
  );

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: cards.id,
        front: cards.front,
        status: cards.status,
        state: cardSchedules.state,
        resourceTitle: resources.title,
      })
      .from(cards)
      .leftJoin(cardSchedules, eq(cardSchedules.cardId, cards.id))
      .leftJoin(resources, eq(resources.id, cards.resourceId))
      .where(listed)
      .orderBy(desc(cards.createdAt), desc(cards.id))
      .limit(limit),
    db.select({ total: count() }).from(cards).where(listed),
  ]);

  return {
    total,
    cards: rows.map(({ state, ...card }) => ({
      ...card,
      isNew: state === 0,
    })),
  };
}

/** Returns null for another user's card, the same as for a missing one. */
export async function getCard(db: Db, userId: string, cardId: string) {
  if (!isUuid(cardId)) return null;

  const [card] = await db
    .select({ id: cards.id, front: cards.front, back: cards.back })
    .from(cards)
    .where(
      and(
        eq(cards.userId, userId),
        eq(cards.id, cardId),
        isNull(cards.deletedAt),
      ),
    );
  return card ?? null;
}

/**
 * Changes the text only, so the review schedule stays as it is.
 * Returns null for another user's card, the same as for a missing one.
 */
export async function updateCard(
  db: Db,
  userId: string,
  cardId: string,
  sides: { front: string; back: string },
) {
  const errors = validateCard(sides);
  if (errors) return { kind: "invalid", errors } as const;
  if (!isUuid(cardId)) return null;

  const [card] = await db
    .update(cards)
    .set({ front: sides.front.trim(), back: sides.back.trim() })
    .where(
      and(
        eq(cards.userId, userId),
        eq(cards.id, cardId),
        isNull(cards.deletedAt),
      ),
    )
    .returning({ id: cards.id, resourceId: cards.resourceId });
  return card ? ({ kind: "updated", card } as const) : null;
}

/**
 * Moves a card between active and suspended; the schedule stays as it is.
 * Pending cards can't be suspended. Returns null for another user's card.
 */
export async function setCardSuspended(
  db: Db,
  userId: string,
  cardId: string,
  suspended: boolean,
) {
  if (!isUuid(cardId)) return null;

  const [card] = await db
    .update(cards)
    .set({ status: suspended ? "suspended" : "active" })
    .where(
      and(
        eq(cards.userId, userId),
        eq(cards.id, cardId),
        isNull(cards.deletedAt),
        ne(cards.status, "pending"),
      ),
    )
    .returning({ resourceId: cards.resourceId });
  return card ?? null;
}

/**
 * A reviewed card is soft deleted so its reviews stay; a card with no reviews
 * has nothing to keep and is removed (SPEC.md, F8). Returns null for another
 * user's card.
 */
export async function deleteCard(db: Db, userId: string, cardId: string) {
  if (!isUuid(cardId)) return null;

  const owned = and(
    eq(cards.userId, userId),
    eq(cards.id, cardId),
    isNull(cards.deletedAt),
  );
  return db.transaction(async (tx) => {
    const [card] = await tx
      .select({ resourceId: cards.resourceId })
      .from(cards)
      .where(owned)
      .for("update");
    if (!card) return null;

    const [{ total }] = await tx
      .select({ total: count() })
      .from(reviews)
      .where(and(eq(reviews.userId, userId), eq(reviews.cardId, cardId)));

    if (total > 0) {
      await tx.update(cards).set({ deletedAt: new Date() }).where(owned);
    } else {
      await tx.delete(cards).where(owned);
    }
    return card;
  });
}
