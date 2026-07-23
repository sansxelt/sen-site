import type { Metadata } from "next";
import Link from "next/link";
import { RankShell } from "@/app/rank/_components/rank-ui";
import { HeroFlagship, ProofViewer } from "./flagship-proof";

// Not indexable: this is a review prototype for the Design 05 homepage elevation, not a shipping route.
export const metadata: Metadata = { title: "Vraelis, public-v3 prototype", robots: { index: false, follow: false } };

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// DIRECTION CONTRACT (extend the incumbent surface, do not replace it)
//
// THESIS: The homepage's proof is the product's OWN result surface, shown at scale, not a schematic beside the
//   copy. It refuses the left-copy / right-dashboard split and the browser-chrome mockup the category ships.
// OWN-WORLD: Inherited from the live site. Warm paper (--bg-0 #FAF8F4), emerald (--acc #0E9E6C), Geist display
//   with the Instrument Serif italic flourish (.em), the real Verification Result verdict tones (Verified
//   emerald, Failed #A8452A/#F6ECE7), soft depth from offset shadows, a faint hairline grid and one soft bloom.
// STORY: A skeptic reads one real verification, sees a genuine bug caught and a repair independently reverified,
//   and understands that Verified is bound to evidence and to preserved, separate history.
// FIRST VIEWPORT: Thesis headline and two CTAs at top left near 4.9rem; directly beneath, the real Verified
//   result surface at full width as the hero's substance, filling its step trace once, the three-record
//   lineage rail below it.
// FORM: An extension of the incumbent homepage world. The flagship is the Design 02 Verification Result surface
//   rendered as the hero; no new visual world, no invented institution.
//
// COPY RULE (standing founder constraint): no em dashes, en dashes, middots, or dash separators anywhere.
// Every sentence describes what works today, or is explicitly marked as direction. Nothing fabricates a
// customer, metric, screenshot, or capability.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export default function PublicV3() {
  return (
    <RankShell signedIn={false}>
      {/* ── Hero: thesis, then the product itself as the proof ── */}
      <section style={{ position: "relative" }}>
        <div className="glow glow--bleed" />
        <div className="grid-faint" style={{ opacity: 0.5 }} />
        <div className="wrap" style={{ position: "relative", zIndex: 1, paddingTop: "clamp(30px, 4vw, 58px)", paddingBottom: "clamp(34px, 5vw, 66px)" }}>
          <div style={{ maxWidth: 760 }}>
            <p className="eyebrow rise" data-d="1">Independent verification for software built with AI</p>
            <h1 className="display rise" data-d="2" style={{ fontSize: "clamp(2.6rem, 5.4vw, 4.9rem)", margin: "0 0 22px", lineHeight: 1.02, textWrap: "balance" }}>
              AI says it&rsquo;s done. <span className="em">Vraelis proves it</span>.
            </h1>
            <p className="lead-copy rise" data-d="3" style={{ fontSize: "clamp(1.08rem, 1.4vw, 1.32rem)", color: "var(--fg-2)", maxWidth: 640, margin: "0 0 26px", lineHeight: 1.5 }}>
              Give Vraelis a deployed application and one sentence about what must be true. It derives the checks, runs them in a real browser, and returns the evidence behind a single decision: Verified, Failed, or Blocked.
            </p>
            <div className="rise" data-d="4" style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              <Link href="/signin?callbackUrl=%2Fapp" className="btn btn--lg">Verify an outcome <span aria-hidden>→</span></Link>
              <a href="#proof" className="btn btn--ghost btn--lg">See a real verification</a>
            </div>
            <p className="rise" data-d="4" style={{ fontFamily: "var(--font-code)", fontSize: 12.5, color: "var(--fg-4)", margin: "18px 0 0", maxWidth: 560, lineHeight: 1.55 }}>
              No SDK, no test files, no source access. Starting with deployed web applications.
            </p>
          </div>

          {/* The flagship: the real result surface, at scale, as the hero's substance. */}
          <div className="rise" data-d="5" style={{ marginTop: "clamp(34px, 5vw, 58px)" }}>
            <HeroFlagship />
          </div>
        </div>
      </section>

      {/* ── The openable example: a skeptic reads a real verification without signing in ── */}
      <section id="proof" className="section" style={{ background: "var(--bg-2)", scrollMarginTop: 80 }}>
        <div className="wrap">
          <div className="sec-head" style={{ marginBottom: "clamp(24px, 3vw, 36px)" }}>
            <p className="eyebrow">Proof, not a diagram</p>
            <h2 className="display">Read a real verification, start to finish.</h2>
            <p>
              This is the same result surface you receive. One claim about a checkout, checked in a real browser. It failed on a bug that a claim of done would have shipped, an incomplete repair was rejected on its own evidence, and the full repair was independently reverified. Three separate records, each one preserved.
            </p>
          </div>
          <ProofViewer />
        </div>
      </section>

      {/* ── Preserved history: the property that makes a Verified trustworthy ── */}
      <section className="section">
        <div className="wrap">
          <div className="cols-stack" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "clamp(28px, 5vw, 64px)", alignItems: "center" }}>
            <div>
              <p className="eyebrow">Nothing is overwritten</p>
              <h2 className="display" style={{ fontSize: "clamp(1.85rem, 3.3vw, 2.6rem)", marginBottom: 16 }}>Every verification stays a separate record.</h2>
              <p className="lead-copy" style={{ marginBottom: 14 }}>
                A later pass never rewrites an earlier one. The failed run, the rejected repair, and the reverified result each keep their own evidence, so a Verified you can trust always has its history standing behind it.
              </p>
              <p style={{ color: "var(--fg-3)", fontSize: "0.98rem", lineHeight: 1.62, margin: 0 }}>
                A coding agent cannot mark its own work complete, and it cannot quietly edit a verification it does not control.
              </p>
            </div>
            <div style={{ border: "1px solid var(--line-2)", borderRadius: "var(--r-lg)", background: "var(--bg-1)", padding: "clamp(20px, 3vw, 30px)", boxShadow: "var(--shadow-sm)", display: "grid", gap: 12 }}>
              {[
                ["Failed", "#A8452A", "Entitlement never applied", "Jul 21, 2026"],
                ["Failed", "#A8452A", "Access lost after re-sign-in", "Jul 22, 2026"],
                ["Verified", "var(--acc-deep)", "Upgrade grants Pro access and keeps it", "Jul 22, 2026"],
              ].map(([verdict, color, note, when], i, arr) => (
                <div key={String(note)} style={{ display: "grid", gridTemplateColumns: "14px minmax(0,1fr)", gap: 12, alignItems: "start" }}>
                  <div style={{ display: "grid", justifyItems: "center", height: "100%" }}>
                    <span style={{ width: 9, height: 9, borderRadius: 999, background: color as string, marginTop: 5, boxShadow: i === arr.length - 1 ? "0 0 0 3px var(--acc-soft)" : "none" }} />
                    {i < arr.length - 1 && <span style={{ width: 1, flex: 1, minHeight: 22, background: "var(--line-2)", marginTop: 2 }} />}
                  </div>
                  <div style={{ paddingBottom: i < arr.length - 1 ? 4 : 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 9, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "var(--font-code)", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: color as string }}>{verdict}</span>
                      <span style={{ fontSize: 13.5, color: "var(--fg-2)", fontWeight: 500 }}>{note}</span>
                    </div>
                    <span style={{ fontFamily: "var(--font-code)", fontSize: 10.5, color: "var(--fg-4)" }}>{when}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Close ── */}
      <section className="section cta-band" style={{ borderBottom: "none" }}>
        <div className="glow glow--soft" />
        <div className="wrap" style={{ maxWidth: 720, textAlign: "center" }}>
          <h2 className="display" style={{ fontSize: "clamp(2.1rem, 4.4vw, 3.4rem)", marginBottom: 18 }}>Before anything says <span className="em">done</span>.</h2>
          <p className="lead-copy" style={{ margin: "0 auto 28px", textAlign: "center" }}>
            Give Vraelis a deployed application and the outcome that should be true. Get back a decision you can act on, and the evidence behind it.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/signin?callbackUrl=%2Fapp" className="btn btn--lg">Verify an outcome <span aria-hidden>→</span></Link>
            <Link href="/how-it-works" className="btn btn--ghost btn--lg">See how it works</Link>
          </div>
        </div>
      </section>
    </RankShell>
  );
}
