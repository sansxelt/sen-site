"use client";

import { useEffect, useState } from "react";

// Pricing leads with the outcome (a check), not a tier ladder. Credits stay the
// backend unit: 1 credit = 1 AI check, or 1 valid human judgment when you validate.
// Recurring plans + enterprise governance live at /enterprise.

const CREDIT_RULES: [string, string][] = [
  ["1 credit = 1 check", "The unit you spend. One credit runs one AI check. Validating on real people spends 1 credit per valid judgment."],
  ["Filtered responses: not charged", "On human validation, responses filtered for speed, spam, velocity, or low reputation never cost a credit."],
  ["Validation is escrowed", "Credits for a human validation are held when you launch it, not spent up front."],
  ["Unused credits refunded", "If a validation run doesn't fill, the remaining credits return to your account."],
];

type TeamPricing = { configured: boolean; yearlyConfigured: boolean; monthly: { amount: number; currency: string } | null; yearly: { amount: number; currency: string } | null };

// Display-only rounding for team seat prices (live Stripe price may carry cents).
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

  return (
    <div>
      <section style={{ position: "relative" }}>
        <div className="glow glow--soft glow--bleed" />
        <div className="wrap" style={{ position: "relative", zIndex: 1, paddingTop: "clamp(44px, 6vw, 84px)", paddingBottom: "clamp(20px, 3vw, 30px)", textAlign: "center" }}>
          <p className="eyebrow" style={{ justifyContent: "center" }}>Pricing</p>
          <h1 className="display" style={{ fontSize: "clamp(2.2rem, 4.6vw, 3.6rem)", marginBottom: 16 }}>Simple pricing. <span className="em">Start with free credits</span>.</h1>
          <p className="lead-copy" style={{ margin: "0 auto", textAlign: "center" }}>New accounts start with <strong style={{ color: "var(--fg-1)" }}>free credits</strong>, so your first checks are on us. After that it&apos;s <strong style={{ color: "var(--fg-1)" }}>1 credit per check</strong>, and <strong style={{ color: "var(--fg-1)" }}>$1 buys 10 credits</strong> that never expire. Want humans to weigh in? A validation spends 1 credit per valid judgment, and you&apos;re never charged for the responses we filter out.</p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: "clamp(24px, 3vw, 36px)" }}>
        <div className="wrap" style={{ maxWidth: 900 }}>
          <div className="tile-grid cols-2">
            {/* Free report */}
            <div className="price">
              <div className="price__name">Free to start</div>
              <div className="price__amt">$0</div>
              <div style={{ fontFamily: "var(--font-code)", fontSize: 12.5, color: "var(--acc-deep)", fontWeight: 600, marginTop: 6 }}>Free signup credits</div>
              <div style={{ fontSize: 13.5, color: "var(--fg-3)" }}>Run real checks before you pay a cent.</div>
              <ul className="price__feat">
                <li>Instant checks on your AI output</li>
                <li>Scores, the version to ship, and line-level fixes</li>
                <li>Validate on real people when you want to</li>
              </ul>
              <a className="btn" style={{ marginTop: "auto", justifyContent: "center" }} href="/app/checks/new">Check your AI output</a>
            </div>
            {/* pay as you go */}
            <div className="price price--hot">
              <div className="price__name">Pay as you go</div>
              <div className="price__amt">$1<small>/10 credits</small></div>
              <div style={{ fontFamily: "var(--font-code)", fontSize: 12.5, color: "var(--acc-deep)", fontWeight: 600, marginTop: 6 }}>1 credit per check</div>
              <div style={{ fontSize: 13.5, color: "var(--fg-3)" }}>Top up whenever. Credits never expire, and human validation is there when the call matters.</div>
              <ul className="price__feat">
                <li>1 credit per AI check</li>
                <li>Human validation: 1 credit per valid judgment</li>
                <li>Structured results by API, export as JSON or CSV</li>
              </ul>
              <a className="btn" style={{ marginTop: "auto", justifyContent: "center" }} href="/app/checks/new">Check your AI output</a>
            </div>
          </div>

          {/* credit rules */}
          <div style={{ marginTop: "clamp(36px, 5vw, 56px)" }}>
            <div className="sec-head sec-head--center" style={{ marginBottom: 24 }}>
              <p className="eyebrow">How credits work</p>
              <h2 className="display" style={{ fontSize: "clamp(1.5rem, 2.6vw, 2rem)" }}>Only valid responses cost credits. Rejected ones don&apos;t.</h2>
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

          {/* top-ups */}
          <div className="card" style={{ marginTop: 22, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap", background: "var(--bg-2)", borderRadius: "var(--r-xl)" }}>
            <div style={{ maxWidth: 520 }}>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18, marginBottom: 4 }}>Prefer to run it yourself?</div>
              <p style={{ fontSize: 14, color: "var(--fg-3)", margin: 0, lineHeight: 1.55 }}>Buy credits and launch runs from your own console. Custom top-ups from $5 to $999,999. Every $1 adds 10 credits, and they never expire. Larger volumes are available by invoice.</p>
            </div>
            <a className="btn btn--lg" href={signedIn ? "/app/credits" : "/signin?callbackUrl=%2Fapp%2Fcredits"}>Buy credits</a>
          </div>

          {/* team seats */}
          <div className="card" style={{ marginTop: 18, background: "var(--bg-2)", borderRadius: "var(--r-xl)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
              <div style={{ maxWidth: 560 }}>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18, marginBottom: 4 }}>Working with a team?</div>
                <p style={{ fontSize: 14, color: "var(--fg-3)", margin: 0, lineHeight: 1.6 }}>Team seats are for internal collaborators: Admins, Editors, and Viewers who run checks and read analytics with you. <strong style={{ color: "var(--fg-1)" }}>Client viewers are free</strong>: invite clients to read client-safe decision reports without a paid seat.</p>
              </div>
              {team?.monthly && (
                <div style={{ textAlign: "right", minWidth: 180 }}>
                  <div style={{ fontFamily: "var(--font-code)", fontSize: 12.5, color: "var(--acc-deep)", fontWeight: 600 }}>{seatMoney(team.monthly)}/seat/month</div>
                  {team.yearly && <div style={{ fontFamily: "var(--font-code)", fontSize: 12.5, color: "var(--fg-3)", marginTop: 4 }}>or {seatMoney(team.yearly)}/seat/year</div>}
                  <div style={{ fontSize: 11.5, color: "var(--fg-5)", marginTop: 6 }}>Manage seats in your workspace</div>
                </div>
              )}
            </div>
          </div>

          {/* plans + enterprise moved to /enterprise */}
          <div className="card" style={{ marginTop: 18, textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16, marginBottom: 6 }}>Running checks at scale, or governing them across an org?</div>
            <p style={{ fontSize: 13.5, color: "var(--fg-3)", margin: "0 auto", maxWidth: 660, lineHeight: 1.7 }}>Recurring plans with monthly credits and API access, plus organization governance, verified domains, OIDC single sign-on, and audit export, live on the <a href="/enterprise" style={{ color: "var(--acc-deep)" }}>Enterprise &amp; security</a> page.</p>
          </div>

          <p style={{ fontSize: 13, color: "var(--fg-4)", marginTop: 20, textAlign: "center", lineHeight: 1.6, maxWidth: 620, marginInline: "auto" }}>Secure checkout on Vraelis. Payments processed by Stripe. Recurring plans renew automatically and can be cancelled anytime; manage them from your workspace.</p>
        </div>
      </section>
    </div>
  );
}
