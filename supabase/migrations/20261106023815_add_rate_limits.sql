CREATE TABLE "rate_limits" (
	"user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rate_limits_user_id_action_pk" PRIMARY KEY("user_id","action")
);
--> statement-breakpoint
ALTER TABLE "rate_limits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rate_limits" ADD CONSTRAINT "rate_limits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;