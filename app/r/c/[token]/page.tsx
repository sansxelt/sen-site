import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { ogMeta } from "@/lib/og-meta";
import { getSharedCheck } from "@/lib/v-checks";
import { CheckReport } from "@/app/rank/app/checks/[id]/check-report";

// Never cache: sharing is revocable, so a turned-off link must stop resolving immediately
// rather than serve a stale render from the full-route cache.
export const dynamic = "force-dynamic";

// generateMetadata and the page body both need the check; cache() collapses them to a
// single DB read per request (force-dynamic means no route cache to absorb the second).
const loadShared = cache((token: string) => getSharedCheck(token));

// Public, read-only AI output check report, shared by its owner. Viewable WITHOUT an
// account, but ONLY when the owner has explicitly enabled sharing — getSharedCheck is
// gated on (unguessable token AND share_enabled AND status=complete) and returns no owner
// identity. Deliberately noindex: this is user content meant for direct sharing, not search.

const OUTPUT_LABELS: Record<string, string> = {
  support_reply: "Support reply", onboarding: "Onboarding", marketing_copy: "Marketing copy",
  agent_action: "Agent action", other: "Output",
};

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const check = await loadShared(token);
  if (!check) {
    return ogMeta({ title: "Shared AI output check", description: "This shared AI output check is no longer available.", path: `/r/c/${token}`, index: false });
  }
  const label = OUTPUT_LABELS[check.output_type] ?? "Output";
  const title = check.title || `${label} check`;
  const rec = check.result.recommendation
    || `An AI output check on a ${label.toLowerCase()}: per-criterion scores, the version to ship, and line-level flags with fixes.`;
  return ogMeta({ title: `${title} · checked by Vraelis`, description: rec.slice(0, 200), path: `/r/c/${token}`, index: false });
}

function TopBar({ pill }: { pill: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 22 }}>
      <Link href="/" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: "var(--fg-1)", textDecoration: "none", letterSpacing: "-0.01em" }}>Vraelis</Link>
      <span className="pill" style={{ fontSize: 10, color: "var(--fg-4)" }}>{pill}</span>
    </div>
  );
}

export default async function SharedCheck({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const check = await loadShared(token);

  if (!check) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg-2)" }}>
        <div className="wrap" style={{ maxWidth: 640, paddingTop: "clamp(28px, 4vw, 52px)", paddingBottom: 72 }}>
          <TopBar pill="Shared report" />
          <div className="empty">
            <div className="empty__icon">∅</div>
            <h3>This report isn&apos;t available</h3>
            <p>The link may have been turned off by its owner, or it never existed.</p>
            <Link href="/r/check" className="btn">See a sample check</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-2)" }}>
      <div className="wrap" style={{ maxWidth: 820, paddingTop: "clamp(28px, 4vw, 52px)", paddingBottom: 72 }}>
        <TopBar pill="Shared report · checked by Vraelis" />

        <CheckReport result={check.result} title={check.title} createdAt={check.created_at} />

        {/* CTA — the loop: a shared report sends its viewer to run their own. */}
        <div style={{ textAlign: "center", marginTop: 40, paddingTop: 28, borderTop: "1px solid var(--line-1)" }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18, color: "var(--fg-1)", marginBottom: 6 }}>Check your own AI output</div>
          <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.6, margin: "0 auto 16px", maxWidth: 440 }}>
            Vraelis scores any AI output on your criteria and quotes the exact lines to fix, in about 20 seconds. Your first check is free.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            <Link href="/app/checks/new" className="btn btn--lg">Run a free check <span aria-hidden>→</span></Link>
            <Link href="/r/check" className="btn btn--ghost btn--lg">See a sample</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
