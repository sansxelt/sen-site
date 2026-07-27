// Internal development driver: seed a REAL queued Preflight run for the demo fixture so the local worker +
// Browserbase produce a genuine evidence-backed report — WITHOUT clicking through the product UI.
//
// It seeds CONFIGURATION + APPROVED TEST DEFINITIONS ONLY (application, approved Production Contract,
// approved requirements, approved semantic flows, one queued run). It NEVER seeds flow results, issues,
// screenshots, evidence, decisions, or resolved statuses — every finding must come from the real worker
// claiming the run off the same Postgres queue, driving the same Browserbase provider + artifact uploader,
// and finalizing via the same launch-decision engine. The run is queued via the SAME createRun() the launch
// route uses (state 'queued', dev-free credits_held 0).
//
// Dev/internal only: refuses unless PREFLIGHT_SEED_RUN=1, refuses production unless PREFLIGHT_SEED_ALLOW_PROD=1,
// requires an owner email (never bypasses ownership silently), and verifies the artifact bucket before
// queueing. Prints only safe ids/routes — never an api key, service credential, connectUrl, or signed URL.
//
// Run:  PREFLIGHT_SEED_RUN=1 npm run preflight:seed-run -- --mode=broken --owner=you@example.com
import { loadLocalEnv } from "../worker/preflight/local-env";
import { getSupabaseAdminClient, isDatabaseConfigured } from "../lib/supabase-admin";
import { preflightArtifactBucketExists } from "../lib/preflight/artifacts";
import { createRun } from "../lib/preflight/runs-db";

// Capture the REAL runtime environment BEFORE loading local .env files. The production safeguard must reflect
// the actual process runtime, NOT values that .env.local happens to carry: `vercel env pull` writes VERCEL=1
// and VERCEL_ENV=production into .env.local, and loading that file does not make this local CLI a production
// process. A genuine production runtime already has these set before any code runs, so it is still caught.
const RUNTIME = {
  NODE_ENV: process.env.NODE_ENV,
  VERCEL_ENV: process.env.VERCEL_ENV,
  VERCEL: process.env.VERCEL,
};

loadLocalEnv();

const FIXTURE_BASE = "https://preflight-demo-ten.vercel.app";
const MODES = ["broken", "partially_fixed", "fixed"] as const;
type Mode = (typeof MODES)[number];

function arg(name: string, def?: string): string | undefined {
  const pre = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(pre));
  return hit ? hit.slice(pre.length) : def;
}

// Approved requirements (definitions only).
const REQUIREMENTS = [
  { category: "state_integrity", requirement: "A user can create a project.", order: 1 },
  { category: "state_integrity", requirement: "Created projects persist after refresh.", order: 2 },
  { category: "responsive", requirement: "Mobile navigation must not block the primary action.", order: 3 },
];

// Approved semantic flows for the fixture. Steps use ONLY actions the worker supports; navigation targets
// are RELATIVE ("/") so flows bind to route intent, never to a specific deployment URL: the worker rebases
// them onto each run's snapshot target (lib/preflight/target-url.ts), which carries the ?mode=X params.
// The mobile flow is mobile_relevant so it runs at a narrow viewport (where the nav-overlay defect exists).
function seedFlows() {
  return [
    {
      name: "Create a project", priority: "critical", mobile: false, order: 1,
      goal: "A user can create a project.",
      steps: [
        { action: "navigate", target: "/" },
        { action: "fill", target: "Project name", value: "Vraelis seed project" },
        { action: "click", target: "Create project" },
        { action: "assert_visible", target: "Vraelis seed project", expect: "Vraelis seed project" },
      ],
    },
    {
      name: "Create project and verify it remains after refresh", priority: "critical", mobile: false, order: 2,
      goal: "Created projects persist after refresh.",
      steps: [
        { action: "navigate", target: "/" },
        { action: "fill", target: "Project name", value: "Persisted seed project" },
        { action: "click", target: "Create project" },
        { action: "assert_visible", target: "Persisted seed project", expect: "Persisted seed project" },
        { action: "refresh" },
        { action: "assert_visible", target: "Persisted seed project", expect: "Persisted seed project" },
      ],
    },
    {
      name: "Verify the primary mobile action remains reachable", priority: "critical", mobile: true, order: 3,
      goal: "Mobile navigation must not block the primary action.",
      steps: [
        { action: "navigate", target: "/" },
        { action: "click", target: "Create project" },
        { action: "assert_visible", target: "Vraelis Fixture", expect: "Vraelis Fixture" },
      ],
    },
  ];
}

async function main(): Promise<void> {
  // 1. Dev/internal-only gate.
  if (process.env.PREFLIGHT_SEED_RUN !== "1") {
    console.error("Refusing to run: set PREFLIGHT_SEED_RUN=1 to use the internal seed driver.");
    console.error('  PowerShell:  $env:PREFLIGHT_SEED_RUN="1"; npm run preflight:seed-run -- --mode=broken --owner=you@example.com');
    process.exit(2);
  }
  // Production safeguard, evaluated on the REAL runtime (captured pre-.env-load) so a local process is never
  // falsely flagged as production by a VERCEL_ENV=production value that lives only in .env.local. The error
  // names the exact non-secret condition(s) that triggered the refusal.
  const prodSignals: string[] = [];
  if (RUNTIME.NODE_ENV === "production") prodSignals.push("NODE_ENV=production");
  if (RUNTIME.VERCEL_ENV === "production") prodSignals.push("VERCEL_ENV=production (from the shell/runtime, not .env.local)");
  if (RUNTIME.VERCEL === "1" && RUNTIME.VERCEL_ENV !== "development" && RUNTIME.VERCEL_ENV !== "preview") prodSignals.push("deployed-runtime marker VERCEL=1 (from the shell/runtime)");
  if (prodSignals.length && process.env.PREFLIGHT_SEED_ALLOW_PROD !== "1") {
    console.error(`Refusing to seed: the process runtime looks like production. Triggered by: ${prodSignals.join("; ")}.`);
    console.error("These are read from the shell/OS runtime, NOT from .env.local (a `vercel env pull` puts VERCEL=1 / VERCEL_ENV=production into .env.local, which does not make a local run production).");
    console.error("This is a development driver. To genuinely target a protected production environment, set PREFLIGHT_SEED_ALLOW_PROD=1.");
    process.exit(2);
  }

  // 2. Owner is required — the app + run are owner-scoped so the report is visible only to you. Never silently
  //    bypass ownership.
  const owner = (arg("owner") || process.env.PREFLIGHT_SEED_OWNER || "").trim().toLowerCase();
  if (!owner || !owner.includes("@")) {
    console.error("An owner email is required (the seeded app + run belong to you; the report is owner-scoped).");
    console.error('  Pass --owner=you@example.com  OR set $env:PREFLIGHT_SEED_OWNER="you@example.com"');
    process.exit(2);
  }

  // 3. Mode + fixture URL.
  const mode = (arg("mode", "broken") || "broken") as Mode;
  if (!MODES.includes(mode)) { console.error(`Invalid --mode=${mode}. Use one of: ${MODES.join(" | ")}`); process.exit(2); }
  const url = `${FIXTURE_BASE}/?mode=${mode}`;

  // 4. Preconditions: DB + artifact bucket must exist before we queue anything.
  if (!isDatabaseConfigured()) { console.error("Database not configured (.env.local not loaded / missing SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)."); process.exit(2); }
  if (!(await preflightArtifactBucketExists())) {
    console.error('Artifact bucket "vraelis-preflight-artifacts" is missing. Create it (private) before queueing — see docs/preflight-activation.md.');
    process.exit(2);
  }

  const s = getSupabaseAdminClient();

  // 5. Seed the application (config only).
  const { data: appRow, error: appErr } = await s.from("v_applications").insert({
    user_id: owner, name: `Preflight demo fixture (${mode})`, app_url: url,
    framework: "other", builder: "other", ownership_confirmed: true, status: "connected",
  } as never).select("id").single();
  if (appErr || !appRow) { console.error("Failed to seed application:", appErr?.message); process.exit(1); }
  const applicationId = (appRow as { id: string }).id;

  // 6. Seed an APPROVED Production Contract.
  const { data: cRow, error: cErr } = await s.from("v_production_contracts").insert({
    application_id: applicationId, user_id: owner, version: 1, status: "approved",
    source_prompt: "Seeded by the internal preflight:seed-run driver for the Vraelis Preflight demo fixture.",
    approved_at: new Date().toISOString(),
  } as never).select("id, version").single();
  if (cErr || !cRow) { console.error("Failed to seed contract:", cErr?.message); process.exit(1); }
  const contractId = (cRow as { id: string }).id;
  const contractVersion = (cRow as { version: number }).version;

  // 7. Seed APPROVED requirements (definitions only; no results).
  for (const r of REQUIREMENTS) {
    // FIXTURE PROVENANCE, STATED AS SUCH. This is a script seeding a demo account, so origin is "system"
    // and the reviewer is the seed owner: a fixture that recorded origin "user" would be indistinguishable
    // from a requirement a person actually typed, and fixture rows must never be usable as evidence that a
    // human reviewed anything. The contract is seeded approved, so the rows must name a basis and an
    // approver or migration 20's constraints would reject them, and rightly.
    const { error } = await s.from("v_contract_requirements").insert({
      contract_id: contractId, user_id: owner, category: r.category, requirement: r.requirement,
      severity: "critical", enabled: true, approved: true, source: "seed", origin: "system",
      review_state: "approved", review_basis: "human_direct", approved_by: owner,
      approved_at: new Date().toISOString(), order_index: r.order,
    } as never);
    if (error) { console.error("Failed to seed requirement:", error.message); process.exit(1); }
  }

  // 8. Seed APPROVED semantic flows (definitions only).
  const flowIds: string[] = [];
  for (const f of seedFlows()) {
    const { data: fRow, error } = await s.from("v_test_flows").insert({
      contract_id: contractId, user_id: owner, name: f.name, goal: f.goal, start_path: "/",
      steps: f.steps, priority: f.priority, enabled: true, review_state: "approved", origin: "user",
      mobile_relevant: f.mobile, destructive_allowed: false, max_ms: 120000, order_index: f.order,
    } as never).select("id").single();
    if (error || !fRow) { console.error("Failed to seed flow:", error?.message); process.exit(1); }
    flowIds.push((fRow as { id: string }).id);
  }
  if (flowIds.length !== 3) { console.error(`Expected to seed 3 flows, seeded ${flowIds.length}.`); process.exit(1); }

  // 9. Queue the run via the canonical createRun (state 'queued'; dev-free credits_held 0; no child rows).
  const submissionId = `seed-${mode}-${applicationId.slice(0, 8)}`;
  const created = await createRun(owner, {
    guarantee: null,   // A seeded run is a plain verification; it proves no standing guarantee.
    applicationId, contractId, contractVersion, deploymentUrl: url,
    submissionId, flowIds, creditsHeld: 0, reservationId: null,
  });
  if (!created || "conflict" in created) {
    console.error("Failed to queue run:", created && "conflict" in created ? "submission conflict" : "no eligible flows / insert failed");
    process.exit(1);
  }
  const runId = created.runId;

  // 10. Output SAFE fields only (never api keys, service creds, connectUrl, or signed URLs).
  console.log("\nSeeded a real QUEUED Preflight run (config + approved definitions only; NO results/issues/evidence).");
  console.log(`  mode:            ${mode}`);
  console.log(`  deployment URL:  ${url}`);
  console.log(`  application id:  ${applicationId}`);
  console.log(`  contract id:     ${contractId}  (version ${contractVersion})`);
  console.log(`  run id:          ${runId}  (state: queued, ${created.flowCount} flows)`);
  console.log(`  report route:    https://app.vraelis.com/systems/${applicationId}/passes/${runId}`);
  console.log("\nStart the worker in another terminal if it is not running:  npm run preflight:worker");
  console.log("Then open the report route once the worker finalizes the run.");
  process.exit(0);
}

main().catch((e) => { console.error(`seed-run crashed: ${(e as Error).message}`); process.exit(1); });
