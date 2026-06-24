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
