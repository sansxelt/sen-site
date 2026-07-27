"use client";

// Session-only guarantee-plan actions. The prepared plan itself is SERVER-rendered from the database (the
// detail page reads the live reviewed plan), so there is no client-held plan state to lose on refresh. These
// are just the buttons that mutate state and then refresh the server view:
//   DerivePlanButton   — first derivation (no plan yet). Reuse-first on the server; refreshes to the plan.
//   ApprovePlanButton  — approve the exact plan being shown (server verifies it is still the current one).
//   RegenerateButton   — explicit re-derivation (force), with confirmation when it replaces an approved plan.
// Every action is single-flight: an in-flight ref plus a disabled button, so rapid clicks cannot double-fire,
// and a refresh / remount never begins synthesis (nothing runs on mount).
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type NotProvable = { blocked_reason?: string | null; remaining_obligations?: string[]; repair_prompt?: string | null };

function useSingleFlight() {
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function run(fn: () => Promise<boolean>) {
    // returns true when the caller navigated/refreshed (leave the guard latched so a rapid re-click is a no-op)
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setErr(null);
    let latched = false;
    try { latched = await fn(); } catch { setErr("Network error. Try again."); }
    if (!latched) { inFlight.current = false; setBusy(false); }
  }
  return { busy, err, setErr, run };
}

export function DerivePlanButton({ appId, guaranteeId }: { appId: string; guaranteeId: string }) {
  const router = useRouter();
  const { busy, err, setErr, run } = useSingleFlight();
  const [np, setNp] = useState<NotProvable | null>(null);

  const derive = () => run(async () => {
    setNp(null);
    const res = await fetch(`/api/preflight/apps/${appId}/guarantees/${guaranteeId}/prepare`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    const j = await res.json().catch(() => ({} as Record<string, unknown>));
    if (!res.ok) { setErr((j as { message?: string })?.message || "Could not derive the proof plan."); return false; }
    if ((j as { ready?: boolean }).ready) { router.refresh(); return true; } // server now renders the plan
    setNp(j as NotProvable); return false; // not provable: keep the message on screen
  });

  if (np) return <NotProvableCard np={np} onRetry={derive} busy={busy} />;
  return (
    <div>
      <button className="btn" disabled={busy} onClick={derive}>{busy ? "Deriving proof plan…" : "Derive proof plan"}</button>
      {err ? <p style={{ fontSize: 12.5, color: "var(--err)", margin: "8px 0 0" }}>{err}</p> : null}
      <p style={{ fontSize: 12.5, color: "var(--fg-4)", lineHeight: 1.5, margin: "8px 0 0", maxWidth: 560 }}>
        Vraelis reads the deployment and works out the checks this guarantee implies. Nothing runs and nothing is charged until you approve and verify it.
      </p>
    </div>
  );
}

export function ApprovePlanButton({ appId, guaranteeId, reviewedPlanId }: { appId: string; guaranteeId: string; reviewedPlanId: string }) {
  const router = useRouter();
  const { busy, err, run } = useSingleFlight();
  const approve = () => run(async () => {
    const res = await fetch(`/api/preflight/apps/${appId}/guarantees/${guaranteeId}/approve`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reviewed_plan_id: reviewedPlanId }) });
    const j = await res.json().catch(() => ({} as Record<string, unknown>));
    if (!res.ok) { throw new Error((j as { message?: string })?.message || "Could not approve the plan."); }
    router.refresh(); return true;
  });
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <button className="btn" disabled={busy} onClick={approve}>{busy ? "Approving…" : "Approve this plan"}</button>
      <RegenerateButton appId={appId} guaranteeId={guaranteeId} approved={false} label="Derive again" />
      {err ? <p style={{ fontSize: 12.5, color: "var(--err)", margin: 0 }}>{err}</p> : null}
    </div>
  );
}

export function RegenerateButton({ appId, guaranteeId, approved, label = "Regenerate plan" }: { appId: string; guaranteeId: string; approved: boolean; label?: string }) {
  const router = useRouter();
  const { busy, err, run } = useSingleFlight();
  const regen = () => run(async () => {
    if (approved && !window.confirm("Regenerating replaces the approved plan. The guarantee moves to review until you approve the new plan. Continue?")) return false;
    const res = await fetch(`/api/preflight/apps/${appId}/guarantees/${guaranteeId}/prepare`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ force: true }) });
    const j = await res.json().catch(() => ({} as Record<string, unknown>));
    if (!res.ok) { throw new Error((j as { message?: string })?.message || "Could not regenerate the plan."); }
    router.refresh(); return true;
  });
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <button className="btn btn--ghost" disabled={busy} onClick={regen}>{busy ? "Regenerating…" : label}</button>
      {err ? <span style={{ fontSize: 12.5, color: "var(--err)" }}>{err}</span> : null}
    </span>
  );
}

/** Prove the guarantee against the deployment as it stands now.
 *
 *  The button sends almost nothing: the guarantee is in the URL and everything executable — the journeys,
 *  the approved plan, the meaning being proved — is resolved server-side from the approved record. It cannot
 *  ask for a different plan, and it is not able to name what counts as proof.
 *
 *  `parentRunId` is what makes this a REVERIFICATION rather than a fresh proof. It is passed only when the
 *  page is offering to re-check a specific earlier failure, and the server refuses it if it belongs to a
 *  different guarantee or was proved under a plan that has since been re-approved.
 *
 *  A fresh idempotency key per press is deliberate. The key is fingerprinted with {app, url, journeys}, so
 *  reusing one after a repair — same system, same URL, same journeys — would be indistinguishable from a
 *  double click and would hand back the ORIGINAL failed run instead of checking the fix. */
export function VerifyGuaranteeButton({
  appId, guaranteeId, parentRunId = null, label = "Verify this guarantee",
}: { appId: string; guaranteeId: string; parentRunId?: string | null; label?: string }) {
  const router = useRouter();
  const { busy, err, run } = useSingleFlight();
  const verify = () => run(async () => {
    const res = await fetch(`/api/preflight/apps/${appId}/guarantees/${guaranteeId}/verify`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify(parentRunId ? { parent_run_id: parentRunId } : {}),
    });
    const j = await res.json().catch(() => ({} as Record<string, unknown>));
    if (!res.ok) { throw new Error((j as { message?: string })?.message || "Could not start the verification."); }
    const runId = (j as { runId?: string }).runId;
    if (runId) { router.push(`/systems/${appId}/passes/${runId}`); return true; }
    router.refresh(); return true;
  });
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div>
        <button className="btn" disabled={busy} onClick={verify}>{busy ? "Starting verification…" : label}</button>
      </div>
      {err ? <p style={{ fontSize: 12.5, color: "var(--err)", margin: 0 }}>{err}</p> : null}
      <p style={{ fontSize: 12.5, color: "var(--fg-4)", lineHeight: 1.5, margin: 0, maxWidth: 560 }}>
        {parentRunId
          ? "Runs the same approved plan against the deployment as it stands now, and records the result as a re-check of that failure. The earlier result is kept."
          : "Runs the plan you approved against the current deployment. Nothing about the approved plan changes."}
      </p>
    </div>
  );
}

function NotProvableCard({ np, onRetry, busy }: { np: NotProvable; onRetry: () => void; busy: boolean }) {
  const label = { fontFamily: "var(--font-code)", fontSize: 10.5, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--wait-ink)", margin: 0 };
  return (
    <div style={{ border: "1px solid var(--wait-line)", background: "var(--wait-wash)", borderRadius: "var(--r-md, 10px)", padding: "clamp(16px, 2.2vw, 22px)", display: "grid", gap: 10 }}>
      <div style={label}>Not provable yet</div>
      <p style={{ fontSize: 13.5, color: "var(--fg-2)", lineHeight: 1.55, margin: 0 }}>
        Vraelis understood the claim but could not build a test that would prove it against the current deployment, so there is no plan to approve.
      </p>
      {np.remaining_obligations && np.remaining_obligations.length ? (
        <ul style={{ margin: 0, padding: "0 0 0 18px", display: "grid", gap: 4 }}>
          {np.remaining_obligations.map((o, i) => <li key={i} style={{ fontSize: 12.5, color: "var(--fg-2)", lineHeight: 1.5 }}>{o}</li>)}
        </ul>
      ) : null}
      {np.repair_prompt ? (
        <details>
          <summary style={{ cursor: "pointer", fontSize: 12.5, color: "var(--fg-4)" }}>What to change</summary>
          <p style={{ fontSize: 13, color: "var(--fg-2)", lineHeight: 1.55, margin: "8px 0 0", whiteSpace: "pre-wrap" }}>{np.repair_prompt}</p>
        </details>
      ) : null}
      <div><button className="btn btn--ghost" disabled={busy} onClick={onRetry}>{busy ? "Deriving…" : "Try again"}</button></div>
    </div>
  );
}
