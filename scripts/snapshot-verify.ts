// Automated server verification of the immutable evaluation snapshot (Pass 2A §1) against REAL storage
// + DB (no model). Seeds test attachments, builds the snapshot through the production module, asserts
// candidate/context separation + ordering + ownership isolation + missing-object + not-ready, and cleans
// up. Idempotent. Run: npx tsx scripts/snapshot-verify.ts
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
    // A gets two images seeded out of order (order 1 then 0) to prove ordering; B gets a text file; context a text file.
    await seed("candidate_output", vA, "shot-2.png", "image/png", 1);
    const a1 = await seed("candidate_output", vA, "shot-1.png", "image/png", 0);
    await seed("candidate_output", vB, "note.txt", "text/plain", 0);
    await seed("supporting_context", null, "brand-guide.txt", "text/plain", 0);
    const versions = [{ versionKey: vA, text: "A text" }, { versionKey: vB, text: "B text" }];

    const r = await snap.buildEvaluationSnapshot(owner, draftKey, versions, "context text");
    ok("snapshot builds", r.ok);
    if (r.ok) {
      const A = r.snapshot.candidates.find((c) => c.versionKey === vA)!;
      const B = r.snapshot.candidates.find((c) => c.versionKey === vB)!;
      ok("candidate A: 2 attachments in persisted order (shot-1 before shot-2)", A.attachments.length === 2 && A.attachments[0].filename === "shot-1.png" && A.attachments[1].filename === "shot-2.png");
      ok("candidate A keeps its pasted text", A.text === "A text");
      ok("candidate B has ONLY its own file (no blend from A)", B.attachments.length === 1 && B.attachments[0].filename === "note.txt");
      ok("supporting context is separate, not a candidate", r.snapshot.context.attachments.length === 1 && r.snapshot.context.attachments[0].filename === "brand-guide.txt");
      ok("no context attachment leaked into any candidate", r.snapshot.candidates.every((c) => c.attachments.every((a) => a.role === "candidate_output")));
    }

    // J — cross-owner: another owner sees none of it.
    const otherR = await snap.buildEvaluationSnapshot(other, draftKey, versions, "");
    ok("cross-owner: other user's snapshot has zero attachments", otherR.ok && otherR.snapshot.candidates.every((c) => c.attachments.length === 0) && otherR.snapshot.context.attachments.length === 0);

    // I — missing object: delete the bytes of a ready row, keep the row.
    await st.deleteCheckAttachments([a1.path]);
    const miss = await snap.buildEvaluationSnapshot(owner, draftKey, versions, "");
    ok("missing storage object rejected BEFORE the model (attachment_missing_object)", !miss.ok && miss.error === "attachment_missing_object");
    await st.uploadCheckAttachment(a1.path, Buffer.from("bytes"), "image/png"); // restore for a clean state

    // not-ready: flip one row to processing.
    await db.setStatus(owner, a1.id, "processing");
    const notReady = await snap.buildEvaluationSnapshot(owner, draftKey, versions, "");
    ok("not-ready attachment rejected (attachment_not_ready)", !notReady.ok && notReady.error === "attachment_not_ready");
  } finally {
    for (const s of seeded) { await db.deleteAttachmentRow(owner, s.id); }
    await st.deleteCheckAttachments(seeded.map((s) => s.path));
    const left = await db.listByDraft(owner, draftKey);
    ok("cleanup: no test rows remain", left.length === 0);
  }

  console.log(`\n${pass}/${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
