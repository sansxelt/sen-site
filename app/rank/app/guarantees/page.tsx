// /guarantees — every standing promise this company has made, across every system.
//
// The console could already show a system's guarantees, on that system's page. It could not answer the
// question a founder or an auditor actually asks, which is "what have we promised". That question is the
// product, so it now has an address.
//
// WHAT THIS PAGE DELIBERATELY DOES NOT CLAIM.
//
// A guarantee is meant to carry a live verdict: proven, or not, against the newest deployment. It cannot,
// and the reason is one missing argument. createRun() accepts guaranteeId and pins it onto the row
// (lib/preflight/runs-db.ts:263, 331) and NOT ONE CALLER PASSES IT — not the run route, not the rerun route,
// not either seeding script. So v_preflight_runs.guarantee_id is never written, latestGuaranteeRun() can
// only ever return null, and guaranteeStatus() can only ever answer draft / unproven.
//
// An earlier version of this page called latestGuaranteeRun per row and rendered the full status pill, whose
// vocabulary includes Verified and Failed. That is N queries that always return nothing, feeding a pill that
// can never show most of its own labels — a surface that looks live and is not. So the pill here reports the
// only axis that has real values, the PLAN's state, and the page says in words that re-checking is not
// wired yet. Overstating this would be the exact failure the engine is sold to catch.
import type { Metadata } from "next";
import Link from "next/link";
import { requirePreflightOwner } from "@/lib/v-preflight-guard";
import { preflightDbReady } from "@/lib/preflight/db-ready";
import { listApplicationsForMember, type Application } from "@/lib/v-applications";
import { listGuaranteesForApps, type Guarantee } from "@/lib/preflight/guarantees-db";
import { timeAgo } from "@/lib/preflight/home-verdict";
import { Ic, I } from "@/app/rank/_components/icons";
import { SetupRequired } from "../applications/setup-required";

export const metadata: Metadata = { title: "Guarantees" };
export const dynamic = "force-dynamic";

// The three states a guarantee can really be in. Not the run vocabulary: a guarantee has never been attached
// to a run, so Verified and Failed are not reachable and must not be implied by the presence of a pill that
// could show them.
function planPill(g: Guarantee): { label: string; color: string; bg: string; border: string } {
  if (g.plan_state === "review_required") return { label: "Plan review required", color: "var(--wait-ink)", bg: "var(--wait-wash)", border: "var(--wait-line)" };
  if (g.plan_state === "ok") return { label: `Plan approved v${g.plan_version}`, color: "var(--fg-2)", bg: "var(--bg-2)", border: "var(--line-2)" };
  return { label: "Draft", color: "var(--fg-4)", bg: "var(--bg-2)", border: "var(--line-2)" };
}

export default async function GuaranteesPage() {
  await requirePreflightOwner("/guarantees");
  if (!(await preflightDbReady())) return <SetupRequired />;

  const session = await import("@/auth").then((m) => m.auth());
  const email = session?.user?.email ?? "";

  // Member-scoped: the systems this person can see decide the guarantees this person can see.
  const apps: Application[] = await listApplicationsForMember(email);

  // GROUPED BY THE SYSTEM'S OWNER, not by the caller. listApplicationsForMember returns shared systems too,
  // and every guarantee read is scoped to user_id, so filtering the whole set by the caller's own id would
  // silently drop every guarantee on a teammate's system — present in the nav, invisible on the page.
  const byOwner = new Map<string, string[]>();
  for (const a of apps) {
    const list = byOwner.get(a.user_id) ?? [];
    list.push(a.id);
    byOwner.set(a.user_id, list);
  }
  const groups = await Promise.all(
    Array.from(byOwner.entries()).map(([ownerId, ids]) => listGuaranteesForApps(ownerId, ids)),
  );
  const guarantees = groups.flat().sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const appName = new Map(apps.map((a) => [a.id, a.name]));

  return (
    <div className="wrap" style={{ maxWidth: 1080, paddingTop: "clamp(20px, 2.6vw, 32px)", paddingBottom: 80 }}>
      <h1 className="display" style={{ fontSize: "clamp(1.55rem, 2.6vw, 2rem)", margin: "0 0 8px", letterSpacing: "-0.025em" }}>Guarantees</h1>
      <p style={{ margin: "0 0 6px", fontSize: 14, color: "var(--fg-3)", lineHeight: 1.6, maxWidth: "62ch" }}>
        A guarantee is an outcome one of your systems must keep true, written down with a proof plan that a
        person approved.
      </p>
      <p style={{ margin: "0 0 24px", fontSize: 13, color: "var(--fg-4)", lineHeight: 1.6, maxWidth: "62ch" }}>
        Approving a plan records what must stay true and who accepted it. Open a guarantee to prove it against
        the current deployment, and again after a repair. Re-checking automatically as each new deployment
        appears is not wired up yet, so a guarantee is proven when you ask it to be.
      </p>

      {guarantees.length > 0 ? (
        <div className="card" style={{ padding: 0, overflow: "hidden", background: "var(--bg-1)" }}>
          {guarantees.map((g, i) => {
            const p = planPill(g);
            return (
              <Link key={g.id} href={`/applications/${g.application_id}/guarantees/${g.id}`}
                style={{ display: "grid", gridTemplateColumns: "1fr auto auto", alignItems: "center", gap: 14, padding: "13px 16px", borderTop: i ? "1px solid var(--line-2)" : "none", color: "inherit", textDecoration: "none" }}
                aria-label={`${g.title}, ${appName.get(g.application_id) ?? "system"}, ${p.label}`}>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 500, color: "var(--fg-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.title}</span>
                  <span style={{ display: "flex", gap: 10, marginTop: 3, flexWrap: "wrap", fontSize: 12, color: "var(--fg-4)" }}>
                    <span>{appName.get(g.application_id) ?? "System"}</span>
                    {g.plan_approved_at
                      ? <span>Approved by {g.plan_approved_by || "a reviewer"} {timeAgo(g.plan_approved_at)}</span>
                      : <span>No approved plan yet</span>}
                  </span>
                </span>
                <span className="pill" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: p.color, background: p.bg, borderColor: p.border, flex: "none" }}>{p.label}</span>
                <span aria-hidden style={{ color: "var(--fg-5)", flex: "none" }}>→</span>
              </Link>
            );
          })}
        </div>
      ) : (
        <section aria-label="No guarantees yet" style={{ border: "1px dashed var(--line-3)", borderRadius: "var(--r-lg, 14px)", background: "var(--bg-2)", padding: "clamp(20px, 2.6vw, 30px)" }}>
          <div style={{ color: "var(--fg-3)", marginBottom: 10 }}><Ic d={I.shield} size={22} /></div>
          <h2 style={{ fontSize: 16, margin: "0 0 6px", color: "var(--fg-1)" }}>No guarantees defined yet</h2>
          <p style={{ margin: "0 0 16px", fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.6, maxWidth: "58ch" }}>
            A verification answers a question once. A guarantee writes the question down: open a system, name
            the outcome it must always keep true, and approve the proof plan Vraelis derives for it.
          </p>
          <Link href={apps.length ? `/applications/${apps[0].id}` : "/systems"} className="btn btn--ghost">
            {apps.length ? "Open a system to define one" : "Connect a system first"}
          </Link>
        </section>
      )}
    </div>
  );
}
