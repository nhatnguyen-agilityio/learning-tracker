import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

/** A database connection or an open transaction; domain functions accept both. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
