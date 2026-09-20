"use client";

import { useEffect, useMemo, useState } from "react";
import { LogOut, Plus, ArrowRight, CalendarDays } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { naira } from "@/lib/format";

export default function DashboardPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [event, setEvent] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      setEmail(user?.email || user?.phone || "");
      const draft = localStorage.getItem("truecost:latest-estimate");
      if (draft) {
        try {
          const saveRes = await fetch("/api/events/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ estimate: JSON.parse(draft) }),
          });
          if (saveRes.ok) localStorage.removeItem("truecost:latest-estimate");
        } catch {
          // Continue to load the dashboard; the draft remains available for a retry.
        }
      }
      const res = await fetch("/api/events/latest");
      if (res.ok) {
        const json = await res.json();
        setEvent(json.event);
      }
      setLoading(false);
    }
    load();
  }, [supabase]);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const total = event?.budget_estimates?.reduce((sum: number, row: any) => sum + Number(row.budgeted_amount), 0) || 0;

  return <main className="min-h-screen bg-[#f7f5ef]">
    <header className="border-b border-black/5 bg-[#FBF6EA]"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 md:px-8"><a href="/" className="display text-2xl font-bold text-[#0F2A22]">True<span className="text-[#C9A227]">Cost</span></a><div className="flex items-center gap-3"><span className="hidden text-xs text-[#68726c] sm:inline">{email}</span><button onClick={signOut} className="inline-flex items-center gap-2 rounded-xl border border-[#d9d1c1] bg-white px-3 py-2 text-xs font-bold text-[#0F2A22]"><LogOut className="h-3.5 w-3.5"/> Sign out</button></div></div></header>
    <section className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14"><div className="mb-8"><p className="mb-2 text-xs font-bold uppercase tracking-[.18em] text-[#8a7a47]">Your TrueCost</p><h1 className="display text-4xl font-semibold text-[#0F2A22] md:text-5xl">Saved events</h1><p className="mt-2 text-sm text-[#68726c]">Your free estimate is now saved as the baseline for future quote tracking.</p></div>
      {loading ? <div className="rounded-3xl border border-[#ded8ca] bg-white p-8 text-sm text-[#68726c]">Loading your event…</div> : event ? <div className="grid gap-6 lg:grid-cols-[1fr_.7fr]"><div className="grain rounded-3xl border border-[#d6ccb9] bg-[#FBF6EA] p-6 shadow-sm md:p-8"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-[#8a7a47]"><CalendarDays className="h-4 w-4"/> Baseline estimate</div><h2 className="display mt-4 text-3xl font-semibold text-[#0F2A22]">{event.event_type}</h2><p className="mt-1 text-sm text-[#68726c]">{event.city} · {event.guest_count} guests · {event.style_tier}</p></div><div className="text-right"><p className="text-[11px] font-bold uppercase tracking-[.15em] text-[#827762]">Total</p><p className="display mt-1 text-3xl font-bold text-[#0F2A22]">{naira(total)}</p></div></div><div className="mt-7 border-t border-[#d6ccb9] pt-3">{event.budget_estimates?.map((row: any) => <div key={row.category} className="ledger-rule flex items-center gap-3 py-3"><span className="flex-1 text-sm font-semibold text-[#26332d]">{row.category}</span><span className="text-xs text-[#8a877f]">{row.pct_of_total}%</span><span className="font-mono text-sm font-bold text-[#0F2A22]">{naira(Number(row.budgeted_amount))}</span></div>)}</div><div className="mt-6 rounded-xl bg-[#0F2A22] p-4 text-sm leading-6 text-white/75"><strong className="text-white">Baseline saved.</strong> In TrueCost Pro, these category amounts become the reference point for your real vendor quotes.</div></div><div className="rounded-3xl border border-[#ded8ca] bg-white p-6 md:p-8"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#8a7a47]">Next step</p><h3 className="display mt-2 text-3xl font-semibold text-[#0F2A22]">Track real quotes when you're ready.</h3><p className="mt-3 text-sm leading-6 text-[#68726c]">TrueCost Pro will let you log vendor quotes against this baseline and see where you're running over or under budget.</p><button disabled className="mt-6 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-[#e9e5da] px-5 py-4 text-sm font-bold text-[#7b807c]">TrueCost Pro · Coming next <ArrowRight className="h-4 w-4"/></button></div></div> : <div className="rounded-3xl border border-[#ded8ca] bg-white p-8"><Plus className="h-6 w-6 text-[#C9A227]"/><h2 className="display mt-4 text-3xl font-semibold text-[#0F2A22]">No saved estimate yet.</h2><p className="mt-2 text-sm text-[#68726c]">Run the free calculator first, then sign in to save it here.</p><a href="/#calculator" className="mt-5 inline-flex rounded-xl bg-[#0F2A22] px-5 py-3 text-sm font-bold text-white">Build an estimate</a></div>}
    </section>
  </main>;
}
