"use server";

import { revalidatePath } from "next/cache";
import { createToken, revokeToken } from "@/domain/api-tokens";
import { requireUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";

export type AddTokenResult =
  | { kind: "created"; rawToken: string }
  | { kind: "invalid_name" | "limit_reached" | "failed" };

export async function addToken(name: string): Promise<AddTokenResult> {
  const userId = await requireUserId();
  const result = await createToken(getDb(), userId, name);

  if (result.kind !== "created") return result;
  revalidatePath("/settings");
  return { kind: "created", rawToken: result.rawToken };
}

export async function removeToken(tokenId: string) {
  const userId = await requireUserId();
  const revoked = await revokeToken(getDb(), userId, tokenId);

  if (revoked) revalidatePath("/settings");
  return revoked;
}
