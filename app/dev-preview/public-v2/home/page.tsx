import type { Metadata } from "next";
import "./home.css";
import { ProofChamber } from "./proof-chamber";

export const metadata: Metadata = { title: "Vraelis, the proof engine for AI built software", robots: { index: false } };

function Mark({ size = 22 }: { size?: number }) {
  const R = 7, C = 2 * Math.PI * R;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r={R} stroke="var(--ink)" strokeWidth={2} strokeLinecap="round" strokeDasharray={`${C * 0.78} ${C}`} transform="rotate(-108 12 12)" />
      <circle cx="12" cy="12" r="2.1" fill="var(--grn)" />
    </svg>
  );
}

const STORY = [
  { n: "01", t: "The claim", d: "An agent ships a change and reports it is done." },
  { n: "02", t: "The challenge", d: "Vraelis builds fresh identities and two isolated organizations." },
  { n: "03", t: "The breach", d: "User A reaches a record owned by Organization B.", tone: "breach" },
  { n: "04", t: "The evidence", d: "Browser, API, identity and record owner all agree." },
  { n: "05", t: "The decision", d: "The release is rejected. It does not ship.", tone: "verdict" },
  { n: "06", t: "The next round", d: "A repair gets a brand new challenge, never the same test." },
];

const INVARIANTS = [
  { t: "Tenant isolation", d: "No user can read or change another organization's data, on any path." },
  { t: "Agent approval gates", d: "An AI agent cannot take a restricted action without the approval the business requires." },
  { t: "Inventory truth", d: "An order never confirms unless the inventory it needs was actually reserved." },
  { t: "Payment and access", d: "Paying for a plan grants the access it promises, and keeps it after signing back in." },
  { t: "Real state change", d: "A workflow changes the real system, not only the screen the user sees." },
  { t: "Permission changes", d: "Revoking access removes it everywhere, immediately, including cached sessions." },
];

export default function Home() {
  return (
    <div className="vh">
      {/* nav */}
      <header className="vh-nav">
        <nav className="vh-wrap vh-nav-in" aria-label="Primary">
          <a href="#top" className="vh-brand"><Mark />Vraelis</a>
          <div className="vh-nav-links">
            <a href="#how">Product</a>
            <a href="#invariants">What it proves</a>
            <a href="#case">Customers</a>
            <a href="#developers">Developers</a>
            <a href="/rank/pricing">Pricing</a>
          </div>
          <div className="vh-nav-cta">
            <a href="/rank" className="vh-btn vh-btn--ghost">Sign in</a>
            <a href="/rank" className="vh-btn vh-btn--solid">Verify a deployment</a>
          </div>
        </nav>
      </header>

      <main id="top">
        {/* hero */}
        <section className="vh-hero">
          <div className="vh-wrap vh-hero-grid">
            <div>
              <span className="vh-eyebrow">The proof engine for AI built software</span>
              <h1 className="vh-h1" style={{ marginTop: 18 }}>AI builds.<br /><span className="g">Vraelis proves.</span></h1>
              <p className="vh-hero-sub">Vraelis independently proves that AI built software still does what the business requires, on the live system, with the evidence.</p>
              <div className="vh-hero-cta">
                <a href="/rank" className="vh-btn vh-btn--solid vh-btn--lg">Verify a deployment</a>
                <a href="#how" className="vh-btn vh-btn--ghost vh-btn--lg">See how it works</a>
              </div>
              <div className="vh-hero-trust"><b>Proven in production.</b> Real deployments, real browsers, evidence on file.</div>
            </div>
            <div><ProofChamber /></div>
          </div>
        </section>

        {/* the continuous story */}
        <section id="how" className="vh-section">
          <div className="vh-wrap">
            <div className="vh-sec-head">
              <span className="vh-eyebrow">One verification, start to finish</span>
              <h2 className="vh-h2" style={{ fontSize: "clamp(1.9rem,3.4vw,2.8rem)", marginTop: 12 }}>The agent said it was fixed. Vraelis ran the real product and caught it.</h2>
            </div>
            <div className="vh-flow">
              {STORY.map((s) => (
                <div key={s.n} className="vh-flow-step" data-tone={s.tone}>
                  <span className="vh-flow-n">{s.n}</span>
                  <span className="vh-flow-t">{s.t}</span>
                  <span className="vh-flow-d">{s.d}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* breadth */}
        <section id="invariants" className="vh-section">
          <div className="vh-wrap">
            <div className="vh-sec-head">
              <span className="vh-eyebrow">One engine, every promise your product makes</span>
              <h2 className="vh-h2" style={{ fontSize: "clamp(1.9rem,3.4vw,2.8rem)", marginTop: 12 }}>Checkout is one example. The business invariants run much wider.</h2>
            </div>
            <div className="vh-inv-grid">
              {INVARIANTS.map((iv) => (
                <div key={iv.t} className="vh-inv">
                  <span className="vh-inv-ic"><svg width="17" height="17" viewBox="0 0 20 20" fill="none"><path d="M10 2l6 2.5v4.5c0 4-2.6 6.6-6 8.5-3.4-1.9-6-4.5-6-8.5V4.5L10 2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M7 10l2 2 4-4.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                  <span className="vh-inv-t">{iv.t}</span>
                  <span className="vh-inv-d">{iv.d}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* real production case study */}
        <section id="case" className="vh-section">
          <div className="vh-wrap vh-case">
            <div>
              <span className="vh-eyebrow">Proven in production</span>
              <h2 className="vh-h2" style={{ fontSize: "clamp(1.8rem,3vw,2.5rem)", marginTop: 12 }}>Payment succeeded. Access did not. Vraelis kept every attempt.</h2>
              <p className="vh-lead" style={{ marginTop: 16, maxWidth: "40ch", fontSize: 15.5 }}>A real customer upgrade. The first two deployments failed the persistence check, an incomplete repair was rejected, and only the full repair verified. Nothing was overwritten.</p>
            </div>
            <div className="vh-lineage">
              <div className="vh-rec"><span className="vh-rec-n">01</span><span className="vh-rec-t">Payment cleared, but the account never received Pro.</span><span className="vh-rec-v" data-v="rejected">rejected</span></div>
              <div className="vh-rec"><span className="vh-rec-n">02</span><span className="vh-rec-t">Pro appeared, then vanished after signing back in.</span><span className="vh-rec-v" data-v="rejected">rejected</span></div>
              <div className="vh-rec" data-v="verified"><span className="vh-rec-n">03</span><span className="vh-rec-t">Payment, entitlement and access held through a fresh sign in.</span><span className="vh-rec-v" data-v="verified">verified</span></div>
            </div>
          </div>
        </section>

        {/* today / next / horizon */}
        <section className="vh-section">
          <div className="vh-wrap">
            <div className="vh-sec-head"><span className="vh-eyebrow">Where this goes</span></div>
            <div className="vh-tnh">
              <div className="vh-tnh-col vh-tnh-col--today">
                <span className="vh-tnh-k">Today</span>
                <div className="vh-tnh-t">Verify a critical workflow on a deployed web application.</div>
                <div className="vh-tnh-d">A claim in, an evidence backed decision out, on the real system.</div>
                <span className="vh-tnh-tag">available now</span>
              </div>
              <div className="vh-tnh-col">
                <span className="vh-tnh-k">Next</span>
                <div className="vh-tnh-t">Keep approved guarantees proven across every relevant release.</div>
                <div className="vh-tnh-d">Vraelis re verifies what a change could affect, and returns for failure or drift.</div>
                <span className="vh-tnh-tag">direction</span>
              </div>
              <div className="vh-tnh-col">
                <span className="vh-tnh-k">Horizon</span>
                <div className="vh-tnh-t">Prove the software operating an AI built company keeps its promises.</div>
                <div className="vh-tnh-d">Living guarantees across the systems that run the business.</div>
                <span className="vh-tnh-tag">direction</span>
              </div>
            </div>
          </div>
        </section>

        {/* developers */}
        <section id="developers" className="vh-section">
          <div className="vh-wrap vh-dev">
            <div>
              <span className="vh-eyebrow">For agents and pipelines</span>
              <h2 className="vh-h2" style={{ fontSize: "clamp(1.8rem,3vw,2.5rem)", marginTop: 12 }}>Put Vraelis between the agent and the deploy.</h2>
              <p className="vh-lead" style={{ marginTop: 16, maxWidth: "38ch", fontSize: 15.5 }}>Hand Vraelis a deployment and the guarantees it must keep. It returns a decision your pipeline can enforce, so a coding agent never marks its own work complete.</p>
              <a href="/rank/developers" className="vh-btn vh-btn--ghost vh-btn--lg" style={{ marginTop: 22 }}>Read the developer docs</a>
            </div>
            <div className="vh-code">
              <div className="vh-code-h">POST /v1/verifications</div>
              <pre>{`{
  "deployment": "dep_9f2a11c",
  "guarantees": [
    "tenant_isolation",
    "pro_entitlement_persists"
  ]
}

`}<span className="mu">{`// Vraelis returns`}</span>{`
{
  "decision": `}<span className="rr">{`"rejected"`}</span>{`,
  "failed": [`}<span className="rr">{`"tenant_isolation"`}</span>{`],
  "observed": "User A read Organization B data",
  "record": "vrf_tn_0091"
}`}</pre>
            </div>
          </div>
        </section>

        {/* final cta */}
        <section className="vh-final">
          <div className="vh-wrap">
            <h2>Stop taking the agent&rsquo;s word for it.</h2>
            <div className="vh-final-cta">
              <a href="/rank" className="vh-btn vh-btn--solid vh-btn--lg">Verify a deployment</a>
              <a href="#top" className="vh-btn vh-btn--ghost vh-btn--lg">Watch a verification</a>
            </div>
          </div>
        </section>

        {/* footer */}
        <footer className="vh-foot">
          <div className="vh-wrap">
            <div className="vh-foot-in">
              <span className="vh-brand" style={{ fontSize: 15 }}><Mark size={18} />Vraelis</span>
              <span>The proof engine for AI built software</span>
            </div>
            <p className="vh-note">Prototype at /dev-preview/public-v2/home. The tenant isolation verification shown uses anonymized fixture data based on a real Vraelis production sequence. It is not executing a live customer deployment and shows no private identifiers, urls, or evidence.</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
