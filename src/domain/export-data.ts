import { eq, getTableColumns } from "drizzle-orm";
import {
  apiTokens,
  cardSchedules,
  cards,
  notes,
  rateLimits,
  resources,
  resourceTopics,
  reviews,
  topics,
  userSettings,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";

const EXPORT_VERSION = 1;

/** Every column except `user_id`, which is the same on every row. */
function exportedColumns<Columns extends { userId: unknown }>(
  columns: Columns,
) {
  const { userId, ...exported } = columns;
  void userId;
  return exported;
}

/** The hash is a credential, so it must never leave the database. */
function tokenColumns() {
  const { tokenHash, ...columns } = exportedColumns(getTableColumns(apiTokens));
  void tokenHash;
  return columns;
}

/** All of the user's data, including soft deleted cards and their reviews. */
export async function exportUserData(db: Db, userId: string, now: Date) {
  const [
    topicRows,
    resourceRows,
    resourceTopicRows,
    noteRows,
    cardRows,
    cardScheduleRows,
    reviewRows,
    settingsRows,
    apiTokenRows,
    rateLimitRows,
  ] = await Promise.all([
    db
      .select(exportedColumns(getTableColumns(topics)))
      .from(topics)
      .where(eq(topics.userId, userId)),
    db
      .select(exportedColumns(getTableColumns(resources)))
      .from(resources)
      .where(eq(resources.userId, userId)),
    db
      .select(exportedColumns(getTableColumns(resourceTopics)))
      .from(resourceTopics)
      .where(eq(resourceTopics.userId, userId)),
    db
      .select(exportedColumns(getTableColumns(notes)))
      .from(notes)
      .where(eq(notes.userId, userId)),
    db
      .select(exportedColumns(getTableColumns(cards)))
      .from(cards)
      .where(eq(cards.userId, userId)),
    db
      .select(exportedColumns(getTableColumns(cardSchedules)))
      .from(cardSchedules)
      .where(eq(cardSchedules.userId, userId)),
    db
      .select(exportedColumns(getTableColumns(reviews)))
      .from(reviews)
      .where(eq(reviews.userId, userId)),
    db
      .select(exportedColumns(getTableColumns(userSettings)))
      .from(userSettings)
      .where(eq(userSettings.userId, userId)),
    db
      .select(tokenColumns())
      .from(apiTokens)
      .where(eq(apiTokens.userId, userId)),
    db
      .select(exportedColumns(getTableColumns(rateLimits)))
      .from(rateLimits)
      .where(eq(rateLimits.userId, userId)),
  ]);

  return {
    version: EXPORT_VERSION,
    exportedAt: now.toISOString(),
    topics: topicRows,
    resources: resourceRows,
    resource_topics: resourceTopicRows,
    notes: noteRows,
    cards: cardRows,
    card_schedules: cardScheduleRows,
    reviews: reviewRows,
    user_settings: settingsRows,
    api_tokens: apiTokenRows,
    rate_limits: rateLimitRows,
  };
}
