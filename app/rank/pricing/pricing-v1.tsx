"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  PLAN_CATALOG_V1, FREE_TIER, PASS_INCLUDED_FLOWS, EXTRA_FLOW_CENTS,
  passPriceCents, rerunPriceCents, type PlanV1,
} from "@/lib/preflight/pass-pricing";
import { usdFromCents, effectiveMonthlyUsd , planHeadline, planCapacity } from "@/lib/preflight/pass-pricing-format";

// The approved _v1 pricing ladder (docs/pricing-verdict-final.md), rendered ONLY when
// VRAELIS_PASS_PRICING=1 (the server gate in page.tsx keeps the legacy page byte-identical until then).
// Every dollar figure on this page is formatted from cents exported by lib/preflight/pass-pricing.ts;
// scripts/pricing-v1-ui-verify.ts fails the build script if a dollar amount is ever hardcoded here.
// Cards list ONLY implemented entitlements (verdict ruling 10): passes/month, flows/pass, application
// caps, real-browser evidence, launch decision, linked repair verification, targeted reruns.

type Cycle = "monthly" | "yearly";

const PLAN_BLURBS: Record<PlanV1["key"], string> = {
  builder_v1: "For one product moving steadily toward launch.",
  pro_v1: "For teams launching continuously across applications.",
  scale_v1: "For agencies and platforms verifying at volume.",
};

export default function PricingV1({ initialCycle = "monthly" }: { initialCycle?: Cycle }) {
  const [signedIn, setSignedIn] = useState(false);
  const [cycle, setCycle] = useState<Cycle>(initialCycle);

  useEffect(() => {
    fetch("/api/v/me").then((r) => r.json()).then((j) => { if (j.signedIn) setSignedIn(true); }).catch(() => {});
  }, []);

  const earlyAccess = signedIn ? "/app" : "/signin?callbackUrl=%2Fapp";
  const checkoutHref = (key: PlanV1["key"]) => {
    const dest = `/checkout?plan=${key}&cycle=${cycle}`;
    return signedIn ? dest : `/signin?callbackUrl=${encodeURIComponent(dest)}`;
  };

  return (
    <div>
      <section style={{ position: "relative" }}>
        <div className="glow glow--soft glow--bleed" />
        <div className="wrap" style={{ position: "relative", zIndex: 1, paddingTop: "clamp(44px, 6vw, 84px)", paddingBottom: "clamp(20px, 3vw, 30px)", textAlign: "center" }}>
          <p className="eyebrow" style={{ justifyContent: "center" }}>Pricing</p>
          <h1 className="display" style={{ fontSize: "clamp(2.2rem, 4.6vw, 3.6rem)", marginBottom: 16 }}>Priced by the <span className="em">run</span>, not the seat.</h1>
          <p className="lead-copy" style={{ margin: "0 auto", textAlign: "center" }}>Run your AI-built application through a real production review. Every verification includes browser execution, evidence, issue tracking, and an explainable launch decision.</p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: "clamp(20px, 3vw, 32px)" }}>
        <div className="wrap">
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 26 }}>
            <div className="seg" role="group" aria-label="Billing cycle">
              <button type="button" className={cycle === "monthly" ? "on" : ""} onClick={() => setCycle("monthly")}>Monthly</button>
              <button type="button" className={cycle === "yearly" ? "on" : ""} onClick={() => setCycle("yearly")}>Yearly<span className="seg__save">Save 17%</span></button>
            </div>
          </div>

          <div className="tile-grid cols-4">
            <div className="price">
              <div className="price__name">Free</div>
              <div className="price__amt">{usdFromCents(0)}</div>
              {/* The same headline every paid card uses, so the four read as one scale rather than three
                  plans and an oddity beside them. */}
              <div style={{ fontFamily: "var(--font-code)", fontSize: 12.5, color: "var(--acc-deep)", fontWeight: 600 }}>
                Protects {FREE_TIER.maxGuarantees} active guarantee
              </div>
              <div style={{ fontSize: 13.5, color: "var(--fg-3)" }}>See a real launch decision on your own app before paying anything. No card required.</div>
              <div style={{ fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-5)", marginTop: 4 }}>Included</div>
              <ul className="price__feat">
                <li>{FREE_TIER.lifetimePasses} verification, up to {FREE_TIER.flowsPerPass} critical flows</li>
                <li>{FREE_TIER.maxApplications} connected application</li>
                <li>A full Verified, Failed, or Blocked decision</li>
                {/* Free is the ONE tier without the API, now that every paid plan has it. Stated on the
                    card rather than discovered when a key is refused. */}
                <li>Console only, no API or CLI</li>
              </ul>
              <Link className="btn btn--ghost" style={{ marginTop: "auto", justifyContent: "center" }} href={earlyAccess}>Run a verification</Link>
            </div>

            {PLAN_CATALOG_V1.map((p) => (
              <div key={p.key} className={p.key === "pro_v1" ? "price price--hot" : "price"}>
                <div className="price__name">{p.name}</div>
                {cycle === "monthly" ? (
                  <>
                    <div className="price__amt">{usdFromCents(p.monthlyCents)}<small>/mo</small></div>
                    <div style={{ fontFamily: "var(--font-code)", fontSize: 12.5, color: "var(--acc-deep)", fontWeight: 600 }}>Billed monthly</div>
                  </>
                ) : (
                  // Yearly: lead with the lower monthly-effective price (it converts better), and show the
                  // real annual total the customer is charged clearly beneath it — big enough that they know
                  // exactly what they're buying, never a fine-print gotcha.
                  <>
                    <div className="price__amt">{effectiveMonthlyUsd(p.yearlyCents)}<small>/mo</small></div>
                    <div style={{ fontSize: 14, color: "var(--fg-2)", fontWeight: 600, marginTop: 2 }}>
                      {usdFromCents(p.yearlyCents)} billed yearly
                    </div>
                  </>
                )}
                <div style={{ fontSize: 13.5, color: "var(--fg-3)" }}>{PLAN_BLURBS[p.key]}</div>
                {/* Headline first, capacity under it, both from the one shared source, so this page and
                    the console cannot end up describing the same plan two different ways. */}
                <div style={{ fontFamily: "var(--font-code)", fontSize: 12.5, color: "var(--acc-deep)", fontWeight: 600, marginTop: 2 }}>{planHeadline(p)}</div>
                <div style={{ fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-5)", marginTop: 4 }}>Included</div>
                <ul className="price__feat">
                  {planCapacity(p).map((f) => <li key={f}>{f}</li>)}
                </ul>
                <Link className={p.key === "pro_v1" ? "btn" : "btn btn--ghost"} style={{ marginTop: "auto", justifyContent: "center" }} href={checkoutHref(p.key)}>Choose {p.name}</Link>
              </div>
            ))}
          </div>

          <div className="card" style={{ marginTop: 22, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "16px clamp(20px, 3vw, 36px)" }}>
            <div style={{ flex: "1 1 380px", minWidth: 0 }}>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18, marginBottom: 6 }}>
                Pay as you go: {usdFromCents(passPriceCents(PASS_INCLUDED_FLOWS))} per verification
              </div>
              <p style={{ fontSize: 13.5, color: "var(--fg-3)", margin: 0, lineHeight: 1.6 }}>
                {PASS_INCLUDED_FLOWS} flows included, {usdFromCents(EXTRA_FLOW_CENTS)} per additional flow. Targeted reruns
                cost {usdFromCents(rerunPriceCents(1))} per selected failed flow and never more than a comparable full verification.
                No subscription required.
              </p>
            </div>
            <Link className="btn btn--ghost" style={{ flex: "none" }} href="/credits">Add balance</Link>
          </div>

          <p style={{ fontSize: 13, color: "var(--fg-4)", marginTop: 20, textAlign: "center", lineHeight: 1.6, maxWidth: 620, marginInline: "auto" }}>
            Unused monthly allowance resets each subscription month. Annual plans are charged up front and release usage monthly. Payments are processed by Stripe.
          </p>
        </div>
      </section>
    </div>
  );
}
