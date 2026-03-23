CREATE TABLE "tipbot"."contribution_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"chat_id" text NOT NULL,
	"user_id" integer NOT NULL,
	"message_text" text NOT NULL,
	"score" integer NOT NULL,
	"category" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tipbot"."daily_digests" (
	"id" serial PRIMARY KEY NOT NULL,
	"chat_id" text NOT NULL,
	"platform" text NOT NULL,
	"content" text NOT NULL,
	"tip_count" integer DEFAULT 0 NOT NULL,
	"total_volume" numeric(20, 6) DEFAULT '0' NOT NULL,
	"date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tipbot"."rate_limits" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"window_start" timestamp DEFAULT now() NOT NULL,
	"tip_count" integer DEFAULT 0 NOT NULL,
	"total_amount" numeric(20, 6) DEFAULT '0' NOT NULL,
	"daily_start" timestamp DEFAULT now() NOT NULL,
	"daily_amount" numeric(20, 6) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tipbot"."tips" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender_id" integer NOT NULL,
	"receiver_id" integer NOT NULL,
	"amount" numeric(20, 6) NOT NULL,
	"asset" text NOT NULL,
	"chain" text NOT NULL,
	"tx_hash" text,
	"gas_cost_usd" numeric(10, 6),
	"status" text DEFAULT 'pending' NOT NULL,
	"ai_suggested" boolean DEFAULT false NOT NULL,
	"message_context" text,
	"chat_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tipbot"."users" (
	"id" serial PRIMARY KEY NOT NULL,
	"platform" text NOT NULL,
	"platform_id" text NOT NULL,
	"username" text NOT NULL,
	"encrypted_seed" text NOT NULL,
	"seed_iv" text NOT NULL,
	"seed_auth_tag" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_banned" boolean DEFAULT false NOT NULL,
	CONSTRAINT "uniq_platform_user" UNIQUE("platform","platform_id")
);
--> statement-breakpoint
CREATE TABLE "tipbot"."wallet_addresses" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"chain" text NOT NULL,
	"address" text NOT NULL,
	"is_deployed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "uniq_user_chain" UNIQUE("user_id","chain")
);
--> statement-breakpoint
ALTER TABLE "tipbot"."contribution_scores" ADD CONSTRAINT "contribution_scores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "tipbot"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tipbot"."rate_limits" ADD CONSTRAINT "rate_limits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "tipbot"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tipbot"."tips" ADD CONSTRAINT "tips_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "tipbot"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tipbot"."tips" ADD CONSTRAINT "tips_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "tipbot"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tipbot"."wallet_addresses" ADD CONSTRAINT "wallet_addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "tipbot"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_scores_chat" ON "tipbot"."contribution_scores" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "idx_scores_user" ON "tipbot"."contribution_scores" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_digests_chat_date" ON "tipbot"."daily_digests" USING btree ("chat_id","date");--> statement-breakpoint
CREATE INDEX "idx_tips_sender" ON "tipbot"."tips" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "idx_tips_receiver" ON "tipbot"."tips" USING btree ("receiver_id");--> statement-breakpoint
CREATE INDEX "idx_tips_chat" ON "tipbot"."tips" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "idx_tips_created" ON "tipbot"."tips" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_users_platform" ON "tipbot"."users" USING btree ("platform","platform_id");