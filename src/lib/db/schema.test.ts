import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getTableName, is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "./schema";

const tables = Object.values(schema).filter((value) => is(value, PgTable));
const namedTables = tables.map(
  (table) => [getTableName(table), table] as const,
);

const references = (table: PgTable) =>
  getTableConfig(table).foreignKeys.map((key) => {
    const reference = key.reference();
    const target = getTableConfig(reference.foreignTable);
    return {
      columns: reference.columns.map((column) => column.name),
      target: `${target.schema ?? "public"}.${target.name}`,
    };
  });

describe("database schema", () => {
  it("should define the 10 tables when reading the schema", () => {
    expect(namedTables.map(([name]) => name).sort()).toEqual([
      "api_tokens",
      "card_schedules",
      "cards",
      "notes",
      "rate_limits",
      "resource_topics",
      "resources",
      "reviews",
      "topics",
      "user_settings",
    ]);
  });

  it.each(namedTables)(
    "should enable RLS when a table is defined: %s",
    (_name, table) => {
      expect(getTableConfig(table).enableRLS).toBe(true);
    },
  );

  it.each(namedTables)(
    "should reference auth users when a table has user_id: %s",
    (_name, table) => {
      expect(references(table)).toContainEqual({
        columns: ["user_id"],
        target: "auth.users",
      });
    },
  );

  it.each(namedTables)(
    "should include user_id when a table links to another user-owned table: %s",
    (_name, table) => {
      const links = references(table).filter(
        (reference) => reference.target !== "auth.users",
      );

      for (const link of links) {
        expect(link.columns).toContain("user_id");
      }
    },
  );

  it("should only clear resource_id when a resource is deleted", () => {
    const folder = join(process.cwd(), "supabase/migrations");
    const sql = readdirSync(folder)
      .filter((file) => file.endsWith(".sql"))
      .map((file) => readFileSync(join(folder, file), "utf8"))
      .join("\n");

    expect(sql).toMatch(/"cards_resource_fk"[^;]*SET NULL \("resource_id"\)/i);
  });
});
