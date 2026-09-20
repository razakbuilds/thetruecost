"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CalendarDays, Check, Crown, LogOut, Plus, Trash2, X } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { naira } from "@/lib/format";

type Quote = {
  id: string;
  event_id: string;
  category: string;
  actual_amount: number;
  vendor_name: string | null;
  notes: string | null;
  logged_at: string;
};

type EventData = {
  id: string;
  event_type: string;
  city: string;
  guest_count: number;
  style_tier: string;
  budget_estimates: { category: string; budgeted_amount: number; pct_of_total: number }[];
};

type Subscription = { tier: string; status: string; renewal_date: string | null } | null;

export default function DashboardPage() {
  const supabaseRef = useRef<ReturnType<typeof createSupabaseBrowserClient> | null>(null);
  const [ready, setReady] = useState(false);
  const [event, setEvent] = useState<EventData | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [subscription, setSubscription] = useState<Subscription>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [quoteSaving, setQuoteSaving] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const [quoteForm, setQuoteForm] = useState({ category: "", actualAmount: "", vendorName: "", notes: "" });

  useEffect(() => {
    const client = createSupabaseBrowserClient();
    supabaseRef.current = client;
    setReady(true);

    async function load() {
      const { data: { user } } = await client.auth.getUser();
      if (!user) { window.location.href = "/auth"; return; }
      setEmail(user.email || user.phone || "");

      const draft = localStorage.getItem("truecost:latest-estimate");
      if (draft) {
        try {
          const saveRes = await fetch("/api/events/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ estimate: JSON.parse(draft) }) });
          if (saveRes.ok) localStorage.removeItem("truecost:latest-estimate");
        } catch {}
      }

      const res = await fetch("/api/events/latest");
      if (res.ok) {
        const json = await res.json();
        setEvent(json.event);
        setQuotes(json.quotes ?? []);
        setSubscription(json.subscription ?? null);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function signOut() {
    await supabaseRef.current?.auth.signOut();
    window.location.href = "/";
  }

  async function startProCheckout() {
    setBillingLoading(true);
    try {
      const res = await fetch("/api/billing/initialize", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not start checkout.");
      window.location.href = json.authorization_url;
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not start checkout.");
    } finally { setBillingLoading(false); }
  }

  async function submitQuote(e: FormEvent) {
    e.preventDefault();
    if (!event) return;
    setQuoteSaving(true); setQuoteError("");
    try {
      const res = await fetch("/api/events/quotes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId: event.id, ...quoteForm }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not save quote.");
      setQuotes((current) => [json.quote, ...current]);
      setQuoteForm({ category: "", actualAmount: "", vendorName: "", notes: "" });
      setQuoteOpen(false);
    } catch (error) {
      setQuoteError(error instanceof Error ? error.message : "Could not save quote.");
    } finally { setQuoteSaving(false); }
  }

  async function deleteQuote(id: string) {
    if (!confirm("Remove this quote from your event?")) return;
    const res = await fetch("/api/events/quotes", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quoteId: id }) });
    if (res.ok) setQuotes((current) => current.filter((quote) => quote.id !== id));
  }

  const baselineTotal = event?.budget_estimates.reduce((sum, row) => sum + Number(row.budgeted_amount), 0) || 0;
  const latestByCategory = useMemo(() => {
    const map = new Map<string, Quote>();
    for (const quote of quotes) if (!map.has(quote.category)) map.set(quote.category, quote);
    return map;
  }, [quotes]);
  const trackedBaseline = event?.budget_estimates.filter((row) => latestByCategory.has(row.category)).reduce((sum, row) => sum + Number(row.budgeted_amount), 0) || 0;
  const trackedCurrent = Array.from(latestByCategory.values()).reduce((sum, row) => sum + Number(row.actual_amount), 0);
  const variance = trackedBaseline ? ((trackedCurrent - trackedBaseline) / trackedBaseline) * 100 : 0;
  const isPro = subscription?.status === "active" && (!subscription.renewal_date || new Date(subscription.renewal_date) > new Date());

  if (!ready) return <main className="min-h-screen bg-[#f7f5ef]" />;

  return <main className="min-h-screen bg-[#f7f5ef]">
    <header className="border-b border-black/5 bg-[#FBF6EA]"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 md:px-8"><a href="/" className="display text-2xl font-bold text-[#0F2A22]">True<span className="text-[#C9A227]">Cost</span></a><div className="flex items-center gap-3"><span className="hidden text-xs text-[#68726c] sm:inline">{email}</span><button onClick={signOut} className="inline-flex items-center gap-2 rounded-xl border border-[#d9d1c1] bg-white px-3 py-2 text-xs font-bold text-[#0F2A22]"><LogOut className="h-3.5 w-3.5"/> Sign out</button></div></div></header>
    <section className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14">
      <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="mb-2 text-xs font-bold uppercase tracking-[.18em] text-[#8a7a47]">Your TrueCost Pro workspace</p><h1 className="display text-4xl font-semibold text-[#0F2A22] md:text-5xl">Budget vs. reality</h1><p className="mt-2 text-sm text-[#68726c]">Your saved benchmark is the reference point. Log real vendor quotes as planning moves forward.</p></div>{isPro && <div className="inline-flex items-center gap-2 self-start rounded-full bg-[#0F2A22] px-4 py-2 text-xs font-bold text-white"><Crown className="h-3.5 w-3.5 text-[#C9A227]"/> Pro active</div>}</div>
      {loading ? <div className="rounded-3xl border border-[#ded8ca] bg-white p-8 text-sm text-[#68726c]">Loading your event…</div> : event ? <>
        <div className="grid gap-5 md:grid-cols-3">
          <div className="rounded-3xl border border-[#d6ccb9] bg-[#FBF6EA] p-6"><p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#827762]">Baseline</p><p className="display mt-2 text-3xl font-bold text-[#0F2A22]">{naira(baselineTotal)}</p><p className="mt-1 text-xs text-[#68726c]">Original benchmark budget</p></div>
          <div className="rounded-3xl border border-[#d6ccb9] bg-white p-6"><p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#827762]">Tracked quotes</p><p className="display mt-2 text-3xl font-bold text-[#0F2A22]">{naira(trackedCurrent)}</p><p className="mt-1 text-xs text-[#68726c]">{latestByCategory.size} of {event.budget_estimates.length} categories tracked</p></div>
          <div className="rounded-3xl border border-[#d6ccb9] bg-white p-6"><p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#827762]">Variance</p><p className={`display mt-2 text-3xl font-bold ${variance > 0 ? "text-[#8a3b2e]" : variance < 0 ? "text-[#315447]" : "text-[#0F2A22]"}`}>{variance > 0 ? "+" : ""}{variance.toFixed(1)}%</p><p className="mt-1 text-xs text-[#68726c]">Across categories with a current quote</p></div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_.68fr]">
          <div className="grain rounded-3xl border border-[#d6ccb9] bg-[#FBF6EA] p-6 shadow-sm md:p-8"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-[#8a7a47]"><CalendarDays className="h-4 w-4"/> Current event</div><h2 className="display mt-4 text-3xl font-semibold text-[#0F2A22]">{event.event_type}</h2><p className="mt-1 text-sm text-[#68726c]">{event.city} · {event.guest_count} guests · {event.style_tier}</p></div><button onClick={()=>{setQuoteError("");setQuoteOpen(true)}} disabled={!isPro} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0F2A22] px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-[#d8d5cc] disabled:text-[#7b807c]"><Plus className="h-4 w-4"/> Add quote</button></div>
            <div className="mt-7 border-t border-[#d6ccb9] pt-3">{event.budget_estimates.map((row) => { const quote = latestByCategory.get(row.category); const diff = quote ? Number(quote.actual_amount) - Number(row.budgeted_amount) : null; const pct = quote ? (diff! / Number(row.budgeted_amount)) * 100 : null; return <div key={row.category} className="ledger-rule py-4"><div className="flex items-center gap-3"><span className="flex-1 text-sm font-semibold text-[#26332d]">{row.category}</span><span className="text-xs text-[#8a877f]">{row.pct_of_total}%</span><span className="font-mono text-sm font-bold text-[#0F2A22]">{naira(Number(row.budgeted_amount))}</span></div><div className="mt-2 flex items-center justify-between gap-3 text-xs">{quote ? <><span className="text-[#68726c]">Current quote: <strong className="text-[#26332d]">{naira(Number(quote.actual_amount))}</strong>{quote.vendor_name ? ` · ${quote.vendor_name}` : ""}</span><span className={`font-bold ${pct! > 0 ? "text-[#8a3b2e]" : "text-[#315447]"}`}>{pct! > 0 ? "+" : ""}{pct!.toFixed(1)}%</span></> : <span className="text-[#9a958a]">No quote logged yet</span>}</div></div> })}</div>
            <div className="mt-5 rounded-xl bg-[#0F2A22] p-4 text-sm leading-6 text-white/75"><strong className="text-white">Variance is based on the latest quote per category.</strong> Multiple vendor quotes can be stored; the newest one is treated as the current working quote so alternative vendors are not double-counted.</div>
          </div>

          <aside className="rounded-3xl border border-[#ded8ca] bg-white p-6 md:p-8"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#8a7a47]">Planning signal</p><h3 className="display mt-2 text-3xl font-semibold text-[#0F2A22]">{latestByCategory.size ? variance > 0 ? `Trending ${variance.toFixed(1)}% over baseline` : variance < 0 ? `Trending ${Math.abs(variance).toFixed(1)}% under baseline` : "On the baseline" : "Start tracking your quotes"}</h3><p className="mt-3 text-sm leading-6 text-[#68726c]">{latestByCategory.size ? "This compares the latest vendor quote in each tracked category with its original TrueCost benchmark." : "Your baseline is ready. As real quotes arrive, log them here to see where the event is trending."}</p>{!isPro && <div className="mt-6 rounded-2xl bg-[#f5f0df] p-5"><div className="flex gap-3"><Crown className="mt-0.5 h-5 w-5 shrink-0 text-[#C9A227]"/><div><h4 className="font-bold text-[#0F2A22]">Unlock quote tracking</h4><p className="mt-1 text-xs leading-5 text-[#68726c]">TrueCost Pro adds vendor quote logging, budget-vs-quote variance and ongoing planning signals.</p><button onClick={startProCheckout} disabled={billingLoading} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0F2A22] px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{billingLoading ? "Opening checkout…" : "Upgrade to Pro"}<ArrowRight className="h-4 w-4"/></button></div></div>}{isPro && subscription?.renewal_date && <p className="mt-6 text-xs text-[#68726c]">Next renewal: {new Date(subscription.renewal_date).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</p>}</aside>
        </div>
      </> : <div className="rounded-3xl border border-[#ded8ca] bg-white p-8"><Plus className="h-6 w-6 text-[#C9A227]"/><h2 className="display mt-4 text-3xl font-semibold text-[#0F2A22]">No saved estimate yet.</h2><p className="mt-2 text-sm text-[#68726c]">Run the free calculator first, then sign in to save it here.</p><a href="/#calculator" className="mt-5 inline-flex rounded-xl bg-[#0F2A22] px-5 py-3 text-sm font-bold text-white">Build an estimate</a></div>}
    </section>

    {quoteOpen && event && <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0F2A22]/45 p-4 sm:items-center"><div className="w-full max-w-lg rounded-3xl border border-[#d9d1c1] bg-[#FBF6EA] p-6 shadow-2xl md:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#8a7a47]">TrueCost Pro</p><h2 className="display mt-2 text-3xl font-semibold text-[#0F2A22]">Log a vendor quote</h2></div><button onClick={()=>setQuoteOpen(false)} className="rounded-full p-2 text-[#68726c] hover:bg-white"><X className="h-5 w-5"/></button></div><form onSubmit={submitQuote} className="mt-6 space-y-4"><div><label className="mb-2 block text-sm font-semibold">Category</label><select required value={quoteForm.category} onChange={e=>setQuoteForm({...quoteForm,category:e.target.value})} className="w-full rounded-xl border border-[#d9d1c1] bg-white px-4 py-3.5 text-sm outline-none focus:border-[#C9A227]"><option value="">Select a category</option>{event.budget_estimates.map(row=><option key={row.category} value={row.category}>{row.category}</option>)}</select></div><div><label className="mb-2 block text-sm font-semibold">Quoted amount</label><input required min="1" step="1" type="number" value={quoteForm.actualAmount} onChange={e=>setQuoteForm({...quoteForm,actualAmount:e.target.value})} placeholder="e.g. 1250000" className="w-full rounded-xl border border-[#d9d1c1] bg-white px-4 py-3.5 text-sm outline-none focus:border-[#C9A227]"/></div><div><label className="mb-2 block text-sm font-semibold">Vendor name <span className="font-normal text-[#8a877f]">(optional)</span></label><input value={quoteForm.vendorName} onChange={e=>setQuoteForm({...quoteForm,vendorName:e.target.value})} placeholder="e.g. Ade Events" className="w-full rounded-xl border border-[#d9d1c1] bg-white px-4 py-3.5 text-sm outline-none focus:border-[#C9A227]"/></div><div><label className="mb-2 block text-sm font-semibold">Notes <span className="font-normal text-[#8a877f]">(optional)</span></label><textarea rows={3} value={quoteForm.notes} onChange={e=>setQuoteForm({...quoteForm,notes:e.target.value})} placeholder="What does the quote include?" className="w-full resize-none rounded-xl border border-[#d9d1c1] bg-white px-4 py-3.5 text-sm outline-none focus:border-[#C9A227]"/></div>{quoteError && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{quoteError}</div>}<button disabled={quoteSaving} className="w-full rounded-xl bg-[#0F2A22] px-5 py-4 text-sm font-bold text-white disabled:opacity-60">{quoteSaving ? "Saving quote…" : "Save quote"}</button></form></div></div>}
  </main>;
}
