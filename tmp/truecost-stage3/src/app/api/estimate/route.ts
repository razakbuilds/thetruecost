import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import type { City, EventType, StyleTier } from "@/lib/types";

const baseByCity: Record<City, number> = { Lagos: 1.08, Abuja: 1.12, "Port Harcourt": 0.98 };
const guestsPerBase = 55_000;
const eventFactor: Record<EventType, number> = { Wedding: 1.35, "Naming Ceremony": 0.62, "Burial / Memorial": 0.78, "Corporate Event": 0.88 };
const styleFactor: Record<StyleTier, number> = { Essential: 0.78, Classic: 1, Premium: 1.42 };

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const eventType = body.eventType as EventType;
    const city = body.city as City;
    const styleTier = body.styleTier as StyleTier;
    const guestCount = Number(body.guestCount);
    if (!eventType || !city || !styleTier || !Number.isFinite(guestCount) || guestCount < 20 || guestCount > 2000) {
      return NextResponse.json({ error: "Please provide valid estimate inputs." }, { status: 400 });
    }

    const supabase = getSupabase();
    if (!supabase) return NextResponse.json({ error: "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local." }, { status: 503 });

    const { data, error } = await supabase
      .from("benchmark_data")
      .select("category,pct_of_total,sample_size")
      .eq("event_type", eventType)
      .eq("city", city)
      .eq("style_tier", styleTier)
      .order("category");

    if (error) throw error;
    if (!data?.length) return NextResponse.json({ error: "No benchmark data exists for this combination yet." }, { status: 404 });

    const total = Math.round(guestCount * guestsPerBase * baseByCity[city] * eventFactor[eventType] * styleFactor[styleTier] / 10_000) * 10_000;
    const lines = data.map((row) => ({ ...row, amount: Math.round(total * Number(row.pct_of_total) / 100 / 1000) * 1000, risk: Number(row.pct_of_total) >= 16 }));
    return NextResponse.json({ total, lines, eventType, city, styleTier, guestCount });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unable to generate the estimate." }, { status: 500 });
  }
}
