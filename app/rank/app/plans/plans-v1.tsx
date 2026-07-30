"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  PLAN_CATALOG_V1, FREE_TIER, PASS_INCLUDED_FLOWS, EXTRA_FLOW_CENTS,
  passPriceCents, rerunPriceCents, type PlanV1,
} from "@/lib/preflight/pass-pricing";
import { usdFromCents, effectiveMonthlyUsd , planHeadline, planCapacity } from "@/lib/preflight/pass-pricing-format";

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
          <p>Run your AI-built application through a real verification. Every verification includes browser execution, evidence, issue tracking, and an explainable decision.</p>
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
          {/* The same headline every paid card uses, so the four read as one scale rather than three plans
              and an oddity beside them. One guarantee, proven once, at no cost. */}
          <div style={{ fontFamily: "var(--font-code)", fontSize: 12.5, color: "var(--acc-deep)", fontWeight: 600 }}>
            Protects {FREE_TIER.maxGuarantees} active guarantee
          </div>
          <div style={{ fontSize: 13.5, color: "var(--fg-3)" }}>A real decision on your own app before paying anything. No card required.</div>
          <div style={{ fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-5)", marginTop: 4 }}>Included</div>
          <ul className="price__feat">
            <li>{FREE_TIER.lifetimePasses} verification, up to {FREE_TIER.flowsPerPass} critical flows</li>
            <li>{FREE_TIER.maxApplications} connected application</li>
            <li>A full Verified, Failed, or Blocked decision</li>
            {/* Stated, because the API is now on every PAID plan and the difference has to be legible
                from the card rather than discovered when a key is refused. */}
            <li>Console only, no API or CLI</li>
          </ul>
          {/* A SUBSCRIBER NEEDS A WAY DOWN, and this offered them a sightseeing link instead.
              Every paid card says "Switch in billing" when you are on another plan. Free said "Open
              applications", which is not an action on this plan at all, so someone on Scale who wanted to
              stop paying had no path from the page whose entire job is choosing a plan. It also still said
              "applications" for a page renamed to Systems this morning, which is the same halfway rename
              being cleaned up everywhere else. */}
          {currentPlan ? (
            <button onClick={manageBilling} disabled={busy} className="btn btn--ghost" style={{ marginTop: "auto", justifyContent: "center" }}>
              {busy ? "Opening…" : "Cancel in billing"}
            </button>
          ) : (
            <Link className="btn btn--ghost" style={{ marginTop: "auto", justifyContent: "center" }} href="/systems">Run your free verification</Link>
          )}
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
              {/* THE HEADLINE IS THE PROTECTED SURFACE AREA. What a customer is buying is how many
                  outcomes stay proven, not how many times a browser opens. */}
              <div style={{ fontFamily: "var(--font-code)", fontSize: 12.5, color: "var(--acc-deep)", fontWeight: 600, marginTop: 2 }}>
                {planHeadline(p)}
              </div>
              <div style={{ fontSize: 13.5, color: "var(--fg-3)" }}>{PLAN_BLURBS[p.key]}</div>
              {/* And the capacity that pays for it, stated rather than implied. */}
              <div style={{ fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-5)", marginTop: 4 }}>Included</div>
              <ul className="price__feat">
                {planCapacity(p).map((f) => <li key={f}>{f}</li>)}
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

      {/* ── THE TIER THAT WAS NOT ON THE PAGE ────────────────────────────────────────────────────────
          An agency, a platform team or anyone with a procurement process reads four self-serve cards, sees
          a ceiling of 30 guarantees and no way to say "we need more and we need a contract", and leaves.
          The capability existed the whole time and was reachable only from a marketing page they had no
          reason to visit.

          EVERY LINE HERE IS SOMETHING /enterprise MARKS OPERATIONAL. OIDC single sign-on, roles, owner
          anchored billing, audit export. SAML is Preview there and SCIM is Planned, so neither is sold
          here: a card that promises a preview as though it shipped is the exact failure this product
          exists to catch, and enterprise buyers are the ones who check. */}
      <div className="card" style={{ marginTop: 22, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "16px clamp(20px, 3vw, 36px)" }}>
        <div style={{ flex: "1 1 380px", minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18, marginBottom: 6 }}>
            Enterprise: more than {PLAN_CATALOG_V1[PLAN_CATALOG_V1.length - 1].maxGuarantees} guarantees, or a contract
          </div>
          {/* THE LAST RUNG, IN THE SAME UNITS AS THE OTHER FOUR. Every card leads with how many
              guarantees it protects, so leaving this one blank ends the ladder mid-sentence. It is not
              "Unlimited" either: what a contract costs depends on verification volume, browser time,
              systems, retention and support, and a public number would underprice the first serious
              customer or promise something nobody had agreed to. Custom is the true word. */}
          <div style={{ fontFamily: "var(--font-code)", fontSize: 12.5, color: "var(--acc-deep)", fontWeight: 600, marginBottom: 6 }}>
            Custom guarantee capacity
          </div>
          <p style={{ fontSize: 13.5, color: "var(--fg-3)", margin: 0, lineHeight: 1.6 }}>
            Volume above the listed plans, single sign-on through your own identity provider, roles across a
            team, owner-anchored billing, and audit activity you can export. Invoicing, a signed agreement
            and a security review are all available. Written quotes, not a calculator.
          </p>
        </div>
        <a className="btn btn--ghost" style={{ flex: "none" }} href="mailto:sales@vraelis.com?subject=Vraelis%20Enterprise">Talk to sales</a>
      </div>

      {/* EVERY PLAN, STATED ONCE. These were bullets on all four cards, which differentiated nothing and
          padded three of them into looking fuller than they were. They are how the product works rather
          than something a tier buys, so they are said here, in one place, where they read as a floor
          instead of a feature. */}
      <div style={{ marginTop: 30, border: "1px solid var(--line-2)", borderRadius: "var(--r-lg, 14px)", background: "var(--bg-1)", padding: "18px 20px" }}>
        <div style={{ fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 10 }}>On every plan, including Free</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "10px 22px" }}>
          {[
            ["Real-browser evidence", "Screenshots and traces from the deployment itself, not a mock."],
            ["A decision, not a report", "Verified, Failed or Blocked. A run that merely finished is not a pass."],
            ["Linked repair verification", "A repair is proven against the guarantee it was meant to fix."],
            ["Targeted reruns", "Re-verify only the flows that failed, and pay only for those."],
            ["The permanent record", "Every run, its evidence and its verdict, kept. Withdrawn verdicts stay visible."],
            ["Cancel anytime", "Your record stays readable after you do."],
          ].map(([t, d]) => (
            <div key={t}>
              <div style={{ fontSize: 13.5, color: "var(--fg-1)", fontWeight: 500 }}>{t}</div>
              <div style={{ fontSize: 12.5, color: "var(--fg-4)", lineHeight: 1.55 }}>{d}</div>
            </div>
          ))}
        </div>
      </div>

      <p style={{ fontSize: 13, color: "var(--fg-4)", marginTop: 28, lineHeight: 1.6, textAlign: "center", maxWidth: 620, marginInline: "auto" }}>
        A guarantee is one business outcome that must stay true. Verifications are how it is proven, and a
        re-verification from the console, the CLI or the API draws on the same monthly allowance. Unused
        monthly allowance resets each subscription month. Annual plans are charged up front and release usage
        monthly. Payments are processed by Stripe.
      </p>
    </div>
  );
}
