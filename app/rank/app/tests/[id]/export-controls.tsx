"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function ExportControls({ testId }: { testId: string }) {
  const [copied, setCopied] = useState(false);
  const [scale, setScale] = useState(false); // Scale+/API access unlocks the data export
  useEffect(() => {
    fetch("/api/v/usage").then((r) => r.json()).then((j) => { if (j.signedIn) setScale(!!j.hasApiAccess); }).catch(() => {});
  }, []);

  const base = `/api/v/tests/${testId}/export`;
  function copy() {
    navigator.clipboard?.writeText(`https://vraelis.com${base}?format=json&tier=standard`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }).catch(() => {});
  }

  const Row = ({ name, plan, desc, children }: { name: string; plan?: string; desc: string; children: React.ReactNode }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "12px 0", borderTop: "1px solid var(--line-1)", flexWrap: "wrap" }}>
      <div style={{ minWidth: 0, flex: "1 1 280px" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg-1)" }}>{name}{plan ? <span className="pill" style={{ marginLeft: 8, fontSize: 10.5 }}>{plan}</span> : null}</div>
        <div style={{ fontSize: 12.5, color: "var(--fg-4)", marginTop: 2 }}>{desc}</div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{children}</div>
    </div>
  );

  return (
    <div className="card" style={{ marginBottom: 26 }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 6 }}>Export data</div>
      <p style={{ fontSize: 13.5, color: "var(--fg-3)", marginBottom: 4 }}>Download this report. Every JSON export includes a <strong style={{ color: "var(--fg-2)" }}>decision package</strong>, recommendation, confidence, signal quality, source quality, and audience fit where available. Exports never include account email, evaluator identities, raw IP or device data, billing internals, API keys, or share tokens.</p>

      <Row name="Summary" desc="Recommendation, counts, and a core decision package.">
        <a href={`${base}?format=json&tier=summary`} download className="btn btn--ghost" style={{ padding: "6px 12px", fontSize: 12.5 }}>Decision package JSON</a>
      </Row>
      <Row name="Standard report" desc="Full breakdown, comments, AI analysis, audience fit, response quality.">
        <a href={`${base}?format=json&tier=standard`} download className="btn btn--ghost" style={{ padding: "6px 12px", fontSize: 12.5 }}>Decision package JSON</a>
        <a href={`${base}?format=csv&tier=standard`} download className="btn btn--ghost" style={{ padding: "6px 12px", fontSize: 12.5 }}>CSV breakdown</a>
      </Row>
      <Row name="Scale data export" plan={scale ? undefined : "Scale"} desc="Full decision package, adds source quality, collection-link stats, and machine-readable schema_version.">
        {scale
          ? <a href={`${base}?format=json&tier=scale`} download className="btn btn--ghost" style={{ padding: "6px 12px", fontSize: 12.5 }}>Decision package JSON</a>
          : <Link href="/app/plans" className="btn btn--ghost" style={{ padding: "6px 12px", fontSize: 12.5 }}>See plans</Link>}
      </Row>
      <Row name="Enterprise dataset" plan="Enterprise" desc="Account-level and governed cohort exports, under data terms.">
        <Link href="/contact" className="btn btn--ghost" style={{ padding: "6px 12px", fontSize: 12.5 }}>Contact sales</Link>
      </Row>

      <div style={{ marginTop: 14 }}>
        <button onClick={copy} className="btn btn--ghost" style={{ fontSize: 12.5 }}>{copied ? "Endpoint copied ✓" : "Copy API endpoint"}</button>
      </div>
    </div>
  );
}
