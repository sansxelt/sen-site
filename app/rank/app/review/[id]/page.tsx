// /review/{id} — the artifact under review, and the one place it can be approved.
//
// This is the page the product's central claim depends on. It shows the EXACT requirements and journeys that
// would run, the immutable plan hash they are bound to, and who approved them if anyone has. Everything is
// read from the stored plan; nothing is re-derived for display, because a review screen that renders a
// prettier version of the thing being approved is not a review screen.
//
// The requirements are shown as authored, and labelled as authored by Vraelis. That labelling is the whole
// point of the surface: a person is being asked to take responsibility for text a model wrote, and the
// interface must never blur which is which.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getReviewedPlanView, reviewedPlanExpired } from "@/lib/preflight/reviewed-plan-db";
import { timeAgo } from "@/lib/preflight/home-verdict";
import { DeploymentReference } from "../../_components/home-records";
import { ApprovePlan } from "./approve-plan";

export const metadata: Metadata = { title: "Review plan" };
export const dynamic = "force-dynamic";

const label = { fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--fg-4)" };

export default async function ReviewPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const email = session?.user?.email;
  const { id } = await params;
  if (!email) redirect(`/signin?callbackUrl=${encodeURIComponent(`/review/${id}`)}`);

  // Owner-scoped read: another tenant's plan is not "forbidden", it does not exist.
  const plan = await getReviewedPlanView(email.toLowerCase(), id);
  if (!plan) notFound();

  const approved = plan.approval_state === "approved";
  const expired = reviewedPlanExpired(plan.expires_at);
  const consumed = plan.execution_state === "consumed";
  const requirements = plan.plan?.requirements ?? [];
  const flows = plan.plan?.flows ?? [];

  // The single true sentence about this plan's standing, in the order that matters to a reviewer.
  const standing = consumed ? "This plan has already been used for a verification."
    : approved ? "Approved. It can now be used for a paid verification."
    : expired ? "This plan expired before it was approved. Name the outcome again to mint a fresh one."
    : "Awaiting your review.";

  return (
    <div className="wrap" style={{ maxWidth: 860, paddingTop: "clamp(20px, 2.6vw, 32px)", paddingBottom: 80 }}>
      <Link href="/review" style={{ fontSize: 13, color: "var(--fg-4)", textDecoration: "none" }}>← Review</Link>

      <h1 className="display" style={{ fontSize: "clamp(1.4rem, 2.4vw, 1.85rem)", margin: "12px 0 10px", letterSpacing: "-0.025em", lineHeight: 1.25 }}>{plan.claim || "Untitled claim"}</h1>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", fontSize: 12.5, color: "var(--fg-4)", marginBottom: 6 }}>
        <DeploymentReference url={plan.deployment_url} />
        <span>{requirements.length} requirement{requirements.length === 1 ? "" : "s"}</span>
        <span>{flows.length} journey{flows.length === 1 ? "" : "s"}</span>
        {!approved && !expired && !consumed ? <span>Expires {timeAgo(plan.expires_at)}</span> : null}
      </div>
      <p style={{ margin: "0 0 26px", fontSize: 13.5, color: approved ? "var(--go-ink)" : expired ? "var(--stop-ink)" : "var(--fg-2)" }}>
        {standing}
        {approved && plan.approved_by ? <span style={{ color: "var(--fg-4)" }}> Reviewed by {plan.approved_by}{plan.approved_at ? ` ${timeAgo(plan.approved_at)}` : ""}.</span> : null}
      </p>

      <section aria-label="Requirements" style={{ marginBottom: 28 }}>
        <h2 style={{ ...label, margin: "0 0 4px" }}>Requirements</h2>
        <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--fg-4)" }}>Written by Vraelis from your claim. You are approving these words.</p>
        {requirements.length ? (
          <ol style={{ margin: 0, padding: 0, listStyle: "none", border: "1px solid var(--line-2)", borderRadius: "var(--r-lg, 14px)", overflow: "hidden", background: "var(--bg-1)" }}>
            {requirements.map((r, i) => (
              <li key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 12, padding: "12px 16px", borderTop: i ? "1px solid var(--line-2)" : "none" }}>
                <span style={{ fontFamily: "var(--font-code)", fontSize: 12, color: "var(--fg-5)" }}>{i + 1}</span>
                <span style={{ fontSize: 13.5, color: "var(--fg-1)", lineHeight: 1.55 }}>{r.text}</span>
              </li>
            ))}
          </ol>
        ) : <p style={{ fontSize: 13.5, color: "var(--fg-4)", margin: 0 }}>This plan carries no requirements.</p>}
      </section>

      <section aria-label="Journeys" style={{ marginBottom: 30 }}>
        <h2 style={{ ...label, margin: "0 0 4px" }}>Browser journeys</h2>
        <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--fg-4)" }}>What a real browser will actually do against the deployment.</p>
        {flows.length ? (
          <div style={{ border: "1px solid var(--line-2)", borderRadius: "var(--r-lg, 14px)", overflow: "hidden", background: "var(--bg-1)" }}>
            {flows.map((f, i) => (
              <div key={i} style={{ padding: "12px 16px", borderTop: i ? "1px solid var(--line-2)" : "none" }}>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--fg-1)" }}>{f.name}</div>
                {f.goal ? <div style={{ fontSize: 12.5, color: "var(--fg-3)", marginTop: 2, lineHeight: 1.5 }}>{f.goal}</div> : null}
                <div style={{ fontSize: 12, color: "var(--fg-4)", marginTop: 3 }}>{(f.steps ?? []).length} step{(f.steps ?? []).length === 1 ? "" : "s"}</div>
              </div>
            ))}
          </div>
        ) : <p style={{ fontSize: 13.5, color: "var(--fg-4)", margin: 0 }}>This plan carries no journeys.</p>}
      </section>

      {!approved && !expired && !consumed ? <ApprovePlan planId={plan.id} /> : null}

      {/* The hash is what execution actually compares against, so it belongs on the page where approval
          happens. If the plan changed, this value changes, and it is a different plan needing a new approval. */}
      <p style={{ marginTop: 30, fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-5)", wordBreak: "break-all" }}>
        Plan hash {plan.plan_hash}
      </p>
    </div>
  );
}
