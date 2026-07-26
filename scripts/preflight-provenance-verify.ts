// Tests for S7 — connection-aware contract generation with provenance.
// Pure units: the source-tag validator (closed set, unknown -> inference, available-set restriction),
// the deterministic connection-signal suggestions (no AI), synthesis prompt assembly (context kinds ride
// in when present, bounded always), toSuggestions attribution, and the provenance chip labels (every
// machine value maps to a human phrase; no raw enum leaks to the UI).
// Static checks: synthesis stays temp 0 + pinned model + fail-soft, the approval flow is untouched, no AI
// call exists anywhere in the preflight stack outside discover-synthesis, manual adds record "manual".
// No DB, no network, no browser. Run: npx tsx scripts/preflight-provenance-verify.ts
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  PROVENANCE_SOURCES, normalizeProvenanceSource, availableProvenance,
  connectionSignalSuggestions, buildSynthesisPrompt, toSuggestions,
  type SynthContext, type Synthesis,
} from "../lib/preflight/discover-synthesis";
import { planMerge } from "../lib/preflight/contract-merge";
import { contractApprovalReadiness, type ContractRequirement, type ApprovalActor } from "../lib/v-applications";
import { extractSnapshot } from "../lib/preflight/discover-extract";
import { sourceLabel, sourceChipInfo } from "../app/rank/app/applications/[id]/contract/labels";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };

const read = (p: string) => readFileSync(p, "utf8");
// Blank out // and /* */ comments so string checks never match documentation.
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + " ".repeat(m.length - p1.length));
}

// ── The closed set + validator ──
console.log("── source-tag validator ──");
ok("closed set is exactly the ten documented values",
  JSON.stringify([...PROVENANCE_SOURCES].sort()) === JSON.stringify([
    "connection:github", "connection:sentry", "connection:stripe_test", "connection:supabase",
    "inference", "manual", "prd", "prompt", "readme", "summary",
  ].sort()));
ok("every closed-set value except manual round-trips",
  PROVENANCE_SOURCES.filter((s) => s !== "manual").every((s) => normalizeProvenanceSource(s) === s));
ok("manual is never a valid AI attribution -> inference", normalizeProvenanceSource("manual") === "inference");
ok("unknown values -> inference", (["gpt_says_so", "connection:paddle", "", "PROMPT!", "user", "discovery", 42, null, undefined] as unknown[])
  .every((v) => normalizeProvenanceSource(v) === "inference"));
ok("whitespace and case are normalized before matching", normalizeProvenanceSource("  Prompt  ") === "prompt" && normalizeProvenanceSource("CONNECTION:STRIPE_TEST") === "connection:stripe_test");
ok("a tag outside the AVAILABLE inputs degrades to inference (no false provenance claims)",
  normalizeProvenanceSource("connection:stripe_test", ["prompt", "inference"]) === "inference"
  && normalizeProvenanceSource("prompt", ["prompt", "inference"]) === "prompt");
ok("inference always survives the available-set restriction", normalizeProvenanceSource("inference", ["prompt"]) === "inference");

// ── availableProvenance: what a given synthesis may legitimately claim ──
console.log("\n── availableProvenance ──");
{
  const none = availableProvenance(null);
  ok("no inputs -> only inference is available", none.size === 1 && none.has("inference"));
  const ctx: SynthContext = {
    sources: [
      { kind: "summary", content: "A project tracker" }, { kind: "workflows", content: "create, share" },
      { kind: "prd", content: "PRD text" }, { kind: "readme", content: "readme text" },
      { kind: "prompt", content: "the prompt kind rides its own section" },
    ],
    connections: ["stripe_test", "supabase", "sentry", "github", "webhook", "test_account"],
  };
  const all = availableProvenance("build it", ctx);
  ok("prompt + guided fields + documents + supported connections are all available",
    (["prompt", "summary", "prd", "readme", "connection:stripe_test", "connection:supabase", "connection:sentry", "connection:github", "inference"] as const)
      .every((t) => all.has(t)));
  ok("manual is never available to the AI", !all.has("manual"));
  ok("unsupported connection kinds (webhook, test_account) grant no tag",
    ![...all].some((t) => t === ("connection:webhook" as never) || t === ("connection:test_account" as never)));
  ok("guided kinds (goal/roles/data/auth_expect/billing_expect/risks) all justify the summary tag",
    ["goal", "roles", "data", "auth_expect", "billing_expect", "risks"].every((kind) =>
      availableProvenance(null, { sources: [{ kind, content: "x" }], connections: [] }).has("summary")));
  ok("blank content grants nothing",
    !availableProvenance(null, { sources: [{ kind: "summary", content: "   " }], connections: [] }).has("summary"));
}

// ── Deterministic connection-signal suggestions (the no-API-key path) ──
console.log("\n── connection-signal suggestions ──");
{
  const det = connectionSignalSuggestions(["stripe_test", "supabase", "sentry", "github", "vercel"]);
  ok("stripe_test -> a standard billing-flow requirement",
    det.some((s) => s.provenance === "connection:stripe_test" && s.category === "billing" && /test/i.test(s.requirement) && /checkout|billing/i.test(s.requirement)));
  ok("supabase -> a persistence requirement",
    det.some((s) => s.provenance === "connection:supabase" && s.category === "state_integrity" && /persist/i.test(s.requirement)));
  ok("sentry -> a no-unhandled-errors requirement",
    det.some((s) => s.provenance === "connection:sentry" && /without unhandled errors/i.test(s.requirement)));
  ok("github and unknown providers produce nothing (naming context only)",
    det.length === 3 && connectionSignalSuggestions(["github", "vercel", "webhook"]).length === 0);
  ok("absent connections -> no suggestions", connectionSignalSuggestions([]).length === 0);
  ok("every signal is origin-tagged inference, disabled, and review-gated (approval flow unchanged)",
    det.every((s) => s.origin === "inference" && s.enabledDefault === false && s.support === "best_practice"));
  ok("every signal cites its connection as a source ref",
    det.every((s) => s.source_refs.length === 1 && s.source_refs[0].type === "connection"));
  ok("duplicates are deduped and output is deterministic",
    JSON.stringify(connectionSignalSuggestions(["supabase", "stripe_test", "stripe_test"]))
    === JSON.stringify(connectionSignalSuggestions(["stripe_test", "supabase"])));
  ok("no em dash, no middle dot, no emoji in the standard requirement copy",
    det.every((s) => !s.requirement.includes("—") && !s.requirement.includes("·") && !/[\u{1F300}-\u{1FAFF}]/u.test(s.requirement)));

  // The merge plan carries the provenance into the existing columns via planMerge inserts.
  const plan = planMerge([], det, 1);
  ok("planMerge inserts carry source = connection tag and origin = inference",
    plan.inserts.length === 3 && plan.inserts.every((i) => i.origin === "inference" && (i.source || "").startsWith("connection:") && i.review_state === "suggested"));
}

// ── Prompt assembly: context kinds ride in when present, bounded always ──
console.log("\n── prompt assembly ──");
const html = `<!doctype html><html><head><title>TaskBoard</title></head><body><h1>Your projects</h1>
<form method="post" action="/api/projects"><input name="name" type="text"><button>Create project</button></form></body></html>`;
const pages = [extractSnapshot(html, "https://taskboard.example/", 200)];
{
  // The allowed-tag list is the text between "chosen ONLY from:" and the first period.
  const listOf = (p: string) => (p.match(/chosen ONLY from: ([^.]*)\./) || [])[1] || "";
  const bare = buildSynthesisPrompt(pages, "Build a project tracker");
  ok("without context: no PRODUCT CONTEXT or CONNECTED SERVICES section",
    !bare.includes("PRODUCT CONTEXT") && !bare.includes("CONNECTED SERVICES"));
  ok("justified_by instruction always present, offering only inference + prompt here",
    bare.includes("justified_by") && listOf(bare).includes("inference") && listOf(bare).includes("prompt") && !listOf(bare).includes("connection:"));

  const ctx: SynthContext = {
    sources: [
      { kind: "summary", content: "A kanban tool for freelancers" },
      { kind: "auth_expect", content: "Email magic links only" },
      { kind: "billing_expect", content: "Stripe subscriptions, monthly" },
      { kind: "risks", content: "Data loss on refresh" },
      { kind: "prd", content: "The PRD says boards must be shareable" },
    ],
    connections: ["stripe_test", "supabase", "sentry", "github"],
  };
  const full = buildSynthesisPrompt(pages, "Build a project tracker", ctx);
  ok("context kinds appear, labeled with the provenance tag they justify",
    full.includes("SUMMARY (tag: summary):") && full.includes("AUTH_EXPECT (tag: summary):")
    && full.includes("BILLING_EXPECT (tag: summary):") && full.includes("RISKS (tag: summary):")
    && full.includes("PRD (tag: prd):") && full.includes("A kanban tool for freelancers"));
  ok("stripe_test guidance: propose billing-flow requirements", /stripe_test[^\n]*billing-flow/.test(full));
  ok("supabase guidance: persistence/state-integrity", /supabase[^\n]*persistence/.test(full));
  ok("sentry guidance: no unhandled errors", /sentry[^\n]*unhandled errors/.test(full));
  ok("github guidance: naming context ONLY, no requirements from it", /github[^\n]*NAMING context only/.test(full));
  ok("connection tags offered to the model match the connected services",
    listOf(full).includes("connection:stripe_test") && listOf(full).includes("connection:supabase")
    && listOf(full).includes("connection:sentry") && listOf(full).includes("connection:github"));

  const bloated: SynthContext = {
    sources: Array.from({ length: 12 }, (_, i) => ({ kind: ["summary", "goal", "workflows", "data", "risks", "prd"][i % 6], content: "x".repeat(60000) })),
    connections: ["stripe_test", "supabase", "sentry", "github"],
  };
  const big = buildSynthesisPrompt(pages, "p".repeat(50000), bloated);
  ok("prompt stays bounded under adversarial input (12 x 60k sources + 50k prompt)",
    big.length < 40000, `${big.length} chars`);
  ok("the build prompt keeps its existing 6k cap", !big.includes("p".repeat(6001)));
  ok("each context source keeps its own cap", !big.includes("x".repeat(2001)));
}

// ── toSuggestions: server-side attribution ──
console.log("\n── toSuggestions attribution ──");
{
  const synth = {
    product_summary: "", product_type: "", roles: [], capabilities: [], data_entities: [], integrations: [], uncertainties: [], flows: [],
    requirements: [
      { text: "Checkout completes in test mode", category: "billing", severity: "critical", confidence: 0.9, support: "strong_inference", justified_by: "connection:stripe_test", sources: [{ type: "original_prompt", reference: "billing" }] },
      { text: "Projects persist", category: "state_integrity", severity: "critical", confidence: 0.9, support: "explicit", justified_by: "prompt", sources: [{ type: "original_prompt", reference: "persist" }] },
      { text: "Made-up tag", category: "general", severity: "informational", confidence: 0.5, support: "best_practice", justified_by: "vibes", sources: [{ type: "x", reference: "y" }] },
      { text: "No tag at all", category: "general", severity: "informational", confidence: 0.5, support: "best_practice", sources: [{ type: "x", reference: "y" }] },
    ],
  } as unknown as Synthesis;
  const available = new Set(["prompt", "connection:stripe_test", "inference"]);
  const sugs = toSuggestions(synth, available);
  ok("a valid available tag is kept", sugs[0].provenance === "connection:stripe_test" && sugs[1].provenance === "prompt");
  ok("an unrecognized or missing tag -> inference", sugs[2].provenance === "inference" && sugs[3].provenance === "inference");
  ok("a closed-set tag the synthesis had no input for -> inference",
    toSuggestions(synth, new Set(["prompt", "inference"]))[0].provenance === "inference");
}

// ── Chip labels: every machine value maps to a human phrase ──
console.log("\n── provenance chip labels ──");
{
  const legacy = ["build_prompt", "discovery", "user", "seed", "requirements_file"];
  const machineish = (label: string) => label.includes(":") || label.includes("_") || label !== label.trim();
  ok("every closed-set value maps to a label with no raw enum leak",
    PROVENANCE_SOURCES.every((s) => { const l = sourceLabel(s); return l.length > 0 && l !== s && !machineish(l); }));
  ok("every legacy value maps too", legacy.every((s) => { const l = sourceLabel(s); return l.length > 0 && l !== s && !machineish(l); }));
  ok("the exact chips the spec names",
    sourceLabel("prompt") === "From your prompt" && sourceLabel("summary") === "From product summary"
    && sourceLabel("prd") === "From PRD" && sourceLabel("connection:stripe_test") === "From Stripe connection"
    && sourceLabel("inference") === "Vraelis inference" && sourceLabel("manual") === "Added manually");
  ok("a null source reads as a manual add", sourceLabel(null) === "Added manually" && sourceLabel(undefined) === "Added manually");
  ok("an unknown future connection kind stays human", sourceLabel("connection:paddle") === "From connected service");
  ok("source inference -> inferred chip (label already says inference, so no extra qualifier)",
    JSON.stringify(sourceChipInfo("inference", "discovery")) === JSON.stringify({ label: "Vraelis inference", inferred: true, qualifier: null }));
  ok("origin inference (deterministic connection signal) -> inferred chip WITH the qualifier",
    JSON.stringify(sourceChipInfo("connection:stripe_test", "inference")) === JSON.stringify({ label: "From Stripe connection", inferred: true, qualifier: "inferred" }));
  ok("a manual requirement is not inferred",
    sourceChipInfo("manual", "user").inferred === false && sourceChipInfo("prompt", "discovery").inferred === false);
  ok("no em dash, middle dot, or emoji in any label",
    [...PROVENANCE_SOURCES, ...legacy].every((s) => { const l = sourceLabel(s); return !l.includes("—") && !l.includes("·") && !/[\u{1F300}-\u{1FAFF}]/u.test(l); }));
}

// ── Static: synthesis discipline (pinned model, temp 0, fail-soft) ──
console.log("\n── synthesis static ──");
const SYNTH = "lib/preflight/discover-synthesis.ts";
const synthSrc = read(SYNTH);
const synthCode = stripComments(synthSrc);
ok("temperature is 0", synthCode.includes("temperature: 0"));
ok("model is pinned with the evaluator env override", synthCode.includes('process.env.VRAELIS_EVAL_MODEL || "claude-sonnet-4-6"'));
ok("fail-soft: the model call is wrapped and returns null on any error",
  /try \{[\s\S]*?client\.messages\.parse[\s\S]*?\} catch \(e\) \{[\s\S]*?return null; \}/.test(synthCode));
ok("no key -> null before any client is constructed", /if \(!API_KEY \|\| !pages\.length\) return null;/.test(synthCode));
ok("the AI is asked to tag each requirement (justified_by in schema + prompt)",
  synthCode.includes("justified_by: z.string()") && synthCode.includes("justified_by"));

// ── Static: no AI call anywhere in the preflight stack outside discover-synthesis ──
console.log("\n── AI containment static ──");
function tsFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...tsFilesUnder(p));
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}
{
  // Exactly THREE governed AI entry points are permitted:
  //   1. discover-synthesis.ts — the original pinned-model discovery synthesis.
  //   2. agent/agent-client.ts — the governed agent client (flag-gated VRAELIS_AGENT, cost-governor
  //      metered, governor-pause-gated). Every agent goes THROUGH it; nothing else may touch the SDK.
  //   3. coverage-correction.ts — the bounded correction loop (the model PROPOSES a stronger plan; the
  //      deterministic validators DECIDE). Same key/model discipline as synthesis; assertions below.
  const ALLOWED_AI_CLIENTS = ["discover-synthesis.ts", "agent/agent-client.ts", "coverage-correction.ts"];
  const roots = ["lib/preflight", "app/api/preflight", "worker/preflight", "app/rank/app/applications"];
  const offenders: string[] = [];
  for (const root of roots) {
    for (const f of tsFilesUnder(root)) {
      const src = stripComments(read(f));
      const norm = f.replace(/\\/g, "/");
      if ((/new Anthropic\(/.test(src) || src.includes("@anthropic-ai/sdk")) && !ALLOWED_AI_CLIENTS.some((a) => norm.endsWith(a))) offenders.push(f);
    }
  }
  ok("the ONLY AI clients in the preflight stack are discover-synthesis + the governed agent-client", offenders.length === 0, offenders.join(", "));

  // The second allowlisted client is only acceptable BECAUSE it is governed — prove the governance is
  // still present in the file, so the allowlist can never rot into an ungoverned loophole.
  const agentSrc = stripComments(read("lib/preflight/agent/agent-client.ts"));
  ok("agent-client is flag-gated (VRAELIS_AGENT === \"1\", default OFF)", agentSrc.includes('process.env.VRAELIS_AGENT === "1"'));
  ok("agent-client meters every call through the cost governor (recordProviderCost aiTokens)", /recordProviderCost\(\{ owner:[\s\S]*?aiTokens/.test(agentSrc));
  ok("agent-client respects the governor pause before spending", agentSrc.includes("isRunsGovernorPaused()"));
  ok("agent-client never embeds a key literal", !/sk-ant-/.test(agentSrc));

  // The third allowlisted client is the bounded correction loop — acceptable BECAUSE it follows the same
  // pinned/deterministic/fail-soft discipline as synthesis: same lazy key resolution, the evaluator-pinned
  // model, temperature 0 on every call, one bounded attempt per correction (maxRetries: 0), and a missing
  // key or failed call degrades to "no correction" instead of an error. Prove each property in-file so the
  // allowlist can never rot into an ungoverned loophole.
  const corrSrc = stripComments(read("lib/preflight/coverage-correction.ts"));
  const corrParseCalls = (corrSrc.match(/client\.messages\.parse\(/g) ?? []).length;
  ok("coverage-correction pins the model with the evaluator env override",
    corrSrc.includes('process.env.VRAELIS_EVAL_MODEL || "claude-sonnet-4-6"'));
  ok("coverage-correction is deterministic: every model call is temperature 0",
    corrParseCalls > 0 && corrParseCalls === (corrSrc.match(/temperature: 0/g) ?? []).length);
  ok("coverage-correction: no key -> no client, the correction simply does not run",
    /if \(!API_KEY\) return/.test(corrSrc));
  ok("coverage-correction is bounded: one attempt per correction (maxRetries: 0 on every client)",
    (corrSrc.match(/new Anthropic\(/g) ?? []).length === (corrSrc.match(/maxRetries: 0/g) ?? []).length);
  ok("coverage-correction fails soft: a failed model call becomes a typed no-correction result",
    corrSrc.includes('"model_call_failed"') && /catch \(e\) \{[\s\S]*?return null; \}/.test(corrSrc));
  ok("coverage-correction never embeds a key literal", !/sk-ant-/.test(corrSrc));
}

// ── Static: provenance lands in the EXISTING columns; manual adds record manual ──
console.log("\n── persistence static ──");
const discoveryDb = stripComments(read("lib/preflight/discovery-db.ts"));
ok("applyMergePlan writes the validated tag into source (fallback: discovery)",
  discoveryDb.includes('source: ins.source ?? "discovery"'));
ok("applyMergePlan writes origin (inference for connection signals; fallback: discovery)",
  discoveryDb.includes('origin: ins.origin ?? "discovery"'));
ok("merged suggestions are never auto-enabled (enabled comes from the review-gated default)",
  discoveryDb.includes("enabled: synthEnabledByFp[ins.fingerprint] ?? false"));
const vApps = stripComments(read("lib/v-applications.ts"));
ok("hand-added requirements record human authorship and nothing more",
  /addAuthoredRequirement[\s\S]*?source: "manual", origin: "user", review: \{ reviewed: false \}/.test(vApps),
  "a person typing text proves who wrote it, not that they reviewed it as binding");
const mergeSrc = stripComments(read("lib/preflight/contract-merge.ts"));
ok("planMerge threads provenance + origin through inserts",
  mergeSrc.includes("source: sug.provenance") && mergeSrc.includes('origin: sug.origin ?? "discovery"'));

// ── Static: the deterministic no-key path in discover-run ──
console.log("\n── discover-run static ──");
const run = stripComments(read("lib/preflight/discover-run.ts"));
ok("synthesis receives the context (sources + connections)", run.includes("synthesize(snapshot.pages, contract?.source_prompt ?? null, context)"));
ok("attribution is bounded by what was actually available", run.includes("toSuggestions(synth, availableProvenance(contract.source_prompt ?? null, context))"));
ok("keyless path emits the deterministic connection signals", run.includes("connectionSignalSuggestions(providers)"));
ok("keyless path never marks prior AI suggestions stale", run.includes("plan.updates = plan.updates.filter((u) => u.patch.stale !== true)"));

// ── Static: the approval flow is unchanged (users approve before anything runs) ──
console.log("\n── approval flow static ──");
const reqRoute = stripComments(read("app/api/preflight/requirements/route.ts"));
ok("approval still requires the explicit approve action through approveContract",
  reqRoute.includes("body?.approve === true") && /approveContract\(email, contractId,/.test(reqRoute));
ok("the approval names the PERSON who clicked, not the app owner",
  /approveContract\(email, contractId, \{ kind: "human_direct", email: callerEmail \}\)/.test(reqRoute),
  "on a team the owner and the reviewer are routinely different people");
ok("approved contracts stay immutable (409 on every mutation path)",
  (reqRoute.match(/approvedImmutable\(\)/g) ?? []).length >= 3);
// BEHAVIOUR, NOT WORDING. This assertion used to check for one exact statement inside approveContract and
// went red the moment that statement was reworded while remaining correct. The rule now lives in a pure
// function, so the suite can simply run it.
{
  const HUMAN = { kind: "human_direct" as const, email: "reviewer@example.com" };
  const req = (over: Partial<ContractRequirement> = {}): ContractRequirement => ({
    enabled: true, review_state: "approved", review_basis: "human_direct",
    approved_by: "reviewer@example.com", approved_at: "2026-07-25T00:00:00.000Z", ...over,
  } as ContractRequirement);
  const readiness = (reqs: ContractRequirement[], actor: ApprovalActor = HUMAN) => contractApprovalReadiness(reqs, actor);

  ok("approveContract still refuses a contract with zero enabled requirements",
    readiness([]).ok === false
    && readiness([{ ...req({}), enabled: false }]).ok === false);
  ok("a fully reviewed contract is approvable", readiness([req({})]).ok === true);
  ok("an enabled but unreviewed requirement blocks approval",
    readiness([{ ...req({}), review_state: "suggested" }]).ok === false);
  ok("an approved requirement naming no reviewer blocks approval",
    readiness([{ ...req({}), approved_by: null }]).ok === false
    && readiness([{ ...req({}), approved_at: null }]).ok === false
    && readiness([{ ...req({}), review_basis: null }]).ok === false);
  ok("a disabled unreviewed suggestion never blocks approval",
    readiness([req({}), { ...req({}), enabled: false, review_state: "suggested" }]).ok === true);
  ok("a reviewed-plan approval refuses rows approved by someone else",
    readiness([{ ...req({}), review_basis: "reviewed_plan", approved_by: "someone.else@example.com" }],
      { kind: "reviewed_plan", planId: "rvp_1", approvedBy: "reviewer@example.com", approvedAt: "2026-07-25T00:00:00.000Z" }).ok === false);
  ok("a reviewed-plan approval accepts rows carrying that same approval",
    readiness([{ ...req({}), review_basis: "reviewed_plan" }],
      { kind: "reviewed_plan", planId: "rvp_1", approvedBy: "reviewer@example.com", approvedAt: "2026-07-25T00:00:00.000Z" }).ok === true);
}
const editor = read("app/rank/app/applications/[id]/contract/contract-editor.tsx");
ok("the editor's approve button still gates on enabled requirements",
  editor.includes("disabled={busyApprove || enabledCount === 0}"));
// HF3: requirement wording is editable on a DRAFT via the existing PATCH (updateRequirement accepts
// `requirement`). The editor only mounts on a draft and the PATCH route rejects edits to an approved
// contract, so this stays consistent with contract versioning.
ok("the draft editor can edit a requirement's text (saveEdit -> sendPatch with requirement)",
  editor.includes("saveEdit") && /sendPatch\(\{ id: r\.id, requirement:/.test(editor));
ok("the requirement edit reverts optimistically on failure (no silent loss)",
  /patchLocal\(r\.id, \{ requirement: prev \}\)/.test(editor));

// ── Static: the chips render in both contract surfaces, on-design ──
console.log("\n── contract UI static ──");
const page = read("app/rank/app/applications/[id]/contract/page.tsx");
const chip = read("app/rank/app/applications/[id]/contract/provenance-chip.tsx");
ok("approved (read-only) rows render the chip", page.includes("<ProvenanceChip source={r.source} origin={r.origin} />"));
ok("draft editor rows render the chip", editor.includes("<ProvenanceChip source={r.source} origin={r.origin} />"));
ok("inferred chips are visually distinct (muted ink + dashed hairline + qualifier)",
  chip.includes('borderStyle: inferred ? "dashed" : "solid"') && chip.includes("qualifier"));
ok("no em dash, no middle dot, no emoji in the chip or labels modules",
  [chip, read("app/rank/app/applications/[id]/contract/labels.ts")].every((s) => !s.includes("—") && !s.includes("·") && !/[\u{1F300}-\u{1FAFF}]/u.test(s)));

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
