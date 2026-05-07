import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { getSupabaseAdminClient, isDatabaseConfigured } from "@/lib/supabase-admin";
import { getSignInPath } from "@/lib/auth-ui";

// Admin-only waitlist + analytics dashboard. Shows recent waitlist
// signups grouped by product, top events, and recent CTA clicks.

const PRODUCTS = ["workshop", "whisper", "lens", "lens-day-kit", "platform"] as const;

const PRODUCT_COLOR: Record<string, string> = {
  workshop:        "#a8c4ff",
  whisper:         "#60a5fa",
  lens:            "#c084fc",
  "lens-day-kit":  "#c084fc",
  platform:        "#fbbf24",
};

type WaitlistRow = {
  email: string;
  product: string;
  source: string | null;
  user_email: string | null;
  created_at: string;
};

type EventRow = {
  name: string;
  path: string | null;
  props: Record<string, unknown> | null;
  created_at: string;
};

async function loadAdmin(): Promise<{
  byProduct: Record<string, WaitlistRow[]>;
  totalsByProduct: Record<string, number>;
  recentEvents: EventRow[];
  topEventNames: { name: string; count: number }[];
}> {
  if (!isDatabaseConfigured()) {
    return {
      byProduct: {},
      totalsByProduct: {},
      recentEvents: [],
      topEventNames: [],
    };
  }
  const sb = getSupabaseAdminClient();

  const [{ data: rows }, { data: events }] = await Promise.all([
    sb.from("waitlist")
      .select("email,product,source,user_email,created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    sb.from("analytics_events")
      .select("name,path,props,created_at")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const byProduct: Record<string, WaitlistRow[]> = {};
  const totalsByProduct: Record<string, number> = {};
  for (const p of PRODUCTS) { byProduct[p] = []; totalsByProduct[p] = 0; }
  for (const r of (rows ?? []) as WaitlistRow[]) {
    if (!byProduct[r.product]) byProduct[r.product] = [];
    byProduct[r.product].push(r);
    totalsByProduct[r.product] = (totalsByProduct[r.product] ?? 0) + 1;
  }

  const eventCounts: Record<string, number> = {};
  for (const e of (events ?? []) as EventRow[]) {
    eventCounts[e.name] = (eventCounts[e.name] ?? 0) + 1;
  }
  const topEventNames = Object.entries(eventCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([name, count]) => ({ name, count }));

  return { byProduct, totalsByProduct, recentEvents: (events ?? []) as EventRow[], topEventNames };
}

function fmtRelative(iso: string): string {
  const d = new Date(iso);
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60)    return `${sec}s ago`;
  if (sec < 3600)  return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

export default async function AdminWaitlistPage() {
  const session = await auth();
  const email = session?.user?.email ?? null;
  if (!email) redirect(`${getSignInPath()}?callbackUrl=/account/waitlist`);
  if (!isAdminEmail(email)) redirect("/account");

  const { byProduct, totalsByProduct, recentEvents, topEventNames } = await loadAdmin();

  return (
    <main style={{ background: "#050507", minHeight: "100vh", padding: "40px 24px 80px", color: "#e4e4e7" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(168,196,255,0.7)", marginBottom: 6, fontFamily: "var(--font-geist-mono), ui-monospace, monospace" }}>
            admin · waitlist + analytics
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 600, color: "#f5f5f7", letterSpacing: "-0.02em" }}>
            Waitlist & landing analytics
          </h1>
        </div>

        {/* Totals */}
        <section style={{ marginBottom: 40 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            {PRODUCTS.map((p) => (
              <div
                key={p}
                style={{
                  padding: "18px 18px",
                  borderRadius: 14,
                  border: `1px solid ${PRODUCT_COLOR[p]}26`,
                  background: `${PRODUCT_COLOR[p]}0a`,
                }}
              >
                <div style={{ fontSize: 11, letterSpacing: "0.16em", color: PRODUCT_COLOR[p], textTransform: "uppercase", fontFamily: "var(--font-geist-mono), ui-monospace, monospace", marginBottom: 8 }}>
                  {p}
                </div>
                <div style={{ fontSize: 30, fontWeight: 600, color: "#f5f5f7", letterSpacing: "-0.02em" }}>
                  {totalsByProduct[p] ?? 0}
                </div>
                <div style={{ fontSize: 11, color: "#71717a", marginTop: 2 }}>signups</div>
              </div>
            ))}
          </div>
        </section>

        {/* Top events */}
        <section style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase", color: "#a1a1aa", marginBottom: 12 }}>
            Top events (last 200)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
            {topEventNames.length === 0 && (
              <div style={{ fontSize: 13, color: "#52525b" }}>No events yet.</div>
            )}
            {topEventNames.map((e) => (
              <div
                key={e.name}
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.06)",
                  background: "rgba(255,255,255,0.02)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 12, color: "#cbd5e1", fontFamily: "var(--font-geist-mono), ui-monospace, monospace" }}>
                  {e.name}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#a8c4ff" }}>
                  {e.count}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Per-product waitlist */}
        {PRODUCTS.map((p) => {
          const rows = byProduct[p] ?? [];
          if (rows.length === 0) return null;
          return (
            <section key={p} style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: PRODUCT_COLOR[p], boxShadow: `0 0 10px ${PRODUCT_COLOR[p]}` }} />
                <div style={{ fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase", color: PRODUCT_COLOR[p], fontFamily: "var(--font-geist-mono), ui-monospace, monospace" }}>
                  {p} · {rows.length}
                </div>
              </div>
              <div
                style={{
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.06)",
                  background: "rgba(255,255,255,0.015)",
                  overflow: "hidden",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.02)", color: "#71717a" }}>
                      <th style={th}>email</th>
                      <th style={th}>source</th>
                      <th style={th}>signed-in?</th>
                      <th style={{ ...th, textAlign: "right" }}>when</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 30).map((r, i) => (
                      <tr key={`${r.email}-${i}`} style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={td}>{r.email}</td>
                        <td style={{ ...td, color: "#71717a" }}>{r.source ?? "—"}</td>
                        <td style={{ ...td, color: r.user_email ? "#22c55e" : "#71717a" }}>
                          {r.user_email ? "yes" : "no"}
                        </td>
                        <td style={{ ...td, textAlign: "right", color: "#71717a" }}>
                          {fmtRelative(r.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}

        {/* Recent events */}
        <section style={{ marginTop: 40 }}>
          <div style={{ fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase", color: "#a1a1aa", marginBottom: 12 }}>
            Recent events
          </div>
          <div
            style={{
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(255,255,255,0.015)",
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.02)", color: "#71717a" }}>
                  <th style={th}>name</th>
                  <th style={th}>path</th>
                  <th style={th}>props</th>
                  <th style={{ ...th, textAlign: "right" }}>when</th>
                </tr>
              </thead>
              <tbody>
                {recentEvents.length === 0 && (
                  <tr><td style={td} colSpan={4}>No events yet.</td></tr>
                )}
                {recentEvents.slice(0, 50).map((e, i) => (
                  <tr key={i} style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ ...td, color: "#a8c4ff", fontFamily: "var(--font-geist-mono), ui-monospace, monospace" }}>{e.name}</td>
                    <td style={{ ...td, color: "#cbd5e1" }}>{e.path ?? "—"}</td>
                    <td style={{ ...td, color: "#71717a", maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {e.props ? JSON.stringify(e.props) : "—"}
                    </td>
                    <td style={{ ...td, textAlign: "right", color: "#71717a" }}>
                      {fmtRelative(e.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div style={{ marginTop: 32, fontSize: 12, color: "#52525b" }}>
          <Link href="/account" style={{ color: "#71717a", textDecoration: "underline", textUnderlineOffset: 4 }}>
            ← back to account
          </Link>
        </div>
      </div>
    </main>
  );
}

const th: React.CSSProperties = {
  padding: "10px 14px",
  textAlign: "left",
  fontWeight: 500,
  fontSize: 11,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};
const td: React.CSSProperties = {
  padding: "10px 14px",
  color: "#cbd5e1",
};
