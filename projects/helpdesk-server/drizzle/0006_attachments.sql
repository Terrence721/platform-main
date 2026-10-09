CREATE TYPE "public"."attachment_media_type" AS ENUM('image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/plain');--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"file_name" varchar(200) NOT NULL,
	"media_type" "attachment_media_type" NOT NULL,
	"size" integer NOT NULL,
	"content" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attachments_size_check" CHECK ("attachments"."size" = octet_length("attachments"."content") and "attachments"."size" between 1 and 5242880),
	CONSTRAINT "attachments_file_name_check" CHECK ("attachments"."file_name" <> '')
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attachments_request_created_idx" ON "attachments" USING btree ("request_id","created_at");