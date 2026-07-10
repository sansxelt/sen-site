// Structured evidence validation (Pass 2A Phase 3). Findings may cite an attachment, but the MODEL is
// never authoritative about attachment metadata -- every reference is validated against the immutable
// snapshot's authoritative metadata before it is trusted. Invalid references are STRIPPED with a redacted
// warning; a usable evaluation is preserved. storage_path / signed URLs never appear here.

export type EvidenceBasis = "text" | "visual";
export type EvidenceSource = "image" | "pdf" | "text";
export type AttachmentEvidence = {
  attachment_id: string; filename: string; role: "candidate_output" | "supporting_context";
  version_key?: string; source_type: EvidenceSource;
  image_index?: number; page_start?: number; page_end?: number; section?: string; excerpt?: string;
  basis: EvidenceBasis;
};

// Authoritative per-attachment metadata (built from the snapshot / prepared attachments, never the model).
export type EvidenceMeta = {
  attachmentId: string; filename: string; role: "candidate_output" | "supporting_context";
  versionKey: string | null; source: EvidenceSource; pageCount: number | null; index: number; // 1-based within its group
};

type RawRef = Partial<AttachmentEvidence> & { attachment_id?: string };

// Validate one raw model reference against authoritative metadata. Returns the normalized evidence
// (with the AUTHORITATIVE filename/role/version) or a reason string for stripping it.
function validateOne(ref: RawRef, byId: Map<string, EvidenceMeta>, textById: Record<string, string>): { ok: true; ev: AttachmentEvidence } | { ok: false; reason: string } {
  const id = typeof ref.attachment_id === "string" ? ref.attachment_id : "";
  const m = byId.get(id);
  if (!m) return { ok: false, reason: "unknown attachment_id" };
  if (ref.role && ref.role !== m.role) return { ok: false, reason: "role mismatch" };
  if (ref.version_key != null && String(ref.version_key) !== String(m.versionKey ?? "")) return { ok: false, reason: "version mismatch" };
  if (ref.source_type && ref.source_type !== m.source) return { ok: false, reason: "source_type mismatch" };
  const basis: EvidenceBasis = ref.basis === "visual" ? "visual" : "text";

  const ev: AttachmentEvidence = {
    attachment_id: id, filename: m.filename, role: m.role, // filename/role are AUTHORITATIVE, never the model's
    ...(m.versionKey ? { version_key: m.versionKey } : {}),
    source_type: m.source, basis,
    ...(ref.section && typeof ref.section === "string" ? { section: ref.section.slice(0, 200) } : {}),
  };

  if (m.source === "image") {
    if (ref.image_index != null) {
      if (!Number.isInteger(ref.image_index) || ref.image_index !== m.index) return { ok: false, reason: "invalid image_index" };
      ev.image_index = ref.image_index;
    }
  } else if (m.source === "pdf" && (ref.page_start != null || ref.page_end != null)) {
    const ps = ref.page_start, pe = ref.page_end ?? ref.page_start;
    if (!Number.isInteger(ps) || !Number.isInteger(pe)) return { ok: false, reason: "non-integer page" };
    if ((ps as number) < 1 || (pe as number) < (ps as number)) return { ok: false, reason: "invalid page range" };
    if (m.pageCount != null && (pe as number) > m.pageCount) return { ok: false, reason: "page out of range" };
    ev.page_start = ps as number; ev.page_end = pe as number;
  }

  // Quotations: only text-basis findings may quote, and the quote must really be in the extracted text.
  // A visual finding may point at an image/page but must NOT fabricate a quotation.
  if (basis === "text" && ref.excerpt && typeof ref.excerpt === "string") {
    const src = (textById[id] || "").toLowerCase();
    const q = ref.excerpt.trim().toLowerCase();
    if (q && src.includes(q)) ev.excerpt = ref.excerpt.trim().slice(0, 300);
    else return { ok: false, reason: "excerpt not found in extracted text" };
  }
  // basis === visual: any model-supplied excerpt is dropped (never a fabricated quote).
  return { ok: true, ev };
}

export function validateEvidence(refs: unknown, meta: EvidenceMeta[], textById: Record<string, string> = {}): { evidence: AttachmentEvidence[]; warnings: string[] } {
  const byId = new Map(meta.map((m) => [m.attachmentId, m]));
  const out: AttachmentEvidence[] = [];
  const warnings: string[] = [];
  const list = Array.isArray(refs) ? refs : [];
  for (const r of list.slice(0, 64)) {
    const res = validateOne((r || {}) as RawRef, byId, textById);
    if (res.ok) out.push(res.ev);
    else warnings.push(`stripped evidence: ${res.reason}`); // redacted -- reason only, no content/id
  }
  return { evidence: out, warnings };
}
