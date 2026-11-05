import { describe, expect, it } from "vitest";
import { assertLocalDatabaseUrl } from "./test-db";

describe("assertLocalDatabaseUrl", () => {
  it.each([
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    "postgresql://postgres:postgres@localhost:54322/postgres",
  ])("should accept the URL when the host is local: %s", (url) => {
    expect(() => assertLocalDatabaseUrl(url)).not.toThrow();
  });

  it.each([
    "postgresql://postgres:secret@db.abc.supabase.co:5432/postgres",
    "postgresql://postgres:secret@127.0.0.1.example.com:5432/postgres",
  ])("should refuse the URL when the host is not local: %s", (url) => {
    expect(() => assertLocalDatabaseUrl(url)).toThrow(/only run locally/);
  });
});
