-- V1 seed: illustrative benchmark assumptions. Replace/refine with observed quote data as it accumulates.
truncate table benchmark_data restart identity;

insert into benchmark_data (event_type, city, style_tier, category, pct_of_total, sample_size)
select et, c, st, cat, pct, 0
from (values
 ('Venue & space',22),('Food & drinks',27),('Decor & styling',16),('Photography & video',8),('Entertainment',7),('Attire & beauty',7),('Logistics',6),('Invitations & misc.',7)
) as cats(cat,pct)
cross join (values ('Wedding'),('Naming Ceremony'),('Burial / Memorial'),('Corporate Event')) as ets(et)
cross join (values ('Lagos'),('Abuja'),('Port Harcourt')) as cities(c)
cross join (values ('Essential'),('Classic'),('Premium')) as styles(st);

-- Event-specific overrides to make the seed more realistic while preserving 100% totals.
update benchmark_data set pct_of_total = case category
 when 'Venue & space' then 24 when 'Food & drinks' then 25 when 'Decor & styling' then 18 when 'Photography & video' then 9 when 'Entertainment' then 8 when 'Attire & beauty' then 6 when 'Logistics' then 5 else 5 end
where event_type='Wedding';
update benchmark_data set pct_of_total = case category
 when 'Venue & space' then 18 when 'Food & drinks' then 38 when 'Decor & styling' then 12 when 'Photography & video' then 5 when 'Entertainment' then 5 when 'Attire & beauty' then 8 when 'Logistics' then 7 else 7 end
where event_type='Naming Ceremony';
update benchmark_data set pct_of_total = case category
 when 'Venue & space' then 12 when 'Food & drinks' then 34 when 'Decor & styling' then 10 when 'Photography & video' then 4 when 'Entertainment' then 6 when 'Attire & beauty' then 2 when 'Logistics' then 20 else 12 end
where event_type='Burial / Memorial';
update benchmark_data set pct_of_total = case category
 when 'Venue & space' then 22 when 'Food & drinks' then 30 when 'Decor & styling' then 9 when 'Photography & video' then 6 when 'Entertainment' then 4 when 'Attire & beauty' then 1 when 'Logistics' then 18 else 10 end
where event_type='Corporate Event';

-- Style-tier adjustments: redistribute from venue/decor/entertainment into lower-cost categories.
update benchmark_data set pct_of_total = pct_of_total + case when category in ('Venue & space','Decor & styling','Entertainment') then -2 else 1.2 end where style_tier='Essential';
update benchmark_data set pct_of_total = pct_of_total + case when category in ('Venue & space','Decor & styling','Entertainment') then 2 else -1.2 end where style_tier='Premium';

-- City differences are intentionally modest; this V1 dataset is a benchmark scaffold, not a market price list.
