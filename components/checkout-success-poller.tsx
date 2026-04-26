"use client";

import { useEffect, useState } from "react";

type Snapshot = {
  subscription?: {
    plan?: { key?: string };
    status?: string;
  };
};

type Props = {
  expectedPlanKey: string;
  planName:        string;
  cycle:           "monthly" | "yearly";
};

type State = "confirming" | "active" | "still-pending";

/**
 * Owns the headline on the success page.  We only show the celebratory
 * "Welcome to {plan}" copy once the webhook has updated Supabase to
 * status = "active" with a matching plan.  Until then we show "Confirming
 * payment", because that is literally what is happening.
 */
export function CheckoutSuccessPoller({ expectedPlanKey, planName, cycle }: Props) {
  const [state, setState] = useState<State>(expectedPlanKey === "free" ? "active" : "confirming");

  useEffect(() => {
    if (state === "active") return;

    let cancelled = false;
    const start = Date.now();
    const maxMs = 20_000;

    async function tick() {
      if (cancelled) return;
      try {
        const res = await fetch("/api/account/subscription", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as Snapshot;
          if (
            data.subscription?.plan?.key === expectedPlanKey &&
            data.subscription?.status    === "active"
          ) {
            setState("active");
            return;
          }
        }
      } catch {
        // retry on the next tick
      }
      if (Date.now() - start > maxMs) {
        setState("still-pending");
        return;
      }
      window.setTimeout(tick, 1200);
    }

    tick();
    return () => { cancelled = true; };
  }, [expectedPlanKey, state]);

  if (state === "active") {
    return (
      <>
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Subscription active
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Welcome to {planName}.
        </h1>
        <p className="mt-2 text-sm leading-6 text-neutral-300">
          Your {cycle === "yearly" ? "annual" : "monthly"} subscription is live.
          A receipt from Stripe is on its way.
        </p>
      </>
    );
  }

  if (state === "still-pending") {
    return (
      <>
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-300">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          Still processing
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Almost there.
        </h1>
        <p className="mt-2 text-sm leading-6 text-neutral-300">
          Your payment went through, but Stripe hasn&apos;t finished notifying
          us that the subscription is active yet. This usually resolves in
          under a minute, refresh the billing page shortly.
        </p>
      </>
    );
  }

  // state === "confirming"
  return (
    <>
      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-neutral-300">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-400" />
        Confirming payment
      </div>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        Verifying your subscription…
      </h1>
      <p className="mt-2 text-sm leading-6 text-neutral-300">
        Waiting for Stripe to confirm the payment and activate your{" "}
        {planName} ({cycle === "yearly" ? "annual" : "monthly"}) plan.
        Usually takes a few seconds, don&apos;t close the tab.
      </p>
    </>
  );
}
