// POST /api/v/upload — server-side upload of a (client-resized) option image to
// Supabase Storage. Validates type + size, stores at an unguessable per-user path,
// returns the public URL + path. Falls back to returning the data URL (base64) if
// Storage isn't ready, so uploads never hard-break.
// DELETE /api/v/upload?path=... — remove a draft asset (only within your namespace).

import { NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/auth";
import { uploadAsset, deleteAsset } from "@/lib/v-storage";

export const runtime = "nodejs";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 2 * 1024 * 1024; // 2MB decoded (client already resizes to ~720px JPEG)

function ns(email: string): string {
  return crypto.createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 16);
}

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const dataUrl = typeof body?.dataUrl === "string" ? body.dataUrl : "";
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return NextResponse.json({ error: "bad_image" }, { status: 400 });
  const mime = m[1];
  if (!ALLOWED.has(mime)) return NextResponse.json({ error: "unsupported_type" }, { status: 400 });

  const buffer = Buffer.from(m[2], "base64");
  if (buffer.length === 0) return NextResponse.json({ error: "bad_image" }, { status: 400 });
  if (buffer.length > MAX_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });

  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const path = `users/${ns(email)}/${crypto.randomUUID()}.${ext}`;
  const url = await uploadAsset(path, buffer, mime);

  if (url) return NextResponse.json({ url, path, mime, size: buffer.length });
  // Storage not configured / bucket missing → keep working with the base64 data URL.
  return NextResponse.json({ url: dataUrl, path: null, mime, size: buffer.length, fallback: true });
}

export async function DELETE(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const path = new URL(req.url).searchParams.get("path") || "";
  if (path && path.startsWith(`users/${ns(email)}/`)) await deleteAsset(path);
  return NextResponse.json({ ok: true });
}
