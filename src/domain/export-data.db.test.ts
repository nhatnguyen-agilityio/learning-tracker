import { getTableName, is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import { SEEDED_USERS, withTestDb } from "@/lib/db/test-db";
import type { Db } from "@/lib/db/types";
import { exportUserData } from "./export-data";

const { a: userA, b: userB } = SEEDED_USERS;
const now = new Date("2026-11-06T12:00:00Z");

/** Writes one row to every table, all carrying the marker text. */
async function seedUser(db: Db, userId: string, marker: string) {
  const [topic] = await db
    .insert(schema.topics)
    .values({ userId, name: `${marker}-topic`, color: "topic-1" })
    .returning({ id: schema.topics.id });
  const [resource] = await db
    .insert(schema.resources)
    .values({
      userId,
      url: `https://export.test/${marker}`,
      normalizedUrl: `https://export.test/${marker}`,
      title: `${marker}-resource`,
    })
    .returning({ id: schema.resources.id });
  await db
    .insert(schema.resourceTopics)
    .values({ userId, resourceId: resource.id, topicId: topic.id });
  await db
    .insert(schema.notes)
    .values({ userId, resourceId: resource.id, contentMd: `${marker}-note` });
  const [card] = await db
    .insert(schema.cards)
    .values({ userId, front: `${marker}-card`, back: "A" })
    .returning({ id: schema.cards.id });
  await db
    .insert(schema.cardSchedules)
    .values({ cardId: card.id, userId, due: now });
  await db.insert(schema.reviews).values({
    cardId: card.id,
    userId,
    rating: 3,
    elapsedDays: 0,
    scheduledDays: 1,
    idempotencyKey: `${marker}-review`,
    prevSchedule: {},
  });
  await db
    .insert(schema.userSettings)
    .values({ userId, timezone: "UTC", locale: "en" })
    .onConflictDoNothing();
  await db.insert(schema.apiTokens).values({
    userId,
    name: `${marker}-token`,
    tokenHash: `${marker}-secret-hash`,
  });
  await db
    .insert(schema.rateLimits)
    .values({ userId, action: `${marker}-action` })
    .onConflictDoNothing();
}

describe("exporting user data", () => {
  it("should include a row from every table", () =>
    withTestDb(async (db) => {
      await seedUser(db, userA, "own");

      const data = await exportUserData(db, userA, now);

      for (const rows of [
        data.topics,
        data.resources,
        data.resource_topics,
        data.notes,
        data.cards,
        data.card_schedules,
        data.reviews,
        data.user_settings,
        data.api_tokens,
        data.rate_limits,
      ]) {
        expect(rows.length).toBeGreaterThan(0);
      }
      expect(data.exportedAt).toBe(now.toISOString());
    }));

  it("should cover every table in the schema", () =>
    withTestDb(async (db) => {
      const tables = Object.values(schema)
        .filter((value) => is(value, PgTable))
        .filter((table) => getTableConfig(table).schema === undefined)
        .map((table) => getTableName(table));

      const data = await exportUserData(db, userA, now);

      expect(tables.length).toBeGreaterThan(0);
      expect(Object.keys(data)).toEqual(expect.arrayContaining(tables));
    }));

  it("should not include another user's data from any table", () =>
    withTestDb(async (db) => {
      await seedUser(db, userA, "own");
      await seedUser(db, userB, "other");

      const text = JSON.stringify(await exportUserData(db, userA, now));

      expect(text).toContain("own-note");
      expect(text).not.toContain("other-");
      expect(text).not.toContain(userB);
    }));

  it("should never include a token hash", () =>
    withTestDb(async (db) => {
      await seedUser(db, userA, "own");

      const data = await exportUserData(db, userA, now);
      const text = JSON.stringify(data);

      expect(text).toContain("own-token");
      expect(text).not.toContain("own-secret-hash");
      expect(text).not.toContain("tokenHash");
    }));

  it("should include soft deleted cards", () =>
    withTestDb(async (db) => {
      await db.insert(schema.cards).values({
        userId: userA,
        front: "gone-card",
        back: "A",
        deletedAt: now,
      });

      const data = await exportUserData(db, userA, now);

      expect(data.cards.map((card) => card.front)).toContain("gone-card");
    }));
});
