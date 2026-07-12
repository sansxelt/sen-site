import type { Metadata } from "next";
import Link from "next/link";
import { requirePreflightOwner } from "@/lib/v-preflight-guard";
import ConnectForm from "./connect-form";

export const metadata: Metadata = { title: "Connect an app" };

function BackLink() {
  return <Link href="/app/apps" style={{ display: "flex", width: "fit-content", alignItems: "center", gap: 7, fontSize: 13.5, color: "var(--fg-3)", textDecoration: "none", marginBottom: 18 }}>← Your apps</Link>;
}

// Connect-an-app page for Vraelis Preflight. Gated so a guessed URL redirects out when the flag is off.
// The page itself records intent only — no discovery or browser execution runs here (that is a later phase).
export default async function ConnectAppPage() {
  await requirePreflightOwner("/app/apps/new");

  return (
    <div className="wrap" style={{ maxWidth: 720, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <BackLink />
      <p className="eyebrow">Vraelis Preflight</p>
      <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", margin: "6px 0 10px" }}>Connect an app</h1>
      <p style={{ fontSize: 14.5, color: "var(--fg-3)", lineHeight: 1.6, margin: "0 0 26px", maxWidth: 560 }}>
        Point Vraelis at your deployed app and paste the prompt you built it with.
      </p>
      <ConnectForm />
    </div>
  );
}
