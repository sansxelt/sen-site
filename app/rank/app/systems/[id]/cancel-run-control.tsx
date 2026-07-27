"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ic, I } from "@/app/rank/_components/icons";

// Owner/workspace-scoped cancel control for a LIVE run, rendered on the application-detail run-control surface
// (the read-only Verification result page never mutates, so it only links here). It POSTs the EXISTING
// owner-checked route /api/preflight/runs/[runId]/cancel, which sets cancel_requested_at on a non-terminal
// owned run; the worker observes the flag on its next ownership-checked heartbeat and aborts browser work in a
// safe state. The route is EDITOR+ and idempotent server-side; this control is only rendered for a genuinely
// active run to an editor+ member (caps.canLaunch), and the server re-checks both regardless.
//
// Safety contract (mirrors the founder's Increment 6 requirements):
//   - two-step explicit confirm: a first click only ARMS; only the second, distinct "Confirm cancel" mutates,
//     so the run can never be cancelled on navigation or a single stray click;
//   - a pending (busy) state disables both buttons so a duplicate request cannot be issued;
//   - success shows a truthful terminal "Cancellation requested" state AND refreshes the server data, so the
//     page reflects the real resulting state (cancelling/cancelled) rather than a fabricated one;
//   - failure is announced in an accessible live region; 401 routes to sign-in, 403 states the view-only cause;
//   - it is NOT a revival of the deleted result-page mutator: different surface, and the result page stays
//     read-only.
export function CancelRunControl({ appId, runId }: { appId: string; runId: string }) {
  const router = useRouter();
  const [asked, setAsked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function cancel() {
    if (busy || done) return; // pending / already-requested guard: never issue a duplicate request
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/preflight/runs/${encodeURIComponent(runId)}/cancel`, { method: "POST" });
      if (res.status === 401) {
        router.push(`/signin?callbackUrl=${encodeURIComponent(`/systems/${appId}`)}`);
        return;
      }
      if (res.ok) {
        // The request is recorded. Show the truthful in-flight state and refresh so the server view catches up
        // (the worker flips the run to cancelling/cancelled on its next heartbeat). done survives the refresh,
        // so the confirmation is not lost even if the run has not yet left its active state.
        setDone(true);
        setBusy(false);
        router.refresh();
        return;
      }
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      setErr(
        typeof j?.message === "string"
          ? j.message
          : res.status === 403
            ? "You have view-only access to this application."
            : "Could not cancel this run. Try again.",
      );
      setBusy(false);
    } catch {
      setErr("Network error. The run was not cancelled.");
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p role="status" aria-live="polite" style={{ fontSize: 12.5, color: "var(--fg-3)", margin: 0, lineHeight: 1.5 }}>
        Cancellation requested. This run will stop shortly.
      </p>
    );
  }

  if (!asked) {
    return (
      <button type="button" className="btn btn--ghost" onClick={() => setAsked(true)} style={{ gap: 8, color: "var(--fg-2)" }}>
        <Ic d={I.x} size={13} sw={2.2} /> Cancel run
      </button>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn"
          onClick={cancel}
          disabled={busy}
          style={{ background: "var(--err)", borderColor: "var(--err)", opacity: busy ? 0.6 : 1, gap: 8 }}
        >
          {busy ? "Cancelling…" : "Confirm cancel"}
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => setAsked(false)} disabled={busy}>
          Keep running
        </button>
      </div>
      {err ? (
        <p role="status" aria-live="polite" style={{ fontSize: 12.5, color: "var(--err)", margin: 0, maxWidth: 360, lineHeight: 1.5 }}>
          {err}
        </p>
      ) : null}
    </div>
  );
}
