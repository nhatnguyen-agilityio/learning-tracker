import { describe, expect, it } from "vitest";
import { SEEDED_USERS, withTestDb } from "@/lib/db/test-db";
import type { Db } from "@/lib/db/types";
import { createResource, getResource } from "./resources";
import {
  createTopic,
  deleteTopic,
  listResourceTopics,
  listTopics,
  MAX_TOPIC_NAME_LENGTH,
  nextTopicColor,
  setResourceTopics,
  updateTopic,
} from "./topics";

const { a: userA, b: userB } = SEEDED_USERS;
const color = "topic-1";

async function addTopic(db: Db, userId: string, name: string) {
  const result = await createTopic(db, userId, { name, color });
  if (result.kind !== "created") throw new Error(`Topic not created: ${name}`);
  return result.topic.id;
}

async function addResource(db: Db, userId: string) {
  const result = await createResource(db, userId, {
    url: "https://example.test/guide",
    title: "Guide",
  });
  if (result.kind !== "created") throw new Error("Resource not created");
  return result.resource.id;
}

describe("creating topics", () => {
  it("should create the topic when the name is new", () =>
    withTestDb(async (db) => {
      const result = await createTopic(db, userA, { name: " Rust ", color });

      expect(result).toMatchObject({
        kind: "created",
        topic: { name: "Rust", color },
      });
    }));

  it("should refuse the name when it differs only by case", () =>
    withTestDb(async (db) => {
      await addTopic(db, userA, "Rust");

      const result = await createTopic(db, userA, { name: "rUST", color });

      expect(result).toMatchObject({
        kind: "duplicate",
        topic: { name: "Rust" },
      });
    }));

  it("should allow the same name when another user has it", () =>
    withTestDb(async (db) => {
      await addTopic(db, userB, "Rust");

      const result = await createTopic(db, userA, { name: "Rust", color });

      expect(result.kind).toBe("created");
    }));

  it.each(["", "   ", "a".repeat(MAX_TOPIC_NAME_LENGTH + 1)])(
    "should reject the name when it is empty or too long: '%s'",
    (name) =>
      withTestDb(async (db) => {
        const result = await createTopic(db, userA, { name, color });

        expect(result).toEqual({ kind: "invalid_name" });
      }),
  );

  it.each(["topic-9", "#ff0000", ""])(
    "should reject the color when it is not in the palette: '%s'",
    (badColor) =>
      withTestDb(async (db) => {
        const result = await createTopic(db, userA, {
          name: "Rust",
          color: badColor,
        });

        expect(result).toEqual({ kind: "invalid_color" });
      }),
  );
});

describe("nextTopicColor", () => {
  it.each([
    [0, "topic-1"],
    [7, "topic-8"],
    [8, "topic-1"],
  ])("should pick the color when the user has %i topics", (count, expected) => {
    expect(nextTopicColor(count)).toBe(expected);
  });
});

describe("reading topics", () => {
  it("should list only the user's own topics", () =>
    withTestDb(async (db) => {
      await addTopic(db, userA, "Rust");
      await addTopic(db, userB, "Go");

      const rows = await listTopics(db, userA);

      expect(rows.map((topic) => topic.name)).toEqual(["Rust"]);
    }));
});

describe("updating topics", () => {
  it("should change the name and color when the owner updates the topic", () =>
    withTestDb(async (db) => {
      const id = await addTopic(db, userA, "Rust");

      const result = await updateTopic(db, userA, id, {
        name: "Go",
        color: "topic-2",
      });

      expect(result).toMatchObject({
        kind: "updated",
        topic: { name: "Go", color: "topic-2" },
      });
    }));

  it("should allow a new case when the name stays the same topic", () =>
    withTestDb(async (db) => {
      const id = await addTopic(db, userA, "rust");

      const result = await updateTopic(db, userA, id, { name: "Rust" });

      expect(result).toMatchObject({ topic: { name: "Rust" } });
    }));

  it("should refuse the name when another topic has it", () =>
    withTestDb(async (db) => {
      await addTopic(db, userA, "Rust");
      const id = await addTopic(db, userA, "Go");

      const result = await updateTopic(db, userA, id, { name: "RUST" });

      expect(result).toEqual({ kind: "duplicate" });
    }));

  it("should reject the color when an update gives a bad one", () =>
    withTestDb(async (db) => {
      const id = await addTopic(db, userA, "Rust");

      const result = await updateTopic(db, userA, id, { color: "red" });

      expect(result).toEqual({ kind: "invalid_color" });
    }));

  it("should return null when updating another user's topic", () =>
    withTestDb(async (db) => {
      const otherId = await addTopic(db, userB, "Go");

      expect(
        await updateTopic(db, userA, otherId, { name: "Taken" }),
      ).toBeNull();
    }));
});

describe("deleting topics", () => {
  it("should keep the resource when its topic is deleted", () =>
    withTestDb(async (db) => {
      const topicId = await addTopic(db, userA, "Rust");
      const resourceId = await addResource(db, userA);
      await setResourceTopics(db, userA, resourceId, [topicId]);

      expect(await deleteTopic(db, userA, topicId)).toBe(true);

      expect(await getResource(db, userA, resourceId)).not.toBeNull();
      expect(await listResourceTopics(db, userA, resourceId)).toEqual([]);
    }));

  it("should not delete another user's topic", () =>
    withTestDb(async (db) => {
      const otherId = await addTopic(db, userB, "Go");

      expect(await deleteTopic(db, userA, otherId)).toBe(false);
      const kept = await listTopics(db, userB);
      expect(kept.map((topic) => topic.id)).toContain(otherId);
    }));
});

describe("linking topics to resources", () => {
  it("should replace the topics when a resource gets a new set", () =>
    withTestDb(async (db) => {
      const rust = await addTopic(db, userA, "Rust");
      const go = await addTopic(db, userA, "Go");
      const resourceId = await addResource(db, userA);
      await setResourceTopics(db, userA, resourceId, [rust]);

      const linked = await setResourceTopics(db, userA, resourceId, [go, go]);

      expect(linked?.map((topic) => topic.name)).toEqual(["Go"]);
    }));

  it("should remove all topics when the new set is empty", () =>
    withTestDb(async (db) => {
      const rust = await addTopic(db, userA, "Rust");
      const resourceId = await addResource(db, userA);
      await setResourceTopics(db, userA, resourceId, [rust]);

      expect(await setResourceTopics(db, userA, resourceId, [])).toEqual([]);
    }));

  it("should return null when linking another user's topic", () =>
    withTestDb(async (db) => {
      const own = await addTopic(db, userA, "Rust");
      const other = await addTopic(db, userB, "Go");
      const resourceId = await addResource(db, userA);
      await setResourceTopics(db, userA, resourceId, [own]);

      expect(
        await setResourceTopics(db, userA, resourceId, [other]),
      ).toBeNull();

      const kept = await listResourceTopics(db, userA, resourceId);
      expect(kept.map((topic) => topic.name)).toEqual(["Rust"]);
    }));

  it("should return null when linking to another user's resource", () =>
    withTestDb(async (db) => {
      const own = await addTopic(db, userA, "Rust");
      const otherResource = await addResource(db, userB);

      expect(
        await setResourceTopics(db, userA, otherResource, [own]),
      ).toBeNull();
    }));

  it("should not read topics when the resource belongs to another user", () =>
    withTestDb(async (db) => {
      const go = await addTopic(db, userB, "Go");
      const resourceId = await addResource(db, userB);
      await setResourceTopics(db, userB, resourceId, [go]);

      expect(await listResourceTopics(db, userA, resourceId)).toEqual([]);
    }));
});
