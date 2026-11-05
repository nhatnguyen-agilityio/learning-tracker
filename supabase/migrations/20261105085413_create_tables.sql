CREATE TYPE "public"."card_source" AS ENUM('manual', 'mcp');--> statement-breakpoint
CREATE TYPE "public"."card_status" AS ENUM('pending', 'active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."card_type" AS ENUM('qa');--> statement-breakpoint
CREATE TYPE "public"."resource_status" AS ENUM('want', 'learning', 'done');--> statement-breakpoint
CREATE TYPE "public"."resource_type" AS ENUM('article', 'video', 'course', 'doc', 'other');--> statement-breakpoint
CREATE TABLE "api_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "api_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "api_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "card_schedules" (
	"card_id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"due" timestamp with time zone NOT NULL,
	"stability" double precision DEFAULT 0 NOT NULL,
	"difficulty" double precision DEFAULT 0 NOT NULL,
	"learning_steps" integer DEFAULT 0 NOT NULL,
	"reps" integer DEFAULT 0 NOT NULL,
	"lapses" integer DEFAULT 0 NOT NULL,
	"state" smallint DEFAULT 0 NOT NULL,
	"last_review" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "card_schedules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"resource_id" uuid,
	"type" "card_type" DEFAULT 'qa' NOT NULL,
	"front" text NOT NULL,
	"back" text NOT NULL,
	"extra" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "card_status" DEFAULT 'active' NOT NULL,
	"source" "card_source" DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "cards_id_user_id_unique" UNIQUE("id","user_id")
);
--> statement-breakpoint
ALTER TABLE "cards" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"content_md" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "resource_topics" (
	"user_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	CONSTRAINT "resource_topics_user_id_resource_id_topic_id_pk" PRIMARY KEY("user_id","resource_id","topic_id")
);
--> statement-breakpoint
ALTER TABLE "resource_topics" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"url" text NOT NULL,
	"normalized_url" text NOT NULL,
	"title" text NOT NULL,
	"type" "resource_type" DEFAULT 'other' NOT NULL,
	"thumbnail_url" text,
	"status" "resource_status" DEFAULT 'want' NOT NULL,
	"progress" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resources_id_user_id_unique" UNIQUE("id","user_id"),
	CONSTRAINT "resources_progress_range" CHECK ("resources"."progress" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "resources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"elapsed_days" integer NOT NULL,
	"scheduled_days" integer NOT NULL,
	"idempotency_key" text NOT NULL,
	"prev_schedule" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	CONSTRAINT "topics_id_user_id_unique" UNIQUE("id","user_id")
);
--> statement-breakpoint
ALTER TABLE "topics" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"new_cards_per_day" integer DEFAULT 20 NOT NULL,
	"timezone" text NOT NULL,
	"locale" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_schedules" ADD CONSTRAINT "card_schedules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_schedules" ADD CONSTRAINT "card_schedules_card_fk" FOREIGN KEY ("card_id","user_id") REFERENCES "public"."cards"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_resource_fk" FOREIGN KEY ("resource_id","user_id") REFERENCES "public"."resources"("id","user_id") ON DELETE SET NULL ("resource_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_resource_fk" FOREIGN KEY ("resource_id","user_id") REFERENCES "public"."resources"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_topics" ADD CONSTRAINT "resource_topics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_topics" ADD CONSTRAINT "resource_topics_resource_fk" FOREIGN KEY ("resource_id","user_id") REFERENCES "public"."resources"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_topics" ADD CONSTRAINT "resource_topics_topic_fk" FOREIGN KEY ("topic_id","user_id") REFERENCES "public"."topics"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_card_fk" FOREIGN KEY ("card_id","user_id") REFERENCES "public"."cards"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_tokens_user_id_idx" ON "api_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "card_schedules_user_id_due_idx" ON "card_schedules" USING btree ("user_id","due");--> statement-breakpoint
CREATE INDEX "cards_user_id_status_idx" ON "cards" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "cards_resource_id_idx" ON "cards" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "notes_resource_id_idx" ON "notes" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "resource_topics_resource_id_idx" ON "resource_topics" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "resource_topics_topic_id_idx" ON "resource_topics" USING btree ("topic_id");--> statement-breakpoint
CREATE UNIQUE INDEX "resources_user_id_normalized_url_idx" ON "resources" USING btree ("user_id","normalized_url");--> statement-breakpoint
CREATE INDEX "resources_user_id_status_idx" ON "resources" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_user_id_idempotency_key_idx" ON "reviews" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "reviews_card_id_idx" ON "reviews" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX "reviews_user_id_reviewed_at_idx" ON "reviews" USING btree ("user_id","reviewed_at");--> statement-breakpoint
CREATE INDEX "topics_user_id_idx" ON "topics" USING btree ("user_id");