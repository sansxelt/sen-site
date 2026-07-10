// Real check-lifecycle + billing verification (Pass 2A Phase 4K/5H), env-gated. Exercises the SHARED
// runCheck path (start->snapshot->content->evaluateOutput->persist->bind->idempotency) on a dedicated
// test account, asserting EXACT before/after balances. Uses the real model only for the success paths;
// failure cases are real attachment failures (no model call). Cleans up checks, attachments, storage,
// idempotency, and the test ledger. Run: VRAELIS_CHECK_LIFECYCLE_VERIFY=1 npx tsx scripts/check-lifecycle-verify.ts
import crypto from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

if (process.env.VRAELIS_CHECK_LIFECYCLE_VERIFY !== "1") { console.error("Refusing to run. Set VRAELIS_CHECK_LIFECYCLE_VERIFY=1."); process.exit(2); }
loadEnvConfig(process.cwd());
if (!process.env.VRAELIS_EVAL_MODEL) process.env.VRAELIS_EVAL_MODEL = "claude-haiku-4-5";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };

async function main() {
  const cr = await import("../lib/v-credits");
  const checks = await import("../lib/v-checks");
  const st = await import("../lib/v-storage");
  const db = await import("../lib/v-attachments-db");
  const { fixturePdf, fixtureImg } = await import("./fixtures").then((m) => ({ fixturePdf: m.makePdf, fixtureImg: m.screenshotPng }));
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } });
  const owner = "lifecycle-test@vraelis.local";
  const seeded: string[] = []; // storage paths

  async function seed(draftKey: string, versionKey: string | null, role: "candidate_output" | "supporting_context", mime: string, bytes: Buffer, pageCount: number | null = null, purge = false) {
    const path = `users/lifecycletest/${draftKey}/${crypto.randomUUID()}`;
    await st.uploadCheckAttachment(path, bytes, mime);
    const row = await db.insertAttachment({ userId: owner, draftKey, role, versionKey, filename: "f", mime, sizeBytes: bytes.length, storagePath: path, pageCount, capabilities: { text: mime.startsWith("text") || mime === "application/pdf", vision: mime.startsWith("image") || mime === "application/pdf" }, orderIndex: 0 });
    seeded.push(path);
    if (purge) await st.deleteCheckAttachments([path]);
    return row!.id;
  }
  const bal = () => cr.balance(owner);

  try {
    await cr.grant(owner, 10, "test", { extRef: `lifecycle:${crypto.randomUUID()}` });
    const start = await bal();
    ok("test account funded", start >= 6, `balance ${start}`);

    // 1. Legacy text-only -> exactly one charge.
    const b0 = await bal();
    const r1 = await checks.runCheck(owner, { outputType: "support_reply", candidates: [{ text: "Sorry for the trouble; I've flagged it and will follow up in two days." }, { text: "Not my problem." }], source: "app" });
    ok("legacy text-only completes", r1.status === "ok");
    ok("legacy charged exactly once", (await bal()) === b0 - 1, `${b0} -> ${await bal()}`);

    // 2. Successful multimodal -> one charge, result carries capabilities, attachment BOUND, idempotency completed.
    const dk = `lc-${crypto.randomUUID()}`;
    const imgId = await seed(dk, "A", "candidate_output", "image/png", fixtureImg());
    const sub = `sub-${crypto.randomUUID()}`;
    const b1 = await bal();
    const r2 = await checks.runCheck(owner, { outputType: "product_ux", candidates: [{ text: "", versionKey: "A" }], source: "app", draftKey: dk, attachmentIds: [imgId], submissionId: sub });
    ok("multimodal check completes", r2.status === "ok");
    ok("multimodal charged exactly once", (await bal()) === b1 - 1, `${b1} -> ${await bal()}`);
    ok("result carries attachment capabilities", r2.status === "ok" && (r2.check.result?.attachmentCapabilities?.[0]?.capability === "visual"));
    ok("attachment BOUND to the completed check (check_id set)", !!(await db.getAttachment(owner, imgId))?.check_id);

    // 3. Duplicate submission id -> no new charge, returns the same check.
    const b2 = await bal();
    const dup = await checks.runCheck(owner, { outputType: "product_ux", candidates: [{ text: "", versionKey: "A" }], source: "app", draftKey: dk, attachmentIds: [imgId], submissionId: sub });
    ok("duplicate submission returns a check (no re-eval)", dup.status === "ok");
    ok("duplicate submission does NOT charge again", (await bal()) === b2, `${b2} -> ${await bal()}`);

    // 4. Cross-owner / unknown expected id -> mismatch, no charge, no model call.
    const b3 = await bal();
    const mm = await checks.runCheck(owner, { outputType: "product_ux", candidates: [{ text: "x", versionKey: "A" }], source: "app", draftKey: dk, attachmentIds: [crypto.randomUUID()], submissionId: `sub-${crypto.randomUUID()}` });
    ok("mismatched expected id -> invalid, no charge", mm.status === "invalid" && (await bal()) === b3);

    // 5. Missing storage object -> rejected before the model, no charge.
    const dk2 = `lc-${crypto.randomUUID()}`;
    const goneId = await seed(dk2, "A", "candidate_output", "image/png", fixtureImg(), null, true);
    const b4 = await bal();
    const miss = await checks.runCheck(owner, { outputType: "product_ux", candidates: [{ text: "x", versionKey: "A" }], source: "app", draftKey: dk2, attachmentIds: [goneId], submissionId: `sub-${crypto.randomUUID()}` });
    ok("missing object -> invalid, no charge", miss.status === "invalid" && (await bal()) === b4);

    // 6. Oversized request (100-page PDF) -> rejected before the model, no charge.
    const dk3 = `lc-${crypto.randomUUID()}`;
    const bigId = await seed(dk3, "A", "candidate_output", "application/pdf", fixturePdf(), 100);
    const b5 = await bal();
    const big = await checks.runCheck(owner, { outputType: "long_form", candidates: [{ text: "x", versionKey: "A" }], source: "app", draftKey: dk3, attachmentIds: [bigId], submissionId: `sub-${crypto.randomUUID()}` });
    ok("oversized request -> invalid, no charge", big.status === "invalid" && (await bal()) === b5);
  } finally {
    // Cleanup: test checks (cascades attachment rows), storage bytes, idempotency, and the test ledger.
    await st.deleteCheckAttachments(seeded);
    const { data: rows } = await admin.from("v_check_attachments").select("id").eq("user_id", owner);
    for (const r of (rows ?? []) as { id: string }[]) await db.deleteAttachmentRowsById([r.id]);
    await admin.from("v_checks").delete().eq("user_id", owner);
    await admin.from("v_check_idempotency").delete().eq("user_id", owner);
    await admin.from("v_credit_ledger").delete().eq("user_id", owner);
  }
  console.log(`\n${pass}/${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
