// CI guard (task 2A.3): ONLY lib/v-attachments-db.ts may reference the v_check_attachments table. Any
// other application module touching it directly would bypass the centralized, owner-scoped access — and
// since the service role bypasses RLS, that owner check is the actual boundary. Wire this into CI /
// pre-push. Scripts are excluded on purpose: ops/verification tools (e.g. the RLS proof) query the
// table directly by design.
//   Run: npx tsx scripts/check-attachment-access.ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const ALLOW = "lib/v-attachments-db.ts";
const TABLE_REF = /["'`]v_check_attachments["'`]/; // a quoted table name = a query reference (comments won't quote it)
const DIRS = ["app", "lib"];

const offenders: string[] = [];
function walk(dir: string) {
  let entries: string[] = [];
  try { entries = readdirSync(dir); } catch { return; }
  for (const name of entries) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (name !== "node_modules" && name !== ".next") walk(p); continue; }
    if (!/\.(ts|tsx)$/.test(name)) continue;
    const rel = relative(ROOT, p).split(sep).join("/");
    if (rel === ALLOW) continue;
    if (TABLE_REF.test(readFileSync(p, "utf8"))) offenders.push(rel);
  }
}
for (const d of DIRS) walk(join(ROOT, d));

if (offenders.length) {
  console.error("FAIL  v_check_attachments must only be queried via lib/v-attachments-db.ts. Offending files:");
  offenders.forEach((f) => console.error("  - " + f));
  process.exit(1);
}
console.log("PASS  v_check_attachments access is centralized in lib/v-attachments-db.ts.");
