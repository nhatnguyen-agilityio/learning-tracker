import { sql } from "drizzle-orm";
import {
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authUsers } from "drizzle-orm/supabase";

// Every table has RLS on with no policies. That closes Supabase's public API;
// the app reaches data only through `src/domain`, which requires a userId.

const id = () => uuid("id").primaryKey().defaultRandom();
const userId = () =>
  uuid("user_id")
    .notNull()
    .references(() => authUsers.id, { onDelete: "cascade" });
const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export const resourceType = pgEnum("resource_type", [
  "article",
  "video",
  "course",
  "doc",
  "other",
]);
export const resourceStatus = pgEnum("resource_status", [
  "want",
  "learning",
  "done",
]);
export const cardType = pgEnum("card_type", ["qa"]);
export const cardStatus = pgEnum("card_status", [
  "pending",
  "active",
  "suspended",
]);
export const cardSource = pgEnum("card_source", ["manual", "mcp"]);

export const topics = pgTable(
  "topics",
  {
    id: id(),
    userId: userId(),
    name: text("name").notNull(),
    color: text("color").notNull(),
  },
  (table) => [index("topics_user_id_idx").on(table.userId)],
).enableRLS();

export const resources = pgTable(
  "resources",
  {
    id: id(),
    userId: userId(),
    url: text("url").notNull(),
    normalizedUrl: text("normalized_url").notNull(),
    title: text("title").notNull(),
    type: resourceType("type").notNull().default("other"),
    thumbnailUrl: text("thumbnail_url"),
    status: resourceStatus("status").notNull().default("want"),
    progress: smallint("progress").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("resources_user_id_normalized_url_idx").on(
      table.userId,
      table.normalizedUrl,
    ),
    index("resources_user_id_status_idx").on(table.userId, table.status),
    check("resources_progress_range", sql`${table.progress} between 0 and 100`),
  ],
).enableRLS();

export const resourceTopics = pgTable(
  "resource_topics",
  {
    userId: userId(),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.resourceId, table.topicId] }),
    index("resource_topics_topic_id_idx").on(table.topicId),
  ],
).enableRLS();

export const notes = pgTable(
  "notes",
  {
    id: id(),
    userId: userId(),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    contentMd: text("content_md").notNull().default(""),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("notes_resource_id_idx").on(table.resourceId)],
).enableRLS();

export const cards = pgTable(
  "cards",
  {
    id: id(),
    userId: userId(),
    // Set to null when the resource is deleted, so the card survives.
    resourceId: uuid("resource_id").references(() => resources.id, {
      onDelete: "set null",
    }),
    type: cardType("type").notNull().default("qa"),
    front: text("front").notNull(),
    back: text("back").notNull(),
    extra: jsonb("extra").notNull().default({}),
    status: cardStatus("status").notNull().default("active"),
    source: cardSource("source").notNull().default("manual"),
    createdAt: createdAt(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("cards_user_id_status_idx").on(table.userId, table.status),
    index("cards_resource_id_idx").on(table.resourceId),
  ],
).enableRLS();

export const cardSchedules = pgTable(
  "card_schedules",
  {
    cardId: uuid("card_id")
      .primaryKey()
      .references(() => cards.id, { onDelete: "cascade" }),
    userId: userId(),
    due: timestamp("due", { withTimezone: true }).notNull(),
    stability: doublePrecision("stability").notNull().default(0),
    difficulty: doublePrecision("difficulty").notNull().default(0),
    learningSteps: integer("learning_steps").notNull().default(0),
    reps: integer("reps").notNull().default(0),
    lapses: integer("lapses").notNull().default(0),
    state: smallint("state").notNull().default(0),
    lastReview: timestamp("last_review", { withTimezone: true }),
  },
  (table) => [
    index("card_schedules_user_id_due_idx").on(table.userId, table.due),
  ],
).enableRLS();

export const reviews = pgTable(
  "reviews",
  {
    id: id(),
    cardId: uuid("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    userId: userId(),
    rating: smallint("rating").notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    elapsedDays: integer("elapsed_days").notNull(),
    scheduledDays: integer("scheduled_days").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    prevSchedule: jsonb("prev_schedule").notNull(),
  },
  (table) => [
    uniqueIndex("reviews_user_id_idempotency_key_idx").on(
      table.userId,
      table.idempotencyKey,
    ),
    index("reviews_card_id_idx").on(table.cardId),
    index("reviews_user_id_reviewed_at_idx").on(table.userId, table.reviewedAt),
  ],
).enableRLS();

export const userSettings = pgTable("user_settings", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  newCardsPerDay: integer("new_cards_per_day").notNull().default(20),
  timezone: text("timezone").notNull(),
  locale: text("locale").notNull(),
}).enableRLS();

export const apiTokens = pgTable(
  "api_tokens",
  {
    id: id(),
    userId: userId(),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [index("api_tokens_user_id_idx").on(table.userId)],
).enableRLS();
