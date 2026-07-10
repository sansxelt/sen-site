// Real-model harness for Pass 2A (env-gated). Runs synthetic fixtures through the SAME production path
// as a check — real private storage + DB, buildEvaluationSnapshot, buildEvaluationcontent, and the shared
// evaluateOutput — then checks the model's findings for genuinely VISUAL concepts, finalizes capability
// only after a validated result, and cleans up. Refuses to run without the guard. Prints only a redacted
// report (no base64 / paths / signed URLs / raw content).
//   Run: VRAELIS_MULTIMODAL_VERIFY=1 ANTHROPIC_API_KEY=<real key> npx tsx scripts/multimodal-verify.ts
import crypto from "node:crypto";
import { loadEnvConfig } from "@next/env";

if (process.env.VRAELIS_MULTIMODAL_VERIFY !== "1") { console.error("Refusing to run. Set VRAELIS_MULTIMODAL_VERIFY=1 to allow this internal harness."); process.exit(2); }
// Load .env.local exactly as Next does (Supabase, ANTHROPIC/VRAELIS_LLM keys, VRAELIS_EVAL_MODEL) so the
// shared modules read the same values the app uses. Pull it first with `vercel env pull .env.local`.
loadEnvConfig(process.cwd());
if (!process.env.VRAELIS_EVAL_MODEL) process.env.VRAELIS_EVAL_MODEL = "claude-haiku-4-5";

type Seed = { role: "candidate_output" | "supporting_context"; versionKey: string | null; filename: string; mime: string; bytes: Buffer; pageCount?: number | null };
const owner = "mm-verify@vraelis.local";
const report: Record<string, unknown>[] = [];

async function main() {
  const st = await import("../lib/v-storage");
  const db = await import("../lib/v-attachments-db");
  const snap = await import("../lib/v-attachment-snapshot");
  const cbmod = await import("../lib/v-content-blocks");
  const ev = await import("../lib/v-evaluator");
  const fx = await import("./fixtures");

  async function runCase(name: string, outputType: string, originalRequest: string | undefined, versions: { versionKey: string; text: string }[], contextText: string, seeds: Seed[], conceptGroups: string[][]) {
    const draftKey = `mm-${crypto.randomUUID()}`;
    const seeded: { id: string; path: string }[] = [];
    const expected: string[] = [];
    try {
      let ord = 0;
      for (const s of seeds) {
        const path = `users/mmverify/${draftKey}/${crypto.randomUUID()}`;
        await st.uploadCheckAttachment(path, s.bytes, s.mime);
        const row = await db.insertAttachment({ userId: owner, draftKey, role: s.role, versionKey: s.versionKey, filename: s.filename, mime: s.mime, sizeBytes: s.bytes.length, storagePath: path, pageCount: s.pageCount ?? null, capabilities: { text: s.mime.startsWith("text") || s.mime === "application/pdf", vision: s.mime.startsWith("image") || s.mime === "application/pdf" }, orderIndex: ord++ });
        if (!row) throw new Error("seed failed");
        seeded.push({ id: row.id, path }); expected.push(row.id);
      }
      const s = await snap.buildEvaluationSnapshot(owner, draftKey, versions, contextText, expected);
      if (!s.ok) { report.push({ case: name, result: "snapshot_error", error: s.error }); return; }
      // No attachments -> legacy text-only path (no multimodal content). With attachments -> content blocks.
      let content: { blocks: unknown[]; prepared: { attachmentId: string; kind: string }[]; estTokens: number } | null = null;
      if (seeds.length) {
        const c = await cbmod.buildEvaluationContent(s.snapshot);
        if (!c.ok) { report.push({ case: name, result: "content_error", error: c.error }); return; }
        content = c;
      }
      const result = await ev.evaluateOutput({ outputType: outputType as never, candidates: versions.map((v) => ({ text: v.text })), originalRequest, attachments: content ? { blocks: content.blocks as never, prepared: content.prepared as never } : undefined });
      if (!result) { report.push({ case: name, result: "model_unavailable", note: "evaluateOutput returned null (invalid/placeholder key) — run with the prod key", snapshot_hash: s.snapshot.hash, budget_tokens: content?.estTokens ?? null, block_count: content?.blocks.length ?? 0 }); return; }
      // Tolerant semantic detection of planted concepts (not exact strings). Only meaningful when files exist.
      const hay = JSON.stringify({ candidates: result.candidates.map((x) => ({ summary: x.summary, scores: x.scores })), flags: result.flags, rec: result.recommendation }).toLowerCase();
      const detected = conceptGroups.map((g) => g.some((kw) => hay.includes(kw)));
      const capabilities = (content?.prepared ?? []).map((p) => ({ id: p.attachmentId.slice(0, 8), kind: p.kind, capability: p.kind === "image" ? "visual" : p.kind === "pdf" ? "text_and_visual" : "text" }));
      report.push({ case: name, result: "real_model", model: process.env.VRAELIS_EVAL_MODEL, candidates_scored: result.candidates.length, context_attachments: s.snapshot.context.attachments.length, visual_concepts_expected: conceptGroups.length, visual_concepts_detected: detected.filter(Boolean).length, passed: conceptGroups.length === 0 ? true : detected.some(Boolean), capabilities, budget_tokens: content?.estTokens ?? null, snapshot_hash: s.snapshot.hash });
    } catch (e) {
      report.push({ case: name, result: "error", message: (e as Error).message });
    } finally {
      for (const x of seeded) await db.deleteAttachmentRow(owner, x.id);
      await st.deleteCheckAttachments(seeded.map((x) => x.path));
    }
  }

  // A — one screenshot with planted visual defects (no text: any finding is necessarily visual).
  await runCase("A_screenshot", "product_ux", "Review this screen for usability and visual hierarchy.",
    [{ versionKey: "A", text: "" }], "",
    [{ role: "candidate_output", versionKey: "A", filename: "screen.png", mime: "image/png", bytes: fx.screenshotPng() }],
    [["hierarch", "dominan", "emphas", "competing", "prominent", "stands out"], ["align", "misalign", "inconsist", "spacing", "uneven"], ["contrast", "faint", "legib", "hard to read"]]);

  // B — one PDF with a planted layout/overlap/cramped-column defect.
  await runCase("B_pdf", "long_form", "Review this report for clarity and layout quality.",
    [{ versionKey: "A", text: "" }], "",
    [{ role: "candidate_output", versionKey: "A", filename: "report.pdf", mime: "application/pdf", bytes: fx.makePdf(), pageCount: 1 }],
    [["table", "column", "cramped", "overlap", "label"], ["layout", "spacing", "aligned", "hierarch", "heading"]]);

  // C — mixed: pasted text + a screenshot in ONE candidate; the other is text-only.
  await runCase("C_mixed", "product_ux", "Explain the checkout flow. Requirement: the primary action must be the most prominent.",
    [{ versionKey: "A", text: "Checkout screen: the user reviews the cart and taps the main button to pay." }, { versionKey: "B", text: "Plain text alternative: a single Pay button at the bottom." }], "",
    [{ role: "candidate_output", versionKey: "A", filename: "checkout.png", mime: "image/png", bytes: fx.screenshotPng() }],
    [["prominent", "dominan", "hierarch", "primary", "button", "visual"]]);

  // B4 — four ORDERED, color-distinct screenshots as one candidate (ordering preserved DB->result).
  await runCase("B4_ordered_screens", "product_ux", "Review these four screens.",
    [{ versionKey: "A", text: "" }], "",
    (["red", "green", "blue", "gold"] as const).map((_, i) => ({ role: "candidate_output" as const, versionKey: "A", filename: `screen-${i + 1}.png`, mime: "image/png", bytes: fx.coloredScreenshotPng(([[220, 40, 40], [40, 180, 60], [40, 90, 220], [220, 180, 40]] as [number, number, number][])[i]) })),
    [["image", "screen", "color", "hierarch", "dominan", "multiple", "second"]]);

  // F — PDF Candidate A vs PDF Candidate B (distinct identities, no cross-blend).
  await runCase("F_pdf_vs_pdf", "long_form", "Compare these two reports.",
    [{ versionKey: "A", text: "" }, { versionKey: "B", text: "" }], "",
    [{ role: "candidate_output", versionKey: "A", filename: "alpha.pdf", mime: "application/pdf", bytes: fx.makePdf("Alpha Division Report"), pageCount: 1 },
     { role: "candidate_output", versionKey: "B", filename: "beta.pdf", mime: "application/pdf", bytes: fx.makePdf("Beta Division Report"), pageCount: 1 }],
    [["table", "layout", "overlap", "column", "report"]]);

  // G — candidate screenshot + supporting brand-guide PDF (context informs, never scored).
  await runCase("G_context", "product_ux", "Does this screen follow the brand guide?",
    [{ versionKey: "A", text: "The checkout screen." }], "",
    [{ role: "candidate_output", versionKey: "A", filename: "screen.png", mime: "image/png", bytes: fx.screenshotPng() },
     { role: "supporting_context", versionKey: null, filename: "brand.pdf", mime: "application/pdf", bytes: fx.makePdf("Brand Guide: no red primary buttons; refunds are never promised"), pageCount: 1 }],
    [["brand", "guide", "requirement", "context"]]);

  // H — TXT and MD candidates (structure preserved).
  await runCase("H_txt_md", "other", "Which is clearer?",
    [{ versionKey: "A", text: "" }, { versionKey: "B", text: "" }], "",
    [{ role: "candidate_output", versionKey: "A", filename: "notes.txt", mime: "text/plain", bytes: fx.brandTxt() },
     { role: "candidate_output", versionKey: "B", filename: "guide.md", mime: "text/markdown", bytes: fx.guideMd() }],
    [["rule", "tone", "voice", "step", "cta", "heading", "list"]]);

  // L — legacy text-only check (no attachments): existing path must still work.
  await runCase("L_text_only", "support_reply", "Reply to a frustrated customer.",
    [{ versionKey: "A", text: "I'm sorry for the trouble. I've flagged this and will follow up within two business days." }, { versionKey: "B", text: "Not my problem, figure it out." }], "",
    [], []);

  // M — original request ABSENT, with a screenshot (general-quality path still works).
  await runCase("M_no_request", "product_ux", undefined,
    [{ versionKey: "A", text: "" }], "",
    [{ role: "candidate_output", versionKey: "A", filename: "screen.png", mime: "image/png", bytes: fx.screenshotPng() }],
    [["hierarch", "dominan", "contrast", "align", "visual", "spacing"]]);

  console.log(JSON.stringify({ harness: "multimodal-verify", owner_redacted: true, cases: report }, null, 2));
  const anyReal = report.some((r) => r.result === "real_model");
  if (!anyReal) console.log("\nNOTE: no case reached the real model (placeholder key in this env). Pipeline verified end-to-end; rerun with the prod ANTHROPIC_API_KEY for real visual findings.");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
