// Phase 8J server/UI contract tests. Deterministic, no browser. Exercises the SHARED pure helpers the
// check form + report actually use (lib/v-check-ui.ts) plus the DB-level ownership boundary the signed-
// preview route relies on. Anything that requires a real browser (focus trap, drag feel, dialog paint)
// is left to the Playwright suite -- these are NOT browser-verified.
//   Pure-only (no DB):  npx tsx scripts/ui-contract-verify.ts
//   With ownership DB check: VRAELIS_CONTRACT_DB=1 npx tsx scripts/ui-contract-verify.ts
import crypto from "node:crypto";
import { loadEnvConfig } from "@next/env";
import {
  analysisFromUploads, canSubmitCheck, submissionIdFor, CAPABILITY_LABEL, evidenceChipLabel,
  groupReportSources, evidenceForSource, type ReportAttachment,
} from "../lib/v-check-ui";
import type { AttachmentEvidence } from "../lib/v-evidence";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };
const eq = (n: string, a: unknown, b: unknown) => ok(n, JSON.stringify(a) === JSON.stringify(b), `got ${JSON.stringify(a)}`);

// ── Analysis mode + counts (sticky summary truthfulness) ──
eq("analysis: images only -> Visual", analysisFromUploads(["image", "image"], false).mode, "Visual");
eq("analysis: pdf -> Text + visuals", analysisFromUploads(["pdf"], false).mode, "Text + visuals");
eq("analysis: txt only -> Text only", analysisFromUploads(["text"], false).mode, "Text only");
eq("analysis: image + pasted text -> Text + visuals", analysisFromUploads(["image"], true).mode, "Text + visuals");
eq("analysis: no files, pasted text -> Text only", analysisFromUploads([], true).mode, "Text only");
{ const a = analysisFromUploads(["image", "image", "pdf", "text"], false); eq("analysis counts", [a.images, a.pdfs, a.texts], [2, 1, 1]); }

// ── CTA gating ──
ok("CTA disabled while uploading", canSubmitCheck({ submittableCount: 1, anyUploading: true, anyFailed: false }) === false);
ok("CTA disabled with a failed attachment", canSubmitCheck({ submittableCount: 1, anyUploading: false, anyFailed: true }) === false);
ok("CTA disabled with nothing to submit", canSubmitCheck({ submittableCount: 0, anyUploading: false, anyFailed: false }) === false);
ok("CTA enabled when ready", canSubmitCheck({ submittableCount: 2, anyUploading: false, anyFailed: false }) === true);

// ── Idempotency key lifecycle ──
ok("text-only submit uses NO submission id", submissionIdFor(null, false, () => "x") === undefined);
{
  const mint = () => crypto.randomUUID();
  const first = submissionIdFor(null, true, mint);           // fresh attempt mints
  const again = submissionIdFor(first!, true, mint);         // same in-flight attempt reuses
  ok("same in-flight submission reuses the key", !!first && again === first);
  const afterTerminal = submissionIdFor(null, true, mint);   // terminal cleared ref -> new key
  ok("terminal retry mints a new key", !!afterTerminal && afterTerminal !== first);
}

// ── Capability labels come from persisted result data ──
eq("capability label: visual", CAPABILITY_LABEL.visual, "Visual analysis");
eq("capability label: text_and_visual", CAPABILITY_LABEL.text_and_visual, "Text + visual analysis");
eq("capability label: text_only_fallback", CAPABILITY_LABEL.text_only_fallback, "Text-only fallback");
eq("capability label: failed -> Not analyzed", CAPABILITY_LABEL.failed, "Not analyzed");

// ── Source grouping + per-version evidence isolation ──
const A1: ReportAttachment = { id: "a1", filename: "checkout.png", kind: "image", role: "candidate_output", versionKey: "vA", candidateLabel: "A", orderIndex: 0, pageCount: null };
const A2: ReportAttachment = { id: "a2", filename: "brief.pdf", kind: "pdf", role: "candidate_output", versionKey: "vA", candidateLabel: "A", orderIndex: 1, pageCount: 4 };
const B1: ReportAttachment = { id: "b1", filename: "v2.png", kind: "image", role: "candidate_output", versionKey: "vB", candidateLabel: "B", orderIndex: 0, pageCount: null };
const CTX: ReportAttachment = { id: "c1", filename: "brand-guide.pdf", kind: "pdf", role: "supporting_context", versionKey: null, candidateLabel: null, orderIndex: 0, pageCount: 8 };
// Deliberately unsorted input, incl. a text-only Version A ordering hazard (B listed before A).
const groups = groupReportSources([B1, CTX, A2, A1]);
eq("groups in letter order, context last", groups.map((g) => g.title), ["Version A", "Version B", "Supporting context"]);
eq("Version A items ordered by orderIndex", groups[0].items.map((i) => i.id), ["a1", "a2"]);

const evidence: AttachmentEvidence[] = [
  { attachment_id: "a1", filename: "checkout.png", role: "candidate_output", version_key: "vA", source_type: "image", image_index: 1, basis: "visual" },
  { attachment_id: "b1", filename: "v2.png", role: "candidate_output", version_key: "vB", source_type: "image", image_index: 1, basis: "visual" },
  { attachment_id: "c1", filename: "brand-guide.pdf", role: "supporting_context", source_type: "pdf", page_start: 7, page_end: 7, basis: "text" },
];
eq("valid OUTPUT evidence displayed for its own source", evidenceForSource(evidence, "a1").length, 1);
ok("wrong-candidate evidence never appears under another version", evidenceForSource(evidence, "a1").every((e) => e.attachment_id === "a1") && evidenceForSource(evidence, "b1")[0].attachment_id === "b1");
ok("Version A source shows no Version B evidence", evidenceForSource(evidence, "a1").every((e) => e.version_key !== "vB"));
eq("context evidence labeled Context", evidenceChipLabel(evidence[2]), "Context · brand-guide.pdf · Page 7");
eq("output image evidence chip", evidenceChipLabel(evidence[0]), "Output · Screenshot 1");
// Evidence that references an unknown source id is simply absent from every rendered source.
ok("evidence for an unknown source id renders nowhere", evidenceForSource(evidence, "zzz").length === 0);

// ── DB-level ownership boundary (what the signed-preview route enforces) ──
async function ownershipCheck() {
  loadEnvConfig(process.cwd());
  const db = await import("../lib/v-attachments-db");
  const st = await import("../lib/v-storage");
  const { screenshotPng } = await import("./fixtures");
  const ownerA = "contract-owner-a@vraelis.local", ownerB = "contract-owner-b@vraelis.local";
  const dk = `ct-${crypto.randomUUID()}`;
  const path = `users/contracttest/${dk}/${crypto.randomUUID()}`;
  await st.uploadCheckAttachment(path, screenshotPng(), "image/png");
  const row = await db.insertAttachment({ userId: ownerA, draftKey: dk, role: "candidate_output", versionKey: "A", filename: "s.png", mime: "image/png", sizeBytes: 60, storagePath: path, pageCount: null, capabilities: { text: false, vision: true }, orderIndex: 0 });
  try {
    ok("owner A can resolve their own attachment", !!(await db.getAttachment(ownerA, row!.id)));
    ok("owner B is DENIED (signed-preview ownership boundary)", (await db.getAttachment(ownerB, row!.id)) === null);
  } finally {
    await st.deleteCheckAttachments([path]);
    await db.deleteAttachmentRowsById([row!.id]);
  }
}

async function main() {
  if (process.env.VRAELIS_CONTRACT_DB === "1") await ownershipCheck();
  else console.log("SKIP  DB ownership boundary (set VRAELIS_CONTRACT_DB=1 to run)");
  console.log(`\n${pass}/${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
