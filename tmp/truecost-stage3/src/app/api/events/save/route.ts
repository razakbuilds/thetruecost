import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const body = await request.json();
    const { estimate } = body;
    if (!estimate?.eventType || !estimate?.city || !estimate?.styleTier || !Number.isFinite(Number(estimate?.guestCount)) || !Array.isArray(estimate?.lines)) {
      return NextResponse.json({ error: "Invalid estimate." }, { status: 400 });
    }

    const { data: event, error: eventError } = await supabase
      .from("events")
      .insert({
        user_id: user.id,
        event_type: estimate.eventType,
        city: estimate.city,
        guest_count: Number(estimate.guestCount),
        style_tier: estimate.styleTier,
      })
      .select("id")
      .single();

    if (eventError) throw eventError;

    const rows = estimate.lines.map((line: { category: string; amount: number; pct_of_total: number }) => ({
      event_id: event.id,
      category: line.category,
      budgeted_amount: Math.round(Number(line.amount)),
      pct_of_total: Number(line.pct_of_total),
    }));

    const { error: budgetError } = await supabase.from("budget_estimates").insert(rows);
    if (budgetError) throw budgetError;

    return NextResponse.json({ eventId: event.id });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not save the estimate." }, { status: 500 });
  }
}
