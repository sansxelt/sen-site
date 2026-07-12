// Profile pictures: a PRIVATE Supabase Storage bucket ("vraelis-avatars"). Owner-only end to end:
// the object path is derived from the SESSION email (sha256), never from client input, so no schema
// row is needed and no plaintext identifier is stored. The app only ever hands out short-TTL signed
// URLs to the owner; there are no public URLs. Service-role only (never the client).
//
// The bucket is NOT auto-created: provisioning it is a deliberate operator action
// (sql/vraelis-avatars.sql). Every write fails closed with reason "bucket_missing" until then.

import crypto from "crypto";
import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";

export const AVATAR_BUCKET = "vraelis-avatars";
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MB, enforced client- AND server-side

export type AvatarMime = "image/jpeg" | "image/png" | "image/webp";

const norm = (email: string) => email.trim().toLowerCase();

// Fixed per-user path: replacement overwrites in place (automatic cleanup), removal deletes it.
// The stored content type is whatever the validated bytes actually are (see sniffAvatarImage).
export function avatarPath(email: string): string {
  return `${crypto.createHash("sha256").update(norm(email)).digest("hex")}/avatar.webp`;
}

// Magic-byte validation. The client-declared content type is never trusted; only these three
// signatures are accepted, everything else is rejected before any storage call.
export function sniffAvatarImage(buf: Buffer): AvatarMime | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length >= 12 && buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP") return "image/webp";
  return null;
}

export type AvatarWriteResult = { ok: true } | { ok: false; reason: "bucket_missing" | "unavailable" };

const isBucketMissing = (message: string) => /bucket/i.test(message) && /not.*found|does not exist/i.test(message);

export async function putAvatar(email: string, body: Buffer, contentType: AvatarMime): Promise<AvatarWriteResult> {
  if (!isDatabaseConfigured()) return { ok: false, reason: "unavailable" };
  const s = getSupabaseAdminClient();
  // upsert: replacing a picture overwrites the same object; no orphaned bytes to clean up.
  const { error } = await s.storage.from(AVATAR_BUCKET).upload(avatarPath(email), body, { contentType, upsert: true });
  if (error) {
    console.error("putAvatar:", error.message); // storage error text only; never the user identifier
    return { ok: false, reason: isBucketMissing(error.message) ? "bucket_missing" : "unavailable" };
  }
  return { ok: true };
}

// Short-TTL signed URL for the OWNER (default 5 min). Null when no picture exists (initials
// fallback) or storage is unavailable; readers treat both the same way.
export async function signedAvatarUrl(email: string, ttlSeconds = 300): Promise<string | null> {
  if (!isDatabaseConfigured()) return null;
  try {
    const { data, error } = await getSupabaseAdminClient().storage.from(AVATAR_BUCKET).createSignedUrl(avatarPath(email), ttlSeconds);
    if (error) return null; // missing object is the normal "no picture yet" case; not worth logging
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

export async function removeAvatar(email: string): Promise<AvatarWriteResult> {
  if (!isDatabaseConfigured()) return { ok: false, reason: "unavailable" };
  const { error } = await getSupabaseAdminClient().storage.from(AVATAR_BUCKET).remove([avatarPath(email)]);
  if (error) {
    console.error("removeAvatar:", error.message);
    return { ok: false, reason: isBucketMissing(error.message) ? "bucket_missing" : "unavailable" };
  }
  return { ok: true };
}
