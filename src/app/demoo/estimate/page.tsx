"use client";

import { useState } from "react";

const KEY = "truecost-demoo";
const rows = [
  ["Venue", 1000000],
  ["Catering", 1200000],
  ["Decor", 800000],
  ["Photography", 450000],
  ["Music", 350000],
  ["Attire", 600000],
];

const money = (n:number) => "₦" + n.toLocaleString("en-NG");

export default function DemooEstimate() {
  const [generated, setGenerated] = useState(false);
  const [saved, setSaved] = useState(false);
  const total = rows.reduce((s, [,v]) => s + Number(v), 0);

  function saveEstimate() {
    localStorage.setItem(KEY, JSON.stringify({
      saved: true,
      pro: false,
      quotes: [
        { category: "Venue", amount: 950000, vendor: "Civic Centre" },
        { category: "Catering", amount: 1220000, vendor: "Taste & Tray" }
      ]
    }));
    setSaved(true);
  }

  return (
    <main className="demoo-shell">
      <Nav />
      <section className="demoo-wrap demoo-section">
        <div className="demoo-eyebrow">STEP 1 · FREE ESTIMATE</div>
        <h1>Build your event baseline</h1>
        <p className="demoo-muted">Demo event: Lagos wedding · 350 guests · Classic.</p>

        {!generated ? (
          <div className="demoo-card demoo-large">
            <div className="demoo-info-grid">
              <div><b>Event</b><span>Wedding</span></div>
              <div><b>City</b><span>Lagos</span></div>
              <div><b>Guests</b><span>350</span></div>
            </div>
            <button className="demoo-btn demoo-primary" onClick={() => setGenerated(true)}>Generate estimate</button>
          </div>
        ) : (
          <>
            <div className="demoo-notice">Estimate generated. This is your neutral budget baseline.</div>
            <div className="demoo-card">
              <div className="demoo-total">{money(total)}</div>
              <p className="demoo-muted">Estimated total event budget</p>
              <table className="demoo-table">
                <thead><tr><th>Category</th><th>Budget</th><th>%</th></tr></thead>
                <tbody>{rows.map(([c,v]) => (
                  <tr key={c as string}><td>{c}</td><td>{money(Number(v))}</td><td>{Math.round(Number(v)/total*100)}%</td></tr>
                ))}</tbody>
              </table>
            </div>

            <div className="demoo-actions">
              {!saved ? (
                <button className="demoo-btn demoo-primary" onClick={saveEstimate}>Save estimate & continue</button>
              ) : (
                <a className="demoo-btn demoo-primary" href="/demoo/dashboard">Continue to dashboard</a>
              )}
              <a className="demoo-btn demoo-light" href="/demoo">Back</a>
            </div>

            {saved && <div className="demoo-notice">Demo login completed. Your estimate is now saved.</div>}
          </>
        )}
      </section>
      <div className="demoo-badge">DEMOO · FREE → PRO</div>
    </main>
  );
}

function Nav() {
  return <nav className="demoo-nav">
    <a className="demoo-brand" href="/demoo">TRUE<span>COST</span></a>
    <div><a href="/demoo/estimate">Estimate</a><a href="/demoo/dashboard">Dashboard</a></div>
  </nav>;
}
