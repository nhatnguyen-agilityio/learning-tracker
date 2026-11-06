import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { cards, resources, topics } from "@/lib/db/schema";
import { SEEDED_USERS, withTestDb } from "@/lib/db/test-db";
import type { Db } from "@/lib/db/types";
import { createCard } from "./cards";
import {
  getResourceForMcp,
  MAX_SEARCH_RESULTS,
  searchResourcesForMcp,
} from "./mcp-resources";
import { createNote } from "./notes";
import { createResource } from "./resources";
import { createTopic, setResourceTopics } from "./topics";

const { a: userA, b: userB } = SEEDED_USERS;

async function addResource(db: Db, userId: string, title: string) {
  const result = await createResource(db, userId, {
    url: `https://mcp.test/${crypto.randomUUID()}`,
    title,
  });
  if (result.kind !== "created") throw new Error("Resource not created");
  return result.resource.id;
}

function withClean(test: (db: Db) => Promise<void>) {
  return withTestDb(async (db) => {
    await db.delete(resources).where(eq(resources.userId, userA));
    await db.delete(topics).where(eq(topics.userId, userA));
    await test(db);
  });
}

describe("searching resources for MCP", () => {
  it("should return the fields MCP promises", () =>
    withClean(async (db) => {
      const id = await addResource(db, userA, "Closures");

      expect(
        await searchResourcesForMcp(db, userA, { query: "closures" }),
      ).toEqual([{ id, title: "Closures", topics: [], progress: 0 }]);
    }));

  it("should find a resource by its note", () =>
    withClean(async (db) => {
      const id = await addResource(db, userA, "Guide");
      await createNote(db, userA, id, "Ghi chú về đệ quy");

      const rows = await searchResourcesForMcp(db, userA, { query: "de quy" });

      expect(rows.map((row) => row.id)).toEqual([id]);
    }));

  it("should filter by topic name, ignoring case", () =>
    withClean(async (db) => {
      const id = await addResource(db, userA, "Tagged");
      await addResource(db, userA, "Plain");
      const topic = await createTopic(db, userA, {
        name: "Rust",
        color: "topic-1",
      });
      if (topic.kind !== "created") throw new Error("Topic not created");
      await setResourceTopics(db, userA, id, [topic.topic.id]);

      const rows = await searchResourcesForMcp(db, userA, { topic: "rust" });

      expect(rows).toEqual([
        { id, title: "Tagged", topics: ["Rust"], progress: 0 },
      ]);
    }));

  it("should return nothing when the topic doesn't exist", () =>
    withClean(async (db) => {
      await addResource(db, userA, "Guide");

      expect(await searchResourcesForMcp(db, userA, { topic: "None" })).toEqual(
        [],
      );
    }));

  it("should filter by status", () =>
    withClean(async (db) => {
      await addResource(db, userA, "Wanted");

      expect(
        await searchResourcesForMcp(db, userA, { status: "done" }),
      ).toEqual([]);
    }));

  it("should return at most 50 results", () =>
    withClean(async (db) => {
      await db.insert(resources).values(
        Array.from({ length: MAX_SEARCH_RESULTS + 5 }, (_, index) => ({
          userId: userA,
          url: `https://mcp.test/${index}`,
          normalizedUrl: `https://mcp.test/many/${index}`,
          title: `Guide ${index}`,
        })),
      );

      const rows = await searchResourcesForMcp(db, userA, {});

      expect(rows).toHaveLength(MAX_SEARCH_RESULTS);
    }));

  it("should not find another user's resources", () =>
    withClean(async (db) => {
      const title = `Private ${crypto.randomUUID()}`;
      await addResource(db, userB, title);

      expect(await searchResourcesForMcp(db, userA, { query: title })).toEqual(
        [],
      );
    }));
});

describe("reading a resource for MCP", () => {
  it("should return the resource with notes and cards", () =>
    withClean(async (db) => {
      const id = await addResource(db, userA, "Guide");
      await createNote(db, userA, id, "A note");
      await createCard(db, userA, id, { front: "Q", back: "A" });

      expect(await getResourceForMcp(db, userA, id)).toMatchObject({
        id,
        title: "Guide",
        topics: [],
        notes: [{ content: "A note" }],
        cards: [{ type: "qa", front: "Q", back: "A", status: "active" }],
      });
    }));

  it("should leave out deleted cards", () =>
    withClean(async (db) => {
      const id = await addResource(db, userA, "Guide");
      await db.insert(cards).values({
        userId: userA,
        resourceId: id,
        front: "Gone",
        back: "A",
        deletedAt: new Date(),
      });

      const resource = await getResourceForMcp(db, userA, id);

      expect(resource?.cards).toEqual([]);
    }));

  it("should return null for another user's resource", () =>
    withClean(async (db) => {
      const id = await addResource(db, userB, "Private");

      expect(await getResourceForMcp(db, userA, id)).toBeNull();
    }));

  it("should return null when the id is not valid", () =>
    withClean(async (db) => {
      expect(await getResourceForMcp(db, userA, "nope")).toBeNull();
    }));
});
