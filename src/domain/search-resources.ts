import { and, desc, eq, exists, or, type SQL, sql } from "drizzle-orm";
import { notes, resources, resourceTopics } from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";
import { resourceFields } from "./resources";
import { attachTopics } from "./topics";
import { isUuid } from "./uuid";

export const MAX_QUERY_LENGTH = 200;

export type ResourceFilters = {
  query?: string;
  status?: (typeof resources.status.enumValues)[number];
  topicId?: string;
};

function escapeLike(text: string) {
  return text.replace(/[\\%_]/g, "\\$&");
}

/** Must stay the same expression as the search indexes in the migration. */
function matches(column: SQL | typeof resources.title, pattern: string) {
  return sql`immutable_unaccent(lower(${column})) like immutable_unaccent(lower(${pattern}))`;
}

function queryCondition(db: Db, userId: string, query: string) {
  const pattern = `%${escapeLike(query)}%`;

  return or(
    matches(resources.title, pattern),
    matches(sql`${resources.url}`, pattern),
    exists(
      db
        .select({ id: notes.id })
        .from(notes)
        .where(
          and(
            eq(notes.userId, userId),
            eq(notes.resourceId, resources.id),
            matches(sql`${notes.contentMd}`, pattern),
          ),
        ),
    ),
  );
}

/** One search for Library and MCP: title, URL and notes, ignoring accents. */
export async function searchResources(
  db: Db,
  userId: string,
  filters: ResourceFilters = {},
) {
  const { status, topicId } = filters;
  const query = filters.query?.trim().slice(0, MAX_QUERY_LENGTH);

  if (topicId && !isUuid(topicId)) return [];

  const rows = await db
    .select(resourceFields)
    .from(resources)
    .where(
      and(
        eq(resources.userId, userId),
        status ? eq(resources.status, status) : undefined,
        topicId
          ? exists(
              db
                .select({ topicId: resourceTopics.topicId })
                .from(resourceTopics)
                .where(
                  and(
                    eq(resourceTopics.userId, userId),
                    eq(resourceTopics.resourceId, resources.id),
                    eq(resourceTopics.topicId, topicId),
                  ),
                ),
            )
          : undefined,
        query ? queryCondition(db, userId, query) : undefined,
      ),
    )
    .orderBy(desc(resources.createdAt));

  return attachTopics(db, userId, rows);
}
