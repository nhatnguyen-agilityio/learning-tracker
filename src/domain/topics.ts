import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { resourceTopics, topics } from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";
import { getResource } from "./resources";

export const TOPIC_COLORS = [
  "topic-1",
  "topic-2",
  "topic-3",
  "topic-4",
  "topic-5",
  "topic-6",
  "topic-7",
  "topic-8",
] as const;
export const MAX_TOPIC_NAME_LENGTH = 50;

const topicFields = {
  id: topics.id,
  name: topics.name,
  color: topics.color,
};

type Topic = Awaited<ReturnType<typeof listTopics>>[number];

/** Gives new topics different colors without asking the user to choose. */
export function nextTopicColor(topicCount: number) {
  return TOPIC_COLORS[topicCount % TOPIC_COLORS.length];
}

function isTopicColor(color: string) {
  return TOPIC_COLORS.some((topicColor) => topicColor === color);
}

function isValidName(name: string) {
  return name !== "" && name.length <= MAX_TOPIC_NAME_LENGTH;
}

function sameName(name: string) {
  return eq(sql`lower(${topics.name})`, name.toLowerCase());
}

export function listTopics(db: Db, userId: string) {
  return db
    .select(topicFields)
    .from(topics)
    .where(eq(topics.userId, userId))
    .orderBy(asc(topics.name));
}

export type CreateTopicResult =
  | { kind: "created" | "duplicate"; topic: Topic }
  | { kind: "invalid_name" | "invalid_color" };

export function createTopic(
  db: Db,
  userId: string,
  input: { name: string; color: string },
): Promise<CreateTopicResult> {
  return db.transaction(async (tx) => {
    const name = input.name.trim();
    if (!isValidName(name)) return { kind: "invalid_name" };
    if (!isTopicColor(input.color)) return { kind: "invalid_color" };

    const [created] = await tx
      .insert(topics)
      .values({ userId, name, color: input.color })
      .onConflictDoNothing()
      .returning(topicFields);
    if (created) return { kind: "created", topic: created };

    const [existing] = await tx
      .select(topicFields)
      .from(topics)
      .where(and(eq(topics.userId, userId), sameName(name)));
    if (!existing) throw new Error("The duplicate topic could not be read.");
    return { kind: "duplicate", topic: existing };
  });
}

/** Returns null for another user's topic, the same as for a missing one. */
export async function updateTopic(
  db: Db,
  userId: string,
  topicId: string,
  changes: { name?: string; color?: string },
) {
  const name = changes.name?.trim();
  if (name !== undefined && !isValidName(name)) {
    return { kind: "invalid_name" } as const;
  }
  if (changes.color !== undefined && !isTopicColor(changes.color)) {
    return { kind: "invalid_color" } as const;
  }

  if (name !== undefined) {
    const [taken] = await db
      .select({ id: topics.id })
      .from(topics)
      .where(
        and(eq(topics.userId, userId), sameName(name), ne(topics.id, topicId)),
      );
    if (taken) return { kind: "duplicate" } as const;
  }

  const [topic] = await db
    .update(topics)
    .set({ name, color: changes.color })
    .where(and(eq(topics.userId, userId), eq(topics.id, topicId)))
    .returning(topicFields);
  return topic ? ({ kind: "updated", topic } as const) : null;
}

/** Removes the topic from its resources; the resources themselves stay. */
export async function deleteTopic(db: Db, userId: string, topicId: string) {
  const deleted = await db
    .delete(topics)
    .where(and(eq(topics.userId, userId), eq(topics.id, topicId)))
    .returning({ id: topics.id });
  return deleted.length > 0;
}

export function listResourceTopics(db: Db, userId: string, resourceId: string) {
  return db
    .select(topicFields)
    .from(resourceTopics)
    .innerJoin(topics, eq(topics.id, resourceTopics.topicId))
    .where(
      and(
        eq(resourceTopics.userId, userId),
        eq(resourceTopics.resourceId, resourceId),
      ),
    )
    .orderBy(asc(topics.name));
}

/**
 * Replaces all topics of a resource. Returns null, changing nothing, when the
 * resource or any topic doesn't belong to the user.
 */
export function setResourceTopics(
  db: Db,
  userId: string,
  resourceId: string,
  topicIds: string[],
) {
  return db.transaction(async (tx) => {
    const resource = await getResource(tx, userId, resourceId);
    if (!resource) return null;

    const uniqueIds = [...new Set(topicIds)];
    const owned = await tx
      .select({ id: topics.id })
      .from(topics)
      .where(and(eq(topics.userId, userId), inArray(topics.id, uniqueIds)));
    if (owned.length !== uniqueIds.length) return null;

    await tx
      .delete(resourceTopics)
      .where(
        and(
          eq(resourceTopics.userId, userId),
          eq(resourceTopics.resourceId, resourceId),
        ),
      );
    if (uniqueIds.length > 0) {
      await tx
        .insert(resourceTopics)
        .values(uniqueIds.map((topicId) => ({ userId, resourceId, topicId })));
    }

    return listResourceTopics(tx, userId, resourceId);
  });
}
