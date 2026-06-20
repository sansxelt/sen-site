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
