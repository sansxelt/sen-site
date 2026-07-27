// IS THERE A TOKEN METRIC, AND DOES IT DESCRIBE WHAT A CUSTOMER SPENT?
//
// Asked because the API key surface does not show tokens and the obvious next step is to put them there.
// A number on a key page is a claim about that key. Before making it, this reads production and answers
// three separate questions that are easy to collapse into one:
//
//   1. Is a token count recorded at all?
//   2. Is it attributable to a RUN, and through the run to a KEY?
//   3. Does it cover the AI work a customer verification actually does, or only one code path?
//
// Reads only. Prints counts, never a customer's content.
//   npx tsx ops/token-metric-audit.ts
import { readFileSync } from "node:fs";

function loadEnv() {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

async function main() {
  const { getSupabaseAdminClient, isDatabaseConfigured } = await import("../lib/supabase-admin");
  if (!isDatabaseConfigured()) { console.log("no database configured"); return; }
  const db = getSupabaseAdminClient();

  const { data: rows, error } = await db.from("v_cost_ledger" as never)
    .select("run_id, ai_tokens, browserbase_seconds, estimated_cents, created_at")
    .order("created_at", { ascending: false }).limit(5000);
  if (error) { console.log("v_cost_ledger read failed:", error.message); return; }

  const ledger = (rows ?? []) as { run_id: string | null; ai_tokens: number | null; browserbase_seconds: number | null; estimated_cents: number | null; created_at: string }[];
  const withTokens = ledger.filter((r) => Number(r.ai_tokens) > 0);
  const tokensWithRun = withTokens.filter((r) => r.run_id);
  const totalTokens = ledger.reduce((s, r) => s + (Number(r.ai_tokens) || 0), 0);

  console.log("── v_cost_ledger ──");
  console.log("rows:                       ", ledger.length);
  console.log("rows with ai_tokens > 0:    ", withTokens.length);
  console.log("...of those, tied to a run: ", tokensWithRun.length);
  console.log("total ai_tokens recorded:   ", totalTokens);
  console.log("rows with browserbase_seconds > 0:", ledger.filter((r) => Number(r.browserbase_seconds) > 0).length);
  console.log("newest row:                 ", ledger[0]?.created_at ?? "(none)");

  // How many runs exist to compare against, so "0 tokens" can be read as "not recorded" rather than
  // "nothing ran".
  const { count: runCount } = await db.from("v_preflight_runs" as never)
    .select("id", { count: "exact", head: true });
  console.log("\n── for scale ──");
  console.log("verification runs in total: ", runCount ?? "(unknown)");

  console.log("\n── verdict ──");
  if (totalTokens === 0) {
    console.log("NO token metric exists in practice. The column is written by exactly one code path");
    console.log("(lib/preflight/agent/agent-client.ts), which passes runId: null, and the customer");
    console.log("verification path records browserbase seconds only. A per-key token number would have");
    console.log("to be invented.");
  } else if (tokensWithRun.length === 0) {
    console.log(`${totalTokens} tokens are recorded, but NONE carry a run_id, so none can be attributed`);
    console.log("to a key. A per-key token number would still have to be invented.");
  } else {
    console.log(`${tokensWithRun.length} token rows carry a run_id and could be rolled up per key.`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
