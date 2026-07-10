// Content-block construction (Pass 2A slice 2). Turns an immutable EvaluationSnapshot into the ordered,
// LABELED multimodal blocks the model receives — shared by the real evaluator and the harness. Block
// shapes verified against @anthropic-ai/sdk 0.90 (GA messages content array):
//   text:  { type:"text", text }
//   image: { type:"image", source:{ type:"base64", media_type: image/png|jpeg|webp, data } }
//   pdf:   { type:"document", source:{ type:"base64", media_type:"application/pdf", data } }
// Images go through the native image mechanism (never OCR-substituted); PDFs through the native document
// mechanism; txt/md as bounded structured text. Every attachment is preceded by a machine-readable label
// so the model never has to infer which file belongs to which candidate. storage_path / bytes / base64
// never appear in logs.

import { downloadCheckAttachment } from "./v-storage";
import type { EvaluationSnapshot, SnapshotAttachment } from "./v-attachment-snapshot";

export type Block =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
  | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } };

// Intended capability from construction — NOT the final user-facing label (that is only assigned after a
// real model request succeeds, in a later slice).
export type RequestedCapability = "visual_requested" | "native_document_requested" | "text_requested";
export type PreparedAttachment = {
  attachmentId: string; filename: string; role: SnapshotAttachment["role"]; versionKey: string | null;
  kind: string; mime: string; blockType: Block["type"]; requested: RequestedCapability; sizeBytes: number; pageCount: number | null;
  index: number; // 1-based within its group (the image_index/document_index the model was shown)
};
export type ContentBuildError = "request_build_failed" | "request_too_large";
export type ContentBuildResult =
  | { ok: true; blocks: Block[]; prepared: PreparedAttachment[]; textById: Record<string, string>; estTokens: number; logSummary: string }
  | { ok: false; error: ContentBuildError; message: string; attachmentId?: string };

const MAX_TEXT_FILE = 50_000;             // bounded txt/md content
const BUDGET_TOKENS = 150_000;            // conservative ceiling under the model's 200k context (room for response)
const OVERHEAD_TOKENS = 9_000;            // prompt scaffold + result schema + response allowance
const IMAGE_TOKENS = 1_600;              // Anthropic caps a single image near ~1568 tokens after resize
const PDF_TOKENS_PER_PAGE = 2_500;        // conservative: native PDF processing is text + visual per page
const txtTokens = (chars: number) => Math.ceil(chars / 3.5);

// Candidate letters (A, B, ...) match the labels the evaluator schema + finalize use, so the model
// scores "A"/"B" and its evidence references line up. Context has no letter.
const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

const labelFor = (a: SnapshotAttachment, index: number, versionLabel: string | null): string => {
  const lines = [
    a.role.toUpperCase(),
    versionLabel ? `version: ${versionLabel}` : null,
    `attachment_id: ${a.attachmentId}`,
    `filename: ${a.filename}`,
    a.kind === "image" ? `image_index: ${index}` : `document_index: ${index}`,
    a.pageCount ? `pages: ${a.pageCount}` : null,
  ].filter(Boolean);
  return lines.join("\n");
};

// Build the ordered attachment-bearing blocks for the context section then each candidate. The evaluator
// wraps these with the original-request/criteria text (before) and the instructions/schema (after).
export async function buildEvaluationContent(snapshot: EvaluationSnapshot): Promise<ContentBuildResult> {
  const blocks: Block[] = [];
  const prepared: PreparedAttachment[] = [];
  const textById: Record<string, string> = {}; // extracted text per text attachment (for evidence-excerpt validation)
  let estTokens = OVERHEAD_TOKENS + txtTokens(snapshot.context.text.length) + snapshot.candidates.reduce((n, c) => n + txtTokens(c.text.length), 0);

  // Pre-flight the budget with metadata only (no downloads) so an oversized request is rejected cheaply.
  const allAtts = [...snapshot.context.attachments, ...snapshot.candidates.flatMap((c) => c.attachments)];
  for (const a of allAtts) {
    estTokens += a.kind === "image" ? IMAGE_TOKENS : a.kind === "pdf" ? (a.pageCount ?? Math.ceil(a.sizeBytes / 1200)) * PDF_TOKENS_PER_PAGE : txtTokens(Math.min(a.sizeBytes, MAX_TEXT_FILE));
  }
  if (estTokens > BUDGET_TOKENS) {
    return { ok: false, error: "request_too_large", message: "This check is too large to analyze in one request. Remove some files or split it into smaller checks." };
  }

  // Emit one section per group, attachments in persisted order, each behind its label.
  async function section(header: string, text: string, atts: SnapshotAttachment[], versionLabel: string | null): Promise<ContentBuildError | null> {
    blocks.push({ type: "text", text: text.trim() ? `${header}\n${text}` : header });
    let i = 1;
    for (const a of atts) {
      blocks.push({ type: "text", text: labelFor(a, i, versionLabel) });
      const bytes = await downloadCheckAttachment(a.storagePath);
      if (!bytes) return "request_build_failed";
      const base = { attachmentId: a.attachmentId, filename: a.filename, role: a.role, versionKey: a.versionKey, kind: a.kind, mime: a.mime, sizeBytes: a.sizeBytes, pageCount: a.pageCount, index: i };
      if (a.kind === "image") {
        blocks.push({ type: "image", source: { type: "base64", media_type: a.mime, data: bytes.toString("base64") } });
        prepared.push({ ...base, blockType: "image", requested: "visual_requested" });
      } else if (a.kind === "pdf") {
        blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: bytes.toString("base64") } });
        prepared.push({ ...base, blockType: "document", requested: "native_document_requested" });
      } else {
        const text = bytes.toString("utf8").slice(0, MAX_TEXT_FILE);
        textById[a.attachmentId] = text;
        blocks.push({ type: "text", text: `--- file content (${a.filename}) ---\n${text}\n--- end ---` });
        prepared.push({ ...base, blockType: "text", requested: "text_requested" });
      }
      i++;
    }
    return null;
  }

  // Order: supporting context FIRST (reference/requirements), then each candidate. Context is never a candidate.
  const buildFail = "A file could not be read while preparing the check. Nothing was charged. Try again.";
  if (snapshot.context.text.trim() || snapshot.context.attachments.length) {
    const e = await section("SUPPORTING_CONTEXT (reference/requirements — never scored as a version)", snapshot.context.text, snapshot.context.attachments, null);
    if (e) return { ok: false, error: e, message: buildFail };
  }
  for (let ci = 0; ci < snapshot.candidates.length; ci++) {
    const c = snapshot.candidates[ci];
    const letter = LETTERS[ci] ?? `V${ci + 1}`;
    const e = await section(`CANDIDATE_OUTPUT — Version ${letter}`, c.text, c.attachments, letter);
    if (e) return { ok: false, error: e, message: buildFail };
  }

  // Log-safe: ids/mime/size/pages/role/blockType/budget only — never content, base64, paths, or filenames beyond ids.
  const logSummary = `blocks=${blocks.length} est_tokens=${estTokens} attachments=[${prepared.map((p) => `${p.attachmentId.slice(0, 8)}:${p.mime}:${p.sizeBytes}b:${p.pageCount ?? "-"}pg:${p.blockType}`).join(", ")}]`;
  return { ok: true, blocks, prepared, textById, estTokens, logSummary };
}
