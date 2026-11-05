import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import type { Db } from "./types";

// Kept on globalThis so hot reload in development doesn't open new connections.
const cache = globalThis as unknown as { appDb?: Db };

/** This connection bypasses RLS: use it only through `src/domain` functions. */
export function getDb(): Db {
  if (cache.appDb) return cache.appDb;

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL must be set. See the README.");

  // Supabase's transaction pooler doesn't support prepared statements.
  cache.appDb = drizzle(postgres(url, { prepare: false }), { schema });
  return cache.appDb;
}
