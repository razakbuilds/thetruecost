"use client";

export default function DemooHome() {
  return (
    <main className="demoo-shell">
      <nav className="demoo-nav">
        <a className="demoo-brand" href="/demoo">TRUE<span>COST</span></a>
        <div><a href="/demoo/estimate">Estimate</a><a href="/demoo/dashboard">Dashboard</a></div>
      </nav>

      <section className="demoo-wrap demoo-hero">
        <div className="demoo-eyebrow">FREE → PRO PRODUCT DEMO</div>
        <h1>Know what your event should cost before the quotes start arriving.</h1>
        <p>Experience the TrueCost journey from a free event estimate to Pro quote tracking.</p>
        <div className="demoo-actions">
          <a className="demoo-btn demoo-primary" href="/demoo/estimate">Start the demo</a>
          <a className="demoo-btn demoo-light" href="/demoo/dashboard">Jump to dashboard</a>
        </div>
      </section>

      <section className="demoo-wrap demoo-grid">
        {[
          ["01", "Generate", "Create a practical Nigerian event budget."],
          ["02", "Save", "Save the estimate to your account."],
          ["03", "Upgrade", "Unlock real vendor quote tracking with Pro."],
          ["04", "Track", "Compare actual quotes against your baseline."],
        ].map(([n,t,d]) => (
          <div className="demoo-card" key={n}>
            <div className="demoo-num">{n}</div>
            <h3>{t}</h3>
            <p>{d}</p>
          </div>
        ))}
      </section>

      <div className="demoo-badge">DEMOO · FREE → PRO</div>
    </main>
  );
}
