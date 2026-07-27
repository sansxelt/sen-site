"use client";

// The approval act. Deliberately the only interactive element on the review page.
//
// It reaches the same POST /v1/verifications/plans/{id}/approve that an agent or a CI job would call, so
// there is exactly ONE approval path and one place the approver identity is recorded. A second, browser-only
// route would be a second set of rules to keep in step, and approval is the boundary least able to afford
// drift.
//
// THROUGH lib/verification-client, NOT fetch(). The repo's rule is that no authenticated page calls /v1
// directly, and it is enforced by scripts/verification-client-verify.ts, which caught this file. The reason
// is worth restating: the client owns error shaping, the refusal codes and the response contract, and a page
// that hand-rolls its own fetch is a second place those can drift.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { approveReviewedPlan } from "@/lib/verification-client";

export function ApprovePlan({ planId }: { planId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function approve() {
    setBusy(true); setErr(null);
    const r = await approveReviewedPlan(planId);
    if (!r.ok) {
      // The client's shaped message, which already explains expiry, consumption and scope in plain language.
      setErr(r.error.message || "That plan could not be approved.");
      setBusy(false);
      return;
    }
    router.refresh();
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
      <button onClick={approve} disabled={busy} className="btn" style={{ opacity: busy ? 0.6 : 1 }}>
        {busy ? "Approving…" : "Approve this plan"}
      </button>
      <span style={{ fontSize: 12.5, color: "var(--fg-4)", maxWidth: "44ch", lineHeight: 1.5 }}>
        Approving records you as the reviewer of this exact plan. It does not start a run and does not spend
        credits.
      </span>
      {err && <p role="alert" style={{ width: "100%", margin: 0, fontSize: 13, color: "var(--stop-ink)" }}>{err}</p>}
    </div>
  );
}
