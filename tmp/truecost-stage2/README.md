# TrueCost — Stage 2

TrueCost is a mobile-first event budgeting reference for Nigerian event hosts.

## Stage 2 adds

- Supabase Auth with passwordless email magic link.
- Phone OTP support (requires an SMS provider configured in Supabase Auth).
- Lightweight host account flow.
- Saving the latest free estimate as an Event + BudgetEstimate rows.
- Protected `/dashboard` showing the saved baseline.
- Host/planner-ready `role` and `planner_id` fields in the data model.
- Row Level Security so users can only read/write their own saved event data.

The free calculator remains usable without authentication.

## 1. Install

```bash
npm install
```

## 2. Environment

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_publishable_or_anon_key
```

Do not use a Supabase service-role/secret key in a `NEXT_PUBLIC_` variable.

## 3. Database

Run these in Supabase SQL Editor in this order:

1. `supabase/schema.sql` — Stage 1 benchmark table (if not already run)
2. `supabase/seed.sql` — Stage 1 benchmark data (use the corrected seed that passes the positive-percentage check)
3. `supabase/stage2.sql` — profiles, events, budget_estimates, RLS and auth profile trigger

## 4. Supabase Auth configuration

In Supabase Auth URL configuration, set your local site URL to:

`http://localhost:3000`

Add the redirect URL:

`http://localhost:3000/auth/callback`

For production, add the Vercel domain and production callback URL as well.

Email magic-link authentication can work with Supabase's email provider. Phone OTP requires an SMS provider to be configured in Supabase.

## 5. Run

```bash
npm run dev
```

Open `http://localhost:3000`.

## Stage 2 flow

1. Run a free estimate without logging in.
2. Click **Save my estimate**.
3. Complete passwordless email or phone authentication.
4. The estimate is saved to `events` and `budget_estimates`.
5. The user lands on `/dashboard` and sees the saved baseline.
6. The free calculator remains ungated.

## Stubbed / deferred

- Paystack is not implemented yet; it belongs to Stage 3.
- Vendor quote logging is not implemented yet; it belongs to Stage 3.
- Pro subscription gating is not implemented yet.
- Planner UI is intentionally not implemented, but `role` and `planner_id` remain in the data model.
- Phone OTP UI is present, but actual SMS delivery depends on Supabase's configured SMS provider.
