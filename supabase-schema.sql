-- Run this in Supabase SQL Editor to create the inventory_items table.

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  product_type text not null,
  product_name text not null,
  gtin text default '',
  lot_number text default '',
  expiry_date date not null,
  quantity integer not null default 1,
  created_at timestamptz default now()
);

-- Optional: enable RLS and add policy for anon (adjust for your auth later)
-- alter table public.inventory_items enable row level security;
-- create policy "Allow anon read/write for now" on public.inventory_items for all using (true) with check (true);
