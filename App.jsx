// App.jsx — assembles the page + a lightweight access-request modal.

function AccessModal({ open, onClose }) {
  const [done, setDone] = React.useState(false);
  React.useEffect(() => {
    if (!open) { return; }
    const onKey = (e) => { if (e.key === "Escape") { onClose(); } };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, onClose]);
  React.useEffect(() => { if (!open) { setDone(false); } }, [open]);
  if (!open) { return null; }
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 100, display: "grid", placeItems: "center",
      background: "rgba(6,10,18,0.78)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", padding: 20,
    }}>
      <div onClick={(e) => e.stopPropagation()} className="win" style={{ width: "min(440px, 100%)", animation: "rise 360ms var(--ease-out) forwards" }}>
        <div className="win__bar">
          <div className="win__dots"><i /><i /><i /></div>
          <span className="win__addr"><span className="dot dot--acc" /> app.vraelis.com/start</span>
          <button onClick={onClose} aria-label="Close" style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--fg-4)", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 0 }}>✕</button>
        </div>
        <div style={{ padding: "26px 26px 28px" }}>
          {!done ? (
            <React.Fragment>
              <p className="eyebrow" style={{ marginBottom: 14 }}>Early access</p>
              <h3 style={{ fontSize: 22, letterSpacing: "-0.02em", marginBottom: 10, color: "var(--fg-1)" }}>Get your leads answered.</h3>
              <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.55, marginBottom: 22 }}>
                Tell us where to send your link, connect one form, and your next lead gets answered in seconds.
              </p>
              <form onSubmit={(e) => { e.preventDefault(); setDone(true); }} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <input type="text" placeholder="Business name" required />
                <input type="email" placeholder="Work email" required />
                <button type="submit" className="btn" style={{ justifyContent: "center", marginTop: 4 }}>Start free <span aria-hidden>→</span></button>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-4)", textAlign: "center", marginTop: 2 }}>No card required · no spam</p>
              </form>
            </React.Fragment>
          ) : (
            <div style={{ textAlign: "center", padding: "16px 0 8px" }}>
              <div style={{ width: 46, height: 46, borderRadius: "50%", border: "1px solid var(--acc-line)", background: "var(--acc-soft)", color: "var(--acc)", display: "grid", placeItems: "center", margin: "0 auto 18px", fontSize: 22 }}>✓</div>
              <h3 style={{ fontSize: 20, letterSpacing: "-0.02em", marginBottom: 10, color: "var(--fg-1)" }}>You're on the list.</h3>
              <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.55, marginBottom: 22 }}>We'll email your access link shortly. In the meantime, no lead goes unanswered.</p>
              <button onClick={onClose} className="btn btn--ghost" style={{ justifyContent: "center" }}>Back to site</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Standalone dashboard page — focused on the live product, not marketing.
function DashboardPage() {
  return (
    <section className="section" id="top" style={{ position: "relative", overflow: "hidden" }}>
      <div className="gridbg" style={{ opacity: 0.4 }} />
      <div className="wrap" style={{ position: "relative" }}>
        <div style={{ maxWidth: 760, marginBottom: "clamp(32px,4vw,48px)" }}>
          <p className="eyebrow">The dashboard</p>
          <h1 className="display" style={{ fontSize: "clamp(2.1rem, 4vw, 3.4rem)", marginBottom: 16 }}>
            Every lead, in one <span className="mark"><span>live</span></span> view.
          </h1>
          <p className="lead-copy">Click any lead to see the conversation Vraelis is having and the follow-up it has queued. This is the real thing — not a screenshot.</p>
        </div>
        <Dashboard />
      </div>
    </section>
  );
}

function PageShell({ active, children }) {
  const [open, setOpen] = React.useState(false);
  const onCta = React.useCallback(() => setOpen(true), []);
  return (
    <React.Fragment>
      <Nav onCta={onCta} active={active} />
      {typeof children === "function" ? children(onCta) : children}
      <FinalCTA onCta={onCta} />
      <SiteFooter />
      <AccessModal open={open} onClose={() => setOpen(false)} />
    </React.Fragment>
  );
}

function App() {
  const page = (typeof window !== "undefined" && window.__PAGE) || "home";
  if (page === "how") {
    return <PageShell active="how">{(onCta) => <React.Fragment><HowItWorks /><DeepDashboard onCta={onCta} /></React.Fragment>}</PageShell>;
  }
  if (page === "automates") {
    return <PageShell active="automates">{(onCta) => <React.Fragment><Automations /><UseCases /></React.Fragment>}</PageShell>;
  }
  if (page === "dashboard") {
    return <PageShell active="dashboard">{(onCta) => <React.Fragment><DashboardPage /><DeepDashboard onCta={onCta} /></React.Fragment>}</PageShell>;
  }
  if (page === "pricing") {
    return <PageShell active="pricing">{(onCta) => <React.Fragment><Pricing onCta={onCta} /><UseCases /></React.Fragment>}</PageShell>;
  }
  // home
  return (
    <PageShell active="">
      {(onCta) => (
        <React.Fragment>
          <Hero onCta={onCta} />
          <Problem />
          <HowItWorks />
          <Automations />
          <DeepDashboard onCta={onCta} />
          <UseCases />
          <Pricing onCta={onCta} />
        </React.Fragment>
      )}
    </PageShell>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
