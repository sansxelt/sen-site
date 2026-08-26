// Account profile API (owner-scoped; the owner is ONLY the session email, never client input).
//   GET    /api/v/avatar    -> { url: string | null, displayName: string | null }
//                              url is a short-TTL signed URL to the PRIVATE avatar object (owner only);
//                              null means "no picture" and the UI falls back to initials.
//   POST   /api/v/avatar    multipart: file (jpeg/png/webp, <= 2 MB, magic-byte validated)
//                              -> { url } ; overwrites the previous picture in place.
//   DELETE /api/v/avatar    -> { ok: true } ; removes the picture (UI falls back to initials).
//   PATCH  /api/v/avatar    { displayName } -> { displayName } ; the profile field that lives
//                              alongside the picture (v_profiles.display_name).
// Fails CLOSED with a clear message when the private bucket has not been provisioned
// (operator action: sql/vraelis-avatars.sql). No storage paths or secrets in responses or logs.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { allowStrict } from "@/lib/vraelis-ratelimit";
import { AVATAR_MAX_BYTES, sniffAvatarImage, putAvatar, signedAvatarUrl, removeAvatar } from "@/lib/v-avatar";
import { cleanDisplayName, getDisplayName, setDisplayName, DISPLAY_NAME_MAX } from "@/lib/v-account-profile";

export const runtime = "nodejs";
export const maxDuration = 30;

async function requireOwner(): Promise<string | null> {
  const email = (await auth())?.user?.email;
  return email ? email.trim().toLowerCase() : null;
}

const fail = (message: string, status = 400, code = "validation_error") =>
  NextResponse.json({ error: code, message }, { status });

const BUCKET_MISSING_MSG =
  'Profile picture storage is not set up yet. An operator must create the private storage bucket "vraelis-avatars" (see sql/vraelis-avatars.sql).';

function writeFailure(reason: "bucket_missing" | "unavailable") {
  return reason === "bucket_missing"
    ? fail(BUCKET_MISSING_MSG, 503, "bucket_missing")
    : fail("Profile picture storage is unavailable right now. Try again.", 503, "storage_unavailable");
}

export async function GET() {
  const u = await requireOwner();
  if (!u) return fail("Sign in.", 401, "signin_required");
  const [url, displayName] = await Promise.all([signedAvatarUrl(u), getDisplayName(u)]);
  return NextResponse.json({ url, displayName });
}

export async function POST(req: Request) {
  const u = await requireOwner();
  if (!u) return fail("Sign in.", 401, "signin_required");
  if (!(await allowStrict(`avatar:${u}`, 20, 600))) return fail("Too many uploads. Try again in a few minutes.", 429, "rate_limited");

  const form = await req.formData().catch(() => null);
  if (!form) return fail("Expected a multipart file upload.");
  const file = form.get("file");
  if (!(file instanceof Blob)) return fail("No image provided.");
  if (file.size > AVATAR_MAX_BYTES) return fail("The image is over 2 MB. Crop or resize it and try again.", 413, "too_large");

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length === 0) return fail("The file is empty.");
  if (buffer.length > AVATAR_MAX_BYTES) return fail("The image is over 2 MB. Crop or resize it and try again.", 413, "too_large");

  // Magic bytes decide the type; the client-declared content type is ignored.
  const mime = sniffAvatarImage(buffer);
  if (!mime) return fail("That file is not a JPEG, PNG, or WebP image.", 400, "unsupported_type");

  const put = await putAvatar(u, buffer, mime);
  if (!put.ok) return writeFailure(put.reason);

  const url = await signedAvatarUrl(u);
  if (!url) return fail("Saved, but the preview link could not be created. Reload to see your picture.", 500, "internal_error");
  return NextResponse.json({ url });
}

export async function DELETE() {
  const u = await requireOwner();
  if (!u) return fail("Sign in.", 401, "signin_required");
  const res = await removeAvatar(u);
  if (!res.ok) return writeFailure(res.reason);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const u = await requireOwner();
  if (!u) return fail("Sign in.", 401, "signin_required");
  const body = (await req.json().catch(() => ({}))) as { displayName?: unknown };
  if (typeof body.displayName !== "string") return fail("Missing displayName.");
  if (body.displayName.length > 500) return fail(`Display name must be ${DISPLAY_NAME_MAX} characters or fewer.`);
  const name = cleanDisplayName(body.displayName);
  if (!(await setDisplayName(u, name))) return fail("Could not save your name right now. Try again.", 503, "storage_unavailable");
  return NextResponse.json({ displayName: name });
}
