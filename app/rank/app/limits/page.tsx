// /limits — what will refuse a request, and at what number.
//
// This was the last section of /usage, under everything else. That put the answer to "why was I refused"
// at the bottom of a page about consumption, which is a different question: usage is what you have spent,
// limits are what will stop you. Someone hitting a ceiling is not browsing.
//
// EVERY VALUE IS QUOTED FROM THE MODULE THAT ENFORCES IT, never restated. lib/preflight/limits.ts is what
// the launch and rerun routes import before they refuse, and topupMaxDollars is what checkout checks. A
// page that retyped these numbers would eventually promise a ceiling the API does not honour, which is the
// same defect class as a verdict that disagrees with itself.
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listApiKeys } from "@/lib/v-api-keys";
import { keySpentTodayCents } from "@/lib/preflight/key-spend";
import { ownerActiveRunCount, ownerRunsToday } from "@/lib/preflight/runs-db";
import { MAX_ACTIVE_RUNS_PER_OWNER, maxRunsPerDay } from "@/lib/preflight/limits";
import { topupMaxDollars } from "@/lib/v-entitlements";

export const metadata: Metadata = { title: "Limits" };
export const dynamic = "force-dynamic";

const label = { fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--fg-4)", margin: 0 };
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default async function LimitsPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/signin?callbackUrl=%2Flimits");
  const owner = email.toLowerCase();

  const settle = async <T,>(p: Promise<T>, fallback: T): Promise<T> => { try { return await p; } catch { return fallback; } };
  const [keys, active, today] = await Promise.all([
    settle(listApiKeys(email), []),
    settle(ownerActiveRunCount(owner), 0),
    settle(ownerRunsToday(owner), 0),
  ]);
  const spent = await Promise.all(keys.map((k) => settle(keySpentTodayCents(k.id), null)));
  const dayCap = maxRunsPerDay();

  // WHERE YOU ARE AGAINST EACH CEILING, not just what the ceiling is. A limits page that lists numbers
  // without saying how close you are answers the easy half of the question.
  const CEILINGS: [string, string, string, string | null][] = [
    ["Verifications in flight", `${MAX_ACTIVE_RUNS_PER_OWNER} at once`, "One more is refused until one finishes.", `${active} running now`],
    ["Verifications per day", `${dayCap} per UTC day`, "Checked before any credit is held, so a refusal costs nothing.", `${today} launched today`],
    ["Single top-up", `$${topupMaxDollars().toLocaleString()}`, "Larger volumes are invoiced. Contact sales.", null],
    ["Per-key daily spend", "Set per key", "A key with no ceiling can spend the whole balance.", keys.length ? `${keys.filter((k) => k.daily_ceiling_cents != null).length} of ${keys.length} keys have one` : "no keys yet"],
  ];

  return (
    <div className="wrap" style={{ maxWidth: 1080, paddingTop: "clamp(20px, 2.6vw, 32px)", paddingBottom: 80 }}>
      <h1 className="display" style={{ fontSize: "clamp(1.55rem, 2.6vw, 2rem)", margin: "0 0 8px", letterSpacing: "-0.025em" }}>Limits</h1>
      <p style={{ margin: "0 0 26px", fontSize: 14, color: "var(--fg-3)", lineHeight: 1.6, maxWidth: "62ch" }}>
        What will refuse a request, and how close you are to it. These are the values the API checks before
        a run starts, read from the same module the routes import, not a description of them.
      </p>

      <section aria-label="Account ceilings" style={{ marginBottom: 30 }}>
        <h2 style={{ ...label, marginBottom: 10 }}>This account</h2>
        <div className="card" style={{ padding: 0, overflow: "hidden", background: "var(--bg-1)" }}>
          {CEILINGS.map(([k, v, why, now], i) => (
            <div key={k} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 14, padding: "13px 16px", borderTop: i ? "1px solid var(--line-2)" : "none", alignItems: "baseline" }}>
              <span>
                <span style={{ display: "block", fontSize: 13.5, color: "var(--fg-1)" }}>{k}</span>
                <span style={{ fontSize: 12, color: "var(--fg-4)" }}>{why}</span>
                {now ? <span style={{ display: "block", fontSize: 12, color: "var(--fg-5)", marginTop: 2 }}>{now}</span> : null}
              </span>
              <span style={{ fontSize: 13, color: "var(--fg-2)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{v}</span>
            </div>
          ))}
        </div>
      </section>

      {keys.length > 0 ? (
        <section aria-label="Per key" style={{ marginBottom: 30 }}>
          <h2 style={{ ...label, marginBottom: 10 }}>Per key</h2>
          <div className="card" style={{ padding: 0, overflow: "hidden", background: "var(--bg-1)" }}>
            {keys.map((k, i) => {
              const ceiling = k.daily_ceiling_cents ?? null;
              const used = spent[i];
              return (
                <Link key={k.id} href={`/developers/keys/${k.id}`} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 14, padding: "12px 16px", borderTop: i ? "1px solid var(--line-2)" : "none", alignItems: "baseline", color: "inherit", textDecoration: "none" }}>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13.5, color: "var(--fg-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.name || "Untitled key"}</span>
                    <code style={{ fontFamily: "var(--font-code)", fontSize: 11.5, color: "var(--fg-5)" }}>{k.prefix}…</code>
                  </span>
                  <span style={{ fontSize: 13, color: ceiling == null ? "var(--wait-ink)" : "var(--fg-2)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                    {ceiling == null ? "No daily ceiling" : `${used != null ? money(used) : "—"} of ${money(ceiling)} today`}
                  </span>
                </Link>
              );
            })}
          </div>
          <p style={{ margin: "10px 2px 0", fontSize: 12, color: "var(--fg-5)", lineHeight: 1.6 }}>
            Spend today is read from the same records the ceiling is enforced against, so the figure here
            cannot disagree with the one that refuses a key.
          </p>
        </section>
      ) : null}

      <p style={{ fontSize: 12.5, color: "var(--fg-4)", lineHeight: 1.6 }}>
        Need a higher ceiling? <Link href="/billing" style={{ color: "var(--acc-deep)" }}>Billing</Link> covers
        plans and invoicing. What you have actually consumed is on <Link href="/usage" style={{ color: "var(--acc-deep)" }}>Usage</Link>.
      </p>
    </div>
  );
}
