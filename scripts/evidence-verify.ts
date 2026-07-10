// Automated verification of structured-evidence validation (Pass 2A Phase 3 A/B). Pure logic: valid
// references are accepted (with AUTHORITATIVE metadata), every malformed variant is stripped, and a
// usable evaluation survives. Run: npx tsx scripts/evidence-verify.ts
import { validateEvidence, type EvidenceMeta } from "../lib/v-evidence";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean) => { console.log(`${c ? "PASS" : "FAIL"}  ${n}`); if (c) pass++; else fail++; };

const meta: EvidenceMeta[] = [
  { attachmentId: "img1", filename: "screen.png", role: "candidate_output", versionKey: "A", source: "image", pageCount: null, index: 1 },
  { attachmentId: "pdf1", filename: "report.pdf", role: "candidate_output", versionKey: "A", source: "pdf", pageCount: 5, index: 1 },
  { attachmentId: "txt1", filename: "notes.txt", role: "supporting_context", versionKey: null, source: "text", pageCount: null, index: 1 },
];
const textById = { txt1: "The refund policy states no refunds after 30 days." };
const V = (r: unknown[]) => validateEvidence(r, meta, textById);

// Valid references accepted, with authoritative metadata.
ok("valid image (visual) accepted", V([{ attachment_id: "img1", role: "candidate_output", version_key: "A", source_type: "image", image_index: 1, basis: "visual" }]).evidence.length === 1);
const fake = V([{ attachment_id: "img1", filename: "HACKED-passwords.png", role: "candidate_output", source_type: "image", basis: "visual" }]);
ok("model filename REPLACED with authoritative filename", fake.evidence.length === 1 && fake.evidence[0].filename === "screen.png");
ok("valid PDF page range accepted", V([{ attachment_id: "pdf1", source_type: "pdf", page_start: 2, page_end: 3, basis: "text" }]).evidence.length === 1);
ok("valid text excerpt (present in extracted text) accepted", V([{ attachment_id: "txt1", source_type: "text", basis: "text", excerpt: "no refunds after 30 days" }]).evidence.length === 1);
const vq = V([{ attachment_id: "img1", source_type: "image", basis: "visual", excerpt: "a fabricated visual quote" }]);
ok("visual finding kept but its fabricated quotation is DROPPED", vq.evidence.length === 1 && vq.evidence[0].excerpt === undefined);

// Every malformed variant stripped.
const strip = (name: string, ref: unknown) => { const r = V([ref]); ok(name, r.evidence.length === 0 && r.warnings.length === 1); };
strip("unknown attachment_id stripped", { attachment_id: "ghost", basis: "visual" });
strip("wrong candidate (version) stripped", { attachment_id: "img1", version_key: "B", basis: "visual" });
strip("wrong role stripped", { attachment_id: "img1", role: "supporting_context", basis: "visual" });
strip("context presented as candidate_output stripped", { attachment_id: "txt1", role: "candidate_output", basis: "text" });
strip("candidate presented as context stripped", { attachment_id: "img1", role: "supporting_context", basis: "visual" });
strip("impossible page (> page count) stripped", { attachment_id: "pdf1", source_type: "pdf", page_start: 99, basis: "text" });
strip("reversed page range stripped", { attachment_id: "pdf1", source_type: "pdf", page_start: 4, page_end: 2, basis: "text" });
strip("invalid screenshot index stripped", { attachment_id: "img1", source_type: "image", image_index: 5, basis: "visual" });
strip("fabricated text excerpt stripped", { attachment_id: "txt1", source_type: "text", basis: "text", excerpt: "we guarantee same-day refunds" });
strip("wrong source_type stripped", { attachment_id: "img1", source_type: "pdf", basis: "text" });

// A usable evaluation survives: mix one valid + several invalid -> the valid one is kept, the rest warned.
const mixed = V([{ attachment_id: "img1", source_type: "image", basis: "visual", image_index: 1 }, { attachment_id: "ghost" }, { attachment_id: "pdf1", page_start: 99, basis: "text" }]);
ok("recoverable: valid kept, invalid stripped, evaluation survives", mixed.evidence.length === 1 && mixed.warnings.length === 2);

console.log(`\n${pass}/${pass + fail} passed`);
if (fail) process.exit(1);
