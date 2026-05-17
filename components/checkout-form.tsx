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

  // Surface a clear error when Stripe.js itself fails to load (bad
  // publishable key, network blocked, ad-blocker eats it). Otherwise
  // <Elements stripe={null}> would render an empty form and the
  // user would be stuck on a blank checkout with no feedback.
  useEffect(() => {
    let cancelled = false;
    void stripeP.then((s) => {
      if (!cancelled && !s) {
        setLoadError(
          "Couldn't load Stripe. Disable any payment-related extensions or check your connection, then refresh.",
        );
      }
    });
    return () => { cancelled = true; };
  }, [stripeP]);

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

    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      // Redirect "if_required" keeps the user on-site when possible; Stripe
      // only navigates away for flows that genuinely need it (3DS, PayPal,
      // bank redirects).  On return we re-verify status.
      redirect: "if_required",
    });

    if (stripeError) {
      setError(stripeError.message ?? "Payment failed.");
      setSubmitting(false);
      return;
    }

    // If confirmPayment redirected away, the browser is already navigating
    // and paymentIntent is undefined, don't do anything here.
    if (!paymentIntent) return;

    // Only "succeeded" (card cleared) and "processing" (async settlement
    // like bank debit) count as real success.  Everything else, including
    // requires_payment_method (user cancelled Cash App QR, card was declined
    // post-auth, etc.), must NOT send the user to the success page.
    switch (paymentIntent.status) {
      case "succeeded":
      case "processing":
        router.push(`/checkout/success?plan=${plan.key}&cycle=${cycle}&seats=${seats}`);
        return;
      case "requires_payment_method":
        setError("Payment was not completed. Try a different method or try again.");
        setSubmitting(false);
        return;
      case "requires_action":
        setError("Extra verification is required. Follow the prompt that appeared, or try again.");
        setSubmitting(false);
        return;
      case "canceled":
        setError("This payment was canceled. Try again when you're ready.");
        setSubmitting(false);
        return;
      default:
        setError(`Payment is in an unexpected state (${paymentIntent.status}). Contact support if this persists.`);
        setSubmitting(false);
    }
  }

  const amount = cycle === "yearly" ? plan.yearlyLabel ?? plan.monthlyLabel : plan.monthlyLabel;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
      <PaymentElement
        options={{
          layout: "tabs",
          defaultValues: { billingDetails: { email: userEmail } },
          wallets: { applePay: "auto", googlePay: "auto" },
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
        className="VRAELIS-white-button w-full rounded-2xl bg-white px-4 py-3 text-sm font-medium text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:px-5"
      >
        <span className="block truncate">
          {submitting ? "Processing…" : `Subscribe to ${plan.name}, ${amount}`}
        </span>
      </button>

      <div className="flex flex-col items-center gap-2 pt-2 sm:gap-3">
        <div className="inline-flex items-center gap-1.5 text-[11px] text-neutral-500">
          <span>Secured by</span>
          <StripeWordmark className="h-[14px] w-auto text-neutral-300" />
        </div>
        <p className="max-w-xs text-center text-[10px] leading-relaxed text-neutral-600 sm:text-[11px]">
          Card details are sent directly to Stripe and never touch Vraelis servers.
        </p>
      </div>
    </form>
  );
}

/**
 * Stripe wordmark SVG, the official brand mark, rendered in currentColor
 * so it picks up our neutral text tone instead of screaming purple.
 */
function StripeWordmark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 60 25"
      fill="currentColor"
      aria-label="Stripe"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M59.64 14.28c0-4.43-2.14-7.92-6.24-7.92-4.11 0-6.6 3.49-6.6 7.89 0 5.21 2.94 7.85 7.16 7.85 2.05 0 3.61-.46 4.8-1.12v-3.47c-1.18.59-2.54.95-4.25.95-1.68 0-3.17-.59-3.36-2.64h8.47c0-.22.02-1.12.02-1.54Zm-8.55-1.65c0-1.97 1.2-2.79 2.3-2.79 1.08 0 2.22.82 2.22 2.79h-4.52Zm-10.99-6.27c-1.7 0-2.79.8-3.4 1.34l-.22-1.07h-3.8v20.36l4.32-.92.02-5.14c.62.45 1.54 1.08 3.05 1.08 3.09 0 5.92-2.49 5.92-7.98-.01-5.02-2.87-7.67-5.89-7.67Zm-1.04 11.8c-1.02 0-1.62-.36-2.03-.81l-.02-6.42c.45-.5 1.06-.86 2.05-.86 1.56 0 2.64 1.76 2.64 4.04 0 2.33-1.07 4.05-2.64 4.05ZM29.32 5.34l4.34-.93V.91L29.32 1.8v3.54Zm4.34 1.32h-4.34v14.98h4.34V6.66Zm-9.03 1.26-.28-1.26h-3.73V21.7h4.32V11.55c1.02-1.33 2.74-1.08 3.28-.89V6.66c-.56-.21-2.57-.6-3.59 1.26Zm-8.65-4.99-4.21.9-.02 13.85c0 2.56 1.92 4.44 4.48 4.44 1.42 0 2.46-.26 3.03-.57v-3.51c-.55.22-3.28 1.02-3.28-1.54V10.35h3.28v-3.7h-3.28l.02-3.72Zm-9.75 8.05c0-.68.54-.93 1.44-.93 1.3 0 2.93.39 4.22 1.09V6.77c-1.41-.56-2.81-.77-4.2-.77-3.43 0-5.71 1.8-5.71 4.79 0 4.67 6.41 3.92 6.41 5.94 0 .8-.69 1.06-1.64 1.06-1.41 0-3.22-.58-4.65-1.37v4.1c1.58.68 3.17.96 4.65.96 3.52 0 5.94-1.74 5.94-4.77-.02-5.04-6.46-4.14-6.46-6.06Z" />
    </svg>
  );
}
