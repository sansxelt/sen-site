"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Pricing leads with the outcome (a verification), not a tier ladder. Early-access pricing: a verification is
// priced as a unit ($10 base, five flows included, $3 per additional flow), never per seat and never in
// microscopic per-flow credits. Monthly plans (Pro/Scale) are deliberately NOT rendered until their
// functionality and billing exist; do not add subscription checkout here to match a mock. Team seat prices
// come live from Stripe via /api/v/team/pricing.

const PASS_RULES: [string, string][] = [
  ["Priced by the verification", "One price covers the whole run: browser execution, screenshots, issue tracking, and the decision. Never a seat charge."],
  ["Nothing ran, nothing charged", "If a verification cannot start or no flow executes, you are not charged. Infrastructure failures on our side are always on us."],
  ["Targeted reruns cost less", "After a fix, rerun just the failed flows. You pay only for the flows the rerun actually executes."],
  ["Every verification ends in a decision", "Verified, Failed, or Blocked, with the evidence to back it. Never a vague score."],
];

type TeamPricing = { configured: boolean; yearlyConfigured: boolean; monthly: { amount: number; currency: string } | null; yearly: { amount: number; currency: string } | null };

const fmtAmount = (n: number) => Math.round(n).toLocaleString();

export default function PricingPage() {
  const [signedIn, setSignedIn] = useState(false);
  const [team, setTeam] = useState<TeamPricing | null>(null);

  useEffect(() => {
    fetch("/api/v/me").then((r) => r.json()).then((j) => { if (j.signedIn) setSignedIn(true); }).catch(() => {});
    fetch("/api/v/team/pricing").then((r) => r.json()).then(setTeam).catch(() => {});
  }, []);

  const seatSym = (c?: string) => (!c || c === "USD" ? "$" : c + " ");
  const seatMoney = (m: { amount: number; currency: string } | null | undefined) => (m ? `${seatSym(m.currency)}${fmtAmount(m.amount)}` : null);
  const earlyAccess = signedIn ? "/app" : "/signin?callbackUrl=%2Fapp";

  return (
    <div>
      <section style={{ position: "relative" }}>
        <div className="glow glow--soft glow--bleed" />
        <div className="wrap" style={{ position: "relative", zIndex: 1, paddingTop: "clamp(44px, 6vw, 84px)", paddingBottom: "clamp(20px, 3vw, 30px)", textAlign: "center" }}>
          <p className="eyebrow" style={{ justifyContent: "center" }}>Pricing</p>
          <h1 className="display" style={{ fontSize: "clamp(2.2rem, 4.6vw, 3.6rem)", marginBottom: 16 }}>Priced by the <span className="em">run</span>, not the seat.</h1>
          <p className="lead-copy" style={{ margin: "0 auto", textAlign: "center" }}>Run your AI-built application through a real verification. Every verification includes browser execution, evidence, issue tracking, and an explainable decision.</p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: "clamp(24px, 3vw, 36px)" }}>
        <div className="wrap" style={{ maxWidth: 900 }}>
          <div className="tile-grid cols-2">
            <div className="price">
              <div className="price__name">Free</div>
              <div className="price__amt">$0</div>
              <div style={{ fontFamily: "var(--font-code)", fontSize: 12.5, color: "var(--acc-deep)", fontWeight: 600, marginTop: 6 }}>One complete verification</div>
              <div style={{ fontSize: 13.5, color: "var(--fg-3)" }}>See a real decision on your own app before paying anything. No card required.</div>
              <ul className="price__feat">
                <li>Up to 3 critical flows</li>
                <li>Real-browser execution with screenshot evidence</li>
                <li>A Verified, Failed, or Blocked decision</li>
              </ul>
              <Link className="btn" style={{ marginTop: "auto", justifyContent: "center" }} href={earlyAccess}>Run a verification</Link>
            </div>
            <div className="price price--hot">
              <div className="price__name">Pay as you go</div>
              <div className="price__amt">$10<small>/verification</small></div>
              <div style={{ fontFamily: "var(--font-code)", fontSize: 12.5, color: "var(--acc-deep)", fontWeight: 600, marginTop: 6 }}>Includes up to 5 approved critical flows</div>
              <div style={{ fontSize: 13.5, color: "var(--fg-3)" }}>$3 per additional approved flow. You only pay for verifications that actually execute.</div>
              <ul className="price__feat">
                <li>Real-browser execution, screenshots, and reproduction steps</li>
                <li>Linked failed-flow reruns after each fix</li>
                <li>Results stay with the application, never a seat charge</li>
              </ul>
              <Link className="btn" style={{ marginTop: "auto", justifyContent: "center" }} href={earlyAccess}>Run a verification</Link>
            </div>
          </div>

          <div style={{ marginTop: "clamp(36px, 5vw, 56px)" }}>
            <div className="sec-head sec-head--center" style={{ marginBottom: 24 }}>
              <p className="eyebrow">How verification pricing works</p>
              <h2 className="display" style={{ fontSize: "clamp(1.5rem, 2.6vw, 2rem)" }}>You pay for verifications that ran, and nothing else.</h2>
            </div>
            <div className="tile-grid cols-4">
              {PASS_RULES.map(([t, d]) => (
                <div key={t} className="acard" style={{ gap: 6 }}>
                  <div className="acard__t" style={{ fontSize: 15 }}>{t}</div>
                  <div className="acard__d">{d}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="tile-grid cols-2" style={{ marginTop: 22 }}>
            <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14, background: "var(--bg-2)", borderRadius: "var(--r-xl)" }}>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18, marginBottom: 6 }}>Monthly plans are coming</div>
                <p style={{ fontSize: 14, color: "var(--fg-3)", margin: 0, lineHeight: 1.55 }}>Bundled monthly verifications, higher limits, API access, and team workflows arrive with the platform release. Until then, pay as you go covers everything a launch needs.</p>
              </div>
              <Link className="btn btn--ghost" style={{ marginTop: "auto", alignSelf: "flex-start" }} href="/contact">Talk to us about volume</Link>
            </div>
            <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14, background: "var(--bg-2)", borderRadius: "var(--r-xl)" }}>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18, marginBottom: 6 }}>Working with a team?</div>
                <p style={{ fontSize: 14, color: "var(--fg-3)", margin: 0, lineHeight: 1.6 }}>Team seats are for internal collaborators who launch verifications and read reports with you. <strong style={{ color: "var(--fg-1)" }}>Client viewers are free</strong>, so you can share a client-safe report without a paid seat.</p>
              </div>
              <div style={{ marginTop: "auto" }}>
                {team?.monthly ? (
                  <div style={{ fontFamily: "var(--font-code)", fontSize: 12.5 }}>
                    <span style={{ color: "var(--acc-deep)", fontWeight: 600 }}>{seatMoney(team.monthly)}/seat/month</span>
                    {team.yearly && <span style={{ color: "var(--fg-3)" }}>, or {seatMoney(team.yearly)}/seat/year</span>}
                  </div>
                ) : null}
                <div style={{ fontSize: 11.5, color: "var(--fg-5)", marginTop: team?.monthly ? 6 : 0 }}>Manage seats in your workspace.</div>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 18, textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16, marginBottom: 6 }}>Running verifications at scale, or governing them across an org?</div>
            <p style={{ fontSize: 13.5, color: "var(--fg-3)", margin: "0 auto", maxWidth: 660, lineHeight: 1.7 }}>Organization governance, verified domains, OIDC single sign-on, and audit export live on the <Link href="/enterprise" style={{ color: "var(--acc-deep)" }}>Enterprise and security</Link> page.</p>
          </div>

          <p style={{ fontSize: 13, color: "var(--fg-4)", marginTop: 20, textAlign: "center", lineHeight: 1.6, maxWidth: 620, marginInline: "auto" }}>Early access: accounts currently run on included early-access balance while per-verification checkout rolls out. Payments are processed by Stripe.</p>
        </div>
      </section>
    </div>
  );
}
