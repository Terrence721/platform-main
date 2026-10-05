CREATE SCHEMA "reporting";
--> statement-breakpoint
CREATE VIEW "reporting"."messages" AS (select t.ticket_number, m.author_id, m.kind::text as kind, m.created_at
from public.ticket_messages m
join public.tickets t on t.id = m.ticket_id);--> statement-breakpoint
CREATE VIEW "reporting"."queues" AS (select id as queue_id, name from public.queues);--> statement-breakpoint
CREATE VIEW "reporting"."teams" AS (select id as team_id, name, supervisor_id as lead_id from public.teams);--> statement-breakpoint
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
  case when t.status in ('resolved', 'closed') then t.updated_at end as finished_at,
  (
    select min(m.created_at)
    from public.ticket_messages m
    where m.ticket_id = t.id and m.kind = 'reply'
  ) as first_reply_at
from public.tickets t
left join public.users assignee on assignee.id = t.assignee_id);--> statement-breakpoint
CREATE VIEW "reporting"."users" AS (select id as user_id, name, role::text as role, team_id, active from public.users);