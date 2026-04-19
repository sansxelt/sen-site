import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getPlanForEmail } from "@/lib/account-billing";
import { tiersForPlan } from "@/lib/ai-models";
import { WebChat } from "@/components/web-chat";

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

  return (
    <WebChat
      email={email}
      plan={plan}
      tiers={tiers}
    />
  );
}
