import { inArray, sql } from "drizzle-orm";
import { TransactionRollbackError } from "drizzle-orm/errors";
import { drizzle } from "drizzle-orm/postgres-js";
import { authUsers } from "drizzle-orm/supabase";
import postgres from "postgres";
import { describe } from "vitest";
import * as schema from "./schema";
import type { Db } from "./types";

const LOCAL_DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const LOCAL_HOSTS = ["127.0.0.1", "localhost"];

/** The two users from `supabase/seed.sql`. Tests may read them, never change them. */
export const SEEDED_USERS = {
  a: "00000000-0000-4000-8000-00000000000a",
  b: "00000000-0000-4000-8000-00000000000b",
} as const;

/** CI has no database, so these tests run locally only. Locally they never skip. */
export const describeWithDb = describe.skipIf(Boolean(process.env.CI));

export function assertLocalDatabaseUrl(url: string) {
  const { hostname } = new URL(url);
  if (!LOCAL_HOSTS.includes(hostname)) {
    throw new Error(`Database tests only run locally, not on "${hostname}".`);
  }
}

function isConnectionRefused(error: unknown) {
  const { code, cause } = error as { code?: string; cause?: { code?: string } };
  return code === "ECONNREFUSED" || cause?.code === "ECONNREFUSED";
}

/**
 * Runs `test` in a transaction that always rolls back, so nothing it writes
 * reaches the shared local database and parallel tests can't see each other.
 */
export async function withTestDb(test: (db: Db) => Promise<void>) {
  const url = process.env.DATABASE_URL || LOCAL_DATABASE_URL;
  assertLocalDatabaseUrl(url);

  const client = postgres(url, { max: 1, connect_timeout: 5, onnotice() {} });
  try {
    await drizzle(client, { schema }).transaction(async (tx) => {
      const [{ seeded }] = await tx
        .select({ seeded: sql<number>`count(*)::int` })
        .from(authUsers)
        .where(inArray(authUsers.id, Object.values(SEEDED_USERS)));
      if (seeded !== 2) {
        throw new Error("Seeded users are missing. See README, Database.");
      }

      await test(tx);
      tx.rollback();
    });
  } catch (error) {
    if (error instanceof TransactionRollbackError) return;
    if (isConnectionRefused(error)) {
      throw new Error("Local database is not running. Run `pnpm db:start`.", {
        cause: error,
      });
    }
    throw error;
  } finally {
    await client.end();
  }
}
