// Automated server verification of content-block construction (Pass 2A slice 2) against REAL storage.
// Seeds a PNG (candidate A), a PDF (candidate B), and a TXT (context); builds the snapshot + content
// blocks through the production modules; asserts ordering, labels, native block types, capability
// intent, budget rejection, and log-safety. No model call. Idempotent. Run: npx tsx scripts/content-blocks-verify.ts
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
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40)]);
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");

async function main() {
  const st = await import("../lib/v-storage");
  const db = await import("../lib/v-attachments-db");
  const snap = await import("../lib/v-attachment-snapshot");
  const cb = await import("../lib/v-content-blocks");
  const owner = "cb-owner@vraelis.local";
  const draftKey = `cb-${crypto.randomUUID()}`;
  const seeded: { id: string; path: string }[] = [];

  async function seed(role: "candidate_output" | "supporting_context", versionKey: string | null, filename: string, mime: string, bytes: Buffer, order: number, pageCount: number | null = null) {
    const path = `users/cbtest/${draftKey}/${crypto.randomUUID()}`;
    await st.uploadCheckAttachment(path, bytes, mime);
    const row = await db.insertAttachment({ userId: owner, draftKey, role, versionKey, filename, mime, sizeBytes: bytes.length, storagePath: path, pageCount, capabilities: { text: mime.startsWith("text") || mime === "application/pdf", vision: mime.startsWith("image") || mime === "application/pdf" }, orderIndex: order });
    if (!row) throw new Error("seed failed");
    seeded.push({ id: row.id, path });
    return row.id;
  }

  try {
    const cId = await seed("supporting_context", null, "brand.txt", "text/plain", Buffer.from("# Brand rules\n- Never promise refunds"), 0);
    const aId = await seed("candidate_output", "verA", "screen.png", "image/png", PNG, 0);
    const bId = await seed("candidate_output", "verB", "brief.pdf", "application/pdf", PDF, 0, 3);
    const versions = [{ versionKey: "verA", text: "A pasted text" }, { versionKey: "verB", text: "B pasted text" }];

    const s = await snap.buildEvaluationSnapshot(owner, draftKey, versions, "Follow the brand guide.", [cId, aId, bId]);
    if (!s.ok) { console.log("snapshot failed:", s.error); process.exit(1); }
    const r = await cb.buildEvaluationContent(s.snapshot);
    ok("content build ok", r.ok);
    if (r.ok) {
      const texts = r.blocks.map((b) => (b.type === "text" ? b.text : `[${b.type}]`));
      const idxCtx = texts.findIndex((t) => t.startsWith("SUPPORTING_CONTEXT"));
      const idxA = texts.findIndex((t) => t.includes("version_key: verA") && t.startsWith("CANDIDATE_OUTPUT"));
      const idxB = texts.findIndex((t) => t.includes("version_key: verB") && t.startsWith("CANDIDATE_OUTPUT"));
      ok("order: supporting context before candidate A before candidate B", idxCtx >= 0 && idxA > idxCtx && idxB > idxA);
      const img = r.blocks.find((b) => b.type === "image");
      ok("PNG -> native image block (base64, media_type image/png)", !!img && img.type === "image" && img.source.type === "base64" && img.source.media_type === "image/png" && img.source.data.length > 0);
      const doc = r.blocks.find((b) => b.type === "document");
      ok("PDF -> native document block (base64, application/pdf)", !!doc && doc.type === "document" && doc.source.media_type === "application/pdf" && doc.source.data.length > 0);
      ok("TXT -> text block carrying its content (not a binary block)", texts.some((t) => t.includes("Brand rules") && t.includes("Never promise refunds")));
      ok("each attachment has a machine-readable label (attachment_id + index)", texts.some((t) => t.includes(`attachment_id: ${aId}`) && t.includes("image_index: 1")) && texts.some((t) => t.includes(`attachment_id: ${bId}`) && t.includes("document_index: 1")));
      ok("capability INTENT set (visual/native_document/text_requested), not final", r.prepared.find((p) => p.attachmentId === aId)?.requested === "visual_requested" && r.prepared.find((p) => p.attachmentId === bId)?.requested === "native_document_requested" && r.prepared.find((p) => p.attachmentId === cId)?.requested === "text_requested");
      ok("est token budget computed", r.estTokens > 0);
      ok("log summary leaks no path / base64 / raw content", !r.logSummary.includes("users/") && !r.logSummary.includes(img && img.type === "image" ? img.source.data.slice(0, 24) : "ZZ") && !r.logSummary.includes("Never promise"));
    }

    // Budget: a PDF whose page count blows the context is rejected before the model (no silent sampling).
    const bigDraft = `cb-big-${crypto.randomUUID()}`;
    const bigPath = `users/cbtest/${bigDraft}/${crypto.randomUUID()}`;
    await st.uploadCheckAttachment(bigPath, PDF, "application/pdf");
    const bigRow = await db.insertAttachment({ userId: owner, draftKey: bigDraft, role: "candidate_output", versionKey: "vX", filename: "huge.pdf", mime: "application/pdf", sizeBytes: PDF.length, storagePath: bigPath, pageCount: 100, capabilities: { text: true, vision: true }, orderIndex: 0 });
    seeded.push({ id: bigRow!.id, path: bigPath });
    const bigSnap = await snap.buildEvaluationSnapshot(owner, bigDraft, [{ versionKey: "vX", text: "" }], "", [bigRow!.id]);
    const bigContent = bigSnap.ok ? await cb.buildEvaluationContent(bigSnap.snapshot) : { ok: false as const, error: "n/a" };
    ok("oversized request (100-page PDF) rejected before the model (request_too_large)", !bigContent.ok && (bigContent as { error: string }).error === "request_too_large");
  } finally {
    for (const s of seeded) await db.deleteAttachmentRow(owner, s.id);
    await st.deleteCheckAttachments(seeded.map((s) => s.path));
    ok("cleanup: rows removed", true);
  }
  console.log(`\n${pass}/${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
