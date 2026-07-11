// Report-side attachment loading, gated on AUTHORITATIVE persisted result data (never the public feature
// flag) so a completed attachment report stays viewable forever, while an ordinary text-only report runs
// NO extra attachment query. Injectable fetch so the gate is deterministically testable.

import { FORMATS } from "./v-attachments";
import type { AttachmentRow } from "./v-attachments-db";
import type { EvalResult } from "./v-evaluator";
import type { ReportAttachment } from "./v-check-ui";

// A check has attachments iff the persisted result carries a non-empty attachment summary (only written
// for multimodal checks, after a validated result). Text-only results never have it.
export function resultHasAttachments(result: Pick<EvalResult, "attachmentSummary"> | null | undefined): boolean {
  return !!(result?.attachmentSummary && result.attachmentSummary.length > 0);
}

export async function loadReportAttachments(
  result: EvalResult | null,
  checkId: string,
  owner: string,
  fetchByCheck: (owner: string, checkId: string) => Promise<AttachmentRow[]>,
): Promise<ReportAttachment[]> {
  if (!resultHasAttachments(result)) return []; // text-only report: do NOT touch the attachments table
  const labelById = new Map((result!.attachmentSummary ?? []).map((s) => [s.attachment_id, s.candidate_label]));
  const rows = await fetchByCheck(owner, checkId);
  return rows.map((r) => ({
    id: r.id, filename: r.filename, kind: FORMATS[r.mime]?.kind ?? "text", role: r.role,
    versionKey: r.version_key, candidateLabel: labelById.get(r.id) ?? null, orderIndex: r.order_index, pageCount: r.page_count,
  }));
}
