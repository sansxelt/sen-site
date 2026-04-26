"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { loadStripe, type Stripe as StripeJs } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";

// Type-only $1–$9,999 input (no slider, Claude's pattern), with a
// Stripe PaymentElement modal that confirms the charge inline.
// On success the webhook credits the user's balance via the
// kind === "credits" branch of handlePaymentIntentSucceeded.

type Props = {
  onClose: () => void;
  onSuccess: (dollars: number) => void;
  publishableKey: string;
};

const MIN = 1;
const MAX = 9_999;

const stripePromiseCache = new Map<string, Promise<StripeJs | null>>();
function stripePromise(key: string): Promise<StripeJs | null> {
  let cached = stripePromiseCache.get(key);
  if (!cached) {
    cached = loadStripe(key);
    stripePromiseCache.set(key, cached);
  }
  return cached;
}

export function BuyCreditsModal({ onClose, onSuccess, publishableKey }: Props) {
  // Two-step flow: step 1 = pick amount, step 2 = pay.
  const [step, setStep] = useState<"amount" | "pay">("amount");
  // Stored as a string so the user can clear the field while typing.
  // Parsed on submit. Default $10, small enough to not feel pushy,
  // big enough to be a meaningful top-up.
  const [amountStr, setAmountStr] = useState("10");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [confirmedDollars, setConfirmedDollars] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const parsedDollars = useMemo(() => {
    const n = Math.floor(Number(amountStr));
    if (!Number.isFinite(n) || n < MIN || n > MAX) return null;
    return n;
  }, [amountStr]);

  const stripeP = useMemo(() => stripePromise(publishableKey), [publishableKey]);

  async function handleContinue() {
    if (!parsedDollars) {
      setError(`Enter an amount between $${MIN} and $${MAX.toLocaleString()}.`);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/account/billing/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount_dollars: parsedDollars }),
      });
      const data = (await res.json()) as { clientSecret?: string; dollars?: number; error?: string };
      if (!res.ok || !data.clientSecret) {
        throw new Error(data.error ?? "Could not start credits checkout.");
      }
      setClientSecret(data.clientSecret);
      setConfirmedDollars(data.dollars ?? parsedDollars);
      setStep("pay");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start credits checkout.");
    } finally {
      setBusy(false);
    }
  }

  // Portal target guard.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9990] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl border border-white/10 bg-neutral-950 p-6 sm:p-7"
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-400">
              Top up credits
            </div>
            <h2 className="mt-1 text-xl font-semibold text-white">
              {step === "amount" ? "How much?" : `Pay $${confirmedDollars}`}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-neutral-400 transition hover:bg-white/5 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {step === "amount" && (
          <div className="mt-6 space-y-4">
            <label className="block">
              <div className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">
                Amount (USD)
              </div>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base text-neutral-500">$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={amountStr}
                  onChange={(e) => {
                    // Only digits, strip everything else as the user
                    // types. Empty string allowed so they can clear.
                    const v = e.target.value.replace(/[^0-9]/g, "");
                    setAmountStr(v);
                    setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && parsedDollars && !busy) {
                      e.preventDefault();
                      void handleContinue();
                    }
                  }}
                  placeholder="10"
                  autoFocus
                  className="w-full rounded-2xl border border-white/10 bg-white/5 pl-9 pr-4 py-3 text-base text-white outline-none focus:border-white/30"
                />
              </div>
              <div className="mt-2 text-xs text-neutral-500">
                ${MIN} – ${MAX.toLocaleString()}.
                {parsedDollars && (
                  <> Buys {(parsedDollars * 100).toLocaleString()} credits, ~{(parsedDollars * 100).toLocaleString()} chats, {(parsedDollars * 20).toLocaleString()} images, or {(parsedDollars * 50).toLocaleString()} voice minutes.</>
                )}
              </div>
            </label>

            <button
              type="button"
              onClick={handleContinue}
              disabled={!parsedDollars || busy}
              className="sansxel-white-button w-full rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Preparing…" : parsedDollars ? `Continue to pay $${parsedDollars}` : "Enter an amount"}
            </button>
          </div>
        )}

        {step === "pay" && clientSecret && (
          <div className="mt-6">
            <Elements
              stripe={stripeP}
              options={{
                clientSecret,
                appearance: {
                  theme: "night",
                  variables: {
                    colorPrimary:    "#ffffff",
                    colorBackground: "#0a0a0a",
                    colorText:       "#f5f5f5",
                    fontFamily:      "inherit",
                    borderRadius:    "12px",
                  },
                },
              }}
            >
              <PayForm
                dollars={confirmedDollars ?? 0}
                onSuccess={() => onSuccess(confirmedDollars ?? 0)}
                onError={setError}
              />
            </Elements>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function PayForm({
  dollars,
  onError,
  onSuccess,
}: {
  dollars: number;
  onError: (m: string) => void;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    const { error } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });
    if (error) {
      onError(error.message ?? "Payment failed.");
      setBusy(false);
      return;
    }
    // Webhook will credit the balance, onSuccess just closes the
    // modal and refreshes the panel. Balance will update on next load.
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement options={{ layout: "tabs" }} />
      <button
        type="submit"
        disabled={!stripe || busy}
        className="sansxel-white-button w-full rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Charging…" : `Pay $${dollars}`}
      </button>
    </form>
  );
}
