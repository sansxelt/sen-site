import { fetch } from "@tauri-apps/plugin-http";
import { API_BASE } from "./auth";

function authHeaders(token: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export type PricingPlanKey =
  | "free"
  | "apprentice"
  | "studio"
  | "pro"
  | "teams"
  | "enterprise";

export type BillingAddonKey =
  | "memory_boost"
  | "api_boost"
  | "key_pack"
  // v0.1.4 monetization — recurring add-on packs.
  // v0.1.9 dropped voice_pack + image_pack — replaced by credits flow.
  | "copilot_pro_pack"
  | "power_pack"
  // v0.1.4 monetization — one-time top-ups.
  // v0.1.9 dropped voice_minute_pack / image_credit_pack /
  // copilot_time_pack — those features burn credits now.
  | "session_boost"
  | "weekly_boost";

export const ONE_TIME_BOOST_KEYS: ReadonlySet<BillingAddonKey> = new Set([
  "session_boost",
  "weekly_boost",
]);

export function isOneTimeBoost(key: BillingAddonKey): boolean {
  return ONE_TIME_BOOST_KEYS.has(key);
}

export type BillingCycle = "monthly" | "yearly";

export type BillingPlanSummary = {
  apiRequestLimit: number | null;
  badge?: string;
  description: string;
  key: PricingPlanKey;
  memoryWindow: string;
  monthlyCredits: string;
  monthlyLabel: string;
  name: string;
  note: string;
  points: string[];
  yearlyLabel?: string;
};

export type BillingAddonSummary = {
  description: string;
  key: BillingAddonKey;
  monthlyLabel: string;
  name: string;
  note: string;
  points: string[];
  yearlyLabel?: string;
};

export type DesktopBillingState = {
  stripeConfigured: boolean;
  // v0.1.10 — addon keys whose STRIPE_PRICE_* env var is set on the
  // server. The billing panel uses this to hide boost cards for
  // products the operator hasn't created in Stripe yet.
  configured_addons: BillingAddonKey[];
  publishableKey: string | null;
  currentPlanKey: PricingPlanKey;
  currentPlanName: string;
  currentPlanDescription: string;
  currentPlanMemoryWindow: string;
  currentPlanMonthlyCredits: string;
  currentPlanApiRequestLimit: number | null;
  state: {
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: string | null;
    cycle: BillingCycle | null;
    invoices: Array<{
      amountDue: number;
      currency: string;
      date: string;
      hostedUrl: string | null;
      number: string | null;
      pdfUrl: string | null;
      status: string | null;
    }>;
    paymentMethod: {
      brand: string | null;
      expMonth: number | null;
      expYear: number | null;
      last4: string | null;
    } | null;
    planKey: PricingPlanKey | null;
    status: string | null;
    activeAddons: Array<{
      addon: BillingAddonSummary;
      itemId: string;
    }>;
  };
  plans: BillingPlanSummary[];
  addons: BillingAddonSummary[];
};

export async function getDesktopBillingState(
  token: string,
): Promise<DesktopBillingState> {
  const res = await fetch(`${API_BASE}/api/desktop/billing/state`, {
    method: "GET",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`getDesktopBillingState ${res.status}`);
  return (await res.json()) as DesktopBillingState;
}

export async function createDesktopBillingIntent(
  token: string,
  payload: {
    planKey?: PricingPlanKey;
    addonKey?: BillingAddonKey;
    cycle?: BillingCycle;
    seats?: number;
  },
): Promise<{
  status: string;
  clientSecret?: string;
  subscriptionId?: string;
  customerId?: string;
}> {
  const res = await fetch(`${API_BASE}/api/desktop/billing/payment-intent`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as {
    status?: string;
    clientSecret?: string;
    subscriptionId?: string;
    customerId?: string;
    error?: string;
  };
  if (!res.ok) throw new Error(data.error ?? `createDesktopBillingIntent ${res.status}`);
  return {
    status: data.status ?? "ready",
    clientSecret: data.clientSecret,
    subscriptionId: data.subscriptionId,
    customerId: data.customerId,
  };
}

export async function changeDesktopPlan(
  token: string,
  payload: { planKey: PricingPlanKey; cycle: BillingCycle },
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/desktop/billing/change-plan`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? `changeDesktopPlan ${res.status}`);
}

export async function cancelDesktopSubscription(
  token: string,
  undo = false,
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/desktop/billing/cancel${undo ? "?undo=true" : ""}`,
    {
      method: "POST",
      headers: authHeaders(token),
    },
  );
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? `cancelDesktopSubscription ${res.status}`);
}

export async function removeDesktopAddon(
  token: string,
  addonKey: BillingAddonKey,
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/desktop/billing/remove-addon`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ addonKey }),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? `removeDesktopAddon ${res.status}`);
}

export async function createDesktopSetupIntent(
  token: string,
): Promise<{ clientSecret: string; customerId: string }> {
  const res = await fetch(`${API_BASE}/api/desktop/billing/setup-intent`, {
    method: "POST",
    headers: authHeaders(token),
  });
  const data = (await res.json().catch(() => ({}))) as {
    clientSecret?: string;
    customerId?: string;
    error?: string;
  };
  if (!res.ok || !data.clientSecret || !data.customerId) {
    throw new Error(data.error ?? `createDesktopSetupIntent ${res.status}`);
  }
  return { clientSecret: data.clientSecret, customerId: data.customerId };
}

export async function updateDesktopPaymentMethod(
  token: string,
  paymentMethodId: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/desktop/billing/update-payment-method`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ paymentMethodId }),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? `updateDesktopPaymentMethod ${res.status}`);
}

// ── v0.1.9 — credits ─────────────────────────────────────────────────
//
// Buy credits in dollars; each USD becomes 100 credits. Used by the
// Credits card in the billing panel. Server route enforces the
// $1–$500 range so we don't have to validate twice.

export type CreditBalance = {
  balance: number;
  balance_dollars: number;
};

export async function getCreditBalance(token: string): Promise<CreditBalance> {
  const res = await fetch(`${API_BASE}/api/desktop/billing/balance`, {
    method: "GET",
    headers: authHeaders(token),
  });
  const data = (await res.json().catch(() => ({}))) as Partial<CreditBalance> & {
    error?: string;
  };
  if (!res.ok) throw new Error(data.error ?? `getCreditBalance ${res.status}`);
  return {
    balance: typeof data.balance === "number" ? data.balance : 0,
    balance_dollars:
      typeof data.balance_dollars === "number" ? data.balance_dollars : 0,
  };
}

export async function createCreditPurchase(
  token: string,
  dollars: number,
): Promise<{ clientSecret: string }> {
  const res = await fetch(`${API_BASE}/api/desktop/billing/credits`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ amount_dollars: dollars }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    clientSecret?: string;
    error?: string;
  };
  if (!res.ok || !data.clientSecret) {
    throw new Error(data.error ?? `createCreditPurchase ${res.status}`);
  }
  return { clientSecret: data.clientSecret };
}
