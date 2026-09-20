import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const [{ data: event, error: eventError }, { data: subscription, error: subscriptionError }] = await Promise.all([
    supabase
      .from("events")
      .select("id,event_type,city,guest_count,style_tier,created_at,budget_estimates(category,budgeted_amount,pct_of_total)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("subscriptions")
      .select("tier,status,renewal_date")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (eventError) return NextResponse.json({ error: eventError.message }, { status: 500 });
  if (subscriptionError) return NextResponse.json({ error: subscriptionError.message }, { status: 500 });
  if (!event) return NextResponse.json({ event: null, subscription: subscription ?? null, quotes: [] });

  const { data: quotes, error: quotesError } = await supabase
    .from("vendor_quotes")
    .select("id,event_id,category,actual_amount,vendor_name,notes,logged_at")
    .eq("event_id", event.id)
    .order("logged_at", { ascending: false });
  if (quotesError) return NextResponse.json({ error: quotesError.message }, { status: 500 });

  return NextResponse.json({ event, quotes: quotes ?? [], subscription: subscription ?? null });
}
