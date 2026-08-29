// READ-ONLY audit: which existing contracts would the NEW launch coverage gate refuse?
//
// WHY THIS EXISTS. The coverage gate now runs below every launch entrance. It was only ever on the public
// API before, so every contract in production was approved and launched without it, and turning it on can
// refuse a launch that succeeded yesterday. That is the intended behaviour — a plan that cannot prove its
// claim should not be charged for — but "intended" is not the same as "known", and finding out from a YC
// reviewer's blocked demo is the wrong way to learn it.
//
// This answers the question before anyone hits it: for every application, take the contract a launch would
// use, take the flows that are enabled and approved, and run the exact gate the launch path runs. Nothing is
// written, nothing is queued, no browser starts, no money moves.
//
// It SELECTs only. No insert, update or delete, and it lives in ops/ rather than scripts/ so the suite
// registry never tries to run it against a live database in CI.
//
//   npx tsx ops/launch-gate-audit.ts              every application
//   npx tsx ops/launch-gate-audit.ts demo@vraelis.com   one owner
import { readFileSync } from "node:fs";

// .env.local is gitignored and may simply not exist on a given machine, so its absence is normal and must
// not be a crash. The original copied this loader from ops/guarantee-lineage-audit.ts, which reads the file
// unguarded and dies with ENOENT — an operator tool that explodes before it can say what it needs is worse
// than one that never shipped.
function loadEnv() {
  let raw = "";
  try { raw = readFileSync(".env.local", "utf8"); } catch { return; }
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main() {
  loadEnv();
  const only = (process.argv[2] || "").trim().toLowerCase();
  const { createClient } = await import("@supabase/supabase-js");
  const { decideLaunchCoverage } = await import("../lib/preflight/acceptance/launch-coverage");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) {
    console.log("No Supabase credentials found, so nothing was read.\n");
    console.log("This tool needs the same two values the app runs on. Either create .env.local, or pass");
    console.log("them for one command (PowerShell):\n");
    console.log('  $env:NEXT_PUBLIC_SUPABASE_URL="https://<project>.supabase.co"');
    console.log('  $env:SUPABASE_SERVICE_ROLE_KEY="<service role key>"');
    console.log("  npx tsx ops/launch-gate-audit.ts\n");
    console.log("Both are in the Vercel project's environment variables, or Supabase > Project Settings > API.");
    console.log("If you would rather not, the shortcut is in the note at the bottom of this file.");
    return;
  }
  const s = createClient(url, key, { auth: { persistSession: false } });

  console.log(`LAUNCH GATE AUDIT (read-only)${only ? `  owner=${only}` : ""}\n`);

  let q = s.from("v_production_contracts").select("id,application_id,user_id,version,status,source_prompt,kind");
  if (only) q = q.eq("user_id", only);
  const { data: contracts, error } = await q;
  if (error) { console.log("ERR " + error.message); return; }

  const rows = (contracts ?? []) as {
    id: string; application_id: string; user_id: string; version: number;
    status: string; source_prompt: string | null; kind?: string | null;
  }[];
  const approved = rows.filter((c) => c.status === "approved");
  console.log(`contracts: ${rows.length} total, ${approved.length} approved\n`);

  const tally = { passed: 0, refused: 0, no_claim: 0, awaiting_review: 0 };

  for (const c of approved) {
    const [reqs, flows] = await Promise.all([
      s.from("v_contract_requirements").select("requirement,enabled,review_state").eq("contract_id", c.id),
      s.from("v_test_flows").select("id,name,role,steps,enabled,review_state").eq("contract_id", c.id),
    ]);
    const liveReqs = ((reqs.data ?? []) as { requirement: string; enabled: boolean; review_state?: string }[])
      .filter((r) => r.enabled && ((r.review_state ?? "approved") === "approved"))
      .map((r) => r.requirement);
    const liveFlows = ((flows.data ?? []) as { name: string; role: string | null; steps: unknown; enabled: boolean; review_state?: string }[])
      .filter((f) => f.enabled && ((f.review_state ?? "approved") === "approved"))
      .map((f) => ({ name: f.name, role: f.role, steps: (Array.isArray(f.steps) ? f.steps : []) as never[] }));

    const awaitingReview = ((reqs.data ?? []) as { enabled: boolean; review_state?: string }[])
      .filter((r) => r.enabled && (r.review_state ?? "approved") === "suggested").length;
    const verdict = decideLaunchCoverage({ claim: c.source_prompt, requirements: liveReqs, awaitingReview, flows: liveFlows });
    tally[verdict.gate]++;

    const tag = verdict.gate === "passed" ? "PASS  "
      : verdict.gate === "no_claim" ? "NOCLAIM"
      : verdict.gate === "awaiting_review" ? "REVIEW"
      : "REFUSE";
    console.log(`${tag}  app=${c.application_id.slice(0, 12)} v${c.version}${c.kind === "guarantee" ? " (guarantee)" : ""}  ${c.user_id}`);
    console.log(`         claim: ${(c.source_prompt ?? "(none)").slice(0, 90)}`);
    console.log(`         ${liveReqs.length} requirements, ${liveFlows.length} runnable flows`);
    if (verdict.gate === "refused") {
      for (const m of verdict.missing.slice(0, 6)) console.log(`         - ${m}`);
      if (verdict.missing.length > 6) console.log(`         - and ${verdict.missing.length - 6} more`);
    }
    console.log();
  }

  console.log("─".repeat(70));
  console.log(`would launch: ${tally.passed}    would be REFUSED: ${tally.refused}    awaiting review: ${tally.awaiting_review}    ungated (no claim): ${tally.no_claim}`);
  if (tally.refused) {
    console.log("\nA refusal here is the gate working, not a bug in it. For each one the choice is to fix the");
    console.log("contract so a journey actually proves the claim, or to accept that this contract never could.");
  }
  if (tally.no_claim) {
    console.log("\nUngated contracts have no outcome sentence, so there is no proposition to test them against.");
    console.log("They launch as before. Give them a claim and they become gateable.");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

// THE SHORTCUT, IF YOU NEVER RUN THIS.
//
// This tool answers "which of my contracts would the new gate refuse?" across the whole account. If the
// only one you actually care about is the demo, you do not need credentials or this file at all: open the
// console and press Launch on it once. The gate now sits above every hold, so if the run queues, it passed.
// If it is going to refuse, it refuses there with claim_not_provable and charges nothing.
//
// That is a complete answer for one contract and no answer for the rest, which is the trade.
