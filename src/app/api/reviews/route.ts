import { NextResponse } from "next/server";
import {
  isIdempotencyKey,
  isReviewRating,
  recordReview,
} from "@/domain/reviews";
import { isUuid } from "@/domain/uuid";
import { readJsonObject } from "@/lib/api/read-json";
import { getUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await readJsonObject(request);
  const cardId = body?.cardId;
  const rating = body?.rating;
  const idempotencyKey = body?.idempotencyKey;
  if (
    typeof cardId !== "string" ||
    !isUuid(cardId) ||
    !isReviewRating(rating) ||
    !isIdempotencyKey(idempotencyKey)
  ) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const result = await recordReview(
    getDb(),
    userId,
    { cardId, rating, idempotencyKey },
    new Date(),
  );
  if (!result) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ status: result.kind });
}
