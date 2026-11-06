"use server";

import { revalidatePath } from "next/cache";
import { normalizeUrl } from "@/domain/normalize-url";
import {
  createResource,
  findResourceByUrl,
  MAX_URL_LENGTH,
  updateResource,
} from "@/domain/resources";
import {
  createTopic,
  listTopics,
  nextTopicColor,
  setResourceTopics,
} from "@/domain/topics";
import { requireUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { resources } from "@/lib/db/schema";
import {
  fetchMetadata,
  type LinkMetadata,
} from "@/lib/metadata/fetch-metadata";

type ResourceType = (typeof resources.type.enumValues)[number];
type ResourceStatus = (typeof resources.status.enumValues)[number];

export type LookupResult =
  | { kind: "invalid" }
  | { kind: "duplicate"; resource: { id: string; title: string } }
  | { kind: "metadata"; metadata: LinkMetadata };

export async function lookupLink(url: string): Promise<LookupResult> {
  const userId = await requireUserId();
  if (url.length > MAX_URL_LENGTH || !normalizeUrl(url)) {
    return { kind: "invalid" };
  }

  const existing = await findResourceByUrl(getDb(), userId, url);
  if (existing) {
    return {
      kind: "duplicate",
      resource: { id: existing.id, title: existing.title },
    };
  }

  return { kind: "metadata", metadata: await fetchMetadata(url) };
}

export async function addTopic(name: string) {
  const userId = await requireUserId();
  const db = getDb();
  const existing = await listTopics(db, userId);

  return createTopic(db, userId, {
    name,
    color: nextTopicColor(existing.length),
  });
}

export type ResourceFormValues = {
  url: string;
  title: string;
  type: ResourceType;
  thumbnailUrl: string | null;
  status: ResourceStatus;
  topicIds: string[];
};

export type SaveResult =
  | { kind: "saved" }
  | { kind: "invalid_url" | "invalid_title" | "duplicate" | "failed" };

function isOneOf<T extends string>(values: readonly T[], value: string) {
  return values.some((item) => item === value);
}

/** Values come from the browser, so the choices are checked at runtime too. */
function hasValidChoices({ type, status }: ResourceFormValues) {
  return (
    isOneOf(resources.type.enumValues, type) &&
    isOneOf(resources.status.enumValues, status)
  );
}

export async function saveResource(
  values: ResourceFormValues,
): Promise<SaveResult> {
  const userId = await requireUserId();
  if (!hasValidChoices(values)) return { kind: "failed" };

  const result = await getDb()
    .transaction(async (tx): Promise<SaveResult> => {
      const created = await createResource(tx, userId, values);
      if (created.kind === "limit_reached") return { kind: "failed" };
      if (created.kind !== "created") return { kind: created.kind };

      const linked = await setResourceTopics(
        tx,
        userId,
        created.resource.id,
        values.topicIds,
      );
      if (!linked) tx.rollback();
      return { kind: "saved" };
    })
    .catch((): SaveResult => ({ kind: "failed" }));

  if (result.kind === "saved") revalidatePath("/library");
  return result;
}

export async function editResource(
  resourceId: string,
  values: Omit<ResourceFormValues, "url">,
): Promise<SaveResult> {
  const userId = await requireUserId();
  if (!isOneOf(resources.type.enumValues, values.type)) {
    return { kind: "failed" };
  }

  const result = await getDb()
    .transaction(async (tx): Promise<SaveResult> => {
      const updated = await updateResource(tx, userId, resourceId, values);
      if (!updated) return { kind: "failed" };
      if (updated.kind === "invalid_title") return { kind: "invalid_title" };

      const linked = await setResourceTopics(
        tx,
        userId,
        resourceId,
        values.topicIds,
      );
      if (!linked) tx.rollback();
      return { kind: "saved" };
    })
    .catch((): SaveResult => ({ kind: "failed" }));

  if (result.kind === "saved") revalidatePath("/library");
  return result;
}
