import { and, asc, count, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { cardSchedules, cards, resources, reviews } from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";
import {
  type CardErrors,
  MAX_CARDS_PER_CALL,
  MAX_CARDS_PER_USER,
  validateCard,
} from "./card-limits";
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

type CardSides = { front: string; back: string };

/**
 * Cards from MCP wait for approval: they are pending, with no schedule, so they
 * stay out of reviews. All are saved or none. Returns null for another user's
 * resource, the same as for a missing one.
 */
export async function createPendingCards(
  db: Db,
  userId: string,
  input: { resourceId?: string; cards: CardSides[] },
) {
  const total = input.cards.length;
  if (total === 0 || total > MAX_CARDS_PER_CALL) {
    return { kind: "invalid_count" } as const;
  }

  const invalid = input.cards.flatMap((card, index) => {
    const errors: CardErrors | null = validateCard(card);
    return errors ? [{ index, errors }] : [];
  });
  if (invalid.length > 0) return { kind: "invalid", cards: invalid } as const;

  return db.transaction(async (tx) => {
    // Two calls at once must not both see room under the limit.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);

    if (input.resourceId) {
      const resource = await getResource(tx, userId, input.resourceId);
      if (!resource) return null;
    }

    const [{ existing }] = await tx
      .select({ existing: count() })
      .from(cards)
      .where(and(eq(cards.userId, userId), isNull(cards.deletedAt)));
    if (existing + total > MAX_CARDS_PER_USER) {
      return { kind: "limit_reached" } as const;
    }

    const created = await tx
      .insert(cards)
      .values(
        input.cards.map(({ front, back }) => ({
          userId,
          resourceId: input.resourceId,
          front: front.trim(),
          back: back.trim(),
          status: "pending" as const,
          source: "mcp" as const,
        })),
      )
      .returning({ id: cards.id });
    return { kind: "created", ids: created.map(({ id }) => id) } as const;
  });
}

const MAX_PENDING_SHOWN = 500;

function isPending(userId: string) {
  return and(
    eq(cards.userId, userId),
    eq(cards.status, "pending"),
    isNull(cards.deletedAt),
  );
}

/** Cards waiting for approval, oldest first, with their resource if any. */
export function listPendingCards(db: Db, userId: string) {
  return db
    .select({
      id: cards.id,
      front: cards.front,
      back: cards.back,
      resourceId: cards.resourceId,
      resourceTitle: resources.title,
    })
    .from(cards)
    .leftJoin(resources, eq(resources.id, cards.resourceId))
    .where(isPending(userId))
    .orderBy(asc(cards.createdAt), asc(cards.id))
    .limit(MAX_PENDING_SHOWN);
}

export async function countPendingCards(db: Db, userId: string) {
  const [{ total }] = await db
    .select({ total: count() })
    .from(cards)
    .where(isPending(userId));
  return total;
}

/** Approved cards get a schedule, which puts them in the new-card queue. */
async function activateCards(
  db: Db,
  userId: string,
  which: ReturnType<typeof and>,
  now: Date,
) {
  return db.transaction(async (tx) => {
    const approved = await tx
      .update(cards)
      .set({ status: "active" })
      .where(and(isPending(userId), which))
      .returning({ id: cards.id, resourceId: cards.resourceId });

    if (approved.length > 0) {
      await tx
        .insert(cardSchedules)
        .values(approved.map(({ id }) => ({ cardId: id, userId, due: now })))
        .onConflictDoNothing();
    }
    return approved;
  });
}

/** Returns null for another user's card, or one that isn't pending. */
export async function approveCard(
  db: Db,
  userId: string,
  cardId: string,
  now: Date,
) {
  if (!isUuid(cardId)) return null;

  const [card] = await activateCards(db, userId, eq(cards.id, cardId), now);
  return card ?? null;
}

/** `resourceId` null means the cards with no resource. Returns how many. */
export async function approveAllCards(
  db: Db,
  userId: string,
  resourceId: string | null,
  now: Date,
) {
  if (resourceId !== null && !isUuid(resourceId)) return 0;

  const approved = await activateCards(
    db,
    userId,
    resourceId === null
      ? isNull(cards.resourceId)
      : eq(cards.resourceId, resourceId),
    now,
  );
  return approved.length;
}
