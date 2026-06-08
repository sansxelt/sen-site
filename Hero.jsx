// Hero.jsx — value prop + embedded live dashboard.

function Hero({ onCta }) {
  return (
    <section id="top" style={{ position: "relative", overflow: "hidden", borderBottom: "1px solid var(--line-1)" }}>
      <div className="gridbg" />
      <div aria-hidden style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 55% 45% at 50% 8%, rgba(14,158,108,0.07) 0%, transparent 68%)",
      }} />
      <div className="wrap" style={{ position: "relative", paddingTop: "clamp(56px, 9vw, 104px)", paddingBottom: "clamp(40px, 6vw, 72px)" }}>
        {/* copy block */}
        <div style={{ maxWidth: 880 }}>
          <Reveal as="p" className="eyebrow rise" d="1">AI lead follow-up agent</Reveal>
          <h1 className="display rise" data-d="2" style={{ marginBottom: 24, maxWidth: 940 }}>
            Turn missed leads into <span className="em">booked</span> calls.
          </h1>
          <p className="rise" data-d="3" style={{ fontSize: "clamp(1.05rem, 1.5vw, 1.3rem)", color: "var(--fg-2)", maxWidth: 640, marginBottom: 34, lineHeight: 1.5 }}>
            A form comes in at 11pm. Vraelis replies in under a minute, works out what they want,
            keeps following up until they answer, and drops the booking on your calendar.
            You wake up to a booked job — not a missed one.
          </p>
          <div className="rise" data-d="4" style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 26 }}>
            <button className="btn btn--lg" onClick={onCta}>Start free <span aria-hidden>→</span></button>
            <a href="#how" className="btn btn--ghost btn--lg">See how it works</a>
          </div>
          <div className="rise" data-d="5" style={{ display: "flex", gap: 22, flexWrap: "wrap", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-4)", letterSpacing: "0.02em" }}>
            <Trust>No new CRM required</Trust>
            <Trust>Connect forms, inboxes & calendars</Trust>
            <Trust>Human handoff when needed</Trust>
          </div>
        </div>

        {/* dashboard */}
        <Reveal d="2" style={{ marginTop: "clamp(40px, 6vw, 64px)" }}>
          <Dashboard />
          <div style={{ display: "flex", alignItems: "center", gap: 9, justifyContent: "center", marginTop: 16, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-4)", letterSpacing: "0.04em" }}>
            <span className="dot dot--acc" /> Click any lead — that's the real conversation and follow-up behind it
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Trust({ children }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span style={{ color: "var(--acc)" }}>✓</span>{children}
    </span>
  );
}

Object.assign(window, { Hero });
