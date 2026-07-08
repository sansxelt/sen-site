import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listChecks, reconcileStuckChecks, type VCheckSummary } from "@/lib/v-checks";
import { AutoRefresh } from "./auto-refresh";

export const metadata: Metadata = { title: "AI output checks" };

const OUTPUT_LABELS: Record<string, string> = {
  support_reply: "Support reply", onboarding: "Onboarding", marketing_copy: "Marketing copy",
  agent_action: "Agent action", other: "Output",
};

// running | complete | failed → colour + label.
function statusStyle(status: string): { label: string; color: string; bg: string; border: string } {
  if (status === "complete") return { label: "Complete", color: "var(--acc-deep)", bg: "var(--acc-soft)", border: "var(--acc-line)" };
  if (status === "failed") return { label: "Failed", color: "var(--err)", bg: "rgba(194,84,12,0.08)", border: "rgba(194,84,12,0.28)" };
  return { label: "Running", color: "var(--money)", bg: "rgba(194,84,12,0.06)", border: "rgba(194,84,12,0.22)" };
}

function when(iso: string): string {
  // Stable UTC render (no hydration mismatch): "2026-07-02 14:31".
  try { return new Date(iso).toISOString().slice(0, 16).replace("T", " ") + " UTC"; } catch { return ""; }
}

function Row({ c }: { c: VCheckSummary }) {
  const st = statusStyle(c.status);
  const running = c.status === "running";
  return (
    <Link href={`/app/checks/${c.id}`} className="card" style={{ display: "flex", alignItems: "center", gap: 14, textDecoration: "none", color: "inherit", padding: "14px 16px" }}>
      <span aria-hidden style={{ width: 9, height: 9, borderRadius: "50%", background: st.color, flex: "none", ...(running ? { animation: "none" } : {}) }} className={running ? "pulse" : undefined} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14.5, color: "var(--fg-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {c.title || `${OUTPUT_LABELS[c.output_type] ?? "Output"} check`}
        </div>
        <div style={{ fontFamily: "var(--font-code)", fontSize: 11.5, color: "var(--fg-4)", marginTop: 2 }}>
          {OUTPUT_LABELS[c.output_type] ?? "Output"} | {when(c.created_at)}
          {running ? " | working on it" : ""}
        </div>
      </div>
      <span className="pill" style={{ fontSize: 10.5, color: st.color, background: st.bg, borderColor: st.border, flex: "none" }}>{st.label}</span>
      <span aria-hidden style={{ color: "var(--fg-4)", flex: "none" }}>→</span>
    </Link>
  );
}

// The activity/history list for AI output checks. Reconciles any stuck-running checks
// (their background eval was killed) to failed + refund on load, then lists newest first.
// While a check is running, AutoRefresh polls so the row flips to complete on its own.
export default async function ChecksListPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/signin?callbackUrl=%2Fapp%2Fchecks");

  await reconcileStuckChecks(email);
  const checks = await listChecks(email);
  const anyRunning = checks.some((c) => c.status === "running");

  return (
    <div className="wrap" style={{ maxWidth: 760, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 22 }}>
        <div>
          <p className="eyebrow">AI output checks</p>
          <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", margin: "6px 0 0" }}>Your checks</h1>
        </div>
        <Link href="/app/checks/new" className="btn">New check <span aria-hidden>→</span></Link>
      </div>

      {checks.length === 0 ? (
        <div className="empty">
          <div className="empty__icon">✓</div>
          <h3>No checks yet</h3>
          <p>Run your first AI output check to see it here.</p>
          <Link href="/app/checks/new" className="btn">Check your AI output</Link>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {checks.map((c) => <Row key={c.id} c={c} />)}
        </div>
      )}

      {anyRunning ? <AutoRefresh /> : null}
    </div>
  );
}
