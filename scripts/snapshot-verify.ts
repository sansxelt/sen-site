// Automated server verification of the immutable evaluation snapshot (Pass 2A §1) against REAL storage
// + DB (no model). Seeds test attachments, builds the snapshot through the production module, asserts
// candidate/context separation + ordering + ownership isolation + MISMATCH detection + empty-candidate +
// missing-object + not-ready + audit hash/summary, then cleans up. Idempotent.
// Run: npx tsx scripts/snapshot-verify.ts
import { readFileSync } from "node:fs";
import crypto from "node:crypto";
function envLongest(raw: string, name: string): string {
  const all = [...raw.matchAll(new RegExp(`^\\s*${name}\\s*=\\s*(.*)\\s*$`, "gm"))].map((m) => m[1].replace(/^["']|["']$/g, "").trim());
  return all.slice().sort((a, b) => b.length - a.length)[0] || "";
}
const raw = readFileSync(".env.local", "utf8");
const url = envLongest(raw, "NEXT_PUBLIC_SUPABASE_URL") || envLongest(raw, "SUPABASE_URL");
process.env.NEXT_PUBLIC_SUPABASE_URL = url; process.env.SUPABASE_URL = url;
process.env.SUPABASE_SERVICE_ROLE_KEY = envLongest(raw, "SUPABASE_SERVICE_ROLE_KEY");

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`${c ? "PASS" : "FAIL"}  ${n}`); if (c) pass++; else fail++; };

async function main() {
  const st = await import("../lib/v-storage");
  const db = await import("../lib/v-attachments-db");
  const snap = await import("../lib/v-attachment-snapshot");
  const owner = "snap-owner@vraelis.local", other = "snap-other@vraelis.local";
  const draftKey = `snap-${crypto.randomUUID()}`;
  const vA = "verA", vB = "verB";
  const seeded: { id: string; path: string }[] = [];

  async function seed(role: "candidate_output" | "supporting_context", versionKey: string | null, filename: string, mime: string, order: number) {
    const path = `users/snaptest/${draftKey}/${crypto.randomUUID()}`;
    await st.uploadCheckAttachment(path, Buffer.from(`bytes-${filename}`), mime);
    const row = await db.insertAttachment({ userId: owner, draftKey, role, versionKey, filename, mime, sizeBytes: 10, storagePath: path, pageCount: null, capabilities: { text: mime.startsWith("text"), vision: mime.startsWith("image") }, orderIndex: order });
    if (!row) throw new Error("seed insert failed (migration applied?)");
    seeded.push({ id: row.id, path });
    return { id: row.id, path };
  }

  try {
    const a2 = await seed("candidate_output", vA, "shot-2.png", "image/png", 1);
    const a1 = await seed("candidate_output", vA, "shot-1.png", "image/png", 0);
    const b1 = await seed("candidate_output", vB, "note.txt", "text/plain", 0);
    const c1 = await seed("supporting_context", null, "brand-guide.txt", "text/plain", 0);
    const expected = [a2.id, a1.id, b1.id, c1.id];
    const versions = [{ versionKey: vA, text: "A text" }, { versionKey: vB, text: "B text" }];

    const r = await snap.buildEvaluationSnapshot(owner, draftKey, versions, "context text", expected);
    ok("snapshot builds", r.ok);
    if (r.ok) {
      const A = r.snapshot.candidates.find((c) => c.versionKey === vA)!;
      const B = r.snapshot.candidates.find((c) => c.versionKey === vB)!;
      ok("candidate A: 2 attachments in persisted order (shot-1 before shot-2)", A.attachments.length === 2 && A.attachments[0].filename === "shot-1.png" && A.attachments[1].filename === "shot-2.png");
      ok("candidate B has ONLY its own file (no blend from A)", B.attachments.length === 1 && B.attachments[0].filename === "note.txt");
      ok("supporting context is separate, not a candidate", r.snapshot.context.attachments.length === 1 && r.snapshot.context.attachments[0].filename === "brand-guide.txt");
      ok("no context attachment leaked into any candidate", r.snapshot.candidates.every((c) => c.attachments.every((a) => a.role === "candidate_output")));
      ok("audit hash is a 64-char sha256", typeof r.snapshot.hash === "string" && r.snapshot.hash.length === 64);
      ok("summary lists all 4 inputs, redacted (no storage_path)", r.snapshot.summary.length === 4 && r.snapshot.summary.every((x) => !("storagePath" in x) && !("storage_path" in x)));
    }

    // THE KEY GATE: a submitted id that doesn't load -> explicit mismatch, not a silent smaller set.
    const mm = await snap.buildEvaluationSnapshot(owner, draftKey, versions, "", [...expected, crypto.randomUUID()]);
    ok("submitted-but-unloadable id -> attachment_mismatch (no silent drop)", !mm.ok && (mm as { error: string }).error === "attachment_mismatch");

    // Cross-owner now DETECTS the mismatch (the ids don't load for another owner) instead of empty.
    const otherR = await snap.buildEvaluationSnapshot(other, draftKey, versions, "", expected);
    ok("cross-owner: expected ids don't load for another owner -> attachment_mismatch", !otherR.ok && (otherR as { error: string }).error === "attachment_mismatch");

    // Empty candidate: a submitted version with neither text nor files.
    const ec = await snap.buildEvaluationSnapshot(owner, draftKey, [...versions, { versionKey: "verEmpty", text: "" }], "", expected);
    ok("empty candidate (no text, no files) rejected", !ec.ok && (ec as { error: string }).error === "empty_candidate");

    // Missing object.
    await st.deleteCheckAttachments([a1.path]);
    const miss = await snap.buildEvaluationSnapshot(owner, draftKey, versions, "", expected);
    ok("missing storage object rejected BEFORE the model", !miss.ok && (miss as { error: string }).error === "attachment_missing_object");
    await st.uploadCheckAttachment(a1.path, Buffer.from("bytes"), "image/png");

    // Not ready.
    await db.setStatus(owner, a1.id, "processing");
    const nr = await snap.buildEvaluationSnapshot(owner, draftKey, versions, "", expected);
    ok("not-ready attachment rejected", !nr.ok && (nr as { error: string }).error === "attachment_not_ready");

    // Legacy text-only (no expectedIds) still builds with zero attachments.
    const legacy = await snap.buildEvaluationSnapshot(owner, draftKey, versions, "");
    ok("legacy text-only builds, zero attachments (backward compatible)", legacy.ok && legacy.snapshot.candidates.every((c) => c.attachments.length === 0));
  } finally {
    for (const s of seeded) await db.deleteAttachmentRow(owner, s.id);
    await st.deleteCheckAttachments(seeded.map((s) => s.path));
    ok("cleanup: no test rows remain", (await db.listByDraft(owner, draftKey)).length === 0);
  }

  console.log(`\n${pass}/${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
