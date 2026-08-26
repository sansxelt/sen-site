// Safety verification for a schema-only dump, before it goes anywhere.
//
// Needs NO password and touches NO database. It reads one file and answers, in order:
//
//   1. is the file where it should be — outside the repository?
//   2. does it contain ROW DATA?                     (COPY / INSERT — must be zero)
//   3. did any other schema leak in?                 (auth / storage / vault / pgsodium / realtime)
//   4. does it name Auth users, storage objects, or Vault rows?
//   5. does it carry a SECRET-SHAPED LITERAL?        (schema-only still allows one in a DEFAULT,
//                                                     a function body, or a policy expression)
//   6. what is actually in it?                       (tables, policies, RLS, grants)
//   7. is the working tree still clean?
//
// ── FLAGGED LINES ARE REDACTED ─────────────────────────────────────────────────────────────────────────
// When check 5 hits, the matched value is NEVER printed. You get the line number, the table/function it
// sits in where derivable, and the KIND of pattern — never the secret. Printing "the secret we found" into
// a report is how a leak becomes two leaks.
//
// Usage:  npx tsx scripts/verify-schema-dump.ts /path/to/prod-public-schema.sql
// Exit:   0 = safe to proceed   1 = a stop condition was hit   2 = could not read the file
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`  ${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };

const file = process.argv[2];
if (!file) { console.error("usage: verify-schema-dump.ts <dump.sql>"); process.exit(2); }
if (!existsSync(file)) { console.error(`ERROR  no such file: ${file}`); process.exit(2); }

const abs = resolve(file);
const repoRoot = resolve(".");
const text = readFileSync(abs, "utf8");
const lines = text.split("\n");

console.log("\n  ══ SCHEMA DUMP VERIFICATION ══════════════════════════════════════════");
console.log(`  file      ${abs}`);
console.log(`  present   ${existsSync(abs) ? "yes" : "no"}`);
console.log(`  lines     ${lines.length}`);
console.log("  ══════════════════════════════════════════════════════════════════════\n");

// ── 1. Outside the repository ──────────────────────────────────────────────
console.log("  ── location ──");
{
  const inside = abs.startsWith(repoRoot + "\\") || abs.startsWith(repoRoot + "/");
  ok("the dump is OUTSIDE the repository", !inside, inside ? `it is inside ${repoRoot}` : "");
  const mode = (statSync(abs).mode & 0o777).toString(8);
  // Windows does not honour POSIX modes; report rather than assert so this does not fail spuriously.
  console.log(`        file mode reported as 0${mode}${process.platform === "win32" ? "  (Windows: POSIX modes are not enforced; umask 077 still applies on POSIX hosts)" : ""}`);
}

// ── 2. NO ROW DATA. The one that matters most. ─────────────────────────────
console.log("\n  ── row data ──");
{
  const copyLines = lines.map((l, i) => ({ l, n: i + 1 })).filter((x) => /^COPY\s/i.test(x.l));
  const insertLines = lines.map((l, i) => ({ l, n: i + 1 })).filter((x) => /^INSERT\s+INTO\s/i.test(x.l));
  ok("ZERO COPY statements", copyLines.length === 0, `${copyLines.length}`);
  ok("ZERO INSERT statements", insertLines.length === 0, `${insertLines.length}`);
  // A stdin data block would follow a COPY; check for its terminator too, independently.
  const terminators = lines.filter((l) => l.trim() === "\\.").length;
  ok("no COPY-from-stdin data terminators", terminators === 0, `${terminators}`);
  for (const c of [...copyLines, ...insertLines].slice(0, 5)) {
    console.log(`        line ${c.n}: ${c.l.slice(0, 60)}...`);
  }
}

// ── 3. Only the public schema ──────────────────────────────────────────────
console.log("\n  ── schema scope ──");
{
  const FORBIDDEN = ["auth", "storage", "vault", "pgsodium", "supabase_functions", "realtime", "graphql"];

  // Match the DDL's TARGET — the object being created or altered — not merely any occurrence of the
  // schema name on the line.
  //
  // Scanning the whole line flagged `CREATE POLICY x ON public.y USING (auth.uid() = ...)`, which is the
  // single most common pattern in Supabase RLS. Every real dump carries dozens, so the check would have
  // screamed on a perfectly good file and taught whoever ran it to ignore the output. A check that cries
  // wolf on the normal case is worse than no check.
  const TARGET_PATTERNS: RegExp[] = [
    /^CREATE\s+(?:OR\s+REPLACE\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z0-9_."]+)/i,
    /^CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?\S+\s+ON\s+(?:ONLY\s+)?([a-z0-9_."]+)/i,
    /^CREATE\s+POLICY\s+\S+\s+ON\s+([a-z0-9_."]+)/i,
    /^CREATE\s+(?:CONSTRAINT\s+)?TRIGGER\s+\S+[\s\S]*?\sON\s+([a-z0-9_."]+)/i,
    /^CREATE\s+(?:OR\s+REPLACE\s+)?(?:FUNCTION|VIEW|MATERIALIZED\s+VIEW|SEQUENCE|TYPE|DOMAIN)\s+([a-z0-9_."]+)/i,
    /^ALTER\s+(?:TABLE|SEQUENCE|VIEW|FUNCTION|TYPE)\s+(?:ONLY\s+)?(?:IF\s+EXISTS\s+)?([a-z0-9_."]+)/i,
    /^COPY\s+([a-z0-9_."]+)/i,
    /^INSERT\s+INTO\s+([a-z0-9_."]+)/i,
    /^DROP\s+\w+\s+(?:IF\s+EXISTS\s+)?([a-z0-9_."]+)/i,
    /^GRANT\s+[\s\S]*?\sON\s+(?:TABLE\s+|SEQUENCE\s+|FUNCTION\s+|SCHEMA\s+)?([a-z0-9_."]+)/i,
    /^REVOKE\s+[\s\S]*?\sON\s+(?:TABLE\s+|SEQUENCE\s+|FUNCTION\s+|SCHEMA\s+)?([a-z0-9_."]+)/i,
  ];

  const hits: { n: number; schema: string; target: string }[] = [];
  lines.forEach((l, i) => {
    const t = l.trim();
    if (!t || t.startsWith("--")) return;
    for (const re of TARGET_PATTERNS) {
      const m = t.match(re);
      if (!m) continue;
      const target = m[1].replace(/"/g, "").toLowerCase();
      const schema = target.includes(".") ? target.split(".")[0] : "public";
      if (FORBIDDEN.includes(schema)) hits.push({ n: i + 1, schema, target });
      break; // first matching shape wins; a line has one target
    }
  });
  ok("no DDL targets a non-public schema", hits.length === 0,
    hits.length ? hits.slice(0, 5).map((h) => `${h.target}@${h.n}`).join(", ") : "");

  // References inside function bodies / policy expressions are NOT the same as creating objects there —
  // `auth.uid()` in a policy is normal and expected. Reported separately so the two are not conflated.
  const refs = lines.map((l, i) => ({ l, n: i + 1 }))
    .filter((x) => /\b(auth|storage|vault)\.[a-z_]+/i.test(x.l) && !/^(CREATE|ALTER|COPY|INSERT|DROP)\b/i.test(x.l.trim()));
  console.log(`        ${refs.length} reference(s) to auth./storage./vault. inside bodies or expressions`);
  console.log("        (auth.uid() in an RLS policy is normal — these are references, not object creation)");
}

// ── 4. Named user / object / secret tables ─────────────────────────────────
console.log("\n  ── Auth users, storage objects, Vault rows ──");
{
  const NAMED = /\b(auth\.users|auth\.identities|auth\.sessions|auth\.refresh_tokens|storage\.objects|storage\.buckets|vault\.secrets|vault\.decrypted_secrets)\b/i;
  const hits = lines.map((l, i) => ({ l, n: i + 1 })).filter((x) => NAMED.test(x.l) && /^(CREATE|ALTER|COPY|INSERT)\b/i.test(x.l.trim()));
  ok("no Auth/storage/Vault objects are created or populated", hits.length === 0,
    hits.length ? hits.slice(0, 3).map((h) => `line ${h.n}`).join(", ") : "");
}

// ── 5. Secret-shaped literals — REDACTED when found ────────────────────────
console.log("\n  ── secret-shaped literals ──");
{
  const PATTERNS: { name: string; re: RegExp }[] = [
    { name: "Stripe live secret key", re: /sk_live_[A-Za-z0-9]{10,}/ },
    { name: "Stripe live publishable key", re: /pk_live_[A-Za-z0-9]{10,}/ },
    { name: "Stripe webhook signing secret", re: /whsec_[A-Za-z0-9]{10,}/ },
    { name: "JWT / Supabase key", re: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/ },
    { name: "PEM private key block", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
    { name: "AWS access key id", re: /AKIA[0-9A-Z]{16}/ },
    { name: "Slack token", re: /xox[baprs]-[A-Za-z0-9-]{10,}/ },
    { name: "SendGrid key", re: /SG\.[A-Za-z0-9_-]{16,}/ },
    { name: "Google API key", re: /AIza[0-9A-Za-z_-]{30,}/ },
  ];
  const flagged: { n: number; kind: string; context: string }[] = [];
  lines.forEach((l, i) => {
    for (const p of PATTERNS) {
      if (p.re.test(l)) {
        // Derive a little context WITHOUT reproducing the value: the nearest preceding CREATE, if any.
        let context = "(no enclosing object found)";
        for (let j = i; j >= 0 && j > i - 200; j -= 1) {
          const m = lines[j].match(/^CREATE\s+(?:OR REPLACE\s+)?(TABLE|FUNCTION|POLICY|VIEW|TRIGGER)\s+([^\s(]+)/i);
          if (m) { context = `${m[1].toLowerCase()} ${m[2]}`; break; }
        }
        flagged.push({ n: i + 1, kind: p.name, context });
      }
    }
  });
  ok("no secret-shaped literal in the dump", flagged.length === 0, `${flagged.length} flagged`);
  for (const f of flagged) {
    // The VALUE is never printed. Line, kind, and enclosing object only.
    console.log(`        line ${f.n}  [${f.kind}]  in ${f.context}  — value REDACTED, not reproduced here`);
  }
  if (flagged.length) {
    console.log("\n        Review these BY HAND, in the file, on a trusted machine. If any is a real");
    console.log("        credential: STOP. Remove it from production's schema first — a hardcoded key in");
    console.log("        a function body is a finding in its own right, and copying it duplicates it.");
  }
}

// ── 6. What IS in it ───────────────────────────────────────────────────────
console.log("\n  ── contents ──");
{
  const count = (re: RegExp) => lines.filter((l) => re.test(l)).length;
  const tables = count(/^CREATE TABLE /i);
  const policies = count(/^CREATE POLICY /i);
  const rls = count(/ENABLE ROW LEVEL SECURITY/i);
  const grants = count(/^GRANT /i);
  const funcs = count(/^CREATE (OR REPLACE )?FUNCTION /i);
  console.log(`        tables            ${tables}`);
  console.log(`        policies          ${policies}`);
  console.log(`        ENABLE RLS        ${rls}`);
  console.log(`        GRANT statements  ${grants}`);
  console.log(`        functions         ${funcs}`);
  ok("the dump is not empty", tables > 0, `${tables} tables`);
  ok("GRANTs were preserved (needed for the reconciliation to be meaningful)", grants > 0, `${grants}`);
}

// ── 7. The working tree is untouched ───────────────────────────────────────
console.log("\n  ── repository ──");
{
  let dirty = "?";
  try { dirty = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(); } catch { /* not a repo */ }
  ok("git status is clean", dirty === "", dirty ? dirty.split("\n").slice(0, 3).join(" | ") : "");
  const tracked = abs.startsWith(repoRoot + "\\") || abs.startsWith(repoRoot + "/");
  ok("the dump is not inside the repository", !tracked);
}

console.log(`\n  ${pass} passed, ${fail} failed`);
console.log(fail === 0
  ? "  VERDICT: the dump is schema-only and safe to proceed to Step 3 — on separate approval.\n"
  : "  VERDICT: STOP. A stop condition was hit; do not restore this to staging.\n");
process.exit(fail === 0 ? 0 : 1);
