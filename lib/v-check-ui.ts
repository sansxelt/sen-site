// Pure, framework-free contract helpers shared by the check form and the report. Extracted so the
// truthfulness rules (analysis mode, CTA gating, capability labels, evidence chips, per-version source
// isolation, idempotency-key lifecycle) can be unit-tested deterministically without a browser. No I/O,
// no React, no storage paths — just data in, data out.

import type { AttachmentEvidence } from "./v-evidence";

export type UploadKind = "image" | "pdf" | "text" | "office";
export type Capability = "visual" | "text_and_visual" | "text" | "text_only_fallback" | "failed";

export type ReportAttachment = {
  id: string; filename: string; kind: UploadKind;
  role: "candidate_output" | "supporting_context"; versionKey: string | null;
  candidateLabel: string | null; orderIndex: number; pageCount: number | null;
};

// Analysis mode + counts from the ready OUTPUT attachments and whether any pasted text exists. A PDF is
// text + visual; an image is visual; txt/md and pasted text are text. Mirrors the per-file readiness the
// upload cards show, so the sticky summary never overstates what will be analyzed.
export function analysisFromUploads(readyOutKinds: UploadKind[], hasPastedText: boolean) {
  const images = readyOutKinds.filter((k) => k === "image").length;
  const pdfs = readyOutKinds.filter((k) => k === "pdf").length;
  const texts = readyOutKinds.filter((k) => k === "text").length;
  const hasVisual = images > 0 || pdfs > 0;
  const hasText = hasPastedText || texts > 0 || pdfs > 0;
  const mode: "Text + visuals" | "Visual" | "Text only" = hasVisual && hasText ? "Text + visuals" : hasVisual ? "Visual" : "Text only";
  return { mode, images, pdfs, texts, hasVisual, hasText };
}

// The CTA is enabled only when there is something to submit and nothing is uploading or failed.
export function canSubmitCheck(a: { submittableCount: number; anyUploading: boolean; anyFailed: boolean }): boolean {
  return a.submittableCount >= 1 && !a.anyUploading && !a.anyFailed;
}

// One idempotency key per submit ATTEMPT. `locked` is the ref's current value: a repeated click during
// the same in-flight attempt reuses it; after a terminal failure the ref is cleared to null, so the next
// attempt mints a fresh key. Text-only checks pass hasUploads=false and use no key (unchanged behavior).
export function submissionIdFor(locked: string | null, hasUploads: boolean, mint: () => string): string | undefined {
  if (!hasUploads) return undefined;
  return locked ?? mint();
}

export const CAPABILITY_LABEL: Record<Capability, string> = {
  visual: "Visual analysis", text_and_visual: "Text + visual analysis", text: "Text analysis",
  text_only_fallback: "Text-only fallback", failed: "Not analyzed",
};

// A short human label for one validated evidence reference. Uses only fields the validator authorizes
// (authoritative filename, validated page/image index, matched excerpt) — never a model-supplied name.
export function evidenceChipLabel(e: AttachmentEvidence): string {
  const prefix = e.role === "candidate_output" ? "Output" : "Context";
  if (e.source_type === "image" && e.image_index) return `${prefix} · Screenshot ${e.image_index}`;
  if (e.source_type === "pdf" && e.page_start) return `${prefix} · ${e.filename} · Page ${e.page_start}${e.page_end && e.page_end > e.page_start ? `–${e.page_end}` : ""}`;
  if (e.source_type === "text" && (e.section || e.excerpt)) return `${prefix} · ${e.filename} · “${(e.section || e.excerpt || "").slice(0, 40)}”`;
  return `${prefix} · ${e.filename}`;
}

// Group report sources: candidate outputs by their Version letter (letter order), then supporting
// context. The grouping is what keeps evidence scoped — a chip is rendered under the source it cites, and
// evidenceForSource matches strictly by attachment id, so a Version A citation can never land under B.
export function groupReportSources(sources: ReportAttachment[]): { title: string; items: ReportAttachment[] }[] {
  const outputs = sources.filter((s) => s.role === "candidate_output");
  const context = sources.filter((s) => s.role === "supporting_context");
  const letters = Array.from(new Set(outputs.map((s) => s.candidateLabel ?? "?"))).sort();
  return [
    ...letters.map((L) => ({ title: `Version ${L}`, items: outputs.filter((s) => (s.candidateLabel ?? "?") === L).sort((a, b) => a.orderIndex - b.orderIndex) })),
    ...(context.length ? [{ title: "Supporting context", items: context.slice().sort((a, b) => a.orderIndex - b.orderIndex) }] : []),
  ];
}

export function evidenceForSource(evidence: AttachmentEvidence[], attachmentId: string): AttachmentEvidence[] {
  return evidence.filter((e) => e.attachment_id === attachmentId);
}
