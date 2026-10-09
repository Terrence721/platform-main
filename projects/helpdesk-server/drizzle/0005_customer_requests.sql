CREATE TYPE "public"."dismiss_reason" AS ENUM('spam', 'duplicate', 'not-support');--> statement-breakpoint
CREATE TYPE "public"."request_category" AS ENUM('account', 'billing', 'bug', 'feature', 'other');--> statement-breakpoint
CREATE TYPE "public"."request_impact" AS ENUM('blocked', 'slowed', 'question');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('pending', 'ticket', 'dismissed');--> statement-breakpoint
CREATE TABLE "requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_number" integer GENERATED ALWAYS AS IDENTITY (sequence name "requests_request_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1001 CACHE 1),
	"name" varchar(100) NOT NULL,
	"email" varchar(254) NOT NULL,
	"category" "request_category" NOT NULL,
	"impact" "request_impact" NOT NULL,
	"subject" varchar(200) NOT NULL,
	"description" varchar(10000) NOT NULL,
	"where_happened" varchar(200),
	"consented_at" timestamp with time zone NOT NULL,
	"status" "request_status" DEFAULT 'pending' NOT NULL,
	"ticket_id" uuid,
	"duplicate_of_ticket_id" uuid,
	"dismiss_reason" "dismiss_reason",
	"decided_by_id" varchar(32),
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "requests_request_number_unique" UNIQUE("request_number"),
	CONSTRAINT "requests_decided_check" CHECK (("requests"."status" = 'pending') = ("requests"."decided_by_id" is null and "requests"."decided_at" is null)),
	CONSTRAINT "requests_ticket_check" CHECK (("requests"."status" = 'ticket') = ("requests"."ticket_id" is not null)),
	CONSTRAINT "requests_dismissed_check" CHECK (("requests"."status" = 'dismissed') = ("requests"."dismiss_reason" is not null))
);
--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_duplicate_of_ticket_id_tickets_id_fk" FOREIGN KEY ("duplicate_of_ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_decided_by_id_users_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "requests_status_created_idx" ON "requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "requests_email_idx" ON "requests" USING btree ("email");