import { and, count, desc, eq } from "drizzle-orm";
import { resources } from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";
import { normalizeUrl } from "./normalize-url";

export const MAX_RESOURCES_PER_USER = 2000;
export const MAX_URL_LENGTH = 2048;
export const MAX_TITLE_LENGTH = 500;

const resourceFields = {
  id: resources.id,
  url: resources.url,
  title: resources.title,
  type: resources.type,
  thumbnailUrl: resources.thumbnailUrl,
  status: resources.status,
  progress: resources.progress,
  createdAt: resources.createdAt,
  updatedAt: resources.updatedAt,
};

export function listResources(db: Db, userId: string) {
  return db
    .select(resourceFields)
    .from(resources)
    .where(eq(resources.userId, userId))
    .orderBy(desc(resources.createdAt));
}

/** Returns null for another user's resource, the same as for a missing one. */
export async function getResource(db: Db, userId: string, resourceId: string) {
  const [resource] = await db
    .select(resourceFields)
    .from(resources)
    .where(and(eq(resources.userId, userId), eq(resources.id, resourceId)));
  return resource ?? null;
}

type ResourceType = (typeof resources.type.enumValues)[number];
type ResourceStatus = (typeof resources.status.enumValues)[number];
type Resource = Awaited<ReturnType<typeof listResources>>[number];

export type CreateResourceResult =
  | { kind: "created" | "duplicate"; resource: Resource }
  | { kind: "invalid_url" | "invalid_title" | "limit_reached" };

/** An image link that is too long only loses the image, so it never blocks saving. */
function storableThumbnail(thumbnailUrl: string | null | undefined) {
  return thumbnailUrl && thumbnailUrl.length > MAX_URL_LENGTH
    ? null
    : thumbnailUrl;
}

async function findByNormalizedUrl(
  db: Db,
  userId: string,
  normalizedUrl: string,
) {
  const [resource] = await db
    .select(resourceFields)
    .from(resources)
    .where(
      and(
        eq(resources.userId, userId),
        eq(resources.normalizedUrl, normalizedUrl),
      ),
    );
  return resource ?? null;
}

export function createResource(
  db: Db,
  userId: string,
  input: {
    url: string;
    title: string;
    type?: ResourceType;
    thumbnailUrl?: string | null;
    status?: ResourceStatus;
  },
): Promise<CreateResourceResult> {
  return db.transaction(async (tx) => {
    const normalizedUrl =
      input.url.length <= MAX_URL_LENGTH ? normalizeUrl(input.url) : null;
    if (!normalizedUrl) return { kind: "invalid_url" };

    const existing = await findByNormalizedUrl(tx, userId, normalizedUrl);
    if (existing) return { kind: "duplicate", resource: existing };

    const title = input.title.trim();
    if (!title || title.length > MAX_TITLE_LENGTH) {
      return { kind: "invalid_title" };
    }

    const [{ total }] = await tx
      .select({ total: count() })
      .from(resources)
      .where(eq(resources.userId, userId));
    if (total >= MAX_RESOURCES_PER_USER) return { kind: "limit_reached" };

    const [created] = await tx
      .insert(resources)
      .values({
        userId,
        url: input.url.trim(),
        normalizedUrl,
        title,
        type: input.type,
        thumbnailUrl: storableThumbnail(input.thumbnailUrl),
        status: input.status,
        progress: input.status === "done" ? 100 : 0,
      })
      .onConflictDoNothing({
        target: [resources.userId, resources.normalizedUrl],
      })
      .returning(resourceFields);
    if (created) return { kind: "created", resource: created };

    // Another request added the same link between the check and the insert.
    const winner = await findByNormalizedUrl(tx, userId, normalizedUrl);
    if (!winner) throw new Error("The duplicate resource could not be read.");
    return { kind: "duplicate", resource: winner };
  });
}

/** Returns null for another user's resource, the same as for a missing one. */
export async function updateResource(
  db: Db,
  userId: string,
  resourceId: string,
  changes: {
    title?: string;
    type?: ResourceType;
    thumbnailUrl?: string | null;
  },
) {
  const title = changes.title?.trim();
  if (title === "" || (title && title.length > MAX_TITLE_LENGTH)) {
    return { kind: "invalid_title" } as const;
  }

  const [resource] = await db
    .update(resources)
    .set({
      title,
      type: changes.type,
      thumbnailUrl: storableThumbnail(changes.thumbnailUrl),
    })
    .where(and(eq(resources.userId, userId), eq(resources.id, resourceId)))
    .returning(resourceFields);
  return resource ? ({ kind: "updated", resource } as const) : null;
}
