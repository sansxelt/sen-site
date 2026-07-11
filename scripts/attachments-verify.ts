// Credit-free verification of attachment validation (MIME sniffing, size/format/empty rules, filename
// sanitization). Pure logic, no storage/DB/network. Run: npx tsx scripts/attachments-verify.ts
import { sniffMime, sanitizeFilename, LIMITS } from "../lib/v-attachments";
import { validateFile } from "../lib/v-attachments-validate";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20)]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBP"), Buffer.alloc(8)]);
const PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n");
const ZIP = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(20)]);
const TXT = Buffer.from("hello world\nthis is plain text with no null bytes");
const MD = Buffer.from("# Heading\n\nsome **markdown** body");
const EXE = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00]); // MZ (PE) — unsupported

// ── sniffMime: magic bytes decide; office subtype needs the extension; unsupported -> null ──
ok("png sniffed", sniffMime(PNG, "shot.png") === "image/png");
ok("jpeg sniffed", sniffMime(JPEG, "shot.jpg") === "image/jpeg");
ok("webp sniffed", sniffMime(WEBP, "shot.webp") === "image/webp");
ok("pdf sniffed", sniffMime(PDF, "doc.pdf") === "application/pdf");
ok("docx = zip + .docx ext", sniffMime(ZIP, "brief.docx") === "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
ok("pptx = zip + .pptx ext", sniffMime(ZIP, "deck.pptx") === "application/vnd.openxmlformats-officedocument.presentationml.presentation");
ok("zip with unsupported ext (xlsx) -> null", sniffMime(ZIP, "sheet.xlsx") === null);
ok("txt sniffed by content+ext", sniffMime(TXT, "notes.txt") === "text/plain");
ok("md sniffed", sniffMime(MD, "readme.md") === "text/markdown");
ok("png bytes but .txt ext -> still png (magic wins, not extension)", sniffMime(PNG, "trick.txt") === "image/png");
ok("exe/PE -> unsupported", sniffMime(EXE, "malware.exe") === null);
ok("text bytes but no txt/md ext -> unsupported (no false text accept)", sniffMime(TXT, "notes.rtf") === null);

// ── validateFile: format + size + empty (PDF page-count path tested live) ──
async function main() {
  const img = await validateFile(PNG, "shot.png");
  ok("validate image -> vision-capable", "mime" in img && img.kind === "image" && img.vision === true);
  const txt = await validateFile(TXT, "notes.txt");
  ok("validate text -> not vision, is text-capable path", "mime" in txt && txt.kind === "text" && txt.vision === false);
  const empty = await validateFile(Buffer.alloc(0), "x.png");
  ok("empty file rejected", "error" in empty && empty.error === "empty_file");
  const big = await validateFile(Buffer.concat([PNG, Buffer.alloc(LIMITS.maxBytes + 1)]), "big.png");
  ok("oversized rejected (>20MB)", "error" in big && big.error === "too_large", "error" in big ? big.message : "");
  const bad = await validateFile(EXE, "x.exe");
  ok("unsupported type rejected", "error" in bad && bad.error === "unsupported_type");
  const docx = await validateFile(ZIP, "brief.docx");
  ok("docx detected but NOT supported yet (clear message, not generic)", "error" in docx && docx.error === "not_supported_yet");
  const pptx = await validateFile(ZIP, "deck.pptx");
  ok("pptx not supported yet", "error" in pptx && pptx.error === "not_supported_yet");

  // ── sanitizeFilename: strip paths + unsafe chars, KEEP digits/dots ──
  ok("keeps digits/extension", sanitizeFilename("game-concept-page-1.png") === "game-concept-page-1.png");
  ok("strips path traversal", sanitizeFilename("../../../etc/passwd") === "passwd");
  ok("strips windows path + reserved chars", sanitizeFilename('C:\\bad<>:"|?*name.png').includes("name.png") && !/[<>:"|?*\\]/.test(sanitizeFilename('C:\\bad<>:"|?*name.png')));
  ok("trims + non-empty fallback", sanitizeFilename("   ") === "file");

  ok("limits sane", LIMITS.filesPerVersion === 5 && LIMITS.contextFiles === 5 && LIMITS.maxImagesTotal === 20 && LIMITS.maxPages === 50 && LIMITS.maxBytes === 20 * 1024 * 1024);

  console.log(`\n${pass}/${pass + fail} passed`);
  if (fail) process.exit(1);
}
main();
