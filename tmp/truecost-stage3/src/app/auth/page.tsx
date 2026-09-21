"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, Mail, Phone, ShieldCheck } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { Estimate } from "@/lib/types";

const DRAFT_KEY = "truecost:latest-estimate";
type Mode = "email" | "phone";

export default function AuthPage() {
  const supabaseRef = useRef<ReturnType<typeof createSupabaseBrowserClient> | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode>("email");
  const [value, setValue] = useState("");
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const client = createSupabaseBrowserClient();
    supabaseRef.current = client;
    setReady(true);
    client.auth.getSession().then(({ data }) => {
      if (data.session) window.location.href = "/dashboard";
    });
  }, []);

  async function saveDraftIfNeeded() {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    try {
      const estimate = JSON.parse(raw) as Estimate;
      const res = await fetch("/api/events/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ estimate }) });
      if (res.ok) localStorage.removeItem(DRAFT_KEY);
    } catch {}
  }

  async function sendCode(event: FormEvent) {
    event.preventDefault();
    const supabase = supabaseRef.current;
    if (!supabase) return;
    setLoading(true); setError(""); setMessage("");
    try {
      if (mode === "email") {
        const { error } = await supabase.auth.signInWithOtp({ email: value, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
        if (error) throw error;
        setMessage("Check your email for the secure sign-in link.");
      } else {
        const { error } = await supabase.auth.signInWithOtp({ phone: value });
        if (error) throw error;
        setSent(true); setMessage("We sent a one-time code to your phone.");
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Could not send the sign-in code."); }
    finally { setLoading(false); }
  }

  async function verifyPhone(event: FormEvent) {
    event.preventDefault();
    const supabase = supabaseRef.current;
    if (!supabase) return;
    setLoading(true); setError("");
    try {
      const { error } = await supabase.auth.verifyOtp({ phone: value, token: otp, type: "sms" });
      if (error) throw error;
      await saveDraftIfNeeded();
      window.location.href = "/dashboard";
    } catch (e) { setError(e instanceof Error ? e.message : "That code could not be verified."); }
    finally { setLoading(false); }
  }

  if (!ready) return <main className="min-h-screen bg-[#FBF6EA]" />;

  return <main className="min-h-screen bg-[#FBF6EA] px-5 py-8 md:px-8"><div className="mx-auto flex min-h-[90vh] max-w-md flex-col justify-center"><a href="/" className="mb-10 inline-flex items-center gap-2 self-start text-sm font-semibold text-[#0F2A22]"><ArrowLeft className="h-4 w-4"/> Back to estimate</a><div className="rounded-3xl border border-[#ded8ca] bg-white p-6 shadow-sm md:p-8"><div className="mb-7"><div className="display text-2xl font-bold text-[#0F2A22]">True<span className="text-[#C9A227]">Cost</span></div><p className="mt-6 text-xs font-bold uppercase tracking-[.18em] text-[#8a7a47]">Save your event</p><h1 className="display mt-2 text-4xl font-semibold text-[#0F2A22]">Create your lightweight account.</h1><p className="mt-3 text-sm leading-6 text-[#68726c]">No password. We'll send a one-time sign-in link or code.</p></div><div className="mb-6 grid grid-cols-2 rounded-xl bg-[#f5f2e9] p-1"><button onClick={()=>{setMode("email");setSent(false);setMessage("")}} className={`rounded-lg px-3 py-2.5 text-sm font-semibold ${mode==="email"?"bg-white text-[#0F2A22] shadow-sm":"text-[#68726c]"}`}><Mail className="mr-2 inline h-4 w-4"/>Email</button><button onClick={()=>{setMode("phone");setSent(false);setMessage("")}} className={`rounded-lg px-3 py-2.5 text-sm font-semibold ${mode==="phone"?"bg-white text-[#0F2A22] shadow-sm":"text-[#68726c]"}`}><Phone className="mr-2 inline h-4 w-4"/>Phone</button></div>{!sent ? <form onSubmit={sendCode}><label className="mb-2 block text-sm font-semibold">{mode === "email" ? "Email address" : "Phone number"}</label><input required type={mode === "email" ? "email" : "tel"} value={value} onChange={e=>setValue(e.target.value)} placeholder={mode === "email" ? "you@example.com" : "+234 801 234 5678"} className="mb-4 w-full rounded-xl border border-[#d9d1c1] bg-[#fcfbf8] px-4 py-3.5 text-sm outline-none focus:border-[#C9A227]"/><button disabled={loading} className="w-full rounded-xl bg-[#0F2A22] px-5 py-4 text-sm font-bold text-white disabled:opacity-60">{loading ? "Sending…" : mode === "email" ? "Send secure sign-in link" : "Send one-time code"}</button></form> : <form onSubmit={verifyPhone}><label className="mb-2 block text-sm font-semibold">Verification code</label><input required inputMode="numeric" value={otp} onChange={e=>setOtp(e.target.value)} placeholder="123456" className="mb-4 w-full rounded-xl border border-[#d9d1c1] bg-[#fcfbf8] px-4 py-3.5 text-sm tracking-[.25em] outline-none focus:border-[#C9A227]"/><button disabled={loading} className="w-full rounded-xl bg-[#0F2A22] px-5 py-4 text-sm font-bold text-white disabled:opacity-60">{loading ? "Verifying…" : "Verify and continue"}</button></form>}{message && <div className="mt-4 rounded-xl bg-[#edf3ef] p-3 text-sm text-[#315447]">{message}</div>}{error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}<div className="mt-6 flex gap-3 border-t border-[#eee8da] pt-5 text-xs leading-5 text-[#747b76]"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#0F2A22]"/><p>Your account is only used to save your TrueCost event and, later, your tracked quotes.</p></div></div></div></main>;
}
