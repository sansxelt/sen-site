import { NextResponse } from "next/server";
import { getDesktopUserEmailFromRequest } from "../../../lib/desktop-auth";
import { createSource, listSourcesForEmail } from "../../../lib/chat-sources";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_EXTRACTED_CHARS = 100_000;

// pdf-parse ships as CJS and uses `Buffer`, so we must run on the
// Node runtime (declared above) and import lazily inside the handler.
// Eager top-level imports trigger pdf-parse's debug branch on cold
// start, which tries to read a sample PDF off disk and crashes.
function truncate(text: string): string {
  if (text.length <= MAX_EXTRACTED_CHARS) return text;
  const original = text.length;
  return `${text.slice(0, MAX_EXTRACTED_CHARS)}\u2026 [truncated, original was ${original} chars]`;
}

// GET /api/sources, list the user's uploaded reference materials.
export async function GET(request: Request) {
  const email = await getDesktopUserEmailFromRequest(request);
  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const sources = await listSourcesForEmail(email);
    return NextResponse.json({ sources });
  } catch (err) {
    console.error("sources.list failed:", err);
    return NextResponse.json(
      { error: "Could not load sources." },
      { status: 500 },
    );
  }
}

// POST /api/sources, multipart/form-data with a "file" field.
// Accepts PDF / MD / TXT, ≤5MB. PDFs are parsed with `pdf-parse`
// and the extracted text is capped at MAX_EXTRACTED_CHARS so a
// hundred-page report can't blow the row size.
export async function POST(request: Request) {
  const email = await getDesktopUserEmailFromRequest(request);
  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File too large (5MB max)." },
      { status: 413 },
    );
  }

  const name = file.name || "untitled";
  const lower = name.toLowerCase();
  const isPdf = lower.endsWith(".pdf") || file.type === "application/pdf";
  const isText =
    lower.endsWith(".md") ||
    lower.endsWith(".markdown") ||
    lower.endsWith(".txt") ||
    file.type.startsWith("text/");

  if (!isPdf && !isText) {
    return NextResponse.json(
      { error: "Only PDF, MD, or TXT files are supported." },
      { status: 400 },
    );
  }

  let body = "";
  if (isPdf) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      // Lazy require so the CJS module's debug branch never runs at
      // import time, and so Next's bundler doesn't try to follow the
      // sample-PDF read in QUICKSTART.js.
      const pdfParseMod = (await import("pdf-parse")) as
        | { default: (b: Buffer) => Promise<{ text: string }> }
        | ((b: Buffer) => Promise<{ text: string }>);
      const pdfParse =
        typeof pdfParseMod === "function" ? pdfParseMod : pdfParseMod.default;
      const parsed = await pdfParse(buffer);
      const text = (parsed?.text ?? "").trim();
      if (!text) {
        return NextResponse.json(
          { error: "Could not extract any text from this PDF (it may be scanned or image-only)." },
          { status: 422 },
        );
      }
      body = truncate(text);
    } catch (err) {
      console.error("sources.pdf-extract failed:", err);
      return NextResponse.json(
        { error: "Could not read this PDF. Try re-exporting it as a text-based PDF." },
        { status: 422 },
      );
    }
  } else {
    try {
      const raw = await file.text();
      body = truncate(raw);
    } catch {
      return NextResponse.json(
        { error: "Could not read file body." },
        { status: 400 },
      );
    }
  }

  try {
    const source = await createSource(email, {
      title: name,
      body,
      byte_size: file.size,
    });
    return NextResponse.json({ source }, { status: 201 });
  } catch (err) {
    console.error("sources.create failed:", err);
    return NextResponse.json(
      { error: "Could not save source." },
      { status: 500 },
    );
  }
}
