"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  PayPalButtons,
  PayPalScriptProvider,
  type ReactPayPalScriptOptions,
} from "@paypal/react-paypal-js";
import type { PricingPlan } from "../lib/pricing";

type Props = {
  clientId: string;
  cycle: "monthly" | "yearly";
  plan: PricingPlan;
};

/**
 * PayPal checkout button rendered below the Stripe Payment Element.
 *
 * Flow:
 *   1. User clicks the PayPal button (rendered by PayPal's SDK).
 *   2. SDK fires createSubscription() → our /api/paypal/create-subscription
 *      creates the subscription on PayPal and returns its id.
 *   3. PayPal opens its approval popup/flow with that subscription.
 *   4. User approves → onApprove() fires with the subscription id.
 *   5. We send the user to /checkout/success?provider=paypal so the page
 *      polls /api/account/subscription until our webhook activates it.
 */
export function PayPalCheckoutButton({ clientId, cycle, plan }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const scriptOptions = useMemo<ReactPayPalScriptOptions>(() => ({
    clientId,
    currency: "USD",
    intent: "subscription",
    vault: true,
    // Only load the subscription-related components to keep the bundle small.
    components: "buttons",
  }), [clientId]);

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-neutral-500">
          or pay with
        </span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <PayPalScriptProvider options={scriptOptions}>
        <PayPalButtons
          style={{
            layout: "vertical",
            color:  "black",
            shape:  "rect",
            label:  "paypal",
            height: 44,
          }}
          createSubscription={async () => {
            setError(null);
            const res = await fetch("/api/paypal/create-subscription", {
              method:  "POST",
              headers: { "Content-Type": "application/json" },
              body:    JSON.stringify({ planKey: plan.key, cycle }),
            });
            const data = (await res.json()) as { subscriptionId?: string; error?: string };
            if (!res.ok || !data.subscriptionId) {
              setError(data.error ?? "Could not start PayPal checkout.");
              throw new Error(data.error ?? "Could not start PayPal checkout.");
            }
            return data.subscriptionId;
          }}
          onApprove={async (data) => {
            // PayPal handoff complete.  Our webhook will flip the sub to
            // active; the success page polls until it is.
            router.push(
              `/checkout/success?plan=${plan.key}&cycle=${cycle}&provider=paypal&subscription_id=${encodeURIComponent(data.subscriptionID ?? "")}`,
            );
          }}
          onCancel={() => {
            setError("PayPal checkout was canceled. You have not been charged.");
          }}
          onError={(err) => {
            console.error("[paypal button] error:", err);
            setError("PayPal ran into an error. Try a different payment method.");
          }}
        />
      </PayPalScriptProvider>

      {error && (
        <div className="mt-3 rounded-xl border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-200">
          {error}
        </div>
      )}
    </div>
  );
}
