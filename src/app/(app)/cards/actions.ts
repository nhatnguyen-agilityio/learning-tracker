"use server";

import { revalidatePath } from "next/cache";
import { getCard, updateCard } from "@/domain/cards";
import { requireUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import type { AddCardResult } from "../library/[id]/card-actions";

export async function loadCard(cardId: string) {
  const userId = await requireUserId();
  return getCard(getDb(), userId, cardId);
}

export async function saveCard(
  cardId: string,
  sides: { front: string; back: string },
): Promise<AddCardResult> {
  const userId = await requireUserId();
  const result = await updateCard(getDb(), userId, cardId, sides);

  if (!result) return { kind: "failed" };
  if (result.kind !== "updated") return result;

  revalidatePath("/cards");
  if (result.card.resourceId) {
    revalidatePath(`/library/${result.card.resourceId}`);
  }
  return { kind: "saved" };
}
