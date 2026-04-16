import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "../../../../auth";
import { getSignInPath } from "../../../../lib/auth-ui";
import { getPricingPlan, pricingPlanMap } from "../../../../lib/pricing";
import { CheckoutSuccessPoller } from "../../../../components/checkout-success-poller";

export const metadata = {
  title: "Payment received",
  description: "Your sansxel subscription is being activated.",
};

type SearchParams = {
  plan?: string;
  cycle?: string;
  seats?: string;
};

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const session = await auth();
  if (!session?.user?.email) redirect(getSignInPath("/account"));

  const planKey = (params.plan ?? "").toLowerCase();
  const plan = planKey in pricingPlanMap
    ? getPricingPlan(planKey as keyof typeof pricingPlanMap)
    : pricingPlanMap.free;

  const cycle = params.cycle === "yearly" ? "yearly" : "monthly";

  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 sm:p-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Payment received
        </div>

        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-white">
          Welcome to {plan.name}.
        </h1>
        <p className="mt-3 text-sm leading-6 text-neutral-300">
          Your {cycle === "yearly" ? "annual" : "monthly"} subscription is being
          activated. You&apos;ll get a receipt from Stripe shortly. This usually
          completes in a few seconds.
        </p>

        <CheckoutSuccessPoller expectedPlanKey={plan.key} />

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/account"
            className="sansxel-white-button flex-1 rounded-2xl bg-white px-5 py-3 text-center text-sm font-medium text-black transition hover:opacity-90"
          >
            Go to account
          </Link>
          <Link
            href="/account/billing"
            className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-center text-sm font-medium text-white transition hover:bg-white/10"
          >
            Manage billing
          </Link>
        </div>
      </div>
    </div>
  );
}
