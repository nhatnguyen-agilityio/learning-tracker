import { getTableName, is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "./schema";

const tables = Object.values(schema).filter((value) => is(value, PgTable));

describe("database schema", () => {
  it("should define the 9 tables when reading the schema", () => {
    expect(tables.map((table) => getTableName(table)).sort()).toEqual([
      "api_tokens",
      "card_schedules",
      "cards",
      "notes",
      "resource_topics",
      "resources",
      "reviews",
      "topics",
      "user_settings",
    ]);
  });

  it.each(tables.map((table) => [getTableName(table), table] as const))(
    "should enable RLS when a table is defined: %s",
    (_name, table) => {
      expect(getTableConfig(table).enableRLS).toBe(true);
    },
  );

  it.each(tables.map((table) => [getTableName(table), table] as const))(
    "should reference auth users when a table has user_id: %s",
    (_name, table) => {
      const config = getTableConfig(table);
      const userIdKey = config.foreignKeys
        .map((key) => key.reference())
        .find((reference) =>
          reference.columns.some((column) => column.name === "user_id"),
        );

      expect(config.columns.some((column) => column.name === "user_id")).toBe(
        true,
      );
      expect(userIdKey).toBeDefined();
      const target = getTableConfig(userIdKey!.foreignTable);
      expect([target.schema, target.name]).toEqual(["auth", "users"]);
    },
  );
});
