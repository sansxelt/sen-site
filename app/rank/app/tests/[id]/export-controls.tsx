"use client";

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
      <p style={{ fontSize: 13.5, color: "var(--fg-3)", marginBottom: 4 }}>Download this report. Exports never include account email, voter identities, raw IP or device data, billing internals, API keys, or share tokens.</p>

      <Row name="Summary" desc="Result, winner, and per-candidate judgment counts.">
        <a href={`${base}?format=json&tier=summary`} download className="btn btn--ghost" style={{ padding: "6px 12px", fontSize: 12.5 }}>JSON</a>
      </Row>
      <Row name="Standard report" desc="Full breakdown, comments, AI analysis, and response quality.">
        <a href={`${base}?format=json&tier=standard`} download className="btn btn--ghost" style={{ padding: "6px 12px", fontSize: 12.5 }}>JSON</a>
        <a href={`${base}?format=csv&tier=standard`} download className="btn btn--ghost" style={{ padding: "6px 12px", fontSize: 12.5 }}>CSV</a>
      </Row>
      <Row name="Scale data export" plan={scale ? undefined : "Scale"} desc="Standard plus quality detail, webhook + export counts, and a machine-readable schema_version.">
        {scale
          ? <a href={`${base}?format=json&tier=scale`} download className="btn btn--ghost" style={{ padding: "6px 12px", fontSize: 12.5 }}>JSON</a>
          : <a href="/app/plans" className="btn btn--ghost" style={{ padding: "6px 12px", fontSize: 12.5 }}>See plans</a>}
      </Row>
      <Row name="Enterprise dataset" plan="Enterprise" desc="Account-level and governed cohort exports, under data terms.">
        <a href="mailto:sales@vraelis.com?subject=Vraelis%20Enterprise%20data%20export" className="btn btn--ghost" style={{ padding: "6px 12px", fontSize: 12.5 }}>Contact sales</a>
      </Row>

      <div style={{ marginTop: 14 }}>
        <button onClick={copy} className="btn btn--ghost" style={{ fontSize: 12.5 }}>{copied ? "Endpoint copied ✓" : "Copy API endpoint"}</button>
      </div>
    </div>
  );
}
