CREATE VIEW "reporting"."requests" AS (select
  request_number,
  status::text as status,
  category::text as category,
  impact::text as impact,
  created_at,
  decided_at,
  dismiss_reason::text as dismiss_reason
from public.requests);