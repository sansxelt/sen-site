import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { dataInsights } from "@/lib/v-db";
import { balance } from "@/lib/v-credits";
import { getSupabaseAdminClient, isDatabaseConfigured } from "@/lib/supabase-admin";
import { recentEvents, eventCounts, lastEventAt, type EventRow } from "@/lib/v-events";

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

const EVENT_LABEL: Record<string, string> = {
  test_launched: "Test launched",
  test_completed: "Test completed",
  export_downloaded: "Export downloaded",
  public_report_enabled: "Public report enabled",
  public_report_disabled: "Public report disabled",
  api_request_made: "API request",
  webhook_delivered: "Webhook delivered",
  webhook_failed: "Webhook failed",
  checkout_started: "Checkout started",
};

function fmtDate(s: string): string {
  try { return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric" }); } catch { return ""; }
}
function eventDetail(e: EventRow): string {
  const m = e.metadata || {};
  if (e.event_type === "export_downloaded" && m.format) return String(m.format).toUpperCase();
  if (e.event_type === "test_completed" && m.winner) return `Winner ${m.winner}`;
  if (e.event_type === "test_launched" && m.category) return String(m.category).replace(/_/g, " ");
  if (e.event_type === "api_request_made" && m.endpoint) return String(m.endpoint);
  if (e.event_type === "webhook_failed" && m.status_code) return `HTTP ${m.status_code}`;
  return "";
}

export default async function DataPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/signin?callbackUrl=%2Fapp%2Fdata");

  const [ins, bal, used, events, counts, lastApi, lastHook] = await Promise.all([
    dataInsights(email),
    balance(email),
    creditsUsed(email),
    recentEvents(email, 10),
    eventCounts(email, ["export_downloaded", "api_request_made", "webhook_delivered", "webhook_failed"]),
    lastEventAt(email, "api_request_made"),
    lastEventAt(email, "webhook_delivered"),
  ]);

  const head = { fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 } as const;
  const exportsCount = counts.export_downloaded ?? 0;
  const hasData = ins.totals.tests > 0;
  const Perf = ({ l, v }: { l: string; v: string }) => (
    <div style={{ flex: "1 1 160px" }}>
      <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)" }}>{l}</div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, color: "var(--fg-1)", marginTop: 4 }}>{v}</div>
    </div>
  );

  return (
    <div className="wrap" style={{ maxWidth: 1000, paddingTop: "clamp(24px, 3vw, 38px)", paddingBottom: 80 }}>
      <div className="phead">
        <div>
          <p className="eyebrow">Data</p>
          <h1 className="display">Your data</h1>
          <p>How your tests are performing, what you collected, and your API and export activity.</p>
        </div>
      </div>

      {/* credit usage */}
      <div className="card" style={{ marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: "clamp(28px, 5vw, 56px)", flexWrap: "wrap" }}>
          <div>
            <div style={head}>Credits remaining</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600, color: "var(--fg-1)" }}>{bal.toLocaleString()}</div>
          </div>
          <div>
            <div style={head}>Credits used</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600, color: "var(--fg-1)" }}>{used.toLocaleString()}</div>
          </div>
        </div>
        <a href="/app/credits" className="btn btn--ghost">Top up →</a>
      </div>

      {/* summary cards */}
      <div className="tile-grid cols-4" style={{ marginBottom: 18 }}>
        <div className="stat"><div className="stat__l">Total tests</div><div className="stat__v tnum">{ins.totals.tests.toLocaleString()}</div><div className="stat__s">{ins.totals.completed} completed, {ins.totals.active} active</div></div>
        <div className="stat"><div className="stat__l">Valid judgments</div><div className="stat__v tnum">{ins.totals.valid.toLocaleString()}</div><div className="stat__s">real human votes</div></div>
        <div className="stat"><div className="stat__l">Filtered votes</div><div className="stat__v tnum">{ins.totals.filtered.toLocaleString()}</div><div className="stat__s">rejected by quality gate</div></div>
        <div className="stat"><div className="stat__l">Public reports</div><div className="stat__v tnum">{ins.totals.publicShared.toLocaleString()}</div><div className="stat__s">{exportsCount.toLocaleString()} export{exportsCount === 1 ? "" : "s"} downloaded</div></div>
      </div>

      {/* test performance */}
      <div className="card" style={{ marginBottom: 22 }}>
        <div style={head}>Test performance</div>
        {hasData ? (
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <Perf l="Completion rate" v={`${ins.performance.completionRate}%`} />
            <Perf l="Avg valid votes / test" v={ins.performance.avgValidPerCompleted.toLocaleString()} />
            <Perf l="Filtered rate" v={`${ins.performance.filteredRate}%`} />
            <Perf l="Avg win margin" v={ins.performance.avgWinMargin == null ? "—" : `${ins.performance.avgWinMargin} pts`} />
          </div>
        ) : <p style={{ fontSize: 13.5, color: "var(--fg-4)", margin: 0 }}>Run your first test to see performance here.</p>}
      </div>

      {/* recent activity + top categories */}
      <div className="tile-grid cols-2" style={{ marginBottom: 22 }}>
        <div className="card">
          <div style={head}>Recent activity</div>
          {events.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {events.map((e, i) => (
                <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 0", borderTop: i === 0 ? "none" : "1px solid var(--line-1)" }}>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontSize: 13.5, color: "var(--fg-1)", fontWeight: 500 }}>{EVENT_LABEL[e.event_type] ?? e.event_type}</span>
                    {eventDetail(e) ? <span style={{ fontSize: 12, color: "var(--fg-4)", marginLeft: 8 }}>{eventDetail(e)}</span> : null}
                  </div>
                  <span style={{ fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-4)", flex: "none" }}>{fmtDate(e.created_at)}</span>
                </div>
              ))}
            </div>
          ) : ins.recent.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {ins.recent.map((t, i) => (
                <a key={t.id} href={`/app/tests/${t.id}/report`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, textDecoration: "none", padding: "10px 0", borderTop: i === 0 ? "none" : "1px solid var(--line-1)" }}>
                  <span style={{ fontSize: 13.5, color: "var(--fg-1)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                  <span className="badge-now" style={{ flex: "none" }}>{t.winner ?? "Tie"}</span>
                </a>
              ))}
              <p style={{ fontSize: 12, color: "var(--fg-5)", marginTop: 10, marginBottom: 0 }}>A live activity feed appears here as you launch tests, collect votes, and export.</p>
            </div>
          ) : <p style={{ fontSize: 13.5, color: "var(--fg-4)", margin: 0 }}>Your launches, completions, exports, and API activity will appear here.</p>}
        </div>

        <div className="card">
          <div style={head}>Most-tested categories</div>
          {ins.byCategory.length === 0 ? <p style={{ fontSize: 13.5, color: "var(--fg-4)", margin: 0 }}>No completed tests yet.</p> : (
            <div className="chips">
              {ins.byCategory.map((c) => <span key={c.category} className="chip">{c.category.replace(/_/g, " ")} {c.count}</span>)}
            </div>
          )}
        </div>
      </div>

      {/* API & webhook usage */}
      {(ins.hasApi || ins.hasWebhooks) && (
        <div className="card" style={{ marginBottom: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
            <div style={head}>API &amp; webhook usage</div>
            <a href="/app/api-keys" style={{ fontSize: 12.5, color: "var(--acc-deep)", textDecoration: "none", fontWeight: 500 }}>Full API analytics →</a>
          </div>
          {(counts.api_request_made || counts.webhook_delivered || counts.webhook_failed) ? (
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <Perf l="API requests" v={(counts.api_request_made ?? 0).toLocaleString()} />
              <Perf l="Webhooks delivered" v={(counts.webhook_delivered ?? 0).toLocaleString()} />
              <Perf l="Webhook failures" v={(counts.webhook_failed ?? 0).toLocaleString()} />
              <div style={{ flex: "1 1 200px" }}>
                <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)" }}>Last activity</div>
                <div style={{ fontSize: 13, color: "var(--fg-2)", marginTop: 6, lineHeight: 1.6 }}>
                  API: {lastApi ? fmtDate(lastApi) : "—"}<br />Webhook: {lastHook ? fmtDate(lastHook) : "—"}
                </div>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 13.5, color: "var(--fg-4)", margin: 0 }}>API requests and webhook deliveries will show here once your integration starts sending traffic. See the <a href="/developers" style={{ color: "var(--acc-deep)" }}>developer docs</a>.</p>
          )}
        </div>
      )}

      {/* export */}
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
