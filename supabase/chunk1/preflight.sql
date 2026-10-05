-- TrueCost Chunk 1 — PRE-FLIGHT (read-only)
-- Run first in Supabase SQL Editor.

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('profiles','events','budget_estimates','vendor_quotes','subscriptions','benchmark_data')
order by table_name;

select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('profiles','events','budget_estimates','vendor_quotes','subscriptions')
order by table_name, ordinal_position;

select 'budget_estimates' as source, count(*) as rows,
       min(budgeted_amount) as min_amount,
       max(budgeted_amount) as max_amount,
       avg(budgeted_amount) as avg_amount
from public.budget_estimates;

select 'vendor_quotes' as source, count(*) as rows,
       min(actual_amount) as min_amount,
       max(actual_amount) as max_amount,
       avg(actual_amount) as avg_amount
from public.vendor_quotes;
