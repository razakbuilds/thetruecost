import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) return NextResponse.json({ error: "Paystack is not configured yet." }, { status: 503 });

    const body = await request.json();
    const reference = String(body?.reference ?? "");
    if (!reference) return NextResponse.json({ error: "Payment reference is required." }, { status: 400 });

    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const json = await response.json();
    if (!response.ok || !json.status || json.data?.status !== "success") {
      return NextResponse.json({ error: json.message ?? "Payment has not been verified." }, { status: 400 });
    }

    if (json.data?.metadata?.user_id && json.data.metadata.user_id !== user.id) {
      return NextResponse.json({ error: "Payment reference does not belong to this account." }, { status: 403 });
    }

    const nextRenewal = new Date();
    nextRenewal.setMonth(nextRenewal.getMonth() + 1);

    const admin = createSupabaseAdminClient();
    const { data: subscription, error } = await admin
      .from("subscriptions")
      .upsert({
        user_id: user.id,
        tier: "pro",
        status: "active",
        renewal_date: nextRenewal.toISOString(),
        payment_provider_ref: reference,
      }, { onConflict: "user_id" })
      .select("tier,status,renewal_date,payment_provider_ref")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ subscription });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not verify payment." }, { status: 500 });
  }
}
