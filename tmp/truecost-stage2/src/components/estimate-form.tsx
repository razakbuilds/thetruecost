"use client";
import { useState } from "react";
import { ArrowRight, ChevronDown, Users } from "lucide-react";
import type { Estimate } from "@/lib/types";
import { CITIES, EVENT_TYPES, STYLE_TIERS } from "@/lib/types";
import EstimateResult from "./estimate-result";

export default function EstimateForm() {
  const [eventType, setEventType] = useState<typeof EVENT_TYPES[number]>("Wedding");
  const [city, setCity] = useState<typeof CITIES[number]>("Lagos");
  const [styleTier, setStyleTier] = useState<typeof STYLE_TIERS[number]>("Classic");
  const [guestCount, setGuestCount] = useState(250);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function calculate() {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/estimate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventType, city, styleTier, guestCount }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not calculate estimate");
      setEstimate(json);
      setTimeout(() => document.getElementById("estimate-result")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not calculate estimate"); }
    finally { setLoading(false); }
  }

  return <>
    <section id="calculator" className="mx-auto max-w-6xl px-5 pb-20 pt-10 md:px-8 md:pt-16">
      <div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr]">
        <div className="rounded-3xl border border-[#ded8ca] bg-white p-6 shadow-sm md:p-8">
          <div className="mb-7"><p className="mb-2 text-xs font-bold uppercase tracking-[.18em] text-[#8a7a47]">Build your estimate</p><h2 className="display text-3xl font-semibold text-[#0F2A22] md:text-4xl">Tell us about the event.</h2><p className="mt-2 text-sm leading-6 text-[#6D756F]">No sign-up. No sales call. Just a useful starting point.</p></div>
          <label className="mb-2 block text-sm font-semibold">Event type</label>
          <div className="relative mb-6"><select value={eventType} onChange={e=>setEventType(e.target.value as any)} className="w-full appearance-none rounded-xl border border-[#d9d1c1] bg-[#fcfbf8] px-4 py-3.5 text-sm outline-none focus:border-[#C9A227]">{EVENT_TYPES.map(x=><option key={x}>{x}</option>)}</select><ChevronDown className="pointer-events-none absolute right-4 top-4 h-4 w-4 text-gray-500"/></div>
          <label className="mb-2 block text-sm font-semibold">City</label>
          <div className="relative mb-6"><select value={city} onChange={e=>setCity(e.target.value as any)} className="w-full appearance-none rounded-xl border border-[#d9d1c1] bg-[#fcfbf8] px-4 py-3.5 text-sm outline-none focus:border-[#C9A227]">{CITIES.map(x=><option key={x}>{x}</option>)}</select><ChevronDown className="pointer-events-none absolute right-4 top-4 h-4 w-4 text-gray-500"/></div>
          <div className="mb-6"><div className="mb-2 flex items-center justify-between"><label className="text-sm font-semibold">Guests</label><span className="rounded-full bg-[#edf3ef] px-3 py-1 text-sm font-bold text-[#0F2A22]">{guestCount}</span></div><input aria-label="Guest count" type="range" min="20" max="2000" step="10" value={guestCount} onChange={e=>setGuestCount(Number(e.target.value))} className="w-full accent-[#0F2A22]"/><div className="mt-2 flex justify-between text-[11px] text-[#8a8f8b]"><span>20</span><span>2,000</span></div></div>
          <label className="mb-2 block text-sm font-semibold">Style tier</label>
          <div className="mb-7 grid grid-cols-3 gap-2">{STYLE_TIERS.map(x=><button type="button" key={x} onClick={()=>setStyleTier(x)} className={`rounded-xl border px-2 py-3 text-xs font-semibold transition ${styleTier===x ? "border-[#0F2A22] bg-[#0F2A22] text-white" : "border-[#d9d1c1] bg-white text-[#53605a] hover:border-[#9a9a90]"}`}>{x}</button>)}</div>
          {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <button onClick={calculate} disabled={loading} className="group flex w-full items-center justify-center gap-2 rounded-xl bg-[#0F2A22] px-5 py-4 text-sm font-bold text-white transition hover:bg-[#173D31] disabled:cursor-wait disabled:opacity-70">{loading ? "Calculating…" : "See my estimate"}<ArrowRight className="h-4 w-4 transition group-hover:translate-x-1"/></button>
          <p className="mt-4 text-center text-[11px] leading-5 text-[#858b86]">Free forever. Estimates are illustrative, not a quote or financial guarantee.</p>
        </div>
        <div className="hidden rounded-3xl bg-[#0F2A22] p-8 text-white lg:flex lg:flex-col lg:justify-between"><div><div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#C9A227] text-[#0F2A22]"><Users className="h-5 w-5"/></div><h3 className="display max-w-md text-4xl font-semibold leading-tight">Know your numbers before the vendors set them for you.</h3><p className="mt-5 max-w-lg text-sm leading-7 text-white/65">TrueCost turns benchmark spending patterns into an itemized starting budget, so you can see where the money is likely to go before you start collecting quotes.</p></div><div className="border-t border-white/10 pt-6 text-xs uppercase tracking-[.16em] text-[#C9A227]">Starting with Nigeria · Naira only</div></div>
      </div>
    </section>
    {estimate && <EstimateResult estimate={estimate}/>} 
  </>;
}
