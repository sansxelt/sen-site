"use client";

import type { BillingCycle } from "./stripe";

/**
 * Kick off a plan subscription — navigates the user to the native /checkout
 * page where they pay with Stripe Payment Element inside our own layout.
 * No POST to Stripe, no redirect to stripe.com.
 */
export function startCheckout(
  planKey: string,
  cycle: BillingCycle = "monthly",
  seats = 1,
): void {
  const params = new URLSearchParams({ plan: planKey, cycle });
  if (planKey === "teams") params.set("seats", String(Math.max(3, seats)));
  window.location.href = `/checkout?${params.toString()}`;
}

/**
 * Add an addon on top of an existing subscription.  This does NOT need the
 * Payment Element — Stripe charges the default payment method already on the
 * subscription.  The API route does the work and returns ok/error.
 */
export async function startAddonCheckout(
  addonKey: string,
  cycle: BillingCycle = "monthly",
): Promise<void> {
  const res = await fetch("/api/stripe/payment-intent", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ addonKey, cycle }),
  });

  const data = (await res.json()) as { status?: string; error?: string };

  if (!res.ok) {
    throw new Error(data.error ?? "Could not add that addon.");
  }

  // Refresh to show the new addon in the billing UI.
  window.location.href = "/account/billing?addon=added";
}
