DROP VIEW "reporting"."tickets";--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "finished_at" timestamp with time zone;--> statement-breakpoint
-- Written by hand (#1020): tickets finished before this column existed were
-- timed by their last change, the best record there is of when they finished.
UPDATE "tickets" SET "finished_at" = "updated_at" WHERE "status" IN ('resolved', 'closed');--> statement-breakpoint
CREATE VIEW "reporting"."tickets" AS (select
  t.ticket_number,
  t.status::text as status,
  t.priority::text as priority,
  t.queue_id,
  t.assignee_id,
  assignee.team_id,
  t.created_at,
  t.updated_at,
  t.sla_due_at as due_at,
  t.finished_at,
  (
    select min(m.created_at)
    from public.ticket_messages m
    where m.ticket_id = t.id and m.kind = 'reply'
  ) as first_reply_at
from public.tickets t
left join public.users assignee on assignee.id = t.assignee_id);