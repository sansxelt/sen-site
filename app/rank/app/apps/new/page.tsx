import type { Metadata } from "next";
import Link from "next/link";
import { requirePreflightOwner } from "@/lib/v-preflight-guard";
import ConnectWorkspace from "./connect-form";

export const metadata: Metadata = { title: "Connect an app" };

// Production-context onboarding workspace for Vraelis Preflight. Gated so a guessed URL redirects out when
// the flag is off. The page records intent + context only — no discovery or browser execution runs here.
// Wide layout: the workspace inside renders grouped connection sections with a sticky summary rail.
export default async function ConnectAppPage() {
  await requirePreflightOwner("/app/apps/new");

  return (
    <div className="wrap" style={{ maxWidth: 1240, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <Link href="/app/apps" style={{ display: "flex", width: "fit-content", alignItems: "center", gap: 7, fontSize: 13.5, color: "var(--fg-3)", textDecoration: "none", marginBottom: 18 }}>← Your apps</Link>
      <ConnectWorkspace />
    </div>
  );
}
