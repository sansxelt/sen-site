import Link from "next/link";
import { legacyCheckerEnabled } from "@/lib/v-preflight-flags";

// Gate for the LEGACY AI-output checker. The checker is no longer part of the primary Vraelis product
// (Vraelis is the production layer for AI-built software); it lives here, unlinked from normal navigation,
// and only while VRAELIS_LEGACY_CHECKER_ENABLED is on. When the flag is off, every legacy route renders a
// safe migration notice instead of the tool. Existing data stays intact either way.
export default function LegacyChecksLayout({ children }: { children: React.ReactNode }) {
  if (legacyCheckerEnabled()) return <>{children}</>;
  return (
    <div className="wrap" style={{ maxWidth: 620, paddingTop: "clamp(40px, 6vw, 80px)", paddingBottom: 80 }}>
      <div className="card" style={{ padding: "clamp(24px, 3.5vw, 38px)", textAlign: "center" }}>
        <p className="eyebrow" style={{ justifyContent: "center" }}>Retired feature</p>
        <h1 className="display" style={{ fontSize: "clamp(1.5rem, 3vw, 2.1rem)", margin: "8px 0 12px" }}>The AI output checker has been retired.</h1>
        <p style={{ fontSize: 14.5, color: "var(--fg-3)", lineHeight: 1.6, maxWidth: 460, margin: "0 auto 20px" }}>
          Vraelis now checks AI-built web applications. Connect your app and run a check to see which of your approved flows held, with real browser evidence. Your past check data has not been deleted; contact us if you need an export.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/applications/new" className="btn">Connect an app</Link>
          <Link href="/app" className="btn btn--ghost">Back to overview</Link>
        </div>
      </div>
    </div>
  );
}
