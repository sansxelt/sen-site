import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "../../../auth";
import { CheckoutForm } from "../../../components/checkout-form";
import { getSignInPath } from "../../../lib/auth-ui";
import { getPricingPlan, pricingPlanMap } from "../../../lib/pricing";
import { getStripePublishableKey, isStripeConfigured } from "../../../lib/stripe";

export const metadata = {
  title: "Checkout",
  description: "Complete your sansxel subscription.",
};

type SearchParams = {
  plan?: string;
  cycle?: string;
  seats?: string;
};

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const session = await auth();
  if (!session?.user?.email) {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    redirect(getSignInPath(`/checkout?${qs}`));
  }

  if (!isStripeConfigured()) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-sm text-neutral-300">
          Checkout is not configured yet. Contact support.
        </div>
      </div>
    );
  }

  const publishableKey = getStripePublishableKey();
  if (!publishableKey) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-sm text-neutral-300">
          Checkout is missing a Stripe publishable key.
        </div>
      </div>
    );
  }

  const planKey = (params.plan ?? "").toLowerCase();
  if (!planKey || !(planKey in pricingPlanMap)) notFound();

  const plan = getPricingPlan(planKey as keyof typeof pricingPlanMap);
  if (plan.ctaVariant === "contact") redirect("/contact");
  if (plan.key === "free") redirect("/account");

  const cycle = params.cycle === "yearly" ? "yearly" : "monthly";
  const rawSeats = Number(params.seats);
  const seats = plan.key === "teams"
    ? Math.max(3, Number.isFinite(rawSeats) ? Math.floor(rawSeats) : 3)
    : 1;

  const amountLabel = cycle === "yearly" ? plan.yearlyLabel ?? plan.monthlyLabel : plan.monthlyLabel;

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-10 lg:px-8 lg:py-12">
      {/* ─── Order summary ──────────────────────────────────────────────── */}
      <section className="min-w-0">
        <div className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-400 sm:text-sm">
          Order summary
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          {plan.name}
        </h1>
        <p className="mt-2 text-sm leading-6 text-neutral-300">{plan.description}</p>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 sm:mt-6 sm:rounded-3xl sm:p-5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs text-neutral-400 sm:text-sm">
              {cycle === "yearly" ? "Yearly" : "Monthly"}
            </span>
            <span className="text-xl font-semibold text-white sm:text-2xl">{amountLabel}</span>
          </div>
          {plan.key === "teams" && (
            <div className="mt-3 flex items-baseline justify-between border-t border-white/10 pt-3">
              <span className="text-xs text-neutral-400 sm:text-sm">Seats</span>
              <span className="text-sm font-medium text-white">{seats}</span>
            </div>
          )}
          <ul className="mt-4 space-y-1.5 text-sm text-neutral-200 sm:mt-5 sm:space-y-2">
            {plan.points.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/70" />
                <span className="min-w-0 break-words">{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-4 text-xs text-neutral-500 sm:mt-5">
          Want a different plan?{" "}
          <Link href="/pricing" className="underline decoration-neutral-600 underline-offset-4 hover:text-white">
            Compare all plans
          </Link>
        </p>
      </section>

      {/* ─── Payment form ───────────────────────────────────────────────── */}
      <section className="min-w-0">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:rounded-3xl sm:p-6">
          <div className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-400 sm:text-sm">
            Payment
          </div>
          <h2 className="mt-1 text-lg font-semibold text-white sm:text-xl">Complete your purchase</h2>
          <p className="mt-1 break-all text-xs text-neutral-500">
            Paying as <span className="text-neutral-300">{session.user.email}</span>
          </p>

          <div className="mt-5 sm:mt-6">
            <CheckoutForm
              cycle={cycle}
              plan={plan}
              publishableKey={publishableKey}
              seats={seats}
              userEmail={session.user.email}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
