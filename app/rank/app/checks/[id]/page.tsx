import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCheck } from "@/lib/v-checks";
import { getPlan } from "@/lib/v-db";
import { entitlements } from "@/lib/v-entitlements";
import { getCalibrationForCheck, resolveCalibrationForTest, calibrationSummary } from "@/lib/v-calibration";
import { CheckReport } from "./check-report";
import { CalibrationPanel } from "./calibration-panel";

export const metadata: Metadata = { title: "AI output check" };

// Owner-scoped AI Check report. getCheck is scoped to the signed-in user, so a check
// is only ever visible to the account that ran it.
export default async function CheckReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect(`/signin?callbackUrl=%2Fapp%2Fchecks%2F${id}`);

  const check = await getCheck(email, id);
  if (!check) {
    return (
      <div className="wrap" style={{ maxWidth: 720, paddingTop: 48, paddingBottom: 80 }}>
        <div className="empty">
          <div className="empty__icon">∅</div>
          <h3>Check not found</h3>
          <p>This check doesn&apos;t exist, or it belongs to another account.</p>
          <a href="/app/checks/new" className="btn">Run a new check</a>
        </div>
      </div>
    );
  }

  // Calibration (owner only): resolve a completed validation lazily, then build the panel.
  let cal = await getCalibrationForCheck(email, id);
  if (cal?.status === "pending" && cal.test_id) { await resolveCalibrationForTest(cal.test_id); cal = await getCalibrationForCheck(email, id); }
  const summary = await calibrationSummary();
  const nCands = check.result?.candidates?.length ?? 0;
  const comparable = nCands >= 2 && !!check.result?.recommendedLabel;
  // Only look up the plan when the validate button might show (no validation yet + comparable),
  // and gate on maxOptions so we never offer a validation the launch would silently truncate.
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

  return (
    <div className="wrap" style={{ maxWidth: 820, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <a href="/app/checks/new" style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13.5, color: "var(--fg-3)", textDecoration: "none", marginBottom: 18 }}>← New check</a>
      <CheckReport result={check.result} title={check.title} createdAt={check.created_at} calibrationSlot={calibrationSlot} />
    </div>
  );
}
