import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCheck, reconcileStuckChecks } from "@/lib/v-checks";
import { getPlan } from "@/lib/v-db";
import { entitlements } from "@/lib/v-entitlements";
import { getCalibrationForCheck, resolveCalibrationForTest, calibrationSummary } from "@/lib/v-calibration";
import { CheckReport } from "./check-report";
import { CalibrationPanel } from "./calibration-panel";
import { ShareToggle } from "./share-toggle";
import { AutoRefresh } from "../auto-refresh";

export const metadata: Metadata = { title: "AI output check" };

const OUTPUT_LABELS: Record<string, string> = {
  support_reply: "Support reply", onboarding: "Onboarding", marketing_copy: "Marketing copy",
  agent_action: "Agent action", other: "Output",
};

function BackLink() {
  return <Link href="/app/checks" style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13.5, color: "var(--fg-3)", textDecoration: "none", marginBottom: 18 }}>← Your checks</Link>;
}

// Owner-scoped AI Check report. getCheck is scoped to the signed-in user. A check runs
// asynchronously, so this page renders running / failed / complete states; while running,
// AutoRefresh polls until the background eval finalizes it.
export default async function CheckReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect(`/signin?callbackUrl=%2Fapp%2Fchecks%2F${id}`);

  await reconcileStuckChecks(email); // fail + refund this check if its background eval was killed
  const check = await getCheck(email, id);
  if (!check) {
    return (
      <div className="wrap" style={{ maxWidth: 720, paddingTop: 48, paddingBottom: 80 }}>
        <div className="empty">
          <div className="empty__icon">∅</div>
          <h3>Check not found</h3>
          <p>This check doesn&apos;t exist, or it belongs to another account.</p>
          <Link href="/app/checks/new" className="btn">Run a new check</Link>
        </div>
      </div>
    );
  }

  const heading = check.title || `${OUTPUT_LABELS[check.output_type] ?? "Output"} check`;

  // ── RUNNING: working state, poll until it finalizes ──
  if (check.status === "running") {
    return (
      <div className="wrap" style={{ maxWidth: 720, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
        <BackLink />
        <p className="eyebrow">AI output check</p>
        <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", margin: "6px 0 18px" }}>{heading}</h1>
        <div className="card" style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "clamp(18px, 2.6vw, 26px)" }}>
          <span className="pulse" aria-hidden style={{ width: 11, height: 11, borderRadius: "50%", background: "var(--money)", flex: "none", marginTop: 4 }} />
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16, color: "var(--fg-1)", marginBottom: 4 }}>Working on it.</div>
            <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.55, margin: 0 }}>A check usually takes about 10 to 30 seconds. You can leave this page and come back, it will be waiting in <Link href="/app/checks" style={{ color: "var(--acc-deep)", textDecoration: "none" }}>your checks</Link>.</p>
          </div>
        </div>
        <AutoRefresh />
      </div>
    );
  }

  // ── FAILED (or complete-without-result, defensively): not charged, offer a retry ──
  if (check.status === "failed" || !check.result) {
    return (
      <div className="wrap" style={{ maxWidth: 720, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
        <BackLink />
        <p className="eyebrow">AI output check</p>
        <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)", margin: "6px 0 18px" }}>{heading}</h1>
        <div className="card" style={{ padding: "clamp(18px, 2.6vw, 26px)" }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16, color: "var(--fg-1)", marginBottom: 4 }}>This check didn&apos;t complete.</div>
          <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.55, margin: "0 0 16px" }}>The evaluator was busy or timed out, and <strong style={{ color: "var(--fg-1)" }}>you were not charged</strong>. Try running it again.</p>
          <Link href="/app/checks/new" className="btn">Run a new check</Link>
        </div>
      </div>
    );
  }

  // ── COMPLETE: the full report + calibration ──
  // Calibration (owner only): resolve a completed validation lazily, then build the panel.
  let cal = await getCalibrationForCheck(email, id);
  if (cal?.status === "pending" && cal.test_id) { await resolveCalibrationForTest(cal.test_id); cal = await getCalibrationForCheck(email, id); }
  const summary = await calibrationSummary();
  const nCands = check.result.candidates?.length ?? 0;
  const comparable = nCands >= 2 && !!check.result.recommendedLabel;
  let canValidate = false, tooManyVersions = false, maxOptions = 0;
  if (!cal && comparable) {
    maxOptions = entitlements(await getPlan(email)).maxOptions;
    canValidate = nCands <= maxOptions;
    tooManyVersions = nCands > maxOptions;
  }
  const panelCal = cal ? { status: cal.status, testId: cal.test_id, aiWinner: cal.ai_winner_label, humanWinner: cal.human_winner_label, agreement: cal.agreement, humanValid: cal.human_valid_judgments } : null;
  const calibrationSlot = (
    <CalibrationPanel
      checkId={id}
      calibration={panelCal}
      canValidate={canValidate}
      tooManyVersions={tooManyVersions}
      maxOptions={maxOptions}
      summary={{ display: summary.display, ratePct: summary.ratePct, n: summary.n, lo: summary.lo, hi: summary.hi }}
    />
  );

  const shareUrl = check.share_enabled && check.share_token ? `https://vraelis.com/r/c/${check.share_token}` : null;

  return (
    <div className="wrap" style={{ maxWidth: 820, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <BackLink />
      <CheckReport result={check.result} title={check.title} createdAt={check.created_at} calibrationSlot={calibrationSlot} />
      <div style={{ marginTop: 24 }}>
        <ShareToggle checkId={id} initialEnabled={!!check.share_enabled} initialUrl={shareUrl} />
      </div>
    </div>
  );
}
