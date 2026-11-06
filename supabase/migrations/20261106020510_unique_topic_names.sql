DROP INDEX "topics_user_id_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "topics_user_id_lower_name_idx" ON "topics" USING btree ("user_id",lower("name"));