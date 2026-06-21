import { PLAN_CATALOG } from "@/lib/v-plans";
import { ogMeta } from "@/lib/og-meta";

export const metadata = ogMeta({
  title: "Vraelis — test generated content with real users",
  description: "A feedback network for AI apps and creative teams. Test generated options with real users, get clear reports on what wins, and turn feedback into revenue.",
  path: "/",
});

// Minimal line icons — geometric, single-stroke, on-brand.
function Icon({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}
const ICONS = {
  spark: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2",
  layers: "M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17l9 5 9-5",
  flag: "M4 21V4M4 4h13l-2 4 2 4H4",
  film: "M3 4h18v16H3zM3 9h18M3 15h18M8 4v16M16 4v16",
  upload: "M12 16V4M8 8l4-4 4 4M4 20h16",
  users: "M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 20v-2a4 4 0 0 0-3-3.87M16 2.13A4 4 0 0 1 16 10",
  report: "M9 17v-6M12 17v-3M15 17v-9M4 4h16v16H4z",
  revenue: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
};

const AUDIENCE = [
  { t: "AI apps", d: "Test generated outputs with real users right inside your product.", i: ICONS.spark },
  { t: "Creative tools", d: "Let users pick the best variation before they export.", i: ICONS.layers },
  { t: "Brands & agencies", d: "Validate campaigns and creative before you spend.", i: ICONS.flag },
  { t: "Creators & studios", d: "Know which thumbnail, cover, or cut actually wins.", i: ICONS.film },
];

const STEPS = [
  { k: "01", t: "Send your options", d: "Drop in 2–8 versions from your tool or pipeline — generated images, ads, thumbnails, landing pages, UI, or copy. Web, API, or embed.", i: ICONS.upload },
  { k: "02", t: "Real people choose & explain", d: "Vraelis routes your test to real humans who pick what they prefer and say why. Bots, rushers, and spam are filtered out automatically.", i: ICONS.users },
  { k: "03", t: "Get a clear report", d: "The winner, the vote breakdown, confidence, the reasons, an AI read on what to improve, and valid-vs-filtered vote quality.", i: ICONS.report },
  { k: "04", t: "Turn feedback into revenue", d: "For AI apps, preference activity becomes a data layer you own — improve your model and open a feedback-driven revenue stream.", i: ICONS.revenue },
];

const TESTABLE = ["Generated creative", "Campaign concepts", "Product visuals", "Landing pages", "Brand assets", "UI concepts", "Content variations", "Thumbnails & covers"];

const REPORT_PARTS = [
  "The winner + full vote breakdown",
  "Confidence and win margin",
  "Real comments on why people chose",
  "AI analysis: why it won, what to fix",
  "Valid-vs-filtered vote quality",
  "A shareable, client-ready report link",
];

const SUPPORTS: [string, string][] = [
  ["Real-user voting", "Quality-filtered humans, not bots."],
  ["Anti-abuse filtering", "Too-fast, duplicate & spam votes rejected."],
  ["Shareable reports", "Send a read-only verdict to clients."],
  ["Embeddable tests", "Collect votes on any site in one line."],
  ["API for AI apps", "Send options, get a ranked result."],
  ["Webhooks", "Get notified the moment a test completes."],
  ["JSON / CSV exports", "Pull the structured preference data."],
  ["On-site checkout", "Cards & wallets — never leave Vraelis."],
];

const API_RESPONSE = `{
  "id": "test_9f2a3c",
  "status": "complete",
  "votes_valid": 122,
  "votes_filtered": 14,
  "winner": { "option": "B", "pct": 61 },
  "ranked": [
    { "option": "B", "pct": 61 },
    { "option": "A", "pct": 39 },
    { "option": "C", "pct": 22 }
  ]
}`;

// the signature device — a verdict bar
function Verdict({ rows }: { rows: [string, number, boolean][] }) {
  return (
    <div className="verdict">
      {rows.map(([k, p, win]) => (
        <div className="vrow" key={k}>
          <span className="vrow__k">{k}</span>
          <span className="vrow__track"><span className={`vrow__fill${win ? " win" : ""}`} style={{ width: `${p}%` }} /></span>
          <span className="vrow__p">{p}%</span>
        </div>
      ))}
    </div>
  );
}

export default function RankLanding() {
  return (
    <>
      {/* ── Hero ── */}
      <section style={{ position: "relative" }}>
        <div className="glow glow--bleed" />
        <div className="grid-faint" />
        <div className="wrap" style={{ position: "relative", zIndex: 1, paddingTop: "clamp(48px, 7vw, 96px)", paddingBottom: "clamp(40px, 5vw, 68px)", textAlign: "center" }}>
          <p className="eyebrow rise" data-d="1" style={{ justifyContent: "center" }}>A feedback network for AI apps & creative teams</p>
          <h1 className="display rise" data-d="2" style={{ fontSize: "clamp(2.5rem, 5.6vw, 4.4rem)", margin: "0 auto 22px", maxWidth: 920 }}>
            Test generated content with <span className="em">real users</span>.
          </h1>
          <p className="rise" data-d="3" style={{ fontSize: "clamp(1.08rem, 1.45vw, 1.3rem)", color: "var(--fg-2)", maxWidth: 640, margin: "0 auto 30px", lineHeight: 1.55 }}>
            Vraelis helps AI apps and creative teams learn what people prefer, turn that into clear feedback reports, and turn feedback into revenue.
          </p>
          <div className="rise" data-d="4" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="/app/new" className="btn btn--lg">Start a test <span aria-hidden>→</span></a>
            <a href="/pricing" className="btn btn--ghost btn--lg">View pricing</a>
            <a href="/developers" className="btn btn--ghost btn--lg">Developers</a>
          </div>
          <p className="rise" data-d="5" style={{ fontFamily: "var(--font-code)", fontSize: 12.5, color: "var(--fg-4)", marginTop: 22, letterSpacing: "0.01em" }}>
            25 free credits to start · 1 credit = 1 real human judgment
          </p>

          {/* Product preview — the verdict, right up front */}
          <div className="rise" data-d="6" style={{ position: "relative", maxWidth: 860, margin: "clamp(40px, 5vw, 64px) auto 0" }}>
            <div className="win" style={{ textAlign: "left", boxShadow: "var(--shadow-lg)" }}>
              <div className="win__bar"><span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 13, color: "var(--fg-2)" }}>Report</span><span className="pill" style={{ marginLeft: "auto", background: "var(--acc-soft)", color: "var(--acc-deep)", borderColor: "var(--acc-line)" }}>Complete</span></div>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.05fr)", gap: 0 }} className="cols-stack">
                <div style={{ padding: "clamp(18px,2.4vw,26px)", borderRight: "1px solid var(--line-1)" }}>
                  <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 }}>Which thumbnail converts better?</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                    {[["A", false], ["B", true], ["C", false]].map(([l, win]) => (
                      <div key={l as string} style={{ position: "relative", aspectRatio: "4/3", borderRadius: 10, background: win ? "linear-gradient(140deg, var(--acc-soft), #fff)" : "var(--bg-2)", border: `1px solid ${win ? "var(--acc-line-2)" : "var(--line-2)"}`, display: "grid", placeItems: "center" }}>
                        <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 22, color: win ? "var(--acc-deep)" : "var(--fg-4)" }}>{l}</span>
                        {win ? <span style={{ position: "absolute", top: 6, right: 6, width: 16, height: 16, borderRadius: "50%", background: "var(--acc)", display: "grid", placeItems: "center", color: "#fff", fontSize: 10 }}>✓</span> : null}
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 16, padding: 13, borderRadius: 12, background: "var(--bg-2)", border: "1px solid var(--line-1)" }}>
                    <div style={{ fontFamily: "var(--font-code)", fontSize: 9.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 5 }}>Vraelis analysis</div>
                    <p style={{ fontSize: 12.5, color: "var(--fg-2)", lineHeight: 1.5, margin: 0 }}>B won on clarity and contrast — voters found A too busy. Push the focal subject harder to clear 70%.</p>
                  </div>
                </div>
                <div style={{ padding: "clamp(18px,2.4vw,26px)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                    <div>
                      <div style={{ fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--acc-deep)" }}>Winner</div>
                      <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 24, color: "var(--fg-1)", letterSpacing: "-0.02em" }}>Option B · 61%</div>
                    </div>
                    <span className="pill" style={{ marginLeft: "auto", background: "var(--acc-soft)", color: "var(--acc-deep)", borderColor: "var(--acc-line)" }}>high confidence</span>
                  </div>
                  <Verdict rows={[["A", 39, false], ["B", 61, true], ["C", 22, false]]} />
                  <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: "var(--font-code)", fontSize: 11.5, color: "var(--fg-4)" }}>
                    <span>122 valid · 14 filtered</span>
                    <span style={{ color: "var(--acc-deep)" }}>Shareable report ↗</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Who uses Vraelis ── */}
      <section className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div className="sec-head sec-head--center">
            <p className="eyebrow">Who it's for</p>
            <h2 className="display">Built for everyone who ships something people <span className="em">judge</span>.</h2>
          </div>
          <div className="tile-grid cols-4">
            {AUDIENCE.map((a) => (
              <div key={a.t} className="acard">
                <div className="acard__icon"><Icon d={a.i} /></div>
                <div className="acard__t">{a.t}</div>
                <div className="acard__d">{a.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="section">
        <div className="wrap">
          <div className="sec-head">
            <p className="eyebrow">How it works</p>
            <h2 className="display">From a pile of options to a <span className="em">clear decision</span>.</h2>
            <p>Four steps from upload to a verdict you can act on — and, for AI apps, a feedback stream you own.</p>
          </div>
          <div className="tile-grid cols-2">
            {STEPS.map((s) => (
              <div key={s.k} className="acard" style={{ flexDirection: "row", gap: 18, alignItems: "flex-start" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, flex: "none" }}>
                  <div className="acard__icon" style={{ width: 42, height: 42 }}><Icon d={s.i} size={20} /></div>
                  <span style={{ fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-5)" }}>{s.k}</span>
                </div>
                <div>
                  <h3 style={{ fontSize: "clamp(1.1rem, 1.7vw, 1.35rem)", marginBottom: 7 }}>{s.t}</h3>
                  <p style={{ fontSize: 14, color: "var(--fg-3)", lineHeight: 1.55 }}>{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── The report ── */}
      <section className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,0.92fr) minmax(0,1.08fr)", gap: "clamp(28px, 4vw, 60px)", alignItems: "center" }} className="cols-stack">
            <div>
              <p className="eyebrow">The report</p>
              <h2 className="display" style={{ fontSize: "clamp(1.85rem, 3.3vw, 2.7rem)", marginBottom: 16 }}>Not raw votes. A verdict you can <span className="em">act on</span>.</h2>
              <p className="lead-copy" style={{ marginBottom: 22 }}>Every test returns a clean report — what won, how confident the result is, why people chose it, and what to change next.</p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
                {REPORT_PARTS.map((x) => (
                  <li key={x} style={{ display: "flex", gap: 11, fontSize: 14.5, color: "var(--fg-2)", alignItems: "flex-start" }}>
                    <span style={{ width: 18, height: 18, flex: "none", marginTop: 1, borderRadius: "50%", background: "var(--acc-soft)", border: "1px solid var(--acc-line)", color: "var(--acc-deep)", display: "grid", placeItems: "center", fontSize: 11 }}>✓</span>{x}
                  </li>
                ))}
              </ul>
              <div style={{ display: "flex", gap: 12, marginTop: 26, flexWrap: "wrap" }}>
                <a href="/app/new" className="btn">Run a test</a>
                <a href="/pricing" className="btn--quiet">See what's included →</a>
              </div>
            </div>
            <div className="win" style={{ boxShadow: "var(--shadow-lg)" }}>
              <div className="win__bar"><span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 13, color: "var(--fg-2)" }}>Report</span><span className="pill" style={{ marginLeft: "auto", background: "var(--acc-soft)", color: "var(--acc-deep)", borderColor: "var(--acc-line)" }}>Complete</span></div>
              <div style={{ padding: "clamp(18px,2.4vw,26px)" }}>
                <div className="card card--acc" style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16, boxShadow: "none", padding: 16 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 12, background: "linear-gradient(135deg, var(--acc), var(--acc-deep))", flex: "none" }} />
                  <div>
                    <div style={{ fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--acc-deep)" }}>Winner</div>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 21, color: "var(--fg-1)" }}>Option B — 61%</div>
                  </div>
                  <span className="pill" style={{ marginLeft: "auto", background: "var(--bg-1)", color: "var(--acc-deep)", borderColor: "var(--acc-line)" }}>+22 margin</span>
                </div>
                <Verdict rows={[["A", 39, false], ["B", 61, true], ["C", 22, false]]} />
                <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[["Valid votes", "122"], ["Filtered", "14"], ["Confidence", "High"], ["Comments", "37"]].map(([l, v]) => (
                    <div key={l} style={{ padding: "10px 12px", borderRadius: 10, background: "var(--bg-2)", border: "1px solid var(--line-1)" }}>
                      <div style={{ fontFamily: "var(--font-code)", fontSize: 9.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--fg-4)" }}>{l}</div>
                      <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18, color: "var(--fg-1)", marginTop: 2 }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── What teams test ── */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <p className="eyebrow">What teams test</p>
            <h2 className="display">If people will judge it, you can test it.</h2>
          </div>
          <div className="chips">
            {TESTABLE.map((t) => <span key={t} className="chip">{t}</span>)}
          </div>
        </div>
      </section>

      {/* ── For AI apps — the external loop ── */}
      <section className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div className="sec-head">
            <p className="eyebrow">For AI apps</p>
            <h2 className="display">Turn user preferences into a data layer you own.</h2>
            <p>Plug Vraelis into your product. Your users test generated outputs, you learn what they prefer, and that feedback becomes a stream you control — to improve your model and open new revenue.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,0.92fr) minmax(0,1.08fr)", gap: 18, alignItems: "stretch", marginBottom: 16 }} className="cols-stack">
            {/* left — the loop, on cream */}
            <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 20 }}>
              <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)" }}>The external loop</div>
              <div style={{ display: "grid", gap: 14 }}>
                {[["API create", "POST a test with your options"], ["Votes", "Real people choose and explain"], ["Webhook", "We notify you the moment it's done"], ["Export", "Pull the structured result"]].map(([s, d], i) => (
                  <div key={s as string} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <span style={{ flex: "none", width: 28, height: 28, borderRadius: 9, background: "var(--acc-soft)", border: "1px solid var(--acc-line)", color: "var(--acc-deep)", display: "grid", placeItems: "center", fontFamily: "var(--font-code)", fontSize: 12.5, fontWeight: 600 }}>{i + 1}</span>
                    <div><div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14.5, color: "var(--fg-1)" }}>{s}</div><div style={{ fontSize: 12.5, color: "var(--fg-4)" }}>{d}</div></div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <a href="/developers" className="btn">See the API</a>
                <a href="/developers#embed" className="btn btn--ghost">Embed widget</a>
              </div>
            </div>
            {/* right — a real API response */}
            <div className="win" style={{ boxShadow: "var(--shadow-lg)" }}>
              <div className="win__bar" style={{ background: "#1C2733", borderBottom: "1px solid rgba(255,255,255,0.06)" }}><span style={{ fontFamily: "var(--font-code)", fontSize: 12, color: "#94A1B2" }}>POST /api/v1/tests</span><span className="pill" style={{ marginLeft: "auto", background: "rgba(97,197,84,0.12)", color: "#8CE0B4", borderColor: "rgba(97,197,84,0.3)" }}>200 OK</span></div>
              <pre className="codeblock" style={{ borderRadius: 0, border: "none", boxShadow: "none", height: "100%" }}>{API_RESPONSE}</pre>
            </div>
          </div>
          <div className="tile-grid cols-3">
            {[["Plug in", "One API call", "Send options, get a ranked result — or drop in the embeddable widget."], ["Learn", "What users prefer", "Real preference signal on your generated outputs, quality-filtered."], ["Earn", "Feedback → revenue", "Make user feedback a product surface, not a cost center."]].map(([k, t, d]) => (
              <div key={k} className="acard" style={{ gap: 6 }}>
                <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--acc-deep)" }}>{k}</div>
                <div className="acard__t">{t}</div>
                <div className="acard__d">{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing preview ── */}
      <section className="section">
        <div className="wrap">
          <div className="phead" style={{ marginBottom: "clamp(22px, 3vw, 34px)", alignItems: "flex-end" }}>
            <div className="sec-head" style={{ margin: 0, maxWidth: 560 }}>
              <p className="eyebrow">Pricing</p>
              <h2 className="display">Plans include monthly credits. Top up anytime.</h2>
            </div>
            <a href="/pricing" className="btn btn--ghost">View full pricing →</a>
          </div>
          <div className="tile-grid cols-3">
            {PLAN_CATALOG.slice(0, 3).map((p, i) => (
              <div key={p.plan} className={`price${i === 1 ? " price--hot" : ""}`}>
                <div className="price__name">{p.name}</div>
                <div className="price__amt">${p.price.monthly}<small>/mo</small></div>
                <div style={{ fontFamily: "var(--font-code)", fontSize: 13, color: "var(--acc-deep)", fontWeight: 600 }}>{p.monthlyCredits.toLocaleString()} credits / mo</div>
                <p style={{ fontSize: 13.5, color: "var(--fg-3)" }}>{p.blurb}</p>
                <a href="/pricing" className={i === 1 ? "btn" : "btn btn--ghost"} style={{ marginTop: "auto", justifyContent: "center" }}>Choose {p.name}</a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Capability proof ── */}
      <section className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div className="sec-head">
            <p className="eyebrow">What's live today</p>
            <h2 className="display">A complete loop, <span className="em">already shipping</span>.</h2>
            <p>From upload to verdict to a shareable report — plus an API, webhooks, and exports for the apps that build on it.</p>
          </div>
          <div className="tile-grid cols-4">
            {SUPPORTS.map(([t, d]) => (
              <div key={t} className="acard" style={{ gap: 6 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}><span style={{ color: "var(--acc)" }}>✓</span><span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14.5, color: "var(--fg-1)" }}>{t}</span></div>
                <div style={{ fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.5 }}>{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="section cta-band" style={{ borderBottom: "none" }}>
        <div className="glow glow--soft" />
        <div className="wrap" style={{ maxWidth: 720, textAlign: "center" }}>
          <h2 className="display" style={{ fontSize: "clamp(2.1rem, 4.4vw, 3.4rem)", marginBottom: 18 }}>Stop guessing. <span className="em">Ask real people</span>.</h2>
          <p className="lead-copy" style={{ margin: "0 auto 28px", textAlign: "center" }}>Run your first test free with 25 credits. One credit = one real human judgment.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="/app/new" className="btn btn--lg">Start a test free <span aria-hidden>→</span></a>
            <a href="/vote" className="btn btn--ghost btn--lg">Vote &amp; earn credits</a>
            <a href="/developers" className="btn btn--ghost btn--lg">Developers</a>
          </div>
        </div>
      </section>
    </>
  );
}
