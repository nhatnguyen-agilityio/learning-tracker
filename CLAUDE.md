# Learning Tracker

@AGENTS.md

## What this is

A web app for self-learners: bring resources, notes and review cards into one flow, then review with spaced repetition. The main user is a developer learning alongside their job; each person sees only their own data.

## Sources of truth

- Spec: `SPEC.md`. When a new decision affects a flow, data or scope, update both `SPEC.md` (English) and the PRD (Vietnamese).
- PRD: https://claude.ai/artifact/Su4HPs68ZmL3RkB8cMyctc
- Design system and prototype: https://claude.ai/artifact/NYLS4XYntxLFmtp5snMb2o
- Tickets: Trello https://trello.com/b/builyI19/learning-tracker (Backlog, In Progress, Review, Done)

The prototype is a mock for reference on UI and flow; don't copy its code.

## Commands

Run `nvm use` first; the repo pins Node 24 and pnpm through corepack.

- Install: `pnpm install`
- Run: `pnpm dev` (port 3000)
- Test: `pnpm test` (needs `pnpm db:start`) · E2E: `pnpm test:e2e`
- Lint: `pnpm lint` · Types: `pnpm typecheck` · Format: `pnpm format`
- Build: `pnpm build`
- Local database: `pnpm db:start` · `pnpm db:status` · `pnpm db:stop` (needs Docker, see the README)
- Migrations: `pnpm db:generate --name=<name>` · `pnpm db:migrate`; the schema is in `src/lib/db/schema.ts`

## Conventions

- Language: everything in the repo, git and Trello is in English; the exceptions are the Vietnamese product text in `src/lib/i18n/messages/vi.json` and tests that check it
- Folder layout: `src/app` routes, `src/components` UI, `src/components/ui` shadcn, `src/domain` pure TypeScript business logic, `src/lib` utilities
- Business logic lives in `src/domain`, shared by the UI, Server Actions and MCP
- Use only the semantic tokens in `src/app/globals.css`; no color codes in components
- Spacing is a multiple of 4; the UI has both Vietnamese and English
- Tests sit next to the code and are named "should … when …"; E2E is in `e2e/`
- Commits: one line, `feat(): …` / `bugfix(): …` / `refactor(): …` / `test(): …`
- Branches: `feat/<short>` or `fix/<short>` cut from `dev`, merged into `dev` through a pull request (`--base dev`)
- Deploy: only a `dev` → `main` PR goes to production; merging into `main` deploys

## Writing a new domain function

The `domain` layer is the only authorization layer: the app connects with a role that bypasses RLS, so a missing `userId` filter leaks data. Pattern: `src/domain/resources.ts`.

- A function that touches a user's table has the signature `(db: Db, userId: string, ...)`; `userId` comes from the session in the caller, never from client input
- Every query has `eq(table.userId, userId)` written out; Drizzle's `and(undefined)` means no filter
- Another user's row is returned as a missing row (`null`), with no separate error
- Select the columns you return, never `select *`
- Don't read `process.env`, cookies or `next/*` in `src/domain`; if the caller uses `"use cache"`, pass `userId` as a parameter
- Each function has a cross-user read test in `*.db.test.ts`, using `withTestDb` from `src/lib/db/test-db.ts`. `withTestDb` always rolls back, so the seed stays unchanged. CI runs these tests on local Supabase, so a missing `userId` filter turns CI red

## Workflow

- BA: no · QA: no. The ticket and `SPEC.md` are the spec; tests go in the approved plan.
- Every ticket starts in plan mode: goal, branch, files, steps, tests. Code only after the plan is approved.
- Trello doesn't close cards from PRs: add the PR link to the card and move it between columns.

## Never

- Never edit code or cut a branch before the plan is approved
- Never push to main or dev, and never force-push
- Never open a feature or fix PR straight into main
- Never edit generated components in `src/components/ui`; wrap them instead
- Never reset or rewrite shared seed data; test on a throwaway copy
- Never skip or delete a failing test
- Never change CI configuration unless asked
- Never commit secrets or real `.env` files
