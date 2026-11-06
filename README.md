# Learning Tracker

Bring resources, notes and review cards into one flow, then review with spaced repetition. See `SPEC.md`.

## Run the project

```bash
nvm use
corepack enable pnpm
pnpm install
pnpm dev
```

Other commands are in `CLAUDE.md`. The first E2E run needs `pnpm exec playwright install chromium`.

## Local database

Docker Desktop must be running. The first start downloads the Supabase images, which takes a few minutes.

```bash
pnpm db:start
pnpm db:status
pnpm db:stop
```

`pnpm db:start` creates the database and runs `supabase/seed.sql` if the database is empty. `pnpm db:stop` keeps the data.

Create `.env.local` from `.env.sample`, then take the values from `pnpm exec supabase status -o env`:

| Variable in `.env.local`        | Value in `supabase status` |
| ------------------------------- | -------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | `API_URL`                  |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `ANON_KEY`                 |
| `DATABASE_URL`                  | `DB_URL`                   |

The seed has 2 local-only users for cross-user read tests: `user-a@example.test` and `user-b@example.test`. The password is in `supabase/seed.sql`.

To recreate the database from scratch, run `pnpm exec supabase db reset` yourself. It deletes local data, so a hook stops Claude from running it. Run it after `seed.sql` changes too.

### Sign-in

The app only opens for signed-in users, so `pnpm dev` needs `.env.local` (including `DATABASE_URL`) and a running Supabase. The first sign-in creates `user_settings` from the browser's time zone and language. `pnpm test:e2e` needs the same: E2E signs in as a seeded user through `/test-sign-in`, and Playwright turns on the `TEST_SIGN_IN_ENABLED` flag itself. Don't turn this flag on in `.env.local` if you plan to run `pnpm build`, because the build will stop.

Google sign-in locally needs your own OAuth client:

1. In Google Cloud Console, create an OAuth client of type Web application.
2. Add the Authorized redirect URI: `http://127.0.0.1:54321/auth/v1/callback`.
3. Create `supabase/.env` (git ignores it):

   ```bash
   SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=
   SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=
   ```

4. Run `pnpm db:stop`, then `pnpm db:start`.

Open the app at `http://localhost:3000` or `http://127.0.0.1:3000`, because `supabase/config.toml` only allows returning to these two addresses.

### Database tests

`pnpm test` also runs the `*.db.test.ts` files on the local database, so run `pnpm db:start` first; the tests fail if the database is down. Each test runs in a transaction and rolls back, so it leaves no data. Tests only run on `127.0.0.1` or `localhost`.

CI runs these tests too: the workflow starts Supabase's Postgres with `pnpm exec supabase db start`, including migrations and `supabase/seed.sql`, before `pnpm test`.

### Changing the schema

1. Edit `src/lib/db/schema.ts`. A new table must have `.enableRLS()` and no policies.
2. `pnpm db:generate --name=<change_name>` writes a migration to `supabase/migrations`.
3. Read the generated SQL.
4. `pnpm db:migrate` applies it to the local database.

Don't edit a migration once it is merged; the next change is a new migration.

The `analytics` container is off in `supabase/config.toml`, because it did not start locally and the app doesn't use it.
