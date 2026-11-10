CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"account_hash" text NOT NULL,
	"status" text NOT NULL,
	"resort_id" text NOT NULL,
	"experience_id" text NOT NULL,
	"experience_name" text NOT NULL,
	"guests" jsonb NOT NULL,
	"booking_date" date NOT NULL,
	"earliest" time NOT NULL,
	"latest" time NOT NULL,
	"encrypted_login" text,
	"login_expires_at" timestamp with time zone NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_attempt" jsonb,
	"result" jsonb,
	"failure_code" text,
	"failure_message" text,
	"push_subscription" jsonb,
	"lease_owner" text,
	"lease_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "jobs_status_lease_expires_at_index" ON "jobs" USING btree ("status","lease_expires_at");--> statement-breakpoint
CREATE INDEX "jobs_account_hash_status_index" ON "jobs" USING btree ("account_hash","status");