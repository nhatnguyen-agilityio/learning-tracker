import { and, asc, eq, isNull } from "drizzle-orm";
import { cards } from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";
import { listNotes } from "./notes";
import { getResource } from "./resources";
import { type ResourceFilters, searchResources } from "./search-resources";
import { listResourceTopics, listTopics } from "./topics";

export const MAX_SEARCH_RESULTS = 50;

/** MCP clients name a topic, so it is matched by name, ignoring case. */
export async function searchResourcesForMcp(
  db: Db,
  userId: string,
  input: {
    query?: string;
    topic?: string;
    status?: ResourceFilters["status"];
  },
) {
  let topicId: string | undefined;
  if (input.topic) {
    const name = input.topic.trim().toLowerCase();
    const topics = await listTopics(db, userId);
    topicId = topics.find((topic) => topic.name.toLowerCase() === name)?.id;
    if (!topicId) return [];
  }

  const rows = await searchResources(db, userId, {
    query: input.query,
    status: input.status,
    topicId,
  });
  return rows.slice(0, MAX_SEARCH_RESULTS).map((resource) => ({
    id: resource.id,
    title: resource.title,
    topics: resource.topics.map((topic) => topic.name),
    progress: resource.progress,
  }));
}

/** Returns null for another user's resource, the same as for a missing one. */
export async function getResourceForMcp(
  db: Db,
  userId: string,
  resourceId: string,
) {
  const resource = await getResource(db, userId, resourceId);
  if (!resource) return null;

  const [topics, notes, resourceCards] = await Promise.all([
    listResourceTopics(db, userId, resourceId),
    listNotes(db, userId, resourceId),
    db
      .select({
        id: cards.id,
        type: cards.type,
        front: cards.front,
        back: cards.back,
        status: cards.status,
      })
      .from(cards)
      .where(
        and(
          eq(cards.userId, userId),
          eq(cards.resourceId, resourceId),
          isNull(cards.deletedAt),
        ),
      )
      .orderBy(asc(cards.createdAt), asc(cards.id)),
  ]);

  return {
    id: resource.id,
    title: resource.title,
    url: resource.url,
    type: resource.type,
    status: resource.status,
    progress: resource.progress,
    topics: topics.map((topic) => topic.name),
    notes: notes.map(({ id, contentMd }) => ({ id, content: contentMd })),
    cards: resourceCards,
  };
}
