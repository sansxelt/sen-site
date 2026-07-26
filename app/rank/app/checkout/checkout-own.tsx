"use client";

import { useEffect, useMemo, useState } from "react";
import { loadStripe, type Appearance } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";

/* CHECKOUT, ON OUR OWN PAGE.
 *
 * The other client in this folder mounts Stripe's embedded Checkout: a Stripe-drawn iframe that owns the
 * whole surface, its own summary column, its own button, its own typography. This one owns the page and
 * gives Stripe exactly one job, the payment fields, which is the smallest surface that can still keep card
 * data off our servers.
 *
 * THAT LAST PART IS NOT NEGOTIABLE AND IS WHY THERE IS STILL AN IFRAME. The card number never touches this
 * component, this bundle, or our servers: PaymentElement renders Stripe-hosted inputs and confirmPayment
 * sends the details straight to Stripe. Building "real" inputs and posting them ourselves would move the
 * company into a PCI scope it has no reason to enter. Every product that appears to have its own payment
 * screen is doing exactly this.
 *
 * THE STYLING IS RESTATED, NOT IMPORTED. Our stylesheet cannot cross into Stripe's iframe, so the design 06
 * values are written out below through the Appearance API. Same trade as public/vraelis/authenticated.css
 * and the stealth curtain: keep it in step with the token layer by hand, because nothing can do it for us.
 */

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "");

// Design 06, restated for the iframe. Graphite grounds, near-white ink, contrast (never a hue) for the
// primary action, and the same hairlines. `night` is the closest base so the browser's own autofill and
// dropdown chrome inside the frame stays dark too.
const APPEARANCE: Appearance = {
  theme: "night",
  variables: {
    colorPrimary: "#FAFAFA",
    colorBackground: "#0A0A0B",
    colorText: "#FAFAFA",
    colorTextSecondary: "#C4C5C9",
    colorTextPlaceholder: "#8E9095",
    colorDanger: "#FF7A55",
    fontFamily: "var(--font-geist-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
    fontSizeBase: "15px",
    borderRadius: "10px",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": { backgroundColor: "#0A0A0B", border: "1px solid rgba(255,255,255,0.14)", boxShadow: "none" },
    ".Input:focus": { border: "1px solid rgba(255,255,255,0.34)", boxShadow: "none" },
    ".Tab": { backgroundColor: "#121214", border: "1px solid rgba(255,255,255,0.14)", boxShadow: "none" },
    ".Tab--selected": { backgroundColor: "#1B1C1F", border: "1px solid rgba(255,255,255,0.34)", color: "#FAFAFA" },
    ".Label": { color: "#C4C5C9", fontWeight: "500" },
    ".Error": { color: "#FF7A55" },
  },
};

type Intent = { clientSecret: string; subscriptionId: string; amountCents: number | null; currency: string };
type Fail = { error: string; message?: string; manage?: string };

const money = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);

/** The form. Split out because useStripe/useElements only exist inside <Elements>. */
function PayForm({ returnUrl, label }: { returnUrl: string; label: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements || busy) return;      // a double submit must not become a second confirm
    setBusy(true);
    setError(null);

    // confirmPayment handles 3D Secure by redirecting and coming back to return_url. When no challenge is
    // required it resolves here instead, which is why both outcomes have to be handled: the success case
    // below only runs when the browser never left.
    const { error: err, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: "if_required",
    });

    if (err) {
      // card_error and validation_error are the customer's to fix and are safe to show verbatim. Anything
      // else is ours and gets a generic line, because Stripe's internal messages are not customer copy.
      setError(err.type === "card_error" || err.type === "validation_error"
        ? err.message ?? "That payment could not be completed."
        : "Something went wrong taking that payment. Nothing has been charged.");
      setBusy(false);
      return;
    }

    if (paymentIntent && (paymentIntent.status === "succeeded" || paymentIntent.status === "processing")) {
      // The plan is NOT active yet and this page must not pretend otherwise. The webhook is the only
      // activation authority; /billing/success polls until its write is visible.
      window.location.assign(returnUrl);
      return;
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit}>
      <PaymentElement onReady={() => setReady(true)} options={{ layout: "tabs" }} />

      {error ? (
        <p role="alert" style={{
          marginTop: 16, padding: "11px 14px", borderRadius: 10, fontSize: 13.5, lineHeight: 1.5,
          background: "var(--stop-wash)", border: "1px solid var(--stop-line)", color: "var(--stop-ink)",
        }}>{error}</p>
      ) : null}

      <button type="submit" className="btn" disabled={!stripe || !ready || busy}
        style={{ width: "100%", justifyContent: "center", marginTop: 18, opacity: !ready || busy ? 0.7 : 1 }}>
        {busy ? "Confirming…" : label}
      </button>

      <p style={{ marginTop: 12, fontSize: 12, lineHeight: 1.55, color: "var(--fg-3)", textAlign: "center" }}>
        Card details go straight to Stripe and never reach Vraelis. You can cancel at any time from Billing.
      </p>
    </form>
  );
}

/* THE PAYMENT PANEL, AND ONLY THAT.
 *
 * It deliberately does not draw a summary or a price. app/rank/app/checkout/page.tsx already renders the
 * order, what the plan includes, and V1RenewalTerms, which states renewal and cancellation in plain words
 * BEFORE payment. Re-implementing any of that here would give two versions of a screen that has to be
 * accurate, and the renewal terms are the last thing that should be duplicated. This slots into the same
 * column Stripe's embedded Checkout used to occupy. */
export function OwnPaymentPanel({
  plan, cycle, returnUrl,
}: {
  plan: string;
  cycle: "monthly" | "yearly";
  returnUrl: string;
}) {
  const [intent, setIntent] = useState<Intent | null>(null);
  const [fail, setFail] = useState<Fail | null>(null);

  useEffect(() => {
    let cancelled = false;
    // StrictMode double-invokes effects in development. The route is idempotent by design: it reuses an
    // existing incomplete subscription and pins an idempotency key, so a second call returns the SAME
    // intent rather than creating a second subscription. This flag only stops a late response from
    // writing state after unmount.
    (async () => {
      const r = await fetch("/api/v/subscribe/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, cycle }),
      }).catch(() => null);
      if (cancelled) return;
      const j = (await r?.json().catch(() => null)) as (Intent & Fail) | null;
      if (!r?.ok || !j?.clientSecret) { setFail(j ?? { error: "checkout_failed" }); return; }
      setIntent(j);
    })();
    return () => { cancelled = true; };
  }, [plan, cycle]);

  const options = useMemo(
    () => (intent ? { clientSecret: intent.clientSecret, appearance: APPEARANCE } : null),
    [intent],
  );

  if (fail) {
    return (
      <div>
        <p style={{ margin: 0, fontSize: 15, color: "var(--fg-1)" }}>
          {fail.error === "already_subscribed" ? "You already have an active plan." : "This checkout could not be started."}
        </p>
        <p style={{ margin: "8px 0 0", fontSize: 13.5, lineHeight: 1.6, color: "var(--fg-2)" }}>
          {fail.message ?? "Nothing has been charged. Try again in a moment, or open Billing to see your current plan."}
        </p>
        <a href={fail.manage ?? "/billing"} className="btn btn--ghost" style={{ marginTop: 18, justifyContent: "center" }}>
          Open Billing
        </a>
      </div>
    );
  }

  if (!options) {
    // Reserve roughly the height the form takes, so the card does not jump when Stripe mounts.
    return (
      <div aria-live="polite" style={{ minHeight: 280, display: "grid", placeItems: "center", color: "var(--fg-3)", fontSize: 13.5 }}>
        Preparing a secure payment form…
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise} options={options}>
      <PayForm
        returnUrl={returnUrl}
        label={intent?.amountCents != null ? `Pay ${money(intent.amountCents, intent.currency)}` : "Subscribe"}
      />
    </Elements>
  );
}
