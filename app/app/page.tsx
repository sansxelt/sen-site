import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getPlanForEmail, getSubscriptionForEmail } from "@/lib/account-billing";
import { getBillingState } from "@/lib/billing-state";
import { tiersForPlan } from "@/lib/ai-models";
import { WebChat } from "@/components/web-chat";
import { LeiShell } from "@/components/lei-shell";

export const metadata: Metadata = {
  title: "sansxel — workspace",
  description: "Talk to sansxel-1 in your browser. Same brain as the desktop.",
};

export default async function WebAppPage() {
  const session = await auth();
  const email = session?.user?.email ?? null;

  if (!email) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/app")}`);
  }

  const plan = await getPlanForEmail(email);
  const tiers = tiersForPlan(plan).map((t) => ({
    tier: t.tier,
    display_name: t.display_name,
    blurb: t.blurb,
  }));

  // Pull lightweight subscription info so the chat header can show
  // "expires in N days" if the plan is on its way out. We try Stripe
  // (authoritative on cancel_at_period_end) but fall back to the
  // local subscription row if Stripe isn't reachable — never block
  // the workspace render on this.
  let planExpiresAt: string | null = null;
  let planCanceling = false;
  try {
    const billing = await getBillingState(email);
    planExpiresAt = billing.currentPeriodEnd;
    planCanceling = billing.cancelAtPeriodEnd;
  } catch {
    try {
      const sub = await getSubscriptionForEmail(email);
      planExpiresAt = sub?.current_period_end ?? null;
      // Heuristic: if status is canceled/past_due, treat as canceling.
      planCanceling = sub?.status === "canceled" || sub?.status === "past_due";
    } catch {
      // ignore — header just won't show expiry
    }
  }

  return (
    <LeiShell>
      <WebChat
        email={email}
        plan={plan}
        tiers={tiers}
        planExpiresAt={planExpiresAt}
        planCanceling={planCanceling}
      />
    </LeiShell>
  );
}
