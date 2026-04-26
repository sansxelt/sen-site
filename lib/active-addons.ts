// v0.1.16 — Active addon resolver for the limit/gating layer.
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
// Always fails open (returns empty Set) — a Stripe outage shouldn't
// block paying users from chatting. Worst case they hit the cap.

import {
  type BillingAddonKey,
  billingAddonMap,
} from "./pricing";
import {
  findUsableSubscription,
  getOrCreateCustomer,
  isStripeConfigured,
  STRIPE_PRICES,
} from "./stripe";

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

  if (!isStripeConfigured()) {
    cache.set(key, { addons: result, expiresAt: now + TTL_MS });
    return result;
  }

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
          if (addonKey) result.add(addonKey);
        }
      }
    }
  } catch (err) {
    console.warn("[active-addons] Stripe lookup failed, defaulting empty:", err);
  }

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
