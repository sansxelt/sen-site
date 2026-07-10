// Supabase Storage for test option images. Service-role only (never client).
// Public bucket so voting/report/embed can render the asset by URL without auth.

import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";

export const ASSET_BUCKET = "vraelis-test-assets";

export async function uploadAsset(path: string, body: Buffer, contentType: string): Promise<string | null> {
  if (!isDatabaseConfigured()) return null;
  const s = getSupabaseAdminClient();
  const { error } = await s.storage.from(ASSET_BUCKET).upload(path, body, { contentType, upsert: false });
  if (error) { console.error("uploadAsset:", error.message); return null; }
  const { data } = s.storage.from(ASSET_BUCKET).getPublicUrl(path);
  return data?.publicUrl ?? null;
}

export async function deleteAsset(path: string): Promise<void> {
  if (!path || !isDatabaseConfigured()) return;
  try { await getSupabaseAdminClient().storage.from(ASSET_BUCKET).remove([path]); } catch { /* best-effort */ }
}

// ── AI Check attachments: a PRIVATE bucket (unlike ASSET_BUCKET). No public URLs ever; the app
// hands out short-lived signed URLs. Service-role only. ──
export const CHECK_BUCKET = "vraelis-check-attachments";

// Idempotently ensure the private bucket exists. Safe to call before each upload; a duplicate
// createBucket just returns an "already exists" error we ignore.
async function ensureCheckBucket(): Promise<boolean> {
  const s = getSupabaseAdminClient();
  const { error } = await s.storage.createBucket(CHECK_BUCKET, { public: false });
  if (error && !/exist/i.test(error.message)) { console.error("ensureCheckBucket:", error.message); return false; }
  return true;
}

export async function uploadCheckAttachment(path: string, body: Buffer, contentType: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  if (!(await ensureCheckBucket())) return false;
  const s = getSupabaseAdminClient();
  const { error } = await s.storage.from(CHECK_BUCKET).upload(path, body, { contentType, upsert: false });
  if (error) { console.error("uploadCheckAttachment:", error.message); return false; }
  return true;
}

// Short-lived signed URL for reading a private attachment (default 5 min). Null on failure.
export async function signedCheckUrl(path: string, ttlSeconds = 300): Promise<string | null> {
  if (!path || !isDatabaseConfigured()) return null;
  try {
    const { data, error } = await getSupabaseAdminClient().storage.from(CHECK_BUCKET).createSignedUrl(path, ttlSeconds);
    if (error) { console.error("signedCheckUrl:", error.message); return null; }
    return data?.signedUrl ?? null;
  } catch { return null; }
}

// Download raw bytes of a private attachment (for server-side extraction / vision in pass 2).
export async function downloadCheckAttachment(path: string): Promise<Buffer | null> {
  if (!path || !isDatabaseConfigured()) return null;
  try {
    const { data, error } = await getSupabaseAdminClient().storage.from(CHECK_BUCKET).download(path);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  } catch { return null; }
}

export async function deleteCheckAttachments(paths: string[]): Promise<void> {
  const clean = paths.filter(Boolean);
  if (!clean.length || !isDatabaseConfigured()) return;
  try { await getSupabaseAdminClient().storage.from(CHECK_BUCKET).remove(clean); } catch { /* best-effort */ }
}
