import Link from "next/link";
import { Page, PageHeader } from "@/app/rank/_components/page-header";

// Internal-only state shown when the Preflight migration is not applied yet. Never exposes SQL details to
// public users (the /systems routes are flag-gated). Points the operator at the activation runbook.
//
// This renders in place of ELEVEN different pages, so it is the one surface where a stray measure was
// guaranteed to be noticed: /systems is a 1240 column and this stood in front of it at 720. It is the prose
// measure now, which is the right one for a paragraph and a runbook, and it stops being a third number.
export function SetupRequired() {
  return (
    <Page measure="prose">
      <PageHeader eyebrow="Vraelis Preflight" title="Preflight setup required" />
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12, padding: "clamp(18px, 2.6vw, 26px)", marginBottom: 80 }}>
        <p style={{ fontSize: 14, color: "var(--fg-2)", lineHeight: 1.6, margin: 0 }}>
          The Preflight database migration has not been applied. This surface is available to internal
          testers, but it needs its additive tables before systems can be connected.
        </p>
        <div style={{ fontFamily: "var(--font-code)", fontSize: 12.5, color: "var(--fg-3)", background: "var(--bg-2)", border: "1px solid var(--line-1)", borderRadius: "var(--r-sm)", padding: "12px 14px", lineHeight: 1.7 }}>
          1. Apply sql/vraelis-preflight.sql<br />
          2. Apply sql/vraelis-preflight-2-discovery.sql<br />
          3. npm run preflight:verify-db
        </div>
        <p style={{ fontSize: 12.5, color: "var(--fg-4)", margin: 0 }}>Full steps, including Browserbase + worker setup, are in the activation runbook.</p>
        <Link href="/app" className="btn btn--ghost" style={{ alignSelf: "flex-start" }}>Back to dashboard</Link>
      </div>
    </Page>
  );
}
