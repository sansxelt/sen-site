"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// The calibration surface on a check report (owner only). Three jobs:
//   1. show the rolling "AI matches human judgment X%" stat, but only once it's real;
//   2. let the owner route this check's output through real people to validate it;
//   3. once that validation completes, show whether real people agreed with the check.
// The validation is a normal human evaluation and costs the usual human-eval credits.

export type PanelCalibration = {
  status: string;                 // launching | pending | resolved
  testId: string | null;
  aiWinner: string | null;
  humanWinner: string | null;
  agreement: boolean | null;
  humanValid: number | null;
} | null;

export type PanelSummary = { display: boolean; ratePct: number | null; n: number; lo: number | null; hi: number | null };

const box = { border: "1px solid var(--line-1)", borderRadius: "var(--r-lg)", background: "var(--bg-1)", padding: "clamp(16px, 2.4vw, 22px)" } as const;
const kicker = { fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)" } as const;

function Stat({ s }: { s: PanelSummary }) {
  if (!s.display || s.ratePct == null) return null;
  return (
    <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: "var(--r-sm)", background: "var(--acc-soft)", border: "1px solid var(--acc-line)" }}>
      <div style={{ fontSize: 13, color: "var(--fg-1)", lineHeight: 1.5 }}>
        <strong>{s.ratePct}%</strong> of the time, this AI check&apos;s pick has matched the human pick.
        <span style={{ color: "var(--fg-4)" }}> Across {s.n} human validations{s.lo != null && s.hi != null ? ` (95% range: ${s.lo}% to ${s.hi}%)` : ""}.</span>
      </div>
    </div>
  );
}

export function CalibrationPanel({ checkId, calibration, canValidate, tooManyVersions = false, maxOptions = 0, summary }: { checkId: string; calibration: PanelCalibration; canValidate: boolean; tooManyVersions?: boolean; maxOptions?: number; summary: PanelSummary }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [startedTestId, setStartedTestId] = useState<string | null>(null);

  // Nothing worth showing: no stat yet, single-candidate check, and no validation run.
  if (!summary.display && !calibration && !canValidate && !tooManyVersions) return null;

  const pendingTestId = startedTestId || (calibration && calibration.status !== "resolved" ? calibration.testId : null);
  const resolved = calibration?.status === "resolved" ? calibration : null;

  async function validate() {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/v/checks/${checkId}/validate`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      if (res.status === 401) { router.push(`/signin?callbackUrl=%2Fapp%2Fchecks%2F${checkId}`); return; }
      if (res.status === 402) { setErr("You're out of credits. A human validation uses the usual human-eval credits."); setBusy(false); return; }
      if (res.status === 403) { setErr("This would exceed your plan's active-evaluation limit this month."); setBusy(false); return; }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        const msg = j?.error === "pii_detected"
          ? (j.message || "This output looks like it contains personal data. Remove or redact it before validating on real people.")
          : j?.error === "not_comparable" ? "Validation needs at least two versions and a clear pick."
          : j?.error === "too_many_versions" ? `Human validation shows every version to real people, and your plan supports up to ${j.max} at a time.`
          : "Could not start the validation. Try again.";
        setErr(msg); setBusy(false); return;
      }
      const j = await res.json();
      if (j?.testId) { setStartedTestId(j.testId); router.refresh(); }
      else { setErr("Could not start the validation. Try again."); setBusy(false); }
    } catch {
      setErr("Network error. Try again."); setBusy(false);
    }
  }

  return (
    <div style={{ ...box, marginBottom: 18 }}>
      <div style={{ ...kicker, marginBottom: 10 }}>Calibrate on real people</div>
      <Stat s={summary} />

      {resolved ? (
        <div>
          {resolved.agreement === true ? (
            <div style={{ fontSize: 13.5, color: "var(--fg-1)", lineHeight: 1.55 }}>
              <strong style={{ color: "var(--acc-deep)" }}>Real people agreed.</strong> They picked Version {resolved.humanWinner} too{resolved.humanValid ? `, across ${resolved.humanValid} qualified judgments` : ""}.
            </div>
          ) : resolved.agreement === false ? (
            <div style={{ fontSize: 13.5, color: "var(--fg-1)", lineHeight: 1.55 }}>
              <strong style={{ color: "var(--err)" }}>Real people disagreed.</strong> They preferred Version {resolved.humanWinner}, not the check&apos;s pick ({resolved.aiWinner}){resolved.humanValid ? `, across ${resolved.humanValid} qualified judgments` : ""}. Worth a second look.
            </div>
          ) : (
            <div style={{ fontSize: 13.5, color: "var(--fg-2)", lineHeight: 1.55 }}>Real people were split with no clear winner{resolved.humanValid ? `, across ${resolved.humanValid} qualified judgments` : ""}. Not counted for or against the check.</div>
          )}
          {resolved.testId ? <a href={`/app/tests/${resolved.testId}/report`} style={{ display: "inline-block", marginTop: 8, fontSize: 13, color: "var(--acc-deep)", textDecoration: "none" }}>See the human validation report →</a> : null}
        </div>
      ) : pendingTestId ? (
        <div>
          <div style={{ fontSize: 13.5, color: "var(--fg-2)", lineHeight: 1.55 }}>Real people are evaluating this output now. The result lands here when enough qualified judgments are in.</div>
          <a href={`/app/tests/${pendingTestId}/report`} style={{ display: "inline-block", marginTop: 8, fontSize: 13, color: "var(--acc-deep)", textDecoration: "none" }}>Track the validation →</a>
        </div>
      ) : canValidate ? (
        <div>
          <div style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.55, marginBottom: 12 }}>Not sure about the pick? Put the same versions in front of real people. They judge which one to ship, and we record whether they agree with the check.</div>
          {err ? <p style={{ fontSize: 13, color: "var(--err)", marginBottom: 10 }}>{err}</p> : null}
          <button type="button" className="btn" onClick={validate} disabled={busy} style={{ opacity: busy ? 0.6 : 1 }}>
            {busy ? "Starting…" : "Validate on real people"}
          </button>
          <span style={{ fontSize: 12, color: "var(--fg-4)", marginLeft: 12 }}>Uses the usual human-eval credits</span>
        </div>
      ) : tooManyVersions ? (
        <div style={{ fontSize: 13, color: "var(--fg-3)", lineHeight: 1.55 }}>Human validation shows every version to real people, and your plan supports up to {maxOptions} at a time. This check has more, so validate a check with {maxOptions} or fewer versions, or upgrade your plan.</div>
      ) : null}
    </div>
  );
}
