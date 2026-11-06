import { sql } from "drizzle-orm";
import {
  check,
  doublePrecision,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authUsers } from "drizzle-orm/supabase";

// Every table has RLS on with no policies. That closes Supabase's public API;
// the app reaches data only through `src/domain`, which requires a userId.
//
// Links between a user's rows are composite foreign keys on (id, user_id), so
// the database refuses a row that points at another user's data, even if a
// domain function forgets to check ownership.

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
  (table) => [
    unique("topics_id_user_id_unique").on(table.id, table.userId),
    uniqueIndex("topics_user_id_lower_name_idx").on(
      table.userId,
      sql`lower(${table.name})`,
    ),
  ],
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
    unique("resources_id_user_id_unique").on(table.id, table.userId),
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
    resourceId: uuid("resource_id").notNull(),
    topicId: uuid("topic_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.resourceId, table.topicId] }),
    foreignKey({
      name: "resource_topics_resource_fk",
      columns: [table.resourceId, table.userId],
      foreignColumns: [resources.id, resources.userId],
    }).onDelete("cascade"),
    foreignKey({
      name: "resource_topics_topic_fk",
      columns: [table.topicId, table.userId],
      foreignColumns: [topics.id, topics.userId],
    }).onDelete("cascade"),
    index("resource_topics_resource_id_idx").on(table.resourceId),
    index("resource_topics_topic_id_idx").on(table.topicId),
  ],
).enableRLS();

export const notes = pgTable(
  "notes",
  {
    id: id(),
    userId: userId(),
    resourceId: uuid("resource_id").notNull(),
    contentMd: text("content_md").notNull().default(""),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    foreignKey({
      name: "notes_resource_fk",
      columns: [table.resourceId, table.userId],
      foreignColumns: [resources.id, resources.userId],
    }).onDelete("cascade"),
    index("notes_resource_id_idx").on(table.resourceId),
  ],
).enableRLS();

export const cards = pgTable(
  "cards",
  {
    id: id(),
    userId: userId(),
    resourceId: uuid("resource_id"),
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
    unique("cards_id_user_id_unique").on(table.id, table.userId),
    // The migration narrows this by hand to ON DELETE SET NULL ("resource_id"),
    // which Drizzle can't express. A plain SET NULL would also clear the
    // NOT NULL user_id. Keep that edit if this key is ever regenerated.
    foreignKey({
      name: "cards_resource_fk",
      columns: [table.resourceId, table.userId],
      foreignColumns: [resources.id, resources.userId],
    }).onDelete("set null"),
    index("cards_user_id_status_idx").on(table.userId, table.status),
    index("cards_resource_id_idx").on(table.resourceId),
  ],
).enableRLS();

export const cardSchedules = pgTable(
  "card_schedules",
  {
    cardId: uuid("card_id").primaryKey(),
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
    foreignKey({
      name: "card_schedules_card_fk",
      columns: [table.cardId, table.userId],
      foreignColumns: [cards.id, cards.userId],
    }).onDelete("cascade"),
    index("card_schedules_user_id_due_idx").on(table.userId, table.due),
  ],
).enableRLS();

export const reviews = pgTable(
  "reviews",
  {
    id: id(),
    cardId: uuid("card_id").notNull(),
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
    foreignKey({
      name: "reviews_card_fk",
      columns: [table.cardId, table.userId],
      foreignColumns: [cards.id, cards.userId],
    }).onDelete("cascade"),
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

export const rateLimits = pgTable(
  "rate_limits",
  {
    userId: userId(),
    action: text("action").notNull(),
    count: integer("count").notNull().default(1),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.action] })],
).enableRLS();
