// Terminology enforcement for the Phase 4 migration: every user-facing surface speaks "verification"
// and the public verdicts Verified / Failed / Blocked. The retired vocabulary — "Production Pass" as a
// product name and the internal verdict display strings "READY" / "NEEDS REVIEW" / "REPAIR VERIFIED" —
// must never render to a user again. Comments are stripped first (the ~40 stale code comments are
// documentation debt, not copy), then the remaining source is asserted clean outside a small, documented
// allowlist. Static source checks only; no DB, no network.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };
const read = (p: string) => readFileSync(p, "utf8");
const norm = (p: string) => p.replace(/\\/g, "/");

// ── Comment stripping ────────────────────────────────────────────────────────────────────────────────
// A small state machine rather than regexes: it respects string literals (so "https://…" inside copy is
// never mistaken for a comment) and removes both block comments (/* … */, including JSX {/* … */}) and
// line comments (whole-line AND trailing). A `//` only opens a line comment when preceded by
// start-of-line or whitespace, so protocol separators inside rendered text stay intact.
function stripComments(src: string): string {
  let out = "", mode: "code" | "line" | "block" | "'" | '"' | "`" = "code";
  for (let i = 0; i < src.length; i++) {
    const c = src[i], n = src[i + 1], prev = src[i - 1];
    if (mode === "code") {
      if (c === "/" && n === "/" && (i === 0 || prev === "\n" || prev === " " || prev === "\t" || prev === "{" || prev === "(")) { mode = "line"; i++; continue; }
      if (c === "/" && n === "*") { mode = "block"; i++; continue; }
      if (c === "'" || c === '"' || c === "`") mode = c;
      out += c; continue;
    }
    if (mode === "line") { if (c === "\n") { mode = "code"; out += c; } continue; }
    if (mode === "block") { if (c === "*" && n === "/") { mode = "code"; i++; } else if (c === "\n") out += c; continue; }
    // Inside a string literal: copy through, honour escapes, close on the matching quote.
    if (c === "\\") { out += c + (n ?? ""); i++; continue; }
    if (c === mode) mode = "code";
    out += c;
  }
  return out;
}

// ── The ALLOWLIST ────────────────────────────────────────────────────────────────────────────────────
// File-scoped. Each entry names the ONLY form in which retained-internal verdict vocabulary may appear.
// Comment-stripping already exempts the stale code comments — comment-only files never belong here.
// "Production Pass" is NOT an allowed form anywhere: no entry permits it.
const ALLOWLIST: { file: string; allowed: string }[] = [
  { file: "app/api/preflight/apps/[id]/api-runs/[runId]/route.ts",
    allowed: 'retained-internal payload VERDICT map: "READY"/"NEEDS REVIEW"/"REPAIR VERIFIED"/"BLOCKED" as API field VALUES keyed by the internal enum; the display layer translates' },
  { file: "app/api/preflight/apps/[id]/api-runs/list/route.ts",
    allowed: "same retained-internal payload VERDICT map as the [runId] route" },
  { file: "app/rank/app/systems/[id]/api-runtime/api-workspace.tsx",
    allowed: "payload strings appear as translation-map KEYS only (payload verdict -> public verdict / colour); the rendered strings are the public vocabulary" },
  { file: "lib/preflight/oauth/vercel-deploy.ts",
    allowed: 'Vercel deployment-state "READY" (platform vocabulary in the deployments query, not a Vraelis verdict)' },
  { file: "sdk/typescript/",
    allowed: "retired Rank SDK published schema (different product; retirement decision pending) — entire tree exempt" },
];
const isAllowlisted = (p: string) => ALLOWLIST.some((a) =>
  a.file.endsWith("/") ? norm(p).includes(a.file) : norm(p).endsWith(a.file));

// ── The scanned surfaces ─────────────────────────────────────────────────────────────────────────────
// Every .ts/.tsx under app/rank and components (cli/src would be included if it existed), plus the three
// lib files whose message strings reach users (emails, lifecycle notifications, pricing lines).
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(name)) out.push(p);
  }
  return out;
}
const trees = ["app/rank", "components", "cli/src"].filter((d) => existsSync(d));
const surfaces = [...trees.flatMap((d) => walk(d)), "lib/email.ts", "lib/v-lifecycle.ts", "lib/preflight/pass-pricing.ts"];
const stripped = new Map(surfaces.map((p) => [p, stripComments(read(p))]));

// ── A) No user-facing "Production Pass" ──────────────────────────────────────────────────────────────
// No allowlist entry permits the phrase, so the sweep covers allowlisted files too.
{
  const hits = surfaces.filter((p) => /Production Pass/.test(stripped.get(p)!));
  ok('no surface renders "Production Pass" / "Production Passes" (comments stripped)', hits.length === 0, hits.slice(0, 5).map(norm).join(", "));
}

// ── B) No rendered internal verdict labels ───────────────────────────────────────────────────────────
// The internal three-state vocabulary is INTERNAL ONLY (founder framing lock). After comment-stripping,
// the display strings must not appear outside the allowlist. "READY" is scanned as the QUOTED display
// string or a JSX-rendered >READY< — internal lowercase enum keys like `ready:` are fine.
{
  for (const label of ["NEEDS REVIEW", "REPAIR VERIFIED"]) {
    const hits = surfaces.filter((p) => !isAllowlisted(p) && stripped.get(p)!.includes(label));
    ok(`no non-allowlisted surface contains "${label}" (comments stripped)`, hits.length === 0, hits.slice(0, 5).map(norm).join(", "));
  }
  const readyDisplay = /"READY"|'READY'|`READY`|>\s*READY\s*</;
  const hits = surfaces.filter((p) => !isAllowlisted(p) && readyDisplay.test(stripped.get(p)!));
  ok('no non-allowlisted surface renders the display string "READY" (quoted or JSX text)', hits.length === 0, hits.slice(0, 5).map(norm).join(", "));
}

// ── Allowlist files may carry the vocabulary ONLY in their allowed form ──────────────────────────────
{
  // The two api-runs routes: display strings must be map VALUES keyed by the internal enum.
  for (const route of ["app/api/preflight/apps/[id]/api-runs/[runId]/route.ts", "app/api/preflight/apps/[id]/api-runs/list/route.ts"]) {
    const s = stripComments(read(route));
    const keyed = (enumKey: string, label: string) =>
      (s.match(new RegExp(`"${label}"`, "g")) ?? []).length ===
      (s.match(new RegExp(`${enumKey}:\\s*"${label}"`, "g")) ?? []).length;
    ok(`allowlist form: ${norm(route).split("api-runs/")[1]} keeps verdict labels as enum-keyed map values only`,
      keyed("ready", "READY") && keyed("needs_review", "NEEDS REVIEW") && keyed("repair_verified", "REPAIR VERIFIED"));
  }
  // api-workspace.tsx: the payload strings may appear as translation-map KEYS only (each quoted
  // occurrence is immediately followed by a colon).
  const ws = stripComments(read("app/rank/app/systems/[id]/api-runtime/api-workspace.tsx"));
  const keysOnly = (label: string) =>
    (ws.match(new RegExp(`"${label}"`, "g")) ?? []).length === (ws.match(new RegExp(`"${label}"\\s*:`, "g")) ?? []).length;
  ok("allowlist form: api-workspace uses payload strings as translation-map keys only",
    keysOnly("NEEDS REVIEW") && keysOnly("REPAIR VERIFIED") && keysOnly("READY"));
  // vercel-deploy.ts: "READY" only as the Vercel deployments-query state value.
  const vd = stripComments(read("lib/preflight/oauth/vercel-deploy.ts"));
  ok('allowlist form: vercel-deploy uses "READY" only as the Vercel deployment-state query value',
    (vd.match(/"READY"/g) ?? []).length === (vd.match(/state:\s*"READY"/g) ?? []).length);
}

// ── C) Positive gates: the new vocabulary is present where it must be ────────────────────────────────
{
  const pricingV1 = read("app/rank/pricing/pricing-v1.tsx");
  // FOLLOWED THE COPY TO WHERE IT LIVES. This asserted the word appeared in pricing-v1.tsx, and the plan
  // wording now comes from lib/preflight/pass-pricing-format.ts because it was previously duplicated
  // across three surfaces and had already drifted: API access was Scale-only and stated on none of them.
  //
  // The property is that the pricing surface sells verifications, not that a particular file contains the
  // string. So it is satisfied either by the surface's own copy or by the shared source it renders from,
  // and the second half checks it really does render from it rather than having quietly gone quiet.
  const planCopy = read("lib/preflight/pass-pricing-format.ts");
  ok('pricing-v1 sells "verifications"',
    pricingV1.includes("verifications") || planCopy.includes("verifications"));
  ok("pricing-v1 renders the shared plan copy rather than its own", /planCapacity\(p\)/.test(pricingV1));
  ok('pricing-v1 never says "Production Pass"', !pricingV1.includes("Production Pass"));

  // The CI quickstart in the API console: gate on the DECISION ("verified"), never on READY.
  const apiPage = read("app/rank/app/api/page.tsx");
  const curl = apiPage.match(/const CURL = `([\s\S]*?)`;/)?.[1] ?? "";
  ok('API console CURL example exists and gates on "verified"', curl.includes("verified"));
  ok("API console CURL example never gates on READY", curl.length > 0 && !/READY/.test(curl));

  // The public developers page carries the same gate as GATE_YML / GATE_NODE templates.
  const dev = read("app/rank/developers/page.tsx");
  const gateYml = dev.match(/const GATE_YML = `([\s\S]*?)`;/)?.[1] ?? "";
  const gateNode = dev.match(/const GATE_NODE = `([\s\S]*?)`;/)?.[1] ?? "";
  ok("developers GATE_YML template exists and never mentions READY", gateYml.length > 0 && !/READY/.test(gateYml));
  ok('developers GATE_NODE template gates on "verified" and never READY', gateNode.includes('"verified"') && !/READY/.test(gateNode));

  const webhooks = read("app/rank/app/api/webhooks-section.tsx");
  ok('webhooks section announces "verification.completed"', webhooks.includes("verification.completed"));
  ok("webhooks section never says test.completed / run.completed", !/(test|run)\.completed(?!_)/.test(webhooks));

  ok('lib/email.ts has no "Production Pass"', !read("lib/email.ts").includes("Production Pass"));
  ok('lib/v-lifecycle.ts has no "Production Pass"', !read("lib/v-lifecycle.ts").includes("Production Pass"));
  ok('lib/preflight/pass-pricing.ts message strings have no "Production Pass"', !stripComments(read("lib/preflight/pass-pricing.ts")).includes("Production Pass"));
}

console.log(`\n${pass}/${pass + fail} passed  (${surfaces.length} files scanned; cli/src ${existsSync("cli/src") ? "included" : "absent, skipped"})`);
process.exit(fail ? 1 : 0);
