-- TrueCost Chunk 1 — Validation / smoke tests
select table_name
from information_schema.tables
where table_schema='public'
  and table_name in (
    'user_roles','host_profiles','planner_profiles','vendor_profiles','vendor_services','vendor_service_areas',
    'vendor_verifications','reviews','consents','anonymous_estimates','event_members','host_planner_relationships',
    'event_categories','logged_quotes','vendor_listings','vendor_placements','vendor_inquiries','vendor_quotes_v21',
    'engagements','engagement_milestones','fee_configs','escrow_transactions','payout_records','payment_transactions',
    'financial_events','webhook_events','subscription_plans','disputes','dispute_evidence','approvals',
    'benchmark_observations','conversations','conversation_members','messages','notifications','audit_logs'
  )
order by table_name;

select count(*) as users_without_roles
from public.profiles p
where not exists (select 1 from public.user_roles r where r.user_id=p.id);

select count(*) as events_missing_owner
from public.events where host_user_id is null;

select count(*) as estimates_missing_kobo
from public.budget_estimates where budgeted_amount_kobo is null;

select
  (select count(*) from public.vendor_quotes) as legacy_quote_rows,
  (select count(*) from public.logged_quotes) as v21_logged_quote_rows;

select table_name, rowsecurity
from pg_tables
where schemaname='public'
  and tablename in ('user_roles','events','event_members','logged_quotes','vendor_profiles','subscriptions','payment_transactions','benchmark_observations','notifications','audit_logs')
order by table_name;

-- Spot-check kobo conversion. A legacy ₦800,000 amount should equal 80,000,000 kobo.
select id, budgeted_amount, budgeted_amount_kobo
from public.budget_estimates
where budgeted_amount is not null
order by created_at
limit 10;
