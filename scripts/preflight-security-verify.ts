// Ownership + internal-tool lockdown test suite. Pure STATIC SOURCE ANALYSIS (no DB, no network): it reads
// the security-relevant source files and asserts the invariants the preflight security model depends on.
//
//   1. OWNERSHIP  — every exported async read/write in the five data-layer files either filters
//                   .eq("user_id" ...) or carries a comment containing "transitive" (the documented
//                   transitive-ownership pattern, e.g. v_run_steps reached only via owner-scoped flow ids).
//   2. ROUTES     — every app/api/preflight/**/route.ts calls auth(); every dynamic ([id]/[runId]) route
//                   calls an ownership-scoped loader, and any mutation appears only AFTER that loader.
//   3. ARTIFACTS  — the artifacts route mints signed URLs ONLY via signedArtifactUrl, TTL <= 300s, and
//                   never touches storage_path in code.
//   4. SSRF       — unsafeHttpsUrlReason gates the runs route, the rerun route, and the smoke script.
//   5. INTERNAL   — seed/rerun drivers hard-require PREFLIGHT_SEED_RUN=1 + check PREFLIGHT_SEED_ALLOW_PROD;
//                   the legacy checker is flag-gated; the worker Docker build context excludes .env files.
//   6. SECRETS    — the worker redaction SECRET_KEY regex covers the sensitive key families, and no file
//                   under worker/preflight passes process.env values into console logging.
//
// Pattern follows scripts/preflight-reconcile-verify.ts: PASS/FAIL counters, exit 1 on any FAIL.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };

const ROOT = process.cwd();
const rel = (p: string) => p.split(path.sep).join("/");
const read = (relPath: string) => readFileSync(path.join(ROOT, relPath), "utf8");

// ── tiny TS-aware scanners (comments + strings + template literals; regex literals are not handled, and
//    none of the scanned files rely on them for these assertions) ─────────────────────────────────────────

// Walk src from `start`, invoking cb only for characters that are real CODE (not inside a comment or a
// string; template-literal ${...} expressions count as code). Stops when cb returns true.
function walkCode(src: string, start: number, end: number, cb: (ch: string, i: number) => boolean | void): void {
  type Frame = { kind: "code"; braces: number } | { kind: "tpl" };
  const stack: Frame[] = [{ kind: "code", braces: 0 }];
  let i = start;
  while (i < end) {
    const ch = src[i], next = src[i + 1];
    const top = stack[stack.length - 1];
    if (top.kind === "tpl") {
      if (ch === "\\") { i += 2; continue; }
      if (ch === "`") { stack.pop(); i++; continue; }
      if (ch === "$" && next === "{") { stack.push({ kind: "code", braces: 0 }); i += 2; continue; }
      i++; continue;
    }
    if (ch === "/" && next === "/") { const nl = src.indexOf("\n", i); i = nl === -1 ? end : nl; continue; }
    if (ch === "/" && next === "*") { const c = src.indexOf("*/", i + 2); i = c === -1 ? end : c + 2; continue; }
    if (ch === "'" || ch === '"') {
      const q = ch; i++;
      while (i < end) { if (src[i] === "\\") i += 2; else if (src[i] === q) { i++; break; } else i++; }
      continue;
    }
    if (ch === "`") { stack.push({ kind: "tpl" }); i++; continue; }
    if (ch === "{") top.braces++;
    if (ch === "}") {
      if (top.braces === 0 && stack.length > 1) { stack.pop(); i++; continue; } // closes a ${...}
      top.braces--;
    }
    if (cb(ch, i)) return;
    i++;
  }
}

// Blank out // and /* */ comments (strings and template literals kept verbatim; newlines preserved).
function stripComments(src: string): string {
  let out = "", i = 0;
  const n = src.length;
  const tpl: number[] = []; // brace depth per open template expression
  let braces = 0;
  while (i < n) {
    const ch = src[i], next = src[i + 1];
    if (tpl.length && tpl[tpl.length - 1] === -1) { // inside template text
      if (ch === "\\") { out += src.slice(i, i + 2); i += 2; continue; }
      if (ch === "`") { tpl.pop(); out += ch; i++; continue; }
      if (ch === "$" && next === "{") { tpl.push(braces); braces = 0; out += "${"; i += 2; continue; }
      out += ch; i++; continue;
    }
    if (ch === "/" && next === "/") { const nl = src.indexOf("\n", i); const stop = nl === -1 ? n : nl; out += " ".repeat(stop - i); i = stop; continue; }
    if (ch === "/" && next === "*") {
      const c = src.indexOf("*/", i + 2); const stop = c === -1 ? n : c + 2;
      out += src.slice(i, stop).replace(/[^\n]/g, " "); i = stop; continue;
    }
    if (ch === "'" || ch === '"') {
      const q = ch; let j = i + 1;
      while (j < n) { if (src[j] === "\\") j += 2; else if (src[j] === q) { j++; break; } else j++; }
      out += src.slice(i, j); i = j; continue;
    }
    if (ch === "`") { tpl.push(-1); out += ch; i++; continue; }
    if (ch === "{") braces++;
    if (ch === "}") {
      // Closes a ${...}: restore the outer brace depth; the enclosing template's -1 marker is still on the stack.
      if (braces === 0 && tpl.length) { braces = tpl.pop() as number; out += ch; i++; continue; }
      braces--;
    }
    out += ch; i++;
  }
  return out;
}

// Every `export async function NAME(...) { body }` in a file, body extracted with brace matching that is
// comment/string/template aware and skips braces inside a generic return type (Promise<{...}>).
function exportedAsyncFunctions(src: string): { name: string; body: string }[] {
  const out: { name: string; body: string }[] = [];
  const re = /export\s+async\s+function\s+([A-Za-z0-9_$]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const name = m[1];
    let depth = 0, sawOpen = false, paramsClose = -1;
    walkCode(src, m.index + m[0].length, src.length, (ch, i) => {
      if (ch === "(") { depth++; sawOpen = true; }
      else if (ch === ")") { depth--; if (sawOpen && depth === 0) { paramsClose = i; return true; } }
    });
    if (paramsClose === -1) continue;
    let angle = 0, bodyOpen = -1;
    walkCode(src, paramsClose + 1, src.length, (ch, i) => {
      if (ch === "<") angle++;
      else if (ch === ">" && src[i - 1] !== "=") angle = Math.max(0, angle - 1);
      else if (ch === "{" && angle === 0) { bodyOpen = i; return true; }
    });
    if (bodyOpen === -1) continue;
    let braces = 0, bodyClose = -1;
    walkCode(src, bodyOpen, src.length, (ch, i) => {
      if (ch === "{") braces++;
      else if (ch === "}") { braces--; if (braces === 0) { bodyClose = i; return true; } }
    });
    if (bodyClose === -1) continue;
    out.push({ name, body: src.slice(bodyOpen + 1, bodyClose) });
  }
  return out;
}

// ══ 1. OWNERSHIP — every exported data-layer read/write is owner-scoped or documented transitive ════════
console.log("── ownership: data-layer functions filter eq(\"user_id\") or are documented transitive ──");
{
  const targets: { file: string; canary: string }[] = [
    { file: "lib/preflight/overview-db.ts", canary: "listAllRuns" },
    { file: "lib/preflight/runs-db.ts", canary: "getRun" },
    { file: "lib/preflight/run-report-db.ts", canary: "getRunInternal" },
    { file: "lib/preflight/discovery-db.ts", canary: "getLatestDiscovery" },
    { file: "lib/v-applications.ts", canary: "getApplication" },
  ];
  for (const t of targets) {
    const fns = exportedAsyncFunctions(read(t.file));
    ok(`${t.file}: parser found exported async functions incl. ${t.canary}`, fns.length > 0 && fns.some((f) => f.name === t.canary), `${fns.length} functions`);
    for (const f of fns) {
      // Real ownership mechanisms, in order of directness: an eq("user_id") filter; an ownsContract()-style
      // owner guard before the write; an INSERT that stamps user_id from the caller (rows are born owned);
      // delegation to another owner-scoped function; or a documented transitive-ownership comment.
      const owned = f.body.includes('eq("user_id"') || f.body.includes("eq('user_id'")
        || /ownsContract\(/.test(f.body)
        || /user_id:\s*(uid|owner|norm\()/.test(f.body)
        || /transitive|owner-scoped/i.test(f.body);
      ok(`${t.file}: ${f.name}() filters eq("user_id") or documents transitive ownership`, owned);
    }
  }
}

// ══ 2. ROUTES — auth() everywhere; ownership loader before any mutation on dynamic routes ═══════════════
console.log("\n── routes: auth() + ownership-scoped loader before any mutation ──");
{
  // The named loaders plus requestRunCancel/getRunArtifactPath, whose eq("user_id") scoping is proven by
  // section 1 (they are the owner-checked entry points of the cancel and artifacts routes).
  const LOADER = /\b(getApplication|getRunInternal|getContractById|contractStatusForRequirement|getRun|getRunArtifactPath|requestRunCancel)\s*\(/;
  const MUTATION = /(\.(insert|update|upsert|delete)\s*\(|\b(createRun|createDiscovery|setParentRun|persistIssues)\s*\()/;

  const routeDir = path.join(ROOT, "app", "api", "preflight");
  const routes: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = path.join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (e === "route.ts") routes.push(rel(path.relative(ROOT, p)));
    }
  };
  walk(routeDir);
  ok("app/api/preflight: route files found", routes.length >= 10, `${routes.length} route files`);

  // The API-beta routes authenticate through the canonical apiBetaOwner() gate (which itself calls auth() +
  // enforces the account allowlist — verified separately below), instead of calling auth() inline. Accept
  // that as a valid authenticated entry point; anything else must still call auth() directly.
  const AUTH_ENTRY = /\bauth\s*\(\s*\)|\bapiBetaOwner\s*\(\s*\)/;
  for (const r of routes.sort()) {
    const raw = read(r);
    const src = stripComments(raw);
    ok(`${r}: authenticates (auth() or the apiBetaOwner gate)`, AUTH_ENTRY.test(src));
    if (!r.includes("[")) continue; // ownership-loader requirement applies to [id]/[runId] routes

    // Skip past imports so an imported symbol name never counts as the "call".
    const bodyStart = (() => { const m = /^import[\s\S]*?from\s+["'][^"']+["'];?\s*$/gm; let last = 0; let mm: RegExpExecArray | null; while ((mm = m.exec(src))) last = mm.index + mm[0].length; return last; })();
    const code = src.slice(bodyStart);
    const loaderIdx = code.search(LOADER);
    const mutIdx = code.search(MUTATION);
    ok(`${r}: dynamic route calls an ownership-scoped loader`, loaderIdx !== -1);
    if (mutIdx !== -1) {
      ok(`${r}: ownership loader precedes the first mutation`, loaderIdx !== -1 && loaderIdx < mutIdx);
    } else {
      ok(`${r}: no direct mutation in route (read/cooperative only)`, true);
    }
  }

  // The API-beta gate that stands in for inline auth() MUST itself authenticate AND enforce BOTH beta
  // conditions, returning null (=> a uniform 404 at the route) when either fails — never a 401/403 that would
  // reveal the private surface exists.
  const gate = stripComments(read("lib/preflight/api-beta-gate.ts"));
  ok("api-beta gate calls auth()", /\bauth\s*\(\s*\)/.test(gate));
  ok("api-beta gate requires the env flag AND the account allowlist", gate.includes("apiRuntimeEnabled") && gate.includes("apiRuntimeBetaAllowed"));
  ok("api-beta gate returns null (=> route 404s) rather than a 401/403 signal", /return null/.test(gate));
}

// ══ 3. ARTIFACTS — signed URLs only via signedArtifactUrl, TTL <= 300, storage_path never surfaces ══════
console.log("\n── artifacts route: short-TTL signed URLs only; storage_path never leaves the server ──");
{
  const routeFile = "app/api/preflight/runs/[runId]/artifacts/[artifactId]/route.ts";
  const src = stripComments(read(routeFile));
  ok(`${routeFile}: mints URLs via signedArtifactUrl()`, /\bsignedArtifactUrl\s*\(/.test(src));
  ok(`${routeFile}: never calls createSignedUrl/getPublicUrl directly`, !/createSignedUrl|getPublicUrl/.test(src));
  ok(`${routeFile}: storage_path never appears in route code`, !src.includes("storage_path"));
  ok(`${routeFile}: ownership check (getRunArtifactPath) precedes URL minting`,
    src.indexOf("getRunArtifactPath(") !== -1 && src.indexOf("getRunArtifactPath(") < src.search(/signedArtifactUrl\s*\(/));

  const ttlArg = src.match(/signedArtifactUrl\(\s*[^,)]+,\s*(\d+)\s*\)/);
  const libSrc = stripComments(read("lib/preflight/artifacts.ts"));
  const defTtl = libSrc.match(/ttlSeconds\s*=\s*(\d+)/);
  const ttl = ttlArg ? Number(ttlArg[1]) : (defTtl ? Number(defTtl[1]) : NaN);
  ok(`${routeFile}: signed URL TTL <= 300s`, Number.isFinite(ttl) && ttl <= 300, `ttl=${ttl}s`);
  ok("lib/preflight/artifacts.ts: signedArtifactUrl default TTL <= 300s", !!defTtl && Number(defTtl[1]) <= 300, defTtl ? `default=${defTtl[1]}s` : "default not found");
}

// ══ 4. SSRF — unsafeHttpsUrlReason gates every deployment-URL entry point ═══════════════════════════════
console.log("\n── ssrf: unsafeHttpsUrlReason called at each navigation entry point ──");
{
  for (const f of [
    "app/api/preflight/apps/[id]/runs/route.ts",
    "app/api/preflight/runs/[runId]/rerun/route.ts",
    "scripts/preflight-smoke-browserbase.ts",
  ]) {
    ok(`${f}: calls unsafeHttpsUrlReason()`, /\bunsafeHttpsUrlReason\s*\(/.test(stripComments(read(f))));
  }
}

// ══ 5. INTERNAL TOOLS — seed drivers, legacy checker, worker image ══════════════════════════════════════
console.log("\n── internal tools: opt-in env gates + prod safeguard + flag gate + docker context hygiene ──");
{
  for (const f of ["scripts/preflight-seed-run.ts", "scripts/preflight-fixture-rerun.ts"]) {
    const src = stripComments(read(f));
    ok(`${f}: refuses unless PREFLIGHT_SEED_RUN === "1"`, /process\.env\.PREFLIGHT_SEED_RUN\s*!==\s*"1"/.test(src));
    ok(`${f}: checks PREFLIGHT_SEED_ALLOW_PROD before touching a production runtime`, /process\.env\.PREFLIGHT_SEED_ALLOW_PROD\s*!==\s*"1"/.test(src));
  }

  const layout = "app/rank/app/legacy/checks/layout.tsx";
  ok(`${layout}: gates on legacyCheckerEnabled()`, /if\s*\(\s*legacyCheckerEnabled\s*\(\s*\)\s*\)/.test(stripComments(read(layout))));

  // The worker Dockerfile builds with the REPO ROOT as its context (railway.toml dockerfilePath +
  // Dockerfile "COPY . ." from the root), so the root .dockerignore is the one that applies.
  ok("worker/preflight/Dockerfile exists", existsSync(path.join(ROOT, "worker/preflight/Dockerfile")));
  const di = path.join(ROOT, ".dockerignore");
  const diExists = existsSync(di);
  ok(".dockerignore exists at the Docker build context root", diExists);
  const lines = diExists ? readFileSync(di, "utf8").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#")) : [];
  const envExcluded = lines.includes(".env*") || (lines.includes(".env") && (lines.includes(".env.*") || lines.includes(".env*")));
  ok(".dockerignore excludes .env AND .env.* from the worker image", envExcluded, lines.filter((l) => l.startsWith(".env")).join(", ") || "no .env lines");
}

// ══ 6. SECRETS — redaction coverage + no process.env values in worker logs ══════════════════════════════
console.log("\n── secrets: redaction regex coverage + no env values logged by the worker ──");
{
  const redactionFile = "worker/preflight/redaction.ts";
  const redSrc = read(redactionFile);
  const m = redSrc.match(/const\s+SECRET_KEY\s*=\s*\/(.+)\/([a-z]*)\s*;/);
  ok(`${redactionFile}: SECRET_KEY regex found`, !!m);
  if (m) {
    const secretKey = new RegExp(m[1], m[2]);
    for (const key of ["authorization", "Authorization", "cookie", "set-cookie", "token", "x-access-token", "secret", "client_secret", "api_key", "api-key", "apikey", "x-api-key", "bearer"]) {
      ok(`${redactionFile}: SECRET_KEY matches "${key}"`, secretKey.test(key));
    }
  }

  // No console.* call in any worker/preflight .ts file may interpolate process.env (span-checked to the
  // call's matching close paren, so multi-line calls are covered too).
  const workerDir = path.join(ROOT, "worker", "preflight");
  const tsFiles: string[] = [];
  const walkTs = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = path.join(dir, e);
      if (statSync(p).isDirectory()) walkTs(p);
      else if (e.endsWith(".ts")) tsFiles.push(rel(path.relative(ROOT, p)));
    }
  };
  walkTs(workerDir);
  ok("worker/preflight: .ts files found", tsFiles.length > 0, `${tsFiles.length} files`);
  for (const f of tsFiles.sort()) {
    const src = stripComments(read(f));
    const re = /console\.(log|error|warn|info|debug)\s*\(/g;
    let bad = false;
    let mm: RegExpExecArray | null;
    while ((mm = re.exec(src))) {
      const open = mm.index + mm[0].length - 1;
      let depth = 0, close = -1;
      walkCode(src, open, src.length, (ch, i) => {
        if (ch === "(") depth++;
        else if (ch === ")") { depth--; if (depth === 0) { close = i; return true; } }
      });
      const span = src.slice(open, close === -1 ? Math.min(src.length, open + 500) : close + 1);
      if (span.includes("process.env")) bad = true;
    }
    ok(`${f}: no console.* call logs process.env values`, !bad);
  }
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
