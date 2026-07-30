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
import { readFileSync } from "node:fs";
import { join } from "node:path";

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

console.log(`\n${pass}/${pass + fail} passed`);
process.exitCode = fail ? 1 : 0;
