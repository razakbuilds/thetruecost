"use client";

import { useEffect, useMemo, useState } from "react";

const KEY = "truecost-demoo";
const budgets: Record<string, number> = {
  Venue: 1000000,
  Catering: 1200000,
  Decor: 800000,
  Photography: 450000,
  Music: 350000,
  Attire: 600000,
};

type Quote = { category:string; amount:number; vendor:string };
type State = { saved:boolean; pro:boolean; quotes:Quote[] };

const money = (n:number) => "₦" + n.toLocaleString("en-NG");

export default function DemooDashboard() {
  const [state,setState] = useState<State>({
    saved:true,
    pro:false,
    quotes:[
      {category:"Venue",amount:950000,vendor:"Civic Centre"},
      {category:"Catering",amount:1220000,vendor:"Taste & Tray"}
    ]
  });
  const [loggedIn,setLoggedIn] = useState(false);
  const [category,setCategory] = useState("Decor");
  const [amount,setAmount] = useState("");
  const [vendor,setVendor] = useState("");
  const [message,setMessage] = useState("");

  useEffect(() => {
    const raw = localStorage.getItem(KEY);
    if (raw) setState(JSON.parse(raw));
  }, []);

  function persist(next:State) {
    setState(next);
    localStorage.setItem(KEY,JSON.stringify(next));
  }

  const rows = useMemo(() => Object.entries(budgets).map(([category,budget]) => {
    const actual = state.quotes.filter(q => q.category === category).reduce((s,q) => s + q.amount,0);
    return {category,budget,actual,variance:actual-budget};
  }),[state.quotes]);

  const totalBudget = Object.values(budgets).reduce((s,v)=>s+v,0);
  const totalActual = rows.reduce((s,r)=>s+r.actual,0);
  const totalVariance = totalActual-totalBudget;
  const percent = totalBudget ? (totalVariance/totalBudget)*100 : 0;

  function flash(text:string) {
    setMessage(text);
    setTimeout(()=>setMessage(""),2800);
  }

  function simulateLogin() {
    setLoggedIn(true);
    flash("Signed in successfully. Your estimate is saved.");
  }

  function upgrade() {
    persist({...state,pro:true});
    flash("Paystack payment simulated. TrueCost Pro is now active.");
  }

  function addQuote() {
    const n = Number(amount.replace(/[^0-9]/g,""));
    if (!n) return;
    persist({...state,quotes:[...state.quotes,{category,amount:n,vendor:vendor||"Vendor quote"}]});
    setAmount("");
    setVendor("");
    flash("Vendor quote logged. Variance recalculated.");
  }

  return (
    <main className="demoo-shell">
      <Nav />
      <section className="demoo-wrap demoo-section">
        <div className="demoo-head">
          <div>
            <div className="demoo-eyebrow">STEP 2 → 5 · ACCOUNT → PRO</div>
            <h1>Good morning, Ada</h1>
            <p className="demoo-muted">Lagos Wedding · 350 guests · Classic</p>
          </div>
          {!loggedIn ? (
            <button className="demoo-btn demoo-light" onClick={simulateLogin}>Simulate login</button>
          ) : <span className="demoo-pill">● SIGNED IN</span>}
        </div>

        {message && <div className="demoo-notice">{message}</div>}

        <div className="demoo-metrics">
          <Metric label="Baseline" value={money(totalBudget)} />
          <Metric label="Actual quotes" value={money(totalActual)} />
          <Metric label="Variance" value={`${totalVariance > 0 ? "+" : ""}${money(totalVariance)}`} negative={totalVariance > 0} />
          <Metric label="Plan" value={state.pro ? "PRO" : "FREE"} />
        </div>

        {!state.pro ? (
          <div className="demoo-upgrade">
            <span className="demoo-pill demoo-gold">TRUECOST PRO</span>
            <h2>Turn your estimate into a live budget tracker.</h2>
            <p>You've moved from estimating to receiving real vendor quotes. Upgrade to compare budgeted vs actual and track variance.</p>
            <ul>
              <li>Log real vendor quotes</li>
              <li>Track multiple quotes per category</li>
              <li>See category and overall variance</li>
            </ul>
            <button className="demoo-btn demoo-gold-btn" onClick={upgrade}>Upgrade to Pro · ₦5,000/month</button>
            <small>Demo mode: Paystack checkout is simulated.</small>
          </div>
        ) : (
          <>
            <div className="demoo-card">
              <div className="demoo-head">
                <div><h2>Budget vs actual</h2><p className="demoo-muted">Overall position: <b>{percent.toFixed(1)}%</b> {totalVariance > 0 ? "over" : "under"} baseline.</p></div>
                <span className="demoo-pill demoo-gold">PRO ACTIVE</span>
              </div>
              <table className="demoo-table">
                <thead><tr><th>Category</th><th>Budgeted</th><th>Actual</th><th>Variance</th></tr></thead>
                <tbody>{rows.map(r => (
                  <tr key={r.category}>
                    <td><b>{r.category}</b></td><td>{money(r.budget)}</td><td>{money(r.actual)}</td>
                    <td className={r.variance > 0 ? "demoo-negative" : "demoo-positive"}>{r.variance > 0 ? "+" : ""}{money(r.variance)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>

            <div className="demoo-card">
              <h2>Log a vendor quote</h2>
              <p className="demoo-muted">Try the key Pro moment: enter a real quote and watch the variance change.</p>
              <div className="demoo-form">
                <select value={category} onChange={e=>setCategory(e.target.value)}>
                  {Object.keys(budgets).map(x=><option key={x}>{x}</option>)}
                </select>
                <input value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Quote amount (₦)" />
                <input value={vendor} onChange={e=>setVendor(e.target.value)} placeholder="Vendor name (optional)" />
                <button className="demoo-btn demoo-primary" onClick={addQuote}>Log quote</button>
              </div>
            </div>
          </>
        )}

        <div className="demoo-actions">
          <a className="demoo-btn demoo-light" href="/demoo/estimate">Restart estimate</a>
          <a className="demoo-btn demoo-light" href="/demoo">Demo home</a>
        </div>
      </section>
      <div className="demoo-badge">DEMOO · FREE → PRO</div>
    </main>
  );
}

function Metric({label,value,negative=false}:{label:string;value:string;negative?:boolean}) {
  return <div className="demoo-metric"><span>{label}</span><strong className={negative?"demoo-negative":""}>{value}</strong></div>;
}

function Nav() {
  return <nav className="demoo-nav">
    <a className="demoo-brand" href="/demoo">TRUE<span>COST</span></a>
    <div><a href="/demoo/estimate">Estimate</a><a href="/demoo/dashboard">Dashboard</a></div>
  </nav>;
}
