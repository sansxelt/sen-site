// v0.1.16, Active addon resolver for the limit/gating layer.
//
// Reads the user's active recurring addons (copilot_pro_pack,
// power_pack) from Stripe so the chat/image/voice routes can lift
// weekly caps when an unlimited addon is active. Cached in-memory
// with a 5-minute TTL because:
//   - chat hot path can't afford a per-request Stripe roundtrip
//     (~200ms sequential: customers.list -> subscriptions.list)
//   - addon purchases are rare; staleness of a few minutes is fine
//   - we explicitly invalidate after a successful purchase so the
//     unlimited kicks in immediately for the buying user
//
// Always fails open (returns empty Set), a Stripe outage shouldn't
// block paying users from chatting. Worst case they hit the cap.

import {
  type BillingAddonKey,
  billingAddonMap,
  isOneTimeBoost,
} from "./pricing";
import {
  findUsableSubscription,
  getOrCreateCustomer,
  isStripeConfigured,
  STRIPE_PRICES,
} from "./stripe";
import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";

type CacheEntry = {
  addons: Set<BillingAddonKey>;
  expiresAt: number;
};

const TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

function resolveAddonKeyFromPrice(priceId: string): BillingAddonKey | null {
  for (const [key, cycles] of Object.entries(STRIPE_PRICES)) {
    if (cycles.monthly === priceId || cycles.yearly === priceId) {
      if (key in billingAddonMap) return key as BillingAddonKey;
    }
  }
  return null;
}

// PayPal-purchased recurring addons (Copilot Pro Pack / Power Pack)
// land in boost_credits with the addon_key, the same table one-time
// boosts use. They never get "consumed" because they grant ongoing
// access, not a single boost burn. We treat any unconsumed recurring
// addon row within the last 30 days as active (matches the "one
// billing cycle" copy the PayPal capture route shows the user).
const PAYPAL_ADDON_WINDOW_DAYS = 30;

async function getActiveAddonsFromPaypal(
  email: string,
): Promise<Set<BillingAddonKey>> {
  const out = new Set<BillingAddonKey>();
  if (!isDatabaseConfigured()) return out;
  try {
    const supabase = getSupabaseAdminClient();
    const cutoff = new Date(
      Date.now() - PAYPAL_ADDON_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    const { data, error } = await supabase
      .from("boost_credits" as never)
      .select("addon_key, created_at, consumed")
      .eq("email", email)
      .eq("consumed", false)
      .gte("created_at", cutoff);
    if (error) {
      console.warn("[active-addons] paypal lookup failed:", error.message);
      return out;
    }
    for (const row of (data ?? []) as Array<{ addon_key: string }>) {
      const key = row.addon_key as BillingAddonKey;
      // Only RECURRING addons grant ongoing access. One-time boosts
      // (session_boost / weekly_boost) are handled separately by
      // consumeBoostForKind and shouldn't show up here as "active."
      if (key in billingAddonMap && !isOneTimeBoost(key)) {
        out.add(key);
      }
    }
  } catch (err) {
    console.warn("[active-addons] paypal lookup threw:", err);
  }
  return out;
}

export async function getActiveAddonKeys(
  email: string,
): Promise<Set<BillingAddonKey>> {
  const key = email.trim().toLowerCase();
  if (!key) return new Set();

  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) {
    return hit.addons;
  }

  const result = new Set<BillingAddonKey>();

  // Fetch Stripe + PayPal sources in parallel. Either source missing
  // / failing is fine, we just lose visibility into addons from that
  // path until next cache cycle.
  const stripePromise: Promise<Set<BillingAddonKey>> = (async () => {
    const out = new Set<BillingAddonKey>();
    if (!isStripeConfigured()) return out;
    try {
      const customer = await getOrCreateCustomer(key);
      const subscription = await findUsableSubscription(customer.id);
      if (subscription) {
        // Only count addons attached to a LIVE subscription. Canceled /
        // incomplete subs have items but the user isn't being charged,
        // so they shouldn't unlock unlimited.
        const liveStatuses = new Set(["active", "trialing", "past_due"]);
        if (liveStatuses.has(subscription.status)) {
          for (const item of subscription.items.data) {
            const addonKey = resolveAddonKeyFromPrice(item.price.id);
            if (addonKey) out.add(addonKey);
          }
        }
      }
    } catch (err) {
      console.warn("[active-addons] Stripe lookup failed:", err);
    }
    return out;
  })();

  const [stripeAddons, paypalAddons] = await Promise.all([
    stripePromise,
    getActiveAddonsFromPaypal(key),
  ]);
  for (const k of stripeAddons) result.add(k);
  for (const k of paypalAddons) result.add(k);

  cache.set(key, { addons: result, expiresAt: now + TTL_MS });
  return result;
}

/** Drop the cached addon set for a user. Call after a successful
 * subscription_item create / removal so the new state takes effect
 * immediately on the next chat/image/voice request. */
export function invalidateAddonsCache(email: string): void {
  const key = email.trim().toLowerCase();
  if (!key) return;
  cache.delete(key);
}

/** True when the addon set lifts the cap for the given limit kind.
 *   chat/copilot: power_pack OR copilot_pro_pack (Power Pack bundles
 *     Copilot Pro Pack so either grants unlimited copilot/chat)
 *   image:        power_pack only (Copilot Pro Pack is copilot-scoped)
 *   voice:        power_pack only
 */
export function addonsLiftCap(
  addons: Set<BillingAddonKey>,
  kind: "chat" | "image" | "voice",
): boolean {
  if (kind === "chat") {
    return addons.has("power_pack") || addons.has("copilot_pro_pack");
  }
  return addons.has("power_pack");
}
