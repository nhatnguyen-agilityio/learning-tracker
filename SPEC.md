# Learning Tracker — SPEC

Source: [Learning Tracker — PRD](https://claude.ai/artifact/Su4HPs68ZmL3RkB8cMyctc), updated 2026-11-05. When a new decision affects a flow, data or scope, update both places. This file is in English; the PRD is in Vietnamese.

**Problem:** self-learners pick up knowledge from many sources. Links are scattered, progress is unclear, and a few days after studying they forget.

**Solution:** a web app that brings resources, notes and review cards into one flow. A spaced repetition schedule reminds people right before they forget. Claude creates cards from notes through the app's MCP server.

## Persona

- **Primary user:** a developer learning several topics alongside their job. They study on a computer and review cards on a computer and a phone.
- **Wider users:** anyone who signs up with Google. Each person sees only their own data.

### Success metrics (after 1 month of use)

- Reviews cards at least 5 days a week
- Recall rate (rated "Remembered" or "Vaguely") of 80% or more, counted on the first rating of each card in a session
- Track the share of users still reviewing after 7 days

Metrics are calculated with SQL from the `reviews` table.

## User flow

### F1 — Sign up / sign in

1. Press "Sign in with Google" → open the Today screen. The sign-in screen has a short intro, a language switch, and links to Terms and Privacy
2. First time: the app takes the time zone and language from the browser (anything other than Vietnamese uses English); both can be changed in Settings
3. First time: Today is empty and suggests "Add your first resource"

### F2 — Add a resource

1. Press "Add resource" → paste a link
2. The link is already in the library → warn and open the existing resource, without creating a new one
3. The app fetches the title, image and type (article / video / course / docs) through oEmbed for YouTube and Open Graph for other sites; the user can edit them
4. Pick topics (choose existing ones or create one in place), default status "Want to learn" → Save. A new resource saved as "Done" has 100% progress
5. A string that isn't a valid link (it must start with http or https) → show an error, saving is blocked
6. A valid link that is broken, blocks bots or gives no metadata → it can still be saved, with the title typed by hand. A broken image shows a fallback image

### F3 — Study and take notes

1. Open a resource → press to open the original link (new tab)
2. Add or edit markdown notes in the resource's note list; each note auto-saves on its own. Above 100 KB, saving stops and an error shows; the text stays in the editor and the last saved version is kept
3. Drag the progress bar; above 0, "Want to learn" changes to "Learning" automatically; at 100%, suggest changing to "Done". For an existing resource, changing to "Done" does not change the %

### F4 — Create cards by hand

1. On the resource page, press "Add card" → enter the front and back (markdown)
2. The new card joins the schedule's "new cards" queue

### F5 — Create cards through Claude (MCP, slice S6)

1. In Claude Desktop, add a custom connector with the address shown in Settings, then sign in and allow access. Claude Code can use an API token instead
2. In Claude: "Create review cards from my notes on article X"
3. Claude finds the resource, reads the notes through MCP, proposes cards, then creates them as **pending**
4. In the app, the "Pending" section lets the user edit, approve or delete each card, or "Approve all" per resource. Only approved cards enter the schedule, in the new-card queue, and they count toward the daily new-card limit

### F6 — Daily review

1. Today shows the number of due cards → press "Start review"
2. See the front → flip (Space or a tap) → self-rate: Forgot / Vaguely / Remembered (keys 1/2/3). A help line under the buttons: rate Forgot if you couldn't recall the answer; rate Vaguely if you were right but had to think for a long time
3. The app moves to the next card at once and saves the rating in the background; on a network error it resends automatically
4. Cards rated Forgot come back at the end of the session
5. Wrong rating → undo the latest rating (Z key or a button on mobile)
6. A session is split into batches of 50 cards, longest overdue first. End of a batch → summary with a "Keep reviewing" button
7. No cards left → summary screen: cards reviewed, recall rate, streak

### F7 — View progress

1. Today: streak, due cards, resources in progress
2. Library: search by title, URL and notes; filter by topic and status; see each resource's progress

### F8 — Delete resources and cards

1. On the resource page, press "Delete resource" → confirm
2. The resource's notes are deleted; cards are kept and detached from the resource (`resource_id = null`)
3. Deleting a card that has been reviewed is a soft delete (`deleted_at`) to keep `reviews`; deleting a card with no reviews, pending or active, is a hard delete

### F9 — Settings and account

1. In Settings, change new cards per day, time zone, language, light or dark appearance, and manage topics
2. Export data: download a JSON file with all of the user's data
3. Delete account: confirm → delete all of the account's data
4. Sign out: return to the sign-in screen; data stays as it is

## Screens

| Screen | Purpose | Main data | Actions | Flow |
| --- | --- | --- | --- | --- |
| Sign-in | Enter the app | Short intro | Sign in with Google, switch language | F1 |
| Today | Starting point of each day | Due cards, streak, resources in progress, pending card count | Start review, open a resource, add a resource | F1, F6, F7 |
| Library | Manage resources | Resource list, topics, status, % | Search, filter, add a resource | F2, F7 |
| Add / edit resource (modal) | Create a resource from a link | Metadata from the link | Edit title, pick topics, save | F2 |
| Resource detail | Study and take notes | Info, progress, notes and cards of the resource | Open link, take notes, adjust %, add card, delete resource | F3, F4, F8 |
| Review | Review due cards | Current card, cards remaining | Flip, rate on 3 levels, undo, exit | F6 |
| Session summary | Feedback after reviewing | Card count, recall rate, streak | Keep reviewing, back to Today | F6 |
| Cards | Manage cards | Card list, "Pending" tab | Edit, approve, approve all per resource, delete, suspend a card | F4, F5, F8 |
| Settings | Configuration | New cards per day, time zone, language, appearance, topics, API token | Change settings, manage topics, create or revoke tokens, read the MCP guide, export data, sign out, delete account | F5, F9 |
| Terms and Privacy | Publish how data is used | Static content, 2 languages | Read, back to the previous screen | F1 |

**States to design for each screen:** empty (first time), loading, error, long data. Every screen has light and dark and both languages. Review and Today are mobile first.

## Business rules

### Card types

The MVP has only question-and-answer cards (markdown, code blocks). The data model has `type` and `extra` so phase 2 can add: two-way, cloze, typed answer, multiple choice and code.

### Review schedule

- **Algorithm:** FSRS through `ts-fsrs`, with learning steps on so Forgot cards return within the session
- **3 ratings:** Forgot → Again, Vaguely → Hard, Remembered → Good (Easy is hidden)
- **New cards:** at most 20 per day, adjustable in Settings from 0 to 100; due cards have no limit. While there is a backlog (more than 50 due cards), new cards pause
- **Day:** follows the user's time zone; a new day starts at 04:00
- **Streak:** consecutive days with at least 1 review. A day with no due cards neither breaks the streak nor adds to it
- **Suspended cards:** a suspended card stays out of the schedule until it is turned back on
- **Review session:** batches of 50 cards, longest overdue first; the session ends when no cards are left
- **Recall rate:** counts only the first rating of each card in a session
- **Undo:** restores the latest rating
- **History:** every rating is saved in `reviews`, with the FSRS state from before the rating

### MCP server (slice S6)

The app provides an MCP server so Claude can read data and create cards. The user's own Claude generates the cards, so the app does not call the Claude API.

- **Endpoint:** `/api/mcp`, Streamable HTTP, running in the same codebase as the web app
- **Auth:** OAuth 2.1 through the Supabase Auth OAuth Server, with dynamic client registration and a consent page in the app. Anyone can register a client, so the page only trusts the name of a client that returns to Claude's exact callback on `claude.ai` or `claude.com`, or to a local address; any other client is marked unverified and titled by its address. Connected apps can be disconnected in Settings. A personal API token created in Settings also works, sent through `Authorization: Bearer <token>`; stored as a hash and revocable
- **Client:** Claude Desktop and claude.ai through a custom connector, signing in with OAuth. Claude Code and clients that can set headers can use an API token instead
- **Scope:** each token reaches only its owner's data

| Tool | Input | Result |
| --- | --- | --- |
| `search_resources` | `query`, `topic?`, `status?` | Resources matching title, URL or notes (id, title, topics, %) |
| `get_resource` | `resource_id` | Resource info, notes and existing cards |
| `add_resource` | `url`, `topics?`, `status?` | The new resource |
| `add_note` | `resource_id`, `content` | A new note on the resource, never touching a note being edited |
| `create_cards` | `resource_id?`, `cards[{type, front, back}]` | Cards with status **pending** |
| `get_study_stats` | `range?` | Streak, due card count, recall rate |

**Safety rules:** MCP has no delete tool. Cards created through MCP must always be approved in the app. Every tool shares the `domain` layer, so the same authorization, rate limit and account limits apply. Tool responses are not translated to the interface language.

## Data model

Every table has `user_id`. The `domain` layer is the main authorization layer: every query function must take a `userId`, and tests block cross-user reads between two users. RLS is on for every table with no policies, which closes access through Supabase's public API. Links between tables use composite foreign keys on `(id, user_id)`, so the database refuses a row that points at another user's data.

| Table | Main fields | Notes |
| --- | --- | --- |
| `topics` | id, user_id, name, color | Topics the user creates; name up to 50 characters, unique per user ignoring case; color is one of `topic-1` to `topic-8` |
| `resources` | id, user_id, url, normalized_url, title, type, thumbnail_url, status, progress (0–100), created_at, updated_at | type: article / video / course / doc / other; status: want / learning / done; `url` keeps the original link; duplicate warning by user_id + normalized_url |
| `resource_topics` | user_id, resource_id, topic_id | Many-to-many |
| `notes` | id, user_id, resource_id, content_md, created_at, updated_at | A resource has many notes |
| `cards` | id, user_id, resource_id?, type, front, back, extra (jsonb), status, source, created_at, deleted_at | status: pending / active / suspended; source: manual / mcp; deleted_at: soft delete of reviewed cards |
| `card_schedules` | card_id, user_id, due, stability, difficulty, learning_steps, reps, lapses, state, last_review | FSRS state, kept apart from card content |
| `reviews` | id, card_id, user_id, rating, reviewed_at, elapsed_days, scheduled_days, idempotency_key, prev_schedule (jsonb) | Rating history; idempotency_key prevents duplicates, prev_schedule enables undo |
| `user_settings` | user_id, new_cards_per_day (20), timezone, locale | |
| `api_tokens` | id, user_id, name, token_hash, created_at, last_used_at, revoked_at | For MCP |
| `rate_limits` | user_id, action, count, window_started_at | One row per user and action, with a fixed window |

**Relations:** topic ⟷ resource (many-to-many) · resource → notes, cards (one-to-many) · card → card_schedule (one-to-one), reviews (one-to-many).

## Non-functional

- **Auth:** Supabase Auth, Google sign-in only in the MVP
- **Authorization:** in the `domain` layer; RLS on with no policies on every table; API tokens stored as hashes; page content of links is never stored, only metadata
- **Platform:** responsive web; Review and Today are designed mobile first
- **Performance:** card changes take under 200 ms: servers in Singapore, prefetched card batches, ratings sent in the background through a Route Handler with a `localStorage` queue and a duplicate-prevention key
- **Experience:** keyboard shortcuts when reviewing (Space flips, 1/2/3 rate, Z undoes); dark mode chosen as Light or Dark in Settings, stored per browser, light by default; notes auto-save
- **Language:** Vietnamese and English through `next-intl`, with no language in the URL; stored in `user_settings.locale` and a cookie. The interface, error messages, Terms page and MCP guide are translated; user content is not. A test fails when the two message files have different keys. The root layout reads the language from a cookie to set `<html lang>`, so it sets `instant = false` and every route waits for the server; code in `"use cache"` takes the language as a parameter
- **Abuse protection:** link fetching accepts only http and https, blocks internal IPs, re-checks after every redirect, times out after 5 seconds and reads at most 1 MB. Rate limit per user, stored in Postgres: 30 link lookups and 60 MCP requests per minute. Limits per account: 2,000 resources, 10,000 cards, 5,000 notes, 100 KB per note, 10 KB per card side, 10 active API tokens, 50 cards per `create_cards` call. Links are at most 2,048 characters and resource titles 500 characters
- **Search:** in title, URL and notes, ignoring Vietnamese accents (`unaccent` and `pg_trgm`); Library and MCP share one function
- **User data:** Terms and Privacy pages, account deletion and JSON export
- **Not required:** offline use

### Tech stack

| Part | Choice |
| --- | --- |
| Web + API | Next.js (App Router, TypeScript), Server Actions and Route Handlers |
| UI | Tailwind CSS + shadcn/ui |
| Database, Auth | Supabase (Postgres, Auth) |
| ORM | Drizzle |
| Review schedule | `ts-fsrs` |
| MCP | Route `/api/mcp` using the MCP TypeScript SDK |
| Internationalization | `next-intl` |
| Error tracking | Sentry (free plan) |
| Testing | Vitest (logic), Playwright (main flows) |

**Code architecture:** business logic (schedule, streak, authorization) lives in a pure TypeScript `domain` layer, shared by the UI, Server Actions and MCP.

### Deploy

- **Vercel:** Next.js (including the API and MCP endpoint), Singapore region, on `*.vercel.app`. Merging into `main` deploys to production; preview deploys are off
- **Supabase Cloud:** one project for production, Singapore region
- **Local:** Supabase CLI and Docker, with `seed.sql` providing 2 users for cross-user read tests. Test sign-in is on locally only; the production build fails if its flag is on
- **Migration:** the `db:migrate:prod` command runs by hand before merging code: it runs `pg_dump`, then migrates. Each migration must work with the running code; removing a column takes 2 releases
- **Backup:** nightly `pg_dump`, encrypted, kept for 14 days in GitHub Actions of the private repo
- **Cost:** start on free plans; the MVP charges nothing and runs no ads. Upgrade only when really needed

## MVP

**The MVP is done when** the design, S0–S5 and minimal Settings run on production. S6 (MCP) follows right after.

| In scope | Out of scope (later) |
| --- | --- |
| Sign up and sign in with Google | Magic link sign-in (once there is a domain and SMTP) |
| Add a resource by link, with title and image fetched automatically | PDF upload |
| User-created topics, several topics per resource | Ordered learning paths |
| Resource status and progress % | Notes at video timestamps |
| Markdown notes per resource | Offline use |
| Question-and-answer cards, created by hand | Other card types |
| Review on a spaced repetition schedule, undo the latest rating | Import from bookmarks, Anki, Notion |
| Today dashboard, progress, streak | Library sharing, browser extension |
| Vietnamese and English interface | Review reminders by email or push |
| Terms, Privacy, account deletion, JSON export | Separate landing page |
| SSRF protection, rate limit, per-account limits | Payments, ads |
| MCP server (slice S6, right after the MVP) | Preview deploys, staging |

### Milestones

Order follows the kit: design all 10 screens, then `/plan-arch`, then `/slice` each part. S0 runs alongside design. Estimates assume 1–2 hours each evening.

| Slice | Content | Estimate |
| --- | --- | --- |
| D — Design | Design system and prototype for all 10 screens: states, light/dark, mobile | 5–6 evenings |
| S0 — Foundation | Repo and kit files, pinned Node and pnpm, local Supabase and seed, Google auth, schema, language setup, Sentry, backup, `db:migrate:prod`, skeleton deploy to Vercel | 4 evenings |
| S1 — Library | Add resources from links safely, duplicate prevention, topics, list, filters, search, rate limit and account limits | 3–4 evenings |
| S2 — Resource detail | Multiple auto-saving markdown notes, progress %, status, delete resource | 2 evenings |
| S3 — Cards | Create, edit, suspend and delete question-and-answer cards | 1–2 evenings |
| S4 — Review | Review session with FSRS, learning steps, batches of 50 cards, background save queue, undo, shortcuts, summary | 4 evenings |
| S5 — Today and Settings | Dashboard, streak, Settings, language switch, Terms, data export, account deletion | 3–4 evenings |
| S6 — MCP (after the MVP) | API token, `/api/mcp` endpoint, 6 tools, "Pending" tab, "Approve all" | 3 evenings |

In total about 25–30 evenings: 22–26 for the MVP and 3 for S6. Two weeks is a soft target, not a commitment.
