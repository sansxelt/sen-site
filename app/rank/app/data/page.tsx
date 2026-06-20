import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ownerStats } from "@/lib/v-db";

export const metadata: Metadata = { title: "Data — Vraelis" };

export default async function DataPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/signin?callbackUrl=%2Fapp%2Fdata");
  const stats = await ownerStats(email);
  const head = { fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 } as const;

  return (
    <div className="wrap" style={{ maxWidth: 1000, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <p className="eyebrow">Data</p>
      <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.3rem)", marginBottom: 4 }}>Your preference data</h1>
      <p className="lead-copy" style={{ marginBottom: 24 }}>Real human preference signal across your tests — export any completed result as JSON or CSV.</p>

      <div className="metric-strip" style={{ border: "1px solid var(--line-2)", borderRadius: 14, overflow: "hidden", background: "var(--bg-1)", boxShadow: "var(--shadow-card)", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 24 }}>
        <div className="metric"><div className="metric__label">Tests completed</div><div className="metric__val tnum">{stats.completed.toLocaleString()}</div></div>
        <div className="metric"><div className="metric__label">Valid judgments</div><div className="metric__val tnum">{stats.totalValid.toLocaleString()}</div></div>
        <div className="metric"><div className="metric__label">Filtered votes</div><div className="metric__val tnum">{stats.totalFiltered.toLocaleString()}</div></div>
        <div className="metric"><div className="metric__label">Active tests</div><div className="metric__val tnum">{stats.active.toLocaleString()}</div></div>
      </div>

      <div className="cols-2" style={{ gap: 14, marginBottom: 24 }}>
        <div className="card">
          <div style={head}>Most-tested categories</div>
          {stats.byCategory.length === 0 ? <p style={{ fontSize: 13.5, color: "var(--fg-4)" }}>No completed tests yet.</p> : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {stats.byCategory.map((c) => <span key={c.category} className="pill" style={{ textTransform: "none", letterSpacing: 0 }}>{c.category.replace(/_/g, " ")} · {c.count}</span>)}
            </div>
          )}
        </div>
        <div className="card">
          <div style={head}>Recent winners</div>
          {stats.recent.length === 0 ? <p style={{ fontSize: 13.5, color: "var(--fg-4)" }}>Run a test to see results here.</p> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {stats.recent.map((t) => (
                <a key={t.id} href={`/app/tests/${t.id}/report`} style={{ display: "flex", justifyContent: "space-between", gap: 10, textDecoration: "none", padding: "6px 0", borderBottom: "1px solid var(--line-1)" }}>
                  <span style={{ fontSize: 13.5, color: "var(--fg-1)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--acc-deep)", whiteSpace: "nowrap" }}>{t.winner ?? "—"}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ background: "var(--bg-2)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Export preference data</div>
          <p style={{ fontSize: 13.5, color: "var(--fg-3)", margin: 0 }}>Every completed report exports as JSON or CSV — winner, vote breakdown, valid-vs-filtered quality, comments, and AI analysis. Pull it into dashboards, analytics, or training pipelines.</p>
        </div>
        <a href="/developers#export" className="btn">Export docs →</a>
      </div>
    </div>
  );
}
