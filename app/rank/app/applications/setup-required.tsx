import Link from "next/link";

// Internal-only state shown when the Preflight migration is not applied yet. Never exposes SQL details to
// public users (the /applications routes are flag-gated). Points the operator at the activation runbook.
export function SetupRequired() {
  return (
    <div className="wrap" style={{ maxWidth: 720, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <p className="eyebrow">Vraelis Preflight</p>
      <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", margin: "6px 0 10px" }}>Preflight setup required</h1>
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12, padding: "clamp(18px, 2.6vw, 26px)" }}>
        <p style={{ fontSize: 14, color: "var(--fg-2)", lineHeight: 1.6, margin: 0 }}>
          The Preflight database migration has not been applied. This surface is available to internal
          testers, but it needs its additive tables before applications can be connected.
        </p>
        <div style={{ fontFamily: "var(--font-code)", fontSize: 12.5, color: "var(--fg-3)", background: "var(--bg-2)", border: "1px solid var(--line-1)", borderRadius: "var(--r-sm)", padding: "12px 14px", lineHeight: 1.7 }}>
          1. Apply sql/vraelis-preflight.sql<br />
          2. Apply sql/vraelis-preflight-2-discovery.sql<br />
          3. npm run preflight:verify-db
        </div>
        <p style={{ fontSize: 12.5, color: "var(--fg-4)", margin: 0 }}>Full steps, including Browserbase + worker setup, are in the activation runbook.</p>
        <Link href="/app" className="btn btn--ghost" style={{ alignSelf: "flex-start" }}>Back to dashboard</Link>
      </div>
    </div>
  );
}
