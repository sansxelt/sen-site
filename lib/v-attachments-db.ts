// DB access for v_check_attachments. This app uses NextAuth (not Supabase Auth), so every call goes
// through the SERVICE-ROLE client with an EXPLICIT owner filter (user_id = the NextAuth session email)
// on every query -- never trust a client-supplied owner. Defense in depth: RLS is enabled on the table
// with NO permissive policies (sql/ai-check-attachments-rls.sql), so the anon/public key can never read
// a row even if a future route forgets its owner filter (the service role bypasses RLS). Storage bytes
// live in lib/v-storage.ts (private bucket + signed URLs). Uploading rows here never charges a credit.

import crypto from "crypto";
import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";
import type { AttachmentRole } from "./v-attachments";

const TABLE = "v_check_attachments";
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000; // abandoned draft uploads are swept 24h after upload

export type AttachmentRow = {
  id: string; user_id: string; draft_key: string | null; check_id: string | null;
  role: AttachmentRole; version_key: string | null; order_index: number;
  filename: string; mime: string; size_bytes: number; storage_path: string;
  page_count: number | null; status: string; capabilities: { text?: boolean; vision?: boolean } | null;
  warnings: unknown; created_at: string;
};

export type NewAttachment = {
  userId: string; draftKey: string; role: AttachmentRole; versionKey: string | null;
  filename: string; mime: string; sizeBytes: number; storagePath: string; pageCount: number | null;
  capabilities: { text: boolean; vision: boolean }; orderIndex: number;
};

export async function insertAttachment(a: NewAttachment): Promise<AttachmentRow | null> {
  if (!isDatabaseConfigured()) return null;
  const { data, error } = await getSupabaseAdminClient().from(TABLE as never).insert({
    id: crypto.randomUUID(), user_id: a.userId, draft_key: a.draftKey, check_id: null,
    role: a.role, version_key: a.versionKey, order_index: a.orderIndex,
    filename: a.filename, mime: a.mime, size_bytes: a.sizeBytes, storage_path: a.storagePath,
    page_count: a.pageCount, status: "ready", capabilities: a.capabilities,
    expires_at: new Date(Date.now() + DRAFT_TTL_MS).toISOString(),
  } as never).select("*").single();
  if (error) { console.error("insertAttachment:", error.message); return null; }
  return (data as AttachmentRow) ?? null;
}

// A draft's attachments, ordered for stable display + evaluator ordering.
export async function listByDraft(userId: string, draftKey: string): Promise<AttachmentRow[]> {
  if (!isDatabaseConfigured() || !draftKey) return [];
  const { data, error } = await getSupabaseAdminClient().from(TABLE as never)
    .select("*").eq("user_id", userId).eq("draft_key", draftKey)
    .order("role", { ascending: true }).order("version_key", { ascending: true }).order("order_index", { ascending: true });
  if (error) { console.error("listByDraft:", error.message); return []; }
  return (data ?? []) as AttachmentRow[];
}

export async function listByCheck(userId: string, checkId: string): Promise<AttachmentRow[]> {
  if (!isDatabaseConfigured()) return [];
  const { data } = await getSupabaseAdminClient().from(TABLE as never)
    .select("*").eq("user_id", userId).eq("check_id", checkId).order("order_index", { ascending: true });
  return (data ?? []) as AttachmentRow[];
}

// Owner-scoped fetch (returns null if it isn't this user's row).
export async function getAttachment(userId: string, id: string): Promise<AttachmentRow | null> {
  if (!isDatabaseConfigured()) return null;
  const { data } = await getSupabaseAdminClient().from(TABLE as never).select("*").eq("user_id", userId).eq("id", id).maybeSingle();
  return (data as unknown as AttachmentRow) ?? null;
}

// Delete a row the user owns; returns its storage_path so the caller can remove the bytes. Null if not theirs.
export async function deleteAttachmentRow(userId: string, id: string): Promise<string | null> {
  if (!isDatabaseConfigured()) return null;
  const { data, error } = await getSupabaseAdminClient().from(TABLE as never)
    .delete().eq("user_id", userId).eq("id", id).select("storage_path").maybeSingle();
  if (error) { console.error("deleteAttachmentRow:", error.message); return null; }
  return (data as { storage_path: string } | null)?.storage_path ?? null;
}

async function countExact(userId: string, draftKey: string, filters: Record<string, string>): Promise<number> {
  if (!isDatabaseConfigured() || !draftKey) return 0;
  let q = getSupabaseAdminClient().from(TABLE as never).select("id", { count: "exact", head: true }).eq("user_id", userId).eq("draft_key", draftKey);
  for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
  const { count } = await q;
  return count ?? 0;
}
export const countForVersion = (userId: string, draftKey: string, versionKey: string) =>
  countExact(userId, draftKey, { role: "candidate_output", version_key: versionKey });
export const countContext = (userId: string, draftKey: string) =>
  countExact(userId, draftKey, { role: "supporting_context" });
// The 20-image total is per check, across BOTH roles.
export async function countImagesTotal(userId: string, draftKey: string): Promise<number> {
  if (!isDatabaseConfigured() || !draftKey) return 0;
  const { count } = await getSupabaseAdminClient().from(TABLE as never)
    .select("id", { count: "exact", head: true }).eq("user_id", userId).eq("draft_key", draftKey)
    .in("mime", ["image/png", "image/jpeg", "image/webp"]);
  return count ?? 0;
}

// Bind a draft's uploads to the created check (and clear the orphan-sweep deadline).
export async function bindDraftToCheck(userId: string, draftKey: string, checkId: string): Promise<void> {
  if (!isDatabaseConfigured() || !draftKey) return;
  await getSupabaseAdminClient().from(TABLE as never).update({ check_id: checkId, expires_at: null } as never).eq("user_id", userId).eq("draft_key", draftKey).is("check_id", null);
}

// Persist a new order for a version's (or the context set's) attachments.
export async function reorder(userId: string, draftKey: string, orderedIds: string[]): Promise<void> {
  if (!isDatabaseConfigured() || !orderedIds.length) return;
  const s = getSupabaseAdminClient();
  await Promise.all(orderedIds.map((id, i) => s.from(TABLE as never).update({ order_index: i } as never).eq("user_id", userId).eq("draft_key", draftKey).eq("id", id)));
}
