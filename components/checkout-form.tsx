"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe, type Stripe as StripeJs } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import type { BillingCycle } from "../lib/stripe";
import type { PricingPlan } from "../lib/pricing";

type Props = {
  cycle: PublicCycle;
  plan: PricingPlan;
  publishableKey: string;
  seats: number;
  userEmail: string;
};

type PublicCycle = Extract<BillingCycle, "monthly" | "yearly">;

// Cache the Stripe promise so loadStripe only runs once per browser tab.
const stripePromiseCache = new Map<string, Promise<StripeJs | null>>();
function stripePromise(key: string): Promise<StripeJs | null> {
  let cached = stripePromiseCache.get(key);
  if (!cached) {
    cached = loadStripe(key);
    stripePromiseCache.set(key, cached);
  }
  return cached;
}

export function CheckoutForm({ cycle, plan, publishableKey, seats, userEmail }: Props) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loadError,    setLoadError]    = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/stripe/payment-intent", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ planKey: plan.key, cycle, seats }),
        });
        const data = (await res.json()) as { clientSecret?: string; error?: string };
        if (cancelled) return;
        if (!res.ok || !data.clientSecret) {
          setLoadError(data.error ?? "Could not start checkout.");
          return;
        }
        setClientSecret(data.clientSecret);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Could not start checkout.");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [plan.key, cycle, seats]);

  const stripeP = useMemo(() => stripePromise(publishableKey), [publishableKey]);

  if (loadError) {
    return (
      <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-5 text-sm text-red-200">
        {loadError}
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-sm text-neutral-400">
        Preparing secure checkout…
      </div>
    );
  }

  return (
    <Elements
      stripe={stripeP}
      options={{
        clientSecret,
        appearance: {
          theme: "night",
          variables: {
            colorPrimary:       "#ffffff",
            colorBackground:    "#0a0a0a",
            colorText:          "#f5f5f5",
            colorTextSecondary: "#a3a3a3",
            colorDanger:        "#f87171",
            fontFamily:         "inherit",
            borderRadius:       "12px",
            spacingUnit:        "4px",
          },
          rules: {
            ".Input": {
              border:          "1px solid rgba(255,255,255,0.1)",
              backgroundColor: "rgba(255,255,255,0.04)",
              boxShadow:       "none",
            },
            ".Input:focus": {
              border:    "1px solid rgba(255,255,255,0.4)",
              boxShadow: "0 0 0 3px rgba(255,255,255,0.08)",
            },
            ".Tab": {
              border:          "1px solid rgba(255,255,255,0.1)",
              backgroundColor: "rgba(255,255,255,0.04)",
            },
            ".Tab--selected": {
              border:          "1px solid rgba(255,255,255,0.4)",
              backgroundColor: "rgba(255,255,255,0.08)",
            },
          },
        },
      }}
    >
      <PaymentForm cycle={cycle} plan={plan} seats={seats} userEmail={userEmail} />
    </Elements>
  );
}

function PaymentForm({ cycle, plan, seats, userEmail }: {
  cycle: PublicCycle;
  plan: PricingPlan;
  seats: number;
  userEmail: string;
}) {
  const stripe   = useStripe();
  const elements = useElements();
  const router   = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setError(null);

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const returnUrl = `${origin}/checkout/success?plan=${plan.key}&cycle=${cycle}&seats=${seats}`;

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      // Redirect "if_required" keeps the user on-site when the card doesn't
      // need 3DS; we handle the follow-up manually.
      redirect: "if_required",
    });

    if (stripeError) {
      setError(stripeError.message ?? "Payment failed.");
      setSubmitting(false);
      return;
    }

    // Successful same-page confirmation — forward manually.
    router.push(`/checkout/success?plan=${plan.key}&cycle=${cycle}&seats=${seats}`);
  }

  const amount = cycle === "yearly" ? plan.yearlyLabel ?? plan.monthlyLabel : plan.monthlyLabel;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <PaymentElement
        options={{
          layout: "tabs",
          defaultValues: { billingDetails: { email: userEmail } },
        }}
      />

      {error && (
        <div className="rounded-xl border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || submitting}
        className="sansxel-white-button w-full rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Processing…" : `Subscribe to ${plan.name} — ${amount}`}
      </button>

      <p className="text-center text-[11px] leading-relaxed text-neutral-500">
        Secured by Stripe. Your card details are sent directly to Stripe and never touch sansxel servers.
      </p>
    </form>
  );
}
