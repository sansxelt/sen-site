"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usdFromCents } from "@/lib/preflight/pass-pricing-format";

// Pass Preview: shows exactly what a Production Pass would cost / deduct for the selected flows BEFORE
// launch, by reading the read-only /pass-preview route (which calls the SAME gatePassLaunch the launch path
// uses — the preview can never diverge from the charge). Every dollar renders via usdFromCents so a
// hardcoded string can never drift from the real price (pricing-v1-ui-verify enforces this). The flag is
// server-side: with pricing off the route returns mode 'legacy' and this shows a neutral "included" note.

// Mirrors the server PassGateDecision (lib/preflight/entitlements-v1.ts). The subscription-ok branch
// carries the PlanV1 OBJECT (not a string), so plan.name is the display label — interpolating the whole
// object would render "[object Object]".
type PlanRef = { key: string; name: string };
type Decision =
  | { mode: "legacy"; ok: true }
  | { mode: "subscription"; ok: true; plan: PlanRef; unitsAfter: number }
  | { mode: "subscription"; ok: false; error: string; message: string }
  | { mode: "free"; ok: true }
  | { mode: "payg"; ok: true; cents: number; unverified?: boolean }
  | { mode: "frozen"; ok: false; error: string; message: string };

type RoleReadiness = { role: string; ok: boolean; credentialState: string; environmentMatch: boolean; reason?: string };
type Readiness = { requiresAuth: boolean; ok: boolean; roles: RoleReadiness[]; reasons: string[] };
type Preview = { selectedCount: number; eligibleCount: number; decision: Decision; readiness: Readiness | null };

const box: React.CSSProperties = { border: "1px solid var(--line-2)", borderRadius: "var(--r-md, 12px)", background: "var(--bg-2)", padding: "14px 16px" };
const lab: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)" };
const price: React.CSSProperties = { fontSize: 22, fontWeight: 700, color: "var(--fg-1)", fontVariantNumeric: "tabular-nums" };

export function PassPreview({ appId, flowIds }: { appId: string; flowIds?: string[] }) {
  const [data, setData] = useState<Preview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    const qs = flowIds && flowIds.length ? `?flow_ids=${encodeURIComponent(flowIds.join(","))}` : "";
    (async () => {
      try {
        const r = await fetch(`/api/preflight/apps/${appId}/pass-preview${qs}`);
        const j = await r.json().catch(() => null);
        if (!live) return;
        if (!r.ok) { setErr(j?.message || "Could not price this verification."); setData(null); }
        else { setErr(null); setData(j as Preview); }
      } catch {
        if (live) setErr("Could not price this verification.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, [appId, flowIds]);

  if (loading) return <div style={box}><span style={lab}>Verification preview</span><p style={{ color: "var(--fg-4)", fontSize: 13, margin: "8px 0 0" }}>Pricing this verification…</p></div>;
  if (err) return <div style={box}><span style={lab}>Verification preview</span><p style={{ color: "var(--fg-3)", fontSize: 13, margin: "8px 0 0" }}>{err}</p></div>;
  if (!data) return null;

  const { selectedCount, decision } = data;
  const flowLabel = `${selectedCount} ${selectedCount === 1 ? "flow" : "flows"}`;

  // Render the exact decision the launch path produced.
  let headline: React.ReactNode;
  let note: string | null = null;
  switch (decision.mode) {
    case "payg":
      headline = <span style={price}>{usdFromCents(decision.cents)}</span>;
      // unverified: the free-pass eligibility read failed transiently and we fell back to PAYG. Honest,
      // non-permanent copy — the user is NOT told they are permanently ineligible.
      note = decision.unverified
        ? "We couldn't verify your free verification eligibility right now. Try again later or continue with Pay as you go."
        : "Charged when you launch. No hold is placed until every readiness check passes.";
      break;
    case "free":
      headline = <span style={price}>Included</span>;
      note = "Your one lifetime free verification covers this (up to 3 flows).";
      break;
    case "subscription":
      if (decision.ok) {
        headline = <span style={price}>Included</span>;
        note = `On your ${decision.plan.name} plan. ${decision.unitsAfter} flow ${decision.unitsAfter === 1 ? "unit" : "units"} left this month after this verification.`;
      } else {
        headline = <span style={{ ...price, color: "var(--err)" }}>Not available</span>;
        note = decision.message;
      }
      break;
    case "frozen":
      headline = <span style={{ ...price, color: "var(--err)" }}>On hold</span>;
      note = decision.message;
      break;
    case "legacy":
    default:
      headline = <span style={price}>Included</span>;
      note = "This verification runs on your current plan.";
      break;
  }

  return (
    <div style={box}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <span style={lab}>Verification preview</span>
        <span style={{ fontSize: 12.5, color: "var(--fg-3)" }}>{flowLabel}</span>
      </div>
      <div style={{ marginTop: 10 }}>{headline}</div>
      {note ? <p style={{ fontSize: 12.5, color: "var(--fg-3)", margin: "8px 0 0", lineHeight: 1.5 }}>{note}</p> : null}

      {/* Auth readiness (HF2): shown before the click for a pass whose flows sign in as a role. Each role
          reads ready / needs attention, so a missing/revoked/env-mismatched test account is caught here
          rather than as a red error after Launch. Never shows a secret or username. */}
      {data.readiness && data.readiness.requiresAuth ? (
        <div style={{ marginTop: 12, borderTop: "1px solid var(--line-1)", paddingTop: 10 }}>
          <div style={{ ...lab, marginBottom: 6 }}>Sign-in readiness</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {data.readiness.roles.map((r) => (
              <div key={r.role} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", flex: "none", background: r.ok ? "var(--acc-deep, #0A7B54)" : "var(--err)" }} />
                <span style={{ color: "var(--fg-1)", fontWeight: 600 }}>{r.role}</span>
                <span style={{ color: r.ok ? "var(--fg-3)" : "var(--err)" }}>
                  {r.ok ? "ready" : (r.reason || (r.credentialState === "missing" ? "no test account" : r.credentialState === "revoked" ? "account revoked" : !r.environmentMatch ? "environment mismatch" : "not ready"))}
                </span>
              </div>
            ))}
          </div>
          {!data.readiness.ok ? (
            <Link href={`/applications/${appId}/settings/connections`} style={{ display: "inline-block", marginTop: 8, fontSize: 12.5, fontWeight: 600, color: "var(--acc-deep, #0A7B54)", textDecoration: "none" }}>
              Manage test accounts →
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
