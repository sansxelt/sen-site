// Route-level verification of the attachment-sweep CRON endpoint (Pass 2A Phase 7), env-gated. Drives
// the REAL GET handler through all three auth paths and, with a controlled seed, proves the deployed
// behavior: missing/incorrect Authorization is rejected; correct Bearer sweeps an expired UNBOUND draft
// (row + private bytes) while a BOUND attachment is untouched; a second run is idempotent. It sets its
// own CRON_SECRET in-process, so it needs no real secret. NOTE: it runs the actual sweep, so it also
// garbage-collects any genuinely-expired orphan drafts in the target DB (exactly the nightly job, early).
//   VRAELIS_CRON_VERIFY=1 npx tsx scripts/cron-sweep-route-verify.ts
import crypto from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

if (process.env.VRAELIS_CRON_VERIFY !== "1") { console.error("Refusing to run. Set VRAELIS_CRON_VERIFY=1."); process.exit(2); }
loadEnvConfig(process.cwd());
process.env.CRON_SECRET = `test-${crypto.randomUUID()}`; // in-process; the route reads it per request

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };
const bearer = (t: string) => new Request("https://x/api/cron/attachment-sweep", { headers: { authorization: t } });

async function main() {
  const { GET } = await import("../app/api/cron/attachment-sweep/route");
  const db = await import("../lib/v-attachments-db");
  const st = await import("../lib/v-storage");
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } });
  const owner = "cron-test@vraelis.local";
  const paths: string[] = [];

  async function seed(tag: string, expired: boolean, bindTo?: string) {
    const dk = `cron-${tag}-${crypto.randomUUID()}`;
    const path = `users/crontest/${dk}/${crypto.randomUUID()}`;
    await st.uploadCheckAttachment(path, Buffer.from("hello cron"), "text/plain");
    const row = await db.insertAttachment({ userId: owner, draftKey: dk, role: "candidate_output", versionKey: "A", filename: "f.txt", mime: "text/plain", sizeBytes: 10, storagePath: path, pageCount: null, capabilities: { text: true, vision: false }, orderIndex: 0 });
    paths.push(path);
    if (bindTo) await db.bindDraftToCheck(owner, dk, bindTo);                                   // clears expires_at
    if (expired) await admin.from("v_check_attachments").update({ expires_at: new Date(Date.now() - 86_400_000).toISOString() }).eq("id", row!.id);
    return { id: row!.id, path };
  }
  const exists = async (p: string) => !!(await st.signedCheckUrl(p));

  const realCheckId = crypto.randomUUID();
  try {
    // 1-2. Auth rejection (no mutation).
    ok("missing Authorization -> 401", (await GET(new Request("https://x/api/cron/attachment-sweep"))).status === 401);
    ok("incorrect Authorization -> 401", (await GET(bearer("Bearer wrong-secret"))).status === 401);

    // Seed a real check to bind to (FK), an expired unbound draft, and a bound attachment.
    await admin.from("v_checks").insert({ id: realCheckId, user_id: owner, output_type: "other", result: {}, model: "test", credits_charged: 0 } as never);
    const expired = await seed("exp", true);
    const bound = await seed("bound", true, realCheckId); // expired timestamp but BOUND -> must be kept

    // 4. Correct Bearer -> 200 and it swept at least our expired orphan.
    const res = await GET(bearer(`Bearer ${process.env.CRON_SECRET}`));
    const body = await res.json();
    ok("correct Authorization -> 200", res.status === 200 && body.ok === true);
    ok("swept at least the expired orphan", typeof body.deleted === "number" && body.deleted >= 1, `deleted=${body.deleted}`);

    // 5-8. Effects.
    ok("expired unbound: row deleted", (await db.getAttachment(owner, expired.id)) === null);
    ok("expired unbound: private bytes deleted", !(await exists(expired.path)));
    ok("BOUND attachment: row untouched", (await db.getAttachment(owner, bound.id))?.check_id === realCheckId);
    ok("BOUND attachment: bytes untouched", await exists(bound.path));

    // 9. Idempotent: our rows are already gone, so a second run does not re-report them.
    const before = (await db.getAttachment(owner, expired.id)) === null;
    const res2 = await GET(bearer(`Bearer ${process.env.CRON_SECRET}`));
    ok("second run is 200 + idempotent for our rows", res2.status === 200 && before && (await db.getAttachment(owner, expired.id)) === null);

    // 10. Redacted logging: the handler logs only counts (asserted by inspection of route.ts — no ids/paths).
    ok("response exposes only redacted counts", Object.keys(body).sort().join(",") === "batches,deleted,ok,purge_failures");
  } finally {
    await st.deleteCheckAttachments(paths);
    const { data: rows } = await admin.from("v_check_attachments").select("id").eq("user_id", owner);
    for (const r of (rows ?? []) as { id: string }[]) await db.deleteAttachmentRowsById([r.id]);
    await admin.from("v_checks").delete().eq("user_id", owner);
  }
  console.log(`\n${pass}/${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
