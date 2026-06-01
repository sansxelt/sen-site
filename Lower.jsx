// Lower.jsx — deep dashboard, use cases, pricing, final CTA, footer.

// ──────────────── DEEPER DASHBOARD PREVIEW ─────────────────────────
function DeepDashboard({ onCta }) {
  const lead = LEADS[0]; // Marcus — booked roofing estimate
  return (
    <section id="dashboard" className="section" style={{ position: "relative", overflow: "hidden" }}>
      <div className="gridbg" style={{ opacity: 0.4 }} />
      <div className="wrap" style={{ position: "relative" }}>
        <div style={{ maxWidth: 760, marginBottom: "clamp(36px, 5vw, 56px)" }}>
          <Reveal as="p" className="eyebrow">Inside the dashboard</Reveal>
          <Reveal as="h2" d="1" className="display" style={{ fontSize: "clamp(2rem, 3.6vw, 3.2rem)", marginBottom: 18 }}>
            What happened to one <span className="em">$4,200</span> lead.
          </Reveal>
          <Reveal as="p" d="2" className="lead-copy">
            Marcus filled out the website form at 9:14am asking for a re-roof quote. Here's the whole thing —
            answered, qualified, booked — and nobody on the team had to touch it.
          </Reveal>
        </div>

        <Reveal d="1" className="win">
          <div className="win__bar">
            <div className="win__dots"><i /><i /><i /></div>
            <span className="win__addr"><span className="dot dot--acc" /> app.vraelis.com/leads/marcus-bell</span>
            <span style={{ marginLeft: "auto" }} className="pill st-booked"><span className="dot" />Booked</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr)" }} className="deep-body">
            {/* conversation */}
            <div style={{ borderRight: "1px solid var(--line-1)", display: "flex", flexDirection: "column", minWidth: 0 }}>
              <PanelLabel>Conversation · {lead.source}</PanelLabel>
              <Conversation lead={lead} height={340} />
            </div>
            {/* right rail */}
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <PanelLabel>Follow-up automation</PanelLabel>
              <div style={{ padding: "18px 18px 4px" }}><FollowupTimeline lead={lead} /></div>
              <div style={{ padding: "14px 18px", borderTop: "1px solid var(--line-1)", marginTop: "auto" }}>
                <div style={{ padding: "12px 14px", borderRadius: 4, border: "1px solid var(--acc-line)", background: "var(--acc-soft)", marginBottom: 12 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--acc)", marginBottom: 5 }}>Booking status</div>
                  <div style={{ fontSize: 13, color: "var(--fg-1)", lineHeight: 1.4 }}>{lead.booking}</div>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 6 }}>Revenue recovered</div>
                    <div className="tnum" style={{ fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 500, letterSpacing: "-0.02em", color: "var(--money)", lineHeight: 1 }}>${lead.value.toLocaleString()}</div>
                  </div>
                  <span className="pill"><span className="dot dot--acc" />0 min of staff time</span>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal d="2" style={{ marginTop: 28, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn btn--lg" onClick={onCta}>Start free <span aria-hidden>→</span></button>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-4)" }}>Connect a form and watch your next lead get answered the same way</span>
        </Reveal>
      </div>
    </section>
  );
}

function PanelLabel({ children }) {
  return (
    <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--line-1)", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)" }}>
      {children}
    </div>
  );
}

// ──────────────────────────── USE CASES ────────────────────────────
// Horizontal scroll-snap strip — distinct from every other section.
function UseCases() {
  const cases = [
    { t: "Agencies", n: "01", d: "A referral DMs you at midnight. By the time you're up, it's qualified and the intro call is already on your calendar.", m: "Intro calls booked overnight", c: "#2563EB" },
    { t: "Contractors", n: "02", d: "You can't answer a quote request from the top of a ladder. Vraelis can — it gets the details and books the estimate.", m: "Quotes answered on the job", c: "#0E9E6C" },
    { t: "Clinics", n: "03", d: "Missed call? It texts back in under a minute and books the new patient before they try the clinic down the road.", m: "Missed calls texted back in 40s", c: "#0D9488" },
    { t: "Studios", n: "04", d: "Class and session questions land at 10pm. They get answered and booked then — not when the front desk opens.", m: "Booked after hours", c: "#7C3AED" },
    { t: "Consultants", n: "05", d: "It screens the tire-kickers and drops the serious, in-budget leads straight onto your calendar.", m: "Only real calls get through", c: "#C2540C" },
  ];
  return (
    <section id="usecases" className="section" style={{ overflow: "hidden" }}>
      <div className="wrap">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, flexWrap: "wrap", marginBottom: "clamp(28px,3vw,40px)" }}>
          <div style={{ maxWidth: 620 }}>
            <Reveal as="p" className="eyebrow">Who it's for</Reveal>
            <Reveal as="h2" d="1" className="display" style={{ fontSize: "clamp(2.1rem, 4vw, 3.4rem)" }}>
              If you lose money when leads wait, this is for <span className="mark"><span>you.</span></span>
            </Reveal>
          </div>
          <Reveal as="div" d="2" className="kicker" style={{ paddingBottom: 8 }}>scroll →</Reveal>
        </div>
      </div>
      <Reveal d="1">
        <div style={{ display: "flex", gap: 18, overflowX: "auto", scrollSnapType: "x mandatory", padding: "4px clamp(20px,4vw,64px) 20px", WebkitOverflowScrolling: "touch" }} className="uc-strip">
          {cases.map((c) => (
            <div key={c.t} style={{ scrollSnapAlign: "start", flex: "0 0 auto", width: "min(360px, 80vw)", background: "var(--bg-1)", border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", boxShadow: "var(--shadow-card)", padding: 26, display: "flex", flexDirection: "column", gap: 14, minHeight: 280 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ width: 38, height: 38, borderRadius: 11, background: c.c, display: "grid", placeItems: "center", color: "#fff", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14 }}>{c.n}</span>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.c }} />
              </div>
              <h3 style={{ fontSize: 22, letterSpacing: "-0.02em" }}>{c.t}</h3>
              <p style={{ fontSize: 14.5, color: "var(--fg-3)", lineHeight: 1.55, flex: 1 }}>{c.d}</p>
              <div style={{ paddingTop: 14, borderTop: "1px solid var(--line-1)", display: "flex", alignItems: "center", gap: 9, fontSize: 13, fontWeight: 600, color: c.c }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.c }} />{c.m}
              </div>
            </div>
          ))}
          <div style={{ flex: "0 0 clamp(20px,4vw,64px)" }} />
        </div>
      </Reveal>
    </section>
  );
}

// ──────────────────────────── PRICING ──────────────────────────────
function Pricing({ onCta }) {
  const tiers = [
    {
      name: "Starter", price: "$0", unit: "free to start", who: "For solo operators getting their first leads answered.",
      feats: ["1 inbound channel", "Instant AI replies", "Basic follow-up sequence", "Calendar booking", "Pipeline tracking"],
      cta: "Start free", featured: false,
    },
    {
      name: "Growth", price: "$89", unit: "/ month", who: "For small businesses with steady inbound leads.",
      feats: ["All channels connected", "Smart qualification & scoring", "Multi-step follow-up", "Owner handoff alerts", "Reminders & no-show recovery", "Revenue-recovered reporting"],
      cta: "Request access", featured: true,
    },
    {
      name: "Agency", price: "Custom", unit: "talk to us", who: "For teams managing leads across multiple clients.",
      feats: ["Multiple workspaces", "Per-client pipelines & branding", "Shared team inbox", "Roles & permissions", "Priority support", "Onboarding help"],
      cta: "Contact sales", featured: false,
    },
  ];
  return (
    <section id="pricing" className="section">
      <div className="wrap">
        <div style={{ maxWidth: 720, marginBottom: "clamp(36px, 5vw, 56px)" }}>
          <Reveal as="p" className="eyebrow">Pricing</Reveal>
          <Reveal as="h2" d="1" className="display" style={{ fontSize: "clamp(2rem, 3.6vw, 3.2rem)", marginBottom: 18 }}>
            Costs less than one lost job.
          </Reveal>
          <Reveal as="p" d="2" className="lead-copy">Start on the free plan. Upgrade once it's booking more work than it costs you — not before.</Reveal>
        </div>
        <div className="grid cols-3" style={{ alignItems: "start" }}>
          {tiers.map((t, i) => {
            const ink = t.featured;
            return (
            <Reveal key={t.name} d={i + 1} style={{ display: "flex", flexDirection: "column", gap: 18, position: "relative", borderRadius: "var(--r-sm)", padding: "clamp(22px,2.4vw,30px)", paddingTop: ink ? 34 : "clamp(22px,2.4vw,30px)",
              background: ink ? "var(--acc-soft)" : "var(--bg-1)",
              border: ink ? "1.5px solid var(--acc)" : "1px solid var(--line-2)",
              boxShadow: ink ? "0 30px 60px -28px rgba(14,158,108,0.28)" : "var(--shadow-card)",
              transform: ink ? "translateY(-10px)" : "none" }}>
              {ink && (
                <span className="pill" style={{ position: "absolute", top: -11, left: 24, background: "var(--acc)", color: "#fff", borderColor: "var(--acc)" }}>Most popular</span>
              )}
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: ink ? "var(--acc-deep)" : "var(--fg-3)", marginBottom: 14 }}>{t.name}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span className="tnum" style={{ fontFamily: "var(--font-display)", fontSize: 42, fontWeight: 700, letterSpacing: "-0.04em", color: "var(--fg-1)" }}>{t.price}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-4)" }}>{t.unit}</span>
                </div>
                <p style={{ fontSize: 13.5, color: "var(--fg-3)", marginTop: 12, lineHeight: 1.5 }}>{t.who}</p>
              </div>
              <button className={ink ? "btn" : "btn btn--ghost"} onClick={onCta} style={{ width: "100%", justifyContent: "center" }}>{t.cta}</button>
              <div style={{ display: "flex", flexDirection: "column", gap: 11, paddingTop: 4 }}>
                {t.feats.map((f) => (
                  <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13.5, color: "var(--fg-2)" }}>
                    <span style={{ color: "var(--acc)", marginTop: 1 }}>✓</span>{f}
                  </div>
                ))}
              </div>
            </Reveal>
            );
          })}
        </div>
        <Reveal d="1" as="p" style={{ marginTop: 28, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-4)", textAlign: "center" }}>
          Plans are indicative while we finalize early access. No card required to start.
        </Reveal>
      </div>
    </section>
  );
}

// ──────────────────────────── FINAL CTA ────────────────────────────
function FinalCTA({ onCta }) {
  return (
    <section className="section" style={{ position: "relative", overflow: "hidden", textAlign: "center" }}>
      <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 50% 60% at 50% 45%, rgba(14,158,108,0.10) 0%, transparent 65%)" }} />
      <div className="wrap" style={{ position: "relative", maxWidth: 820 }}>
        <Reveal as="h2" className="display" style={{ fontSize: "clamp(2.4rem, 5vw, 4rem)", marginBottom: 22 }}>
          Stop letting warm leads <span className="em">go cold.</span>
        </Reveal>
        <Reveal as="p" d="1" className="lead-copy" style={{ margin: "0 auto 34px", textAlign: "center" }}>
          Connect a form in a few minutes. The next lead that comes in gets answered — even if it's 2am and you're asleep.
        </Reveal>
        <Reveal d="2" style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginBottom: 22 }}>
          <button className="btn btn--lg" onClick={onCta}>Start free <span aria-hidden>→</span></button>
          <button className="btn btn--ghost btn--lg" onClick={onCta}>Request access</button>
        </Reveal>
        <Reveal d="3" style={{ display: "flex", gap: 22, justifyContent: "center", flexWrap: "wrap", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-4)" }}>
          <span>No new CRM</span><span style={{ color: "var(--fg-5)" }}>·</span>
          <span>Live in minutes</span><span style={{ color: "var(--fg-5)" }}>·</span>
          <span>Human handoff anytime</span>
        </Reveal>
      </div>
    </section>
  );
}

// ──────────────────────────── FOOTER ───────────────────────────────
function SiteFooter() {
  return (
    <footer style={{ padding: "var(--s-16) var(--gutter) var(--s-12)" }}>
      <div style={{ maxWidth: "var(--max-content)", margin: "0 auto", display: "flex", flexWrap: "wrap", gap: 28, justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ maxWidth: 320 }}>
          <div style={{ display: "inline-flex", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.03em", color: "var(--fg-1)" }}>vraelis</span>
          </div>
          <p style={{ fontSize: 13, color: "var(--fg-4)", lineHeight: 1.55 }}>The AI that answers, qualifies, and books your inbound leads — so a missed call stops being a missed job.</p>
        </div>
        <div style={{ display: "flex", gap: "clamp(36px, 6vw, 80px)", flexWrap: "wrap" }}>
          <FooterCol title="Product" links={["How it works", "What it automates", "Dashboard", "Pricing"]} />
          <FooterCol title="Company" links={["About", "Careers", "Contact", "Privacy"]} />
          <FooterCol title="Get started" links={["Start free", "Request access", "Sign in"]} />
        </div>
      </div>
      <div style={{ maxWidth: "var(--max-content)", margin: "var(--s-12) auto 0", paddingTop: "var(--s-6)", borderTop: "1px solid var(--line-1)", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-5)" }}>
        <span>© 2026 Vraelis</span>
        <span>Turn missed leads into booked calls.</span>
      </div>
    </footer>
  );
}
function FooterCol({ title, links }) {
  return (
    <div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 14 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {links.map((l) => <a key={l} href="#" style={{ fontSize: 13, color: "var(--fg-3)", textDecoration: "none" }}>{l}</a>)}
      </div>
    </div>
  );
}

Object.assign(window, { DeepDashboard, UseCases, Pricing, FinalCTA, SiteFooter });
