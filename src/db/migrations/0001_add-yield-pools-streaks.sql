CREATE TABLE "tipbot"."auto_tip_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"chat_id" text NOT NULL,
	"amount" numeric(20, 6) NOT NULL,
	"asset" text DEFAULT 'USDT' NOT NULL,
	"min_score" integer DEFAULT 70 NOT NULL,
	"category" text,
	"max_per_day" integer DEFAULT 5 NOT NULL,
	"tips_today" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tipbot"."pool_contributions" (
	"id" serial PRIMARY KEY NOT NULL,
	"pool_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"amount" numeric(20, 6) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tipbot"."tip_pools" (
	"id" serial PRIMARY KEY NOT NULL,
	"creator_id" integer NOT NULL,
	"chat_id" text NOT NULL,
	"title" text NOT NULL,
	"target_amount" numeric(20, 6) NOT NULL,
	"current_amount" numeric(20, 6) DEFAULT '0' NOT NULL,
	"asset" text DEFAULT 'USDT' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"claimed_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "tipbot"."tip_streaks" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"total_tip_days" integer DEFAULT 0 NOT NULL,
	"last_tip_date" timestamp,
	"badges" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tipbot"."yield_deposits" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"chain" text NOT NULL,
	"amount" numeric(20, 6) NOT NULL,
	"a_token_balance" numeric(20, 6) DEFAULT '0' NOT NULL,
	"tx_hash" text,
	"status" text DEFAULT 'deposited' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"withdrawn_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "tipbot"."auto_tip_rules" ADD CONSTRAINT "auto_tip_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "tipbot"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tipbot"."pool_contributions" ADD CONSTRAINT "pool_contributions_pool_id_tip_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "tipbot"."tip_pools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tipbot"."pool_contributions" ADD CONSTRAINT "pool_contributions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "tipbot"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tipbot"."tip_pools" ADD CONSTRAINT "tip_pools_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "tipbot"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tipbot"."tip_pools" ADD CONSTRAINT "tip_pools_claimed_by_users_id_fk" FOREIGN KEY ("claimed_by") REFERENCES "tipbot"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tipbot"."tip_streaks" ADD CONSTRAINT "tip_streaks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "tipbot"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tipbot"."yield_deposits" ADD CONSTRAINT "yield_deposits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "tipbot"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_autorules_chat" ON "tipbot"."auto_tip_rules" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "idx_autorules_user" ON "tipbot"."auto_tip_rules" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_pool_contribs" ON "tipbot"."pool_contributions" USING btree ("pool_id");--> statement-breakpoint
CREATE INDEX "idx_pools_chat" ON "tipbot"."tip_pools" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "idx_pools_status" ON "tipbot"."tip_pools" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_yield_user" ON "tipbot"."yield_deposits" USING btree ("user_id");