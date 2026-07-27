// /usage — what this account has actually consumed, and the limits it is actually checked against.
//
// "Usage" pointed at the top-up page, so the only thing it answered was "how do I buy more". That is the
// least interesting question on the subject. The ones a developer opens this page for are: which key is
// doing the work, how much has it spent, when did it last run, and what will refuse me. All four are
// recorded already and none of them was on screen anywhere.
//
// EVERY NUMBER HERE IS COUNTED, NOT ESTIMATED. apiRequestCountsByPrefix is an exact count() per key rather
// than a sample of recent events; keySpentTodayCents reads the same ledger the ceiling refusal reads;
// ownerActiveRunCount and ownerRunsToday are the same calls the launch route makes before it refuses. The
// limits come from lib/preflight/limits.ts, which the routes themselves import, so this page cannot quote a
// ceiling the API does not enforce.
//
// NO CHART. A cost graph over this data would be one bar, and a shape drawn from three points is decoration
// pretending to be analysis. When there is enough history to say something, it can earn its space.
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getPlan } from "@/lib/v-db";
import { getPlanV1State } from "@/lib/preflight/entitlements-v1";
import { planLabel } from "@/lib/plan-label";
import { balance } from "@/lib/v-credits";
import { apiAccessAllowed } from "@/lib/v-entitlements";
import { apiUsage, apiRequestCountsByPrefix } from "@/lib/v-events";
import { listApiKeys } from "@/lib/v-api-keys";
import { webhookStats } from "@/lib/v-webhooks";
import { keySpentTodayCents } from "@/lib/preflight/key-spend";
import { ownerActiveRunCount, ownerRunsToday } from "@/lib/preflight/runs-db";
import { MAX_ACTIVE_RUNS_PER_OWNER, maxRunsPerDay } from "@/lib/preflight/limits";
import { topupMaxDollars } from "@/lib/v-entitlements";
import { timeAgo } from "@/lib/preflight/home-verdict";
import { Ic, I } from "@/app/rank/_components/icons";

export const metadata: Metadata = { title: "Usage" };
export const dynamic = "force-dynamic";

const label = { fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--fg-4)", margin: 0 };
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function Stat({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div style={{ padding: "14px 16px", border: "1px solid var(--line-2)", borderRadius: "var(--r-lg, 14px)", background: "var(--bg-1)" }}>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 24, lineHeight: 1, color: "var(--fg-1)", fontVariantNumeric: "tabular-nums" }}>{v}</div>
      <div style={{ ...label, marginTop: 7 }}>{k}</div>
      {sub ? <div style={{ fontSize: 12, color: "var(--fg-4)", marginTop: 4 }}>{sub}</div> : null}
    </div>
  );
}

export default async function UsagePage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/signin?callbackUrl=%2Fusage");
  const owner = email.toLowerCase();

  const settle = async <T,>(p: Promise<T>, fallback: T): Promise<T> => { try { return await p; } catch { return fallback; } };

  const [plan, planV1, bal, keys, usage, hooks, active, today] = await Promise.all([
    settle(getPlan(email), "free"),
    settle(getPlanV1State(owner), null),
    settle(balance(email), 0),
    settle(listApiKeys(email), []),
    settle(apiUsage(email), { total: 0, last24h: 0, last7d: 0, lastAt: null, byEndpoint: [], byPrefix: {} }),
    settle(webhookStats(email), { endpoints: 0, total: 0, success: 0, failed: 0, retried: 0, lastAt: null }),
    settle(ownerActiveRunCount(owner), 0),
    settle(ownerRunsToday(owner), 0),
  ]);

  // Exact per-key totals, not the sampled breakdown apiUsage carries by default.
  const byPrefix = await settle(apiRequestCountsByPrefix(email, keys.map((k) => k.prefix)), usage.byPrefix);
  // Spend today per key, from the same ledger the ceiling refusal reads. Null when migration 16 is absent.
  const spent = await Promise.all(keys.map((k) => settle(keySpentTodayCents(k.id), null)));

  const dayCap = maxRunsPerDay();
  const hasApi = apiAccessAllowed(plan, email, planV1?.plan);

  return (
    <div className="wrap" style={{ maxWidth: 1080, paddingTop: "clamp(20px, 2.6vw, 32px)", paddingBottom: 80 }}>
      <h1 className="display" style={{ fontSize: "clamp(1.55rem, 2.6vw, 2rem)", margin: "0 0 8px", letterSpacing: "-0.025em" }}>Usage</h1>
      <p style={{ margin: "0 0 26px", fontSize: 14, color: "var(--fg-3)", lineHeight: 1.6, maxWidth: "62ch" }}>
        What this account has consumed, which credential did it, and the limits a request is checked against
        before it runs.
      </p>

      <section aria-label="Balance and consumption" style={{ marginBottom: 30 }}>
        <h2 style={{ ...label, marginBottom: 10 }}>Right now</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
          <Stat k="Credits available" v={bal.toLocaleString()} sub={`${planLabel(planV1?.plan, plan)} plan`} />
          <Stat k="Verifications running" v={`${active} / ${MAX_ACTIVE_RUNS_PER_OWNER}`} sub="At once" />
          <Stat k="Launched today" v={`${today} / ${dayCap}`} sub="Resets at UTC midnight" />
          <Stat k="API requests, 24h" v={usage.last24h.toLocaleString()} sub={`${usage.last7d.toLocaleString()} in 7 days`} />
        </div>
        <p style={{ margin: "12px 0 0", fontSize: 12.5, color: "var(--fg-4)" }}>
          Need more balance? <Link href="/credits" style={{ color: "var(--acc-deep)" }}>Top up credits</Link>. Single top-up limit ${topupMaxDollars().toLocaleString()}.
        </p>
      </section>

      <section aria-label="API keys" style={{ marginBottom: 30 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
          <h2 style={label}>API keys ({keys.length})</h2>
          <Link href="/developers" style={{ fontSize: 13, color: "var(--acc-deep)", textDecoration: "none" }}>Manage keys <span aria-hidden>→</span></Link>
        </div>
        <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--fg-4)" }}>Requests are an exact all-time count per key, not a sample.</p>

        {keys.length ? (
          <div className="card vra-usage-tbl" style={{ padding: 0, overflow: "hidden", background: "var(--bg-1)" }}>
            <div className="vra-usage-tbl__head" role="presentation">
              <span>Key</span><span>Requests</span><span>Spent today</span><span>Last used</span><span>Created</span>
            </div>
            {keys.map((k, i) => {
              const cents = spent[i];
              const ceiling = k.daily_ceiling_cents ?? null;
              const over = cents !== null && ceiling !== null && cents >= ceiling;
              return (
                <div key={k.id} className="vra-usage-tbl__row">
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13.5, color: "var(--fg-1)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.name || "Untitled key"}</span>
                    <span style={{ fontFamily: "var(--font-code)", fontSize: 11.5, color: "var(--fg-5)" }}>{k.prefix}</span>
                  </span>
                  <span data-l="Requests" style={{ fontVariantNumeric: "tabular-nums", color: "var(--fg-2)" }}>{(byPrefix[k.prefix] ?? 0).toLocaleString()}</span>
                  <span data-l="Spent today" style={{ fontVariantNumeric: "tabular-nums", color: over ? "var(--stop-ink)" : "var(--fg-2)" }}>
                    {cents === null ? "—" : money(cents)}
                    {ceiling !== null ? <span style={{ color: "var(--fg-5)" }}> / {money(ceiling)}</span> : <span style={{ color: "var(--fg-5)" }}> / no cap</span>}
                  </span>
                  <span data-l="Last used" style={{ color: "var(--fg-4)" }}>{k.last_used ? timeAgo(k.last_used) : "never"}</span>
                  <span data-l="Created" style={{ color: "var(--fg-4)" }}>{timeAgo(k.created_at)}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ border: "1px dashed var(--line-3)", borderRadius: "var(--r-lg, 14px)", background: "var(--bg-2)", padding: "clamp(18px, 2.4vw, 26px)" }}>
            <div style={{ color: "var(--fg-3)", marginBottom: 8 }}><Ic d={I.key} size={20} /></div>
            <p style={{ margin: "0 0 14px", fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.6, maxWidth: "56ch" }}>
              No API keys yet. A key lets CI, an agent or the CLI launch and read verifications with the same
              balance and the same limits as the console.
            </p>
            <Link href="/developers" className="btn btn--ghost">Create a key</Link>
          </div>
        )}
        {!hasApi && keys.length > 0 && (
          <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--wait-ink)" }}>
            The public API is part of the Scale plan. <Link href="/plans" style={{ color: "var(--acc-deep)" }}>See plans</Link>.
          </p>
        )}
      </section>

      {usage.byEndpoint.length > 0 && (
        <section aria-label="Endpoints" style={{ marginBottom: 30 }}>
          <h2 style={{ ...label, marginBottom: 10 }}>Where the requests went</h2>
          <div className="card" style={{ padding: 0, overflow: "hidden", background: "var(--bg-1)" }}>
            {usage.byEndpoint.slice(0, 8).map((e, i) => (
              <div key={`${e.method} ${e.endpoint}`} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 14, padding: "11px 16px", borderTop: i ? "1px solid var(--line-2)" : "none", alignItems: "center" }}>
                <span style={{ fontFamily: "var(--font-code)", fontSize: 12.5, color: "var(--fg-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <span style={{ color: "var(--fg-4)" }}>{e.method}</span> {e.endpoint}
                </span>
                <span style={{ fontVariantNumeric: "tabular-nums", fontSize: 13, color: "var(--fg-3)" }}>{e.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {hooks.endpoints > 0 && (
        <section aria-label="Webhooks" style={{ marginBottom: 30 }}>
          <h2 style={{ ...label, marginBottom: 10 }}>Webhook delivery</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
            <Stat k="Endpoints" v={String(hooks.endpoints)} />
            <Stat k="Delivered" v={hooks.success.toLocaleString()} />
            <Stat k="Failed" v={hooks.failed.toLocaleString()} />
            <Stat k="Retried" v={hooks.retried.toLocaleString()} />
          </div>
        </section>
      )}

      <section aria-label="Limits">
        <h2 style={{ ...label, marginBottom: 4 }}>Limits</h2>
        {/* Quoted from lib/preflight/limits.ts, which the launch and rerun routes import. A page that
            restated these would eventually promise a ceiling the API does not enforce. */}
        <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--fg-4)" }}>These are the values the API checks before a run starts, not a description of them.</p>
        <div className="card" style={{ padding: 0, overflow: "hidden", background: "var(--bg-1)" }}>
          {[
            ["Verifications in flight", `${MAX_ACTIVE_RUNS_PER_OWNER} at once`, "A third is refused until one finishes."],
            ["Verifications per day", `${dayCap} per UTC day`, "Checked before any credit is held."],
            ["Single top-up", `$${topupMaxDollars().toLocaleString()}`, "Larger volumes are invoiced."],
            ["Per-key daily spend", "Set per key", "A key without a cap can spend the whole balance."],
          ].map(([k, v, why], i) => (
            <div key={k} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 14, padding: "12px 16px", borderTop: i ? "1px solid var(--line-2)" : "none", alignItems: "baseline" }}>
              <span>
                <span style={{ display: "block", fontSize: 13.5, color: "var(--fg-1)" }}>{k}</span>
                <span style={{ fontSize: 12, color: "var(--fg-4)" }}>{why}</span>
              </span>
              <span style={{ fontSize: 13, color: "var(--fg-2)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{v}</span>
            </div>
          ))}
        </div>
      </section>

      <style>{`
.vra-usage-tbl__head{display:grid;gap:14px;padding:9px 16px;border-bottom:1px solid var(--line-2);background:var(--bg-2);
  font-family:var(--font-code);font-size:10px;letter-spacing:.07em;text-transform:uppercase;color:var(--fg-5)}
.vra-usage-tbl__row{display:grid;gap:14px;align-items:center;padding:12px 16px;font-size:13px;border-top:1px solid var(--line-1)}
.vra-usage-tbl__row:first-of-type{border-top:none}
.vra-usage-tbl__head,.vra-usage-tbl__row{grid-template-columns:minmax(0,2fr) 92px 148px 104px 104px}
@media (max-width:820px){
  .vra-usage-tbl__head{display:none}
  .vra-usage-tbl__row{grid-template-columns:1fr;gap:7px}
  .vra-usage-tbl__row>[data-l]{display:flex;align-items:center;justify-content:space-between;gap:14px}
  .vra-usage-tbl__row>[data-l]::before{content:attr(data-l);font-family:var(--font-code);font-size:10px;
    letter-spacing:.07em;text-transform:uppercase;color:var(--fg-5)}
}
      `}</style>
    </div>
  );
}
