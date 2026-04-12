"use client";

import type { BillingCycle } from "./stripe";

export async function startCheckout(
  planKey: string,
  cycle: BillingCycle = "monthly",
  seats = 1,
): Promise<void> {
  const res = await fetch("/api/stripe/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planKey, cycle, seats }),
  });

  const data = (await res.json()) as { url?: string; error?: string };

  if (!res.ok || !data.url) {
    throw new Error(data.error ?? "Failed to start checkout.");
  }

  window.location.href = data.url;
}

export async function openBillingPortal(): Promise<void> {
  const res = await fetch("/api/stripe/portal", { method: "POST" });
  const data = (await res.json()) as { url?: string; error?: string };

  if (!res.ok || !data.url) {
    throw new Error(data.error ?? "Failed to open billing portal.");
  }

  window.location.href = data.url;
}
