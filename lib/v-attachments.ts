// AI Check attachments: the shared contract for files attached to a check — the supported formats,
// the limits, server-side MIME sniffing (magic bytes, never the client's claimed type or the
// extension alone), and per-file validation. Storage + DB live in lib/v-storage.ts and the upload
// route; this module is pure/deterministic so the rules are testable without I/O.
//
// Pass 1 scope: images (png/jpg/webp) + PDF are native to the check's vision model; txt/md are plain
// text; docx/pptx are ACCEPTED and stored, with text extraction added in pass 2. No file is fed to the
// evaluator yet in pass 1.

export type AttachmentRole = "candidate_output" | "supporting_context";
export type FileKind = "image" | "pdf" | "office" | "text";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

type FormatDef = { kind: FileKind; ext: string[]; vision: boolean };
// LEAN release: only formats the check can genuinely understand end-to-end are exposed. Images + PDF are
// native to the vision model; txt/md are plain text. DOCX/PPTX are DETECTED (see sniffMime + COMING_SOON)
// so we can return a clear "not supported yet" instead of a broken promise, but they are NOT offered.
// vision:true = the model reads the file visually (layout, hierarchy, imagery), not just its text.
export const FORMATS: Record<string, FormatDef> = {
  "image/png": { kind: "image", ext: ["png"], vision: true },
  "image/jpeg": { kind: "image", ext: ["jpg", "jpeg"], vision: true },
  "image/webp": { kind: "image", ext: ["webp"], vision: true },
  "application/pdf": { kind: "pdf", ext: ["pdf"], vision: true },
  "text/plain": { kind: "text", ext: ["txt"], vision: false },
  "text/markdown": { kind: "text", ext: ["md", "markdown"], vision: false },
};
// Detected but not yet processable end-to-end. Kept out of FORMATS on purpose.
export const COMING_SOON: ReadonlySet<string> = new Set([DOCX_MIME, PPTX_MIME]);
// For the UI: the accept filter + the human-readable supported list.
export const ACCEPT_EXT = Object.values(FORMATS).flatMap((f) => f.ext).map((e) => `.${e}`);
export const ACCEPT_MIME = Object.keys(FORMATS);
export const SUPPORTED_LABEL = "PNG, JPG, WEBP, PDF, TXT, MD";

export const LIMITS = {
  filesPerVersion: 5,
  contextFiles: 5,
  maxBytes: 20 * 1024 * 1024, // 20 MB
  maxPages: 50,
  maxImagesTotal: 20,
  maxTextChars: 50_000,       // matches the pasted-text limit
};

export type UploadError =
  | "unsupported_type" | "not_supported_yet" | "too_large" | "empty_file" | "encrypted_pdf" | "unreadable_document" | "too_many_pages";

const ERROR_MESSAGES: Record<UploadError, string> = {
  unsupported_type: "This file type is not supported.",
  not_supported_yet: "Word and PowerPoint files aren't supported yet. Use PDF, an image, or text.",
  too_large: "This file is larger than the 20 MB limit.",
  empty_file: "This file is empty.",
  encrypted_pdf: "This PDF is encrypted and cannot be read.",
  unreadable_document: "We could not process this document.",
  too_many_pages: "This document exceeds the 50-page limit.",
};
export const uploadErrorMessage = (e: UploadError): string => ERROR_MESSAGES[e];

const ascii = (b: Buffer, s: number, e: number) => b.toString("ascii", s, e);

// Detect the real MIME from magic bytes. Zip-based office files (docx/pptx) share the PK signature, so
// they are disambiguated by extension AFTER confirming the container is a real zip. Plain text has no
// signature, so txt/md are accepted only when the extension matches and the bytes look like text.
export function sniffMime(buf: Buffer, filename: string): string | null {
  const ext = (filename.split(".").pop() || "").toLowerCase();
  if (buf.length >= 8 && buf[0] === 0x89 && ascii(buf, 1, 4) === "PNG") return "image/png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 12 && ascii(buf, 0, 4) === "RIFF" && ascii(buf, 8, 12) === "WEBP") return "image/webp";
  if (buf.length >= 5 && ascii(buf, 0, 5) === "%PDF-") return "application/pdf";
  // ZIP local-file header (PK\x03\x04, or the empty/spanned variants) -> an OOXML office file by extension.
  if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07)) {
    if (ext === "docx") return DOCX_MIME;
    if (ext === "pptx") return PPTX_MIME;
    return null; // a zip we do not support (xlsx, plain .zip, etc.)
  }
  if ((ext === "txt" || ext === "md" || ext === "markdown") && isProbablyText(buf)) return ext === "txt" ? "text/plain" : "text/markdown";
  return null;
}

// Heuristic: real text has no NUL bytes and is mostly printable in its first chunk.
function isProbablyText(buf: Buffer): boolean {
  const n = Math.min(buf.length, 8192);
  if (n === 0) return false;
  let ctrl = 0;
  for (let i = 0; i < n; i++) {
    const c = buf[i];
    if (c === 0) return false;                                   // NUL -> binary
    if (c < 9 || (c > 13 && c < 32)) ctrl++;                     // odd control chars
  }
  return ctrl / n < 0.1;
}

// The validated-file shape. validateFile itself lives in the SERVER-ONLY lib/v-attachments-validate.ts
// (it dynamically imports pdf-parse, which needs Node's `fs`) so this module stays safe to import from
// "use client" components.
export type ValidatedFile = { mime: string; kind: FileKind; vision: boolean; pageCount: number | null };

// Strip path separators, control chars, and filesystem-reserved chars; keep a bounded display name.
export function sanitizeFilename(name: string): string {
  const base = (name || "file").split(/[/\\]/).pop() || "file";
  const cleaned = base.replace(/[\x00-\x1f<>:"/\\|?*]+/g, "_").trim();
  return cleaned.slice(0, 200) || "file";
}
