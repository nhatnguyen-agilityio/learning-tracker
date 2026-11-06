import { count, eq, getTableName, is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { authUsers } from "drizzle-orm/supabase";
import { describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import { withTestDb } from "@/lib/db/test-db";
import type { Db } from "@/lib/db/types";
import { deleteAccount } from "./delete-account";

const userTables = [
  schema.topics,
  schema.resources,
  schema.resourceTopics,
  schema.notes,
  schema.cards,
  schema.cardSchedules,
  schema.reviews,
  schema.userSettings,
  schema.apiTokens,
  schema.rateLimits,
];

async function seedUser(db: Db, userId: string) {
  const [topic] = await db
    .insert(schema.topics)
    .values({ userId, name: "Delete test", color: "topic-1" })
    .returning({ id: schema.topics.id });
  const url = `https://delete.test/${crypto.randomUUID()}`;
  const [resource] = await db
    .insert(schema.resources)
    .values({ userId, url, normalizedUrl: url, title: "Guide" })
    .returning({ id: schema.resources.id });
  await db
    .insert(schema.resourceTopics)
    .values({ userId, resourceId: resource.id, topicId: topic.id });
  await db.insert(schema.notes).values({ userId, resourceId: resource.id });
  const [card] = await db
    .insert(schema.cards)
    .values({ userId, resourceId: resource.id, front: "Q", back: "A" })
    .returning({ id: schema.cards.id });
  await db
    .insert(schema.cardSchedules)
    .values({ cardId: card.id, userId, due: new Date() });
  await db.insert(schema.reviews).values({
    cardId: card.id,
    userId,
    rating: 3,
    elapsedDays: 0,
    scheduledDays: 1,
    idempotencyKey: crypto.randomUUID(),
    prevSchedule: {},
  });
  await db
    .insert(schema.userSettings)
    .values({ userId, timezone: "UTC", locale: "en" })
    .onConflictDoNothing();
  await db.insert(schema.apiTokens).values({
    userId,
    name: "Token",
    tokenHash: crypto.randomUUID(),
  });
  await db
    .insert(schema.rateLimits)
    .values({ userId, action: "delete-test" })
    .onConflictDoNothing();
}

async function countRows(db: Db, userId: string) {
  return Promise.all(
    userTables.map(async (table) => {
      const [{ total }] = await db
        .select({ total: count() })
        .from(table)
        .where(eq(table.userId, userId));
      return total;
    }),
  );
}

/**
 * A user made for the test. Deleting a seeded user would lock its row, and the
 * other test files running at the same time need that row.
 */
async function addUser(db: Db) {
  const id = crypto.randomUUID();
  await db.insert(authUsers).values({ id });
  return id;
}

describe("deleting an account", () => {
  it("should leave no data in any table", () =>
    withTestDb(async (db) => {
      const userId = await addUser(db);
      await seedUser(db, userId);
      expect((await countRows(db, userId)).every((total) => total > 0)).toBe(
        true,
      );

      expect(await deleteAccount(db, userId)).toBe(true);

      expect(await countRows(db, userId)).toEqual(userTables.map(() => 0));
      expect(
        await db
          .select({ id: authUsers.id })
          .from(authUsers)
          .where(eq(authUsers.id, userId)),
      ).toEqual([]);
    }));

  it("should keep other users' data", () =>
    withTestDb(async (db) => {
      const userId = await addUser(db);
      const otherId = await addUser(db);
      await seedUser(db, userId);
      await seedUser(db, otherId);
      const before = await countRows(db, otherId);

      await deleteAccount(db, userId);

      expect(await countRows(db, otherId)).toEqual(before);
    }));

  it("should return false when the user doesn't exist", () =>
    withTestDb(async (db) => {
      expect(await deleteAccount(db, crypto.randomUUID())).toBe(false);
    }));

  it("should check every table in the schema", () => {
    const tables = Object.values(schema)
      .filter((value) => is(value, PgTable))
      .filter((table) => getTableConfig(table).schema === undefined)
      .map((table) => getTableName(table));

    expect(userTables.map((table) => getTableName(table)).sort()).toEqual(
      tables.sort(),
    );
  });
});
