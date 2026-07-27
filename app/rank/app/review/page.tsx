// /review — the plans waiting for a person.
//
// "A model may author a requirement. Only a person may review it." That sentence is the company's position,
// and until now the console had nowhere to stand behind it: a plan was minted, shown once inside the composer
// that created it, and if you navigated away it was reachable by no URL at all. The human decision the whole
// product turns on had no inbox.
//
// WHAT COUNTS AS WAITING. Pending approval, not yet consumed, and not past expiry — the same three conditions
// approveReviewedPlan enforces, applied in the query so this list can never offer an item that would be
// refused on arrival. A queue that shows work nobody can do is worse than an empty one.
//
// NO APPROVAL BUTTON HERE. Approving is a deliberate act performed against the artifact being approved, so it
// lives on the plan's own page, where the requirements and journeys are actually legible.
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { preflightDbReady } from "@/lib/preflight/db-ready";
import { listPendingReviews } from "@/lib/preflight/reviewed-plan-db";
import { timeAgo } from "@/lib/preflight/home-verdict";
import { DeploymentReference } from "../_components/home-records";
import { Ic, I } from "@/app/rank/_components/icons";

export const metadata: Metadata = { title: "Review" };
export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/signin?callbackUrl=%2Freview");

  const ready = await preflightDbReady();
  const pending = ready ? await listPendingReviews(email.toLowerCase()) : [];

  return (
    <div className="wrap" style={{ maxWidth: 1080, paddingTop: "clamp(20px, 2.6vw, 32px)", paddingBottom: 80 }}>
      <h1 className="display" style={{ fontSize: "clamp(1.55rem, 2.6vw, 2rem)", margin: "0 0 8px", letterSpacing: "-0.025em" }}>Review</h1>
      <p style={{ margin: "0 0 24px", fontSize: 14, color: "var(--fg-3)", lineHeight: 1.6, maxWidth: "62ch" }}>
        Vraelis derives the requirements and journeys it would run. A person approves them before anything
        runs or is charged. Reviewing is free.
      </p>

      {pending.length > 0 ? (
        <div className="card" style={{ padding: 0, overflow: "hidden", background: "var(--bg-1)" }}>
          {pending.map((p, i) => (
            <Link key={p.id} href={`/review/${p.id}`}
              style={{ display: "grid", gridTemplateColumns: "1fr auto auto", alignItems: "center", gap: 14, padding: "13px 16px", borderTop: i ? "1px solid var(--line-2)" : "none", color: "inherit", textDecoration: "none" }}
              aria-label={`Review plan: ${p.claim}`}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: "var(--fg-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.claim || "Untitled claim"}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 3, flexWrap: "wrap", alignItems: "center", fontSize: 12, color: "var(--fg-4)" }}>
                  <DeploymentReference url={p.deploymentUrl} />
                  <span>Created {timeAgo(p.createdAt)}</span>
                  <span>{p.requirements} requirement{p.requirements === 1 ? "" : "s"}</span>
                  <span>{p.flows} journey{p.flows === 1 ? "" : "s"}</span>
                </div>
              </div>
              <span className="pill" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--wait-ink)", background: "var(--wait-wash)", borderColor: "var(--wait-line)", flex: "none" }}>Awaiting review</span>
              <span aria-hidden style={{ color: "var(--fg-5)", flex: "none" }}>→</span>
            </Link>
          ))}
        </div>
      ) : (
        <section aria-label="Nothing awaiting review" style={{ border: "1px dashed var(--line-3)", borderRadius: "var(--r-lg, 14px)", background: "var(--bg-2)", padding: "clamp(20px, 2.6vw, 30px)" }}>
          <div style={{ color: "var(--fg-3)", marginBottom: 10 }}><Ic d={I.eye} size={22} /></div>
          <h2 style={{ fontSize: 16, margin: "0 0 6px", color: "var(--fg-1)" }}>Nothing is waiting on you</h2>
          <p style={{ margin: "0 0 16px", fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.6, maxWidth: "58ch" }}>
            When you name an outcome, Vraelis writes the requirements and browser journeys that would prove it
            and holds them here for your approval. Nothing runs, and nothing is charged, until you approve.
          </p>
          <Link href="/app" className="btn btn--ghost">Name an outcome to verify</Link>
        </section>
      )}
    </div>
  );
}
