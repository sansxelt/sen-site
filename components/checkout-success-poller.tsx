"use client";

import { useEffect, useState } from "react";

type Snapshot = {
  subscription?: {
    plan?: { key?: string };
    status?: string;
  };
};

/**
 * Polls /api/account/subscription until the webhook-driven subscription
 * record in Supabase matches the plan the user just bought.  Gives us a
 * "nothing is happening, your account is still updating" → "you're in" UX
 * without needing realtime / WebSockets.
 */
export function CheckoutSuccessPoller({ expectedPlanKey }: { expectedPlanKey: string }) {
  const [state, setState] = useState<"waiting" | "confirmed" | "slow">("waiting");

  useEffect(() => {
    if (expectedPlanKey === "free") return;

    let cancelled = false;
    const start = Date.now();
    const maxMs = 20000; // give up after 20 s; webhook may be delayed

    async function tick() {
      if (cancelled) return;
      try {
        const res = await fetch("/api/account/subscription", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as Snapshot;
          const planKey = data.subscription?.plan?.key;
          const status  = data.subscription?.status;
          if (planKey === expectedPlanKey && status === "active") {
            setState("confirmed");
            return;
          }
        }
      } catch {
        // swallow — we'll retry
      }
      if (Date.now() - start > maxMs) {
        setState("slow");
        return;
      }
      window.setTimeout(tick, 1200);
    }

    tick();
    return () => { cancelled = true; };
  }, [expectedPlanKey]);

  if (state === "confirmed") {
    return (
      <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm text-emerald-200">
        Your plan is active. You can close this page.
      </div>
    );
  }

  if (state === "slow") {
    return (
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-neutral-300">
        Your payment went through but the subscription is still activating on
        our end. Refresh the account page in a minute if it hasn&apos;t updated.
      </div>
    );
  }

  return (
    <div className="mt-6 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-neutral-300">
      <span className="h-2 w-2 animate-pulse rounded-full bg-neutral-400" />
      Activating your subscription…
    </div>
  );
}
