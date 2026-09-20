import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const secret = process.env.PAYSTACK_SECRET_KEY;
    const plan = process.env.PAYSTACK_PLAN_CODE;
    if (!secret || !plan) {
      return NextResponse.json({ error: "Paystack is not configured yet. Add PAYSTACK_SECRET_KEY and PAYSTACK_PLAN_CODE." }, { status: 503 });
    }

    const origin = new URL(request.url).origin;
    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: user.email,
        amount: Number(process.env.TRUECOST_PRO_MONTHLY_KOBO ?? "0"),
        plan,
        callback_url: `${origin}/billing/callback`,
        metadata: { user_id: user.id, product: "truecost_pro" },
      }),
    });

    const json = await response.json();
    if (!response.ok || !json.status) {
      return NextResponse.json({ error: json.message ?? "Could not initialize payment." }, { status: 502 });
    }

    return NextResponse.json({ authorization_url: json.data.authorization_url, reference: json.data.reference });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not initialize payment." }, { status: 500 });
  }
}
