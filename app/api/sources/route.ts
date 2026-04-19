import { NextResponse } from "next/server";
import { getDesktopUserEmailFromRequest } from "../../../lib/desktop-auth";
import { createSource, listSourcesForEmail } from "../../../lib/chat-sources";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB

// GET /api/sources — list the user's uploaded reference materials.
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

// POST /api/sources — multipart/form-data with a "file" field.
// Accepts PDF / MD / TXT, ≤5MB. PDFs are stored with their filename
// only — text extraction lands in v0.1.5.
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
    // TODO v0.1.5 — extract text from PDFs (pdfjs / pdf-parse). For
    // the v0.1.4 scaffold we keep just the filename so users can see
    // the source listed and delete it; nothing is injected at chat time.
    body = `[PDF: ${name} — text extraction lands in v0.1.5]`;
  } else {
    try {
      body = await file.text();
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
