// The immutable evaluation snapshot (Pass 2A §1). Before the evaluator runs, a check's attachments are
// validated and frozen into a normalized structure: each CANDIDATE is its pasted text plus its own
// ordered attachments; SUPPORTING CONTEXT is separate and never becomes a candidate. This is the single
// source the content-block builder + evaluator consume, so the real route and the test harness share it.
//
// Ownership: attachments are looked up by (owner, draftKey) via the owner-scoped listByDraft, so another
// user's rows can never appear -- there are no client-supplied attachment ids to validate here, and the
// draftKey is only a partition key WITHIN the owner. Any validation failure aborts BEFORE the model is
// called, so a bad/missing/foreign attachment can never lead to a charge.

import { checkObjectExists } from "./v-storage";
import { listByDraft, type AttachmentRow } from "./v-attachments-db";
import { FORMATS, type AttachmentRole, type FileKind } from "./v-attachments";

export type SnapshotAttachment = {
  attachmentId: string; filename: string; mime: string; kind: FileKind;
  role: AttachmentRole; versionKey: string | null; orderIndex: number;
  sizeBytes: number; pageCount: number | null;
  capabilities: { text: boolean; vision: boolean };
  storagePath: string; // INTERNAL ONLY — never placed in the evaluator result or any public response
};
export type CandidateSnapshot = { versionKey: string; text: string; attachments: SnapshotAttachment[] };
export type EvaluationSnapshot = {
  candidates: CandidateSnapshot[];
  context: { text: string; attachments: SnapshotAttachment[] };
  warnings: string[];
};
export type SnapshotError = "attachment_not_ready" | "attachment_unsupported" | "attachment_orphan_version" | "attachment_missing_object";
export type SnapshotResult =
  | { ok: true; snapshot: EvaluationSnapshot }
  | { ok: false; error: SnapshotError; message: string; attachmentId: string };

const toSnap = (r: AttachmentRow): SnapshotAttachment => ({
  attachmentId: r.id, filename: r.filename, mime: r.mime, kind: FORMATS[r.mime]?.kind ?? "text",
  role: r.role, versionKey: r.version_key, orderIndex: r.order_index, sizeBytes: r.size_bytes,
  pageCount: r.page_count, capabilities: { text: !!r.capabilities?.text, vision: !!r.capabilities?.vision },
  storagePath: r.storage_path,
});

export async function buildEvaluationSnapshot(
  owner: string,
  draftKey: string,
  versions: { versionKey: string; text: string }[],
  contextText: string,
): Promise<SnapshotResult> {
  const rows = draftKey ? await listByDraft(owner, draftKey) : [];
  const versionKeys = new Set(versions.map((v) => v.versionKey));
  const validated: SnapshotAttachment[] = [];

  for (const r of rows) {
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
  return { ok: true, snapshot: { candidates, context, warnings: [] } };
}
