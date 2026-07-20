import Link from "next/link";
import { ogMeta } from "@/lib/og-meta";

// Public entry point for the free Production Pass. New accounts start with free
// credits; this page explains what one pass returns and routes into sign-in.
// Marketing pattern mirrors /how-it-works (glow + grid hero, acard tiles, CTA row).
export const metadata = ogMeta({
  title: "Your first Production Pass is free",
  description:
    "Your first Production Pass is free. Connect your AI-built app, approve its critical flows, and get a launch decision backed by real browser evidence.",
  path: "/free-report",
});

const STATUS = {
  ready: { label: "READY", fg: "var(--acc-deep)", bg: "var(--acc-soft)", line: "var(--acc-line)" },
  review: { label: "NEEDS REVIEW", fg: "#B45309", bg: "#FEF6E7", line: "#F3DFB0" },
  blocked: { label: "BLOCKED", fg: "#C0392B", bg: "#FBEBEA", line: "#F0C7C2" },
} as const;
type StatusKey = keyof typeof STATUS;

function StatusPill({ s }: { s: StatusKey }) {
  const c = STATUS[s];
  return (
    <span className="pill" style={{ background: c.bg, color: c.fg, borderColor: c.line, fontFamily: "var(--font-code)", letterSpacing: "0.06em" }}>
      {c.label}
    </span>
  );
}

function Icon({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}
const I = {
  camera: "M3 7h4l2-2h6l2 2h4v12H3zM12 16a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7",
  wrench: "M14.7 6.3a4 4 0 0 0-5.4 5.4l-6 6a1.5 1.5 0 0 0 2.1 2.1l6-6a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.1-2.1z",
};

export default function FreeReportPage() {
  return (
    <>
      {/* Hero */}
      <section style={{ position: "relative" }}>
        <div className="glow glow--soft glow--bleed" />
        <div className="grid-faint" style={{ opacity: 0.5 }} />
        <div className="wrap" style={{ position: "relative", zIndex: 1, paddingTop: "clamp(48px, 6vw, 88px)", paddingBottom: "clamp(20px, 3vw, 34px)", textAlign: "center" }}>
          <p className="eyebrow" style={{ justifyContent: "center" }}>Free preflight</p>
          <h1 className="display" style={{ fontSize: "clamp(2.2rem, 4.6vw, 3.5rem)", marginBottom: 16, maxWidth: 820, marginInline: "auto", lineHeight: 1.05, textWrap: "balance" }}>
            Your first <span className="em">Production Pass</span> is free.
          </h1>
          <p className="lead-copy" style={{ margin: "0 auto", textAlign: "center", maxWidth: 680 }}>
            Your first Production Pass is free. Connect your AI-built app, approve its critical flows, and Vraelis runs them in a real browser, then returns a launch decision with the evidence behind it.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 26 }}>
            <Link href="/signin?callbackUrl=%2Fapp" className="btn btn--lg">Validate a system <span aria-hidden>→</span></Link>
            <Link href="/how-it-works" className="btn btn--ghost btn--lg">See how it works</Link>
          </div>
        </div>
      </section>

      {/* What one free pass returns */}
      <section className="section" style={{ paddingTop: "clamp(24px, 3vw, 40px)" }}>
        <div className="wrap">
          <div className="sec-head sec-head--center">
            <p className="eyebrow">What you get</p>
            <h2 className="display">One pass, <span className="em">three things you can act on</span>.</h2>
          </div>
          <div className="tile-grid cols-3" style={{ maxWidth: 960, margin: "0 auto" }}>
            <div className="acard" style={{ gap: 10 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(["ready", "review", "blocked"] as StatusKey[]).map((s) => <StatusPill key={s} s={s} />)}
              </div>
              <div className="acard__t">A launch decision</div>
              <div className="acard__d">One answer for the whole app: READY, NEEDS REVIEW, or BLOCKED. Any critical flow that fails blocks the launch, so the label always tells you why.</div>
            </div>
            <div className="acard" style={{ gap: 10 }}>
              <div className="acard__icon"><Icon d={I.camera} /></div>
              <div className="acard__t">Evidence, not opinions</div>
              <div className="acard__d">Every blocker carries a screenshot and exact reproduction steps from the real browser run, so you can see the failure and replay it yourself.</div>
            </div>
            <div className="acard" style={{ gap: 10 }}>
              <div className="acard__icon"><Icon d={I.wrench} /></div>
              <div className="acard__t">Fix prompts for your builder</div>
              <div className="acard__d">Each blocker ships with a repair prompt written for the tool that built your app. Paste it in, push the fix, and rerun the exact failed check.</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section cta-band" style={{ borderBottom: "none" }}>
        <div className="glow glow--soft" />
        <div className="wrap" style={{ maxWidth: 680, textAlign: "center" }}>
          <h2 className="display" style={{ fontSize: "clamp(1.9rem, 3.6vw, 2.8rem)", marginBottom: 16 }}>Find the blockers <span className="em">before your users do</span>.</h2>
          <p className="lead-copy" style={{ margin: "0 auto 26px", textAlign: "center" }}>Sign in, connect your app, and run your first Production Pass free.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/signin?callbackUrl=%2Fapp" className="btn btn--lg">Validate a system <span aria-hidden>→</span></Link>
            <Link href="/how-it-works" className="btn btn--ghost btn--lg">See how it works</Link>
          </div>
          <p style={{ fontSize: 12.5, color: "var(--fg-5)", marginTop: 18, lineHeight: 1.6 }}>
            Vraelis is in early access. You approve every flow before anything runs, and you choose the environment it runs against. Point it at a preview or staging deployment with Stripe in test mode.
          </p>
        </div>
      </section>
    </>
  );
}
