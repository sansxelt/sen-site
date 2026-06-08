// Sections.jsx — editorial, asymmetric. No two sections share a layout.

// ───────────────────────── PROBLEM ─────────────────────────────────
// A lead cooling on a horizontal timeline. Vraelis pinned at 38s.
function Problem() {
  const nodes = [
    { t: "0 min", l: "Enquiry lands", sub: "Warm. Ready to talk." },
    { t: "5 min", l: "Still no reply", sub: "They're filling out the next form." },
    { t: "1 hour", l: "Cooling fast", sub: "Whoever called back already won." },
    { t: "1 day", l: "Gone", sub: "Booked with someone else." },
  ];
  return (
    <section id="problem" className="section">
      <div className="wrap">
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,0.85fr) minmax(0,1fr)", gap: "clamp(32px,5vw,72px)", alignItems: "end", marginBottom: "clamp(48px,6vw,80px)" }} className="cols-stack">
          <div>
            <Reveal as="p" className="eyebrow">The problem</Reveal>
            <Reveal as="h2" d="1" className="display" style={{ fontSize: "clamp(2.1rem, 4vw, 3.4rem)" }}>
              Whoever answers first wins.<br />It's rarely <span className="mark"><span>you.</span></span>
            </Reveal>
          </div>
          <Reveal as="p" d="2" className="lead-copy" style={{ paddingBottom: 6 }}>
            You're on a ladder, mid-appointment, or asleep. So the lead waits — and a waiting lead
            doesn't sit still. It cools by the minute and starts working down the list.
          </Reveal>
        </div>

        {/* cooling timeline */}
        <Reveal d="1">
          <div className="cool">
            {/* Vraelis pin */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "7px 13px", borderRadius: 999, background: "var(--acc)", color: "#fff", fontSize: 13, fontWeight: 600, marginBottom: 20 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff" }} className="pulse" />
              Vraelis replies at 0:38 — while they're still warm
            </div>
            <div className="cool__track" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginTop: 18 }} className="cool-nodes">
              {nodes.map((n, i) => (
                <div key={n.t} style={{ position: "relative", paddingTop: 4 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: i === 3 ? "#B23A3A" : "var(--fg-3)", marginBottom: 6 }}>{n.t}</div>
                  <div style={{ fontWeight: 600, fontSize: 16, color: i === 3 ? "#B23A3A" : "var(--fg-1)", marginBottom: 4, fontFamily: "var(--font-display)" }}>{n.l}</div>
                  <div style={{ fontSize: 13, color: "var(--fg-4)", lineHeight: 1.45 }}>{n.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ──────────────────────── HOW IT WORKS ─────────────────────────────
// Big-numeral asymmetric rows. Each step is editorial, not a card.
function HowItWorks() {
  const steps = [
    { k: "01", t: "A lead arrives", d: "Form, email, missed call, DM, or website chat. Vraelis grabs it wherever it lands — you don't lift a finger.", chips: ["Forms", "Email", "Calls", "DMs", "Chat"] },
    { k: "02", t: "It replies in seconds", d: "Under a minute, in your voice, while their phone is still in their hand. No “sorry for the delay” three hours later.", chips: ["< 1 min", "Your voice"] },
    { k: "03", t: "It asks, then chases", d: "The same questions you'd ask — budget, timing, what they need — then it nudges the quiet ones until they answer.", chips: ["Qualifies", "Follows up"] },
    { k: "04", t: "It books the call", d: "When they're ready, it offers your real openings, takes the slot, and reminds them so they actually turn up.", chips: ["Calendar", "Reminders"] },
  ];
  return (
    <section id="how" className="section" style={{ background: "var(--bg-2)" }}>
      <div className="wrap">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, flexWrap: "wrap", marginBottom: "clamp(40px,5vw,64px)" }}>
          <div style={{ maxWidth: 640 }}>
            <Reveal as="p" className="eyebrow">How it works</Reveal>
            <Reveal as="h2" d="1" className="display" style={{ fontSize: "clamp(2.1rem, 4vw, 3.4rem)" }}>
              Set it up once.<br />Then it just <span className="mark"><span>runs.</span></span>
            </Reveal>
          </div>
          <Reveal as="div" d="2" className="kicker" style={{ paddingBottom: 8 }}>connect forms · inbox · calendar — 4 steps, no code</Reveal>
        </div>

        <div>
          {steps.map((s, i) => (
            <Reveal key={s.k} d={(i % 2) + 1}>
              <div className="erow" style={{ padding: "clamp(24px,3vw,38px) 0" }}>
                <div className="bignum bignum--ghost">{s.k}</div>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: "clamp(16px,3vw,48px)", alignItems: "center" }} className="cols-stack">
                  <div>
                    <h3 style={{ fontSize: "clamp(1.3rem,2.2vw,1.7rem)", marginBottom: 10 }}>{s.t}</h3>
                    <p style={{ fontSize: 15, color: "var(--fg-3)", lineHeight: 1.55, maxWidth: 560 }}>{s.d}</p>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7, justifyContent: "flex-start" }}>
                    {s.chips.map((c) => <span key={c} className="pill">{c}</span>)}
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
          <div style={{ borderTop: "1px solid var(--line-1)" }} />
        </div>
      </div>
    </section>
  );
}

// ─────────────────────── WHAT IT AUTOMATES ─────────────────────────
// Bento — varied tile sizes, one hero tile, one ink tile.
function Automations() {
  return (
    <section id="automate" className="section">
      <div className="wrap">
        <div style={{ maxWidth: 720, marginBottom: "clamp(36px,4vw,52px)" }}>
          <Reveal as="p" className="eyebrow">What it handles</Reveal>
          <Reveal as="h2" d="1" className="display" style={{ fontSize: "clamp(2.1rem, 4vw, 3.4rem)", marginBottom: 16 }}>
            The chasing you keep meaning to do.
          </Reveal>
          <Reveal as="p" d="2" className="lead-copy">Six jobs that quietly cost you work when they don't happen. Vraelis just does them.</Reveal>
        </div>

        <Reveal d="1" as="div" className="bento">
          {/* hero accent tile */}
          <div className="tile tile--accent span3">
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, opacity: 0.85 }}>replies in</div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(2.6rem,5vw,3.6rem)", lineHeight: 1, letterSpacing: "-0.03em" }}>38<span style={{ fontSize: "0.5em" }}>s</span></div>
            <h3 style={{ fontSize: 17 }}>Instant replies</h3>
            <p style={{ fontSize: 14, lineHeight: 1.5 }}>Every lead hears back in seconds, in your words — not a robot auto-reply that screams “bot.”</p>
          </div>
          <div className="tile span3">
            <h3 style={{ fontSize: 17 }}>Qualifying questions</h3>
            <p style={{ fontSize: 14, color: "var(--fg-3)", lineHeight: 1.5 }}>It asks what you'd ask, then tells you who's ready to buy and who's just pricing around.</p>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: "auto" }}>
              <span className="pill st-qualified"><span className="dot" />Qualified</span>
              <span className="pill st-new"><span className="dot" />Just looking</span>
            </div>
          </div>

          <div className="tile span2">
            <h3 style={{ fontSize: 16 }}>Follow-ups</h3>
            <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.5 }}>Most leads need a few nudges. It sends them and stops the second someone replies.</p>
          </div>
          <div className="tile span2">
            <h3 style={{ fontSize: 16 }}>Booking & reminders</h3>
            <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.5 }}>Shares your real calendar, books the slot, reminds them the day before. Fewer no-shows.</p>
          </div>
          <div className="tile span2">
            <h3 style={{ fontSize: 16 }}>Owner handoff</h3>
            <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.5 }}>When a lead is big, ready, or stuck, it taps you on the shoulder instead of guessing.</p>
          </div>

          {/* wide tile — pipeline */}
          <div className="tile span6" style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 20, background: "var(--acc-soft)", borderColor: "var(--acc-line)" }}>
            <div style={{ maxWidth: 440 }}>
              <h3 style={{ fontSize: 18, marginBottom: 8 }}>Pipeline tracking</h3>
              <p style={{ fontSize: 14, lineHeight: 1.5, color: "var(--fg-3)" }}>Every lead, always placed — so you open the app and instantly know where the money is.</p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[["New", "st-new"], ["Contacted", "st-contacted"], ["Qualified", "st-qualified"], ["Booked", "st-booked"], ["Won", "st-won"]].map(([l, c]) => (
                <span key={l} className={`pill ${c}`}><span className="dot" />{l}</span>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

Object.assign(window, { Problem, HowItWorks, Automations });
