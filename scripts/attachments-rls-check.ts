// Proves the RLS backstop on v_check_attachments: with RLS enabled and no permissive policies, the
// ANON / public key cannot read attachment metadata EVEN WITH NO owner filter, while the service role
// (used by the app) still works. This is the defense-in-depth layer BELOW the app-level owner checks.
//
// Run AFTER applying sql/ai-check-attachments-rls.sql:
//   SUPABASE_ANON_KEY=<project anon key from Supabase dashboard> npx tsx scripts/attachments-rls-check.ts
// Without SUPABASE_ANON_KEY it only checks the service-role baseline and prints how to run the full proof.
import { readFileSync } from "node:fs";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function envLongest(raw: string, name: string): string {
  const all = [...raw.matchAll(new RegExp(`^\\s*${name}\\s*=\\s*(.*)\\s*$`, "gm"))].map((m) => m[1].replace(/^["']|["']$/g, "").trim());
  return all.slice().sort((a, b) => b.length - a.length)[0] || "";
}

async function main() {
  const raw = readFileSync(".env.local", "utf8");
  const url = envLongest(raw, "NEXT_PUBLIC_SUPABASE_URL") || envLongest(raw, "SUPABASE_URL");
  const svc = envLongest(raw, "SUPABASE_SERVICE_ROLE_KEY");
  const anon = process.env.SUPABASE_ANON_KEY || envLongest(raw, "NEXT_PUBLIC_SUPABASE_ANON_KEY") || envLongest(raw, "SUPABASE_ANON_KEY");
  const admin = createClient(url, svc, { auth: { persistSession: false } });

  // Seed a row via the service role (as the app does).
  const id = crypto.randomUUID();
  const owner = "rls-proof@vraelis.local";
  const ins = await admin.from("v_check_attachments").insert({ id, user_id: owner, draft_key: `rls-${id}`, role: "candidate_output", version_key: "v1", order_index: 0, filename: "secret.txt", mime: "text/plain", size_bytes: 4, storage_path: `users/x/${id}` }).select("id").maybeSingle();
  if (ins.error) { console.log("service-role insert failed (is the attachments migration applied?):", ins.error.message); process.exit(1); }
  const svcRead = await admin.from("v_check_attachments").select("id").eq("id", id).maybeSingle();
  console.log("service-role can read its row (baseline):", svcRead.data ? "OK" : "FAIL");

  if (!anon) {
    console.log("\nSUPABASE_ANON_KEY not set -> skipping the anon-deny proof.");
    console.log("Apply sql/ai-check-attachments-rls.sql, then rerun with the project anon key to prove the backstop:");
    console.log("  SUPABASE_ANON_KEY=<anon key> npx tsx scripts/attachments-rls-check.ts");
    await admin.from("v_check_attachments").delete().eq("id", id);
    process.exit(0);
  }

  // The proof: a NORMAL (anon) client, querying WITH NO owner filter, must see zero rows once RLS is on.
  const pub = createClient(url, anon, { auth: { persistSession: false } });
  const noFilter = await pub.from("v_check_attachments").select("*"); // deliberately no user_id filter
  const byId = await pub.from("v_check_attachments").select("*").eq("id", id);
  const leaked = (noFilter.data?.length ?? 0) + (byId.data?.length ?? 0);
  console.log("anon client, no owner filter -> rows visible:", noFilter.data?.length ?? 0, "(want 0)");
  console.log("anon client, by exact id      -> rows visible:", byId.data?.length ?? 0, "(want 0)");
  await admin.from("v_check_attachments").delete().eq("id", id);
  console.log(leaked === 0 ? "\nPASS  RLS backstop holds: the public client leaks nothing even without an owner filter." : "\nFAIL  RLS is NOT protecting the table — apply sql/ai-check-attachments-rls.sql.");
  process.exit(leaked === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
