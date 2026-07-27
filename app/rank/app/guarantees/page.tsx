// /guarantees — every standing promise this company has made, across every system.
//
// The console could already show a system's guarantees, on that system's page. It could not answer the
// question a founder or an auditor actually asks, which is "what have we promised". That question is the
// product, so it now has an address.
//
// WHAT THIS PAGE CLAIMS, AND WHEN IT EARNED THE RIGHT TO.
//
// It used to show only the PLAN's state, and the note here explained why: createRun accepted guaranteeId
// and not one caller passed it, so v_preflight_runs.guarantee_id was never written, latestGuaranteeRun
// could only ever return null, and guaranteeStatus could only ever answer draft or unproven. Rendering a
// pill whose vocabulary includes Verified would have been a surface that looks live and is not.
//
// That was true and is no longer. The verify entrance writes guarantee_id on every run it launches, and the
// first guarantee now carries fourteen of them with a standing Verified. So the verdict is shown, from the
// same guaranteeStatus every other guarantee surface uses.
//
// The plan's state is still shown beside it, because they answer different questions: an approved plan with
// no proof and a guarantee proven against the current deployment are not the same thing, and collapsing
// them into one pill would lose the distinction this product exists to keep.
//
// What is still NOT claimed: continuous coverage. A guarantee reports its LATEST verification, nothing is
// re-checked automatically when a deployment changes, and the page says so in words.
import type { Metadata } from "next";
import Link from "next/link";
import { requirePreflightOwner } from "@/lib/v-preflight-guard";
import { preflightDbReady } from "@/lib/preflight/db-ready";
import { listApplicationsForMember, type Application } from "@/lib/v-applications";
import { listGuaranteesForApps, latestGuaranteeRun, type Guarantee } from "@/lib/preflight/guarantees-db";
import { guaranteeStatus, GUARANTEE_STATUS_LABEL, GUARANTEE_COVERAGE_NOTE } from "@/lib/preflight/guarantee-status";
import { timeAgo } from "@/lib/preflight/home-verdict";
import { Ic, I } from "@/app/rank/_components/icons";
import { SetupRequired } from "../systems/setup-required";

export const metadata: Metadata = { title: "Guarantees" };
export const dynamic = "force-dynamic";

// The PLAN's state: has a person approved what must stay true, and is the approved version still current.
// Deliberately separate from the verdict beside it, which answers whether the deployment currently keeps it.
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

  // THE VERDICT, WHICH THIS PAGE USED TO SAY IT COULD NOT SHOW.
  //
  // The note above was written when createRun accepted guaranteeId and no caller passed it, so every
  // guarantee could only ever read "unproven" and a status pill here would have been a surface pretending
  // to be live. That stopped being true when the verify entrance shipped: guarantee_id is written on every
  // run it launches, and the demo guarantee now carries fourteen of them.
  //
  // So the page reports the verdict, from the same status function every other guarantee surface uses.
  // One query per row, which is honest at this scale and would need batching before it is not.
  const verdicts = await Promise.all(guarantees.map(async (g) => {
    const latest = await latestGuaranteeRun(g.user_id, g.id);
    return [g.id, guaranteeStatus(latest, g.plan_state)] as const;
  }));
  const verdictOf = new Map(verdicts);

  return (
    <div className="wrap" style={{ maxWidth: 1080, paddingTop: "clamp(20px, 2.6vw, 32px)", paddingBottom: 80 }}>
      <h1 className="display" style={{ fontSize: "clamp(1.55rem, 2.6vw, 2rem)", margin: "0 0 8px", letterSpacing: "-0.025em" }}>Guarantees</h1>
      <p style={{ margin: "0 0 6px", fontSize: 14, color: "var(--fg-3)", lineHeight: 1.6, maxWidth: "62ch" }}>
        A guarantee is an outcome one of your systems must keep true, written down with a proof plan that a
        person approved.
      </p>
      <p style={{ margin: "0 0 24px", fontSize: 13, color: "var(--fg-4)", lineHeight: 1.6, maxWidth: "62ch" }}>
        Approving a plan records what must stay true and who accepted it. Each guarantee shows its verdict from
        its most recent verification. Re-checking automatically as each new deployment appears is not wired
        up yet, so a guarantee is proven when you ask it to be. {GUARANTEE_COVERAGE_NOTE}
      </p>

      {guarantees.length > 0 ? (
        <div className="card" style={{ padding: 0, overflow: "hidden", background: "var(--bg-1)" }}>
          {guarantees.map((g, i) => {
            const p = planPill(g);
            return (
              <Link key={g.id} href={`/systems/${g.application_id}/guarantees/${g.id}`}
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
                {/* The verdict leads, because "is this still true" is the question. The plan's state stays
                    beside it: an approved plan with no proof and a proven guarantee are different things. */}
                <span style={{ display: "flex", gap: 6, alignItems: "center", flex: "none" }}>
                  {(() => {
                    const st = verdictOf.get(g.id) ?? "unproven";
                    const meta = GUARANTEE_STATUS_LABEL[st];
                    const tone = meta.tone === "verified" ? { color: "var(--go-ink)", bg: "var(--go-wash)", border: "var(--go-line)" }
                      : meta.tone === "failed" ? { color: "var(--stop-ink)", bg: "var(--stop-wash)", border: "var(--stop-line)" }
                      : meta.tone === "blocked" || meta.tone === "progress" ? { color: "var(--wait-ink)", bg: "var(--wait-wash)", border: "var(--wait-line)" }
                      : { color: "var(--fg-4)", bg: "var(--bg-2)", border: "var(--line-2)" };
                    return <span className="pill" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: tone.color, background: tone.bg, borderColor: tone.border }}>{meta.label}</span>;
                  })()}
                  <span className="pill" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: p.color, background: p.bg, borderColor: p.border }}>{p.label}</span>
                </span>
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
          <Link href={apps.length ? `/systems/${apps[0].id}` : "/systems"} className="btn btn--ghost">
            {apps.length ? "Open a system to define one" : "Connect a system first"}
          </Link>
        </section>
      )}
    </div>
  );
}
