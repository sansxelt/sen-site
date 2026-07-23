"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  PLAN_CATALOG_V1, FREE_TIER, PASS_INCLUDED_FLOWS, EXTRA_FLOW_CENTS,
  passPriceCents, rerunPriceCents, type PlanV1,
} from "@/lib/preflight/pass-pricing";
import { usdFromCents, effectiveMonthlyUsd } from "@/lib/preflight/pass-pricing-format";

// Signed-in plans surface for the _v1 cutover: the SAME approved ladder as /pricing (pricing-v1.tsx),
// plus account state: the current plan is marked, the current subscription month's usage is shown when
// we can read it (degrades to absent), and Manage billing keeps opening the Stripe portal. Rendered only
// when VRAELIS_PASS_PRICING=1; the old $99/$299 preview lives exclusively in plans-legacy.tsx and dies
// at the flip. Every dollar figure is formatted from lib/preflight/pass-pricing.ts cents.

type Cycle = "monthly" | "yearly";
type Usage = { subscribed: boolean; plan?: string; passesUsed?: number; passesPerMonth?: number; windowEnd?: string };

const PLAN_BLURBS: Record<PlanV1["key"], string> = {
  builder_v1: "For one product moving steadily toward launch.",
  pro_v1: "For teams launching continuously across applications.",
  scale_v1: "For agencies and platforms verifying at volume.",
};

function planFeatures(p: PlanV1): string[] {
  return [
    `Validate ${p.passesPerMonth} launches a month (${p.passesPerMonth} verifications)`,
    `Up to ${p.flowsPerPass} flows verified per run`,
    p.maxApplications === null ? "No cap on connected applications" : `${p.maxApplications} connected applications`,
    "Real-browser evidence with screenshots",
    "Linked repair verification",
    "Targeted reruns spend only the selected flows",
    "Cancel anytime",
  ];
}

export default function PlansV1({ initialCycle = "monthly" }: { initialCycle?: Cycle }) {
  const [signedIn, setSignedIn] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [cycle, setCycle] = useState<Cycle>(initialCycle);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    fetch("/api/v/me").then((r) => r.json()).then((j) => {
      if (j.signedIn) setSignedIn(true);
      if (j.plan_v1) { setCurrentPlan(String(j.plan_v1)); if (j.plan_v1_cycle === "yearly") setCycle("yearly"); }
    }).catch(() => {});
    fetch("/api/preflight/usage").then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (j?.subscribed) setUsage(j as Usage);
    }).catch(() => {});
  }, []);

  async function manageBilling() {
    setBusy(true); setNote("");
    try {
      const r = await fetch("/api/v/portal", { method: "POST" });
      const j = await r.json().catch(() => ({}));
      if (j.url) window.location.href = j.url;
      else setNote(j.error === "no_subscription" ? "No billing account yet. There is nothing to manage until your first purchase." : "Couldn't open billing. Try again.");
    } catch { setNote("Couldn't open billing. Try again."); } finally { setBusy(false); }
  }

  const catalogPlan = currentPlan ? PLAN_CATALOG_V1.find((p) => p.key === currentPlan) ?? null : null;
  const resetsOn = usage?.windowEnd ? new Date(usage.windowEnd).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : null;

  return (
    <div className="wrap" style={{ maxWidth: 1180, paddingTop: "clamp(24px, 3vw, 38px)", paddingBottom: 80 }}>
      <div className="phead">
        <div>
          <p className="eyebrow">Plans</p>
          <h1 className="display">Priced by the run, not the seat</h1>
          <p>Run your AI-built application through a real production review. Every verification includes browser execution, evidence, issue tracking, and an explainable launch decision.</p>
        </div>
        {signedIn && <button onClick={manageBilling} disabled={busy} className="btn btn--ghost">{busy ? "Opening…" : "Manage billing"}</button>}
      </div>
      {note && <p style={{ color: "var(--fg-3)", fontSize: 13, marginBottom: 14 }}>{note}</p>}

      {catalogPlan && (
        <div className="card" style={{ marginBottom: 22, display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "8px 18px" }}>
          <span className="badge-now">Current plan</span>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16 }}>{catalogPlan.name}</span>
          {usage?.subscribed && typeof usage.passesUsed === "number" && typeof usage.passesPerMonth === "number" && (
            <span style={{ fontFamily: "var(--font-code)", fontSize: 12.5, color: "var(--fg-3)" }}>
              {usage.passesUsed} of {usage.passesPerMonth} verifications used this month{resetsOn ? `, allowance resets ${resetsOn}` : ""}
            </span>
          )}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 20 }}>
        <div className="seg" role="group" aria-label="Billing cycle">
          <button type="button" className={cycle === "monthly" ? "on" : ""} onClick={() => setCycle("monthly")}>Monthly</button>
          <button type="button" className={cycle === "yearly" ? "on" : ""} onClick={() => setCycle("yearly")}>Yearly<span className="seg__save">Save 17%</span></button>
        </div>
      </div>

      <div className="tile-grid cols-4">
        <div className="price">
          <div className="price__name">Free</div>
          <div className="price__amt">{usdFromCents(0)}</div>
          <div style={{ fontFamily: "var(--font-code)", fontSize: 12.5, color: "var(--acc-deep)", fontWeight: 600 }}>One lifetime free verification</div>
          <div style={{ fontSize: 13.5, color: "var(--fg-3)" }}>A real launch decision on your own app before paying anything. No card required.</div>
          <ul className="price__feat">
            <li>Up to {FREE_TIER.flowsPerPass} critical flows</li>
            <li>{FREE_TIER.maxApplications} application</li>
            <li>Real-browser evidence with screenshots</li>
            <li>A full Verified, Failed, or Blocked decision</li>
          </ul>
          <Link className="btn btn--ghost" style={{ marginTop: "auto", justifyContent: "center" }} href="/applications">{currentPlan ? "Open applications" : "Run your free verification"}</Link>
        </div>

        {PLAN_CATALOG_V1.map((p) => {
          const isCurrent = p.key === currentPlan;
          return (
            <div key={p.key} className={p.key === "pro_v1" ? "price price--hot" : "price"} style={isCurrent ? { borderColor: "var(--acc-line-2)" } : undefined}>
              <div className="price__name" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {p.name}{isCurrent && <span className="badge-now">Current plan</span>}
              </div>
              {cycle === "monthly" ? (
                <>
                  <div className="price__amt">{usdFromCents(p.monthlyCents)}<small>/mo</small></div>
                  <div style={{ fontFamily: "var(--font-code)", fontSize: 12.5, color: "var(--acc-deep)", fontWeight: 600 }}>Billed monthly</div>
                </>
              ) : (
                // Yearly: headline the monthly-effective price, with the annual total shown clearly below.
                <>
                  <div className="price__amt">{effectiveMonthlyUsd(p.yearlyCents)}<small>/mo</small></div>
                  <div style={{ fontSize: 14, color: "var(--fg-2)", fontWeight: 600, marginTop: 2 }}>{usdFromCents(p.yearlyCents)} billed yearly</div>
                </>
              )}
              <div style={{ fontSize: 13.5, color: "var(--fg-3)" }}>{PLAN_BLURBS[p.key]}</div>
              <ul className="price__feat">
                {planFeatures(p).map((f) => <li key={f}>{f}</li>)}
              </ul>
              {isCurrent ? (
                <button onClick={manageBilling} disabled={busy} className="btn btn--ghost" style={{ marginTop: "auto", justifyContent: "center" }}>{busy ? "Opening…" : "Manage billing"}</button>
              ) : currentPlan ? (
                // Already subscribed: plan changes go through the Stripe portal so the existing
                // subscription is updated (prorated) instead of a second one being created.
                <button onClick={manageBilling} disabled={busy} className="btn btn--ghost" style={{ marginTop: "auto", justifyContent: "center" }}>{busy ? "Opening…" : "Switch in billing"}</button>
              ) : (
                <Link className={p.key === "pro_v1" ? "btn" : "btn btn--ghost"} style={{ marginTop: "auto", justifyContent: "center" }} href={`/checkout?plan=${p.key}&cycle=${cycle}`}>Choose {p.name}</Link>
              )}
            </div>
          );
        })}
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

      <p style={{ fontSize: 13, color: "var(--fg-4)", marginTop: 28, lineHeight: 1.6, textAlign: "center", maxWidth: 620, marginInline: "auto" }}>
        Unused monthly allowance resets each subscription month. Annual plans are charged up front and release usage monthly. Payments are processed by Stripe.
      </p>
    </div>
  );
}
