import Link from "next/link";
import { ogMeta } from "@/lib/og-meta";

export const metadata = ogMeta({
  title: "How it works",
  description: "How the AI output check works: paste your output, get per-criterion scores, the version to ship, and the exact lines to fix, with a stable pass/fail gate.",
  path: "/how-it-works",
});

const STEPS: [string, string, string][] = [
  ["1", "Paste your output", "One or more versions of what your app generates, in the app or by API. Pick the output type so the rubric fits."],
  ["2", "Get the instant check", "Per-criterion scores, the version to ship, and line-level flags on the exact spans that read as dismissive, risky, or off."],
  ["3", "Apply the fixes", "Each flag comes with a concrete suggested rewrite. Ship the version that scores best, already fixed."],
  ["4", "Ship the corrected version", "The recommended output with every fix already applied, in one clean block you can copy. Human validation on real people is coming."],
];

export default function HowItWorks() {
  return (
    <>
      <section style={{ position: "relative" }}>
        <div className="glow glow--soft glow--bleed" />
        <div className="wrap" style={{ position: "relative", zIndex: 1, paddingTop: "clamp(48px, 6vw, 88px)", paddingBottom: "clamp(20px, 3vw, 32px)", textAlign: "center" }}>
          <p className="eyebrow" style={{ justifyContent: "center" }}>How it works</p>
          <h1 className="display" style={{ fontSize: "clamp(2.2rem, 4.4vw, 3.4rem)", marginBottom: 14 }}>How Vraelis works</h1>
          <p className="lead-copy" style={{ margin: "0 auto", textAlign: "center" }}>Paste your output, get an instant check with the lines to fix, and ship the corrected version. Human validation on real people is coming.</p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: "clamp(20px, 3vw, 36px)" }}>
        <div className="wrap">
          <div className="tile-grid cols-2">
            {STEPS.map(([n, t, d]) => (
              <div key={n} className="acard" style={{ flexDirection: "row", gap: 18, alignItems: "flex-start" }}>
                <div className="acard__icon" style={{ width: 42, height: 42, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18 }}>{n}</div>
                <div>
                  <h3 style={{ fontSize: "clamp(1.1rem, 1.7vw, 1.3rem)", marginBottom: 7 }}>{t}</h3>
                  <p style={{ fontSize: 14, color: "var(--fg-3)", lineHeight: 1.55 }}>{d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: "clamp(20px, 3vw, 36px)" }}>
        <div className="wrap" style={{ maxWidth: 720 }}>
          <div className="acard" style={{ display: "block" }}>
            <p className="eyebrow">Reproducibility</p>
            <h2 style={{ fontSize: "clamp(1.2rem, 2vw, 1.5rem)", marginBottom: 10 }}>How stable is the check?</h2>
            <p style={{ fontSize: 14.5, color: "var(--fg-2)", lineHeight: 1.65, margin: 0 }}>
              Across 20 diverse inputs run 5 times each, the pass/fail gate verdict was identical in all 5 runs for all 20. Per-criterion scores vary between runs and are not used by the gate.
            </p>
          </div>
        </div>
      </section>

      <section className="section cta-band" style={{ borderBottom: "none" }}>
        <div className="glow glow--soft" />
        <div className="wrap" style={{ maxWidth: 640, textAlign: "center" }}>
          <h2 className="display" style={{ fontSize: "clamp(1.8rem, 3.4vw, 2.6rem)", marginBottom: 16 }}>Ready to check your output?</h2>
          <p className="lead-copy" style={{ margin: "0 auto 26px", textAlign: "center" }}>New accounts start with free credits, so your first checks are on us.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/app/checks/new" className="btn btn--lg">Check your AI output</Link>
            <Link href="/pricing" className="btn btn--ghost btn--lg">View pricing</Link>
            <Link href="/developers" className="btn btn--ghost btn--lg">Developers</Link>
          </div>
        </div>
      </section>
    </>
  );
}
