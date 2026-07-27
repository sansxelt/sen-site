// Mark a verification as INVALIDATED BY A VERIFIER DEFECT.
//
// A verdict Vraelis produced from its own bug is not evidence about the customer's software. It also is not
// deletable and not editable: the decision a customer was shown is a historical fact, and a product whose
// records change retroactively is worth less than one whose records are wrong but honest. So this writes
// only the migration-24 invalidation fields and NEVER touches state, decision, summary or evidence.
//
// Every invalidation is attributable and checkable: who did it, why in a sentence a customer can read, and
// a reference to the defect (a commit SHA or worker version) so the claim can be verified rather than taken
// on trust.
//
// Usage:
//   npx tsx ops/invalidate-run.ts --run <id> [--run <id> ...] --reason "<sentence>" --by <who> --ref <sha>
//   npx tsx ops/invalidate-run.ts --run <id> --undo --by <who>
//   add --apply to write. Without it this is a dry run that shows exactly what would change.
import { getSupabaseAdminClient, isDatabaseConfigured } from "../lib/supabase-admin";

const argv = process.argv.slice(2);
const flag = (name: string): string | null => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : null;
};
const all = (name: string): string[] => {
  const out: string[] = [];
  argv.forEach((a, i) => { if (a === `--${name}` && argv[i + 1] && !argv[i + 1].startsWith("--")) out.push(argv[i + 1]); });
  return out;
};
const has = (name: string) => argv.includes(`--${name}`);

const runIds = all("run");
const reason = flag("reason");
const by = flag("by");
const ref = flag("ref");
const undo = has("undo");
const apply = has("apply");

function die(msg: string): never { console.error(`\n${msg}\n`); process.exit(1); }

if (!runIds.length) die("Name at least one run: --run <id>");
if (!by) die("Say who is doing this: --by <identity>. An anonymous invalidation is not attributable.");
if (!undo) {
  if (!reason) die("Say why, in a sentence a customer can read: --reason \"...\"");
  if (!ref) die("Reference the defect: --ref <commit sha or worker version>. Without it the claim is unverifiable.");
}
if (!isDatabaseConfigured()) die("No database configured. Set the Supabase service-role env vars.");

const db = getSupabaseAdminClient();

async function main() {
  console.log(`\n${apply ? "APPLYING" : "DRY RUN"}  ${undo ? "un-invalidating" : "invalidating"} ${runIds.length} run(s)\n`);

  for (const id of runIds) {
    const { data, error } = await db.from("v_preflight_runs")
      .select("id, application_id, state, decision, created_at, invalidated_at, invalidated_reason")
      .eq("id", id).maybeSingle();
    if (error) { console.log(`  ${id}  READ FAILED: ${error.message}`); continue; }
    const r = data as Record<string, unknown> | null;
    if (!r) { console.log(`  ${id}  not found`); continue; }

    console.log(`  ${id}`);
    console.log(`    state=${r.state} decision=${r.decision ?? "null"} created=${String(r.created_at).slice(0, 10)}`);
    console.log(`    currently ${r.invalidated_at ? `INVALIDATED (${r.invalidated_reason})` : "valid"}`);
    // The verdict is what it is. This only ever changes whether it counts.
    console.log(`    -> ${undo ? "restored to counting" : "invalidated; state and decision unchanged"}`);

    if (!apply) continue;
    const patch = undo
      ? { invalidated_at: null, invalidated_reason: null, invalidated_by: null, invalidated_ref: null }
      : { invalidated_at: new Date().toISOString(), invalidated_reason: reason, invalidated_by: by, invalidated_ref: ref };
    const upd = await db.from("v_preflight_runs").update(patch as never).eq("id", id);
    if (upd.error) {
      if (/invalidated_at/i.test(upd.error.message ?? "")) {
        die("v_preflight_runs.invalidated_at is missing. Apply sql/vraelis-preflight-24-run-invalidation.sql (migration 24) first.");
      }
      console.log(`    WRITE FAILED: ${upd.error.message}`);
    } else {
      console.log(`    written`);
    }
  }

  if (!apply) console.log("\nNothing was written. Re-run with --apply to commit these changes.\n");
  else console.log("\nDone. The verdicts are unchanged; they no longer count toward current state.\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
