import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

async function getAuthenticatedClient() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

async function hasActivePro(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string) {
  const { data } = await supabase
    .from("subscriptions")
    .select("status,renewal_date")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return false;
  if (!["active"].includes(data.status)) return false;
  if (data.renewal_date && new Date(data.renewal_date) < new Date()) return false;
  return true;
}

export async function GET(request: Request) {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const url = new URL(request.url);
  const eventId = url.searchParams.get("eventId");
  if (!eventId) return NextResponse.json({ error: "eventId is required." }, { status: 400 });

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id")
    .eq("id", eventId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (eventError) return NextResponse.json({ error: eventError.message }, { status: 500 });
  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });

  const { data: quotes, error } = await supabase
    .from("vendor_quotes")
    .select("id,event_id,category,actual_amount,vendor_name,notes,logged_at")
    .eq("event_id", eventId)
    .order("logged_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ quotes: quotes ?? [], pro: await hasActivePro(supabase, user.id) });
}

export async function POST(request: Request) {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const pro = await hasActivePro(supabase, user.id);
  if (!pro) {
    return NextResponse.json({ error: "TrueCost Pro is required to log vendor quotes.", code: "PRO_REQUIRED" }, { status: 402 });
  }

  const body = await request.json();
  const eventId = String(body?.eventId ?? "");
  const category = String(body?.category ?? "").trim();
  const amount = Number(body?.actualAmount);
  const vendorName = body?.vendorName ? String(body.vendorName).trim().slice(0, 120) : null;
  const notes = body?.notes ? String(body.notes).trim().slice(0, 500) : null;

  if (!eventId || !category || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Event, category and a valid quote amount are required." }, { status: 400 });
  }

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id")
    .eq("id", eventId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (eventError) return NextResponse.json({ error: eventError.message }, { status: 500 });
  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });

  const { data: budgetLine, error: budgetError } = await supabase
    .from("budget_estimates")
    .select("category")
    .eq("event_id", eventId)
    .eq("category", category)
    .maybeSingle();
  if (budgetError) return NextResponse.json({ error: budgetError.message }, { status: 500 });
  if (!budgetLine) return NextResponse.json({ error: "That category is not part of this event's baseline." }, { status: 400 });

  const { data: quote, error } = await supabase
    .from("vendor_quotes")
    .insert({
      event_id: eventId,
      category,
      actual_amount: Math.round(amount),
      vendor_name: vendorName,
      notes,
    })
    .select("id,event_id,category,actual_amount,vendor_name,notes,logged_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ quote }, { status: 201 });
}

export async function DELETE(request: Request) {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const pro = await hasActivePro(supabase, user.id);
  if (!pro) return NextResponse.json({ error: "TrueCost Pro is required." }, { status: 402 });

  const body = await request.json();
  const quoteId = String(body?.quoteId ?? "");
  if (!quoteId) return NextResponse.json({ error: "quoteId is required." }, { status: 400 });

  const { data: quote, error: quoteError } = await supabase
    .from("vendor_quotes")
    .select("id,event_id")
    .eq("id", quoteId)
    .maybeSingle();
  if (quoteError) return NextResponse.json({ error: quoteError.message }, { status: 500 });
  if (!quote) return NextResponse.json({ error: "Quote not found." }, { status: 404 });

  const { data: event } = await supabase.from("events").select("id").eq("id", quote.event_id).eq("user_id", user.id).maybeSingle();
  if (!event) return NextResponse.json({ error: "Quote not found." }, { status: 404 });

  const { error } = await supabase.from("vendor_quotes").delete().eq("id", quoteId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
