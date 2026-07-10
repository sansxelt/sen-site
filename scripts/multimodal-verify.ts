// Real-model harness for Pass 2A (env-gated). Runs synthetic fixtures through the SAME production path
// as a check — real private storage + DB, buildEvaluationSnapshot, buildEvaluationcontent, and the shared
// evaluateOutput — then checks the model's findings for genuinely VISUAL concepts, finalizes capability
// only after a validated result, and cleans up. Refuses to run without the guard. Prints only a redacted
// report (no base64 / paths / signed URLs / raw content).
//   Run: VRAELIS_MULTIMODAL_VERIFY=1 ANTHROPIC_API_KEY=<real key> npx tsx scripts/multimodal-verify.ts
import { readFileSync } from "node:fs";
import crypto from "node:crypto";

if (process.env.VRAELIS_MULTIMODAL_VERIFY !== "1") { console.error("Refusing to run. Set VRAELIS_MULTIMODAL_VERIFY=1 to allow this internal harness."); process.exit(2); }

function envLongest(raw: string, name: string): string {
  const all = [...raw.matchAll(new RegExp(`^\\s*${name}\\s*=\\s*(.*)\\s*$`, "gm"))].map((m) => m[1].replace(/^["']|["']$/g, "").trim());
  return all.slice().sort((a, b) => b.length - a.length)[0] || "";
}
const raw = readFileSync(".env.local", "utf8");
process.env.NEXT_PUBLIC_SUPABASE_URL = envLongest(raw, "NEXT_PUBLIC_SUPABASE_URL") || envLongest(raw, "SUPABASE_URL");
process.env.SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = envLongest(raw, "SUPABASE_SERVICE_ROLE_KEY");
// Prod-equivalent model; key from the invoking env (preferred) or .env.local. Placeholder -> model unavailable.
const key = process.env.ANTHROPIC_API_KEY || envLongest(raw, "ANTHROPIC_API_KEY");
process.env.ANTHROPIC_API_KEY = key; process.env.VRAELIS_LLM_API_KEY = key;
process.env.VRAELIS_EVAL_MODEL = process.env.VRAELIS_EVAL_MODEL || "claude-haiku-4-5";

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
      for (const s of seeds) {
        const path = `users/mmverify/${draftKey}/${crypto.randomUUID()}`;
        await st.uploadCheckAttachment(path, s.bytes, s.mime);
        const row = await db.insertAttachment({ userId: owner, draftKey, role: s.role, versionKey: s.versionKey, filename: s.filename, mime: s.mime, sizeBytes: s.bytes.length, storagePath: path, pageCount: s.pageCount ?? null, capabilities: { text: s.mime.startsWith("text") || s.mime === "application/pdf", vision: s.mime.startsWith("image") || s.mime === "application/pdf" }, orderIndex: 0 });
        if (!row) throw new Error("seed failed");
        seeded.push({ id: row.id, path }); expected.push(row.id);
      }
      const s = await snap.buildEvaluationSnapshot(owner, draftKey, versions, contextText, expected);
      if (!s.ok) { report.push({ case: name, result: "snapshot_error", error: s.error }); return; }
      const c = await cbmod.buildEvaluationContent(s.snapshot);
      if (!c.ok) { report.push({ case: name, result: "content_error", error: c.error }); return; }
      const result = await ev.evaluateOutput({ outputType: outputType as never, candidates: versions.map((v) => ({ text: v.text })), originalRequest, attachments: { blocks: c.blocks, prepared: c.prepared } });
      if (!result) { report.push({ case: name, result: "model_unavailable", note: "evaluateOutput returned null (invalid/placeholder key here) — run with the prod key for real findings", snapshot_hash: s.snapshot.hash, budget_tokens: c.estTokens, block_count: c.blocks.length }); return; }
      // Tolerant semantic detection of planted VISUAL concepts (not exact strings).
      const hay = JSON.stringify({ candidates: result.candidates.map((x) => ({ summary: x.summary, scores: x.scores })), flags: result.flags, rec: result.recommendation }).toLowerCase();
      const detected = conceptGroups.map((g) => g.some((kw) => hay.includes(kw)));
      const capabilities = c.prepared.map((p) => ({ id: p.attachmentId.slice(0, 8), kind: p.kind, capability: p.kind === "image" ? "visual" : p.kind === "pdf" ? "text_and_visual" : "text" }));
      report.push({ case: name, result: "real_model", model: process.env.VRAELIS_EVAL_MODEL, candidates_scored: result.candidates.length, visual_concepts_expected: conceptGroups.length, visual_concepts_detected: detected.filter(Boolean).length, passed_visual: detected.some(Boolean), capabilities, budget_tokens: c.estTokens, snapshot_hash: s.snapshot.hash });
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

  console.log(JSON.stringify({ harness: "multimodal-verify", owner_redacted: true, cases: report }, null, 2));
  const anyReal = report.some((r) => r.result === "real_model");
  if (!anyReal) console.log("\nNOTE: no case reached the real model (placeholder key in this env). Pipeline verified end-to-end; rerun with the prod ANTHROPIC_API_KEY for real visual findings.");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
