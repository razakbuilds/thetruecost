-- TrueCost Stage 2: accounts + saved events + baseline estimates.
-- Run this AFTER the existing schema.sql and benchmark seed.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  phone text,
  role text not null default 'host' check (role in ('host', 'planner')),
  created_at timestamptz not null default now()
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  planner_id uuid references profiles(id) on delete set null,
  event_type text not null check (event_type in ('Wedding','Naming Ceremony','Burial / Memorial','Corporate Event')),
  city text not null check (city in ('Lagos','Abuja','Port Harcourt')),
  guest_count integer not null check (guest_count >= 20 and guest_count <= 2000),
  style_tier text not null check (style_tier in ('Essential','Classic','Premium')),
  created_at timestamptz not null default now()
);

create table if not exists budget_estimates (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  category text not null,
  budgeted_amount bigint not null check (budgeted_amount >= 0),
  pct_of_total numeric(5,2) not null check (pct_of_total > 0 and pct_of_total <= 100),
  created_at timestamptz not null default now()
);

create index if not exists events_user_id_idx on events(user_id);
create index if not exists budget_estimates_event_id_idx on budget_estimates(event_id);

alter table profiles enable row level security;
alter table events enable row level security;
alter table budget_estimates enable row level security;

drop policy if exists "users can read own profile" on profiles;
create policy "users can read own profile" on profiles for select using (auth.uid() = id);

drop policy if exists "users can create own profile" on profiles;
create policy "users can create own profile" on profiles for insert with check (auth.uid() = id);

drop policy if exists "users can update own profile" on profiles;
create policy "users can update own profile" on profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "users can read own events" on events;
create policy "users can read own events" on events for select using (auth.uid() = user_id);

drop policy if exists "users can create own events" on events;
create policy "users can create own events" on events for insert with check (auth.uid() = user_id);

drop policy if exists "users can update own events" on events;
create policy "users can update own events" on events for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users can delete own events" on events;
create policy "users can delete own events" on events for delete using (auth.uid() = user_id);

drop policy if exists "users can read own budget estimates" on budget_estimates;
create policy "users can read own budget estimates" on budget_estimates for select using (
  exists (select 1 from events e where e.id = event_id and e.user_id = auth.uid())
);

drop policy if exists "users can create own budget estimates" on budget_estimates;
create policy "users can create own budget estimates" on budget_estimates for insert with check (
  exists (select 1 from events e where e.id = event_id and e.user_id = auth.uid())
);

drop policy if exists "users can delete own budget estimates" on budget_estimates;
create policy "users can delete own budget estimates" on budget_estimates for delete using (
  exists (select 1 from events e where e.id = event_id and e.user_id = auth.uid())
);

-- Automatically create a host profile whenever a Supabase Auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, phone)
  values (new.id, new.email, new.phone)
  on conflict (id) do update set email = excluded.email, phone = excluded.phone;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
