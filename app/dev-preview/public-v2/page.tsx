import type { Metadata } from "next";
import Link from "next/link";
import "./public-v2.css";
import { ProofConsole } from "./proof-console";
import { AGENT_CLAIM } from "./fixtures";

// Design 05 Phase 0 — flagship public-site prototype. Lives behind /dev-preview and is NOT the live homepage.
// noindex: this is a work-in-progress art-direction prototype, not a page search engines should learn from.
export const metadata: Metadata = {
  title: "Vraelis — public site prototype",
  robots: { index: false, follow: false },
};

// The gapped-ring mark: the center is the requirement being checked, the ring is independent verification, and
// the gap is the brand signature. A small echo of the flagship ring.
function Mark({ size = 22 }: { size?: number }) {
  const R = 7;
  const C = 2 * Math.PI * R;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r={R} stroke="var(--fg-1)" strokeWidth={2} strokeLinecap="round" strokeDasharray={`${C * 0.78} ${C}`} transform="rotate(-108 12 12)" />
      <circle cx="12" cy="12" r="2.1" fill="var(--acc)" />
    </svg>
  );
}

export default function PublicV2Prototype() {
  return (
    <div className="pv-page">
      {/* ── navigation ──────────────────────────────────────────────── */}
      <header className="pv-nav">
        <nav className="pv-wrap pv-nav-in" aria-label="Primary">
          <Link href="/dev-preview/public-v2" className="pv-brand"><Mark />Vraelis</Link>
          <div className="pv-nav-links">
            <a href="#verify">Product</a>
            <a href="#trust-gap">Why it matters</a>
            <a href="#records">Proof</a>
            <a href="/rank/how-it-works">Developers</a>
          </div>
          <div className="pv-nav-cta">
            <a href="/rank" className="pv-link-btn">Sign in</a>
            <a href="#verify" className="pv-link-btn pv-link-btn--solid">Verify a deployment</a>
          </div>
        </nav>
      </header>

      <main>
        {/* ── hero ──────────────────────────────────────────────────── */}
        <section className="pv-hero">
          <div className="pv-wrap">
            <span className="pv-eyebrow pv-hero-eyebrow pv-rise" data-d="1"><span className="pv-dot" />The trust layer for AI-built software</span>
            <h1 className="pv-h1 pv-rise" data-d="2">AI can build the company. Vraelis <span className="pv-serif">proves it works</span>.</h1>
            <p className="pv-sub pv-rise" data-d="3">
              Today, Vraelis independently verifies critical workflows in deployed web applications using reviewed
              proof plans, real browser execution, and evidence.
            </p>
            <div className="pv-cta-row pv-rise" data-d="4">
              <a href="#verify" className="pv-cta pv-cta--solid">Watch a real verification</a>
              <a href="/rank" className="pv-cta pv-cta--ghost">Verify a deployment</a>
            </div>
            <p className="pv-hero-note pv-rise" data-d="4">Anonymized demonstration of a real Vraelis production sequence. It replays on its own; you can take over anytime.</p>
          </div>
        </section>

        {/* ── flagship: the proof console ───────────────────────────── */}
        <section id="verify" className="pv-stage" aria-labelledby="verify-h">
          <div className="pv-wrap">
            <h2 id="verify-h" className="sr-only">A verification, from claim to conclusion</h2>
            <ProofConsole />
          </div>
        </section>

        {/* ── the trust gap ─────────────────────────────────────────── */}
        <section id="trust-gap" className="pv-section">
          <div className="pv-wrap">
            <div className="pv-sec-head">
              <span className="pv-eyebrow">The trust gap</span>
              <h2 className="pv-sec-h2">The system that built it should not be the final authority on whether it works.</h2>
              <p className="pv-sec-lead">A coding agent reports what it intended to do. Vraelis reports what the deployed product actually did, and holds the evidence either way.</p>
            </div>
            <div className="pv-gap">
              <div className="pv-gap-card pv-gap-card--said">
                <span className="pv-gap-who">The coding agent reported</span>
                <p className="pv-gap-quote">&ldquo;{AGENT_CLAIM}&rdquo;</p>
                <span className="pv-gap-tag">A claim of completion. No independent check.</span>
              </div>
              <div className="pv-gap-card pv-gap-card--observed">
                <span className="pv-gap-who"><Mark size={14} />Vraelis observed</span>
                <p className="pv-gap-quote">Payment succeeded, but Pro access did not persist. The claim did not hold.</p>
                <span className="pv-gap-tag">A conclusion, backed by reproducible evidence on the pinned deployment.</span>
              </div>
            </div>
            <p className="pv-gap-thesis">One says it is done. The other <span className="pv-serif">proves whether it is</span>.</p>
          </div>
        </section>

        {/* records anchor target for the nav */}
        <div id="records" aria-hidden style={{ height: 1 }} />

        {/* ── final CTA ─────────────────────────────────────────────── */}
        <section className="pv-foot">
          <div className="pv-wrap">
            <div className="pv-foot-cta">
              <h2 className="pv-foot-h">Stop taking the agent&rsquo;s word for it.</h2>
              <div className="pv-foot-row">
                <a href="/rank" className="pv-cta pv-cta--solid">Verify a deployment</a>
                <a href="#verify" className="pv-cta pv-cta--ghost">Watch the proof</a>
              </div>
            </div>
            <div className="pv-foot-meta">
              <span className="pv-brand" style={{ fontSize: 15 }}><Mark size={18} />Vraelis</span>
              <span>Prototype · /dev-preview/public-v2 · not the live site</span>
            </div>
            <p className="pv-foot-note">
              This page is an art-direction prototype. The verification shown replays anonymized fixture data based on
              a real Vraelis production sequence; it is not executing a live customer deployment, and no private
              identifiers, URLs, or evidence are shown.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
