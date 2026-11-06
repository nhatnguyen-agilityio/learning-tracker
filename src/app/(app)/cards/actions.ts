"use server";

import { revalidatePath } from "next/cache";
import {
  approveAllCards,
  approveCard,
  deleteCard,
  getCard,
  setCardSuspended,
  updateCard,
} from "@/domain/cards";
import { requireUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import type { AddCardResult } from "../library/[id]/card-actions";

function refreshPages(resourceId: string | null) {
  revalidatePath("/");
  revalidatePath("/cards");
  if (resourceId) revalidatePath(`/library/${resourceId}`);
}

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

  refreshPages(result.card.resourceId);
  return { kind: "saved" };
}

export async function changeCardSuspended(cardId: string, suspended: boolean) {
  const userId = await requireUserId();
  const card = await setCardSuspended(getDb(), userId, cardId, suspended);

  if (!card) return false;
  refreshPages(card.resourceId);
  return true;
}

export async function removeCard(cardId: string) {
  const userId = await requireUserId();
  const card = await deleteCard(getDb(), userId, cardId);

  if (!card) return false;
  refreshPages(card.resourceId);
  return true;
}

export async function approve(cardId: string) {
  const userId = await requireUserId();
  const card = await approveCard(getDb(), userId, cardId, new Date());

  if (!card) return false;
  refreshPages(card.resourceId);
  return true;
}

export async function approveAll(resourceId: string | null) {
  const userId = await requireUserId();
  const approved = await approveAllCards(
    getDb(),
    userId,
    resourceId,
    new Date(),
  );

  if (approved === 0) return false;
  refreshPages(resourceId);
  return true;
}
