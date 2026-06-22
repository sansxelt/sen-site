// Data / privacy request workflow. Intake + admin review only — NEVER destructive.
// Creating a request logs a safe audit event (request id/type only, not the message).

import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";
import { logEvent } from "./v-events";

function norm(e: string): string { return e.trim().toLowerCase(); }

export const REQUEST_TYPES = ["data_export", "data_correction", "account_deletion", "privacy_question"] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];
export const REQUEST_STATUSES = ["open", "in_review", "completed", "rejected", "cancelled"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

const USER_EVENT: Record<RequestType, string> = {
  data_export: "data_export_requested",
  data_correction: "data_correction_requested",
  account_deletion: "account_delete_requested",
  privacy_question: "privacy_question_submitted",
};

export type DataRequest = { id: string; user_id?: string; request_type: string; status: string; message: string | null; admin_note?: string | null; created_at: string; updated_at: string; resolved_at: string | null };

export async function createDataRequest(userId: string, type: RequestType, message?: string): Promise<{ ok: boolean; id?: string }> {
  if (!userId || !isDatabaseConfigured() || !REQUEST_TYPES.includes(type)) return { ok: false };
  const s = getSupabaseAdminClient();
  const msg = (message || "").trim().slice(0, 1000) || null;
  const { data, error } = await s.from("v_data_requests" as never).insert({ user_id: norm(userId), request_type: type, status: "open", message: msg } as never).select("id").single();
  if (error || !data) { console.error("createDataRequest:", error?.message); return { ok: false }; }
  const id = (data as unknown as { id: string }).id;
  // Audit event — safe metadata only (never the message contents).
  await logEvent({ userId: norm(userId), eventType: USER_EVENT[type], actorType: "owner", source: "app", metadata: { request_id: id, request_type: type } });
  return { ok: true, id };
}

// A user's own requests (newest first). Never returns admin_note to the user.
export async function listMyRequests(userId: string): Promise<DataRequest[]> {
  if (!userId || !isDatabaseConfigured()) return [];
  try {
    const s = getSupabaseAdminClient();
    const { data, error } = await s.from("v_data_requests" as never)
      .select("id,request_type,status,message,created_at,updated_at,resolved_at")
      .eq("user_id", norm(userId)).order("created_at", { ascending: false }).limit(50);
    if (error) return [];
    return (data as unknown as DataRequest[]) ?? [];
  } catch { return []; }
}

// ADMIN ONLY: all requests (optionally filtered by status). Callers MUST gate with isAdmin().
export async function listAllRequests(status?: string, limit = 100): Promise<DataRequest[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const s = getSupabaseAdminClient();
    let q = s.from("v_data_requests" as never).select("id,user_id,request_type,status,message,admin_note,created_at,updated_at,resolved_at").order("created_at", { ascending: false }).limit(Math.min(limit, 200));
    if (status && REQUEST_STATUSES.includes(status as RequestStatus)) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return [];
    return (data as unknown as DataRequest[]) ?? [];
  } catch { return []; }
}

// ADMIN ONLY: change status and/or append a note. Logs safe admin audit events.
export async function updateRequest(adminEmail: string, id: string, opts: { status?: RequestStatus; note?: string }): Promise<{ ok: boolean }> {
  if (!id || !isDatabaseConfigured()) return { ok: false };
  const s = getSupabaseAdminClient();
  const { data: cur } = await s.from("v_data_requests" as never).select("status,request_type").eq("id", id).maybeSingle();
  const prev = cur as unknown as { status: string; request_type: string } | null;
  if (!prev) return { ok: false };
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (opts.status && REQUEST_STATUSES.includes(opts.status)) {
    patch.status = opts.status;
    if (opts.status === "completed" || opts.status === "rejected" || opts.status === "cancelled") patch.resolved_at = new Date().toISOString();
  }
  if (typeof opts.note === "string") patch.admin_note = opts.note.trim().slice(0, 2000);
  const { error } = await s.from("v_data_requests" as never).update(patch as never).eq("id", id);
  if (error) return { ok: false };
  if (opts.status && opts.status !== prev.status) {
    await logEvent({ userId: norm(adminEmail), eventType: "admin_data_request_status_changed", actorType: "admin", source: "admin", route: "data-requests", metadata: { request_id: id, request_type: prev.request_type, previous_status: prev.status, next_status: opts.status } });
  }
  if (typeof opts.note === "string" && opts.note.trim()) {
    await logEvent({ userId: norm(adminEmail), eventType: "admin_data_request_note_added", actorType: "admin", source: "admin", route: "data-requests", metadata: { request_id: id, request_type: prev.request_type } });
  }
  return { ok: true };
}
