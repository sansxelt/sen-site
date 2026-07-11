// Real-model verification that the evaluator now PRODUCES grounded evidence and that every reference is
// authoritative-validated (Pass 2A, model-produced evidence wiring). Env-gated. Runs synthetic fixtures
// through the production path (snapshot -> content -> evaluateOutput) and asserts the A-E cases. Any
// evidence in the result has already passed lib/v-evidence.ts, so a produced ref is correct by
// construction; these assertions additionally prove the model actually grounds findings and that context/
// version isolation holds end to end. Cleans up. Prints only redacted output.
//   VRAELIS_EVIDENCE_VERIFY=1 npx tsx scripts/evidence-model-verify.ts
import crypto from "node:crypto";
import { loadEnvConfig } from "@next/env";

if (process.env.VRAELIS_EVIDENCE_VERIFY !== "1") { console.error("Refusing to run. Set VRAELIS_EVIDENCE_VERIFY=1."); process.exit(2); }
loadEnvConfig(process.cwd());
if (!process.env.VRAELIS_EVAL_MODEL) process.env.VRAELIS_EVAL_MODEL = "claude-haiku-4-5";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };
const owner = "ev-verify@vraelis.local";
type Seed = { role: "candidate_output" | "supporting_context"; versionKey: string | null; filename: string; mime: string; bytes: Buffer; pageCount?: number | null };

async function main() {
  const st = await import("../lib/v-storage");
  const db = await import("../lib/v-attachments-db");
  const snap = await import("../lib/v-attachment-snapshot");
  const cb = await import("../lib/v-content-blocks");
  const ev = await import("../lib/v-evaluator");
  const evid = await import("../lib/v-evidence");
  const fx = await import("./fixtures");

  type Summary = NonNullable<Awaited<ReturnType<typeof ev.evaluateOutput>>>["attachmentSummary"];
  type Res = { error: string | null; evidence: import("../lib/v-evidence").AttachmentEvidence[]; summary: NonNullable<Summary>; scored: number; warnings: string[] };
  // Run one case to a validated result, returning a uniform shape (empty on any pre-model failure).
  async function run(outputType: string, originalRequest: string | undefined, versions: { versionKey: string; text: string }[], seeds: Seed[]): Promise<Res> {
    const draftKey = `ev-${crypto.randomUUID()}`;
    const seeded: { id: string; path: string }[] = [];
    const expected: string[] = [];
    const empty = (error: string): Res => ({ error, evidence: [], summary: [], scored: 0, warnings: [] });
    let ord = 0;
    for (const s of seeds) {
      const path = `users/evverify/${draftKey}/${crypto.randomUUID()}`;
      await st.uploadCheckAttachment(path, s.bytes, s.mime);
      const row = await db.insertAttachment({ userId: owner, draftKey, role: s.role, versionKey: s.versionKey, filename: s.filename, mime: s.mime, sizeBytes: s.bytes.length, storagePath: path, pageCount: s.pageCount ?? null, capabilities: { text: s.mime.startsWith("text") || s.mime === "application/pdf", vision: s.mime.startsWith("image") || s.mime === "application/pdf" }, orderIndex: ord++ });
      seeded.push({ id: row!.id, path }); expected.push(row!.id);
    }
    try {
      const s = await snap.buildEvaluationSnapshot(owner, draftKey, versions, "", expected);
      if (!s.ok) return empty(`snapshot_${s.error}`);
      const c = await cb.buildEvaluationContent(s.snapshot);
      if (!c.ok) return empty(`content_${c.error}`);
      const result = await ev.evaluateOutput({ outputType: outputType as never, candidates: versions.map((v) => ({ text: v.text })), originalRequest, attachments: { blocks: c.blocks as never, prepared: c.prepared as never, textById: c.textById, snapshotHash: s.snapshot.hash } });
      if (!result) return empty("model_unavailable");
      return { error: null, evidence: result.attachmentEvidence ?? [], summary: result.attachmentSummary ?? [], scored: result.candidates.length, warnings: result.attachmentWarnings ?? [] };
    } finally {
      for (const x of seeded) await db.deleteAttachmentRow(owner, x.id);
      await st.deleteCheckAttachments(seeded.map((x) => x.path));
    }
  }
  const evOf = (r: Res) => r.evidence;
  // Every produced ref must reference a real evaluated attachment with matching role/version/index (the
  // validator guarantees this; we re-check against the authoritative summary for confidence).
  const consistent = (r: Res) => {
    const byId = new Map(r.summary.map((s) => [s.attachment_id, s]));
    return r.evidence.every((e) => {
      const s = byId.get(e.attachment_id); if (!s) return false;
      if (e.version_key != null && String(e.version_key) !== String(s.version_key ?? "")) return false;
      if (e.role !== s.role) return false;
      if (e.source_type === "image" && e.image_index != null && e.image_index !== s.index) return false;
      return true;
    });
  };

  // A — four ordered screenshots: expect grounded image evidence with a valid, in-range image_index.
  const A = await run("product_ux", "Review these four screens for visual hierarchy; point to the specific screen.",
    [{ versionKey: "A", text: "" }],
    ([[220, 40, 40], [40, 180, 60], [40, 90, 220], [220, 180, 40]] as [number, number, number][]).map((rgb, i) => ({ role: "candidate_output" as const, versionKey: "A", filename: `screen-${i + 1}.png`, mime: "image/png", bytes: fx.coloredScreenshotPng(rgb) })));
  ok("A: four screenshots produced grounded evidence", evOf(A).length >= 1, `${evOf(A).length} refs`);
  ok("A: image evidence has a valid in-range index (1..4)", evOf(A).some((e) => e.source_type === "image" && !!e.image_index && e.image_index >= 1 && e.image_index <= 4));
  ok("A: every ref is authoritative-consistent", consistent(A));

  // B — candidate PDF: expect a reference to a valid page.
  const B = await run("long_form", "Review this report; cite the page your finding is on.",
    [{ versionKey: "A", text: "" }],
    [{ role: "candidate_output", versionKey: "A", filename: "report.pdf", mime: "application/pdf", bytes: fx.makePdf(), pageCount: 1 }]);
  ok("B: PDF produced grounded evidence", evOf(B).length >= 1, `${evOf(B).length} refs`);
  ok("B: pdf evidence page is within range", evOf(B).filter((e) => e.source_type === "pdf").every((e) => !e.page_start || e.page_start <= 1));
  ok("B: every ref is authoritative-consistent", consistent(B));

  // C — candidate screenshot + supporting brand-guide PDF: context may be referenced (role Context) and
  // is NEVER scored as a candidate.
  const C = await run("product_ux", "Does this checkout screen follow the brand guide? The guide forbids a red primary button and promising refunds.",
    [{ versionKey: "A", text: "The checkout screen with a bright red Pay button that promises an instant refund." }],
    [{ role: "candidate_output", versionKey: "A", filename: "checkout.png", mime: "image/png", bytes: fx.coloredScreenshotPng([220, 30, 30]) },
     { role: "supporting_context", versionKey: null, filename: "brand-guide.pdf", mime: "application/pdf", bytes: fx.makePdf("Brand Guide. Rule 1: never use a red primary button. Rule 2: never promise a refund."), pageCount: 1 }]);
  ok("C: context is NEVER scored as a candidate", C.scored === 1);
  ok("C: any context ref is labeled supporting_context (never output)", evOf(C).filter((e) => e.filename === "brand-guide.pdf").every((e) => e.role === "supporting_context"));
  ok("C: every ref is authoritative-consistent (Output vs Context)", consistent(C));

  // D — two candidates each with their own screenshot: A's evidence must never carry version B (and vice
  // versa). The validator strips version mismatches, so a produced ref proves end-to-end isolation.
  const D = await run("product_ux", "Compare the two screens; cite which screen each finding is about.",
    [{ versionKey: "A", text: "" }, { versionKey: "B", text: "" }],
    [{ role: "candidate_output", versionKey: "A", filename: "va.png", mime: "image/png", bytes: fx.coloredScreenshotPng([30, 160, 60]) },
     { role: "candidate_output", versionKey: "B", filename: "vb.png", mime: "image/png", bytes: fx.coloredScreenshotPng([60, 60, 200]) }]);
  ok("D: two-candidate evidence is version-isolated", consistent(D) && evOf(D).every((e) => {
    const s = D.summary.find((x) => x.attachment_id === e.attachment_id);
    return !s || String(e.version_key ?? s.version_key ?? "") === String(s.version_key ?? "");
  }));

  // E — malformed evidence is stripped (deterministic validator check with authoritative metadata).
  const meta = [{ attachmentId: "real-1", filename: "shot.png", role: "candidate_output" as const, versionKey: "vA", source: "image" as const, pageCount: null, index: 1 }];
  const bad = evid.validateEvidence([
    { attachment_id: "does-not-exist", basis: "visual" },                                  // unknown id
    { attachment_id: "real-1", source_type: "image", image_index: 9, basis: "visual" },    // impossible index
    { attachment_id: "real-1", role: "supporting_context", source_type: "image", image_index: 1, basis: "visual" }, // role mismatch (context claimed for output)
    { attachment_id: "real-1", source_type: "image", image_index: 1, basis: "text", excerpt: "text that is not in any file", version_key: "vA" }, // fabricated excerpt (no textById)
    { attachment_id: "real-1", source_type: "image", image_index: 1, basis: "visual", version_key: "vA" }, // the ONE valid ref
  ], meta, {});
  ok("E: exactly the one valid ref survives; all malformed stripped", bad.evidence.length === 1 && bad.warnings.length === 4, `${bad.evidence.length} kept, ${bad.warnings.length} stripped`);
  ok("E: surviving ref has authoritative filename (not a model-supplied one)", bad.evidence[0]?.filename === "shot.png");

  console.log(`\n${pass}/${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
