"use server";

import { selectReviewCards } from "@/domain/review-selection";
import { requireUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";

export async function loadReviewBatch() {
  const userId = await requireUserId();
  const { cards, remaining } = await selectReviewCards(
    getDb(),
    userId,
    new Date(),
  );

  return {
    remaining,
    cards: cards.map(({ id, front, back, resourceTitle }) => ({
      id,
      front,
      back,
      resourceTitle,
    })),
  };
}
