"use client";

import { useCallback, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { PAYPAL_PLANS, type Cycle, type PlanKey } from "@/lib/vraelis-plans";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "");

export function CheckoutClient({
  plan,
  cycle,
}: {
  plan: PlanKey;
  cycle: Cycle;
  priceLabel: string;
}) {
  const [method, setMethod] = useState<"card" | "paypal">("card");
  const [error, setError] = useState<string | null>(null);
  const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? "";
  const paypalPlanId = cycle === "lifetime" ? null : PAYPAL_PLANS[plan][cycle];
  const showPaypalTab = Boolean(paypalPlanId && paypalClientId);

  // Stripe embedded checkout pulls its client secret from our API.
  const fetchClientSecret = useCallback(async () => {
    const res = await fetch("/api/vraelis/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, cycle }),
    });
    if (res.status === 401) {
      window.location.href = `/signin?callbackUrl=${encodeURIComponent(`/checkout?plan=${plan}&cycle=${cycle}`)}`;
      return "";
    }
    const json = (await res.json()) as { clientSecret?: string };
    return json.clientSecret ?? "";
  }, [plan, cycle]);

  const tabStyle = (active: boolean) => ({
    flex: 1,
    border: "1px solid " + (active ? "var(--fg-1)" : "var(--line-2)"),
    background: active ? "var(--bg-1)" : "transparent",
    color: active ? "var(--fg-1)" : "var(--fg-3)",
    borderRadius: "var(--r-xs)",
    padding: "10px 12px",
    fontSize: 13.5,
    fontWeight: active ? 600 : 500,
    cursor: "pointer",
  });

  return (
    <div>
      {showPaypalTab && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button type="button" style={tabStyle(method === "card")} onClick={() => setMethod("card")}>
            Card · Bank · Amazon
          </button>
          <button type="button" style={tabStyle(method === "paypal")} onClick={() => setMethod("paypal")}>
            PayPal
          </button>
        </div>
      )}

      {method === "card" ? (
        <div style={{ background: "var(--bg-1)", border: "1px solid var(--line-1)", borderRadius: "var(--r-sm)", overflow: "hidden" }}>
          <EmbeddedCheckoutProvider stripe={stripePromise} options={{ fetchClientSecret }}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      ) : (
        showPaypalTab && (
          <div className="win" style={{ padding: "22px 22px 24px" }}>
            <PayPalScriptProvider options={{ clientId: paypalClientId, vault: true, intent: "subscription" }}>
              <PayPalButtons
                style={{ layout: "vertical", color: "gold", shape: "pill", label: "subscribe" }}
                createSubscription={(_d, actions) => actions.subscription.create({ plan_id: paypalPlanId! })}
                onApprove={async (data) => {
                  try {
                    await fetch("/api/vraelis/paypal/record", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ subscriptionID: data.subscriptionID, plan, cycle }),
                    });
                  } catch {
                    /* verified on account load if needed */
                  }
                  window.location.href = "/account?checkout=success";
                }}
                onError={() => setError("PayPal checkout failed — try card instead.")}
              />
            </PayPalScriptProvider>
          </div>
        )
      )}

      {error && <p style={{ fontSize: 13, color: "#9F2D2D", textAlign: "center", marginTop: 14 }}>{error}</p>}
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-5)", textAlign: "center", marginTop: 16 }}>
        Secure checkout · cancel anytime
      </p>
    </div>
  );
}
