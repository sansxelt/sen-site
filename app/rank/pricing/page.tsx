"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Pricing leads with the outcome (a preflight run), not a tier ladder. Credits are the backend unit: a run
// holds a credit per approved flow and settles on completion. Recurring plans + enterprise governance live
// at /enterprise. Team seat prices come live from Stripe via /api/v/team/pricing.

const CREDIT_RULES: [string, string][] = [
  ["Credits fund runs", "You buy credits once. A preflight run holds a credit per approved flow and settles when it finishes."],
  ["Nothing ran, nothing charged", "If a run cannot start or no flow executes, the full hold is refunded automatically."],
  ["New accounts start free", "Every new account gets free credits, so you can run a real preflight before paying."],
  ["Credits never expire", "Top up whenever you need to. Every dollar adds ten credits and they never expire."],
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
          <p className="lead-copy" style={{ margin: "0 auto", textAlign: "center" }}>Vraelis runs your AI-built app like production before your users do. New accounts start with <strong style={{ color: "var(--fg-1)" }}>free credits</strong>, so your first run is on us. After that a preflight run holds a credit per approved flow, and <strong style={{ color: "var(--fg-1)" }}>$1 buys 10 credits</strong> that never expire.</p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: "clamp(24px, 3vw, 36px)" }}>
        <div className="wrap" style={{ maxWidth: 900 }}>
          <div className="tile-grid cols-2">
            <div className="price">
              <div className="price__name">Free to start</div>
              <div className="price__amt">$0</div>
              <div style={{ fontFamily: "var(--font-code)", fontSize: 12.5, color: "var(--acc-deep)", fontWeight: 600, marginTop: 6 }}>Free signup credits</div>
              <div style={{ fontSize: 13.5, color: "var(--fg-3)" }}>Run a real preflight before you pay a cent.</div>
              <ul className="price__feat">
                <li>A real browser run of your approved flows</li>
                <li>Two-user state and isolation proof</li>
                <li>The Production Pass launch decision with evidence</li>
              </ul>
              <Link className="btn" style={{ marginTop: "auto", justifyContent: "center" }} href={earlyAccess}>Get early access</Link>
            </div>
            <div className="price price--hot">
              <div className="price__name">Pay as you go</div>
              <div className="price__amt">$1<small>/10 credits</small></div>
              <div style={{ fontFamily: "var(--font-code)", fontSize: 12.5, color: "var(--acc-deep)", fontWeight: 600, marginTop: 6 }}>A credit per approved flow</div>
              <div style={{ fontSize: 13.5, color: "var(--fg-3)" }}>Top up whenever. Credits never expire, and you only pay for runs that actually execute.</div>
              <ul className="price__feat">
                <li>Real browser evidence, screenshots, and repro steps</li>
                <li>Rerun the exact failed check after a fix</li>
                <li>Results in the app, by API, or as a gate in CI</li>
              </ul>
              <Link className="btn" style={{ marginTop: "auto", justifyContent: "center" }} href={earlyAccess}>Get early access</Link>
            </div>
          </div>

          <div style={{ marginTop: "clamp(36px, 5vw, 56px)" }}>
            <div className="sec-head sec-head--center" style={{ marginBottom: 24 }}>
              <p className="eyebrow">How credits work</p>
              <h2 className="display" style={{ fontSize: "clamp(1.5rem, 2.6vw, 2rem)" }}>You pay for runs that ran, and nothing else.</h2>
            </div>
            <div className="tile-grid cols-4">
              {CREDIT_RULES.map(([t, d]) => (
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
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18, marginBottom: 6 }}>Buy credits up front</div>
                <p style={{ fontSize: 14, color: "var(--fg-3)", margin: 0, lineHeight: 1.55 }}>Top up from your console and launch runs whenever you like. Custom amounts from $5 to $999,999, every dollar adds ten credits, and they never expire. Larger volumes by invoice.</p>
              </div>
              <Link className="btn" style={{ marginTop: "auto", alignSelf: "flex-start" }} href={signedIn ? "/app/credits" : "/signin?callbackUrl=%2Fapp%2Fcredits"}>Buy credits</Link>
            </div>
            <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14, background: "var(--bg-2)", borderRadius: "var(--r-xl)" }}>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18, marginBottom: 6 }}>Working with a team?</div>
                <p style={{ fontSize: 14, color: "var(--fg-3)", margin: 0, lineHeight: 1.6 }}>Team seats are for internal collaborators who launch runs and read reports with you. <strong style={{ color: "var(--fg-1)" }}>Client viewers are free</strong>, so you can share a client-safe report without a paid seat.</p>
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
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16, marginBottom: 6 }}>Running preflight at scale, or governing it across an org?</div>
            <p style={{ fontSize: 13.5, color: "var(--fg-3)", margin: "0 auto", maxWidth: 660, lineHeight: 1.7 }}>Recurring plans with monthly credits and API access, plus organization governance, verified domains, OIDC single sign-on, and audit export, live on the <Link href="/enterprise" style={{ color: "var(--acc-deep)" }}>Enterprise and security</Link> page.</p>
          </div>

          <p style={{ fontSize: 13, color: "var(--fg-4)", marginTop: 20, textAlign: "center", lineHeight: 1.6, maxWidth: 620, marginInline: "auto" }}>Secure checkout on Vraelis, payments processed by Stripe. Recurring plans renew automatically and can be cancelled anytime from your workspace.</p>
        </div>
      </section>
    </div>
  );
}
