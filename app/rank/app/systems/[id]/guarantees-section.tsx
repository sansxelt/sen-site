// The Guarantees section on the Systems page: a live map of what this system depends on and whether each
// requirement is currently proven. Server component, owner-scoped, degrades to an empty state before migration
// 19. Each guarantee's status is DERIVED (guaranteeStatusFrom over the runs that proved its CURRENT
// meaning, plus plan_state), never
// stored. Sits above the Production Contract card, which becomes internal synthesis substrate.
import Link from "next/link";
import { listGuarantees, guaranteeRunHistory } from "@/lib/preflight/guarantees-db";
import { guaranteeStatusFrom, guaranteeFreshness } from "@/lib/preflight/guarantee-status";
import { latestRunByApp } from "@/lib/v-applications";
import { timeAgo } from "@/lib/preflight/home-verdict";
import { Ic, I } from "@/app/rank/_components/icons";
import { GuaranteeStatusPill } from "./guarantee-ui";
import { AddGuarantee } from "./add-guarantee";

// Matches the system page's section headings.
const headLbl = { fontSize: 15.5, fontWeight: 600, color: "var(--fg-1)" };
const sectionStyle = { borderTop: "1px solid var(--line-1)", paddingTop: 22, marginTop: 26 } as const;

function subtitle(planState: string): string {
  if (planState === "draft") return "Proof plan not approved yet";
  if (planState === "review_required") return "Definition changed since approval";
  return "Approved proof plan";
}

export async function GuaranteesSection({ owner, appId, canEdit }: { owner: string; appId: string; canEdit: boolean }) {
  const guarantees = await listGuarantees(owner, appId);
  // Derive each guarantee's live status from its latest tagged run + plan_state (parallel, owner-scoped). A
  // review_required guarantee never trusts a stale run, so we skip the run read for it.
  // The status comes from the runs that proved THIS guarantee's current meaning, not simply from the
  // newest one: approveGuaranteePlan overwrites approved_plan_hash in place, so after a re-approval the
  // newest run proved the previous wording. Same query count as before, reading the history rather than
  // one row.
  const systemLatest = guarantees.length ? (await latestRunByApp(owner, [appId]))[appId] : undefined;
  const withStatus = await Promise.all(guarantees.map(async (g) => {
    const history = g.plan_state === "review_required" ? [] : await guaranteeRunHistory(owner, g.id);
    return {
      g,
      status: guaranteeStatusFrom(history, g.plan_state, g.approved_plan_hash),
      fresh: guaranteeFreshness(history, g.approved_plan_hash, systemLatest),
    };
  }));

  return (
    <section style={sectionStyle} aria-label="Guarantees">
      <div style={{ ...headLbl, display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}><Ic d={I.shield} size={13} sw={2} />Guarantees</div>
      <p style={{ fontSize: 13, color: "var(--fg-3)", margin: "0 0 14px", lineHeight: 1.55, maxWidth: 640 }}>
        What this system depends on, and whether each requirement is currently proven, across separate deployments.
      </p>

      {withStatus.length ? (
        <div style={{ display: "grid", gap: 8, marginBottom: canEdit ? 12 : 0 }}>
          {withStatus.map(({ g, status, fresh }) => (
            <Link key={g.id} href={`/systems/${appId}/guarantees/${g.id}`}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", background: "var(--bg-1)", textDecoration: "none" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13.5, color: "var(--fg-1)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.title}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 10px", fontSize: 11.5, color: "var(--fg-4)", marginTop: 2 }}>
                  <span>{subtitle(g.plan_state)}</span>
                  {/* When the verdict was earned, and whether this system has been checked since (P1-8). */}
                  {fresh.at ? <span>Last checked {timeAgo(fresh.at)}</span> : null}
                  {fresh.olderThanSystem ? <span style={{ color: "var(--wait-ink)" }}>Older than this system&apos;s latest verification</span> : null}
                </div>
              </div>
              <GuaranteeStatusPill planState={g.plan_state} status={status} />
              <span aria-hidden style={{ color: "var(--fg-5)", flex: "none", fontSize: 13 }}>→</span>
            </Link>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: 13, color: "var(--fg-4)", margin: "0 0 12px" }}>
          {canEdit
            ? "No guarantees yet. Define what this system must always do, and Vraelis keeps proving it across deployments."
            : "No guarantees defined for this system yet."}
        </p>
      )}

      {canEdit ? <AddGuarantee appId={appId} /> : null}
    </section>
  );
}
