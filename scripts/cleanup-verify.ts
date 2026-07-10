// Automated server verification of orphan cleanup + check-deletion (Pass 2A Phase 7) against REAL
// storage + DB. Proves: expired unbound drafts are swept (rows + bytes), bound attachments are kept,
// non-expired drafts are kept, missing-object rows delete safely, the sweep is idempotent, and check
// deletion removes the actual storage bytes. Idempotent. Run: npx tsx scripts/cleanup-verify.ts
import { readFileSync } from "node:fs";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
function envLongest(raw: string, name: string): string {
  const all = [...raw.matchAll(new RegExp(`^\\s*${name}\\s*=\\s*(.*)\\s*$`, "gm"))].map((m) => m[1].replace(/^["']|["']$/g, "").trim());
  return all.slice().sort((a, b) => b.length - a.length)[0] || "";
}
const raw = readFileSync(".env.local", "utf8");
const url = envLongest(raw, "NEXT_PUBLIC_SUPABASE_URL") || envLongest(raw, "SUPABASE_URL");
const svc = envLongest(raw, "SUPABASE_SERVICE_ROLE_KEY");
process.env.NEXT_PUBLIC_SUPABASE_URL = url; process.env.SUPABASE_URL = url; process.env.SUPABASE_SERVICE_ROLE_KEY = svc;

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`${c ? "PASS" : "FAIL"}  ${n}`); if (c) pass++; else fail++; };

async function main() {
  const st = await import("../lib/v-storage");
  const db = await import("../lib/v-attachments-db");
  const admin = createClient(url, svc, { auth: { persistSession: false } });
  const owner = "cleanup@vraelis.local";
  const tag = `clean-${crypto.randomUUID()}`;
  const paths: string[] = [];

  async function seed(draftKey: string, past: boolean, bind?: string, purgeBytes = false) {
    const path = `users/cleanuptest/${tag}/${crypto.randomUUID()}`;
    await st.uploadCheckAttachment(path, Buffer.from("bytes"), "text/plain");
    const row = await db.insertAttachment({ userId: owner, draftKey, role: "candidate_output", versionKey: "A", filename: "f.txt", mime: "text/plain", sizeBytes: 5, storagePath: path, pageCount: null, capabilities: { text: true, vision: false }, orderIndex: 0 });
    if (!row) throw new Error("seed failed");
    if (bind) await db.bindDraftToCheck(owner, draftKey, bind); // clears expires_at
    if (past) await admin.from("v_check_attachments").update({ expires_at: new Date(Date.now() - 86400000).toISOString() }).eq("id", row.id);
    if (purgeBytes) await st.deleteCheckAttachments([path]); // simulate a missing object under an existing row
    paths.push(path);
    return { id: row.id, path };
  }

  const exists = async (p: string) => st.checkObjectExists(p);
  try {
    const realCheckId = crypto.randomUUID();
    await admin.from("v_checks").insert({ id: realCheckId, user_id: owner, output_type: "other", result: {}, model: "test", credits_charged: 0 }); // real check to bind to (FK)
    const expired = await seed(`${tag}-exp`, true);                 // expired, unbound  -> swept
    const bound = await seed(`${tag}-bound`, true, realCheckId);    // bound to a real check -> kept
    const fresh = await seed(`${tag}-fresh`, false);                // not expired       -> kept
    const gone = await seed(`${tag}-gone`, true, undefined, true);  // expired, bytes already missing -> row still swept

    // Sweep (mirrors the cron: find expired -> purge bytes -> delete rows).
    let swept = 0;
    for (let i = 0; i < 5; i++) {
      const rows = (await db.findExpiredDrafts(200)).filter((r) => r.storage_path.includes(tag)); // scope to this test's data
      if (!rows.length) break;
      await st.deleteCheckAttachments(rows.map((r) => r.storage_path));
      swept += await db.deleteAttachmentRowsById(rows.map((r) => r.id));
    }
    ok("swept the expired unbound rows (>=2: expired + missing-object)", swept >= 2);
    ok("expired unbound: row gone", (await db.getAttachment(owner, expired.id)) === null);
    ok("expired unbound: bytes gone", !(await exists(expired.path)));
    ok("missing-object row swept safely (no crash)", (await db.getAttachment(owner, gone.id)) === null);
    ok("BOUND attachment kept (row + bytes)", (await db.getAttachment(owner, bound.id))?.id === bound.id && (await exists(bound.path)));
    ok("non-expired draft kept (row + bytes)", (await db.getAttachment(owner, fresh.id))?.id === fresh.id && (await exists(fresh.path)));
    ok("sweep idempotent: a second find returns none of this test's rows", (await db.findExpiredDrafts(200)).filter((r) => r.storage_path.includes(tag)).length === 0);

    // Check deletion: paths fetched, bytes purged, then the check-row cascade would drop metadata.
    const boundCheckId = (await db.getAttachment(owner, bound.id))?.check_id as string;
    const delPaths = await db.attachmentPathsForCheck(owner, boundCheckId);
    ok("attachmentPathsForCheck returns the bound path", delPaths.includes(bound.path));
    await st.deleteCheckAttachments(delPaths);
    ok("check deletion removes the actual storage bytes", !(await exists(bound.path)));
  } finally {
    // Clean up anything this test left (rows by tag + bytes).
    const { data } = await admin.from("v_check_attachments").select("id, storage_path").eq("user_id", owner);
    const mine = ((data ?? []) as { id: string; storage_path: string }[]).filter((r) => r.storage_path.includes(tag));
    if (mine.length) { await st.deleteCheckAttachments(mine.map((r) => r.storage_path)); await db.deleteAttachmentRowsById(mine.map((r) => r.id)); }
    await st.deleteCheckAttachments(paths);
    await admin.from("v_checks").delete().eq("user_id", owner).eq("model", "test"); // remove the test check row (cascades any rows)
  }
  console.log(`\n${pass}/${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
