-- TrueCost Stage 3: vendor quote tracking + Pro subscription foundation.
-- Run AFTER schema.sql, seed.sql, and stage2.sql.

create table if not exists vendor_quotes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  category text not null,
  actual_amount bigint not null check (actual_amount >= 0),
  vendor_name text,
  notes text,
  logged_at timestamptz not null default now()
);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  tier text not null default 'pro' check (tier in ('pro')),
  status text not null default 'inactive' check (status in ('inactive','active','past_due','cancelled','expired')),
  renewal_date timestamptz,
  payment_provider_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists subscriptions_user_id_unique on subscriptions(user_id);
create index if not exists vendor_quotes_event_id_idx on vendor_quotes(event_id);
create index if not exists vendor_quotes_category_idx on vendor_quotes(event_id, category);

alter table vendor_quotes enable row level security;
alter table subscriptions enable row level security;

drop policy if exists "users can read own vendor quotes" on vendor_quotes;
create policy "users can read own vendor quotes" on vendor_quotes
  for select using (
    exists (select 1 from events e where e.id = event_id and e.user_id = auth.uid())
  );

drop policy if exists "users can create own vendor quotes" on vendor_quotes;
create policy "users can create own vendor quotes" on vendor_quotes
  for insert with check (
    exists (select 1 from events e where e.id = event_id and e.user_id = auth.uid())
  );

drop policy if exists "users can update own vendor quotes" on vendor_quotes;
create policy "users can update own vendor quotes" on vendor_quotes
  for update using (
    exists (select 1 from events e where e.id = event_id and e.user_id = auth.uid())
  ) with check (
    exists (select 1 from events e where e.id = event_id and e.user_id = auth.uid())
  );

drop policy if exists "users can delete own vendor quotes" on vendor_quotes;
create policy "users can delete own vendor quotes" on vendor_quotes
  for delete using (
    exists (select 1 from events e where e.id = event_id and e.user_id = auth.uid())
  );

drop policy if exists "users can read own subscription" on subscriptions;
create policy "users can read own subscription" on subscriptions
  for select using (auth.uid() = user_id);

-- Subscription writes are server-side only. Do not grant client insert/update/delete access.

create or replace function public.touch_subscription_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists subscriptions_updated_at on subscriptions;
create trigger subscriptions_updated_at
before update on subscriptions
for each row execute procedure public.touch_subscription_updated_at();
