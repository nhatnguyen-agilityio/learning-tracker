import { describe, expect, it } from "vitest";
import { notes } from "@/lib/db/schema";
import { SEEDED_USERS, withTestDb } from "@/lib/db/test-db";
import type { Db } from "@/lib/db/types";
import { createResource } from "./resources";
import { searchResources } from "./search-resources";
import { createTopic, setResourceTopics } from "./topics";

const { a: userA, b: userB } = SEEDED_USERS;

async function addResource(
  db: Db,
  userId: string,
  title: string,
  options: { status?: "want" | "learning" | "done"; path?: string } = {},
) {
  const result = await createResource(db, userId, {
    url: `https://search.test/${options.path ?? crypto.randomUUID()}`,
    title,
    status: options.status,
  });
  if (result.kind !== "created") throw new Error("Resource not created");
  return result.resource.id;
}

async function titles(db: Db, filters: Parameters<typeof searchResources>[2]) {
  const rows = await searchResources(db, userA, filters);
  return rows.map((row) => row.title);
}

describe("searching resources", () => {
  it("should find a resource when the query has no accents", () =>
    withTestDb(async (db) => {
      await addResource(db, userA, "Lập trình Đà Nẵng");

      expect(await titles(db, { query: "lap trinh da nang" })).toEqual([
        "Lập trình Đà Nẵng",
      ]);
    }));

  it("should find a resource when the query has accents and the title does not", () =>
    withTestDb(async (db) => {
      await addResource(db, userA, "Tieng Viet");

      expect(await titles(db, { query: "Tiếng Việt" })).toEqual(["Tieng Viet"]);
    }));

  it("should find a resource by URL", () =>
    withTestDb(async (db) => {
      await addResource(db, userA, "Plain", { path: "unique-path-123" });

      expect(await titles(db, { query: "unique-path" })).toEqual(["Plain"]);
    }));

  it("should find a resource by a note", () =>
    withTestDb(async (db) => {
      const resourceId = await addResource(db, userA, "Plain");
      await db
        .insert(notes)
        .values({ userId: userA, resourceId, contentMd: "Ghi chú về đệ quy" });

      expect(await titles(db, { query: "de quy" })).toEqual(["Plain"]);
    }));

  it("should treat percent signs as text", () =>
    withTestDb(async (db) => {
      await addResource(db, userA, "100% coverage");
      await addResource(db, userA, "Plain");

      expect(await titles(db, { query: "%" })).toEqual(["100% coverage"]);
    }));

  it("should return everything when the query is blank", () =>
    withTestDb(async (db) => {
      const id = await addResource(db, userA, "Plain");

      const rows = await searchResources(db, userA, { query: "   " });

      expect(rows.map((row) => row.id)).toContain(id);
    }));

  it("should filter by status", () =>
    withTestDb(async (db) => {
      await addResource(db, userA, "Finished", { status: "done" });
      await addResource(db, userA, "Planned", { status: "want" });

      expect(await titles(db, { status: "done" })).toContain("Finished");
      expect(await titles(db, { status: "done" })).not.toContain("Planned");
    }));

  it("should filter by topic", () =>
    withTestDb(async (db) => {
      const tagged = await addResource(db, userA, "Tagged");
      await addResource(db, userA, "Untagged");
      const topic = await createTopic(db, userA, {
        name: `Search ${crypto.randomUUID()}`,
        color: "topic-1",
      });
      if (topic.kind !== "created") throw new Error("Topic not created");
      await setResourceTopics(db, userA, tagged, [topic.topic.id]);

      expect(await titles(db, { topicId: topic.topic.id })).toEqual(["Tagged"]);
    }));

  it("should return nothing when the topic id is not valid", () =>
    withTestDb(async (db) => {
      await addResource(db, userA, "Plain");

      expect(await titles(db, { topicId: "not-a-uuid" })).toEqual([]);
    }));

  it("should combine search and filters", () =>
    withTestDb(async (db) => {
      await addResource(db, userA, "Rust book", { status: "done" });
      await addResource(db, userA, "Rust video", { status: "want" });

      expect(await titles(db, { query: "rust", status: "done" })).toEqual([
        "Rust book",
      ]);
    }));

  it("should not return another user's resources", () =>
    withTestDb(async (db) => {
      await addResource(db, userB, "Secret from B");

      expect(await titles(db, { query: "secret from b" })).toEqual([]);
    }));

  it("should not match another user's note", () =>
    withTestDb(async (db) => {
      const resourceId = await addResource(db, userB, "Other");
      await db
        .insert(notes)
        .values({ userId: userB, resourceId, contentMd: "hidden phrase" });

      expect(await titles(db, { query: "hidden phrase" })).toEqual([]);
    }));
});
