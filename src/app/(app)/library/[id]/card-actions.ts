"use server";

import { revalidatePath } from "next/cache";
import type { CardErrors } from "@/domain/card-limits";
import { createCard } from "@/domain/cards";
import { requireUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";

export type AddCardResult =
  | { kind: "saved" | "limit_reached" | "failed" }
  | { kind: "invalid"; errors: CardErrors };

export async function addCard(
  resourceId: string,
  sides: { front: string; back: string },
): Promise<AddCardResult> {
  const userId = await requireUserId();
  const result = await createCard(getDb(), userId, resourceId, sides);

  if (!result) return { kind: "failed" };
  if (result.kind !== "created") return result;

  revalidatePath(`/library/${resourceId}`);
  return { kind: "saved" };
}
