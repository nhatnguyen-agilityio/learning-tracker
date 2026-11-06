import { NextResponse } from "next/server";
import { exportUserData } from "@/domain/export-data";
import { getUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";

export async function GET() {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const data = await exportUserData(getDb(), userId, now);
  const day = now.toISOString().slice(0, 10);

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="learning-tracker-export-${day}.json"`,
      "cache-control": "no-store",
    },
  });
}
