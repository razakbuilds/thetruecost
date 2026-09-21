# TrueCost — Stage 3

Stage 3 adds the first Pro workflow: vendor quote logging, budget-vs-quote variance, and Paystack subscription foundations.

## Before running
1. Stage 1 `schema.sql` + `seed.sql` must already be applied.
2. Stage 2 `stage2.sql` must already be applied.
3. Run `supabase/stage3.sql` in Supabase SQL Editor.
4. Keep the Stage 2 Supabase URL/public key env variables.
5. Add the Stage 3 server-only variables from `.env.example` when you are ready to enable Paystack.

## Stage 3 environment variables
- `PAYSTACK_SECRET_KEY` — server-only Paystack secret.
- `PAYSTACK_PLAN_CODE` — the Paystack monthly plan code.
- `TRUECOST_PRO_MONTHLY_KOBO` — monthly plan amount in kobo, matching the Paystack plan.
- `SUPABASE_SERVICE_ROLE_KEY` — server-only Supabase service-role key. Never expose it as `NEXT_PUBLIC_*`.

## What is included
- `vendor_quotes` table + RLS.
- `subscriptions` table + RLS.
- Quote API with Pro gating.
- Latest quote per category used for variance calculations.
- Dashboard budget-vs-quote view.
- Quote history storage and deletion.
- Paystack checkout initialization.
- Paystack payment verification.
- Paystack webhook foundation for subscription status changes.
- Auth page prerender-safe initialization retained from the Stage 2 fix.

## Important payment note
Paystack must be configured with a real monthly plan before the Pro upgrade button can complete checkout. The application does not grant Pro access merely because a checkout was opened; the server verifies the payment reference first.
