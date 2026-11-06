import { and, asc, count, eq, isNull } from "drizzle-orm";
import { cardSchedules, cards } from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";
import { MAX_CARDS_PER_USER, validateCard } from "./card-limits";
import { getResource } from "./resources";

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
