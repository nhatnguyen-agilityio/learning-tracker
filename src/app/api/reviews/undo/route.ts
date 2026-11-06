import { NextResponse } from "next/server";
import { isIdempotencyKey, undoReview } from "@/domain/reviews";
import { readJsonObject } from "@/lib/api/read-json";
import { getUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await readJsonObject(request);
  const idempotencyKey = body?.idempotencyKey;
  if (!isIdempotencyKey(idempotencyKey)) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const result = await undoReview(getDb(), userId, idempotencyKey);
  if (result.kind === "not_latest") {
    return NextResponse.json({ error: result.kind }, { status: 409 });
  }
  return NextResponse.json({ status: result.kind });
}
