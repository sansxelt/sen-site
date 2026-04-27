// Contributor application + approval data layer.
//
// Schema in docs/v0.2.0-contributors.sql. Every helper fails open
// (returns null/empty) when the table doesn't exist or Supabase is
// transiently down, so the site keeps rendering even if the
// migration hasn't been applied.

import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";

export type ContributorStatus = "pending" | "approved" | "rejected";

export type Contributor = {
  email: string;
  status: ContributorStatus;
  applied_name: string | null;
  display_name: string | null;
  applied_reason: string | null;
  applied_at: string;
  decided_at: string | null;
  decided_by: string | null;
  notes: string | null;
};

const TABLE = "learn_contributors";

// --- Reads -----------------------------------------------------

export async function getContributorByEmail(
  email: string,
): Promise<Contributor | null> {
  if (!isDatabaseConfigured() || !email) return null;
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from(TABLE as never)
      .select("*")
      .eq("email", email.toLowerCase())
      .maybeSingle();
    if (error || !data) return null;
    return data as unknown as Contributor;
  } catch {
    return null;
  }
}

export async function listContributorsByStatus(
  status: ContributorStatus,
  limit = 100,
): Promise<Contributor[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from(TABLE as never)
      .select("*")
      .eq("status", status)
      .order("applied_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data as unknown as Contributor[];
  } catch {
    return [];
  }
}

// --- Writes ----------------------------------------------------

export async function applyToContribute(input: {
  email: string;
  appliedName: string;
  reason?: string;
}): Promise<Contributor | null> {
  if (!isDatabaseConfigured() || !input.email) return null;
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from(TABLE as never)
      .upsert(
        {
          email: input.email.toLowerCase(),
          status: "pending",
          applied_name: input.appliedName,
          applied_reason: input.reason ?? null,
          applied_at: new Date().toISOString(),
          decided_at: null,
          decided_by: null,
        } as never,
        { onConflict: "email" } as never,
      )
      .select("*")
      .single();
    if (error || !data) return null;
    return data as unknown as Contributor;
  } catch {
    return null;
  }
}

export async function approveContributor(input: {
  email: string;
  displayName: string;
  decidedBy: string;
}): Promise<Contributor | null> {
  if (!isDatabaseConfigured()) return null;
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from(TABLE as never)
      .update({
        status: "approved",
        display_name: input.displayName,
        decided_at: new Date().toISOString(),
        decided_by: input.decidedBy,
      } as never)
      .eq("email", input.email.toLowerCase())
      .select("*")
      .single();
    if (error || !data) return null;
    return data as unknown as Contributor;
  } catch {
    return null;
  }
}

export async function rejectContributor(input: {
  email: string;
  decidedBy: string;
  notes?: string;
}): Promise<Contributor | null> {
  if (!isDatabaseConfigured()) return null;
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from(TABLE as never)
      .update({
        status: "rejected",
        decided_at: new Date().toISOString(),
        decided_by: input.decidedBy,
        notes: input.notes ?? null,
      } as never)
      .eq("email", input.email.toLowerCase())
      .select("*")
      .single();
    if (error || !data) return null;
    return data as unknown as Contributor;
  } catch {
    return null;
  }
}

/** Returns the locked display name for an approved contributor, or
 * null if they aren't approved (or the table doesn't exist yet).
 * The admin board surfaces every status; the byline renderer only
 * cares about approved ones. */
export async function getApprovedDisplayName(
  email: string,
): Promise<string | null> {
  const c = await getContributorByEmail(email);
  if (!c || c.status !== "approved") return null;
  return c.display_name ?? null;
}
