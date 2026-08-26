/**
 * Generate the EXACT rollback for the P4-A/P4-B migration from the verified production schema dump.
 *
 * Why generated rather than hand-written: a blanket `GRANT ALL ON ALL TABLES ... TO anon, authenticated`
 * would re-grant all 107 tables, where production grants 101 - silently re-exposing the six tables someone
 * hardened by hand (analytics_events, vraelis_bookings, vraelis_leads, vraelis_payments, vraelis_workspaces,
 * waitlist). The rollback has to restore what production ACTUALLY had, which is exactly what the dump records.
 *
 * Why not a snapshot table in production: creating one is itself a write to production, and it would have to
 * exist before the migration that it protects. The dump is a verified artifact that already carries the same
 * information, and reading it costs production nothing.
 *
 *   usage:  npx tsx scripts/gen-p4-rollback.ts <dump.sql> [--out ops/p4-remediation-rollback.sql] [--check]
 *
 * --check regenerates and compares against the committed file instead of writing, so drift is detectable.
 */
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const dumpPath = args.find((a) => !a.startsWith("--"));
const outIdx = args.indexOf("--out");
const outPath = outIdx >= 0 ? args[outIdx + 1] : "ops/p4-remediation-rollback.sql";
const checkOnly = args.includes("--check");

if (!dumpPath) {
  console.error("  usage: npx tsx scripts/gen-p4-rollback.ts <dump.sql> [--out <file>] [--check]");
  process.exit(2);
}

// The dump is read RAW as well as normalised. Normalising is fine for scanning single-line GRANT
// statements, but the function body must be reproduced BYTE FOR BYTE: this dump carries 232 carriage
// returns inside function bodies, and stripping them changes prosrc. The staging rehearsal caught exactly
// that - an otherwise perfect rollback left a 13-character shorter body with a different md5.
const dumpRaw = readFileSync(dumpPath, "utf8");
const dump = dumpRaw.replace(/\r\n/g, "\n");
const lines = dump.split("\n");

// The dump's own GRANT statements are the ground truth for the pre-migration ACL state.
const tableGrants = lines.filter((l) => /^GRANT .* ON TABLE public\./.test(l));
const funcGrants = lines.filter((l) => /^GRANT .* ON FUNCTION public\./.test(l));
const schemaGrants = lines.filter((l) => /^GRANT .* ON SCHEMA public TO/.test(l));
const seqGrants = lines.filter((l) => /^GRANT .* ON SEQUENCE public\./.test(l));
// Only the FOR ROLE postgres defaults: the supabase_admin ones were never applied by us and are the
// platform's own, so re-issuing them would be a change rather than a restoration.
const defaults = lines.filter((l) => /^ALTER DEFAULT PRIVILEGES FOR ROLE postgres /.test(l));

// The original v_preflight_claim, taken from the RAW text so every byte survives - carriage returns
// included. A line-joined extraction from the normalised copy silently loses them, and prosrc is what the
// fingerprint hashes, so the loss shows up only after a full forward-and-back cycle.
const fnMatch = dumpRaw.match(/CREATE FUNCTION public\.v_preflight_claim\([\s\S]*?\$\$;/);
if (!fnMatch) { console.error("  FAILED: v_preflight_claim not found in the dump"); process.exit(1); }
const originalFn = fnMatch[0].replace(/^CREATE FUNCTION /, "CREATE OR REPLACE FUNCTION ");
const crIn = (fnMatch[0].match(/\r/g) || []).length;
const crOut = (originalFn.match(/\r/g) || []).length;
if (crIn !== crOut) {
  console.error(`  FAILED: carriage returns lost extracting the function (${crIn} -> ${crOut})`);
  process.exit(1);
}

const funcSignatures = [...new Set(
  funcGrants.map((l) => (l.match(/ON FUNCTION (public\.[A-Za-z0-9_]+\([^)]*\))/) || [])[1]).filter(Boolean),
)];

const anonAuthTableGrants = tableGrants.filter((l) => / TO (anon|authenticated);$/.test(l));
const sixHardened = ["analytics_events", "vraelis_bookings", "vraelis_leads", "vraelis_payments", "vraelis_workspaces", "waitlist"];
const leakedSix = anonAuthTableGrants.filter((l) => sixHardened.some((t) => l.includes(`public.${t} `)));
if (leakedSix.length > 0) {
  console.error(`  FAILED: the dump grants anon/authenticated on a supposedly hardened table:\n    ${leakedSix.join("\n    ")}`);
  process.exit(1);
}

const out = [
  "-- EXACT rollback for the P4-A/P4-B migration.  GENERATED - do not edit by hand.",
  "--   generator: scripts/gen-p4-rollback.ts",
  "--   source:    the verified production public-schema dump",
  "--",
  "-- Restores precisely the ACL state the dump records. It deliberately does NOT use",
  "--   GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;",
  `-- because that would grant all 107 tables where production grants ${tableGrants.filter((l) => / TO anon;$/.test(l)).length},`,
  "-- re-exposing the six tables hardened by hand. Each grant below is reproduced individually.",
  "--",
  `-- table grants: ${tableGrants.length}   function grants: ${funcGrants.length}   schema: ${schemaGrants.length}   sequence: ${seqGrants.length}   defaults: ${defaults.length}`,
  "",
  "BEGIN;",
  "",
  "-- 1. Restore the original v_preflight_claim definition (no pinned search_path, no bounds).",
  originalFn,
  "",
  "-- 2. PostgreSQL grants PUBLIC EXECUTE on functions by default; the dump carries no REVOKE ... FROM",
  "--    PUBLIC, which is how we know production still had it. Restore it explicitly.",
  ...funcSignatures.map((s) => `GRANT EXECUTE ON FUNCTION ${s} TO PUBLIC;`),
  "",
  "-- 3. Undo the GLOBAL default-privilege revoke, restoring PostgreSQL's built-in PUBLIC EXECUTE for",
  "--    functions created by postgres. Without this the rollback leaves future functions hardened, which is",
  "--    a better state but NOT the state the dump records - and a rollback that does not restore is not exact.",
  "ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT EXECUTE ON FUNCTIONS TO PUBLIC;",
  "",
  "-- 4. Function grants, exactly as the dump records them. CREATE OR REPLACE preserves an existing ACL, but",
  "--    the forward migration revoked anon/authenticated, so these must be replayed to restore them.",
  ...funcGrants,
  "",
  "-- 5. Schema-level grants.",
  ...schemaGrants,
  "",
  "-- 6. Table grants, exactly as the dump records them.",
  ...tableGrants,
  "",
  ...(seqGrants.length ? ["-- 7. Sequence grants.", ...seqGrants, ""] : ["-- 7. No sequence grants in the dump (there are no sequences in public).", ""]),
  "-- 8. Schema-scoped default privileges for ROLE postgres.",
  ...defaults,
  "",
  "-- 9. Assert the restoration matches the dump's own counts.",
  "DO $$",
  "DECLARE anon_t int; auth_t int; pub_f int; anon_f int;",
  "BEGIN",
  "  SELECT count(DISTINCT c.oid) INTO anon_t FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace",
  "    CROSS JOIN LATERAL aclexplode(c.relacl) a JOIN pg_roles r ON r.oid=a.grantee",
  "   WHERE n.nspname='public' AND r.rolname='anon' AND c.relkind IN ('r','p');",
  "  SELECT count(DISTINCT c.oid) INTO auth_t FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace",
  "    CROSS JOIN LATERAL aclexplode(c.relacl) a JOIN pg_roles r ON r.oid=a.grantee",
  "   WHERE n.nspname='public' AND r.rolname='authenticated' AND c.relkind IN ('r','p');",
  "  SELECT count(DISTINCT p.oid) INTO pub_f FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace",
  "    CROSS JOIN LATERAL aclexplode(p.proacl) a WHERE n.nspname='public' AND a.grantee = 0;",
  "  SELECT count(DISTINCT p.oid) INTO anon_f FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace",
  "    CROSS JOIN LATERAL aclexplode(p.proacl) a JOIN pg_roles r ON r.oid=a.grantee",
  "   WHERE n.nspname='public' AND r.rolname='anon';",
  `  IF anon_t <> ${tableGrants.filter((l) => / TO anon;$/.test(l)).length} OR auth_t <> ${tableGrants.filter((l) => / TO authenticated;$/.test(l)).length} OR pub_f <> ${funcSignatures.length} OR anon_f <> ${funcSignatures.length} THEN`,
  `    RAISE EXCEPTION 'rollback did not restore the dump state: anon % tables, authenticated % tables, PUBLIC % functions (expected ${tableGrants.filter((l) => / TO anon;$/.test(l)).length}, ${tableGrants.filter((l) => / TO authenticated;$/.test(l)).length}, ${funcSignatures.length})', anon_t, auth_t, pub_f;`,
  "  END IF;",
  "  IF EXISTS (SELECT 1 FROM pg_default_acl da JOIN pg_roles r ON r.oid=da.defaclrole",
  "              WHERE da.defaclnamespace = 0 AND da.defaclobjtype = 'f' AND r.rolname = 'postgres') THEN",
  "    RAISE EXCEPTION 'the GLOBAL default-privilege row for functions still exists - PUBLIC EXECUTE was not restored';",
  "  END IF;",
  "  RAISE NOTICE 'rollback ok: anon % tables, authenticated % tables, PUBLIC % functions, anon % functions', anon_t, auth_t, pub_f, anon_f;",
  "END $$;",
  "",
  "COMMIT;",
  "",
].join("\n");

if (checkOnly) {
  const existing = readFileSync(outPath, "utf8").replace(/\r\n/g, "\n");
  if (existing === out) { console.log(`  [ok] ${outPath} matches what the dump generates`); process.exit(0); }
  console.error(`  DRIFT: ${outPath} differs from what the dump generates. Regenerate it.`);
  process.exit(1);
}

writeFileSync(outPath, out, "utf8");
console.log(`  wrote ${outPath}`);
console.log(`    table grants     ${tableGrants.length}  (anon ${tableGrants.filter((l) => / TO anon;$/.test(l)).length}, authenticated ${tableGrants.filter((l) => / TO authenticated;$/.test(l)).length}, service_role ${tableGrants.filter((l) => / TO service_role;$/.test(l)).length})`);
console.log(`    function grants  ${funcGrants.length}  over ${funcSignatures.length} signatures`);
console.log(`    schema grants    ${schemaGrants.length}`);
console.log(`    default privs    ${defaults.length}  (FOR ROLE postgres only)`);
console.log(`    six hardened tables carry no anon/authenticated grant in the dump: confirmed`);
