// /developers/keys/<id> — one key, opened.
//
// The key list carried an expander with four figures in it. That answered "what has this cost me" and
// nothing else, and it is not what someone opens a key for when something looks wrong. The questions then
// are sharper: is it spending more per run than it used to, is it failing more than it passes, how long do
// its verifications take, when does it actually get used, and what exactly did it launch. A key is the
// thing a customer points their CI at, so it gets an address.
//
// SERVER-RENDERED, not a client fetch. The list page is a client component and its expander pulled usage
// over /api/v/keys/[id]/usage; that made sense inline. A page has no reason to paint an empty shell and
// then fill it, and the guard is simpler when the data never leaves the server without an owner check.
//
// EVERY FIGURE HERE IS COUNTED OR MEASURED. Money comes from key-usage, which reads the same rows the daily
// ceiling refuses against. Verdicts come from the one canonical translator, so a pass rate here cannot
// disagree with the exit code a customer's pipeline saw. Duration is measured start to finish and is not
// the cost governor's flow_units * 60 estimate, which books a nine-second run as sixty. Requests are
// best-effort by construction and are labelled as such rather than mixed into anything about money.
//
// WHAT IS NOT HERE: tokens. There is no token metric. See lib/preflight/key-detail.ts.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { listApiKeys } from "@/lib/v-api-keys";
import { keyDetail } from "@/lib/preflight/key-detail";
import { runVerdict, timeAgo } from "@/lib/preflight/home-verdict";
import { Ic, I } from "@/app/rank/_components/icons";

export const metadata: Metadata = { title: "API key" };
export const dynamic = "force-dynamic";

const label = { fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--fg-4)", margin: 0 };
const money = (c: number | null | undefined) => (c == null ? "—" : `$${(c / 100).toFixed(2)}`);

/** Seconds, said the way a person says them. 9s, 1m 12s, never 0.15 minutes. */
function secs(s: number | null): string {
  if (s == null) return "—";
  if (s < 60) return `${s < 10 ? s.toFixed(1) : Math.round(s)}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.round(s - m * 60)}s`;
}

function Stat({ k, v, sub, tone }: { k: string; v: string; sub?: string; tone?: string }) {
  return (
    <div style={{ padding: "14px 16px", border: "1px solid var(--line-2)", borderRadius: "var(--r-lg, 14px)", background: "var(--bg-1)" }}>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 24, lineHeight: 1, color: tone ?? "var(--fg-1)", fontVariantNumeric: "tabular-nums" }}>{v}</div>
      <div style={{ ...label, marginTop: 7 }}>{k}</div>
      {sub ? <div style={{ fontSize: 12, color: "var(--fg-4)", marginTop: 4 }}>{sub}</div> : null}
    </div>
  );
}

export default async function KeyDetailPage(ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect(`/signin?callbackUrl=${encodeURIComponent(`/developers/keys/${id}`)}`);
  const owner = email.toLowerCase();

  // Ownership from the caller's OWN key list, never from the id in the URL. A key id guessed or leaked from
  // another tenant is a 404 here, and every read below is additionally scoped by user_id.
  const keys = await listApiKeys(email).catch(() => []);
  const key = keys.find((k) => k.id === id);
  if (!key) notFound();

  const d = await keyDetail(owner, { id: key.id, prefix: key.prefix, dailyCeilingCents: key.daily_ceiling_cents ?? null });

  const ceiling = key.daily_ceiling_cents ?? null;
  const v = d?.verdicts;
  const busiest = d ? d.hourly.indexOf(Math.max(...d.hourly)) : -1;
  const maxDayRuns = d ? Math.max(1, ...d.daily.map((b) => b.runs)) : 1;

  return (
    <div className="wrap" style={{ maxWidth: 1080, paddingTop: "clamp(20px, 2.6vw, 32px)", paddingBottom: 80 }}>
      {/* flex + fit-content, never inline-flex: an inline back link shares a line with the eyebrow that
          follows it. Founder rule, enforced by preflight-routes-verify, which caught this on the first run. */}
      <Link href="/developers" style={{ fontSize: 13, color: "var(--fg-4)", textDecoration: "none", display: "flex", width: "fit-content", alignItems: "center", gap: 6, marginBottom: 14 }}>
        <span aria-hidden>←</span> Developers
      </Link>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 6 }}>
        <div style={{ minWidth: 0 }}>
          <p className="eyebrow" style={label}>API key</p>
          <h1 className="display" style={{ fontSize: "clamp(1.55rem, 2.6vw, 2rem)", margin: "4px 0 8px", letterSpacing: "-0.025em" }}>{key.name || "Untitled key"}</h1>
          <code style={{ fontFamily: "var(--font-code)", fontSize: 13, color: "var(--fg-4)" }}>{key.prefix}…</code>
        </div>
      </div>
      <p style={{ margin: "0 0 6px", fontSize: 13, color: "var(--fg-4)" }}>
        Created {new Date(key.created_at).toLocaleDateString()}
        {key.last_used ? `, last used ${timeAgo(key.last_used)}` : ", never used"}
        {d?.firstRunAt ? `, first verification ${timeAgo(d.firstRunAt)}` : ""}
      </p>
      {key.scopes?.length ? (
        <div style={{ fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-5)", marginBottom: 24 }}>{key.scopes.join("  ")}</div>
      ) : <div style={{ marginBottom: 24 }} />}

      {!d ? (
        <p style={{ fontSize: 13.5, color: "var(--fg-3)" }}>This key&apos;s history could not be read just now. Nothing has changed; try again shortly.</p>
      ) : (
        <>
          {/* ── SPEND, first, because it is the question ─────────────────────────────────────────────── */}
          <h2 style={{ ...label, marginBottom: 10 }}>Spend</h2>
          <div className="tile-grid cols-4" style={{ marginBottom: 10 }}>
            <Stat k="Spent today" v={money(d.usage.spentTodayCents)}
              sub={ceiling == null ? "No daily limit on this key" : `of ${money(ceiling)} limit${d.usage.remainingTodayCents != null ? `, ${money(d.usage.remainingTodayCents)} left` : ""}`} />
            <Stat k="Charged, 30 days" v={money(d.usage.last30d.chargedCents)} sub={`${d.usage.last30d.runs} verification${d.usage.last30d.runs === 1 ? "" : "s"}`} />
            <Stat k="Charged, all time" v={money(d.usage.allTime.chargedCents)} sub={`${d.usage.allTime.runs} verification${d.usage.allTime.runs === 1 ? "" : "s"}`} />
            <Stat k="Per verification" v={money(d.cost.medianCentsPerPaidRun)}
              sub={d.cost.paidRuns ? `median of ${d.cost.paidRuns} charged run${d.cost.paidRuns === 1 ? "" : "s"}` : "nothing charged yet"} />
          </div>
          {/* A subscriber's key is charged nothing and still consumes something. Dollars alone would tell
              them the key is free. */}
          {(d.cost.planRuns > 0 || d.usage.allTime.flowUnits > 0) ? (
            <p style={{ fontSize: 12.5, color: "var(--fg-4)", margin: "0 0 26px" }}>
              {d.cost.planRuns > 0 ? <>{d.cost.planRuns} verification{d.cost.planRuns === 1 ? " was" : "s were"} covered by your plan rather than charged. </> : null}
              {d.usage.allTime.flowUnits > 0 ? <>This key has used <strong style={{ color: "var(--fg-2)" }}>{d.usage.allTime.flowUnits.toLocaleString()} journey{d.usage.allTime.flowUnits === 1 ? "" : "s"}</strong> of allowance.</> : null}
            </p>
          ) : <div style={{ marginBottom: 26 }} />}

          {/* ── WHAT IT DECIDED ──────────────────────────────────────────────────────────────────────── */}
          <h2 style={{ ...label, marginBottom: 10 }}>Verdicts</h2>
          <div className="tile-grid cols-4" style={{ marginBottom: 8 }}>
            <Stat k="Verified" v={String(v!.verified)} tone={v!.verified ? "var(--go-ink)" : undefined} />
            <Stat k="Failed" v={String(v!.failed)} tone={v!.failed ? "var(--stop-ink)" : undefined} />
            <Stat k="Blocked" v={String(v!.blocked)} tone={v!.blocked ? "var(--wait-ink)" : undefined} />
            <Stat k="Pass rate" v={v!.passRate == null ? "—" : `${Math.round(v!.passRate * 100)}%`}
              sub={v!.decided ? `of ${v!.decided} decided` : "nothing decided yet"} />
          </div>
          <p style={{ fontSize: 12, color: "var(--fg-5)", margin: "0 0 26px", lineHeight: 1.6, maxWidth: "70ch" }}>
            These are the same three conclusions the API returns and your CI gate exits on, from the one
            translator all of them share. A repair rerun that passed only its targeted scope counts as
            Blocked, not Verified.
            {v!.invalidated > 0 ? <> {v!.invalidated} run{v!.invalidated === 1 ? " was" : "s were"} invalidated: the charge stands, the verdict was withdrawn, so {v!.invalidated === 1 ? "it is" : "they are"} not counted above.</> : null}
          </p>

          {/* ── HOW LONG IT TAKES, measured ──────────────────────────────────────────────────────────── */}
          <h2 style={{ ...label, marginBottom: 10 }}>Duration</h2>
          <div className="tile-grid cols-4" style={{ marginBottom: 8 }}>
            <Stat k="Typical" v={secs(d.duration.medianSeconds)} sub={d.duration.count ? `median of ${d.duration.count}` : "no completed runs"} />
            <Stat k="Slowest 5%" v={secs(d.duration.p95Seconds)} sub="p95" />
            <Stat k="Longest" v={secs(d.duration.longestSeconds)} />
            <Stat k="Guarantees touched" v={String(d.guaranteesTouched)} sub={d.guaranteesTouched === 0 ? "none of these runs was bound to one" : undefined} />
          </div>
          <p style={{ fontSize: 12, color: "var(--fg-5)", margin: "0 0 26px", lineHeight: 1.6, maxWidth: "70ch" }}>
            Measured from when the run started to when it finished. Median and p95 rather than an average,
            because one long run drags a mean to a number no run resembles.
          </p>

          {/* ── THIRTY DAYS ──────────────────────────────────────────────────────────────────────────── */}
          <h2 style={{ ...label, marginBottom: 10 }}>Last 30 days</h2>
          <div style={{ border: "1px solid var(--line-2)", borderRadius: "var(--r-lg, 14px)", background: "var(--bg-1)", padding: "16px 18px 12px", marginBottom: 26 }}>
            {/* Every day is drawn, including the empty ones. Plotting only the days with activity turns a
                sparse history into a claim about tempo that the data does not make. */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 92 }}>
              {d.daily.map((b) => {
                const h = b.runs ? Math.max(4, Math.round((b.runs / maxDayRuns) * 88)) : 1;
                const tone = b.runs === 0 ? "var(--line-2)"
                  : b.failed || b.blocked ? "var(--wait-line)" : "var(--go-line)";
                return (
                  <div key={b.day} title={`${b.day}: ${b.runs} run${b.runs === 1 ? "" : "s"}, ${money(b.chargedCents)}`}
                    style={{ flex: 1, height: h, background: tone, borderRadius: 2, minWidth: 3 }} />
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: "var(--fg-5)" }}>
              <span>{d.daily[0]?.day}</span>
              <span>{d.daily.reduce((s, b) => s + b.runs, 0)} verifications, {money(d.daily.reduce((s, b) => s + b.chargedCents, 0))}</span>
              <span>today</span>
            </div>
          </div>

          {/* ── REQUESTS, kept away from everything about money ──────────────────────────────────────── */}
          <h2 style={{ ...label, marginBottom: 10 }}>Requests</h2>
          <div className="tile-grid cols-4" style={{ marginBottom: 8 }}>
            <Stat k="All time" v={(d.usage.requests?.total ?? 0).toLocaleString()} />
            <Stat k="Last 24 hours" v={(d.usage.requests?.last24h ?? 0).toLocaleString()} />
            <Stat k="Verifications launched" v={String(d.runs)} sub="the rest read or priced something" />
            <Stat k="Busiest hour" v={busiest >= 0 && d.hourly[busiest] > 0 ? `${String(busiest).padStart(2, "0")}:00` : "—"} sub="UTC" />
          </div>
          <p style={{ fontSize: 12, color: "var(--fg-5)", margin: "0 0 14px", lineHeight: 1.6, maxWidth: "70ch" }}>
            Requests are counted from the activity log, which is best effort: it is written after the fact
            and never allowed to break a call. Everything above about money is read from the verification
            records instead, which is the same source the daily limit refuses against.
          </p>
          {d.endpoints.length > 0 ? (
            <div style={{ border: "1px solid var(--line-2)", borderRadius: "var(--r-lg, 14px)", background: "var(--bg-1)", overflow: "hidden", marginBottom: 26 }}>
              {d.endpoints.map((e, i) => (
                <div key={`${e.method} ${e.endpoint}`} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 16px", borderTop: i ? "1px solid var(--line-1)" : "none", fontSize: 12.5 }}>
                  <code style={{ fontFamily: "var(--font-code)", color: "var(--fg-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {e.method ? <span style={{ color: "var(--fg-5)" }}>{e.method} </span> : null}{e.endpoint}
                  </code>
                  <span style={{ color: "var(--fg-2)", fontVariantNumeric: "tabular-nums" }}>{e.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : <div style={{ marginBottom: 26 }} />}

          {/* ── EVERY CHARGE TRACEABLE TO WHAT IT PAID FOR ───────────────────────────────────────────── */}
          <h2 style={{ ...label, marginBottom: 10 }}>Verifications this key launched</h2>
          {d.usage.recentRuns.length === 0 ? (
            <p style={{ fontSize: 13.5, color: "var(--fg-3)" }}>This key has not launched a verification yet.</p>
          ) : (
            <div style={{ border: "1px solid var(--line-2)", borderRadius: "var(--r-lg, 14px)", background: "var(--bg-1)", overflow: "hidden" }}>
              {d.usage.recentRuns.map((r, i) => {
                const verdict = runVerdict(r.state, r.decision);
                const tone = verdict.tone === "verified" ? "var(--go-ink)" : verdict.tone === "failed" ? "var(--stop-ink)"
                  : verdict.tone === "blocked" ? "var(--wait-ink)" : "var(--fg-4)";
                return (
                  <Link key={r.id} href={`/records/${r.id}`} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto auto", alignItems: "center", gap: 12, padding: "10px 16px", borderTop: i ? "1px solid var(--line-1)" : "none", color: "inherit", textDecoration: "none", fontSize: 12.5 }}>
                    <span style={{ fontFamily: "var(--font-code)", color: "var(--fg-5)" }}>{new Date(r.createdAt).toLocaleDateString()}</span>
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--fg-3)" }}>{r.deploymentUrl || r.id.slice(0, 12)}</span>
                    <span style={{ color: tone, fontWeight: 600 }}>{verdict.label}</span>
                    <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--fg-2)", fontWeight: 600, minWidth: 62, textAlign: "right" }}>{r.chargedCents == null ? "on plan" : money(r.chargedCents)}</span>
                  </Link>
                );
              })}
            </div>
          )}
          {d.truncated ? (
            <p style={{ fontSize: 11.5, color: "var(--fg-5)", marginTop: 10 }}>
              This key has more history than one page reads. Everything above covers its most recent 1,000 verifications.
            </p>
          ) : null}

          <p style={{ fontSize: 11.5, color: "var(--fg-5)", marginTop: 22, display: "flex", alignItems: "center", gap: 6 }}>
            <Ic d={I.shield} size={13} />
            No token counts here. Vraelis meters verifications, not inference, and does not record a token figure it could put on this page.
          </p>
        </>
      )}
    </div>
  );
}
