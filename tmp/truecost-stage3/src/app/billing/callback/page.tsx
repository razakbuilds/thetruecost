"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, LoaderCircle } from "lucide-react";

export default function BillingCallbackPage() {
  const [message, setMessage] = useState("Confirming your TrueCost Pro payment…");
  const [error, setError] = useState("");

  useEffect(() => {
    const reference = new URLSearchParams(window.location.search).get("reference");
    if (!reference) {
      setError("No payment reference was returned.");
      return;
    }

    fetch("/api/billing/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference }),
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Payment verification failed.");
        setMessage("Payment confirmed. Your Pro tools are now active.");
        setTimeout(() => { window.location.href = "/dashboard"; }, 1200);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Payment verification failed."));
  }, []);

  return <main className="min-h-screen bg-[#FBF6EA] px-5 py-10"><div className="mx-auto flex min-h-[70vh] max-w-md items-center justify-center"><div className="w-full rounded-3xl border border-[#ded8ca] bg-white p-8 text-center shadow-sm">{error ? <div className="text-sm text-red-700">{error}<a href="/dashboard" className="mt-5 block font-bold text-[#0F2A22]">Return to dashboard</a></div> : <><CheckCircle2 className="mx-auto h-10 w-10 text-[#0F2A22]"/><h1 className="display mt-5 text-3xl font-semibold text-[#0F2A22]">TrueCost Pro</h1><p className="mt-3 text-sm leading-6 text-[#68726c]">{message}</p><LoaderCircle className="mx-auto mt-5 h-5 w-5 animate-spin text-[#C9A227]"/></>}</div></div></main>;
}
