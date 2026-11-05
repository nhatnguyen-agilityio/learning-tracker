import { desc, eq } from "drizzle-orm";
import { resources } from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";

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
    .orderBy(desc(resources.createdAt));
}

/** Returns null for another user's resource, the same as for a missing one. */
export async function getResource(db: Db, userId: string, resourceId: string) {
  const [resource] = await db
    .select(resourceFields)
    .from(resources)
    .where(eq(resources.id, resourceId));
  return resource ?? null;
}
