import { and, asc, eq, isNull } from "drizzle-orm";
import { cards } from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";
import { normalizeUrl } from "./normalize-url";
import { listNotes } from "./notes";
import { checkRateLimit, LINK_LOOKUP_LIMIT } from "./rate-limit";
import type { ResourceStatus } from "./resource-status";
import {
  createResource,
  findResourceByUrl,
  getResource,
  MAX_TITLE_LENGTH,
  MAX_URL_LENGTH,
} from "./resources";
import { type ResourceFilters, searchResources } from "./search-resources";
import {
  createTopic,
  listResourceTopics,
  listTopics,
  nextTopicColor,
  setResourceTopics,
} from "./topics";

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

type LinkDetails = {
  title: string | null;
  thumbnailUrl: string | null;
  type: "article" | "video" | "course" | "doc" | "other";
};

/**
 * Follows the same rules as adding a link in the app. `lookup` reads the page;
 * it is passed in because the domain layer makes no network calls.
 */
export async function addResourceForMcp(
  db: Db,
  userId: string,
  input: { url: string; topics?: string[]; status?: ResourceStatus },
  lookup: (url: string) => Promise<LinkDetails>,
) {
  if (input.url.length > MAX_URL_LENGTH || !normalizeUrl(input.url)) {
    return { kind: "invalid_url" } as const;
  }

  const existing = await findResourceByUrl(db, userId, input.url);
  if (existing) {
    return {
      kind: "duplicate",
      resource: { id: existing.id, title: existing.title },
    } as const;
  }

  const allowed = await checkRateLimit(
    db,
    userId,
    "link_lookup",
    LINK_LOOKUP_LIMIT,
  );
  if (!allowed) return { kind: "rate_limited" } as const;

  const details = await lookup(input.url);
  const result = await createResource(db, userId, {
    url: input.url,
    title: details.title ?? input.url.slice(0, MAX_TITLE_LENGTH),
    type: details.type,
    thumbnailUrl: details.thumbnailUrl,
    status: input.status,
  });
  if (result.kind !== "created") {
    return result.kind === "duplicate"
      ? ({
          kind: "duplicate",
          resource: { id: result.resource.id, title: result.resource.title },
        } as const)
      : ({ kind: result.kind } as const);
  }

  const topicIds: string[] = [];
  const known = await listTopics(db, userId);
  for (const [index, name] of (input.topics ?? []).entries()) {
    const topic = await createTopic(db, userId, {
      name,
      color: nextTopicColor(known.length + index),
    });
    if (topic.kind === "created" || topic.kind === "duplicate") {
      topicIds.push(topic.topic.id);
    }
  }
  if (topicIds.length > 0) {
    await setResourceTopics(db, userId, result.resource.id, topicIds);
  }

  return {
    kind: "created",
    resource: { id: result.resource.id, title: result.resource.title },
  } as const;
}
