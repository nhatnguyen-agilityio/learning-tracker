import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  // Supabase applies this folder on `pnpm db:start` and `pnpm db:migrate`.
  out: "./supabase/migrations",
  migrations: { prefix: "supabase" },
});
