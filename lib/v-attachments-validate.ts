// SERVER-ONLY attachment validation. Split out of lib/v-attachments.ts because it dynamically imports
// pdf-parse (which needs Node's `fs`); keeping it here means the client-safe constants in v-attachments
// can be imported by "use client" components (the upload zone) without dragging pdf-parse/fs into the
// browser bundle. Only server routes import this module. pdf-parse is also in serverExternalPackages.

import { sniffMime, FORMATS, LIMITS, COMING_SOON, uploadErrorMessage, type UploadError, type ValidatedFile } from "./v-attachments";

// PDF page count + readability. pdf-parse throws on corrupt PDFs; encrypted PDFs are caught by the
// /Encrypt marker (best effort). Lazy dynamic import of the main entry (matches app/api/sources) so the
// CJS debug branch never runs at import time.
async function pdfInfo(buf: Buffer): Promise<{ pages: number } | { error: UploadError }> {
  const head = buf.toString("latin1", 0, Math.min(buf.length, 4096));
  const tail = buf.toString("latin1", Math.max(0, buf.length - 4096));
  if (/\/Encrypt\b/.test(head) || /\/Encrypt\b/.test(tail)) return { error: "encrypted_pdf" };
  try {
    const mod = (await import("pdf-parse")) as
      | { default: (b: Buffer) => Promise<{ numpages?: number }> }
      | ((b: Buffer) => Promise<{ numpages?: number }>);
    const parse = typeof mod === "function" ? mod : mod.default;
    const data = await parse(buf);
    const pages = data?.numpages ?? 0;
    if (!pages) return { error: "unreadable_document" };
    return { pages };
  } catch {
    return { error: "unreadable_document" };
  }
}

// Validate ONE file's bytes (format, size, and for PDFs page-count + readability). Count limits
// (per version / per context / total images) are enforced by the route against current DB counts.
export async function validateFile(buffer: Buffer, filename: string): Promise<ValidatedFile | { error: UploadError; message: string }> {
  const err = (error: UploadError) => ({ error, message: uploadErrorMessage(error) });
  if (buffer.length === 0) return err("empty_file");
  if (buffer.length > LIMITS.maxBytes) return err("too_large");
  const mime = sniffMime(buffer, filename);
  if (mime && COMING_SOON.has(mime)) return err("not_supported_yet"); // detected DOCX/PPTX -> clear message
  if (!mime || !FORMATS[mime]) return err("unsupported_type");
  const fmt = FORMATS[mime];

  let pageCount: number | null = null;
  if (fmt.kind === "pdf") {
    const info = await pdfInfo(buffer);
    if ("error" in info) return err(info.error);
    if (info.pages > LIMITS.maxPages) return err("too_many_pages");
    pageCount = info.pages;
  }
  return { mime, kind: fmt.kind, vision: fmt.vision, pageCount };
}
