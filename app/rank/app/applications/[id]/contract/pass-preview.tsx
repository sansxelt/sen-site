"use client";

import { useEffect, useState } from "react";
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

type Preview = { selectedCount: number; eligibleCount: number; decision: Decision };

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
        if (!r.ok) { setErr(j?.message || "Could not price this pass."); setData(null); }
        else { setErr(null); setData(j as Preview); }
      } catch {
        if (live) setErr("Could not price this pass.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, [appId, flowIds]);

  if (loading) return <div style={box}><span style={lab}>Pass preview</span><p style={{ color: "var(--fg-4)", fontSize: 13, margin: "8px 0 0" }}>Pricing this pass…</p></div>;
  if (err) return <div style={box}><span style={lab}>Pass preview</span><p style={{ color: "var(--fg-3)", fontSize: 13, margin: "8px 0 0" }}>{err}</p></div>;
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
        ? "We couldn't verify your free-pass eligibility right now. Try again later or continue with Pay as you go."
        : "Charged when you launch. No hold is placed until every readiness check passes.";
      break;
    case "free":
      headline = <span style={price}>Included</span>;
      note = "Your one lifetime free Production Pass covers this (up to 3 flows).";
      break;
    case "subscription":
      if (decision.ok) {
        headline = <span style={price}>Included</span>;
        note = `On your ${decision.plan.name} plan. ${decision.unitsAfter} flow ${decision.unitsAfter === 1 ? "unit" : "units"} left this month after this pass.`;
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
      note = "This pass runs on your current plan.";
      break;
  }

  return (
    <div style={box}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <span style={lab}>Pass preview</span>
        <span style={{ fontSize: 12.5, color: "var(--fg-3)" }}>{flowLabel}</span>
      </div>
      <div style={{ marginTop: 10 }}>{headline}</div>
      {note ? <p style={{ fontSize: 12.5, color: "var(--fg-3)", margin: "8px 0 0", lineHeight: 1.5 }}>{note}</p> : null}
    </div>
  );
}
