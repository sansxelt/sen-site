// Subscription self-heal. Webhooks are the primary signal for plan lifecycle,
// but a dropped/missed delivery — or a PayPal subscription created without a
// custom_id (which the webhook can't route) — would otherwise leave plan_status
// stale 'active' forever, keeping paid features + the agent number live and
// unbilled-for. This polls the provider's LIVE subscription status so a missed
// cancel / past_due self-heals within a day (driven by cron/subscriptions).

import type Stripe from "stripe";
import { getStripe, isStripeConfigured } from "./stripe";
import type { WorkspaceLapseRow } from "./vraelis-db";

export type LivePlan = { status: "active" | "past_due" | "canceled"; periodEndISO: string | null };

function mapStripeStatus(s: Stripe.Subscription.Status): LivePlan["status"] | null {
  if (s === "active" || s === "trialing") return "active";
  if (s === "past_due") return "past_due";
  if (s === "canceled" || s === "unpaid" || s === "incomplete_expired") return "canceled";
  return null; // incomplete / paused → transient, leave the workspace as-is
}

function periodEndISOFromStripe(sub: Stripe.Subscription): string | null {
  const raw = (sub as unknown as Record<string, unknown>)["current_period_end"];
  return typeof raw === "number" ? new Date(raw * 1000).toISOString() : null;
}

async function fetchStripeLive(row: WorkspaceLapseRow): Promise<LivePlan | null> {
  if (!isStripeConfigured()) return null;
  const stripe = getStripe();
  try {
    let sub: Stripe.Subscription | null = null;
    if (row.plan_subscription_id) {
      sub = await stripe.subscriptions.retrieve(row.plan_subscription_id);
    } else {
      // No stored id (older row) → find the customer by email and pick their
      // most relevant subscription.
      const customers = await stripe.customers.list({ email: row.owner_email, limit: 1 });
      const cust = customers.data[0];
      if (!cust) return { status: "canceled", periodEndISO: null }; // no customer → nothing live
      const subs = await stripe.subscriptions.list({ customer: cust.id, status: "all", limit: 10 });
      sub =
        subs.data.find((s) => ["active", "trialing", "past_due"].includes(s.status)) ??
        subs.data[0] ??
        null;
    }
    if (!sub) return { status: "canceled", periodEndISO: null };
    const status = mapStripeStatus(sub.status);
    if (!status) return null;
    return { status, periodEndISO: periodEndISOFromStripe(sub) };
  } catch (e) {
    console.error("[plan-sync] stripe poll failed for", row.owner_email, e);
    return null;
  }
}

const PP_BASE =
  (process.env.PAYPAL_ENV ?? "").toLowerCase() === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";

async function paypalToken(): Promise<string | null> {
  const cid = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!cid || !secret) return null;
  const basic = Buffer.from(`${cid}:${secret}`).toString("base64");
  try {
    const res = await fetch(`${PP_BASE}/v1/oauth2/token`, {
      method: "POST",
      headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials",
    });
    const json = (await res.json()) as { access_token?: string };
    return json.access_token ?? null;
  } catch {
    return null;
  }
}

function mapPaypalStatus(s: string | undefined): LivePlan["status"] | null {
  switch (s) {
    case "ACTIVE":
      return "active";
    case "SUSPENDED":
      return "past_due";
    case "CANCELLED":
    case "EXPIRED":
      return "canceled";
    default:
      return null; // APPROVAL_PENDING / APPROVED / unknown → transient
  }
}

async function fetchPaypalLive(row: WorkspaceLapseRow): Promise<LivePlan | null> {
  if (!row.plan_subscription_id) return null; // can't poll PayPal without the id
  const token = await paypalToken();
  if (!token) return null;
  try {
    const res = await fetch(`${PP_BASE}/v1/billing/subscriptions/${row.plan_subscription_id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const sub = (await res.json()) as { status?: string; billing_info?: { next_billing_time?: string } };
    const status = mapPaypalStatus(sub.status);
    if (!status) return null;
    const nb = sub.billing_info?.next_billing_time;
    return { status, periodEndISO: nb ? new Date(nb).toISOString() : null };
  } catch (e) {
    console.error("[plan-sync] paypal poll failed for", row.owner_email, e);
    return null;
  }
}

// Poll the provider for a workspace's LIVE plan status. Returns null when it
// can't be determined (provider unconfigured, transient state, poll error) —
// the caller should then leave the stored status untouched.
export async function fetchLivePlanStatus(row: WorkspaceLapseRow): Promise<LivePlan | null> {
  if (row.plan_provider === "paypal") return fetchPaypalLive(row);
  if (row.plan_provider === "stripe") return fetchStripeLive(row);
  // Unknown provider but a Stripe-looking sub id → try Stripe.
  if (row.plan_subscription_id?.startsWith("sub_")) return fetchStripeLive(row);
  return null;
}
