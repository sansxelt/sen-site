// GUARD: every resolver that answers "the production contract" must exclude kind='guarantee'.
//
// v_production_contracts holds two different objects sharing one table and one per-app version sequence:
// the production contract a browser verification runs against, and guarantee contracts. A resolver that
// forgets the kind filter silently answers with whichever is NEWEST, and guarantees are edited far more
// often, so in practice it answers "guarantee" on exactly the accounts that matter.
//
// THE DEFECT THIS EXISTS TO PREVENT. When kind was added the filter landed on getApprovedContract and not
// on getContract immediately above it. The system overview resolves its flow list with getContract and the
// run route validates with getApprovedContract, so the page posted guarantee flow ids to a route that only
// accepts production ones — disjoint sets, a permanent 400 on the primary action of the main screen. It read
// as "One or more selected flows are not enabled and approved", which points at flow state and not at a
// resolver, so it survived. The draft route makes it a write bug too: it forks a new revision from
// getContract's answer, which forks the production lineage off a guarantee contract.
//
// A STATIC CHECK ON PURPOSE. The failure is a missing line in a query builder, and it reproduces only
// against data where a guarantee outranks the production contract by version. Asserting on the source
// catches it on the commit that removes the filter, rather than on the account that happens to have the
// shape. It is deliberately dumb: it does not run a query and needs no database.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const norm = (p: string) => p.replace(/\\/g, "/");

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };

const SRC = join(process.cwd(), "lib", "v-applications.ts");
const src = readFileSync(SRC, "utf8");

/** The body of `export async function NAME(` up to the next top-level `}` line. */
function body(name: string): string | null {
  const start = src.indexOf(`export async function ${name}(`);
  if (start < 0) return null;
  const end = src.indexOf("\n}", start);
  return end < 0 ? null : src.slice(start, end);
}

// The resolvers that mean "the production contract". getContractById is deliberately absent: it takes an
// explicit id, so the caller has already chosen the object and a kind filter there would break guarantee
// lookups by id.
const PRODUCTION_RESOLVERS = ["getContract", "getApprovedContract"];

for (const name of PRODUCTION_RESOLVERS) {
  const b = body(name);
  ok(`${name} exists in lib/v-applications.ts`, b !== null);
  if (!b) continue;
  ok(`${name} filters kind='production'`, /\.eq\(\s*["']kind["']\s*,\s*["']production["']\s*\)/.test(b),
    "a resolver without this returns whichever contract has the highest version, guarantee included");
  // The filter is only safe if a missing column falls back rather than throwing: kind is additive, and on a
  // schema without it the unfiltered read is equivalent because no guarantee can exist yet. A resolver that
  // filters WITHOUT the fallback turns a pre-migration deploy into a hard null (app looks contract-less).
  ok(`${name} falls back when the kind column is absent`, /\.error\)?\s*return|if\s*\(\s*!?\w+\.error/.test(b),
    "additive column: filtering without a fallback breaks a pre-migration schema");
}

// Both resolvers must order by version DESC. "Newest" is the version sequence, not created_at: a draft
// revision authored later can carry a lower version, and ordering by time would make the pair disagree
// again by a different route.
for (const name of PRODUCTION_RESOLVERS) {
  const b = body(name);
  if (!b) continue;
  ok(`${name} orders by version desc`, /order\(\s*["']version["']\s*,\s*\{\s*ascending:\s*false/.test(b));
}

// The overview page and the run route must not drift apart again: the page derives the flow ids it POSTs,
// and the route re-validates them. Assert both still resolve through one of the guarded resolvers, so a
// future edit that inlines a raw query has to come through this file.
const PAGE = join(process.cwd(), "app", "rank", "app", "systems", "[id]", "page.tsx");
const ROUTE = join(process.cwd(), "app", "api", "preflight", "apps", "[id]", "runs", "route.ts");
for (const [label, path, fn] of [["overview page", PAGE, "getContract"], ["run route", ROUTE, "getApprovedContract"]] as const) {
  let text = "";
  try { text = readFileSync(path, "utf8"); } catch { /* reported by the assertion below */ }
  ok(`${label} resolves its contract via ${fn}()`, text.includes(`${fn}(owner, id)`),
    "an inlined v_production_contracts query here bypasses the kind filter entirely");
}

// ── EVERY RAW READ, NOT JUST THE TWO NAMED EXPORTS ───────────────────────────────────────────────────
// The first version of this file asserted on getContract and getApprovedContract by name and nothing else.
// It was therefore green over a THIRD resolver of the same question: buildContextGraph in
// lib/preflight/context-snapshots.ts issued its own v_production_contracts read, ordered by version desc,
// limit 1, with no kind filter — and was wrong in production, reporting Notewell's v9 guarantee contract as
// the system's contract. A guard that names the call sites it knows about cannot catch the one nobody
// remembered to add, so this scans the source instead.
//
// The property: any query that reads v_production_contracts and orders by version DESC is asking "the newest
// contract", and must therefore filter kind. A read that does NOT order by version is fetching a specific
// row (by id) or a list, and is out of scope.
{
  const roots = ["lib", "app", "worker"];
  const files: string[] = [];
  const walkAll = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walkAll(p);
      else if (/\.(ts|tsx)$/.test(p)) files.push(p);
    }
  };
  for (const r of roots) if (existsSync(r)) walkAll(r);

  const offenders: string[] = [];
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    if (!src.includes("v_production_contracts")) continue;
    // Each query chain, from the table name to the call that ends it. Newlines included: these chains are
    // formatted across several lines.
    for (const m of src.matchAll(/from\(\s*["']v_production_contracts["'][\s\S]{0,600}?(?:maybeSingle\(\)|single\(\)|\.limit\(\s*\d+\s*\))/g)) {
      const chain = m[0];
      const ordersByVersionDesc = /order\(\s*["']version["'][\s\S]{0,60}?ascending:\s*false/.test(chain);
      if (!ordersByVersionDesc) continue;                       // not asking "the newest" — out of scope

      // NUMBERING IS NOT RESOLUTION, and this distinction is load-bearing. A query that selects ONLY
      // `version` is computing the next version number, and that sequence is deliberately SHARED across both
      // kinds — Notewell holds v1-v2 production and v3-v9 guarantee in one sequence. Filtering kind there
      // would let a new contract reuse a number an existing one already has. verification-lane.ts:264 is
      // exactly this, and the first draft of this check flagged it: a resolver selects the row to ACT on it
      // (`id`, or `*`), a counter selects only the label.
      const selectList = chain.match(/select\(\s*["']([^"']*)["']/)?.[1] ?? "";
      const resolvesARow = selectList.trim() === "*" || /\bid\b/.test(selectList);
      if (!resolvesARow) continue;
      if (/\.eq\(\s*["']kind["']\s*,\s*["']production["']\s*\)/.test(chain)) continue;   // filtered, fine
      // A base-query builder whose caller adds the filter (the fallback pattern) is legitimate. Detect it by
      // the file containing a kind filter applied to that builder.
      if (/\.eq\(\s*["']kind["']\s*,\s*["']production["']\s*\)/.test(src)) continue;
      const line = src.slice(0, m.index ?? 0).split("\n").length;
      offenders.push(`${norm(f)}:${line}`);
    }
  }
  ok(`no raw "newest v_production_contracts" read is missing the kind filter (${files.length} files scanned)`,
    offenders.length === 0, offenders.join(", "));
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exitCode = fail ? 1 : 0;
