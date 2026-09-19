# TrueCost — Stage 1

Free, no-login event budget estimator for Nigeria.

## Run locally

1. Install Node.js 20+.
2. Create a Supabase project.
3. In Supabase SQL Editor, run `supabase/schema.sql`, then `supabase/seed.sql`.
4. Copy `.env.example` to `.env.local` and add your Supabase project URL and anon key.
5. Install dependencies: `npm install`
6. Start: `npm run dev`
7. Open `http://localhost:3000`.

## What is real in Stage 1

- Next.js App Router + TypeScript + Tailwind CSS.
- Supabase/Postgres-backed `benchmark_data` table.
- Seed covers Lagos, Abuja and Port Harcourt × Wedding, Naming Ceremony, Burial / Memorial, Corporate Event × Essential, Classic, Premium.
- Estimate API reads the benchmark rows from Supabase at calculation time.
- Mobile-first ledger-style results card.
- WhatsApp click-to-chat share with pre-filled breakdown.
- Visible illustrative/not-a-quote disclaimer.
- No authentication or login wall.

## Judgment calls / temporary assumptions

The PRD defines the BenchmarkData schema and required coverage but does not specify the actual category list, percentage splits, sample sizes, or a numeric guest-to-budget model. Stage 1 therefore uses an explicitly labeled illustrative seed scaffold with eight categories and a simple guest-count scaling formula. `sample_size` is seeded as 0 because the PRD does not provide observed sample counts. These values should be replaced/refined as real quote data accumulates.

The API currently uses a city/event/style multiplier to turn the benchmark percentage split into an estimated total. This is a V1 modeling assumption, not a claim about current market prices.

## Intentionally not built yet

Auth, saved events, vendor quote tracking, Pro/payments, notifications, analytics and admin are Stage 2+ work. Vendor booking/marketplace/payment collection and planner UI remain out of scope per the PRD.
