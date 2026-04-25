// Minimal ambient declaration for the `pdf-parse` CJS package, which
// ships no types. We only use `text` from the result, but the rest of
// the public surface is declared loosely so future callers can grow.
declare module "pdf-parse" {
  interface PdfParseResult {
    text: string;
    numpages?: number;
    numrender?: number;
    info?: Record<string, unknown>;
    metadata?: unknown;
    version?: string;
  }
  function pdf(
    data: Buffer | Uint8Array,
    options?: Record<string, unknown>,
  ): Promise<PdfParseResult>;
  export = pdf;
}
