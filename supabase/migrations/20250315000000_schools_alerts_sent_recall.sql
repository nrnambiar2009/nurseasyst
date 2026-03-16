-- Schools: required for check-expiry to send to nurse_email and principal_email
create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  nurse_email text,
  principal_email text,
  created_at timestamptz default now()
);

-- Record each alert email sent so we don't resend the same (school_id, item_id, alert_type)
create table if not exists public.alerts_sent (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  item_id uuid not null,
  alert_type text not null,
  sent_at timestamptz not null default now(),
  constraint alerts_sent_school_item_type_unique unique (school_id, item_id, alert_type)
);

-- Recall alerts: populated by your recall-check process; check-expiry sends email and records in alerts_sent
create table if not exists public.recall_alerts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  product_name text not null default '',
  lot_number text default '',
  created_at timestamptz default now()
);

comment on table public.alerts_sent is 'Tracks sent expiry/recall emails to avoid duplicate sends';
comment on table public.recall_alerts is 'Pending FDA recall alerts; check-expiry sends email and records in alerts_sent';
