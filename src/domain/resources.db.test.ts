import { sql } from "drizzle-orm";
import { expect, it } from "vitest";
import { resources } from "@/lib/db/schema";
import { describeWithDb, SEEDED_USERS, withTestDb } from "@/lib/db/test-db";
import type { Db } from "@/lib/db/types";
import { getResource, listResources } from "./resources";

const { a: userA, b: userB } = SEEDED_USERS;

async function addResource(db: Db, userId: string, title: string) {
  const url = `https://example.test/${title}`;
  const [row] = await db
    .insert(resources)
    .values({ userId, url, normalizedUrl: url, title })
    .returning({ id: resources.id });
  return row.id;
}

describeWithDb("reading resources across users", () => {
  it("should return only the user's own resources when both users have resources", () =>
    withTestDb(async (db) => {
      const ownId = await addResource(db, userA, "from-a");
      await addResource(db, userB, "from-b");

      const rows = await listResources(db, userA);

      expect(rows.map((row) => row.id)).toEqual([ownId]);
    }));

  it("should return null when reading another user's resource by id", () =>
    withTestDb(async (db) => {
      const otherId = await addResource(db, userB, "from-b");

      expect(await getResource(db, userA, otherId)).toBeNull();
    }));

  it("should return the resource when the owner reads it by id", () =>
    withTestDb(async (db) => {
      const ownId = await addResource(db, userB, "from-b");

      expect(await getResource(db, userB, ownId)).toMatchObject({
        id: ownId,
        title: "from-b",
      });
    }));

  it("should reject when userId is missing", () =>
    withTestDb(async (db) => {
      await addResource(db, userB, "from-b");
      const missing = undefined as unknown as string;

      await expect(listResources(db, missing)).rejects.toThrow();
    }));

  it.each(["anon", "authenticated"])(
    "should show no rows when the %s role reads a table",
    (role) =>
      withTestDb(async (db) => {
        await addResource(db, userA, "from-a");
        await db.execute(sql.raw(`set local role ${role}`));

        expect(await db.select().from(resources)).toEqual([]);
      }),
  );
});
