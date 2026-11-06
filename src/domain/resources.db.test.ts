import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { resources } from "@/lib/db/schema";
import { SEEDED_USERS, withTestDb } from "@/lib/db/test-db";
import type { Db } from "@/lib/db/types";
import {
  createResource,
  findResourceByUrl,
  getResource,
  listResources,
  MAX_RESOURCES_PER_USER,
  MAX_TITLE_LENGTH,
  MAX_URL_LENGTH,
  updateResource,
} from "./resources";

const { a: userA, b: userB } = SEEDED_USERS;

async function addResource(db: Db, userId: string, title: string) {
  const url = `https://example.test/${title}`;
  const [row] = await db
    .insert(resources)
    .values({ userId, url, normalizedUrl: url, title })
    .returning({ id: resources.id });
  return row.id;
}

describe("reading resources across users", () => {
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

const link = "https://example.test/guide";

describe("reading one resource", () => {
  it("should return null when the resource id is not a UUID", () =>
    withTestDb(async (db) => {
      expect(await getResource(db, userA, "not-a-uuid")).toBeNull();
    }));
});

describe("creating resources", () => {
  it("should create the resource when the link is new", () =>
    withTestDb(async (db) => {
      const result = await createResource(db, userA, {
        url: ` ${link}?utm_source=x `,
        title: " Guide ",
      });

      expect(result).toMatchObject({
        kind: "created",
        resource: {
          url: `${link}?utm_source=x`,
          title: "Guide",
          status: "want",
          progress: 0,
        },
      });
    }));

  it("should return the existing resource when the link is a duplicate", () =>
    withTestDb(async (db) => {
      const first = await createResource(db, userA, {
        url: link,
        title: "One",
      });

      const second = await createResource(db, userA, {
        url: `http://example.test/guide/#part`,
        title: "Two",
      });

      expect(first.kind).toBe("created");
      expect(second).toMatchObject({
        kind: "duplicate",
        resource: { title: "One" },
      });
      expect(await listResources(db, userA)).toHaveLength(1);
    }));

  it("should allow the same link when another user has it", () =>
    withTestDb(async (db) => {
      await createResource(db, userB, { url: link, title: "From B" });

      const result = await createResource(db, userA, {
        url: link,
        title: "From A",
      });

      expect(result.kind).toBe("created");
    }));

  it("should reject the link when it is not http or https", () =>
    withTestDb(async (db) => {
      const result = await createResource(db, userA, {
        url: "ftp://example.test",
        title: "Guide",
      });

      expect(result).toEqual({ kind: "invalid_url" });
    }));

  it("should reject the title when it is empty", () =>
    withTestDb(async (db) => {
      const result = await createResource(db, userA, {
        url: link,
        title: "  ",
      });

      expect(result).toEqual({ kind: "invalid_title" });
    }));

  it("should reject the link when it is too long", () =>
    withTestDb(async (db) => {
      const result = await createResource(db, userA, {
        url: `${link}/${"a".repeat(MAX_URL_LENGTH)}`,
        title: "Guide",
      });

      expect(result).toEqual({ kind: "invalid_url" });
    }));

  it("should reject the title when it is too long", () =>
    withTestDb(async (db) => {
      const result = await createResource(db, userA, {
        url: link,
        title: "a".repeat(MAX_TITLE_LENGTH + 1),
      });

      expect(result).toEqual({ kind: "invalid_title" });
    }));

  it("should drop the image when its link is too long", () =>
    withTestDb(async (db) => {
      const result = await createResource(db, userA, {
        url: link,
        title: "Guide",
        thumbnailUrl: `${link}/${"a".repeat(MAX_URL_LENGTH)}`,
      });

      expect(result).toMatchObject({
        kind: "created",
        resource: { thumbnailUrl: null },
      });
    }));

  it.each(["javascript:alert(1)", "data:image/png;base64,AAAA", "not a link"])(
    "should not store the image when its link is not http or https: %s",
    (thumbnailUrl) =>
      withTestDb(async (db) => {
        const result = await createResource(db, userA, {
          url: link,
          title: "Guide",
          thumbnailUrl,
        });

        expect(result).toMatchObject({
          kind: "created",
          resource: { thumbnailUrl: null },
        });
      }),
  );

  it("should keep the image when its link is http or https", () =>
    withTestDb(async (db) => {
      const thumbnailUrl = "https://cdn.example.test/a.png";

      const result = await createResource(db, userA, {
        url: link,
        title: "Guide",
        thumbnailUrl,
      });

      expect(result).toMatchObject({ resource: { thumbnailUrl } });
    }));

  it("should set progress to 100 when the new resource is done", () =>
    withTestDb(async (db) => {
      const result = await createResource(db, userA, {
        url: link,
        title: "Guide",
        status: "done",
      });

      expect(result).toMatchObject({ resource: { progress: 100 } });
    }));

  it("should refuse a new resource when the account has 2,000", () =>
    withTestDb(async (db) => {
      await db.execute(sql`
        insert into resources (user_id, url, normalized_url, title)
        select ${userA}::uuid, 'https://bulk.test/' || i, 'https://bulk.test/' || i, 'Bulk'
        from generate_series(1, ${MAX_RESOURCES_PER_USER}) as i
      `);

      const refused = await createResource(db, userA, {
        url: link,
        title: "One too many",
      });
      const otherUser = await createResource(db, userB, {
        url: link,
        title: "Still fine",
      });

      expect(refused).toEqual({ kind: "limit_reached" });
      expect(otherUser.kind).toBe("created");
    }));
});

describe("finding resources by link", () => {
  it("should return the resource when finding a link the user already has", () =>
    withTestDb(async (db) => {
      await createResource(db, userA, { url: link, title: "Guide" });

      const found = await findResourceByUrl(db, userA, `${link}/?utm_source=x`);

      expect(found).toMatchObject({ title: "Guide" });
    }));

  it("should return null when another user has the link", () =>
    withTestDb(async (db) => {
      await createResource(db, userB, { url: link, title: "Guide" });

      expect(await findResourceByUrl(db, userA, link)).toBeNull();
    }));

  it("should return null when the link is not valid", () =>
    withTestDb(async (db) => {
      expect(await findResourceByUrl(db, userA, "not a link")).toBeNull();
    }));
});

describe("updating resources", () => {
  it("should change the fields when the owner updates the resource", () =>
    withTestDb(async (db) => {
      const id = await addResource(db, userA, "before");

      const result = await updateResource(db, userA, id, {
        title: " After ",
        type: "video",
      });

      expect(result).toMatchObject({
        kind: "updated",
        resource: { title: "After", type: "video" },
      });
    }));

  it("should keep the title when only other fields change", () =>
    withTestDb(async (db) => {
      const id = await addResource(db, userA, "kept");

      const result = await updateResource(db, userA, id, { type: "doc" });

      expect(result).toMatchObject({
        resource: { title: "kept", type: "doc" },
      });
    }));

  it("should reject the title when it is empty", () =>
    withTestDb(async (db) => {
      const id = await addResource(db, userA, "kept");

      expect(await updateResource(db, userA, id, { title: " " })).toEqual({
        kind: "invalid_title",
      });
      expect(await getResource(db, userA, id)).toMatchObject({ title: "kept" });
    }));

  it("should reject the title when an update makes it too long", () =>
    withTestDb(async (db) => {
      const id = await addResource(db, userA, "kept");

      const result = await updateResource(db, userA, id, {
        title: "a".repeat(MAX_TITLE_LENGTH + 1),
      });

      expect(result).toEqual({ kind: "invalid_title" });
    }));

  it("should not store the image when an update gives a javascript link", () =>
    withTestDb(async (db) => {
      const id = await addResource(db, userA, "kept");

      const result = await updateResource(db, userA, id, {
        thumbnailUrl: "javascript:alert(1)",
      });

      expect(result).toMatchObject({ resource: { thumbnailUrl: null } });
    }));

  it("should ignore other fields when a caller passes them at runtime", () =>
    withTestDb(async (db) => {
      const id = await addResource(db, userA, "kept");
      const smuggled = { title: "new", userId: userB, progress: 100 };

      await updateResource(db, userA, id, smuggled);

      expect(await getResource(db, userA, id)).toMatchObject({
        title: "new",
        progress: 0,
      });
    }));

  it("should return null when updating another user's resource", () =>
    withTestDb(async (db) => {
      const otherId = await addResource(db, userB, "from-b");

      expect(
        await updateResource(db, userA, otherId, { title: "taken" }),
      ).toBeNull();
      expect(await getResource(db, userB, otherId)).toMatchObject({
        title: "from-b",
      });
    }));
});
