import { sql } from "drizzle-orm";
import { rateLimits } from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";

export const LINK_LOOKUP_LIMIT = { limit: 30, windowSeconds: 60 };

/**
 * Counts one attempt and says whether it is allowed. The count and the window
 * change in one statement, so simultaneous requests can't lose a count.
 */
export async function checkRateLimit(
  db: Db,
  userId: string,
  action: string,
  { limit, windowSeconds }: { limit: number; windowSeconds: number },
) {
  const expired = sql`"rate_limits"."window_started_at" <= now() - make_interval(secs => ${windowSeconds})`;

  const [row] = await db
    .insert(rateLimits)
    .values({ userId, action })
    .onConflictDoUpdate({
      target: [rateLimits.userId, rateLimits.action],
      set: {
        count: sql`case when ${expired} then 1 else "rate_limits"."count" + 1 end`,
        windowStartedAt: sql`case when ${expired} then now() else "rate_limits"."window_started_at" end`,
      },
    })
    .returning({ count: rateLimits.count });

  return row.count <= limit;
}
