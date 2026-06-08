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

type Props = {
  onClose:   () => void;
  onSuccess: () => void;
  publishableKey: string;
};

const stripePromiseCache = new Map<string, Promise<StripeJs | null>>();
function stripePromise(key: string): Promise<StripeJs | null> {
  let cached = stripePromiseCache.get(key);
  if (!cached) {
    cached = loadStripe(key);
    stripePromiseCache.set(key, cached);
  }
  return cached;
}

export function UpdatePaymentMethodModal({ onClose, onSuccess, publishableKey }: Props) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error,        setError]        = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/account/billing/setup-intent", { method: "POST" });
        const data = (await res.json()) as { clientSecret?: string; error?: string };
        if (cancelled) return;
        if (!res.ok || !data.clientSecret) {
          setError(data.error ?? "Could not start card update.");
          return;
        }
        setClientSecret(data.clientSecret);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not start card update.");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const stripeP = useMemo(() => stripePromise(publishableKey), [publishableKey]);

  // Portal target guard, document.body only exists client-side.
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
              Update payment method
            </div>
            <h2 className="mt-1 text-xl font-semibold text-white">New card</h2>
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

        {!clientSecret && !error && (
          <div className="mt-6 text-center text-sm text-neutral-400">Preparing…</div>
        )}

        {clientSecret && (
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
              <SetupForm onSuccess={onSuccess} onError={setError} />
            </Elements>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function SetupForm({ onError, onSuccess }: { onError: (m: string) => void; onSuccess: () => void }) {
  const stripe   = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setBusy(true);

    const { error, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: "if_required",
    });

    if (error) {
      onError(error.message ?? "Could not save card.");
      setBusy(false);
      return;
    }

    const pmId = typeof setupIntent?.payment_method === "string"
      ? setupIntent.payment_method
      : setupIntent?.payment_method?.id ?? null;

    if (!pmId) {
      onError("Stripe did not return a payment method id.");
      setBusy(false);
      return;
    }

    try {
      const res = await fetch("/api/account/billing/update-payment-method", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ paymentMethodId: pmId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Could not update card." }));
        throw new Error((data as { error?: string }).error ?? "Could not update card.");
      }
      onSuccess();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not update card.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement options={{ layout: "tabs" }} />
      <button
        type="submit"
        disabled={!stripe || busy}
        className="VRAELIS-white-button w-full rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save card"}
      </button>
    </form>
  );
}
