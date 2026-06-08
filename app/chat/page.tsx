import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getPlanForEmail, getSubscriptionForEmail } from "@/lib/account-billing";
import { getBillingState } from "@/lib/billing-state";
import { tiersForPlan } from "@/lib/ai-models";
import { WebChat } from "@/components/web-chat";
import { LeiShell } from "@/components/lei-shell";

export const metadata: Metadata = {
  title: "Vraelis, workspace",
  description: "Talk to vraelis-1 in your browser. Same brain as the desktop.",
};

export default async function ChatPage() {
  const session = await auth();
  const email = session?.user?.email ?? null;

  if (!email) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/chat")}`);
  }

  const plan = await getPlanForEmail(email);
  const tiers = tiersForPlan(plan).map((t) => ({
    tier: t.tier,
    display_name: t.display_name,
    blurb: t.blurb,
  }));

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
      planCanceling = sub?.status === "canceled" || sub?.status === "past_due";
    } catch {
      // ignore, header just won't show expiry
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
