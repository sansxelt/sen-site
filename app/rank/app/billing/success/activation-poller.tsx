"use client";

// Activation observer for /billing/success. The redirect from Stripe is never trusted: the WEBHOOK is
// the only activation authority, and this component just polls /api/v/me every 2 seconds (up to 60
// seconds) until the webhook's write becomes visible as plan_v1, a legacy plan change, or a balance
// increase. If nothing lands in a minute it says so honestly instead of pretending.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { I, Ic } from "@/app/rank/_components/icons";

export type PlanDisplay = { name: string; included: string[] };

type Me = { signedIn: boolean; plan?: string; balance?: number; plan_v1?: string | null; plan_v1_cycle?: string | null };

type Phase =
  | { kind: "confirming" }
  | { kind: "activated"; planKey: string | null; cycle: string | null; balance: number | null }
  | { kind: "waiting" };

const POLL_MS = 2000;
const MAX_POLLS = 30; // 60 seconds

export function ActivationPoller({ expectedPlan, expectedCycle, plans }: {
  expectedPlan: string | null;
  expectedCycle: string | null;
  plans: Record<string, PlanDisplay>;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "confirming" });
  const baseline = useRef<Me | null>(null);

  useEffect(() => {
    let cancelled = false;
    let polls = 0;

    const check = async () => {
      polls += 1;
      let me: Me | null = null;
      try { me = await fetch("/api/v/me", { cache: "no-store" }).then((r) => r.json()); } catch { /* keep polling */ }
      if (cancelled) return;
      if (me && me.signedIn) {
        if (!baseline.current) baseline.current = me;
        const activated =
          // The plan we watched checkout start for is now on the account (webhook landed).
          (expectedPlan && (me.plan_v1 === expectedPlan || me.plan === expectedPlan))
          // No session context: any _v1 plan appearing proves a webhook write (nothing else sets it).
          || (!expectedPlan && !!me.plan_v1)
          // Legacy fallback: the plan changed, or credits landed (top-up sessions that reach this page).
          || (!expectedPlan && baseline.current && (me.plan !== baseline.current.plan
            || (typeof me.balance === "number" && typeof baseline.current.balance === "number" && me.balance > baseline.current.balance)));
        if (activated) {
          setPhase({
            kind: "activated",
            planKey: me.plan_v1 ?? (expectedPlan && me.plan === expectedPlan ? expectedPlan : null),
            cycle: me.plan_v1_cycle ?? expectedCycle,
            balance: typeof me.balance === "number" ? me.balance : null,
          });
          return;
        }
      }
      if (polls >= MAX_POLLS) { setPhase({ kind: "waiting" }); return; }
      timer = window.setTimeout(check, POLL_MS);
    };

    let timer = window.setTimeout(check, 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [expectedPlan, expectedCycle]);

  if (phase.kind === "confirming") {
    const name = expectedPlan ? plans[expectedPlan]?.name : null;
    return (
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <span style={{ color: "var(--acc-deep)" }}><Ic d={I.clock} size={18} /></span>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16 }}>
            {name ? `Activating your ${name} plan` : "Confirming your payment"}
          </span>
        </div>
        <p style={{ fontSize: 13.5, color: "var(--fg-3)", margin: "0 0 16px", lineHeight: 1.6, maxWidth: 560 }}>
          Stripe has taken the payment. Activation is completed by Stripe&apos;s confirmation to our servers,
          not by this page, and it usually lands within a few seconds. You can leave this page open, your
          plan will appear here the moment it is active.
        </p>
        <div style={{ display: "grid", gap: 8 }}>
          <div className="skel" style={{ height: 14, width: "62%" }} />
          <div className="skel" style={{ height: 14, width: "48%" }} />
          <div className="skel" style={{ height: 14, width: "55%" }} />
        </div>
      </div>
    );
  }

  if (phase.kind === "activated") {
    const plan = phase.planKey ? plans[phase.planKey] : null;
    return (
      <div className="card" style={{ borderColor: "var(--acc-line)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span style={{ width: 26, height: 26, flex: "none", borderRadius: "50%", background: "var(--acc-soft)", border: "1px solid var(--acc-line)", color: "var(--acc-deep)", display: "grid", placeItems: "center" }}><Ic d={I.check} size={14} sw={2.2} /></span>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 17 }}>
            {plan ? `Your ${plan.name} plan is active` : "Payment confirmed"}
          </span>
          {plan && phase.cycle ? <span className="pill" style={{ background: "var(--acc-soft)", color: "var(--acc-deep)", borderColor: "var(--acc-line)" }}>{phase.cycle === "yearly" ? "Yearly" : "Monthly"}</span> : null}
        </div>
        {plan ? (
          <>
            <p style={{ fontSize: 13.5, color: "var(--fg-3)", margin: "0 0 14px", lineHeight: 1.6 }}>Everything below is live on your account now.</p>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 18px", display: "grid", gap: 9 }}>
              {plan.included.map((x) => (
                <li key={x} style={{ display: "flex", gap: 10, fontSize: 13.5, color: "var(--fg-2)", alignItems: "flex-start", lineHeight: 1.45 }}>
                  <span style={{ width: 17, height: 17, flex: "none", marginTop: 1, borderRadius: "50%", background: "var(--acc-soft)", border: "1px solid var(--acc-line)", color: "var(--acc-deep)", display: "grid", placeItems: "center" }}><Ic d={I.check} size={10} sw={2.4} /></span>{x}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p style={{ fontSize: 13.5, color: "var(--fg-3)", margin: "0 0 18px", lineHeight: 1.6 }}>
            Your account is updated{typeof phase.balance === "number" ? `, current balance ${phase.balance.toLocaleString()} credits` : ""}.
            Your complete billing state is on the billing page.
          </p>
        )}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/systems" className="btn">Go to your systems</Link>
          <Link href="/plans" className="btn btn--ghost">View your plan</Link>
        </div>
      </div>
    );
  }

  // Still processing after 60s: honest state, no fake success.
  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={{ color: "var(--money)" }}><Ic d={I.clock} size={18} /></span>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16 }}>Payment received, activation still completing</span>
      </div>
      <p style={{ fontSize: 13.5, color: "var(--fg-3)", margin: "0 0 10px", lineHeight: 1.6, maxWidth: 580 }}>
        Your payment went through, but the activation confirmation from Stripe has not reached our servers
        yet. This occasionally takes a few minutes. Your plan will activate on its own, there is nothing
        you need to redo, and you will not be charged again.
      </p>
      <p style={{ fontSize: 13.5, color: "var(--fg-3)", margin: "0 0 16px", lineHeight: 1.6, maxWidth: 580 }}>
        If it still has not appeared after a few minutes, email{" "}
        <a href="mailto:help@vraelis.com" style={{ color: "var(--acc-deep)" }}>help@vraelis.com</a> and we
        will finish it manually.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button onClick={() => window.location.reload()} className="btn">Check again</button>
        <Link href="/billing" className="btn btn--ghost">Go to billing</Link>
      </div>
    </div>
  );
}
