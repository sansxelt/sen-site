// Per-seat / team billing (v1). A PAID seat is an ACTIVE workspace member with role
// admin|editor|viewer. Owner (billing account holder) and client_viewer are FREE;
// pending/revoked don't count. Self-contained — never touches personal billing or the
// personal webhook (state is lazy-synced from Stripe on the owner's team page). Gated
// behind STRIPE_TEAM_SEAT_PRICE_ID: if absent, "not configured" + no seat enforcement.
// The UI-facing state NEVER includes Stripe customer/subscription ids.

import { getStripe, isStripeConfigured, APP_URL } from "./stripe";
import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";
import { logEvent } from "./v-events";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || APP_URL;
const norm = (e: string) => e.trim().toLowerCase();

export const PAID_SEAT_ROLES = ["admin", "editor", "viewer"] as const;
const INCLUDED_FREE_SEATS = 1; // one internal collaborator included before a seat subscription

export function isTeamBillingConfigured(): boolean {
  return isStripeConfigured() && Boolean(process.env.STRIPE_TEAM_SEAT_PRICE_ID);
}

export async function paidSeatCounts(workspaceId: string): Promise<{ active: number; pendingPaid: number }> {
  if (!workspaceId || !isDatabaseConfigured()) return { active: 0, pendingPaid: 0 };
  try {
    const s = getSupabaseAdminClient();
    const { data } = await s.from("v_workspace_members" as never).select("role,status").eq("workspace_id", workspaceId).in("role", PAID_SEAT_ROLES as unknown as string[]);
    let active = 0, pendingPaid = 0;
    for (const m of (data as unknown as { role: string; status: string }[]) ?? []) { if (m.status === "active") active++; else if (m.status === "pending") pendingPaid++; }
    return { active, pendingPaid };
  } catch { return { active: 0, pendingPaid: 0 }; }
}

type BillingRow = { stripe_customer_id: string | null; stripe_subscription_id: string | null; stripe_subscription_item_id: string | null; seat_quantity: number; status: string | null; current_period_end: string | null } | null;

async function readBillingRow(workspaceId: string): Promise<BillingRow> {
  try {
    const s = getSupabaseAdminClient();
    const { data } = await s.from("v_workspace_billing" as never).select("stripe_customer_id,stripe_subscription_id,stripe_subscription_item_id,seat_quantity,status,current_period_end").eq("workspace_id", workspaceId).maybeSingle();
    return (data as unknown as BillingRow) ?? null;
  } catch { return null; }
}

async function upsertBilling(workspaceId: string, fields: Record<string, unknown>): Promise<void> {
  try {
    const s = getSupabaseAdminClient();
    await s.from("v_workspace_billing" as never).upsert({ workspace_id: workspaceId, ...fields, updated_at: new Date().toISOString() } as never, { onConflict: "workspace_id" });
  } catch { /* pre-migration / best-effort */ }
}

function periodEndIso(sub: { current_period_end?: number; items?: { data?: { current_period_end?: number }[] } }): string | null {
  const ts = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
  return ts ? new Date(ts * 1000).toISOString() : null;
}

// Refresh the stored row from Stripe (no webhook dependency). Best-effort.
async function syncFromStripe(workspaceId: string, row: BillingRow): Promise<BillingRow> {
  if (!row?.stripe_subscription_id || !isStripeConfigured()) return row;
  try {
    const sub = await getStripe().subscriptions.retrieve(row.stripe_subscription_id) as unknown as { status: string; current_period_end?: number; items: { data: { id: string; quantity?: number; current_period_end?: number }[] } };
    const item = sub.items.data[0];
    const upd = { status: sub.status, seat_quantity: item?.quantity ?? row.seat_quantity, stripe_subscription_item_id: item?.id ?? row.stripe_subscription_item_id, current_period_end: periodEndIso(sub) };
    await upsertBilling(workspaceId, upd);
    return { ...row, ...upd };
  } catch { return row; }
}

// Owner-facing seat state — SAFE (no Stripe ids).
export type TeamSeatState = { configured: boolean; enforced: boolean; used: number; pendingPaid: number; limit: number | null; overLimit: boolean; status: string | null; periodEnd: string | null; hasSubscription: boolean };

export async function teamSeatState(workspaceId: string): Promise<TeamSeatState> {
  const configured = isTeamBillingConfigured();
  const counts = await paidSeatCounts(workspaceId);
  let row = await readBillingRow(workspaceId);
  if (configured) row = await syncFromStripe(workspaceId, row);
  const subActive = !!row && (row.status === "active" || row.status === "trialing");
  const limit = configured ? INCLUDED_FREE_SEATS + (subActive ? row!.seat_quantity || 0 : 0) : null;
  return {
    configured, enforced: configured, used: counts.active, pendingPaid: counts.pendingPaid,
    limit, overLimit: !!(configured && limit != null && counts.active > limit),
    status: row?.status ?? null, periodEnd: row?.current_period_end ?? null, hasSubscription: !!row?.stripe_subscription_id,
  };
}

// Ownership-transfer guardrail: block transfer while a team-seat subscription is in a
// live/owing state (billing ownership transfer is NOT supported in v1). Allow when no
// row / no subscription / canceled / inactive. Syncs fresh status via teamSeatState.
const ACTIVE_BILLING_STATES = new Set(["active", "trialing", "past_due", "incomplete", "unpaid", "paused"]);
export async function hasActiveTeamBillingForTransferGuard(workspaceId: string): Promise<boolean> {
  try {
    const st = await teamSeatState(workspaceId);
    return st.hasSubscription && !!st.status && ACTIVE_BILLING_STATES.has(st.status);
  } catch { return false; } // fail-open is unsafe here -> but a thrown sync error shouldn't hard-block; logged elsewhere
}

// Invite-time gate: counts ACTIVE + PENDING paid so a workspace can't over-provision
// past its limit. Unconfigured => no enforcement (collaboration stays open).
export async function canAddPaidSeat(workspaceId: string): Promise<{ ok: boolean; used: number; limit: number | null }> {
  if (!isTeamBillingConfigured()) return { ok: true, used: 0, limit: null };
  const counts = await paidSeatCounts(workspaceId);
  const row = await readBillingRow(workspaceId);
  const subActive = !!row && (row.status === "active" || row.status === "trialing");
  const limit = INCLUDED_FREE_SEATS + (subActive ? row!.seat_quantity || 0 : 0);
  return { ok: counts.active + counts.pendingPaid < limit, used: counts.active, limit };
}

// Safe seat-lifecycle event (role/status change). No emails/ids.
export async function logSeatChange(actor: string, workspaceId: string, action: string): Promise<void> {
  const counts = await paidSeatCounts(workspaceId);
  await logEvent({ userId: norm(actor), eventType: "team_seat_count_changed", actorType: "owner", source: "app", metadata: { workspace_id: workspaceId, seat_count: counts.active, action } });
}

// ── Stripe flows (owner only; gated on config) ──
async function findOrCreateCustomer(email: string, name?: string | null): Promise<string> {
  const stripe = getStripe();
  const list = await stripe.customers.list({ email: norm(email), limit: 1 });
  if (list.data[0]) return list.data[0].id;
  const created = await stripe.customers.create({ email: norm(email), name: name ?? undefined });
  return created.id;
}

export async function startTeamCheckout(workspaceId: string, ownerEmail: string, ownerName: string | null): Promise<{ url?: string; error?: string }> {
  if (!isTeamBillingConfigured()) return { error: "not_configured" };
  try {
    const stripe = getStripe();
    const customerId = await findOrCreateCustomer(ownerEmail, ownerName);
    await upsertBilling(workspaceId, { stripe_customer_id: customerId });
    const qty = Math.max(1, (await paidSeatCounts(workspaceId)).active);
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: process.env.STRIPE_TEAM_SEAT_PRICE_ID!, quantity: qty }],
      customer: customerId,
      success_url: `${SITE}/app/team?team=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE}/app/team?team=cancel`,
      allow_promotion_codes: true,
      metadata: { type: "team_seats", workspace_id: workspaceId },
      subscription_data: { metadata: { type: "team_seats", workspace_id: workspaceId } },
    });
    await logEvent({ userId: norm(ownerEmail), eventType: "team_checkout_started", actorType: "owner", source: "web", metadata: { workspace_id: workspaceId, seat_count: qty } });
    return { url: checkout.url ?? undefined };
  } catch (e) { console.error("startTeamCheckout:", e); return { error: "checkout_failed" }; }
}

export async function openTeamPortal(workspaceId: string, ownerEmail: string, ownerName: string | null): Promise<{ url?: string; error?: string }> {
  if (!isTeamBillingConfigured()) return { error: "not_configured" }; // team billing isn't set up -> don't open personal billing
  if (!isStripeConfigured()) return { error: "billing_unavailable" };
  try {
    const stripe = getStripe();
    const row = await readBillingRow(workspaceId);
    const customerId = row?.stripe_customer_id ?? (await findOrCreateCustomer(ownerEmail, ownerName));
    await upsertBilling(workspaceId, { stripe_customer_id: customerId });
    const portal = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: `${SITE}/app/team` });
    await logEvent({ userId: norm(ownerEmail), eventType: "team_billing_portal_opened", actorType: "owner", source: "web", metadata: { workspace_id: workspaceId } });
    return { url: portal.url };
  } catch (e) { console.error("openTeamPortal:", e); return { error: "portal_failed" }; }
}

// Pull subscription state after a checkout return (no webhook). Owner-scoped via the
// session's workspace_id metadata.
export async function syncTeamCheckout(workspaceId: string, sessionId: string): Promise<void> {
  if (!isStripeConfigured() || !sessionId) return;
  try {
    const stripe = getStripe();
    const sess = await stripe.checkout.sessions.retrieve(sessionId);
    if (sess.metadata?.workspace_id !== workspaceId) return; // guard against mismatched session
    const subId = typeof sess.subscription === "string" ? sess.subscription : (sess.subscription as { id?: string } | null)?.id;
    const custId = typeof sess.customer === "string" ? sess.customer : (sess.customer as { id?: string } | null)?.id;
    if (!subId) return;
    const sub = await stripe.subscriptions.retrieve(subId) as unknown as { status: string; current_period_end?: number; items: { data: { id: string; quantity?: number; current_period_end?: number }[] } };
    const item = sub.items.data[0];
    await upsertBilling(workspaceId, { stripe_customer_id: custId ?? null, stripe_subscription_id: subId, stripe_subscription_item_id: item?.id ?? null, seat_quantity: item?.quantity ?? 0, status: sub.status, current_period_end: periodEndIso(sub) });
    await logEvent({ userId: "system", eventType: "team_billing_configured", actorType: "system", source: "stripe", metadata: { workspace_id: workspaceId, seat_count: item?.quantity ?? 0, billing_status: sub.status } });
  } catch (e) { console.error("syncTeamCheckout:", e); }
}

// ── Webhook-driven sync (real-time) ──
// Called from the Stripe webhook for customer.subscription.* events. Identifies a
// team-seat subscription by metadata.type === "team_seats" + workspace_id (set as
// subscription_data.metadata at checkout). Returns true if this was a team-seat event
// (handled here — caller must NOT fall through to personal-billing handling). The
// page-load syncFromStripe() stays as a backup. No Stripe ids logged.
type StripeSubLike = {
  id: string; status: string; customer: string | { id?: string } | null; current_period_end?: number;
  metadata?: Record<string, string> | null;
  items: { data: { id: string; quantity?: number; current_period_end?: number; price?: { id?: string } | null }[] };
};
const TEAM_TERMINAL_STATES = new Set(["canceled", "unpaid", "incomplete_expired"]);
export const isTeamSeatSubscription = (meta: Record<string, string> | null | undefined): boolean => meta?.type === "team_seats";

export async function handleTeamSubscriptionEvent(eventType: string, sub: StripeSubLike): Promise<boolean> {
  if (!isTeamSeatSubscription(sub?.metadata)) return false; // not a team-seat sub — let other handlers run
  const workspaceId = sub.metadata?.workspace_id || "";
  const ignored = async (reason: string) => { try { await logEvent({ userId: "system", eventType: "team_billing_webhook_ignored", actorType: "system", source: "stripe", metadata: { workspace_id: workspaceId || null, action: "subscription", event_type: eventType, reason } }); } catch {} };
  if (!workspaceId) { await ignored("no_workspace_id"); return true; }
  try {
    const s = getSupabaseAdminClient();
    const { data: ws } = await s.from("v_workspaces" as never).select("id").eq("id", workspaceId).maybeSingle();
    if (!ws) { await ignored("workspace_not_found"); return true; }
    const deleted = eventType === "customer.subscription.deleted";
    const canceled = deleted || TEAM_TERMINAL_STATES.has(sub.status);
    const pastDue = !canceled && sub.status === "past_due";
    const items = sub.items?.data ?? [];
    const seatItem = items.find((i) => i.price?.id === process.env.STRIPE_TEAM_SEAT_PRICE_ID) ?? items[0];
    const status = deleted ? "canceled" : sub.status;
    const seatQty = canceled ? 0 : (seatItem?.quantity ?? 0); // no active sub -> 0 seats; members are kept, never auto-revoked
    const custId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;
    // Keep historical Stripe ids server-side (audit) even on cancel.
    await upsertBilling(workspaceId, { stripe_customer_id: custId, stripe_subscription_id: sub.id, stripe_subscription_item_id: seatItem?.id ?? null, seat_quantity: seatQty, status, current_period_end: periodEndIso(sub) });
    const evt = canceled ? "team_billing_canceled" : pastDue ? "team_billing_past_due" : "team_billing_synced";
    await logEvent({ userId: "system", eventType: evt, actorType: "system", source: "stripe", metadata: { workspace_id: workspaceId, status, seat_quantity: seatQty, action: deleted ? "deleted" : "sync", event_type: eventType } });
    return true;
  } catch (e) {
    console.error("handleTeamSubscriptionEvent:", e);
    try { await logEvent({ userId: "system", eventType: "team_billing_webhook_failed", actorType: "system", source: "stripe", metadata: { workspace_id: workspaceId, action: "subscription", event_type: eventType } }); } catch {}
    return true; // handled (do not fall through to personal billing)
  }
}
