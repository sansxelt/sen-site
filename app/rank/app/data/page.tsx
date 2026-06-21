import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ownerStats } from "@/lib/v-db";
import { balance } from "@/lib/v-credits";
import { getSupabaseAdminClient, isDatabaseConfigured } from "@/lib/supabase-admin";

export const metadata: Metadata = { title: "Data" };

// Credits consumed on tests = holds net of refunds (both are test-scoped).
async function creditsUsed(email: string): Promise<number> {
  if (!isDatabaseConfigured()) return 0;
  const { data } = await getSupabaseAdminClient().from("v_credit_ledger" as never)
    .select("delta,reason").eq("user_id", email.toLowerCase()).in("reason", ["hold", "refund"]);
  let used = 0;
  for (const r of (data as unknown as { delta: number }[]) ?? []) used -= r.delta;
  return Math.max(0, used);
}

export default async function DataPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/signin?callbackUrl=%2Fapp%2Fdata");
  const [stats, bal, used] = await Promise.all([ownerStats(email), balance(email), creditsUsed(email)]);
  const head = { fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 } as const;

  return (
    <div className="wrap" style={{ maxWidth: 1000, paddingTop: "clamp(24px, 3vw, 38px)", paddingBottom: 80 }}>
      <div className="phead">
        <div>
          <p className="eyebrow">Data</p>
          <h1 className="display">Your preference data</h1>
          <p>Real preference data from your tests. Export any completed result as JSON or CSV.</p>
        </div>
      </div>

      {/* credit usage */}
      <div className="card" style={{ marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: "clamp(28px, 5vw, 56px)", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)" }}>Credits remaining</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600, color: "var(--fg-1)", marginTop: 4 }}>{bal.toLocaleString()}</div>
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)" }}>Credits used</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600, color: "var(--fg-1)", marginTop: 4 }}>{used.toLocaleString()}</div>
          </div>
        </div>
        <a href="/app/credits" className="btn btn--ghost">Top up →</a>
      </div>

      <div className="tile-grid cols-4" style={{ marginBottom: 22 }}>
        <div className="stat"><div className="stat__l">Tests completed</div><div className="stat__v tnum">{stats.completed.toLocaleString()}</div></div>
        <div className="stat"><div className="stat__l">Valid judgments</div><div className="stat__v tnum">{stats.totalValid.toLocaleString()}</div><div className="stat__s">real human votes</div></div>
        <div className="stat"><div className="stat__l">Filtered votes</div><div className="stat__v tnum">{stats.totalFiltered.toLocaleString()}</div><div className="stat__s">rejected by quality gate</div></div>
        <div className="stat"><div className="stat__l">Active tests</div><div className="stat__v tnum">{stats.active.toLocaleString()}</div><div className="stat__s">collecting now</div></div>
      </div>

      <div className="tile-grid cols-2" style={{ marginBottom: 22 }}>
        <div className="card">
          <div style={head}>Most-tested categories</div>
          {stats.byCategory.length === 0 ? <p style={{ fontSize: 13.5, color: "var(--fg-4)" }}>No completed tests yet.</p> : (
            <div className="chips">
              {stats.byCategory.map((c) => <span key={c.category} className="chip">{c.category.replace(/_/g, " ")} {c.count}</span>)}
            </div>
          )}
        </div>
        <div className="card">
          <div style={head}>Recent winners</div>
          {stats.recent.length === 0 ? <p style={{ fontSize: 13.5, color: "var(--fg-4)" }}>Run a test to see results here.</p> : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {stats.recent.map((t, i) => (
                <a key={t.id} href={`/app/tests/${t.id}/report`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, textDecoration: "none", padding: "10px 0", borderTop: i === 0 ? "none" : "1px solid var(--line-1)" }}>
                  <span style={{ fontSize: 13.5, color: "var(--fg-1)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                  <span className="badge-now" style={{ flex: "none" }}>{t.winner ?? "Tie"}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card cta-band" style={{ background: "var(--bg-2)", borderRadius: "var(--r-xl)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 17, marginBottom: 4 }}>Export preference data</div>
          <p style={{ fontSize: 13.5, color: "var(--fg-3)", margin: 0 }}>Every completed report exports as JSON or CSV. Winner, vote breakdown, vote quality, comments, and AI analysis.</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a href="/app/api-keys" className="btn">API keys</a>
          <a href="/developers#export" className="btn btn--ghost">Export docs →</a>
        </div>
      </div>
    </div>
  );
}
