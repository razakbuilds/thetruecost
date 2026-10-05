-- TrueCost Chunk 1 — v2.1 Database Foundation
-- Target: existing Stage 2/3 Supabase database.
-- Run preflight.sql first.
--
-- Compatibility strategy:
-- * Existing Stage 3 vendor_quotes is preserved.
-- * New canonical host/planner quote table: logged_quotes.
-- * New vendor-submitted quote table: vendor_quotes_v21 (temporary name until
--   Chunk 5 migrates the application and the legacy table can be retired).
-- * Existing money columns are preserved; new canonical money columns use kobo.
--
-- Money assumption: current Stage 2/3 values are whole NGN integers. The
-- migration converts them to kobo with * 100. Verify with preflight.sql first.

begin;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helper functions used by RLS
-- ---------------------------------------------------------------------------

create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('host','planner','vendor','admin')),
  admin_subrole text,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create or replace function public.has_role(target_user_id uuid, required_role text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = target_user_id and role = required_role
  );
$$;

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------

alter table if exists public.profiles
  add column if not exists full_name text,
  add column if not exists avatar_url text,
  add column if not exists status text not null default 'active';

alter table if exists public.profiles drop constraint if exists profiles_role_check;
alter table if exists public.profiles drop constraint if exists profiles_role_legacy_check;
alter table if exists public.profiles
  add constraint profiles_role_legacy_check
  check (role in ('host','planner','vendor','admin'));

insert into public.user_roles (user_id, role)
select p.id, case when p.role in ('host','planner','vendor','admin') then p.role else 'host' end
from public.profiles p
on conflict (user_id, role) do nothing;

create index if not exists user_roles_role_idx on public.user_roles(role);

create table if not exists public.host_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.planner_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  business_name text not null,
  logo_url text,
  brand_colors jsonb,
  description text,
  phone text,
  email text,
  website text,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified','pending','verified','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists planner_profiles_owner_uidx on public.planner_profiles(owner_user_id);

create table if not exists public.vendor_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  business_name text not null,
  slug text not null,
  description text,
  primary_category text,
  verification_status text not null default 'pending'
    check (verification_status in ('pending','under_review','verified','rejected','suspended')),
  phone text,
  email text,
  website text,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists vendor_profiles_owner_uidx on public.vendor_profiles(owner_user_id);
create unique index if not exists vendor_profiles_slug_uidx on public.vendor_profiles(slug);

create table if not exists public.vendor_services (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendor_profiles(id) on delete cascade,
  category_code text not null,
  price_band_min_kobo bigint check (price_band_min_kobo is null or price_band_min_kobo >= 0),
  price_band_max_kobo bigint check (price_band_max_kobo is null or price_band_max_kobo >= 0),
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (price_band_min_kobo is null or price_band_max_kobo is null or price_band_min_kobo <= price_band_max_kobo)
);
create index if not exists vendor_services_vendor_idx on public.vendor_services(vendor_id);
create index if not exists vendor_services_category_idx on public.vendor_services(category_code);

create table if not exists public.vendor_service_areas (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendor_profiles(id) on delete cascade,
  city text not null,
  state text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (vendor_id, city)
);
create index if not exists vendor_service_areas_city_idx on public.vendor_service_areas(city);

create table if not exists public.vendor_verifications (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendor_profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','under_review','verified','rejected','suspended')),
  document_refs jsonb not null default '[]'::jsonb,
  reviewer_id uuid references auth.users(id) on delete set null,
  notes text,
  submitted_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null,
  vendor_id uuid not null references public.vendor_profiles(id) on delete cascade,
  host_user_id uuid not null references auth.users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  body text,
  vendor_response text,
  status text not null default 'published'
    check (status in ('pending','published','reported','hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (engagement_id)
);

create table if not exists public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_type text not null,
  version text not null,
  granted_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  unique (user_id, consent_type, version)
);

-- ---------------------------------------------------------------------------
-- Estimates / events
-- ---------------------------------------------------------------------------

create table if not exists public.anonymous_estimates (
  id uuid primary key default gen_random_uuid(),
  session_token_hash text not null,
  inputs jsonb not null,
  result_snapshot jsonb not null,
  benchmark_version text,
  expires_at timestamptz not null default (now() + interval '30 days'),
  claimed_by_user_id uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists anonymous_estimates_session_idx on public.anonymous_estimates(session_token_hash);

alter table if exists public.events
  add column if not exists host_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists created_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists event_date date,
  add column if not exists status text not null default 'active';

update public.events
set host_user_id = coalesce(host_user_id, user_id)
where host_user_id is null;

update public.events
set created_by_user_id = coalesce(created_by_user_id, user_id, host_user_id)
where created_by_user_id is null;

alter table if exists public.events drop constraint if exists events_status_v21_check;
alter table if exists public.events
  add constraint events_status_v21_check
  check (status in ('draft','active','completed','cancelled','archived'));

create index if not exists events_host_user_id_idx on public.events(host_user_id);

create table if not exists public.event_members (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  member_role text not null check (member_role in ('owner','editor','collaborator','viewer')),
  planner_id uuid references public.planner_profiles(id) on delete set null,
  can_fund boolean not null default false,
  can_release boolean not null default false,
  invited_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);
create index if not exists event_members_user_idx on public.event_members(user_id);
create index if not exists event_members_event_idx on public.event_members(event_id);

create or replace function public.is_event_member(target_event_id uuid, target_user_id uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.event_members
    where event_id = target_event_id and user_id = target_user_id and accepted_at is not null
  );
$$;

create or replace function public.can_view_event(target_event_id uuid, target_user_id uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.events e
    where e.id = target_event_id
      and (e.host_user_id = target_user_id or public.is_event_member(e.id, target_user_id))
  );
$$;

create or replace function public.can_edit_event(target_event_id uuid, target_user_id uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.events e
    where e.id = target_event_id and e.host_user_id = target_user_id
  )
  or exists (
    select 1 from public.event_members em
    where em.event_id = target_event_id and em.user_id = target_user_id
      and em.accepted_at is not null and em.member_role in ('owner','editor')
  );
$$;

create table if not exists public.host_planner_relationships (
  id uuid primary key default gen_random_uuid(),
  host_user_id uuid not null references auth.users(id) on delete cascade,
  planner_id uuid not null references public.planner_profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','ended')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  ended_at timestamptz,
  unique (host_user_id, planner_id)
);

create table if not exists public.event_categories (
  code text primary key,
  event_type text not null,
  name text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  unique (event_type, name)
);

insert into public.event_categories(code,event_type,name,sort_order) values
('venue','Wedding','Venue',10),('food_drinks','Wedding','Food & Drinks',20),
('decor_florals','Wedding','Decor & Florals',30),('photography_video','Wedding','Photography & Video',40),
('entertainment','Wedding','Entertainment',50),('attire_aso_ebi','Wedding','Attire & Aso-Ebi',60),
('makeup_beauty','Wedding','Makeup & Beauty',70),('cake_desserts','Wedding','Cake & Desserts',80),
('stationery','Wedding','Stationery & Invitations',90),('souvenirs','Wedding','Souvenirs',100),
('transport_logistics','Wedding','Transport & Logistics',110),('security','Wedding','Security',120),
('power','Wedding','Power',130),('traditional_items','Wedding','Traditional Ceremony Items',140),
('contingency','Wedding','Contingency',150),
('venue_canopy_seating','Burial / Memorial','Venue, Canopy & Seating',10),('food_drinks_bm','Burial / Memorial','Food & Drinks',20),
('mortuary_casket','Burial / Memorial','Mortuary & Casket',30),('programme_printing','Burial / Memorial','Programme & Printing',40),
('music_entertainment','Burial / Memorial','Music & Entertainment',50),('photography_video_bm','Burial / Memorial','Photography & Video',60),
('transport_bm','Burial / Memorial','Transport',70),('announcements_media','Burial / Memorial','Announcements & Media',80),
('religious_service','Burial / Memorial','Religious Service Costs',90),('security_power_bm','Burial / Memorial','Security & Power',100),
('contingency_bm','Burial / Memorial','Contingency',110),
('venue_nm','Naming Ceremony','Venue',10),('food_drinks_nm','Naming Ceremony','Food & Drinks',20),
('decor_nm','Naming Ceremony','Decor',30),('cake_nm','Naming Ceremony','Cake',40),('photography_nm','Naming Ceremony','Photography',50),
('entertainment_nm','Naming Ceremony','Entertainment',60),('souvenirs_nm','Naming Ceremony','Souvenirs',70),
('attire_nm','Naming Ceremony','Attire',80),('security_power_nm','Naming Ceremony','Security & Power',90),
('contingency_nm','Naming Ceremony','Contingency',100),
('venue_ce','Corporate Event','Venue',10),('av_production','Corporate Event','AV & Production',20),
('food_drinks_ce','Corporate Event','Food & Drinks',30),('branding_print','Corporate Event','Branding & Print',40),
('speakers_talent','Corporate Event','Speakers & Talent',50),('transport_ce','Corporate Event','Transport',60),
('staffing','Corporate Event','Staffing',70),('security_ce','Corporate Event','Security',80),('power_ce','Corporate Event','Power',90),
('contingency_ce','Corporate Event','Contingency',100),
('venue_party','Party','Venue',10),('food_drinks_party','Party','Food & Drinks',20),('dj_entertainment','Party','DJ & Entertainment',30),
('decor_party','Party','Decor',40),('cake_party','Party','Cake',50),('photography_party','Party','Photography',60),
('security_party','Party','Security',70),('power_party','Party','Power',80),('contingency_party','Party','Contingency',90)
on conflict (code) do update set event_type=excluded.event_type,name=excluded.name,sort_order=excluded.sort_order,active=true;

alter table if exists public.budget_estimates
  add column if not exists category_code text,
  add column if not exists budgeted_amount_kobo bigint,
  add column if not exists benchmark_version text,
  add column if not exists benchmark_sample_size integer,
  add column if not exists confidence text;

update public.budget_estimates
set category_code = lower(regexp_replace(trim(category),'[^a-zA-Z0-9]+','_','g'))
where category_code is null;

update public.budget_estimates
set budgeted_amount_kobo = budgeted_amount * 100
where budgeted_amount_kobo is null and budgeted_amount is not null;

create index if not exists budget_estimates_event_category_idx on public.budget_estimates(event_id,category_code);

create table if not exists public.logged_quotes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  category_code text not null,
  amount_kobo bigint not null check (amount_kobo >= 0),
  vendor_id uuid references public.vendor_profiles(id) on delete set null,
  vendor_name_text text,
  vendor_quote_id uuid,
  notes text,
  source text not null default 'manual' check (source in ('manual','imported','planner','vendor_quote')),
  logged_by uuid not null references auth.users(id) on delete restrict,
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists logged_quotes_event_idx on public.logged_quotes(event_id);
create index if not exists logged_quotes_event_category_idx on public.logged_quotes(event_id,category_code);

insert into public.logged_quotes(event_id,category_code,amount_kobo,vendor_name_text,notes,source,logged_by,logged_at)
select vq.event_id,
       lower(regexp_replace(trim(vq.category),'[^a-zA-Z0-9]+','_','g')),
       vq.actual_amount * 100,
       vq.vendor_name,
       vq.notes,
       'manual',
       e.host_user_id,
       coalesce(vq.logged_at,now())
from public.vendor_quotes vq
join public.events e on e.id=vq.event_id
where not exists (
  select 1 from public.logged_quotes lq
  where lq.event_id=vq.event_id
    and lq.amount_kobo=vq.actual_amount*100
    and lq.logged_at=coalesce(vq.logged_at,now())
    and lq.category_code=lower(regexp_replace(trim(vq.category),'[^a-zA-Z0-9]+','_','g'))
);

-- ---------------------------------------------------------------------------
-- Marketplace / engagements
-- ---------------------------------------------------------------------------

create table if not exists public.vendor_listings (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendor_profiles(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft','pending','published','suspended','archived')),
  headline text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vendor_placements (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendor_profiles(id) on delete cascade,
  listing_id uuid not null references public.vendor_listings(id) on delete cascade,
  category_code text not null,
  city text not null,
  placement_tier text not null check (placement_tier in ('standard','featured')),
  status text not null default 'pending' check (status in ('pending','active','expired','cancelled')),
  starts_at timestamptz,
  ends_at timestamptz,
  subscription_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vendor_placements_lookup_idx on public.vendor_placements(city,category_code,placement_tier,status);

create table if not exists public.vendor_inquiries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  host_user_id uuid not null references auth.users(id) on delete restrict,
  vendor_id uuid not null references public.vendor_profiles(id) on delete restrict,
  category_code text not null,
  message text not null,
  requested_date date,
  target_budget_kobo bigint,
  status text not null default 'open' check (status in ('open','responded','quoted','accepted','declined','expired','cancelled')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (target_budget_kobo is null or target_budget_kobo >= 0)
);

create table if not exists public.vendor_quotes_v21 (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.vendor_inquiries(id) on delete cascade,
  vendor_id uuid not null references public.vendor_profiles(id) on delete restrict,
  version integer not null default 1 check (version > 0),
  parent_quote_id uuid references public.vendor_quotes_v21(id) on delete set null,
  amount_kobo bigint not null check (amount_kobo >= 0),
  scope text not null,
  inclusions text,
  exclusions text,
  valid_until date,
  status text not null default 'draft' check (status in ('draft','submitted','countered','accepted','declined','expired','withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (inquiry_id,version)
);

create table if not exists public.engagements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  host_user_id uuid not null references auth.users(id) on delete restrict,
  vendor_id uuid not null references public.vendor_profiles(id) on delete restrict,
  inquiry_id uuid references public.vendor_inquiries(id) on delete set null,
  accepted_quote_id uuid references public.vendor_quotes_v21(id) on delete restrict,
  planner_user_id uuid references auth.users(id) on delete set null,
  category_code text not null,
  title text not null,
  scope text not null,
  agreed_amount_kobo bigint not null check (agreed_amount_kobo >= 0),
  currency text not null default 'NGN',
  status text not null default 'draft' check (status in ('draft','requested','accepted','awaiting_funding','funded','in_progress','delivered','completed','disputed','cancelled','declined','expired','refunded','partially_refunded')),
  delivery_date date,
  cancellation_terms jsonb not null default '{}'::jsonb,
  fee_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists engagements_host_status_idx on public.engagements(host_user_id,status);
create index if not exists engagements_vendor_status_idx on public.engagements(vendor_id,status);

create table if not exists public.engagement_milestones (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements(id) on delete cascade,
  title text not null,
  amount_kobo bigint not null check (amount_kobo >= 0),
  due_date date,
  status text not null default 'pending' check (status in ('pending','funded','in_progress','delivered','approved','released','disputed','refunded','cancelled')),
  deliverable_ref text,
  delivered_at timestamptz,
  approved_at timestamptz,
  auto_release_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Money / billing / escrow / disputes
-- ---------------------------------------------------------------------------

create table if not exists public.fee_configs (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  fee_model text not null check (fee_model in ('percentage','flat','split','waived')),
  rate_bps integer,
  flat_kobo bigint,
  min_kobo bigint,
  cap_kobo bigint,
  payer text not null check (payer in ('host','vendor','split','platform')),
  split_ratio jsonb,
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.escrow_transactions (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements(id) on delete restrict,
  milestone_id uuid references public.engagement_milestones(id) on delete restrict,
  provider text not null,
  provider_transaction_ref text,
  gross_amount_kobo bigint not null check (gross_amount_kobo >= 0),
  platform_fee_kobo bigint not null default 0 check (platform_fee_kobo >= 0),
  provider_fee_kobo bigint not null default 0 check (provider_fee_kobo >= 0),
  vat_kobo bigint not null default 0 check (vat_kobo >= 0),
  vendor_net_kobo bigint not null default 0 check (vendor_net_kobo >= 0),
  status text not null default 'pending_funding' check (status in ('pending_funding','funded','release_pending','released','partially_released','frozen','refund_pending','refunded','partially_refunded','failed','expired')),
  funded_at timestamptz,
  released_at timestamptz,
  refunded_at timestamptz,
  frozen_at timestamptz,
  auto_release_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payout_records (
  id uuid primary key default gen_random_uuid(),
  escrow_transaction_id uuid not null references public.escrow_transactions(id) on delete restrict,
  vendor_id uuid not null references public.vendor_profiles(id) on delete restrict,
  gross_kobo bigint not null check (gross_kobo >= 0),
  platform_fee_kobo bigint not null default 0 check (platform_fee_kobo >= 0),
  provider_fee_kobo bigint not null default 0 check (provider_fee_kobo >= 0),
  vendor_net_kobo bigint not null check (vendor_net_kobo >= 0),
  payout_ref text,
  payout_date timestamptz,
  status text not null default 'pending' check (status in ('pending','processing','paid','failed','reversed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  provider text not null default 'paystack',
  provider_reference text not null,
  transaction_type text not null check (transaction_type in ('subscription_initial','subscription_renewal','subscription_manual','one_off','escrow_funding_fee','refund')),
  amount_kobo bigint not null check (amount_kobo >= 0),
  currency text not null default 'NGN',
  status text not null default 'pending' check (status in ('pending','success','failed','refunded','partially_refunded')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider,provider_reference)
);

create table if not exists public.financial_events (
  id uuid primary key default gen_random_uuid(),
  escrow_transaction_id uuid references public.escrow_transactions(id) on delete restrict,
  payment_transaction_id uuid references public.payment_transactions(id) on delete restrict,
  provider text not null,
  provider_event_id text,
  event_type text not null,
  amount_kobo bigint,
  status_from text,
  status_to text,
  payload_hash text,
  payload_ref text,
  created_at timestamptz not null default now()
);
create unique index if not exists financial_events_provider_event_uidx on public.financial_events(provider,provider_event_id) where provider_event_id is not null;

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  signature_valid boolean not null default false,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  status text not null default 'received' check (status in ('received','processing','processed','failed','ignored')),
  payload_ref text,
  unique (provider,provider_event_id)
);

create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements(id) on delete restrict,
  escrow_transaction_id uuid references public.escrow_transactions(id) on delete restrict,
  opened_by_user_id uuid not null references auth.users(id) on delete restrict,
  reason text not null,
  description text not null,
  amount_in_dispute_kobo bigint not null check (amount_in_dispute_kobo >= 0),
  status text not null default 'opened' check (status in ('opened','awaiting_evidence','under_review','resolved','withdrawn')),
  resolution_type text check (resolution_type is null or resolution_type in ('full_release','partial_release','full_refund','partial_refund','split')),
  resolution_notes text,
  resolved_by_user_id uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dispute_evidence (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes(id) on delete cascade,
  submitted_by_user_id uuid not null references auth.users(id) on delete restrict,
  file_ref text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  requested_by uuid not null references auth.users(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  product_tier text not null,
  billing_interval text not null check (billing_interval in ('monthly','yearly','one_off')),
  amount_kobo bigint not null check (amount_kobo >= 0),
  currency text not null default 'NGN',
  paystack_plan_code text,
  active boolean not null default false,
  feature_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.subscriptions
  add column if not exists plan_id uuid references public.subscription_plans(id) on delete set null,
  add column if not exists provider text not null default 'paystack',
  add column if not exists provider_customer_id text,
  add column if not exists provider_subscription_id text,
  add column if not exists provider_plan_code text,
  add column if not exists start_date timestamptz;

alter table if exists public.subscriptions drop constraint if exists subscriptions_tier_check;
alter table if exists public.subscriptions drop constraint if exists subscriptions_tier_v21_check;
alter table if exists public.subscriptions
  add constraint subscriptions_tier_v21_check
  check (tier in ('pro','planner','vendor_premium','placement_standard','placement_featured'));

alter table if exists public.subscriptions drop constraint if exists subscriptions_status_check;
alter table if exists public.subscriptions drop constraint if exists subscriptions_status_v21_check;
alter table if exists public.subscriptions
  add constraint subscriptions_status_v21_check
  check (status in ('inactive','incomplete','active','past_due','non_renewing','cancelled','expired'));

alter table if exists public.subscriptions drop constraint if exists subscriptions_user_id_key;
create unique index if not exists subscriptions_provider_subscription_uidx
  on public.subscriptions(provider,provider_subscription_id)
  where provider_subscription_id is not null;

-- ---------------------------------------------------------------------------
-- Benchmarks / communication / audit
-- ---------------------------------------------------------------------------

create table if not exists public.benchmark_observations (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  city text not null,
  guest_band text not null,
  style_tier text not null,
  category_code text not null,
  amount_kobo bigint not null check (amount_kobo >= 0),
  source_type text not null check (source_type in ('seed_research','planner_submitted','host_logged','verified_transaction')),
  verified boolean not null default false,
  weight numeric(10,4) not null default 1.0 check (weight >= 0),
  outlier_flag boolean not null default false,
  source_ref text,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.benchmark_data (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  city text not null,
  guest_band text not null,
  style_tier text not null,
  category_code text not null,
  min_amount_kobo bigint,
  p25_amount_kobo bigint,
  median_amount_kobo bigint,
  p75_amount_kobo bigint,
  max_amount_kobo bigint,
  pct_of_total numeric(7,4),
  sample_size integer not null default 0 check (sample_size >= 0),
  confidence text not null default 'limited' check (confidence in ('high','medium','limited')),
  source_mix jsonb not null default '{}'::jsonb,
  benchmark_version text not null,
  status text not null default 'draft' check (status in ('draft','published','retired')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_type,city,guest_band,style_tier,category_code,benchmark_version)
);

-- Do not destroy an existing benchmark_data table. Add the v2.1 columns.
alter table if exists public.benchmark_data
  add column if not exists guest_band text,
  add column if not exists category_code text,
  add column if not exists min_amount_kobo bigint,
  add column if not exists p25_amount_kobo bigint,
  add column if not exists median_amount_kobo bigint,
  add column if not exists p75_amount_kobo bigint,
  add column if not exists max_amount_kobo bigint,
  add column if not exists confidence text,
  add column if not exists source_mix jsonb not null default '{}'::jsonb,
  add column if not exists benchmark_version text,
  add column if not exists status text,
  add column if not exists published_at timestamptz;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  inquiry_id uuid references public.vendor_inquiries(id) on delete cascade,
  engagement_id uuid references public.engagements(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (event_id is not null or inquiry_id is not null or engagement_id is not null)
);

create table if not exists public.conversation_members (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (conversation_id,user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete restrict,
  body text not null,
  attachment_ref text,
  masked boolean not null default false,
  edited_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Attach to the new mutable tables.
do $$
declare t text;
begin
  foreach t in array array[
    'host_profiles','planner_profiles','vendor_profiles','vendor_services','vendor_verifications',
    'vendor_listings','vendor_placements','vendor_inquiries','vendor_quotes_v21','engagements',
    'engagement_milestones','escrow_transactions','payout_records','payment_transactions',
    'disputes','subscription_plans','benchmark_data'
  ] loop
    execute format('drop trigger if exists %I_updated_at on public.%I',t,t);
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.touch_updated_at()',t,t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.user_roles enable row level security;
alter table public.host_profiles enable row level security;
alter table public.planner_profiles enable row level security;
alter table public.vendor_profiles enable row level security;
alter table public.vendor_services enable row level security;
alter table public.vendor_service_areas enable row level security;
alter table public.vendor_verifications enable row level security;
alter table public.reviews enable row level security;
alter table public.consents enable row level security;
alter table public.anonymous_estimates enable row level security;
alter table public.events enable row level security;
alter table public.event_members enable row level security;
alter table public.host_planner_relationships enable row level security;
alter table public.event_categories enable row level security;
alter table public.budget_estimates enable row level security;
alter table public.logged_quotes enable row level security;
alter table public.vendor_listings enable row level security;
alter table public.vendor_placements enable row level security;
alter table public.vendor_inquiries enable row level security;
alter table public.vendor_quotes_v21 enable row level security;
alter table public.engagements enable row level security;
alter table public.engagement_milestones enable row level security;
alter table public.fee_configs enable row level security;
alter table public.escrow_transactions enable row level security;
alter table public.payout_records enable row level security;
alter table public.financial_events enable row level security;
alter table public.webhook_events enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.disputes enable row level security;
alter table public.dispute_evidence enable row level security;
alter table public.approvals enable row level security;
alter table public.benchmark_observations enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

-- Roles
 drop policy if exists v21_user_roles_select on public.user_roles;
create policy v21_user_roles_select on public.user_roles for select using (user_id=auth.uid() or public.has_role(auth.uid(),'admin'));

-- Simple profile policies
 drop policy if exists v21_host_profile_all on public.host_profiles;
create policy v21_host_profile_all on public.host_profiles for all using (user_id=auth.uid()) with check (user_id=auth.uid());

 drop policy if exists v21_planner_profile_all on public.planner_profiles;
create policy v21_planner_profile_all on public.planner_profiles for all using (owner_user_id=auth.uid() or public.has_role(auth.uid(),'admin')) with check (owner_user_id=auth.uid() or public.has_role(auth.uid(),'admin'));

 drop policy if exists v21_vendor_profile_select on public.vendor_profiles;
create policy v21_vendor_profile_select on public.vendor_profiles for select using (verification_status='verified' or owner_user_id=auth.uid() or public.has_role(auth.uid(),'admin'));
 drop policy if exists v21_vendor_profile_insert on public.vendor_profiles;
create policy v21_vendor_profile_insert on public.vendor_profiles for insert with check (owner_user_id=auth.uid());
 drop policy if exists v21_vendor_profile_update on public.vendor_profiles;
create policy v21_vendor_profile_update on public.vendor_profiles for update using (owner_user_id=auth.uid() or public.has_role(auth.uid(),'admin')) with check (owner_user_id=auth.uid() or public.has_role(auth.uid(),'admin'));

-- Reference data
 drop policy if exists v21_categories_select on public.event_categories;
create policy v21_categories_select on public.event_categories for select using (active=true or public.has_role(auth.uid(),'admin'));

-- Anonymous estimate insert only; claim/read via server endpoint later.
 drop policy if exists v21_anon_estimate_insert on public.anonymous_estimates;
create policy v21_anon_estimate_insert on public.anonymous_estimates for insert with check (true);
 drop policy if exists v21_anon_estimate_select on public.anonymous_estimates;
create policy v21_anon_estimate_select on public.anonymous_estimates for select using (claimed_by_user_id=auth.uid());

-- Events
 drop policy if exists v21_events_select on public.events;
create policy v21_events_select on public.events for select using (host_user_id=auth.uid() or public.is_event_member(id,auth.uid()));
 drop policy if exists v21_events_insert on public.events;
create policy v21_events_insert on public.events for insert with check (host_user_id=auth.uid());
 drop policy if exists v21_events_update on public.events;
create policy v21_events_update on public.events for update using (public.can_edit_event(id,auth.uid())) with check (public.can_edit_event(id,auth.uid()));
 drop policy if exists v21_events_delete on public.events;
create policy v21_events_delete on public.events for delete using (host_user_id=auth.uid());

-- Event members
 drop policy if exists v21_event_members_select on public.event_members;
create policy v21_event_members_select on public.event_members for select using (user_id=auth.uid() or public.can_view_event(event_id,auth.uid()));
 drop policy if exists v21_event_members_manage on public.event_members;
create policy v21_event_members_manage on public.event_members for all using (exists(select 1 from public.events e where e.id=event_id and e.host_user_id=auth.uid()) or public.has_role(auth.uid(),'admin')) with check (exists(select 1 from public.events e where e.id=event_id and e.host_user_id=auth.uid()) or public.has_role(auth.uid(),'admin'));

-- Budget estimates
 drop policy if exists v21_budget_select on public.budget_estimates;
create policy v21_budget_select on public.budget_estimates for select using (public.can_view_event(event_id,auth.uid()));
 drop policy if exists v21_budget_insert on public.budget_estimates;
create policy v21_budget_insert on public.budget_estimates for insert with check (public.can_edit_event(event_id,auth.uid()));
 drop policy if exists v21_budget_update on public.budget_estimates;
create policy v21_budget_update on public.budget_estimates for update using (public.can_edit_event(event_id,auth.uid())) with check (public.can_edit_event(event_id,auth.uid()));

-- Logged quotes
 drop policy if exists v21_logged_quotes_select on public.logged_quotes;
create policy v21_logged_quotes_select on public.logged_quotes for select using (public.can_view_event(event_id,auth.uid()));
 drop policy if exists v21_logged_quotes_insert on public.logged_quotes;
create policy v21_logged_quotes_insert on public.logged_quotes for insert with check (public.can_edit_event(event_id,auth.uid()) and logged_by=auth.uid());
 drop policy if exists v21_logged_quotes_update on public.logged_quotes;
create policy v21_logged_quotes_update on public.logged_quotes for update using (public.can_edit_event(event_id,auth.uid())) with check (public.can_edit_event(event_id,auth.uid()));
 drop policy if exists v21_logged_quotes_delete on public.logged_quotes;
create policy v21_logged_quotes_delete on public.logged_quotes for delete using (public.can_edit_event(event_id,auth.uid()));

-- Public vendor profile data uses listing-level RLS later; private financial tables
-- have no client write policies.
 drop policy if exists v21_subscription_plans_select on public.subscription_plans;
create policy v21_subscription_plans_select on public.subscription_plans for select using (active=true or public.has_role(auth.uid(),'admin'));

 drop policy if exists v21_subscriptions_select on public.subscriptions;
create policy v21_subscriptions_select on public.subscriptions for select using (user_id=auth.uid() or public.has_role(auth.uid(),'admin'));

 drop policy if exists v21_payment_transactions_select on public.payment_transactions;
create policy v21_payment_transactions_select on public.payment_transactions for select using (user_id=auth.uid() or public.has_role(auth.uid(),'admin'));

-- Marketplace listings and placement
 drop policy if exists v21_listing_select on public.vendor_listings;
create policy v21_listing_select on public.vendor_listings for select using (status='published' or exists(select 1 from public.vendor_profiles vp where vp.id=vendor_id and (vp.owner_user_id=auth.uid() or public.has_role(auth.uid(),'admin'))));
 drop policy if exists v21_listing_manage on public.vendor_listings;
create policy v21_listing_manage on public.vendor_listings for all using (exists(select 1 from public.vendor_profiles vp where vp.id=vendor_id and (vp.owner_user_id=auth.uid() or public.has_role(auth.uid(),'admin')))) with check (exists(select 1 from public.vendor_profiles vp where vp.id=vendor_id and (vp.owner_user_id=auth.uid() or public.has_role(auth.uid(),'admin'))));

 drop policy if exists v21_placement_select on public.vendor_placements;
create policy v21_placement_select on public.vendor_placements for select using (status='active' or exists(select 1 from public.vendor_profiles vp where vp.id=vendor_id and (vp.owner_user_id=auth.uid() or public.has_role(auth.uid(),'admin'))));
 drop policy if exists v21_placement_admin on public.vendor_placements;
create policy v21_placement_admin on public.vendor_placements for all using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Vendor inquiries/quotes
 drop policy if exists v21_inquiry_select on public.vendor_inquiries;
create policy v21_inquiry_select on public.vendor_inquiries for select using (host_user_id=auth.uid() or exists(select 1 from public.vendor_profiles vp where vp.id=vendor_id and vp.owner_user_id=auth.uid()));
 drop policy if exists v21_inquiry_insert on public.vendor_inquiries;
create policy v21_inquiry_insert on public.vendor_inquiries for insert with check (host_user_id=auth.uid() and public.can_view_event(event_id,auth.uid()));

 drop policy if exists v21_vendor_quote_select on public.vendor_quotes_v21;
create policy v21_vendor_quote_select on public.vendor_quotes_v21 for select using (exists(select 1 from public.vendor_inquiries vi where vi.id=inquiry_id and (vi.host_user_id=auth.uid() or exists(select 1 from public.vendor_profiles vp where vp.id=vi.vendor_id and vp.owner_user_id=auth.uid()))));
 drop policy if exists v21_vendor_quote_insert on public.vendor_quotes_v21;
create policy v21_vendor_quote_insert on public.vendor_quotes_v21 for insert with check (exists(select 1 from public.vendor_profiles vp where vp.id=vendor_id and vp.owner_user_id=auth.uid()));
 drop policy if exists v21_vendor_quote_update on public.vendor_quotes_v21;
create policy v21_vendor_quote_update on public.vendor_quotes_v21 for update using (exists(select 1 from public.vendor_profiles vp where vp.id=vendor_id and vp.owner_user_id=auth.uid())) with check (exists(select 1 from public.vendor_profiles vp where vp.id=vendor_id and vp.owner_user_id=auth.uid()));

-- Engagement access
 drop policy if exists v21_engagement_select on public.engagements;
create policy v21_engagement_select on public.engagements for select using (host_user_id=auth.uid() or planner_user_id=auth.uid() or exists(select 1 from public.vendor_profiles vp where vp.id=vendor_id and vp.owner_user_id=auth.uid()) or public.has_role(auth.uid(),'admin'));

 drop policy if exists v21_milestone_select on public.engagement_milestones;
create policy v21_milestone_select on public.engagement_milestones for select using (exists(select 1 from public.engagements e where e.id=engagement_id and (e.host_user_id=auth.uid() or e.planner_user_id=auth.uid() or exists(select 1 from public.vendor_profiles vp where vp.id=e.vendor_id and vp.owner_user_id=auth.uid()) or public.has_role(auth.uid(),'admin'))));

-- Escrow: read-only to participants. Server-side code will perform writes.
 drop policy if exists v21_escrow_select on public.escrow_transactions;
create policy v21_escrow_select on public.escrow_transactions for select using (exists(select 1 from public.engagements e where e.id=engagement_id and (e.host_user_id=auth.uid() or e.planner_user_id=auth.uid() or exists(select 1 from public.vendor_profiles vp where vp.id=e.vendor_id and vp.owner_user_id=auth.uid()) or public.has_role(auth.uid(),'admin'))));

 drop policy if exists v21_payout_select on public.payout_records;
create policy v21_payout_select on public.payout_records for select using (exists(select 1 from public.vendor_profiles vp where vp.id=vendor_id and vp.owner_user_id=auth.uid()) or public.has_role(auth.uid(),'admin'));

 drop policy if exists v21_dispute_select on public.disputes;
create policy v21_dispute_select on public.disputes for select using (opened_by_user_id=auth.uid() or public.has_role(auth.uid(),'admin') or exists(select 1 from public.engagements e where e.id=engagement_id and (e.host_user_id=auth.uid() or e.planner_user_id=auth.uid() or exists(select 1 from public.vendor_profiles vp where vp.id=e.vendor_id and vp.owner_user_id=auth.uid()))));
 drop policy if exists v21_dispute_insert on public.disputes;
create policy v21_dispute_insert on public.disputes for insert with check (opened_by_user_id=auth.uid());

-- Benchmarks: observations are admin/service only; published data can be read.
 drop policy if exists v21_benchmark_observations_admin on public.benchmark_observations;
create policy v21_benchmark_observations_admin on public.benchmark_observations for select using (public.has_role(auth.uid(),'admin'));

-- Communications
 drop policy if exists v21_conversation_member_select on public.conversation_members;
create policy v21_conversation_member_select on public.conversation_members for select using (user_id=auth.uid());
 drop policy if exists v21_message_select on public.messages;
create policy v21_message_select on public.messages for select using (exists(select 1 from public.conversation_members cm where cm.conversation_id=conversation_id and cm.user_id=auth.uid()));
 drop policy if exists v21_message_insert on public.messages;
create policy v21_message_insert on public.messages for insert with check (sender_user_id=auth.uid() and exists(select 1 from public.conversation_members cm where cm.conversation_id=conversation_id and cm.user_id=auth.uid()));

-- Notifications
 drop policy if exists v21_notifications_select on public.notifications;
create policy v21_notifications_select on public.notifications for select using (user_id=auth.uid());
 drop policy if exists v21_notifications_update on public.notifications;
create policy v21_notifications_update on public.notifications for update using (user_id=auth.uid()) with check (user_id=auth.uid());

-- Audit logs are admin-only reads. Writes are service/admin only.
 drop policy if exists v21_audit_admin_select on public.audit_logs;
create policy v21_audit_admin_select on public.audit_logs for select using (public.has_role(auth.uid(),'admin'));

commit;
