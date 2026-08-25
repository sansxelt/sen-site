// Vraelis backend data access — workspaces, leads, conversation messages.
// Server-only (uses the Supabase service-role client). Every query is
// scoped by owner_email. All reads fail soft (return null/[]) so the UI
// still renders if the DB isn't configured or the tables aren't created
// yet; writes throw so callers can surface real errors.

import { randomBytes } from "crypto";
import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";

export type LeadStatus =
  | "new"
  | "contacted"
  | "qualifying"
  | "qualified"
  | "booking_ready"
  | "needs_owner"
  | "booked"
  | "won"
  | "lost";

// Statuses the AI is allowed to set during a conversation. Booked / won
// are payment- or owner-driven; new is the initial state.
export const AI_SETTABLE_STATUSES: LeadStatus[] = [
  "contacted",
  "qualifying",
  "qualified",
  "booking_ready",
  "needs_owner",
  "lost",
];

export type VraelisWorkspace = {
  owner_email: string;
  intake_key: string;
  business_name: string | null;
  business_description: string | null;
  plan: string | null;
  plan_cycle: string | null;
  plan_status: string | null;
  plan_provider: string | null;
  plan_updated_at: string | null;
  connect_account_id: string | null;
  connect_status: string | null;
  deposit_enabled: boolean | null;
  deposit_amount_cents: number | null;
};

const WORKSPACE_COLS =
  "owner_email, intake_key, business_name, business_description, plan, plan_cycle, plan_status, plan_provider, plan_updated_at, connect_account_id, connect_status, deposit_enabled, deposit_amount_cents";

export type VraelisLead = {
  id: string;
  owner_email: string;
  name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  source: string;
  status: LeadStatus;
  value: number | null;
  snippet: string | null;
  followups_sent: number;
  outcome?: string | null;
  lost_reason?: string | null;
  created_at: string;
  updated_at: string;
};

export type LeadOutcome = "open" | "booked" | "paid" | "lost" | "spam";

const FOLLOWUP_STATUSES: LeadStatus[] = ["new", "contacted", "qualifying", "booking_ready", "needs_owner"];

export type VraelisMessage = {
  id: string;
  lead_id: string;
  role: "lead" | "agent";
  body: string;
  channel: string | null;
  delivered: boolean;
  created_at: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function newIntakeKey() {
  return `vk_${randomBytes(18).toString("hex")}`;
}

// Get the caller's workspace, creating it (with a fresh intake key) on
// first use. Returns null only if the DB isn't configured.
export async function getOrCreateWorkspace(
  email: string,
): Promise<VraelisWorkspace | null> {
  if (!email || !isDatabaseConfigured()) return null;
  const supabase = getSupabaseAdminClient();
  const owner = normalizeEmail(email);

  try {
    const existing = await supabase
      .from("vraelis_workspaces" as never)
      .select(WORKSPACE_COLS)
      .eq("owner_email", owner)
      .maybeSingle();

    if (existing.data) return existing.data as unknown as VraelisWorkspace;

    // New workspaces default to deposit-to-book ON ($25). It only actually
    // charges once payouts are connected, so this is safe + lifts on-platform
    // payments + no-show protection the moment they connect Stripe.
    const inserted = await supabase
      .from("vraelis_workspaces" as never)
      .insert({
        owner_email: owner,
        intake_key: newIntakeKey(),
        deposit_enabled: true,
        deposit_amount_cents: 2500,
      } as never)
      .select(WORKSPACE_COLS)
      .single();

    if (inserted.error) throw inserted.error;
    return inserted.data as unknown as VraelisWorkspace;
  } catch (error) {
    console.error("getOrCreateWorkspace failed:", error);
    return null;
  }
}

export async function getWorkspaceByIntakeKey(
  key: string,
): Promise<VraelisWorkspace | null> {
  if (!key || !isDatabaseConfigured()) return null;
  const supabase = getSupabaseAdminClient();
  try {
    const { data, error } = await supabase
      .from("vraelis_workspaces" as never)
      .select(WORKSPACE_COLS)
      .eq("intake_key", key)
      .maybeSingle();
    if (error) throw error;
    return (data as unknown as VraelisWorkspace) ?? null;
  } catch (error) {
    console.error("getWorkspaceByIntakeKey failed:", error);
    return null;
  }
}

export async function updateWorkspaceBusiness(
  email: string,
  fields: { businessName?: string | null; businessDescription?: string | null },
): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("vraelis_workspaces" as never)
    .update({
      business_name: fields.businessName ?? null,
      business_description: fields.businessDescription ?? null,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("owner_email", normalizeEmail(email));
  if (error) throw error;
}

export async function setWorkspacePlan(
  email: string,
  fields: {
    plan: string;
    cycle: string;
    status: string;
    provider: string;
    // Self-heal metadata (written fail-soft; columns migrated separately).
    subscriptionId?: string | null;
    periodEndISO?: string | null;
  },
): Promise<{ statusChanged: boolean }> {
  if (!isDatabaseConfigured()) return { statusChanged: false };
  const existing = await getOrCreateWorkspace(email); // ensure row exists
  const supabase = getSupabaseAdminClient();

  // plan_updated_at is the grace clock — it must mark when the STATUS changed,
  // not every write. Otherwise a daily reconcile re-writing 'past_due' would
  // keep resetting the clock and the plan would never actually lapse.
  const statusChanged = (existing?.plan_status ?? null) !== fields.status;
  const patch: Record<string, unknown> = {
    plan: fields.plan,
    plan_cycle: fields.cycle,
    plan_status: fields.status,
    plan_provider: fields.provider,
    updated_at: new Date().toISOString(),
  };
  if (statusChanged) patch.plan_updated_at = new Date().toISOString();

  const { error } = await supabase
    .from("vraelis_workspaces" as never)
    .update(patch as never)
    .eq("owner_email", normalizeEmail(email));
  if (error) throw error;

  if (fields.subscriptionId !== undefined || fields.periodEndISO !== undefined) {
    await setWorkspaceSubscriptionMeta(email, {
      subscriptionId: fields.subscriptionId,
      periodEndISO: fields.periodEndISO,
    });
  }
  return { statusChanged };
}

// Persist the provider's subscription id + current period end so the reconcile
// cron can re-poll live status. Fail-soft: these columns are migrated after the
// base plan columns, so a not-yet-migrated DB still records the plan above.
export async function setWorkspaceSubscriptionMeta(
  email: string,
  fields: { subscriptionId?: string | null; periodEndISO?: string | null },
): Promise<void> {
  if (!email || !isDatabaseConfigured()) return;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.subscriptionId !== undefined) patch.plan_subscription_id = fields.subscriptionId;
  if (fields.periodEndISO !== undefined) patch.plan_current_period_end = fields.periodEndISO;
  try {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from("vraelis_workspaces" as never)
      .update(patch as never)
      .eq("owner_email", normalizeEmail(email));
    if (error) console.error("setWorkspaceSubscriptionMeta: columns may not exist yet —", error.message);
  } catch (e) {
    console.error("setWorkspaceSubscriptionMeta failed:", e);
  }
}

// Lapse/reap/reconcile view: every workspace with the self-heal fields the
// subscription-reconcile + number-reap crons need. Fail-soft (returns [] if the
// new columns aren't migrated yet) so the crons degrade rather than throw.
export type WorkspaceLapseRow = {
  owner_email: string;
  plan: string | null;
  plan_cycle: string | null;
  plan_status: string | null;
  plan_provider: string | null;
  plan_updated_at: string | null;
  plan_subscription_id: string | null;
  plan_current_period_end: string | null;
  twilio_number: string | null;
};
export async function getWorkspaceLapseRows(): Promise<WorkspaceLapseRow[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("vraelis_workspaces" as never)
      .select(
        "owner_email, plan, plan_cycle, plan_status, plan_provider, plan_updated_at, plan_subscription_id, plan_current_period_end, twilio_number",
      );
    if (error) {
      console.error("getWorkspaceLapseRows (columns may not be migrated):", error.message);
      return [];
    }
    return (data as unknown as WorkspaceLapseRow[]) ?? [];
  } catch (e) {
    console.error("getWorkspaceLapseRows failed:", e);
    return [];
  }
}

// Sum of revenue from won deals (value on leads marked won) — the base
// the revenue cut is computed against.
export async function getRevenueSummary(
  email: string,
): Promise<{ wonRevenue: number; wonCount: number }> {
  if (!email || !isDatabaseConfigured()) return { wonRevenue: 0, wonCount: 0 };
  const supabase = getSupabaseAdminClient();
  try {
    const { data, error } = await supabase
      .from("vraelis_leads" as never)
      .select("value")
      .eq("owner_email", normalizeEmail(email))
      .eq("status", "won")
      .eq("fee_billed", false);
    if (error) throw error;
    const rows = (data as unknown as { value: number | null }[]) ?? [];
    const wonRevenue = rows.reduce((sum, r) => sum + (Number(r.value) || 0), 0);
    return { wonRevenue, wonCount: rows.length };
  } catch (error) {
    console.error("getRevenueSummary failed:", error);
    return { wonRevenue: 0, wonCount: 0 };
  }
}

// Won leads with a value that haven't been billed yet — the basis for the
// next fee invoice.
export async function getUnbilledWonLeads(
  email: string,
): Promise<{ id: string; value: number }[]> {
  if (!email || !isDatabaseConfigured()) return [];
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("vraelis_leads" as never)
    .select("id, value")
    .eq("owner_email", normalizeEmail(email))
    .eq("status", "won")
    .eq("fee_billed", false);
  if (error) throw error;
  return ((data as unknown as { id: string; value: number | null }[]) ?? [])
    .filter((r) => Number(r.value) > 0)
    .map((r) => ({ id: r.id, value: Number(r.value) }));
}

export async function markLeadsFeeBilled(leadIds: string[]): Promise<void> {
  if (leadIds.length === 0) return;
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("vraelis_leads" as never)
    .update({ fee_billed: true } as never)
    .in("id", leadIds);
  if (error) throw error;
}

// All workspaces (service-role, for the monthly billing sweep).
export async function getAllWorkspaces(): Promise<VraelisWorkspace[]> {
  if (!isDatabaseConfigured()) return [];
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("vraelis_workspaces" as never)
    .select(WORKSPACE_COLS);
  if (error) throw error;
  return (data as unknown as VraelisWorkspace[]) ?? [];
}

// Leads that may be due a nudge: active status, has an email, under the
// follow-up cap, and quiet since `olderThanISO`. (Caller still checks the
// last message was from us, not the lead.)
export async function getFollowupCandidates(
  email: string,
  olderThanISO: string,
): Promise<VraelisLead[]> {
  if (!email || !isDatabaseConfigured()) return [];
  const supabase = getSupabaseAdminClient();
  try {
    const { data, error } = await supabase
      .from("vraelis_leads" as never)
      .select("*")
      .eq("owner_email", normalizeEmail(email))
      .not("contact_email", "is", null)
      .lt("followups_sent", 3)
      .lt("updated_at", olderThanISO)
      .in("status", FOLLOWUP_STATUSES as never)
      .limit(50);
    if (error) throw error;
    return (data as unknown as VraelisLead[]) ?? [];
  } catch (error) {
    console.error("getFollowupCandidates failed:", error);
    return [];
  }
}

export async function getLastMessage(
  leadId: string,
): Promise<VraelisMessage | null> {
  if (!isDatabaseConfigured()) return null;
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("vraelis_messages" as never)
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as unknown as VraelisMessage) ?? null;
}

export async function bumpFollowup(leadId: string, current: number): Promise<void> {
  const supabase = getSupabaseAdminClient();
  await supabase
    .from("vraelis_leads" as never)
    .update({ followups_sent: current + 1, updated_at: new Date().toISOString() } as never)
    .eq("id", leadId);
}

// Most recent lead matching a contact email WITHIN ONE WORKSPACE — used to
// route an inbound email reply back to the right thread. Owner-scoped (like
// findLeadByContactPhone) so a lead's email that exists in two workspaces can
// never be matched to the wrong tenant: the caller MUST resolve the workspace
// from the inbound recipient address first, then scope the lookup here.
export async function findLeadByContactEmail(
  ownerEmail: string,
  email: string,
): Promise<VraelisLead | null> {
  if (!ownerEmail || !email || !isDatabaseConfigured()) return null;
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("vraelis_leads" as never)
    .select("*")
    .eq("owner_email", normalizeEmail(ownerEmail))
    .eq("contact_email", email.trim().toLowerCase())
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as unknown as VraelisLead) ?? null;
}

export async function listLeads(email: string): Promise<VraelisLead[]> {
  if (!email || !isDatabaseConfigured()) return [];
  const supabase = getSupabaseAdminClient();
  try {
    const { data, error } = await supabase
      .from("vraelis_leads" as never)
      .select("*")
      .eq("owner_email", normalizeEmail(email))
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return (data as unknown as VraelisLead[]) ?? [];
  } catch (error) {
    console.error("listLeads failed:", error);
    return [];
  }
}

export async function getLeadWithMessages(
  email: string,
  leadId: string,
): Promise<{ lead: VraelisLead; messages: VraelisMessage[] } | null> {
  if (!isDatabaseConfigured()) return null;
  const supabase = getSupabaseAdminClient();
  try {
    const leadRes = await supabase
      .from("vraelis_leads" as never)
      .select("*")
      .eq("owner_email", normalizeEmail(email))
      .eq("id", leadId)
      .maybeSingle();
    if (leadRes.error) throw leadRes.error;
    if (!leadRes.data) return null;

    const msgRes = await supabase
      .from("vraelis_messages" as never)
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: true });
    if (msgRes.error) throw msgRes.error;

    return {
      lead: leadRes.data as unknown as VraelisLead,
      messages: (msgRes.data as unknown as VraelisMessage[]) ?? [],
    };
  } catch (error) {
    console.error("getLeadWithMessages failed:", error);
    return null;
  }
}

export async function createLead(input: {
  ownerEmail: string;
  name?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  source?: string;
  snippet?: string | null;
}): Promise<VraelisLead> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("vraelis_leads" as never)
    .insert({
      owner_email: normalizeEmail(input.ownerEmail),
      name: input.name?.trim() || null,
      contact_email: input.contactEmail?.trim().toLowerCase() || null,
      contact_phone: input.contactPhone?.trim() || null,
      source: input.source || "form",
      status: "new",
      snippet: input.snippet?.trim()?.slice(0, 280) || null,
    } as never)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as VraelisLead;
}

export async function addMessage(input: {
  leadId: string;
  role: "lead" | "agent";
  body: string;
  channel?: string | null;
  delivered?: boolean;
}): Promise<VraelisMessage> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("vraelis_messages" as never)
    .insert({
      lead_id: input.leadId,
      role: input.role,
      body: input.body,
      channel: input.channel ?? null,
      delivered: input.delivered ?? false,
    } as never)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as VraelisMessage;
}

export async function setLeadStatus(
  email: string,
  leadId: string,
  status: LeadStatus,
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("vraelis_leads" as never)
    .update({ status, updated_at: new Date().toISOString() } as never)
    .eq("owner_email", normalizeEmail(email))
    .eq("id", leadId);
  if (error) throw error;
}

// Fill in contact details captured mid-conversation (only sets fields
// that are passed). Not owner-scoped: used by the public chat endpoint
// after it has already verified the lead belongs to the key's workspace.
export async function updateLeadContact(
  leadId: string,
  fields: { contactEmail?: string; contactPhone?: string; name?: string },
): Promise<void> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.contactEmail) patch.contact_email = fields.contactEmail.toLowerCase();
  if (fields.contactPhone) patch.contact_phone = fields.contactPhone;
  if (fields.name) patch.name = fields.name;
  if (Object.keys(patch).length === 1) return;
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("vraelis_leads" as never)
    .update(patch as never)
    .eq("id", leadId);
  if (error) throw error;
}

export async function updateLead(
  email: string,
  leadId: string,
  fields: { status?: LeadStatus; value?: number | null },
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.status) patch.status = fields.status;
  if (fields.value !== undefined) patch.value = fields.value;
  const { error } = await supabase
    .from("vraelis_leads" as never)
    .update(patch as never)
    .eq("owner_email", normalizeEmail(email))
    .eq("id", leadId);
  if (error) throw error;
}

export async function createContact(input: {
  name?: string | null;
  email?: string | null;
  company?: string | null;
  message?: string | null;
  topic?: string | null;
}): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("vraelis_contacts" as never).insert({
    name: input.name?.trim() || null,
    email: input.email?.trim().toLowerCase() || null,
    company: input.company?.trim() || null,
    message: input.message?.trim() || null,
    topic: input.topic?.trim() || "sales",
  } as never);
  if (error) throw error;
}

// Set the conversation outcome label (VIE data). Fail-soft until migrated.
export async function setLeadOutcome(
  email: string,
  leadId: string,
  outcome: string,
  lostReason?: string | null,
): Promise<void> {
  if (!isDatabaseConfigured()) return;
  try {
    const supabase = getSupabaseAdminClient();
    const patch: Record<string, unknown> = { outcome, updated_at: new Date().toISOString() };
    if (lostReason !== undefined) patch.lost_reason = lostReason;
    const { error } = await supabase
      .from("vraelis_leads" as never)
      .update(patch as never)
      .eq("owner_email", normalizeEmail(email))
      .eq("id", leadId);
    if (error) console.error("setLeadOutcome: column may not exist yet —", error.message);
  } catch (e) {
    console.error("setLeadOutcome failed:", e);
  }
}

// Bump a lead's updated_at + status when a new message lands.
export async function touchLeadStatus(
  leadId: string,
  status: LeadStatus,
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  await supabase
    .from("vraelis_leads" as never)
    .update({ status, updated_at: new Date().toISOString() } as never)
    .eq("id", leadId);
}

// Services + prices (freeform text). Kept OUT of the core workspace SELECT
// so a not-yet-migrated column can never break workspace reads — fetched +
// saved here fail-soft (no-op until the `business_services` column exists).
export async function getWorkspaceServices(email: string): Promise<string | null> {
  if (!email || !isDatabaseConfigured()) return null;
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("vraelis_workspaces" as never)
      .select("business_services")
      .eq("owner_email", normalizeEmail(email))
      .maybeSingle();
    if (error) return null;
    return (data as unknown as { business_services?: string | null } | null)?.business_services ?? null;
  } catch {
    return null;
  }
}

export async function setWorkspaceServices(email: string, services: string | null): Promise<void> {
  if (!email || !isDatabaseConfigured()) return;
  try {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from("vraelis_workspaces" as never)
      .update({ business_services: services, updated_at: new Date().toISOString() } as never)
      .eq("owner_email", normalizeEmail(email));
    if (error) console.error("setWorkspaceServices: column may not exist yet —", error.message);
  } catch (e) {
    console.error("setWorkspaceServices failed:", e);
  }
}

// Offer setup extras — qualifying questions + where leads come from +
// business-type persona. Same fail-soft contract as services above: kept
// OUT of the core SELECT so a not-yet-migrated column never breaks
// workspace reads, and writes no-op (log only) until the columns exist.
// `persona` is read/written in its OWN query so a missing persona column
// can't break the (already-migrated) qualifying/lead-sources fields.
export type WorkspaceOffer = {
  qualifyingQuestions: string | null;
  leadSources: string | null;
  persona: string | null;
  onboardingComplete: boolean | null;
  agentName: string | null;
  agentTone: string | null;
  // The offer/product the agent sells (e.g. "12-Week Coaching") — distinct
  // from business_name (the brand, e.g. "Apex Coaching"). Used for the Stripe
  // product label and checkout description, NOT the greeting/brand surfaces.
  offerName: string | null;
  offerDescription: string | null;
};

export async function getWorkspaceOffer(email: string): Promise<WorkspaceOffer> {
  const empty: WorkspaceOffer = { qualifyingQuestions: null, leadSources: null, persona: null, onboardingComplete: null, agentName: null, agentTone: null, offerName: null, offerDescription: null };
  if (!email || !isDatabaseConfigured()) return empty;
  try {
    const supabase = getSupabaseAdminClient();
    const owner = normalizeEmail(email);
    const { data, error } = await supabase
      .from("vraelis_workspaces" as never)
      .select("qualifying_questions, lead_sources")
      .eq("owner_email", owner)
      .maybeSingle();
    // persona, onboarding_complete, and agent_name/agent_tone each read in
    // their OWN fail-soft query so one not-yet-migrated column can't blank
    // out the others. agent_name + agent_tone migrate together, so they
    // share one query.
    let persona: string | null = null;
    let onboardingComplete: boolean | null = null;
    let agentName: string | null = null;
    let agentTone: string | null = null;
    let offerName: string | null = null;
    let offerDescription: string | null = null;
    try {
      const { data: pData, error: pError } = await supabase
        .from("vraelis_workspaces" as never)
        .select("persona")
        .eq("owner_email", owner)
        .maybeSingle();
      if (!pError) persona = (pData as unknown as { persona?: string | null } | null)?.persona ?? null;
    } catch { /* persona column not migrated yet */ }
    try {
      const { data: oData, error: oError } = await supabase
        .from("vraelis_workspaces" as never)
        .select("onboarding_complete")
        .eq("owner_email", owner)
        .maybeSingle();
      if (!oError) onboardingComplete = (oData as unknown as { onboarding_complete?: boolean | null } | null)?.onboarding_complete ?? null;
    } catch { /* onboarding_complete column not migrated yet */ }
    try {
      const { data: aData, error: aError } = await supabase
        .from("vraelis_workspaces" as never)
        .select("agent_name, agent_tone")
        .eq("owner_email", owner)
        .maybeSingle();
      if (!aError) {
        const a = aData as unknown as { agent_name?: string | null; agent_tone?: string | null } | null;
        agentName = a?.agent_name ?? null;
        agentTone = a?.agent_tone ?? null;
      }
    } catch { /* agent_name/agent_tone columns not migrated yet */ }
    try {
      const { data: ofData, error: ofError } = await supabase
        .from("vraelis_workspaces" as never)
        .select("offer_name, offer_description")
        .eq("owner_email", owner)
        .maybeSingle();
      if (!ofError) {
        const o = ofData as unknown as { offer_name?: string | null; offer_description?: string | null } | null;
        offerName = o?.offer_name ?? null;
        offerDescription = o?.offer_description ?? null;
      }
    } catch { /* offer_name/offer_description columns not migrated yet */ }
    if (error) return { ...empty, persona, onboardingComplete, agentName, agentTone, offerName, offerDescription };
    const row = data as unknown as { qualifying_questions?: string | null; lead_sources?: string | null } | null;
    return {
      qualifyingQuestions: row?.qualifying_questions ?? null,
      leadSources: row?.lead_sources ?? null,
      persona,
      onboardingComplete,
      agentName,
      agentTone,
      offerName,
      offerDescription,
    };
  } catch {
    return empty;
  }
}

export async function setWorkspaceOffer(
  email: string,
  fields: { qualifyingQuestions?: string | null; leadSources?: string | null; persona?: string | null; onboardingComplete?: boolean; agentName?: string | null; agentTone?: string | null; offerName?: string | null; offerDescription?: string | null },
): Promise<void> {
  if (!email || !isDatabaseConfigured()) return;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.qualifyingQuestions !== undefined) patch.qualifying_questions = fields.qualifyingQuestions;
  if (fields.leadSources !== undefined) patch.lead_sources = fields.leadSources;
  try {
    const supabase = getSupabaseAdminClient();
    const owner = normalizeEmail(email);
    const { error } = await supabase
      .from("vraelis_workspaces" as never)
      .update(patch as never)
      .eq("owner_email", owner);
    if (error) console.error("setWorkspaceOffer: columns may not exist yet —", error.message);
    if (fields.persona !== undefined) {
      const { error: pError } = await supabase
        .from("vraelis_workspaces" as never)
        .update({ persona: fields.persona } as never)
        .eq("owner_email", owner);
      if (pError) console.error("setWorkspaceOffer: persona column may not exist yet —", pError.message);
    }
    if (fields.onboardingComplete !== undefined) {
      const { error: oError } = await supabase
        .from("vraelis_workspaces" as never)
        .update({ onboarding_complete: fields.onboardingComplete } as never)
        .eq("owner_email", owner);
      if (oError) console.error("setWorkspaceOffer: onboarding_complete column may not exist yet —", oError.message);
    }
    // agent_name + agent_tone migrate together → one fail-soft update.
    if (fields.agentName !== undefined || fields.agentTone !== undefined) {
      const agentPatch: Record<string, unknown> = {};
      if (fields.agentName !== undefined) agentPatch.agent_name = fields.agentName;
      if (fields.agentTone !== undefined) agentPatch.agent_tone = fields.agentTone;
      const { error: aError } = await supabase
        .from("vraelis_workspaces" as never)
        .update(agentPatch as never)
        .eq("owner_email", owner);
      if (aError) console.error("setWorkspaceOffer: agent_name/agent_tone columns may not exist yet —", aError.message);
    }
    // offer_name + offer_description migrate together → one fail-soft update.
    if (fields.offerName !== undefined || fields.offerDescription !== undefined) {
      const offerPatch: Record<string, unknown> = {};
      if (fields.offerName !== undefined) offerPatch.offer_name = fields.offerName;
      if (fields.offerDescription !== undefined) offerPatch.offer_description = fields.offerDescription;
      const { error: ofError } = await supabase
        .from("vraelis_workspaces" as never)
        .update(offerPatch as never)
        .eq("owner_email", owner);
      if (ofError) console.error("setWorkspaceOffer: offer_name/offer_description columns may not exist yet —", ofError.message);
    }
  } catch (e) {
    console.error("setWorkspaceOffer failed:", e);
  }
}

// The core-onboarding gate. Complete when the explicit flag is set, OR —
// for accounts that predate the flag (grandfathering + fail-safe) — when
// every minimum field already exists: persona, offer name + description,
// price/services. Payment type always has a value (full is the default),
// and Stripe/Calendar/SMS/lead-capture are deliberately NOT required.
// Missing columns read as null → false → the account routes into
// onboarding, which is the required fail-safe direction.
export function deriveOnboarded(
  workspace: { business_name?: string | null; business_description?: string | null } | null,
  services: string | null,
  offer: { persona: string | null; onboardingComplete: boolean | null },
): boolean {
  if (offer.onboardingComplete === true) return true;
  return Boolean(
    workspace?.business_name &&
    workspace?.business_description &&
    services &&
    offer.persona,
  );
}

export async function isWorkspaceOnboarded(email: string): Promise<boolean> {
  if (!email) return false;
  try {
    const [workspace, services, offer] = await Promise.all([
      getOrCreateWorkspace(email),
      getWorkspaceServices(email),
      getWorkspaceOffer(email),
    ]);
    return deriveOnboarded(workspace, services, offer);
  } catch {
    return false;
  }
}

// ── Google Calendar (fail-soft until columns are migrated) ────────────

export async function getWorkspaceCalendar(
  email: string,
): Promise<{ gcal_connected: boolean; gcal_refresh_token: string | null; gcal_calendar_id: string | null } | null> {
  if (!email || !isDatabaseConfigured()) return null;
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("vraelis_workspaces" as never)
      .select("gcal_connected, gcal_refresh_token, gcal_calendar_id")
      .eq("owner_email", normalizeEmail(email))
      .maybeSingle();
    if (error) return null;
    return (data as unknown as { gcal_connected: boolean; gcal_refresh_token: string | null; gcal_calendar_id: string | null }) ?? null;
  } catch {
    return null;
  }
}

export async function setWorkspaceCalendar(
  email: string,
  fields: { refreshToken?: string | null; connected?: boolean; calendarId?: string | null },
): Promise<void> {
  if (!email || !isDatabaseConfigured()) return;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.refreshToken !== undefined) patch.gcal_refresh_token = fields.refreshToken;
  if (fields.connected !== undefined) patch.gcal_connected = fields.connected;
  if (fields.calendarId !== undefined) patch.gcal_calendar_id = fields.calendarId;
  try {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from("vraelis_workspaces" as never)
      .update(patch as never)
      .eq("owner_email", normalizeEmail(email));
    if (error) console.error("setWorkspaceCalendar: columns may not exist yet —", error.message);
  } catch (e) {
    console.error("setWorkspaceCalendar failed:", e);
  }
}

export async function setBookingEvent(bookingId: string, eventId: string): Promise<void> {
  if (!isDatabaseConfigured()) return;
  try {
    const supabase = getSupabaseAdminClient();
    await supabase.from("vraelis_bookings" as never).update({ gcal_event_id: eventId } as never).eq("id", bookingId);
  } catch { /* fail-soft */ }
}

// ── Abandoned-payment recovery ────────────────────────────────────────

export type RecoverablePayment = {
  id: string;
  owner_email: string;
  lead_id: string | null;
  kind: "deposit" | "full";
  description: string | null;
  amount_cents: number;
  fee_cents: number;
  checkout_url: string | null;
  stripe_session_id: string | null;
  reminders_sent: number;
  created_at: string;
};

export async function getPaymentsToRecover(): Promise<RecoverablePayment[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("vraelis_payments" as never)
      .select("id, owner_email, lead_id, kind, description, amount_cents, fee_cents, checkout_url, stripe_session_id, reminders_sent, created_at")
      .eq("status", "pending")
      .not("lead_id", "is", null)
      .lt("reminders_sent", 3)
      .order("created_at", { ascending: true })
      .limit(100);
    if (error) return [];
    return (data as unknown as RecoverablePayment[]) ?? [];
  } catch {
    return [];
  }
}

// Pending payments with a Stripe session id, for the reconcile sweep: ones
// that may have been paid but whose webhook never landed. Bounded to a window:
// `olderThanIso` floors the age so we don't race a webhook that's merely a few
// seconds slow, and `newerThanIso` caps it — a Checkout Session expires after
// ~24h, so a pending row older than that can never be paid and there's nothing
// to reconcile. Without the cap, genuinely-abandoned payments (buyer never
// pays, row stays 'pending' forever) would be re-retrieved from Stripe every
// sweep, unbounded.
export async function getPendingPaymentSessions(
  olderThanIso: string,
  newerThanIso: string,
  limit = 100,
): Promise<{ id: string; stripe_session_id: string | null }[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("vraelis_payments" as never)
      .select("id, stripe_session_id")
      .eq("status", "pending")
      .not("stripe_session_id", "is", null)
      .lt("created_at", olderThanIso)
      .gt("created_at", newerThanIso)
      .order("created_at", { ascending: true })
      .limit(limit);
    if (error) return [];
    return (data as unknown as { id: string; stripe_session_id: string | null }[]) ?? [];
  } catch {
    return [];
  }
}

// Atomically swap a payment's checkout session to a fresh one. Guarded on the
// EXPECTED current session id (`fromSessionId`) so two concurrent recovery
// runs can't both claim the same row — only the writer whose expected id still
// matches wins; the loser sees rowsAffected 0 and must expire its just-minted
// session. Returns true only if exactly this row was updated. Still keyed on
// status='pending' so we never resurrect an already-settled payment.
export async function swapPaymentSession(
  id: string,
  fromSessionId: string | null,
  toSessionId: string,
  url: string | null,
): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  try {
    const supabase = getSupabaseAdminClient();
    let q = supabase
      .from("vraelis_payments" as never)
      .update({ stripe_session_id: toSessionId, checkout_url: url } as never)
      .eq("id", id)
      .eq("status", "pending");
    // Conditional claim: only swap if the row still holds the session id we
    // expect (the one we just superseded). null is matched with .is().
    q = fromSessionId === null ? q.is("stripe_session_id", null) : q.eq("stripe_session_id", fromSessionId);
    const { data, error } = await q.select("id");
    if (error) return false;
    return ((data as unknown as { id: string }[] | null)?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

export async function bumpPaymentReminder(id: string, newCount: number): Promise<void> {
  if (!isDatabaseConfigured()) return;
  try {
    const supabase = getSupabaseAdminClient();
    await supabase
      .from("vraelis_payments" as never)
      .update({ reminders_sent: newCount, last_reminder_at: new Date().toISOString() } as never)
      .eq("id", id);
  } catch { /* fail-soft */ }
}

// ── SMS / Twilio routing (fail-soft until columns are migrated) ───────

export async function getWorkspaceContact(
  email: string,
): Promise<{ owner_phone: string | null; twilio_number: string | null } | null> {
  if (!email || !isDatabaseConfigured()) return null;
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("vraelis_workspaces" as never)
      .select("owner_phone, twilio_number")
      .eq("owner_email", normalizeEmail(email))
      .maybeSingle();
    if (error) return null;
    return (data as unknown as { owner_phone: string | null; twilio_number: string | null }) ?? null;
  } catch {
    return null;
  }
}

export async function setWorkspaceContact(
  email: string,
  fields: { ownerPhone?: string | null; twilioNumber?: string | null },
): Promise<void> {
  if (!email || !isDatabaseConfigured()) return;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.ownerPhone !== undefined) patch.owner_phone = fields.ownerPhone;
  if (fields.twilioNumber !== undefined) patch.twilio_number = fields.twilioNumber;
  try {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from("vraelis_workspaces" as never)
      .update(patch as never)
      .eq("owner_email", normalizeEmail(email));
    if (error) console.error("setWorkspaceContact: columns may not exist yet —", error.message);
  } catch (e) {
    console.error("setWorkspaceContact failed:", e);
  }
}

// Atomically claim a Twilio number for a workspace: only writes if no number is
// set yet (twilio_number IS NULL). Returns "won" if THIS call set it, "lost" if
// another row already had one (concurrent buy — the caller should release its
// number), or "error" if the write couldn't be confirmed (caller should NOT
// release, to avoid deleting a number that may actually be live). This makes
// provisioning safe against two concurrent provision calls double-buying.
export async function claimTwilioNumber(
  email: string,
  number: string,
): Promise<"won" | "lost" | "error"> {
  if (!email || !number || !isDatabaseConfigured()) return "error";
  try {
    const supabase = getSupabaseAdminClient();
    // Conditional update: WHERE owner_email = ? AND twilio_number IS NULL.
    // .select() returns the rows actually updated — 1 row => we won the claim.
    const { data, error } = await supabase
      .from("vraelis_workspaces" as never)
      .update({ twilio_number: number, updated_at: new Date().toISOString() } as never)
      .eq("owner_email", normalizeEmail(email))
      .is("twilio_number", null)
      .select("owner_email");
    if (error) {
      console.error("claimTwilioNumber failed:", error.message);
      return "error";
    }
    return (data as unknown[] | null)?.length ? "won" : "lost";
  } catch (e) {
    console.error("claimTwilioNumber failed:", e);
    return "error";
  }
}

// Route an inbound SMS/call (sent to a business's Twilio number) to its
// workspace. Fail-soft if the column isn't migrated.
export async function getWorkspaceByTwilioNumber(
  number: string,
): Promise<(VraelisWorkspace & { twilio_number: string | null }) | null> {
  if (!number || !isDatabaseConfigured()) return null;
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("vraelis_workspaces" as never)
      .select(`${WORKSPACE_COLS}, twilio_number`)
      .eq("twilio_number", number)
      .maybeSingle();
    if (error) return null;
    return (data as unknown as VraelisWorkspace & { twilio_number: string | null }) ?? null;
  } catch {
    return null;
  }
}

// Most recent lead for an owner matching a phone — routes inbound SMS to
// the right thread.
export async function findLeadByContactPhone(
  ownerEmail: string,
  phone: string,
): Promise<VraelisLead | null> {
  if (!ownerEmail || !phone || !isDatabaseConfigured()) return null;
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("vraelis_leads" as never)
    .select("*")
    .eq("owner_email", normalizeEmail(ownerEmail))
    .eq("contact_phone", phone.trim())
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as unknown as VraelisLead) ?? null;
}

// ── Stripe Connect (payouts) ──────────────────────────────────────────

export async function setWorkspaceConnect(
  email: string,
  fields: { accountId?: string; status?: string },
): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const supabase = getSupabaseAdminClient();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.accountId !== undefined) patch.connect_account_id = fields.accountId;
  if (fields.status !== undefined) patch.connect_status = fields.status;
  const { error } = await supabase
    .from("vraelis_workspaces" as never)
    .update(patch as never)
    .eq("owner_email", normalizeEmail(email));
  if (error) console.error("setWorkspaceConnect failed:", error);
}

export async function setWorkspaceDeposit(
  email: string,
  fields: { enabled: boolean; amountCents: number | null },
): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("vraelis_workspaces" as never)
    .update({
      deposit_enabled: fields.enabled,
      deposit_amount_cents: fields.amountCents,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("owner_email", normalizeEmail(email));
  if (error) console.error("setWorkspaceDeposit failed:", error);
}

// ── On-platform payments (the real revenue ledger) ────────────────────

export type VraelisPayment = {
  id: string;
  owner_email: string;
  lead_id: string | null;
  kind: "deposit" | "full";
  description: string | null;
  currency: string;
  amount_cents: number;
  fee_cents: number;
  status: "pending" | "paid" | "canceled";
  stripe_session_id: string | null;
  stripe_payment_intent: string | null;
  booking_slot: string | null;
  booking_name: string | null;
  booking_phone: string | null;
  created_at: string;
  paid_at: string | null;
};

const PAYMENT_COLS =
  "id, owner_email, lead_id, kind, description, currency, amount_cents, fee_cents, status, stripe_session_id, stripe_payment_intent, booking_slot, booking_name, booking_phone, created_at, paid_at";

// Duplicate-charge guard (P0 #4). Returns the kind of OPEN payment a lead
// already has, so callers refuse to mint a second live checkout link:
//   "paid"    — the lead already paid on-platform (never charge again).
//   "pending" — a live checkout link is already outstanding for this lead.
//   null      — no open payment; safe to create one.
// Scoping:
//   - leadId is REQUIRED to dedup; a null/empty leadId returns null (no lead
//     to dedup against — those paths can't be deduped by lead and the caller
//     must decide its own policy).
//   - bookingSlot (optional, ISO string): when set, only payments for THAT
//     slot count, so a lead booking a different slot is never blocked.
// Fail-OPEN on DB error (returns null): a transient read failure must not
// permanently block a legitimate payment; the worst case degrades to today's
// unguarded behavior, never to lost money.
// A pending row only blocks while its checkout link could still be live; past
// that it's a genuinely-dead abandoned link and MUST NOT block, or the lead
// would be locked out of every future link forever (nothing else transitions
// an abandoned row out of 'pending'). A PAID row always blocks regardless of
// age (never re-charge someone who paid).
//
// Sizing the window (this is load-bearing — too short reopens the
// duplicate-charge hole). The recovery cron runs DAILY, so its 72h reminder
// tier can slip up to ~24h, minting a fresh session as late as ~96h after
// created_at. Sessions are pinned to a 24h life (expires_at in
// createPaymentCheckout), so the last possible payable link dies at ~96h+24h =
// ~120h. We block to 126h for cron-drift margin. KEEP THIS ≥ (latest nudge age
// ~96h) + (session life 24h); it is intentionally aligned with the reconcile
// cron's MAX_AGE_MS.
const PENDING_BLOCK_WINDOW_MS = 126 * 60 * 60 * 1000;

export async function leadOpenPaymentStatus(
  email: string,
  leadId: string | null | undefined,
  opts?: { bookingSlot?: string | null; now?: number },
): Promise<"paid" | "pending" | null> {
  if (!email || !leadId || !isDatabaseConfigured()) return null;
  try {
    const supabase = getSupabaseAdminClient();
    let q = supabase
      .from("vraelis_payments" as never)
      .select("status, booking_slot, created_at")
      .eq("owner_email", normalizeEmail(email))
      .eq("lead_id", leadId)
      .in("status", ["pending", "paid"]);
    if (opts?.bookingSlot) q = q.eq("booking_slot", opts.bookingSlot);
    const { data, error } = await q;
    if (error) return null; // fail-open
    const rows = (data as unknown as { status: string; created_at: string }[]) ?? [];
    if (rows.some((r) => r.status === "paid")) return "paid";
    const now = opts?.now ?? Date.now();
    // Only a pending row still within its live-link window blocks; an
    // abandoned/expired pending row does not (would otherwise lock the lead out).
    const hasLivePending = rows.some(
      (r) => r.status === "pending" && now - new Date(r.created_at).getTime() < PENDING_BLOCK_WINDOW_MS,
    );
    return hasLivePending ? "pending" : null;
  } catch {
    return null; // fail-open
  }
}

export async function createPayment(input: {
  ownerEmail: string;
  leadId?: string | null;
  kind: "deposit" | "full";
  description?: string | null;
  amountCents: number;
  feeCents: number;
  currency?: string;
  sessionId: string;
  checkoutUrl?: string | null;
  bookingSlot?: string | null;
  bookingName?: string | null;
  bookingPhone?: string | null;
}): Promise<string | null> {
  if (!isDatabaseConfigured()) return null;
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("vraelis_payments" as never)
    .insert({
      owner_email: normalizeEmail(input.ownerEmail),
      lead_id: input.leadId ?? null,
      kind: input.kind,
      description: input.description ?? null,
      amount_cents: input.amountCents,
      fee_cents: input.feeCents,
      currency: input.currency ?? "usd",
      status: "pending",
      stripe_session_id: input.sessionId,
      checkout_url: input.checkoutUrl ?? null,
      booking_slot: input.bookingSlot ?? null,
      booking_name: input.bookingName ?? null,
      booking_phone: input.bookingPhone ?? null,
    } as never)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("createPayment failed:", error);
    return null;
  }
  return (data as unknown as { id: string } | null)?.id ?? null;
}

// Mark a payment paid by its checkout session id (idempotent). Returns the
// row so the caller (webhook) can close the lead / create the booking.
export async function markPaymentPaid(
  sessionId: string,
  paymentIntent: string | null,
): Promise<VraelisPayment | null> {
  if (!isDatabaseConfigured()) return null;
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("vraelis_payments" as never)
    .update({
      status: "paid",
      stripe_payment_intent: paymentIntent,
      paid_at: new Date().toISOString(),
    } as never)
    .eq("stripe_session_id", sessionId)
    // Only the FIRST delivery matches (status flips pending→paid). Duplicate
    // webhook deliveries find no pending row → null → caller short-circuits,
    // so booking creation + confirmation emails never re-fire.
    .eq("status", "pending")
    .select(PAYMENT_COLS)
    .maybeSingle();
  if (error) {
    console.error("markPaymentPaid failed:", error);
    return null;
  }
  return (data as unknown as VraelisPayment) ?? null;
}

// Mark an abandoned checkout as canceled (Stripe checkout.session.expired).
// Keyed on session id AND status='pending', so it never touches a row that was
// already paid, and only the session id Stripe is reporting as expired — a row
// the recovery cron already superseded (new session id swapped in) won't match
// and is correctly left pending. Idempotent: a duplicate event finds no
// pending row and no-ops.
export async function markPaymentCanceledBySession(sessionId: string): Promise<void> {
  if (!sessionId || !isDatabaseConfigured()) return;
  try {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from("vraelis_payments" as never)
      .update({ status: "canceled" } as never)
      .eq("stripe_session_id", sessionId)
      .eq("status", "pending");
    if (error) console.error("markPaymentCanceledBySession failed:", error.message);
  } catch (e) {
    console.error("markPaymentCanceledBySession failed:", e);
  }
}

// Real revenue from money that actually moved through the platform.
export async function getPaymentsSummary(
  email: string,
): Promise<{ grossCents: number; feeCents: number; netCents: number; paidCount: number }> {
  const empty = { grossCents: 0, feeCents: 0, netCents: 0, paidCount: 0 };
  if (!email || !isDatabaseConfigured()) return empty;
  const supabase = getSupabaseAdminClient();
  try {
    const { data, error } = await supabase
      .from("vraelis_payments" as never)
      .select("amount_cents, fee_cents")
      .eq("owner_email", normalizeEmail(email))
      .eq("status", "paid");
    if (error) throw error;
    const rows = (data as unknown as { amount_cents: number; fee_cents: number }[]) ?? [];
    const grossCents = rows.reduce((s, r) => s + (Number(r.amount_cents) || 0), 0);
    const feeCents = rows.reduce((s, r) => s + (Number(r.fee_cents) || 0), 0);
    return { grossCents, feeCents, netCents: grossCents - feeCents, paidCount: rows.length };
  } catch (error) {
    console.error("getPaymentsSummary failed:", error);
    return empty;
  }
}

export async function listPayments(
  email: string,
  opts?: { leadId?: string; limit?: number },
): Promise<VraelisPayment[]> {
  if (!email || !isDatabaseConfigured()) return [];
  const supabase = getSupabaseAdminClient();
  let q = supabase
    .from("vraelis_payments" as never)
    .select(PAYMENT_COLS)
    .eq("owner_email", normalizeEmail(email))
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 50);
  if (opts?.leadId) q = q.eq("lead_id", opts.leadId);
  const { data, error } = await q;
  if (error) {
    console.error("listPayments failed:", error);
    return [];
  }
  return (data as unknown as VraelisPayment[]) ?? [];
}

// Is this provider subscription id already recorded against a DIFFERENT
// workspace? Guards the PayPal record route (finding H1): without it, one
// subscription id could be replayed by several accounts to grant each of them a
// paid tier from a single payment. Fails soft to `false` when the DB isn't
// configured or the column isn't migrated — the caller's plan_id + status
// checks remain the primary control, this is the ownership backstop.
export async function isSubscriptionClaimedByAnother(
  subscriptionId: string,
  email: string,
): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("vraelis_workspaces" as never)
      .select("owner_email")
      .eq("plan_subscription_id", subscriptionId)
      .limit(2);
    if (error) {
      console.error("isSubscriptionClaimedByAnother (column may not be migrated):", error.message);
      return false;
    }
    const rows = (data as unknown as { owner_email: string }[]) ?? [];
    const owner = normalizeEmail(email);
    return rows.some((r) => normalizeEmail(r.owner_email ?? "") !== owner);
  } catch (e) {
    console.error("isSubscriptionClaimedByAnother failed:", e);
    return false;
  }
}
