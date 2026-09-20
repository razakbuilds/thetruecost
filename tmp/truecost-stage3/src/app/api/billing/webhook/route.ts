import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return NextResponse.json({ error: "Paystack is not configured." }, { status: 503 });

  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature") ?? "";
  const hash = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
  if (!signature || signature.length !== hash.length || !crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature))) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody);
    const supabase = createSupabaseAdminClient();
    const customerEmail = payload?.data?.customer?.email;
    if (!customerEmail) return NextResponse.json({ received: true });

    const { data: profile } = await supabase.from("profiles").select("id").eq("email", customerEmail).maybeSingle();
    if (!profile) return NextResponse.json({ received: true });

    const event = payload?.event;
    if (event === "subscription.disable" || event === "invoice.payment_failed") {
      await supabase
        .from("subscriptions")
        .update({ status: event === "subscription.disable" ? "cancelled" : "past_due" })
        .eq("user_id", profile.id);
    }
    if (event === "invoice.create" || event === "invoice.update" || event === "invoice.payment_success") {
      const renewal = payload?.data?.next_payment_date ? new Date(payload.data.next_payment_date).toISOString() : undefined;
      await supabase
        .from("subscriptions")
        .update({ status: "active", ...(renewal ? { renewal_date: renewal } : {}) })
        .eq("user_id", profile.id);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
