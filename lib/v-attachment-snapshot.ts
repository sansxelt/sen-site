// The immutable evaluation snapshot (Pass 2A §1). Before the evaluator runs, a check's attachments are
// validated and frozen into a normalized structure: each CANDIDATE is its pasted text plus its own
// ordered attachments; SUPPORTING CONTEXT is a separate bucket that never becomes a candidate. This is
// the single source the content-block builder + evaluator consume, so the real route and the test
// harness share it.
//
// Integrity: the caller passes the exact set of attachment ids it submitted (expectedIds). The snapshot
// loads them owner-scoped; if ANY expected id is absent (foreign-owned, deleted, expired, wrong draft),
// it aborts with attachment_mismatch -- an owner-scoped empty result is secure, but the evaluation must
// notice it is about to judge LESS than the user submitted and stop. Every validation failure aborts
// BEFORE the model is called, so a bad/missing/foreign attachment can never lead to a charge.
// storage_path stays internal; the audit summary/hash never expose it.

import crypto from "crypto";
import { checkObjectExists } from "./v-storage";
import { listByDraft, type AttachmentRow } from "./v-attachments-db";
import { FORMATS, type AttachmentRole, type FileKind } from "./v-attachments";

export type SnapshotAttachment = {
  attachmentId: string; filename: string; mime: string; kind: FileKind;
  role: AttachmentRole; versionKey: string | null; orderIndex: number;
  sizeBytes: number; pageCount: number | null;
  capabilities: { text: boolean; vision: boolean };
  storagePath: string; // INTERNAL ONLY — never placed in a result, log, or public response
};
export type CandidateSnapshot = { versionKey: string; text: string; attachments: SnapshotAttachment[] };
// Redacted, audit-safe view of one evaluated input (no storage_path).
export type SnapshotSummaryItem = { attachmentId: string; role: AttachmentRole; versionKey: string | null; orderIndex: number; filename: string; mime: string; kind: FileKind; sizeBytes: number; pageCount: number | null };
export type EvaluationSnapshot = {
  candidates: CandidateSnapshot[];
  context: { text: string; attachments: SnapshotAttachment[] };
  summary: SnapshotSummaryItem[]; // what was evaluated, redacted — safe to persist on the result
  hash: string;                   // deterministic fingerprint of the exact evaluated inputs (content-free)
  warnings: string[];
};
export type SnapshotError = "attachment_mismatch" | "attachment_not_ready" | "attachment_unsupported" | "attachment_orphan_version" | "attachment_missing_object" | "empty_candidate";
export type SnapshotResult =
  | { ok: true; snapshot: EvaluationSnapshot }
  | { ok: false; error: SnapshotError; message: string; attachmentId?: string; versionKey?: string };

const toSnap = (r: AttachmentRow): SnapshotAttachment => ({
  attachmentId: r.id, filename: r.filename, mime: r.mime, kind: FORMATS[r.mime]?.kind ?? "text",
  role: r.role, versionKey: r.version_key, orderIndex: r.order_index, sizeBytes: r.size_bytes,
  pageCount: r.page_count, capabilities: { text: !!r.capabilities?.text, vision: !!r.capabilities?.vision },
  storagePath: r.storage_path,
});
const redact = (a: SnapshotAttachment): SnapshotSummaryItem => ({ attachmentId: a.attachmentId, role: a.role, versionKey: a.versionKey, orderIndex: a.orderIndex, filename: a.filename, mime: a.mime, kind: a.kind, sizeBytes: a.sizeBytes, pageCount: a.pageCount });
const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export async function buildEvaluationSnapshot(
  owner: string,
  draftKey: string,
  versions: { versionKey: string; text: string }[],
  contextText: string,
  expectedIds: string[] = [],
): Promise<SnapshotResult> {
  const expected = new Set(expectedIds.filter(Boolean));
  const rows = draftKey && expected.size ? await listByDraft(owner, draftKey) : [];
  const loaded = new Map(rows.map((r) => [r.id, r]));

  // Mismatch: every submitted id MUST have loaded owner-scoped. A foreign / deleted / wrong-draft id
  // simply won't be present -> abort rather than evaluate a smaller set than the user submitted.
  for (const id of expected) {
    if (!loaded.has(id)) return { ok: false, error: "attachment_mismatch", message: "One or more attached files could not be found for this check. Refresh the page, re-attach them, and try again.", attachmentId: id };
  }

  const versionKeys = new Set(versions.map((v) => v.versionKey));
  const validated: SnapshotAttachment[] = [];
  for (const id of expected) {
    const r = loaded.get(id)!;
    if (r.status !== "ready") return { ok: false, error: "attachment_not_ready", message: `"${r.filename}" is still processing. Wait for it to finish, then try again.`, attachmentId: r.id };
    if (!FORMATS[r.mime]) return { ok: false, error: "attachment_unsupported", message: `"${r.filename}" is not a supported file type.`, attachmentId: r.id };
    if (r.role === "candidate_output" && !(r.version_key && versionKeys.has(r.version_key))) {
      return { ok: false, error: "attachment_orphan_version", message: `"${r.filename}" is attached to a version that is not part of this check.`, attachmentId: r.id };
    }
    if (!(await checkObjectExists(r.storage_path))) return { ok: false, error: "attachment_missing_object", message: `"${r.filename}" could not be read from storage. Re-upload it and try again.`, attachmentId: r.id };
    validated.push(toSnap(r));
  }

  const byOrder = (a: SnapshotAttachment, b: SnapshotAttachment) => a.orderIndex - b.orderIndex || a.attachmentId.localeCompare(b.attachmentId);
  const candidates: CandidateSnapshot[] = versions.map((v) => ({
    versionKey: v.versionKey, text: v.text,
    attachments: validated.filter((a) => a.role === "candidate_output" && a.versionKey === v.versionKey).sort(byOrder),
  }));
  const context = { text: contextText, attachments: validated.filter((a) => a.role === "supporting_context").sort(byOrder) };

  // A candidate must carry SOMETHING to judge: pasted text or at least one valid attachment.
  for (const c of candidates) {
    if (!c.text.trim() && c.attachments.length === 0) return { ok: false, error: "empty_candidate", message: `Version ${c.versionKey} has no text and no files to check.`, versionKey: c.versionKey };
  }

  const summary = validated.map(redact).sort((a, b) => a.role.localeCompare(b.role) || (a.versionKey ?? "").localeCompare(b.versionKey ?? "") || a.orderIndex - b.orderIndex);
  // Content-free fingerprint of exactly what is evaluated: per-candidate text hash + ordered attachment ids.
  const canonical = JSON.stringify({
    candidates: candidates.map((c) => ({ v: c.versionKey, t: sha(c.text), a: c.attachments.map((x) => x.attachmentId) })),
    context: { t: sha(context.text), a: context.attachments.map((x) => x.attachmentId) },
  });
  return { ok: true, snapshot: { candidates, context, summary, hash: sha(canonical), warnings: [] } };
}
